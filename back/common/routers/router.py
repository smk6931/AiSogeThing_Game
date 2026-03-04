import os
import json
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/game", tags=["Game Common Settings"])

class HdriUpdate(BaseModel):
    path: str

SETTINGS_FILE = os.path.join(os.path.dirname(__file__), "game_settings.json")

def load_settings():
    if not os.path.exists(SETTINGS_FILE):
        return {"current_hdri": "/assets/hdri/autumn_field_4k.exr"}
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {"current_hdri": "/assets/hdri/autumn_field_4k.exr"}

def save_settings(settings):
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=4)
    except Exception as e:
        print(f"Error saving settings: {e}")

@router.get("/settings/hdri")
async def get_current_hdri():
    settings = load_settings()
    return {"path": settings.get("current_hdri")}

@router.post("/settings/hdri")
async def update_current_hdri(body: HdriUpdate):
    settings = load_settings()
    settings["current_hdri"] = body.path
    save_settings(settings)
    return {"status": "success", "path": body.path}

@router.get("/hdri-list")
async def get_hdri_list():
    try:
        # 공통 폴더 위치(back/game/common)에서 front/public/assets/hdri 까지
        hdri_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "front", "public", "assets", "hdri")
        
        if not os.path.exists(hdri_dir):
            return {"files": []}

        files = []
        for file_name in os.listdir(hdri_dir):
            if file_name.endswith(('.exr', '.hdr')):
                files.append({
                    "label": file_name,
                    "value": f"/assets/hdri/{file_name}"
                })
        return {"files": files}
    except Exception as e:
        print(f"Error reading hdri dir: {e}")
        return {"files": []}
