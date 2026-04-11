import sys
import json
import uuid
import urllib.request
import urllib.error
import time
import os

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

COMFYUI_URL = "http://127.0.0.1:8188"
OUTPUT_DIR = "c:/GitHub/AiSogeThing_Game"
CLIENT_ID = str(uuid.uuid4())

PROMPTS = [
    {
        "name": "village_ground",
        "positive": "top down view, fantasy RPG game map tile, medieval village ground, dirt road, stone path, grass terrain, cobblestone, game asset, 2D game top view, RPG maker style, detailed texture, high quality, isometric-like flat overhead, warm earthy tones, no characters",
        "negative": "3d render, isometric side view, characters, people, UI, text, blurry, low quality, photorealistic"
    },
    {
        "name": "forest_floor",
        "positive": "top down view, fantasy RPG game map tile, dense forest floor, green grass, tree canopy overhead view, fallen leaves, mossy ground, roots, game asset, 2D game bird eye view, RPG maker XP style, lush vegetation, detailed, vibrant green",
        "negative": "3d render, side view, characters, people, UI, text, blurry, low quality, photorealistic, dark"
    },
    {
        "name": "farm_field",
        "positive": "top down view, fantasy RPG game map tile, farm field, crop rows, wheat field, farmland, plowed soil, green plants, agricultural terrain, game asset, bird eye view overhead, RPG maker style, detailed texture, pastoral",
        "negative": "3d render, side view, characters, people, UI, text, blurry, low quality, photorealistic"
    },
]

def build_workflow(positive_prompt, negative_prompt, seed=None):
    if seed is None:
        seed = int(time.time()) % 1000000000

    workflow = {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {
                "ckpt_name": "sd_xl_base_1.0.safetensors"
            }
        },
        "2": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": positive_prompt,
                "clip": ["1", 1]
            }
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": negative_prompt,
                "clip": ["1", 1]
            }
        },
        "4": {
            "class_type": "EmptyLatentImage",
            "inputs": {
                "width": 1024,
                "height": 1024,
                "batch_size": 1
            }
        },
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["4", 0],
                "seed": seed,
                "steps": 35,
                "cfg": 7.5,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 1.0
            }
        },
        "6": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["5", 0],
                "vae": ["1", 2]
            }
        },
        "7": {
            "class_type": "SaveImage",
            "inputs": {
                "images": ["6", 0],
                "filename_prefix": "topdown_test"
            }
        }
    }
    return workflow


def queue_prompt(workflow):
    payload = json.dumps({
        "prompt": workflow,
        "client_id": CLIENT_ID
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{COMFYUI_URL}/prompt",
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def wait_for_job(prompt_id, timeout=300):
    start = time.time()
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(f"{COMFYUI_URL}/history/{prompt_id}") as resp:
                history = json.loads(resp.read())
            if prompt_id in history:
                outputs = history[prompt_id].get("outputs", {})
                for node_id, node_out in outputs.items():
                    if "images" in node_out:
                        return node_out["images"]
        except Exception as e:
            print(f"  폴링 오류: {e}")
        time.sleep(3)
    return None


def download_image(filename, subfolder, save_path):
    url = f"{COMFYUI_URL}/view?filename={filename}&subfolder={subfolder}&type=output"
    urllib.request.urlretrieve(url, save_path)


def main():
    print("=== ComfyUI 탑다운 판타지 이미지 생성 ===")
    print(f"출력 경로: {OUTPUT_DIR}")

    for i, p in enumerate(PROMPTS):
        name = p["name"]
        print(f"\n[{i+1}/{len(PROMPTS)}] 생성 중: {name}")

        workflow = build_workflow(p["positive"], p["negative"], seed=42 + i * 100)

        try:
            result = queue_prompt(workflow)
            prompt_id = result["prompt_id"]
            print(f"  큐 등록 완료. prompt_id={prompt_id}")
        except Exception as e:
            print(f"  큐 등록 실패: {e}")
            continue

        print("  생성 대기 중...")
        images = wait_for_job(prompt_id, timeout=300)

        if not images:
            print(f"  타임아웃 또는 결과 없음")
            continue

        for img in images:
            fname = img["filename"]
            subfolder = img.get("subfolder", "")
            save_path = os.path.join(OUTPUT_DIR, f"test_{name}.png")
            try:
                download_image(fname, subfolder, save_path)
                print(f"  저장 완료: test_{name}.png")
            except Exception as e:
                print(f"  다운로드 실패: {e}")

    print("\n=== 완료 ===")


if __name__ == "__main__":
    main()
