"""
스마트 검색 의도 분류 서비스
- 검색어를 분석하여 적절한 Tool로 라우팅
"""

def classify_search_intent(query: str) -> str:
    """
    검색어의 의도를 분류
    
    Returns:
        - 'personalized': 개인화 추천 ("재밌는 거 추천해줘")
        - 'similar': 유사 콘텐츠 ("한문철이랑 비슷한 거")
        - 'analyze': 성향 분석 ("내 취향 분석해줘")
        - 'keyword': 기본 키워드 검색 (기본값)
    """
    query_lower = query.lower().strip()
    
    # 1. 개인화 추천
    personalized_keywords = ["추천", "취향", "좋아할", "재밌는", "볼만한", "인기있는"]
    if any(kw in query_lower for kw in personalized_keywords):
        return "personalized"
    
    # 2. 유사 콘텐츠
    similar_keywords = ["비슷한", "유사한", "같은", "이랑", "처럼"]
    if any(kw in query_lower for kw in similar_keywords):
        return "similar"
    
    # 3. 성향 분석
    analyze_keywords = ["성향", "분석", "취향 파악", "패턴"]
    if any(kw in query_lower for kw in analyze_keywords):
        return "analyze"
    
    # 4. 기본 키워드 검색
    return "keyword"
