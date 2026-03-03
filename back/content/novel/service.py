from core.database import execute, fetch_one, fetch_all, insert_and_return
from content.novel.schemas import NovelCreate

async def create_novel(topic: str):
    """
    Create a new novel entry.
    Initially, the script might just be the topic or empty until generated.
    """
    # 임시 제목 생성
    title = topic[:50] + "..." if len(topic) > 50 else topic
    
    sql = """
        INSERT INTO novels (title, script, created_at)
        VALUES (:title, '', NOW())
        RETURNING id, title, script, created_at
    """
    # Using insert_and_return to ensure COMMIT
    return await insert_and_return(sql, {"title": title})

async def create_novel_cut(novel_id: int, cut_order: int, scene_desc: str, image_path: str):
    """
    Create a 4-cut scene entry.
    """
    sql = """
        INSERT INTO novel_cuts (novel_id, cut_order, scene_desc, image_path)
        VALUES (:novel_id, :cut_order, :scene_desc, :image_path)
        RETURNING id, novel_id, cut_order, scene_desc, image_path
    """
    return await insert_and_return(sql, {
        "novel_id": novel_id,
        "cut_order": cut_order,
        "scene_desc": scene_desc,
        "image_path": image_path
    })

async def get_novel(novel_id: int):
    """
    Get novel and its cuts.
    """
    sql = "SELECT id, title, script, character_descriptions, thumbnail_image, created_at FROM novels WHERE id = :id"
    novel = await fetch_one(sql, {"id": novel_id})
    
    if not novel:
        return None
    
    sql_cuts = "SELECT id, novel_id, cut_order, scene_desc, image_path FROM novel_cuts WHERE novel_id = :id ORDER BY cut_order"
    cuts = await fetch_all(sql_cuts, {"id": novel_id})
    
    # 결과 합치기 (Dict로 반환하면 Router에서 Pydantic이 변환함)
    novel["cuts"] = cuts
    return novel

async def list_novels(limit: int = 20):
    sql = """
        SELECT n.id, n.title, n.script, n.created_at, n.thumbnail_image, n.character_descriptions,
        COALESCE(n.thumbnail_image, (SELECT image_path FROM novel_cuts WHERE novel_id = n.id ORDER BY cut_order LIMIT 1)) as thumbnail_image
        FROM novels n
        ORDER BY n.created_at DESC LIMIT :limit
    """
    return await fetch_all(sql, {"limit": limit})

async def update_novel(novel_id: int, **kwargs):
    """
    Update novel fields dynamically.
    """
    if not kwargs:
        return
    
    set_clause = ", ".join([f"{key} = :{key}" for key in kwargs.keys()])
    sql = f"UPDATE novels SET {set_clause} WHERE id = :id"
    kwargs["id"] = novel_id
    await execute(sql, kwargs)

async def delete_novel(novel_id: int):
    """
    Delete a novel and its related cuts.
    """
    # Delete related cuts first (manual cascade)
    await execute("DELETE FROM novel_cuts WHERE novel_id = :id", {"id": novel_id})
    await execute("DELETE FROM novels WHERE id = :id", {"id": novel_id})
