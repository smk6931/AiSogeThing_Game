"""
파티션/그룹 텍스처 생성 스크립트 (ComfyUI inpainting)

두 가지 모드:
  1. group 모드 (기본): group 전체 bounding box로 이미지 1장 생성, 모든 파티션 공유
  2. partition 모드: 파티션별로 각자의 polygon + 실제 스케일에 맞는 이미지 개별 생성

사용법:
  # group 모드
  python back/scripts/generate_partition_textures.py \\
      --group-key seoul.dongjak.noryangjin2.group.g04

  # partition 모드 (특정 partition_key 목록)
  python back/scripts/generate_partition_textures.py \\
      --partition-keys \\
        seoul.dongjak.noryangjin2.primary.p010 \\
        seoul.dongjak.noryangjin2.primary.p011 \\
        seoul.dongjak.noryangjin2.primary.p012

출력:
  group 모드 : front/public/world_partition/{g_short}/group.png
  partition 모드: front/public/world_partition/{g_short}/{p_short}.png
  DB: world_partition.texture_image_url 업데이트
"""
import asyncio
import argparse
import json
import time
import sys
import io
import urllib.request
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parents[2]
BACK_DIR = ROOT_DIR / "back"
FRONT_PUBLIC = ROOT_DIR / "front" / "public"
if str(BACK_DIR) not in sys.path:
    sys.path.append(str(BACK_DIR))

from dotenv import load_dotenv
load_dotenv(ROOT_DIR / ".env")

from sqlalchemy import text
from core.database import async_session_factory

# ──────────────────────────────────────────────────────────────────────────────
# 설정
# ──────────────────────────────────────────────────────────────────────────────
COMFYUI_HOST    = "http://localhost:8188"
CHECKPOINT_NAME = "dreamshaperXL_lightningDPMSDE.safetensors"
STEPS           = 12
CFG             = 3.5
SAMPLER         = "dpmpp_sde"
SCHEDULER       = "karras"
MASK_FEATHER    = 0
GROW_MASK_BY    = 6   # VAEEncodeForInpaint grow_mask_by (edge blend 확대)

# 지리 좌표 → 미터 (서울 기준, mapConfig.js 동일)
LAT_TO_M = 110940
LNG_TO_M = 88200

# 스케일
METERS_PER_PIXEL = 0.5
MAX_ASPECT       = 3.0
TARGET_PIXELS    = 512 * 512
MAX_IMAGE_SIZE   = 1024

# DreamShaper XL Lightning 기본 설정 (agents/game_design/local_image_generation.md 기준)
# soft painterly anime RPG style, top-down 90도 overhead, 지형 중심, 프레임 꽉 채움
STYLE_PREFIX = (
    "top-down 90 degree overhead view, fantasy RPG world ground surface, "
    "soft painterly anime art style, vibrant natural colors, "
    "seamless organic terrain texture"
)
# negative 프롬프트 사용 안 함 — 모델 자유도를 제한해서 패턴 왜곡 유발
# 그룹 image_prompt_base + seed 조합이 분위기와 변형을 담당
STYLE_NEGATIVE = ""

# ── 레퍼런스 스타일 프리셋 ──────────────────────────────────────────────────
# --style village : 이미지1 기준 — rpg_v5 아이소메트릭 판타지 한국 마을
# --style nature  : 이미지2 기준 — sdxl overhead 자연 씬 (바위+돌길+나무)

STYLE_PRESETS: dict[str, dict] = {
    # 이미지1 기준: rpg_v5 아이소메트릭 45° 한국 판타지 마을
    "village": {
        "checkpoint": "rpg_v5.safetensors",
        "steps": 35, "cfg": 7.5, "sampler": "dpm_2_ancestral", "scheduler": "karras",
        "positive": (
            "isometric 45 degree top-down view fantasy korean village, "
            "traditional wooden buildings rooftops and facades visible from above, "
            "cobblestone streets between houses, large oak trees, "
            "warm golden afternoon lighting, vibrant colors, "
            "hand-painted RPG game art style, high detail, rich environment, "
            "overhead isometric angle, bird's eye diagonal view"
        ),
        "negative": (
            "blurry, low quality, watermark, text, ui, signature, "
            "humans, characters, animals, vehicles, "
            "photorealistic, modern, sci-fi, "
            "circular pattern, mandala, medallion, ornament, symbol, "
            "street level, first person, side view, side-scrolling, horizon, panorama, "
            "dark background, empty space, black border"
        ),
    },
    # 이미지2 기준: sdxl overhead 자연씬 (바위+돌길+나무, 70-80° 내려다보기)
    "nature": {
        "checkpoint": "sd_xl_base_1.0.safetensors",
        "steps": 35, "cfg": 7.0, "sampler": "euler", "scheduler": "karras",
        "positive": (
            "bird's eye overhead view looking down, fantasy forest clearing, "
            "large granite boulders seen from above, stone pathway winding through, "
            "lush green grass and clover ground cover, ancient tree canopy and roots from above, "
            "dappled sunlight on ground, high quality painterly 3D art, "
            "fantasy RPG environment, aerial top-down shot, overhead perspective, rich detail"
        ),
        "negative": (
            "blurry, low quality, watermark, text, ui, signature, "
            "humans, characters, animals, vehicles, "
            "modern, sci-fi, "
            "circular pattern, mandala, medallion, ornament, symbol, "
            "street level, first person, side view, side-scrolling, horizon, panorama, "
            "interior, dark background, empty space, black border, solid fill"
        ),
    },
}

# 현재 활성 스타일 (None = 기본 DB 기반)
_ACTIVE_STYLE: str | None = None

# theme_code → Positive 추가 프롬프트 (DreamShaper XL Lightning 스타일 기준)
# 규칙: 건물·소품·실내 표현 금지, "바닥 지형이 프레임을 꽉 채운다" 중심 묘사
# agents/game_design/local_image_generation.md 참조
FLOOR_CONTEXT: dict[str, str] = {
    "RESIDENTIAL":      "worn stone pathways and packed earth, moss between stone cracks, scattered gravel and dry soil, soft grass patches at edges, warm stone tile ground fills entire frame",
    "COMMERCIAL":       "busy cobblestone ground fills frame, merchant district worn stone, dusty trade route dirt paths, earthy gravel between paving stones, stone tile market floor",
    "INDUSTRIAL":       "dark compacted earth fills frame, forge-scorched stone ground, heat-cracked dry soil, dark ash-mixed dirt, industrial district floor surface texture",
    "PARK":             "lush green grass fills entire frame edge to edge, garden soil path, flower bed ground patches, soft natural earth, moss and clover ground cover, dappled light on grass",
    "MIXED":            "mixed stone and organic earth fills frame, natural terrain transition, moss-covered rocks on dirt, varied natural ground texture, stone and soil blend",
    "RESIDENTIAL_ZONE": "worn stone pathways and packed earth, moss between stone cracks, scattered gravel and dry soil, soft grass patches at edges, warm stone tile ground fills entire frame",
    "COMMERCIAL_ZONE":  "busy cobblestone ground fills frame, merchant district worn stone, dusty trade route dirt paths, earthy gravel between paving stones, stone tile market floor",
    "FORGE_DISTRICT":   "dark compacted earth fills frame, forge-scorched stone ground, heat-cracked dry soil, dark ash-mixed dirt, industrial district floor surface texture",
    "ACADEMY_SANCTUM":  "ancient stone flagstone fills entire frame, worn scholarly stone plaza, moss between tile cracks, aged stone ground surface, ink-stained paving stones",
    "SANCTUARY":        "sacred stone floor fills entire frame edge to edge, ceremonial tile ground pattern, soft earth and moss between stones, sacred soil and stone blend",
    "GREEN_ZONE":       "lush green grass fills entire frame edge to edge, garden soil path, flower bed ground patches, soft natural earth, moss and clover ground cover, dappled light on grass",
}

# persona → 프롬프트 힌트 (image_prompt_append가 없을 때 fallback)
# 규칙: 오브젝트·소품 제거, 바닥 지형이 프레임 전체를 채우는 표현으로
PERSONA_PROMPTS: dict[str, str] = {
    "grove_keeper":     "lush forest floor fills entire frame, dense moss and undergrowth, gnarled tree roots on dark soil, soft grass and fern ground cover, dappled light on natural earth, organic woodland ground texture",
    "route_keeper":     "worn stone road ground fills frame, packed dirt paths winding through terrain, weathered paving mixed with soil and gravel, organic stone and earth blend throughout",
    "crossroad_runner": "busy market stone ground fills frame, stained cobblestones mixed with dusty packed earth, varied stone and dirt surface, organic ground texture throughout frame",
    "academy_watcher":  "worn scholarly stone ground fills frame, aged flagstone mixed with patches of moss and soil, ink-stained stone tiles varied throughout, organic scholarly terrain, slate-blue stone with earthy gaps",
    "sanctuary_ward":   "sacred earthy ground fills frame, soft sacred soil with stone patterns woven throughout, moss and gentle stone blend, organic sacred terrain texture",
    "merchant_runner":  "busy market ground fills frame, packed earth and worn cobblestone mixed throughout, dusty organic trade ground texture, stone and dirt blend naturally",
    "elder_watcher":    "calm aged earth fills frame, garden soil and weathered stone patches blend organically, worn natural ground texture, soft earth and old stone throughout",
    "shadow_warden":    "dark earth and stone fills frame, shadowed cracked soil and broken stone blend throughout, dark compacted ground texture, organic dark terrain fills frame",
}


# ──────────────────────────────────────────────────────────────────────────────
# 스케일 계산
# ──────────────────────────────────────────────────────────────────────────────
def compute_image_size(span_lng: float, span_lat: float) -> tuple[int, int, float, float]:
    """
    실제 면적(도) → SDXL 최적 해상도 + 타일이 커버하는 실제 크기(m) 반환.

    - 종횡비 MAX_ASPECT(3:1) 초과 시 짧은 쪽 기준 타일로 캡 → 나머지는 JS 타일링
    - TARGET_PIXELS(512×512) 이하 시 스케일업, MAX_IMAGE_SIZE 초과 시 스케일다운
    - 두 축 독립 MIN 클램핑 없음 → 비율 보존

    Returns: (img_w, img_h, tile_w_m, tile_h_m)
      tile_w_m / tile_h_m: 이미지 1장이 커버하는 실제 가로/세로 미터
    """
    real_w = span_lng * LNG_TO_M  # 실제 가로 미터
    real_h = span_lat * LAT_TO_M  # 실제 세로 미터

    # 종횡비 캡: tile은 MAX_ASPECT:1 이내
    if real_w > real_h * MAX_ASPECT:
        tile_w_m = real_h * MAX_ASPECT
        tile_h_m = real_h
    elif real_h > real_w * MAX_ASPECT:
        tile_w_m = real_w
        tile_h_m = real_w * MAX_ASPECT
    else:
        tile_w_m = real_w
        tile_h_m = real_h

    raw_w = tile_w_m / METERS_PER_PIXEL
    raw_h = tile_h_m / METERS_PER_PIXEL

    # 픽셀 수 조정 (TARGET 이하 → 스케일업, MAX 초과 → 스케일다운)
    total = raw_w * raw_h
    if total < TARGET_PIXELS:
        scale  = (TARGET_PIXELS / total) ** 0.5
        raw_w *= scale
        raw_h *= scale
    max_px = MAX_IMAGE_SIZE * MAX_IMAGE_SIZE
    if raw_w * raw_h > max_px:
        scale  = (max_px / (raw_w * raw_h)) ** 0.5
        raw_w *= scale
        raw_h *= scale

    w = max(64, round(raw_w / 64) * 64)
    h = max(64, round(raw_h / 64) * 64)
    return w, h, tile_w_m, tile_h_m


def compute_bbox(boundaries: list[dict]) -> tuple[float, float, float, float]:
    """GeoJSON boundary 목록에서 전체 bounding box (min_lng, min_lat, max_lng, max_lat)"""
    min_lng = min_lat = float('inf')
    max_lng = max_lat = float('-inf')
    for b in boundaries:
        if not b:
            continue
        if isinstance(b, str):
            b = json.loads(b)
        for c in b.get("coordinates", [[]])[0]:
            if c[0] < min_lng: min_lng = c[0]
            if c[0] > max_lng: max_lng = c[0]
            if c[1] < min_lat: min_lat = c[1]
            if c[1] > max_lat: max_lat = c[1]
    return min_lng, min_lat, max_lng, max_lat


# ──────────────────────────────────────────────────────────────────────────────
# 마스크 생성
# ──────────────────────────────────────────────────────────────────────────────
def create_mask(boundaries: list[dict], bbox: tuple, width: int, height: int,
                feather: int = MASK_FEATHER) -> Image.Image:
    """
    주어진 polygon(들)을 흰색으로 채운 마스크 생성.
    bbox 기준으로 정규화 (Three.js UV flipY=true 좌표계와 일치).
    """
    min_lng, min_lat, max_lng, max_lat = bbox
    span_lng = max_lng - min_lng or 1e-9
    span_lat = max_lat - min_lat or 1e-9

    # Three.js gpsToGame: z = (GIS_ORIGIN.lat - lat) * LAT_TO_M → 북쪽이 작은 z
    # UV v = (z - minZ) / spanZ = 1 - (lat - minLat) / spanLat
    # flipY=true: image_y = (1-v)*h = (lat - minLat) / spanLat * h
    # → lat 클수록(북쪽) 이미지 하단(큰 y)에 그려야 함
    def to_px(lng, lat):
        x = (lng - min_lng) / span_lng * width
        y = (lat - min_lat) / span_lat * height
        return (x, y)

    mask = Image.new("RGB", (width, height), (0, 0, 0))
    draw = ImageDraw.Draw(mask)

    for b in boundaries:
        if not b:
            continue
        if isinstance(b, str):
            b = json.loads(b)
        outer = b.get("coordinates", [[]])[0]
        poly_px = [to_px(c[0], c[1]) for c in outer]
        if len(poly_px) >= 3:
            draw.polygon(poly_px, fill=(255, 255, 255))
        for hole in b.get("coordinates", [[]])[1:]:
            hole_px = [to_px(c[0], c[1]) for c in hole]
            if len(hole_px) >= 3:
                draw.polygon(hole_px, fill=(0, 0, 0))

    if feather > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(feather))

    return mask


# ──────────────────────────────────────────────────────────────────────────────
# ComfyUI API
# ──────────────────────────────────────────────────────────────────────────────
def comfy_post(endpoint: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{COMFYUI_HOST}{endpoint}", data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


def comfy_get(endpoint: str) -> dict:
    with urllib.request.urlopen(f"{COMFYUI_HOST}{endpoint}", timeout=30) as resp:
        return json.loads(resp.read())


def upload_mask(mask_img: Image.Image, filename: str) -> str:
    buf = io.BytesIO()
    mask_img.save(buf, format="PNG")
    img_bytes = buf.getvalue()
    boundary = "----ComfyBoundary7a3f"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="image"; filename="{filename}"\r\n'
        f"Content-Type: image/png\r\n\r\n"
    ).encode() + img_bytes + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        f"{COMFYUI_HOST}/upload/image", data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())["name"]


def create_black_base(width: int, height: int) -> Image.Image:
    """VAEEncodeForInpaint 용 검정 베이스 이미지 (RGB)"""
    return Image.new("RGB", (width, height), (0, 0, 0))


def build_workflow(positive: str, negative: str, seed: int,
                   width: int, height: int) -> dict:
    """
    DreamShaper XL Lightning txt2img 워크플로우 (EmptyLatentImage)
    inpainting 방식 폐기: VAEEncodeForInpaint는 검정 base를 의식해 frame 구성을 만들어냄
    EmptyLatentImage로 순수 노이즈에서 생성 → 경계 아티팩트 없는 seamless 지형 텍스처
    agents/game_design/local_image_generation.md 기준
    """
    return {
        "4":  {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT_NAME}},
        "6":  {"class_type": "CLIPTextEncode", "inputs": {"text": positive, "clip": ["4", 1]}},
        "7":  {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["4", 1]}},
        # EmptyLatentImage: 순수 노이즈에서 시작 (inpainting 아님)
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": width, "height": height, "batch_size": 1},
        },
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed, "steps": STEPS, "cfg": CFG,
                "sampler_name": SAMPLER, "scheduler": SCHEDULER, "denoise": 1.0,
                "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0],
                "latent_image": ["5", 0],
            },
        },
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": "partition_tex"}},
    }


def wait_for_job(prompt_id: str, timeout: int = 300) -> list[dict]:
    start = time.time()
    while time.time() - start < timeout:
        history = comfy_get(f"/history/{prompt_id}")
        if prompt_id in history:
            images = []
            for node_out in history[prompt_id].get("outputs", {}).values():
                images.extend(node_out.get("images", []))
            return images
        time.sleep(2)
    raise TimeoutError(f"job {prompt_id} timed out")


def download_image(filename: str, subfolder: str, out_path: Path) -> None:
    url = f"{COMFYUI_HOST}/view?filename={filename}&subfolder={subfolder}&type=output"
    urllib.request.urlretrieve(url, out_path)


def draw_polygon_outline(
    out_path: Path,
    boundaries: list[dict],
    bbox: tuple,
    color: tuple = (0, 230, 180),
    thickness: int = 4,
) -> None:
    """
    생성된 이미지 위에 polygon 경계선을 덧그림.
    마스크와 동일한 좌표계 (Three.js UV flipY=true 기준).
    선명한 선 (blur 없음).
    """
    img = Image.open(out_path).convert("RGBA")
    w, h = img.size
    min_lng, min_lat, max_lng, max_lat = bbox
    span_lng = max_lng - min_lng or 1e-9
    span_lat = max_lat - min_lat or 1e-9

    def to_px(lng, lat):
        x = (lng - min_lng) / span_lng * w
        y = (lat - min_lat) / span_lat * h
        return (x, y)

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    for b in boundaries:
        if not b:
            continue
        if isinstance(b, str):
            b = json.loads(b)
        outer = b.get("coordinates", [[]])[0]
        pts = [to_px(c[0], c[1]) for c in outer]
        if len(pts) >= 2:
            draw.line(pts + [pts[0]], fill=color + (255,), width=thickness)

    img = Image.alpha_composite(img, overlay)
    img.save(out_path, format="PNG")


def fill_black_border(img: Image.Image, mask: Image.Image, iterations: int = 40) -> Image.Image:
    """
    polygon 외부(마스크 검정 영역)를 인접 polygon 내부 픽셀 색으로 팽창 채움.
    VAEEncodeForInpaint 방식에서 polygon 외부가 검정으로 남는 문제를 해결한다.

    1단계: MaxFilter 팽창으로 외부 영역 채움
    2단계: 마스크 경계 주변을 GaussianBlur로 소프트 블렌딩 (경계선 제거)
    """
    mask_l = mask.convert("L")
    result = img.copy()

    # 1단계: 팽창으로 검정 영역 채움
    for _ in range(iterations):
        expanded = result.filter(ImageFilter.MaxFilter(3))
        result = Image.composite(result, expanded, mask_l)

    # 2단계: 마스크 경계 소프트 블렌딩 (경계 부근 4px 블러로 자연스럽게)
    soft_mask = mask_l.filter(ImageFilter.GaussianBlur(radius=4))
    result = Image.composite(img, result, soft_mask)

    return result


def check_comfyui() -> bool:
    try:
        comfy_get("/system_stats")
        return True
    except Exception:
        return False


# ──────────────────────────────────────────────────────────────────────────────
# 프롬프트 조합
# ──────────────────────────────────────────────────────────────────────────────
def make_positive(group_prompt: str) -> str:
    # --style 프리셋이 활성화된 경우: 프리셋 프롬프트 직접 사용
    if _ACTIVE_STYLE:
        return STYLE_PRESETS[_ACTIVE_STYLE]["positive"]

    parts = [STYLE_PREFIX]

    # 그룹 프롬프트 — 분위기와 지형 묘사의 핵심. seed가 파티션별 변형을 담당.
    if group_prompt and group_prompt.strip():
        parts.append(group_prompt.strip())

    return ", ".join(parts)


def make_negative() -> str:
    # --style 프리셋이 활성화된 경우: 프리셋 네거티브 사용
    if _ACTIVE_STYLE:
        return STYLE_PRESETS[_ACTIVE_STYLE]["negative"]
    # negative 비활성화 — 모델 자유도 확보
    return ""


def short_name(key: str) -> str:
    """
    seoul.dongjak.noryangjin2.group.g04 → noryangjin2_g04
    seoul..2.v2.0038 (v2 format, empty segment) → 0038   (folder은 group short_name 사용)
    """
    parts = key.split(".")
    # group key: "group" 세그먼트 포함
    if "group" in parts:
        idx = parts.index("group")
        dong = parts[idx - 1] if idx > 0 else parts[2]
        return f"{dong}_{parts[-1]}"
    # 구분자 사이에 빈 segment가 있는 v2 포맷 (parts[1]=="")
    if len(parts) >= 2 and parts[1] == "":
        return parts[-1]   # "0038"
    # 구 포맷: seoul.dongjak.noryangjin2.primary.p024
    if len(parts) >= 5 and parts[2]:
        return f"{parts[2]}_{parts[4]}"
    return key.replace(".", "_")


# ──────────────────────────────────────────────────────────────────────────────
# 단일 이미지 생성 공통 함수
# ──────────────────────────────────────────────────────────────────────────────
async def generate_one(
    session,
    boundaries: list[dict],
    positive: str,
    negative: str,
    seed: int,
    out_path: Path,
    label: str,
    dry_run: bool,
    outline: bool = False,
) -> bool:
    bbox = compute_bbox(boundaries)
    span_lng = bbox[2] - bbox[0]
    span_lat = bbox[3] - bbox[1]
    width_m  = span_lng * LNG_TO_M
    height_m = span_lat * LAT_TO_M
    img_w, img_h, tile_w_m, tile_h_m = compute_image_size(span_lng, span_lat)

    repeat_x = width_m  / tile_w_m
    repeat_y = height_m / tile_h_m
    is_tiled = repeat_x > 1.05 or repeat_y > 1.05

    # 파티션 실제 면적 → scale hint (작을수록 세밀한 석재/이끼, 클수록 넓은 자연 지형)
    area_m2 = width_m * height_m
    if area_m2 < 1000:
        scale_hint = (
            f"small {width_m:.0f}x{height_m:.0f} meter ground area, "
            "detailed moss and stone surface, seamless organic terrain"
        )
    elif area_m2 < 10000:
        scale_hint = (
            f"medium {width_m:.0f}x{height_m:.0f} meter ground area, "
            "varied natural ground surface, seamless organic terrain"
        )
    else:
        scale_hint = (
            f"large {width_m:.0f}x{height_m:.0f} meter ground area, "
            "wide natural terrain with organic color variation, seamless"
        )
    pos_full = positive + f", {scale_hint}"

    tile_info = f" (tile {tile_w_m:.0f}m×{tile_h_m:.0f}m, repeat {repeat_x:.1f}×{repeat_y:.1f})" if is_tiled else ""
    print(f"  [{label}] 면적: {width_m:.0f}m×{height_m:.0f}m → {img_w}×{img_h}px{tile_info}")

    if dry_run:
        print(f"  [DRY-RUN] would save to {out_path}")
        return True

    # txt2img: 마스크·베이스 이미지 업로드 불필요 (EmptyLatentImage 사용)
    wf = build_workflow(pos_full, negative, seed, img_w, img_h)
    resp = comfy_post("/prompt", {"prompt": wf})
    prompt_id = resp["prompt_id"]
    print(f"  queued: {prompt_id}")

    images = wait_for_job(prompt_id)
    if not images:
        print("  [WARN] 이미지 생성 실패")
        return False

    out_path.parent.mkdir(parents=True, exist_ok=True)
    download_image(images[0]["filename"], images[0].get("subfolder", ""), out_path)

    if outline:
        draw_polygon_outline(out_path, boundaries, bbox)
        print(f"  outline: polygon 경계선 덧그림 완료")

    print(f"  saved: {out_path}")
    return True


# ──────────────────────────────────────────────────────────────────────────────
# GROUP 모드
# ──────────────────────────────────────────────────────────────────────────────
async def run_group_mode(group_key: str, dry_run: bool):
    async with async_session_factory() as session:
        group_row = await session.execute(
            text("""
                SELECT g.id, g.display_name,
                       g.image_prompt_base, g.image_prompt_negative,
                       a.image_prompt_base as area_prompt_base,
                       a.image_prompt_negative as area_prompt_neg,
                       a.name as dong_name
                FROM world_partition_group g
                JOIN world_area a ON a.id = g.admin_area_id
                WHERE g.group_key = :gk
            """), {"gk": group_key}
        )
        group = group_row.mappings().first()
        if not group:
            print(f"[ERROR] group_key not found: {group_key}")
            return

        parts_row = await session.execute(
            text("""
                SELECT p.id, p.boundary_geojson
                FROM world_partition p
                JOIN world_partition_group_member m ON m.partition_id = p.id
                WHERE m.group_id = :gid
            """), {"gid": group["id"]}
        )
        partitions = parts_row.mappings().all()
        g_short  = short_name(group_key)
        out_path = FRONT_PUBLIC / "world_partition" / g_short / "group.png"
        db_url   = f"/world_partition/{g_short}/group.png"

        print(f"[GROUP MODE] {group['dong_name']} / {group['display_name']} — {len(partitions)}개 파티션")

        boundaries = [p["boundary_geojson"] for p in partitions]
        positive   = make_positive(group["image_prompt_base"] or "")
        negative   = make_negative()
        seed       = hash(group_key) % (2**32)

        ok = await generate_one(
            session, boundaries, positive, negative, seed,
            out_path, "GROUP", dry_run,
        )
        if ok and not dry_run:
            for p in partitions:
                await session.execute(
                    text("UPDATE world_partition SET texture_image_url = :url WHERE id = :id"),
                    {"url": db_url, "id": p["id"]},
                )
            await session.commit()
            print(f"[OK] DB: {len(partitions)}개 파티션 → {db_url}")


# ──────────────────────────────────────────────────────────────────────────────
# PARTITION 모드
# ──────────────────────────────────────────────────────────────────────────────
async def run_partition_mode(partition_keys: list[str], dry_run: bool, outline: bool = False):
    async with async_session_factory() as session:
        for pk in partition_keys:
            row = await session.execute(
                text("""
                    SELECT p.id, p.partition_key, p.display_name,
                           p.boundary_geojson, p.persona_tag,
                           p.theme_code, p.landuse_code,
                           p.image_prompt_append, p.image_prompt_negative,
                           g.image_prompt_base, g.image_prompt_negative as group_neg,
                           a.image_prompt_base as area_prompt_base,
                           a.image_prompt_negative as area_prompt_neg,
                           a.name as dong_name,
                           g.group_key
                    FROM world_partition p
                    JOIN world_partition_group_member m ON m.partition_id = p.id
                    JOIN world_partition_group g ON g.id = m.group_id
                    JOIN world_area a ON a.id = p.admin_area_id
                    WHERE p.partition_key = :pk
                    LIMIT 1
                """), {"pk": pk}
            )
            part = row.mappings().first()
            if not part:
                print(f"[WARN] partition_key not found: {pk}")
                continue

            p_short  = short_name(pk)
            g_short  = short_name(part["group_key"])
            out_path = FRONT_PUBLIC / "world_partition" / g_short / f"{p_short}.png"
            db_url   = f"/world_partition/{g_short}/{p_short}.png"

            print(f"\n[PARTITION] {part['dong_name']} / {part['display_name']} ({pk})")

            boundaries = [part["boundary_geojson"]]
            positive   = make_positive(part["image_prompt_base"] or "")
            negative   = make_negative()
            seed       = hash(pk) % (2**32)

            ok = await generate_one(
                session, boundaries, positive, negative, seed,
                out_path, p_short, dry_run,
                outline=outline,
            )
            if ok and not dry_run:
                await session.execute(
                    text("UPDATE world_partition SET texture_image_url = :url WHERE id = :id"),
                    {"url": db_url, "id": part["id"]},
                )
                await session.commit()
                print(f"[OK] DB: {pk} → {db_url}")


# ──────────────────────────────────────────────────────────────────────────────
# OUTLINE-ONLY 모드 (이미지 재생성 없이 기존 이미지에 outline만 덧그림)
# ──────────────────────────────────────────────────────────────────────────────
async def run_outline_only(group_key: str, blank: bool = False):
    """
    group 내 모든 파티션에 polygon outline 덧그림.
    blank=True: 기존 이미지 삭제 후 어두운 배경 위에 outline만 있는 새 이미지 생성.
    blank=False: 기존 이미지 위에 outline만 추가.
    """
    async with async_session_factory() as session:
        rows = await session.execute(
            text("""
                SELECT p.partition_key, p.boundary_geojson,
                       g.group_key
                FROM world_partition p
                JOIN world_partition_group_member m ON m.partition_id = p.id
                JOIN world_partition_group g ON g.id = m.group_id
                WHERE g.group_key = :gk
                ORDER BY p.partition_seq
            """), {"gk": group_key}
        )
        partitions = rows.mappings().all()

    mode_label = "BLANK+OUTLINE" if blank else "OUTLINE-ONLY"
    print(f"[{mode_label}] {group_key} — {len(partitions)}개 파티션")

    # blank 모드: 폴더 내 기존 PNG 전부 삭제
    if blank:
        g_short  = short_name(group_key)
        folder   = FRONT_PUBLIC / "world_partition" / g_short
        if folder.exists():
            deleted = list(folder.glob("*.png"))
            for f in deleted:
                f.unlink()
            print(f"  기존 PNG {len(deleted)}개 삭제: {folder}")

    ok_count = skip_count = 0

    for p in partitions:
        pk       = p["partition_key"]
        p_short  = short_name(pk)
        g_short  = short_name(p["group_key"])
        out_path = FRONT_PUBLIC / "world_partition" / g_short / f"{p_short}.png"

        boundaries = [p["boundary_geojson"]]
        bbox       = compute_bbox(boundaries)
        span_lng   = bbox[2] - bbox[0]
        span_lat   = bbox[3] - bbox[1]

        if blank:
            # 실제 스케일 기반 해상도로 어두운 배경 생성
            img_w, img_h = compute_image_size(span_lng, span_lat)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            bg = Image.new("RGBA", (img_w, img_h), (30, 30, 40, 255))
            bg.save(out_path, format="PNG")
        elif not out_path.exists():
            print(f"  [SKIP] 파일 없음: {out_path.name}")
            skip_count += 1
            continue

        draw_polygon_outline(out_path, boundaries, bbox)
        print(f"  [OK] {p_short}")
        ok_count += 1

    print(f"\n완료: {ok_count}개 outline 완료, {skip_count}개 스킵")


# ──────────────────────────────────────────────────────────────────────────────
# 엔트리포인트
# ──────────────────────────────────────────────────────────────────────────────
async def get_group_partition_keys(group_key: str) -> list[str]:
    """group_key에 속한 모든 partition_key 반환"""
    async with async_session_factory() as session:
        rows = await session.execute(
            text("""
                SELECT p.partition_key
                FROM world_partition p
                JOIN world_partition_group_member m ON m.partition_id = p.id
                JOIN world_partition_group g ON g.id = m.group_id
                WHERE g.group_key = :gk
                ORDER BY p.partition_seq
            """), {"gk": group_key}
        )
        return [r[0] for r in rows]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--group-key", help="group 모드 또는 --per-partition과 함께 사용")
    src.add_argument("--partition-keys", nargs="+", help="partition 모드: 파티션 키 목록")
    parser.add_argument("--per-partition", action="store_true",
                        help="--group-key와 함께 사용: group 내 파티션 각각 개별 생성")
    parser.add_argument("--outline", action="store_true",
                        help="생성 이미지에 polygon 경계선 덧그림 (정렬 확인용)")
    parser.add_argument("--outline-only", action="store_true",
                        help="이미지 재생성 없이 기존 이미지에 outline만 덧그림 (--group-key 필요)")
    parser.add_argument("--blank", action="store_true",
                        help="--outline-only와 함께: 기존 이미지 삭제 후 빈 배경에 outline만 그림")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--checkpoint", default=None)
    parser.add_argument("--style", choices=["village", "nature"], default=None,
                        help="레퍼런스 스타일 프리셋 (DB 페르소나 무시). village=아이소메트릭 마을, nature=overhead 자연씬")
    args = parser.parse_args()

    # --style 프리셋 적용: 모듈 레벨 설정 덮어쓰기 (if __name__ 블록은 모듈 레벨이라 global 불필요)
    if args.style:
        _ACTIVE_STYLE = args.style
        p = STYLE_PRESETS[args.style]
        CHECKPOINT_NAME = p["checkpoint"]
        STEPS      = p["steps"]
        CFG        = p["cfg"]
        SAMPLER    = p["sampler"]
        SCHEDULER  = p["scheduler"]
        print(f"[STYLE] '{args.style}' 프리셋 적용: {CHECKPOINT_NAME}, steps={STEPS}, cfg={CFG}")
    elif args.checkpoint:
        CHECKPOINT_NAME = args.checkpoint

    if not args.outline_only and not check_comfyui():
        print(f"[ERROR] ComfyUI가 {COMFYUI_HOST}에서 응답하지 않습니다.")
        sys.exit(1)

    async def main():
        if args.outline_only:
            if not args.group_key:
                print("[ERROR] --outline-only는 --group-key와 함께 사용해야 합니다.")
                sys.exit(1)
            await run_outline_only(args.group_key, blank=args.blank)
        elif args.group_key and args.per_partition:
            keys = await get_group_partition_keys(args.group_key)
            print(f"[INFO] {args.group_key} → {len(keys)}개 파티션 개별 생성")
            await run_partition_mode(keys, args.dry_run, outline=args.outline)
        elif args.group_key:
            await run_group_mode(args.group_key, args.dry_run)
        else:
            await run_partition_mode(args.partition_keys, args.dry_run, outline=args.outline)

    asyncio.run(main())

    print("\n[DONE]")
