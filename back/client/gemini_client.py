import os
import uuid
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
import google.generativeai as genai

# ========================================================
#  Google Gemini Client (Chat + Image Generation)
# ========================================================

# API 키 설정
genai.configure(api_key=os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"))


def get_chat_model(model="gemini-2.0-flash", temperature=0.7):
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key: return None
    
    return ChatGoogleGenerativeAI(
        model=model,
        temperature=temperature,
        google_api_key=api_key
    )


async def generate_response_gemini(prompt: str, system_role: str = "Assistant"):
    llm = get_chat_model()
    if not llm: return "API Key missing."
    
    try:
        # Gemini는 SystemMessage를 일부 모델에서 다르게 처리하지만 LangChain이 추상화해줌
        messages = [
            SystemMessage(content=system_role),
            HumanMessage(content=prompt)
        ]
        res = await llm.ainvoke(messages)
        return res.content
    except Exception as e:
        print(f"⚠️ Gemini Chat Error: {e}")
        return "Error generating response."


# ========================================================
#  Image Generation (Imagen 3.0)
# ========================================================

async def generate_image_gemini(
    prompt: str,
    output_dir: str,
    model_name: str = "models/gemini-2.5-flash-image",
    safety_filter: str = "block_only_high"
) -> str:
    """
    Google GenAI로 이미지 생성 후 저장
    
    Args:
        prompt: 이미지 생성 프롬프트 (영문)
        output_dir: 저장 디렉토리
        model_name: 이미지 생성 모델
        safety_filter: 안전 필터 레벨
    
    Returns:
        파일명 (예: abc123.png)
    
    Raises:
        Exception: 이미지 생성 실패 시
    """
    print(f"🎨 이미지 생성 시작: {prompt[:50]}...")
    
    # google-genai SDK 사용
    from google import genai as genai_client
    from google.genai.types import GenerateContentConfig
    
    client = genai_client.Client(api_key=os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"))
    
    # 이미지 생성 요청
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=GenerateContentConfig(
            response_modalities=["image"]
        )
    )
    
    # 이미지 추출
    if (not response.candidates or 
        not response.candidates[0].content or 
        not response.candidates[0].content.parts):
        print(f"⚠️ 이미지 생성 실패 (안전 필터 또는 오류): {response}")
        return None
    
    image_part = response.candidates[0].content.parts[0]
    
    # 고유 파일명 생성
    filename = f"{uuid.uuid4()}.png"
    output_path = os.path.join(output_dir, filename)
    
    # 디렉토리 생성
    os.makedirs(output_dir, exist_ok=True)
    
    # 이미지 저장
    import io
    from PIL import Image
    
    try:
        image_data = image_part.inline_data.data
        
        # 만약 image_data가 이미 bytes라면 바로 사용, 아니면 base64 디코딩 시도
        # google-genai 최신 SDK는 bytes로 반환함
        
        img = Image.open(io.BytesIO(image_data))
        img.save(output_path, format="PNG")
        
        print(f"✅ 이미지 저장 완료: {filename} (Size: {img.size})")
    except Exception as e:
        print(f"⚠️ 이미지 저장 중 오류 발생: {e}")
        # Fallback: Raw write if PIL fails
        with open(output_path, 'wb') as f:
            f.write(image_part.inline_data.data)
            
    return filename
