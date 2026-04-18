"""
개별 바닥 텍스처 2048×2048 생성
512 → 4xUltrasharp → 2048
출력: front/public/ground/generated/
"""
import sys, time, json, urllib.request, argparse
from pathlib import Path

from comfy_output_utils import dated_comfy_prefix

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

COMFYUI_HOST  = "http://127.0.0.1:8188"
CHECKPOINT    = "dreamshaperXL_lightningDPMSDE.safetensors"
LORA_NAME     = "add-detail-xl.safetensors"
LORA_STRENGTH = 0.8
STEPS         = 8
CFG           = 2.0
SAMPLER       = "dpmpp_sde"
SCHEDULER     = "karras"
BASE_SIZE     = 512
SEED          = 88880000

NEGATIVE = (
    "cartoon, anime, 3D render, depth, perspective, side view, isometric, "
    "trees, plants, rocks, stones, objects, characters, buildings, walls, "
    "sky, horizon, shadow, bright light, bloom, "
    "blurry, watermark, text, logo, border, frame, "
    "ugly, deformed, bad quality, duplicate"
)

TILES = {
    "cobblestone": (
        "seamless tileable ground texture, flat overhead view, "
        "angular irregular cobblestone pavement, mixed large and small stones, "
        "varied stone sizes randomly placed, sharp-edged flat stones, "
        "dirt and moss filling gaps between stones, "
        "some stones larger some smaller, uneven natural layout, "
        "game asset PBR texture, high detail, photorealistic material"
    ),
    "moss_stone": (
        "seamless tileable ground texture, flat overhead view, "
        "angular flat stone slabs with heavy green moss, "
        "irregular sized stone pieces scattered randomly, "
        "thick moss patches, small plants between stones, damp dark soil, "
        "mixed large slabs and small pebbles, uneven layout, "
        "game asset PBR texture, high detail, photorealistic material"
    ),
    "dirt_path": (
        "seamless tileable ground texture, flat overhead view, "
        "natural dirt path with scattered flat stones, "
        "irregular flat pebbles and rocks of mixed sizes embedded in soil, "
        "packed earth with gravel, small stones randomly placed, "
        "dirt trail with stone fragments, organic uneven surface, "
        "game asset PBR texture, high detail, photorealistic material"
    ),
    "dry_cracked": (
        "seamless tileable ground texture, flat overhead view, "
        "dry cracked earth with irregular stone fragments, "
        "deep crack lines between dried mud polygons, "
        "flat angular pebbles scattered randomly, mixed sizes, "
        "dusty arid ground with embedded rocks, uneven surface, "
        "game asset PBR texture, high detail, photorealistic material"
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
        elapsed = int(time.time() - start)
        print(f"  {elapsed}s...", end="\r")
        time.sleep(2)
    raise TimeoutError(f"timeout: {prompt_id}")

def download_image(filename, subfolder, out_path):
    url = f"{COMFYUI_HOST}/view?filename={filename}&subfolder={subfolder}&type=output"
    urllib.request.urlretrieve(url, out_path)

def build_workflow(positive, seed, prefix):
    return {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": CHECKPOINT},
        },
        "2": {
            "class_type": "LoraLoader",
            "inputs": {
                "model": ["1", 0], "clip": ["1", 1],
                "lora_name": LORA_NAME,
                "strength_model": LORA_STRENGTH,
                "strength_clip":  LORA_STRENGTH,
            },
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": positive, "clip": ["2", 1]},
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": NEGATIVE, "clip": ["2", 1]},
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": BASE_SIZE, "height": BASE_SIZE, "batch_size": 1},
        },
        "6": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed, "steps": STEPS, "cfg": CFG,
                "sampler_name": SAMPLER, "scheduler": SCHEDULER, "denoise": 1.0,
                "model": ["2", 0], "positive": ["3", 0],
                "negative": ["4", 0], "latent_image": ["5", 0],
            },
        },
        "7": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["6", 0], "vae": ["1", 2]},
        },
        "8": {
            "class_type": "UpscaleModelLoader",
            "inputs": {"model_name": "4xUltrasharp_4xUltrasharpV10.pt"},
        },
        # 512 → 2048
        "9": {
            "class_type": "ImageUpscaleWithModel",
            "inputs": {"upscale_model": ["8", 0], "image": ["7", 0]},
        },
        "10": {
            "class_type": "SaveImage",
            "inputs": {"images": ["9", 0], "filename_prefix": prefix},
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--keys", nargs="*", help="생성할 키 목록 (기본: 전체)")
    args = parser.parse_args()

    targets = [(k, v) for k, v in TILES.items()
               if not args.keys or k in args.keys]

    print(f"총 {len(targets)}개 텍스처 생성 (512 → 4xUltrasharp → 2048px)\n")

    for i, (name, prompt) in enumerate(targets):
        print(f"[{i+1}/{len(targets)}] {name}")
        wf   = build_workflow(prompt, SEED + i, dated_comfy_prefix(f"tex_{name}"))
        resp = comfy_post("/prompt", {"prompt": wf})
        pid  = resp["prompt_id"]
        images = wait_for_job(pid, timeout=300)
        if not images:
            print(f"  WARN: 이미지 없음")
            continue
        out_path = OUT_DIR / f"{name}_2k.png"
        download_image(images[0]["filename"], images[0].get("subfolder", ""), out_path)
        size_kb = out_path.stat().st_size // 1024
        print(f"  완료 → {out_path.name} ({size_kb} KB)")

    print(f"\n전체 완료 → {OUT_DIR}")

if __name__ == "__main__":
    main()
