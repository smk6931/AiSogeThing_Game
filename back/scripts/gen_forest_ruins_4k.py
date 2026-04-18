"""
forest ruins 바닥 텍스처 4096px 테스트
DreamShaper XL Lightning + add-detail-xl LoRA + 4xUltrasharp + UltimateSDUpscale
나무/성벽 제거, 바닥 이끼 돌 floor 전용
출력: front/public/ground/generated/forest_ruins_4k.png
"""
import sys, time, json, urllib.request
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

COMFYUI_HOST  = "http://127.0.0.1:8188"
CHECKPOINT    = "dreamshaperXL_lightningDPMSDE.safetensors"
LORA_NAME     = "add-detail-xl.safetensors"
LORA_STRENGTH = 0.7
STEPS         = 8
CFG           = 2.0
SAMPLER       = "dpmpp_sde"
SCHEDULER     = "karras"
BASE_SIZE     = 512
SEED          = 42000001

POSITIVE = (
    "top-down 90 degree overhead view, ancient forest ruins ground floor, "
    "moss-covered cracked stone tiles seen from directly above, "
    "overgrown grass patches between broken stones, "
    "fallen leaves scattered on stone floor, dirt soil with small roots, "
    "scattered pebbles and debris, wet stone surface, "
    "full ground coverage flat surface only, no centered objects, "
    "high detail, painterly illustration, seamless tileable texture"
)

NEGATIVE = (
    "trees, tree trunks, roots above ground, stone walls, pillars, columns, "
    "statues, arches, doorways, fences, 3D objects, vertical elements, "
    "side view, isometric, perspective view, "
    "sky, clouds, building, interior, rooftop, horizon, "
    "cartoon, anime, flat colors, blurry, watermark, text, logo, "
    "frame, border, bad quality, ugly, deformed, duplicate, "
    "bright daylight, cheerful"
)

ROOT    = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "front" / "public" / "ground" / "generated"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def comfy_post(path, data):
    req = urllib.request.Request(
        f"{COMFYUI_HOST}{path}",
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def comfy_get(path):
    with urllib.request.urlopen(f"{COMFYUI_HOST}{path}") as r:
        return json.loads(r.read())

def wait_for_job(prompt_id, timeout=600):
    start = time.time()
    while time.time() - start < timeout:
        history = comfy_get(f"/history/{prompt_id}")
        if prompt_id in history:
            images = []
            for node_out in history[prompt_id].get("outputs", {}).values():
                images.extend(node_out.get("images", []))
            return images
        elapsed = int(time.time() - start)
        print(f"  대기 중... {elapsed}s", end="\r")
        time.sleep(3)
    raise TimeoutError(f"timeout: {prompt_id}")

def download_image(filename, subfolder, out_path):
    url = f"{COMFYUI_HOST}/view?filename={filename}&subfolder={subfolder}&type=output"
    urllib.request.urlretrieve(url, out_path)

def build_workflow():
    return {
        # 1. Checkpoint
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": CHECKPOINT},
        },
        # 2. LoRA
        "2": {
            "class_type": "LoraLoader",
            "inputs": {
                "model": ["1", 0],
                "clip":  ["1", 1],
                "lora_name":      LORA_NAME,
                "strength_model": LORA_STRENGTH,
                "strength_clip":  LORA_STRENGTH,
            },
        },
        # 3. Positive
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": POSITIVE, "clip": ["2", 1]},
        },
        # 4. Negative
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": NEGATIVE, "clip": ["2", 1]},
        },
        # 5. Latent 512x512
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": BASE_SIZE, "height": BASE_SIZE, "batch_size": 1},
        },
        # 6. KSampler pass1
        "6": {
            "class_type": "KSampler",
            "inputs": {
                "seed": SEED, "steps": STEPS, "cfg": CFG,
                "sampler_name": SAMPLER, "scheduler": SCHEDULER, "denoise": 1.0,
                "model":        ["2", 0],
                "positive":     ["3", 0],
                "negative":     ["4", 0],
                "latent_image": ["5", 0],
            },
        },
        # 7. VAEDecode → 512px image
        "7": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["6", 0], "vae": ["1", 2]},
        },
        # 8. 4xUltrasharp loader
        "8": {
            "class_type": "UpscaleModelLoader",
            "inputs": {"model_name": "4xUltrasharp_4xUltrasharpV10.pt"},
        },
        # 9. 4xUltrasharp: 512 → 2048
        "9": {
            "class_type": "ImageUpscaleWithModel",
            "inputs": {"upscale_model": ["8", 0], "image": ["7", 0]},
        },
        # 10. UltimateSDUpscale: 2048 → 4096 (타일 512, denoise 0.3)
        "10": {
            "class_type": "UltimateSDUpscale",
            "inputs": {
                "upscale_by":         2.0,
                "seed":               SEED,
                "steps":              STEPS,
                "cfg":                CFG,
                "sampler_name":       SAMPLER,
                "scheduler":          SCHEDULER,
                "denoise":            0.3,
                "mode_type":          "Linear",
                "tile_width":         512,
                "tile_height":        512,
                "mask_blur":          8,
                "tile_padding":       32,
                "seam_fix_mode":      "None",
                "seam_fix_denoise":   0.35,
                "seam_fix_width":     64,
                "seam_fix_mask_blur": 8,
                "seam_fix_padding":   16,
                "force_uniform_tiles": True,
                "tiled_decode":       False,
                "batch_size":         1,
                "image":              ["9", 0],
                "model":              ["2", 0],
                "positive":           ["3", 0],
                "negative":           ["4", 0],
                "vae":                ["1", 2],
                "upscale_model":      ["8", 0],
            },
        },
        # 11. SaveImage
        "11": {
            "class_type": "SaveImage",
            "inputs": {
                "images": ["10", 0],
                "filename_prefix": "forest_ruins_4k",
            },
        },
    }


def main():
    print("forest_ruins 4096px 생성 시작")
    print(f"  파이프라인: 512 → 4xUltrasharp(2048) → UltimateSDUpscale(4096)")
    print(f"  출력: {OUT_DIR / 'forest_ruins_4k.png'}")
    print()

    wf   = build_workflow()
    resp = comfy_post("/prompt", {"prompt": wf})
    pid  = resp["prompt_id"]
    print(f"  queued: {pid}")
    print("  생성 중 (예상 2~4분)...")

    images = wait_for_job(pid, timeout=900)
    if not images:
        print("ERROR: 이미지 출력 없음")
        return

    out_path = OUT_DIR / "forest_ruins_4k.png"
    download_image(images[0]["filename"], images[0].get("subfolder", ""), out_path)
    print(f"\n완료 → {out_path}")
    print(f"  파일 크기: {out_path.stat().st_size // 1024} KB")

if __name__ == "__main__":
    main()
