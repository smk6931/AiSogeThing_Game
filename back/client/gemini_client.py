import os
import uuid
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
try:
    import google.generativeai as genai
except ImportError:
    genai = None

try:
    from google import genai as genai_client
except ImportError:
    genai_client = None

# API 키 설정
api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
if api_key and genai:
    genai.configure(api_key=api_key)


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
        print(f"[WARN]Gemini Chat Error: {e}")
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
    print(f"[INFO] 이미지 생성 시작: {prompt[:50]}...")
    
    # google-genai SDK 사용
    if not genai_client:
        print("[WARN]google-genai 패키지가 설치되지 않았습니다. 'pip install google-genai'를 실행해주세요.")
        return None
        
    from google.genai.types import GenerateContentConfig
    
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    client = genai_client.Client(api_key=api_key)
    
    # 이미지 생성 요청
    try:
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=GenerateContentConfig(
                response_modalities=["image"]
            )
        )
    except Exception as e:
        print(f"[WARN]Imagen 3 생성 API 오류: {e}")
        return None
    
    # 이미지 추출
    if (not response.candidates or 
        not response.candidates[0].content or 
        not response.candidates[0].content.parts):
        print(f"[WARN]이미지 생성 실패 (안전 필터 또는 오류): {response}")
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
        img = Image.open(io.BytesIO(image_data))
        img.save(output_path, format="PNG")
        print(f"[OK] 이미지 저장 완료: {filename} (Size: {img.size})")
    except Exception as e:
        print(f"[WARN]이미지 저장 중 오류 발생: {e}")
        # Raw write fallback
        try:
            with open(output_path, 'wb') as f:
                f.write(image_part.inline_data.data)
        except:
            return None
            
    return filename
