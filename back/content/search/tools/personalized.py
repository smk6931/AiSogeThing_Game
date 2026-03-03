"""
개인화 추천 Tool
- 유저의 시청 기록/구독 채널 기반 추천
"""
from core.database import fetch_all

async def personalized_recommend_videos(user_id: int, limit: int = 20):
    """
    유저 취향 기반 영상 추천
    - 가장 많이 본 카테고리
    - 구독한 채널의 최신 영상
    """
    # 1. 유저가 많이 본 카테고리 파악
    category_sql = """
        SELECT yl.category_id, COUNT(*) as cnt
        FROM user_youtube_logs uyl
        JOIN youtube_list yl ON uyl.video_id = yl.video_id
        WHERE uyl.user_id = :uid AND yl.category_id IS NOT NULL
        GROUP BY yl.category_id
        ORDER BY cnt DESC
        LIMIT 3
    """
    top_categories = await fetch_all(category_sql, {"uid": user_id})
    
    if not top_categories:
        # 신규 유저 → 인기 영상 추천
        return await fetch_all("""
            SELECT video_id, title, channel_title, thumbnail_url, view_count
            FROM youtube_list
            ORDER BY view_count DESC
            LIMIT :limit
        """, {"limit": limit})
    
    # 2. 해당 카테고리 영상 추천
    cat_ids = [str(c['category_id']) for c in top_categories]
    sql = f"""
        SELECT video_id, title, channel_title, thumbnail_url, view_count, category_id
        FROM youtube_list
        WHERE category_id IN ({','.join(cat_ids)})
        ORDER BY published_at DESC, view_count DESC
        LIMIT :limit
    """
    results = await fetch_all(sql, {"limit": limit})
    return results

async def personalized_recommend_channels(user_id: int, limit: int = 10):
    """
    유저 취향 기반 채널 추천
    - 구독한 채널과 비슷한 채널 (벡터 유사도)
    """
    # 구독 채널 기준 유사 채널 (벡터 검색)
    # 일단 간단하게: 키워드 겹치는 채널 추천
    sql = """
        SELECT DISTINCT yc.channel_id, yc.name, yc.keywords, yc.thumbnail_url
        FROM user_logs ul
        JOIN youtube_channels yc ON ul.content_id = yc.channel_id
        JOIN youtube_channels yc2 ON yc.keywords ILIKE '%' || yc2.keywords || '%'
        WHERE ul.user_id = :uid AND ul.action = 'subscribe'
        LIMIT :limit
    """
    results = await fetch_all(sql, {"uid": user_id, "limit": limit})
    return results if results else []
