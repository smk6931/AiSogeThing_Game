"""
키워드 기반 검색 Tool
- 제목/태그에서 키워드 매칭 (LIKE 또는 Full-Text Search)
"""
from core.database import fetch_all

async def keyword_search_videos(query: str, limit: int = 20):
    """
    영상 키워드 검색 (제목 + 태그 + 채널명)
    """
    sql = """
        SELECT video_id, title, channel_title, thumbnail_url, view_count, is_short, published_at
        FROM youtube_list
        WHERE title ILIKE :q OR tags ILIKE :q OR channel_title ILIKE :q
        ORDER BY view_count DESC
        LIMIT :limit
    """
    results = await fetch_all(sql, {"q": f"%{query}%", "limit": limit})
    return results

async def keyword_search_channels(query: str, limit: int = 20):
    """
    채널 키워드 검색 (이름 + 키워드 + 설명)
    """
    sql = """
        SELECT channel_id, name, keywords, category, thumbnail_url, description
        FROM youtube_channels
        WHERE name ILIKE :q OR keywords ILIKE :q OR description ILIKE :q
        LIMIT :limit
    """
    results = await fetch_all(sql, {"q": f"%{query}%", "limit": limit})
    return results
