import os
import json
import re
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

from content.novel.image_service import generate_character_image, generate_scene_image, generate_cover_image
from content.novel import service as novel_service

# ========================================================
#  LangGraph State 정의
# ========================================================

class WebtoonState(TypedDict):
    # 입력
    novel_id: int  # 필수
    topic: str
    character_count: int
    character_descriptions: str
    scene_count: int
    script_length: str
    
    # 중간 결과
    full_script: str
    character_visuals: list[dict]
    scenes: list[dict]
    
    # 상태 추적
    current_step: str


# ========================================================
#  Helper: GenAI Chat Model
# ========================================================

def get_llm(temperature=0.7):
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    return ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        temperature=temperature,
        google_api_key=api_key
    )


# ========================================================
#  Step 1: ScriptWriter (줄거리 생성)
# ========================================================

async def script_writer_node(state: WebtoonState) -> WebtoonState:
    print("📝 Step 1: 줄거리 생성 중...")
    
    llm = get_llm(temperature=0.8)
    
    # Using strictly Korean prompt
    prompt = f"""
    Write a romance webtoon story script with {state['scene_count']} scenes based on:
    Topic: {state['topic']}
    Characters: {state['character_count']} people ({state['character_descriptions']})
    Length: {state['script_length']}
    
    You MUST output strictly in Korean (한국어).
    
    Format Requirements:
    1. Start with a [Summary] section: Write a 3-5 line summary of the entire story in Korean.
    2. Then, write the scenes in the format:
    [Scene 1]
    (Scene description and dialogue in Korean)
    
    [Scene 2]
    ...
    
    Make it emotional and engaging.
    """
    
    messages = [HumanMessage(content=prompt)]
    response = await llm.ainvoke(messages)
    
    state["full_script"] = response.content
    state["current_step"] = "줄거리 생성 완료"
    
    # DB 실시간 업데이트
    await novel_service.update_novel(state["novel_id"], script=state["full_script"])
    print(f"✅ 줄거리 저장 완료 (ID: {state['novel_id']})")
    
    return state


# ========================================================
#  Step 2: CoverDesigner (표지 생성)
# ========================================================

async def cover_designer_node(state: WebtoonState) -> WebtoonState:
    print("🎨 Step 2: 표지 생성 중...")
    
    filename = await generate_cover_image(state["topic"])
    
    if filename:
        image_path = f"/novel/image/cover/{filename}"
        # DB 실시간 업데이트
        await novel_service.update_novel(state["novel_id"], thumbnail_image=image_path)
        print(f"✅ 표지 저장 완료: {image_path}")
    
    state["current_step"] = "표지 생성 완료"
    return state


# ========================================================
#  Step 3: CharacterDesigner (인물 외형 묘사)
# ========================================================

from utils.safe_ops import safe_execute

async def character_designer_node(state: WebtoonState) -> WebtoonState:
    print("🎭 Step 3: 인물 외형 묘사...")
    
    llm = get_llm(temperature=0.6)
    
    prompt = f"""
    Analyze the story and generate visual descriptions for {state['character_count']} characters.
    Story: {state['full_script'][:1000]}...
    
    Output strictly in Korean for 'description'.
    
    Return ONLY a JSON array:
    [
        {{
            "name": "Name (Korean/English)",
            "description": "Visual details (hair, eyes, clothes, vibe) in Korean"
        }}
    ]
    """
    
    messages = [HumanMessage(content=prompt)]
    response = await llm.ainvoke(messages)
    
    # 기본값 초기화
    state["character_visuals"] = []

    with safe_execute("인물 데이터 파싱 및 저장 실패"):
        content = response.content.strip()
        if content.startswith("```"):
            content = re.sub(r'^```json\s*|\s*```$', '', content, flags=re.MULTILINE).strip()
        
        character_visuals = json.loads(content)
        state["character_visuals"] = character_visuals
        
        # Save as JSON string for structured data (including potential images later)
        json_str = json.dumps(character_visuals, ensure_ascii=False)
        await novel_service.update_novel(state["novel_id"], character_descriptions=json_str)
        
        print(f"✅ 인물 정보 저장 완료")
    
    state["current_step"] = "인물 설정 완료"
    return state


# ========================================================
#  Step 4: CharacterImageGenerator (인물 이미지 생성)
# ========================================================

async def character_image_generator_node(state: WebtoonState) -> WebtoonState:
    print("🖼️ Step 4: 인물 프로필 이미지 생성...")
    
    updated_visuals = []
    
    for char in state["character_visuals"]:
        filename = await generate_character_image(
            character_name=char["name"],
            character_description=char["description"]
        )
        
        if filename:
            char["image"] = f"/novel/image/character/{filename}"
            print(f"  - Character {char['name']} 이미지 생성 완료")
        
        updated_visuals.append(char)
        
    state["character_visuals"] = updated_visuals
    
    # DB Update with images
    if updated_visuals:
        json_str = json.dumps(updated_visuals, ensure_ascii=False)
        await novel_service.update_novel(state["novel_id"], character_descriptions=json_str)
        
    state["current_step"] = "인물 프로필 완료"
    return state


# ========================================================
#  Step 5: SceneSplitter (씬 분할 및 DB 선저장)
# ========================================================

async def scene_splitter_node(state: WebtoonState) -> WebtoonState:
    print("✂️ Step 5: 씬 분할...")
    
    script = state["full_script"]
    
    # Remove [Summary] section if present to avoid confusing the splitter
    script_body = script
    if "[Summary]" in script:
        parts = script.split("[Summary]")
        if len(parts) > 1:
            # Try to find where Scenes start
            idx = parts[1].find("[Scene")
            if idx != -1:
                script_body = parts[1][idx:]
            else:
                script_body = parts[1] # Just use the whole thing after Summary if no explicit scenes found yet
    
    scene_pattern = r'\[Scene (\d+)\](.*?)(?=\[Scene \d+\]|$)'
    matches = re.findall(scene_pattern, script_body, re.DOTALL)
    
    scenes = []
    
    if not matches:
        # Fallback split
        words = script_body.split()
        chunk_size = len(words) // state["scene_count"]
        for i in range(state["scene_count"]):
            start = i * chunk_size
            end = start + chunk_size
            scenes.append({
                "order": i + 1,
                "text": " ".join(words[start:end]),
                "db_id": None 
            })
    else:
        for order, text in matches:
            scenes.append({
                "order": int(order),
                "text": text.strip(),
                "db_id": None
            })
            
    # DB에 텍스트 먼저 저장
    for scene in scenes:
        result = await novel_service.create_novel_cut(
            novel_id=state["novel_id"],
            cut_order=scene["order"],
            scene_desc=scene["text"],
            image_path=None 
        )
        scene["db_id"] = result["id"]
    
    state["scenes"] = scenes
    state["current_step"] = "씬 분할 및 DB 저장 완료"
    print(f"✅ {len(scenes)}개 씬 DB 저장 완료")
    return state


# ========================================================
#  Step 6: SceneImageGenerator (오래 걸림 - 하나씩 업데이트)
# ========================================================

async def scene_image_generator_node(state: WebtoonState) -> WebtoonState:
    print("🎨 Step 6: 씬 이미지 생성 시작...")
    
    from core.database import execute
    
    for scene in state["scenes"]:
        filename = await generate_scene_image(
            scene_order=scene["order"],
            scene_text=scene["text"],
            character_visuals=state["character_visuals"]
        )
        
        if filename:
            image_path = f"/novel/image/scene/{filename}"
            scene["image_path"] = image_path
            
            # DB 개별 업데이트
            if scene["db_id"]:
                await execute(
                    "UPDATE novel_cuts SET image_path = :path WHERE id = :id",
                    {"path": image_path, "id": scene["db_id"]}
                )
                print(f"  - Scene {scene['order']} 이미지 저장 완료")
        
    state["current_step"] = "완료"
    return state


# ========================================================
#  LangGraph 워크플로우 구성
# ========================================================

def create_webtoon_workflow():
    workflow = StateGraph(WebtoonState)
    
    workflow.add_node("script_writer", script_writer_node)
    workflow.add_node("cover_designer", cover_designer_node)
    workflow.add_node("character_designer", character_designer_node)
    workflow.add_node("character_image_generator", character_image_generator_node)
    workflow.add_node("scene_splitter", scene_splitter_node)
    workflow.add_node("scene_image_generator", scene_image_generator_node)
    
    workflow.set_entry_point("script_writer")
    workflow.add_edge("script_writer", "cover_designer")
    workflow.add_edge("cover_designer", "character_designer")
    workflow.add_edge("character_designer", "character_image_generator")
    workflow.add_edge("character_image_generator", "scene_splitter")
    workflow.add_edge("scene_splitter", "scene_image_generator")
    workflow.add_edge("scene_image_generator", END)
    
    return workflow.compile()


# ========================================================
#  실행 함수
# ========================================================

async def generate_webtoon_task(
    novel_id: int,
    topic: str,
    character_count: int = 2,
    character_descriptions: str = "",
    scene_count: int = 4,
    script_length: str = "medium"
):
    """
    Background Task로 실행될 메인 함수
    """
    print(f"🚀 웹툰 생성 시작 (ID: {novel_id})")
    
    app = create_webtoon_workflow()
    
    initial_state = {
        "novel_id": novel_id,
        "topic": topic,
        "character_count": character_count,
        "character_descriptions": character_descriptions,
        "scene_count": scene_count,
        "script_length": script_length,
        "full_script": "",
        "character_visuals": [],
        "scenes": [],
        "current_step": "Start"
    }
    
    try:
        await app.ainvoke(initial_state)
        print(f"✨ 웹툰 생성 최종 완료 (ID: {novel_id})")
    except Exception as e:
        print(f"❌ 웹툰 생성 중 오류 발생: {e}")
        try:
            # 롤백 처리: DB에서 해당 소설 및 컷 삭제
            await novel_service.delete_novel(novel_id)
            print(f"⚠️ 에러로 인해 소설 데이터가 롤백되었습니다. (ID: {novel_id})")
        except Exception as rollback_err:
            print(f"❌ 롤백 중 추가 에러 발생: {rollback_err}")
