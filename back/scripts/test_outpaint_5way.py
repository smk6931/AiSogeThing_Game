"""
5-way outpaint test
  center : img2img of reference (fantasy RPG soft style)
  left/right/top/bottom : outpaint extensions of center
출력: tools/ComfyUI/output/outpaint_test/
"""
import sys, time, json, urllib.request, shutil
from pathlib import Path
from PIL import Image

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

COMFYUI_HOST    = "http://localhost:8188"
CHECKPOINT      = "dreamshaperXL_lightningDPMSDE.safetensors"
LORA_1          = "add-detail-xl.safetensors"
LORA_1_STR      = 0.7
LORA_2          = "zavy-ctsmtrc-sdxl.safetensors"
LORA_2_STR      = 0.75
STEPS_IMG2IMG   = 12
STEPS_OUTPAINT  = 20
CFG             = 2.5
SAMPLER         = "dpmpp_sde"
SCHEDULER       = "karras"
SEED            = 77771234
DENOISE_CENTER  = 0.65   # 구도 유지, 스타일 변경
OUTPAINT_PAD    = 512    # 각 방향 확장 픽셀

POSITIVE = (
    "top-down view, fantasy RPG game map art, hand-painted stylized, "
    "soft smooth organic lines, lush green forest floor, "
    "dirt path winding through dense trees, mossy rocks on ground, "
    "tree canopy viewed from directly above, warm soft lighting, "
    "ambient occlusion, rich deep greens, seamless tileable texture, "
    "game environment art, painterly soft style, no harsh edges"
)
NEGATIVE = (
    "photorealistic, photo, harsh lines, jagged edges, blurry, "
    "low quality, watermark, text, ui, modern, sci-fi, "
    "side view, horizon, sky, humans, characters, animals"
)

ROOT         = Path(__file__).resolve().parents[2]
COMFY_INPUT  = ROOT / "tools" / "ComfyUI" / "input"
COMFY_OUTPUT = ROOT / "tools" / "ComfyUI" / "output"
OUT_DIR      = COMFY_OUTPUT / "outpaint_test"
OUT_DIR.mkdir(exist_ok=True)


# ── ComfyUI 통신 ─────────────────────────────────────────────────────────────

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
        time.sleep(3)
    raise TimeoutError(f"timeout: {prompt_id}")

def download_image(filename, subfolder, out_path):
    url = f"{COMFYUI_HOST}/view?filename={filename}&subfolder={subfolder}&type=output"
    urllib.request.urlretrieve(url, out_path)


# ── 워크플로우 빌더 ──────────────────────────────────────────────────────────

def base_nodes():
    """CheckpointLoader + LoRA 체인 → (wf, model_ref, clip_ref)"""
    wf = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}},
        "15": {
            "class_type": "LoraLoader",
            "inputs": {
                "model": ["1", 0], "clip": ["1", 1],
                "lora_name": LORA_1, "strength_model": LORA_1_STR, "strength_clip": LORA_1_STR,
            },
        },
        "16": {
            "class_type": "LoraLoader",
            "inputs": {
                "model": ["15", 0], "clip": ["15", 1],
                "lora_name": LORA_2, "strength_model": LORA_2_STR, "strength_clip": LORA_2_STR,
            },
        },
    }
    return wf, ["16", 0], ["16", 1]


def build_img2img(input_filename: str, prefix: str) -> dict:
    wf, model_ref, clip_ref = base_nodes()
    wf.update({
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": POSITIVE, "clip": clip_ref}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": NEGATIVE, "clip": clip_ref}},
        "4": {"class_type": "LoadImage",  "inputs": {"image": input_filename}},
        "5": {"class_type": "VAEEncode",  "inputs": {"pixels": ["4", 0], "vae": ["1", 2]}},
        "6": {
            "class_type": "KSampler",
            "inputs": {
                "seed": SEED, "steps": STEPS_IMG2IMG, "cfg": CFG,
                "sampler_name": SAMPLER, "scheduler": SCHEDULER, "denoise": DENOISE_CENTER,
                "model": model_ref, "positive": ["2", 0], "negative": ["3", 0],
                "latent_image": ["5", 0],
            },
        },
        "7": {"class_type": "VAEDecode",  "inputs": {"samples": ["6", 0], "vae": ["1", 2]}},
        "8": {"class_type": "SaveImage",  "inputs": {"images": ["7", 0], "filename_prefix": prefix}},
    })
    return wf


def build_outpaint(input_filename: str, direction: str, prefix: str) -> dict:
    """
    direction: left | right | top | bottom
    이미지 한쪽에 OUTPAINT_PAD px 추가 → inpaint로 채움
    """
    pad = {"left": 0, "right": 0, "top": 0, "bottom": 0}
    pad[direction] = OUTPAINT_PAD

    wf, model_ref, clip_ref = base_nodes()
    wf.update({
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": POSITIVE, "clip": clip_ref}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": NEGATIVE, "clip": clip_ref}},
        "4": {"class_type": "LoadImage", "inputs": {"image": input_filename}},
        "5": {
            "class_type": "ImagePadForOutpaint",
            "inputs": {
                "image": ["4", 0],
                "left": pad["left"], "right": pad["right"],
                "top": pad["top"],   "bottom": pad["bottom"],
                "feathering": 80,
            },
        },
        "6": {
            "class_type": "VAEEncodeForInpaint",
            "inputs": {"pixels": ["5", 0], "vae": ["1", 2], "mask": ["5", 1], "grow_mask_by": 8},
        },
        "7": {
            "class_type": "KSampler",
            "inputs": {
                "seed": SEED, "steps": STEPS_OUTPAINT, "cfg": CFG,
                "sampler_name": SAMPLER, "scheduler": SCHEDULER, "denoise": 1.0,
                "model": model_ref, "positive": ["2", 0], "negative": ["3", 0],
                "latent_image": ["6", 0],
            },
        },
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["1", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": prefix}},
    })
    return wf


def run_workflow(wf: dict, label: str) -> Path | None:
    resp = comfy_post("/prompt", {"prompt": wf})
    pid  = resp["prompt_id"]
    print(f"  [{label}] queued: {pid}")
    images = wait_for_job(pid)
    if not images:
        print(f"  [{label}] WARN: 결과 없음")
        return None
    img_info = images[0]
    out_path = OUT_DIR / f"{label}.png"
    download_image(img_info["filename"], img_info.get("subfolder", ""), out_path)
    print(f"  [{label}] 저장: {out_path}")
    return out_path


def crop_new_area(full_path: Path, direction: str, orig_w: int, orig_h: int) -> Path:
    """패딩된 전체 이미지에서 새로 생성된 영역만 잘라냄"""
    img = Image.open(full_path)
    # direction별 새 영역 좌표
    crops = {
        "left":   (0,      0,      orig_w,          orig_h),          # 왼쪽 새 영역
        "right":  (orig_w, 0,      orig_w * 2,      orig_h),          # 오른쪽 새 영역
        "top":    (0,      0,      orig_w,           orig_h),          # 위쪽 새 영역
        "bottom": (0,      orig_h, orig_w,           orig_h * 2),      # 아래쪽 새 영역
    }
    box = crops[direction]
    cropped = img.crop(box)
    out = full_path.parent / f"{direction}_cropped.png"
    cropped.save(out)
    print(f"  [{direction}] crop → {out}")
    return out


# ── 메인 ─────────────────────────────────────────────────────────────────────

def main():
    ref_input = "ref_forest.png"   # ComfyUI input 폴더 기준

    # 원본 크기 파악
    orig_img = Image.open(COMFY_INPUT / ref_input)
    orig_w, orig_h = orig_img.size
    print(f"원본 크기: {orig_w}x{orig_h}")

    # ── 1. Center (img2img) ──────────────────────────────────────────────────
    print("\n[1/5] Center img2img 생성 중...")
    wf_center = build_img2img(ref_input, "outpaint_center")
    center_path = run_workflow(wf_center, "center")
    if not center_path:
        print("center 실패, 중단")
        return

    # center 결과를 ComfyUI input에 복사 (outpaint용)
    center_input = "center_styled.png"
    shutil.copy(center_path, COMFY_INPUT / center_input)
    print(f"  center → input/{center_input} 복사 완료")

    # ── 2~5. 4방향 outpaint ──────────────────────────────────────────────────
    directions = ["left", "right", "top", "bottom"]
    labels_kr  = ["왼쪽", "오른쪽", "위쪽", "아래쪽"]

    for i, (direction, kr) in enumerate(zip(directions, labels_kr), start=2):
        print(f"\n[{i}/5] {kr} outpaint 생성 중...")
        wf = build_outpaint(center_input, direction, f"outpaint_{direction}_full")
        full_path = run_workflow(wf, f"{direction}_full")
        if full_path:
            crop_new_area(full_path, direction, orig_w, orig_h)

    # ── 결과 요약 ─────────────────────────────────────────────────────────────
    print("\n=== 생성 완료 ===")
    for f in sorted(OUT_DIR.glob("*.png")):
        print(f"  {f.name}")


if __name__ == "__main__":
    main()
