from core.database import fetch_all
from client.openai_client import get_embedding_openai, generate_response_openai
from utils.safe_ops import safe_execute

async def analyze_user_context(user_id: int) -> str:
    """
    유저의 시청 기록과 구독 채널을 기반으로 'Context String' 생성
    """
    # 1. 최근 시청 기록 (상위 10개)
    log_sql = """
        SELECT yl.title, yl.channel_title, yl.tags
        FROM user_youtube_logs uyl
        JOIN youtube_list yl ON uyl.video_id = yl.video_id
        WHERE uyl.user_id = :uid
        ORDER BY uyl.updated_at DESC
        LIMIT 100
    """
    logs = await fetch_all(log_sql, {"uid": user_id})
    
    # 2. 구독 채널 (상위 5개)
    sub_sql = """
        SELECT yc.name, yc.keywords 
        FROM user_logs ul
        JOIN youtube_channels yc ON ul.content_id = yc.channel_id
        WHERE ul.user_id = :uid AND ul.action = 'subscribe'
        ORDER BY ul.created_at DESC
        LIMIT 100
    """
    subs = await fetch_all(sub_sql, {"uid": user_id})
    
    # Context 요약
    context_lines = []
    if logs:
        titles = [f"'{row['title']}'" for row in logs]
        context_lines.append(f"최근 시청 영상: {', '.join(titles)}")
    
    if subs:
        channels = [f"{row['name']}" for row in subs]
        context_lines.append(f"구독 채널: {', '.join(channels)}")
        
    return "\n".join(context_lines) if context_lines else "신규 유저 (시청 기록 없음)"

async def retrieve_videos(query_text: str, limit: int = 4):
    """
    [RAG] 질문과 유사한 영상을 벡터 유사도 검색으로 찾기
    """
    # 1. 질문 벡터화
    query_vector = await get_embedding_openai(query_text)
    
    # 2. 벡터 검색 (Cosine Distance: <=>)
    sql = """
        SELECT video_id, title, channel_title, description, 
               (1 - (embedding <=> :qv)) as similarity
        FROM youtube_list
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> :qv ASC
        LIMIT :limit
    """
    
    try:
        results = await fetch_all(sql, {"qv": str(query_vector), "limit": limit})
        return results
    except Exception as e:
        print(f"⚠️ Vector Search Error: {e}")
        return []

async def process_chat(user_id: int, message: str) -> str:
    """
    [Main Logic] 챗봇 대화 처리 (RAG + LLM)
    """
    print(f"\n💬 [ChatRequest] User: {user_id}, Message: {message}")
    
    # 1. 유저 컨텍스트 분석 (내 취향)
    user_context = await analyze_user_context(user_id)
    print(f"👤 [Context] User Profile Loaded ({len(user_context)} chars)")
    
    # 2. 질문 의도 파악: 벡터 검색이 필요한지 판단
    # 메타 질문 키워드 (성향 분석, 서비스 안내 등)
    meta_keywords = ["성향", "분석", "안내", "설명", "사용법", "기능", "서비스", "취향"]
    is_meta_question = any(keyword in message for keyword in meta_keywords)
    
    video_context = ""
    if not is_meta_question:
        # 3-A. 콘텐츠 질문 → 벡터 검색 실행
        print("🔍 [Intent] Content query detected. Running vector search...")
        relevant_videos = await retrieve_videos(message)
        print(f"🔍 [VectorSearch] Found {len(relevant_videos)} relevant videos.")
        
        if relevant_videos:
            video_infos = []
            for v in relevant_videos:
                sim = v['similarity']
                info = f"- [{v['title']}] ({v['channel_title']}): 유사도 {sim:.3f}"
                video_infos.append(info)
                print(f"   👉 {info} (ID: {v['video_id']})")
                
            video_context = "관련 영상 DB 검색 결과:\n" + "\n".join(video_infos)
    else:
        # 3-B. 메타 질문 → 벡터 검색 스킵
        print("🧠 [Intent] Meta question detected. Skipping vector search (using user context only).")
    
    # 4. 프롬프트 구성
    system_prompt = """
    당신은 'AiSogeThing'의 AI 큐레이터입니다.
    유저의 시청 기록과 질문 의도를 파악하여, 가장 적절한 답변과 영상 추천을 제공하세요.
    - 말투: 친근하고 위트 있게 (이모지 적절히 사용)
    - 형식: Markdown 문법 활용 (볼드체, 리스트 등)
    - 성향 분석: User Profile 데이터를 기반으로 MBTI처럼 재미있게 분석하세요.
    - 추천 시: 영상 제목, 채널명을 명확히 언급하고, DB 검색 결과에 있는 영상만 추천하세요.
    - 데이터 출처: 반드시 제공된 [User Profile] 또는 [DB Context] 내에서만 답변하고, 없는 내용을 지어내지 마세요.
    """
    
    final_prompt = f"""
    [User Profile]
    {user_context}
    
    [DB Context (RAG)]
    {video_context if video_context else "검색 결과 없음 (User Profile 기반으로만 답변)"}
    
    [User Message]
    {message}
    """
    
    # 5. LLM 답변 생성
    print("🤖 [LLM] Generating response via OpenAI...")
    response = await generate_response_openai(final_prompt, system_role=system_prompt)
    print("✅ [LLM] Response Generated.\n")
    return response
