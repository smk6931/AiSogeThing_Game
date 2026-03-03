"""
스마트 검색 API Router
- 영상/채널 검색을 하나의 엔드포인트로 통합
- 의도 분류 후 적절한 Tool 실행
"""
from fastapi import APIRouter, Depends
from content.user.router import get_current_user
from content.search.service import classify_search_intent
from content.search.tools import (
    keyword_search_videos, keyword_search_channels,
    personalized_recommend_videos, personalized_recommend_channels,
    find_similar_videos, find_similar_channels,
    analyze_user_preference
)

router = APIRouter(prefix="/api/content/search", tags=["Smart Search"])

@router.get("/smart")
async def smart_search(
    query: str,
    target: str = "video",  # "video" | "channel"
    current_user: dict = Depends(get_current_user)
):
    """
    스마트 검색 (의도 기반 라우팅)
    
    Query Params:
        - query: 검색어
        - target: "video" (영상 검색) 또는 "channel" (채널 검색)
    
    Intent Types:
        - keyword: 기본 키워드 검색
        - personalized: 개인화 추천
        - similar: 유사 콘텐츠
        - analyze: 성향 분석 (영상 검색에서만)
    """
    user_id = current_user['id']
    intent = classify_search_intent(query)
    
    print(f"🔍 [SmartSearch] Query: '{query}', Intent: {intent}, Target: {target}")
    
    # Intent에 따라 적절한 Tool 실행
    if intent == "analyze":
        # 성향 분석 (영상 검색에서만 유효)
        if target == "video":
            stats = await analyze_user_preference(user_id)
            return {"intent": "analyze", "data": stats}
        else:
            intent = "keyword"  # 채널 검색에서는 키워드로 fallback
    
    if intent == "personalized":
        # 개인화 추천
        if target == "video":
            results = await personalized_recommend_videos(user_id, limit=20)
        else:
            results = await personalized_recommend_channels(user_id, limit=10)
        return {"intent": "personalized", "results": results}
    
    elif intent == "similar":
        # 유사 콘텐츠 검색 (벡터)
        if target == "video":
            results = await find_similar_videos(query, limit=20)
        else:
            results = await find_similar_channels(query, limit=10)
        return {"intent": "similar", "results": results}
    
    else:  # intent == "keyword"
        # 기본 키워드 검색
        if target == "video":
            results = await keyword_search_videos(query, limit=20)
        else:
            results = await keyword_search_channels(query, limit=10)
        return {"intent": "keyword", "results": results}
