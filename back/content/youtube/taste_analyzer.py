"""
사용자 취향 분석 모듈 (Channel-Based Strategy)
RSS 영상을 저장하지 않고, 사용자가 구독한 채널의 메타데이터로 취향을 분석합니다.
"""
from core.database import fetch_all


async def analyze_user_taste(user_id: int) -> dict:
    """
    사용자 취향 분석 (구독 채널 기반)
    Returns: {
        "top_keywords": ["키워드1", "키워드2", ...],
        "top_categories": ["카테고리1", ...],
        "channel_count": 10
    }
    """
    # 1. 내 구독 채널 목록과 메타데이터 조회
    sql = """
        SELECT 
            c.keywords,
            c.category,
            c.description
        FROM user_logs ul
        JOIN youtube_channels c ON ul.content_id = c.channel_id
        WHERE ul.user_id = :uid
          AND ul.content_type = 'youtube_channel'
          AND ul.action = 'subscribe'
    """
    
    channels = await fetch_all(sql, {"uid": user_id})
    
    if not channels:
        return {"top_keywords": [], "top_categories": [], "channel_count": 0}
    
    # 2. 키워드 추출 및 빈도 계산
    keyword_freq = {}
    category_freq = {}
    
    for ch in channels:
        # 키워드 파싱 (콤마로 분리)
        if ch.get("keywords"):
            kws = [k.strip() for k in ch["keywords"].split(",") if k.strip()]
            for kw in kws:
                keyword_freq[kw] = keyword_freq.get(kw, 0) + 1
        
        # 카테고리 집계
        if ch.get("category"):
            cat = ch["category"]
            category_freq[cat] = category_freq.get(cat, 0) + 1
    
    # 3. 상위 키워드/카테고리 추출
    top_keywords = sorted(keyword_freq.items(), key=lambda x: x[1], reverse=True)[:10]
    top_categories = sorted(category_freq.items(), key=lambda x: x[1], reverse=True)[:5]
    
    return {
        "top_keywords": [kw for kw, _ in top_keywords],
        "top_categories": [cat for cat, _ in top_categories],
        "channel_count": len(channels)
    }
