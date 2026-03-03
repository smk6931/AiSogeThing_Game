from fastapi import APIRouter, Depends, Body
from pydantic import BaseModel
from content.user.router import get_current_user
from content.chatbot.service import process_chat

router = APIRouter(prefix="/api/content/chatbot", tags=["Chatbot"])

# Helper to extract user_id
def get_user_id(current_user: dict = Depends(get_current_user)) -> int:
    return current_user["id"]

class ChatRequest(BaseModel):
    message: str

@router.post("/analyze")
async def analyze_taste(user_id: int = Depends(get_user_id)):
    """성향 분석 (LLM)"""
    prompt = "내 시청 기록과 구독 채널을 바탕으로 나의 콘텐츠 소비 성향을 분석해줘. (MBTI처럼 재미있게)"
    response = await process_chat(user_id, prompt)
    return {"message": response}

@router.post("/recommend")
async def recommend_videos(user_id: int = Depends(get_user_id)):
    """영상 추천 (RAG)"""
    prompt = "내가 좋아할 만한 새로운 영상을 추천해줘. 그리고 왜 추천했는지 이유도 알려줘."
    response = await process_chat(user_id, prompt)
    return {"message": response}

@router.post("/match")
async def find_similar_users(user_id: int = Depends(get_user_id)):
    """유사 유저 (LLM에게는 아직 유저 매칭 로직이 없음, 일단 멘트로 처리)"""
    # 실제 유저 매칭 로직은 별도 서비스에 구현해야 하지만, 여기서는 RAG 컨텍스트에 포함되지 않으므로
    # LLM이 적절히 둘러대거나, 추후 구현
    # MVP 단계에서는 "아직 준비 중인 기능" 혹은 "당신은 ~한 취향을 가진 사람들과 잘 맞을 것 같아요" 정도로 답변
    prompt = "나와 취향이 비슷한 유저들은 어떤 특징이 있을까? 나의 성향을 바탕으로 예상해줘."
    response = await process_chat(user_id, prompt)
    return {"message": response}

@router.post("/info")
async def service_info(user_id: int = Depends(get_user_id)):
    """서비스 안내"""
    prompt = "이 서비스(AiSogeThing)의 주요 기능과 사용법을 친절하게 설명해줘."
    response = await process_chat(user_id, prompt)
    return {"message": response}

@router.post("/chat")
async def chat(request: ChatRequest, user_id: int = Depends(get_user_id)):
    """자유 대화 (RAG)"""
    response = await process_chat(user_id, request.message)
    return {"message": response}
