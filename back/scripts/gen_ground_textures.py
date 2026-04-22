"""
개별 바닥 텍스처 생성
  기본 (--lowres 없음): 512 → 4xUltrasharp → 2048px
  --lowres             : 512px 그대로 출력 (테스트용, ~3초/장)
출력: front/public/ground/generated/
"""
import sys, time, json, urllib.request, argparse
from pathlib import Path

from comfy_output_utils import dated_comfy_prefix

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

COMFYUI_HOST  = "http://127.0.0.1:8188"
CHECKPOINT    = "juggernautXL_v10.safetensors"
LORA_NAME     = "add-detail-xl.safetensors"
LORA_STRENGTH = 0.8
STEPS         = 22
CFG           = 6.0
SAMPLER       = "dpmpp_2m"
SCHEDULER     = "karras"
BASE_SIZE     = 512
SEED          = 88880000

# ─── 공동 프롬프트 ─────────────────────────────────────────────────────────────
# 규칙: agents/game_design/ground_texture_design_guidelines.md
# - PBR 알베도 전용: 방향 그림자·반사 하이라이트 없음
# - 5~20cm 혼합 입자 크기 (인간 스케일 기준)
# - 노말맵 추출 친화: 입자 경계 선명, 어두운 갭
# - seamless: 방향성 패턴·줄무늬·그라디언트 없음
COMMON_PREFIX = (
    "seamless tileable ground texture, flat overhead view, "
    "diffuse natural overcast lighting no directional shadows, "
    "irregular mixed-size gravel particles 5 to 20 centimeter scale, "
    "60 percent small particles 30 percent medium 10 percent large, "
    "sharp-edged material boundaries for normal map extraction, "
    "PBR albedo only no specular highlights no baked shadows, "
    "uniformly distributed no directional stripes no gradient, "
    "high detail photorealistic material"
)

# ─── 공동 negative ─────────────────────────────────────────────────────────────
# 핵심 추가: tall grass, long grass blades, grass stalks, weeds 명시 금지
# micro grass (< 3cm) 만 허용 — 테마별 필요시 positive에서 허용
NEGATIVE = (
    "cartoon, anime, 3D render, depth, perspective, side view, isometric, "
    "trees, shrubs, tall grass, long grass blades, grass stalks, weeds, "
    "mushrooms, flowers, leaves, branches, "
    "characters, buildings, walls, fences, objects above ground, "
    "sky, horizon, directional shadow, strong shadow, bright spotlight, bloom, lens flare, "
    "blurry, watermark, text, logo, border, frame, "
    "pure white, pure black, "
    "ugly, deformed, bad quality, duplicate, "
    "uniform same size particles, perfectly round stones, symmetric repeating pattern"
)

def p(theme_keywords: str) -> str:
    """공동 prefix + 테마별 키워드 결합"""
    return f"{COMMON_PREFIX}, {theme_keywords}"

# ─── 테마 목록 ─────────────────────────────────────────────────────────────────
TILES = {
    # ── 식생/흙 계열 ──────────────────────────────────────────────────────────
    "grass_dirt": p(
        "bare dirt ground with sparse tiny short micro grass patches, "
        "brown soil dominant, very small grass tufts under 3cm only, "
        "organic irregular distribution, dry cracked spots mixed in"
    ),
    "moss_dirt": p(
        "dark moist soil with scattered small moss patches, "
        "organic earthy surface, tiny pebbles embedded in soil, "
        "damp ground, dark brown and green tones"
    ),
    "forest_floor": p(
        "dry fallen leaves and pine needles covering ground, "
        "decomposed organic matter, occasional small pebble, "
        "dark brown leaf litter, layered organic texture, "
        "autumn forest floor, no tall vegetation"
    ),

    # ── 돌/자갈 계열 ──────────────────────────────────────────────────────────
    "gravel_loose": p(
        "loose mixed gravel, rounded and angular pebbles scattered randomly, "
        "fine sand and dust between pebbles, grey and beige tones, "
        "road shoulder gravel type, natural stone color variation"
    ),
    "cobblestone": p(
        "irregular flat cobblestone pavement, angular stones fitting together, "
        "dark soil and micro moss in narrow gaps, "
        "varied grey-brown stone tones, worn smooth surface, "
        "no uniform brick pattern, organic random layout"
    ),
    "moss_stone": p(
        "flat stone slabs with heavy green moss coverage, "
        "damp dark soil in gaps, wet micro-surface, "
        "mixed large slabs and small pebbles, "
        "dark green and grey-brown tones"
    ),

    # ── 흙/균열 계열 ──────────────────────────────────────────────────────────
    "dirt_packed": p(
        "hard packed dirt ground, compacted earth surface, "
        "fine soil texture with embedded tiny stones, "
        "slight dust and dry cracks, warm brown tones"
    ),
    "dry_cracked": p(
        "severely dry cracked earth, deep polygon crack lines, "
        "dusty surface between cracks, flat angular fragments, "
        "warm beige tan and subtle orange tones, arid texture"
    ),
    "clay_red": p(
        "reddish clay soil ground, smooth fine clay surface, "
        "shallow surface cracks, small embedded pebbles, "
        "rich red-brown terracotta tones, dried clay texture"
    ),

    # ── 특수 계열 ─────────────────────────────────────────────────────────────
    "swamp_mud": p(
        "dark wet muddy swamp ground, waterlogged black soil, "
        "small puddles reflecting sky, organic debris embedded, "
        "dark grey-black with olive green tones, wet surface sheen"
    ),
    "volcanic_rock": p(
        "dark basalt volcanic rock ground, irregular sharp lava fragments, "
        "black and dark grey tones, rough porous surface, "
        "fine volcanic ash between rocks, cooled lava texture"
    ),
    "snow_ground": p(
        "compacted snow ground, wind-textured snow surface, "
        "subtle ice crystal micro-detail, occasional frozen grass tip, "
        "pale white and light blue tones, no footprints"
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

def build_workflow(positive, seed, prefix, lowres=False):
    wf = {
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
    }

    if lowres:
        # 512px 그대로 저장
        wf["10"] = {
            "class_type": "SaveImage",
            "inputs": {"images": ["7", 0], "filename_prefix": prefix},
        }
    else:
        # 512 → 2048 업스케일
        wf["8"] = {
            "class_type": "UpscaleModelLoader",
            "inputs": {"model_name": "4xUltrasharp_4xUltrasharpV10.pt"},
        }
        wf["9"] = {
            "class_type": "ImageUpscaleWithModel",
            "inputs": {"upscale_model": ["8", 0], "image": ["7", 0]},
        }
        wf["10"] = {
            "class_type": "SaveImage",
            "inputs": {"images": ["9", 0], "filename_prefix": prefix},
        }

    return wf


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--keys", nargs="*", help="생성할 키 목록 (기본: 전체)")
    parser.add_argument("--lowres", action="store_true",
                        help="512px 저해상도 출력 (테스트용, 업스케일 생략)")
    args = parser.parse_args()

    targets = [(k, v) for k, v in TILES.items()
               if not args.keys or k in args.keys]

    suffix = "512" if args.lowres else "2k"
    res_label = "512px (lowres)" if args.lowres else "512 → 4xUltrasharp → 2048px"
    print(f"총 {len(targets)}개 텍스처 생성 ({res_label})\n")

    for i, (name, prompt) in enumerate(targets):
        print(f"[{i+1}/{len(targets)}] {name}")
        wf   = build_workflow(prompt, SEED + i, dated_comfy_prefix(f"tex_{name}"),
                              lowres=args.lowres)
        resp = comfy_post("/prompt", {"prompt": wf})
        pid  = resp["prompt_id"]
        images = wait_for_job(pid, timeout=300)
        if not images:
            print(f"  WARN: 이미지 없음")
            continue
        out_path = OUT_DIR / f"{name}_{suffix}.png"
        download_image(images[0]["filename"], images[0].get("subfolder", ""), out_path)
        size_kb = out_path.stat().st_size // 1024
        print(f"  완료 → {out_path.name} ({size_kb} KB)")

    print(f"\n전체 완료 → {OUT_DIR}")

if __name__ == "__main__":
    main()
