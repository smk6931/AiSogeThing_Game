"""
img2img: 기존 타일 텍스처 → 판타지 RPG 스타일 + 디테일 세분화
denoise 0.45 = 구조 유지하면서 RPG 감성 추가
"""
import sys, time, json, urllib.request, shutil
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

COMFYUI_HOST = "http://localhost:8188"
CHECKPOINT   = "dreamshaperXL_lightningDPMSDE.safetensors"
LORA_1       = "add-detail-xl.safetensors"
LORA_1_STR   = 0.8
STEPS        = 12
CFG          = 3.0
SAMPLER      = "dpmpp_sde"
SCHEDULER    = "karras"
DENOISE      = 0.45   # 구조 유지 + 스타일 변환
SEED         = 99887766

STYLE_SUFFIX = (
    ", classic fantasy RPG hand-painted style, "
    "Diablo 2 Torchlight game art, fine detailed texture, "
    "small intricate surface details, rich dark fantasy colors, "
    "atmospheric top-down game floor"
)

NEGATIVE = (
    "blurry, low quality, watermark, text, ui, "
    "modern, sci-fi, flat, cel-shaded, "
    "3d render, plastic, overexposed, washed out, "
    "humans, characters, animals, vehicles"
)

ROOT      = Path(__file__).resolve().parents[2]
GEN_DIR   = ROOT / "front" / "public" / "ground" / "generated"
OUT_DIR   = ROOT / "front" / "public" / "ground" / "generated"
COMFY_IN  = ROOT / "tools" / "ComfyUI" / "input"

TILES = {
    "forest_ground":       "seamless forest ground surface, green moss, dark soil, small pebbles, fine grass detail",
    "dirt_mountain_path":  "seamless cracked earth floor, packed dry dirt, fine gravel, natural ground surface",
    "rocky_terrain":       "seamless stone cobblestone floor, grey stone slabs, thin moss in cracks, worn pavement",
}


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
        h = comfy_get(f"/history/{prompt_id}")
        if prompt_id in h:
            imgs = []
            for node_out in h[prompt_id].get("outputs", {}).values():
                imgs.extend(node_out.get("images", []))
            return imgs
        time.sleep(2)
    raise TimeoutError(prompt_id)

def download_image(filename, subfolder, out_path):
    url = f"{COMFYUI_HOST}/view?filename={filename}&subfolder={subfolder}&type=output"
    urllib.request.urlretrieve(url, out_path)

def build_img2img(input_filename, positive, seed, prefix):
    pos = positive + STYLE_SUFFIX
    return {
        "1":  {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}},
        "15": {"class_type": "LoraLoader", "inputs": {
            "model": ["1", 0], "clip": ["1", 1],
            "lora_name": LORA_1, "strength_model": LORA_1_STR, "strength_clip": LORA_1_STR,
        }},
        "2":  {"class_type": "CLIPTextEncode", "inputs": {"text": pos,      "clip": ["15", 1]}},
        "3":  {"class_type": "CLIPTextEncode", "inputs": {"text": NEGATIVE, "clip": ["15", 1]}},
        "4":  {"class_type": "LoadImage",  "inputs": {"image": input_filename}},
        "5":  {"class_type": "VAEEncode",  "inputs": {"pixels": ["4", 0], "vae": ["1", 2]}},
        "6":  {"class_type": "KSampler",   "inputs": {
            "seed": seed, "steps": STEPS, "cfg": CFG,
            "sampler_name": SAMPLER, "scheduler": SCHEDULER, "denoise": DENOISE,
            "model": ["15", 0], "positive": ["2", 0], "negative": ["3", 0],
            "latent_image": ["5", 0],
        }},
        "7":  {"class_type": "VAEDecode", "inputs": {"samples": ["6", 0], "vae": ["1", 2]}},
        # 4xUltrasharp 업스케일
        "11": {"class_type": "UpscaleModelLoader",    "inputs": {"model_name": "4xUltrasharp_4xUltrasharpV10.pt"}},
        "12": {"class_type": "ImageUpscaleWithModel", "inputs": {"upscale_model": ["11", 0], "image": ["7", 0]}},
        "13": {"class_type": "ImageScale", "inputs": {
            "image": ["12", 0], "upscale_method": "lanczos",
            "width": 2048, "height": 2048, "crop": "disabled",
        }},
        "14": {"class_type": "SaveImage", "inputs": {"images": ["13", 0], "filename_prefix": prefix}},
    }


def main():
    for i, (name, prompt) in enumerate(TILES.items()):
        src = GEN_DIR / f"{name}.png"
        if not src.exists():
            print(f"  [{name}] 원본 없음, 스킵")
            continue

        # ComfyUI input에 복사
        input_name = f"tile_src_{name}.png"
        shutil.copy(src, COMFY_IN / input_name)

        print(f"\n[{i+1}/3] {name} img2img 중...")
        wf = build_img2img(input_name, prompt, SEED + i, f"tile_v2_{name}")
        resp = comfy_post("/prompt", {"prompt": wf})
        pid  = resp["prompt_id"]
        print(f"  queued: {pid}")

        imgs = wait_for_job(pid)
        if not imgs:
            print(f"  WARN: 실패")
            continue

        out_path = OUT_DIR / f"{name}_v2.png"
        download_image(imgs[0]["filename"], imgs[0].get("subfolder", ""), out_path)
        print(f"  저장: {out_path}")

    print(f"\n완료 → {OUT_DIR}")

if __name__ == "__main__":
    main()
