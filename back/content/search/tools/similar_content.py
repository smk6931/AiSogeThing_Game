"""
유사 콘텐츠 검색 Tool
- 벡터 유사도 기반 검색 (pgvector)
"""
from core.database import fetch_all
from client.openai_client import get_embedding_openai

async def find_similar_videos(query: str, limit: int = 10):
    """
    벡터 유사도 기반 영상 검색
    - 검색어를 벡터화하여 유사한 영상 찾기
    """
    # 1. 검색어 벡터화
    query_vector = await get_embedding_openai(query)
    
    # 2. 벡터 유사도 검색
    sql = """
        SELECT video_id, title, channel_title, thumbnail_url, view_count,
               (1 - (embedding <=> :qv)) as similarity
        FROM youtube_list
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> :qv ASC
        LIMIT :limit
    """
    results = await fetch_all(sql, {"qv": str(query_vector), "limit": limit})
    return results

async def find_similar_channels(query: str, limit: int = 10):
    """
    벡터 유사도 기반 채널 검색
    """
    query_vector = await get_embedding_openai(query)
    
    sql = """
        SELECT channel_id, name, keywords, thumbnail_url, description,
               (1 - (embedding <=> :qv)) as similarity
        FROM youtube_channels
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> :qv ASC
        LIMIT :limit
    """
    results = await fetch_all(sql, {"qv": str(query_vector), "limit": limit})
    return results
