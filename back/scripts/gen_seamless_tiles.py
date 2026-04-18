"""
seamless 바닥 텍스처 타일 생성 (DB 불필요)
DreamShaper XL Lightning + add-detail-xl LoRA + 4xUltrasharp
출력: front/public/ground/generated/
"""
import sys, time, json, urllib.request
from pathlib import Path

from comfy_output_utils import dated_comfy_prefix

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

COMFYUI_HOST  = "http://localhost:8188"
CHECKPOINT    = "dreamshaperXL_lightningDPMSDE.safetensors"
LORA_NAME     = "add-detail-xl.safetensors"
LORA_STRENGTH = 0.7
STEPS         = 8
CFG           = 2.0
SAMPLER       = "dpmpp_sde"
SCHEDULER     = "karras"
SIZE          = 512    # pass1 (출력 1024px)
SEED          = 12345678

NEGATIVE = (
    "cartoon, anime, flat colors, isometric, perspective view, side view, "
    "buildings, interior, furniture, rooftop, sky, horizon, "
    "blurry, watermark, text, logo, frame, border, bad quality, ugly, deformed, duplicate, "
    "bright daylight, cheerful"
)

TILES = {
    "village_road": (
        "top-down 90 degree overhead view, fantasy RPG ground texture, "
        "flat cobblestone surface seen from directly above, full ground coverage, "
        "worn medieval stone tiles, moss between cobblestones, dirt in cracks, "
        "no path edges, no walls, no borders, no grass, "
        "painterly illustration, high detail, seamless tiling texture"
    ),
    "forest_ground": (
        "top-down 90 degree overhead view, fantasy RPG forest floor ground texture, "
        "flat ground seen from directly above, full coverage, "
        "dark soil, scattered fallen leaves, small roots, moss patches, "
        "no single tree trunk, no centered object, no walls, "
        "painterly illustration, high detail, seamless tiling texture"
    ),
}

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

def wait_for_job(prompt_id, timeout=300):
    start = time.time()
    while time.time() - start < timeout:
        history = comfy_get(f"/history/{prompt_id}")
        if prompt_id in history:
            images = []
            for node_out in history[prompt_id].get("outputs", {}).values():
                images.extend(node_out.get("images", []))
            return images
        time.sleep(2)
    raise TimeoutError(f"timeout: {prompt_id}")

def download_image(filename, subfolder, out_path):
    url = f"{COMFYUI_HOST}/view?filename={filename}&subfolder={subfolder}&type=output"
    urllib.request.urlretrieve(url, out_path)

def build_workflow(positive, seed, prefix):
    return {
        # 1. Checkpoint
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": CHECKPOINT},
        },
        # 2. LoRA (add-detail-xl)
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
        # 3. Positive prompt
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": positive, "clip": ["2", 1]},
        },
        # 4. Negative prompt
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": NEGATIVE, "clip": ["2", 1]},
        },
        # 5. Latent
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": SIZE, "height": SIZE, "batch_size": 1},
        },
        # 6. KSampler (pass1)
        "6": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed, "steps": STEPS, "cfg": CFG,
                "sampler_name": SAMPLER, "scheduler": SCHEDULER, "denoise": 1.0,
                "model":        ["2", 0],
                "positive":     ["3", 0],
                "negative":     ["4", 0],
                "latent_image": ["5", 0],
            },
        },
        # 7. VAEDecode
        "7": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["6", 0], "vae": ["1", 2]},
        },
        # 8. Upscale model loader
        "8": {
            "class_type": "UpscaleModelLoader",
            "inputs": {"model_name": "4xUltrasharp_4xUltrasharpV10.pt"},
        },
        # 9. 4xUltrasharp → 2048
        "9": {
            "class_type": "ImageUpscaleWithModel",
            "inputs": {"upscale_model": ["8", 0], "image": ["7", 0]},
        },
        # 10. UltimateSDUpscale: 2048 → 4096 (타일 img2img, denoise 0.3)
        "10": {
            "class_type": "UltimateSDUpscale",
            "inputs": {
                "upscale_by":        2.0,
                "seed":              seed,
                "steps":             STEPS,
                "cfg":               CFG,
                "sampler_name":      SAMPLER,
                "scheduler":         SCHEDULER,
                "denoise":           0.3,
                "mode_type":         "Linear",
                "tile_width":        512,
                "tile_height":       512,
                "mask_blur":         8,
                "tile_padding":      32,
                "seam_fix_mode":     "None",
                "seam_fix_denoise":  0.35,
                "seam_fix_width":    64,
                "seam_fix_mask_blur":8,
                "seam_fix_padding":  16,
                "force_uniform_tiles": True,
                "tiled_decode":      False,
                "batch_size":        1,
                "image":             ["9", 0],
                "model":             ["2", 0],
                "positive":          ["3", 0],
                "negative":          ["4", 0],
                "vae":               ["1", 2],
                "upscale_model":     ["8", 0],
            },
        },
        # 11. Save 4096
        "11": {
            "class_type": "SaveImage",
            "inputs": {"images": ["10", 0], "filename_prefix": prefix},
        },
    }


def main():
    targets = list(TILES.items())
    for i, (name, prompt) in enumerate(targets):
        print(f"\n[{i+1}/{len(targets)}] {name} 생성 중...")
        wf   = build_workflow(prompt, SEED + i, dated_comfy_prefix(f"tile_{name}"))
        resp = comfy_post("/prompt", {"prompt": wf})
        pid  = resp["prompt_id"]
        print(f"  queued: {pid}")
        images = wait_for_job(pid)
        if not images:
            print(f"  WARN: 이미지 없음, 건너뜀")
            continue
        out_path = OUT_DIR / f"{name}.png"
        download_image(images[0]["filename"], images[0].get("subfolder", ""), out_path)
        print(f"  저장: {out_path}")

    print(f"\n완료 → {OUT_DIR}")

if __name__ == "__main__":
    main()
