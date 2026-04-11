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
CHECKPOINT_NAME = "sd_xl_base_1.0.safetensors"
STEPS           = 30
CFG             = 5.0
SAMPLER         = "euler"
SCHEDULER       = "karras"
MASK_FEATHER    = 12   # polygon 경계 페더링 반경(px)

# 지리 좌표 → 미터 (서울 기준, mapConfig.js 동일)
LAT_TO_M = 110940
LNG_TO_M = 88200

# 스케일
METERS_PER_PIXEL = 0.5   # 1px = 0.5m
MIN_IMAGE_SIZE   = 512
MAX_IMAGE_SIZE   = 1536

STYLE_PREFIX = (
    "top-down bird's eye view RPG ground texture, "
    "directly overhead 90 degrees, flat ground surface, "
    "korean neighborhood, fantasy RPG atmosphere, "
    "buildings and structures in center, natural terrain and paths at edges, "
    "no characters, no people, pure environment, game asset"
)
STYLE_NEGATIVE = (
    "blurry, low quality, watermark, text, signature, "
    "humans, characters, animals, UI elements, "
    "isometric, 3D perspective, side view, angled view, "
    "photorealistic, modern tech, aerial photo, "
    "cut off buildings, cropped structures, partial objects at edges"
)

# persona → 프롬프트 힌트 (image_prompt_append가 없을 때 fallback)
PERSONA_PROMPTS: dict[str, str] = {
    "grove_keeper":      "dense trees and undergrowth, hidden garden paths, mossy stone walls, korean traditional courtyard surrounded by forest",
    "route_keeper":      "crossroads and winding alleyways, cobblestone paths, lanterns along the road, worn stone steps between buildings",
    "crossroad_runner":  "narrow busy alley, stairway lanes, small shops and market stalls rooftops, branching paths",
    "academy_watcher":   "courtyard with study pavilions, bookshelves visible from above, stone plaza, ancient academy architecture, ink-brushed tiles",
    "sanctuary_ward":    "sacred shrine courtyard, stone lanterns, offering tables, sacred trees, ceremonial stone path",
    "merchant_runner":   "market district rooftops, storage crates, merchant tents, busy plaza, cargo paths",
    "elder_watcher":     "calm residential alleys, old korean hanok rooftops, garden wells, aged stone walkways",
    "shadow_warden":     "dark narrow alleys, hidden passages, shadows between buildings, mysterious courtyard",
}


# ──────────────────────────────────────────────────────────────────────────────
# 스케일 계산
# ──────────────────────────────────────────────────────────────────────────────
def compute_image_size(span_lng: float, span_lat: float) -> tuple[int, int]:
    """실제 면적(도) → SDXL 최적 해상도 (64 배수, MIN~MAX 클램프)"""
    raw_w = span_lng * LNG_TO_M / METERS_PER_PIXEL
    raw_h = span_lat * LAT_TO_M / METERS_PER_PIXEL

    max_px = MAX_IMAGE_SIZE * MAX_IMAGE_SIZE
    total  = raw_w * raw_h
    if total > max_px:
        scale  = (max_px / total) ** 0.5
        raw_w *= scale
        raw_h *= scale

    w = max(MIN_IMAGE_SIZE, round(raw_w / 64) * 64)
    h = max(MIN_IMAGE_SIZE, round(raw_h / 64) * 64)
    return w, h


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

    # Three.js flipY=true: pixel_y = (lat - min_lat) / span_lat * h
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


def build_workflow(positive: str, negative: str, seed: int,
                   mask_filename: str, width: int, height: int) -> dict:
    return {
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT_NAME}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": positive, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["4", 1]}},
        "10": {"class_type": "LoadImage", "inputs": {"image": mask_filename}},
        "11": {"class_type": "ImageToMask", "inputs": {"image": ["10", 0], "channel": "red"}},
        "12": {"class_type": "SetLatentNoiseMask", "inputs": {"samples": ["5", 0], "mask": ["11", 0]}},
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed, "steps": STEPS, "cfg": CFG,
                "sampler_name": SAMPLER, "scheduler": SCHEDULER, "denoise": 1.0,
                "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0],
                "latent_image": ["12", 0],
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
    thickness: int = 3,
) -> None:
    """
    생성된 이미지 위에 polygon 경계선을 덧그림.
    마스크와 동일한 좌표계 (Three.js UV flipY=true 기준).
    """
    from PIL import ImageDraw as _Draw

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
    draw = _Draw.Draw(overlay)

    for b in boundaries:
        if not b:
            continue
        if isinstance(b, str):
            b = json.loads(b)
        outer = b.get("coordinates", [[]])[0]
        pts = [to_px(c[0], c[1]) for c in outer]
        if len(pts) >= 2:
            # 두께만큼 여러 번 그려서 굵기 표현
            for t in range(thickness):
                shrunk = [(x, y) for x, y in pts]
                draw.polygon(shrunk, outline=color + (255,))
            draw.line(pts + [pts[0]], fill=color + (255,), width=thickness)

    img = Image.alpha_composite(img, overlay)
    img.save(out_path, format="PNG")


def check_comfyui() -> bool:
    try:
        comfy_get("/system_stats")
        return True
    except Exception:
        return False


# ──────────────────────────────────────────────────────────────────────────────
# 프롬프트 조합
# ──────────────────────────────────────────────────────────────────────────────
def make_positive(area_prompt: str, group_prompt: str, extra: str = "",
                  persona_tag: str = "") -> str:
    parts = [STYLE_PREFIX]
    for p in [area_prompt, group_prompt, extra]:
        if p and p.strip():
            parts.append(p.strip())
    # image_prompt_append가 없을 때 persona 기반 힌트 삽입
    if not extra and persona_tag and persona_tag in PERSONA_PROMPTS:
        parts.append(PERSONA_PROMPTS[persona_tag])
    return ", ".join(parts)


def make_negative(area_neg: str, group_neg: str) -> str:
    parts = [STYLE_NEGATIVE]
    for n in [area_neg, group_neg]:
        if n and n.strip():
            parts.append(n.strip())
    return ", ".join(parts)


def short_name(key: str) -> str:
    """seoul.dongjak.noryangjin2.group.g04 → noryangjin2_g04"""
    parts = key.split(".")
    return f"{parts[2]}_{parts[4]}" if len(parts) >= 5 else key.replace(".", "_")


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
    mask_upload_name: str,
    label: str,
    dry_run: bool,
    outline: bool = False,
) -> bool:
    bbox = compute_bbox(boundaries)
    span_lng = bbox[2] - bbox[0]
    span_lat = bbox[3] - bbox[1]
    width_m  = span_lng * LNG_TO_M
    height_m = span_lat * LAT_TO_M
    img_w, img_h = compute_image_size(span_lng, span_lat)

    scale_hint = f"area {width_m:.0f}m x {height_m:.0f}m, each building 10-20m wide"
    pos_full   = positive + f", {scale_hint}"

    print(f"  [{label}] 면적: {width_m:.0f}m×{height_m:.0f}m → {img_w}×{img_h}px")

    if dry_run:
        print(f"  [DRY-RUN] would save to {out_path}")
        return True

    mask_img  = create_mask(boundaries, bbox, img_w, img_h)
    mask_name = upload_mask(mask_img, mask_upload_name)
    print(f"  마스크 업로드: {mask_name}")

    wf = build_workflow(pos_full, negative, seed, mask_name, img_w, img_h)
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
        positive   = make_positive(group["area_prompt_base"] or "", group["image_prompt_base"] or "")
        negative   = make_negative(group["area_prompt_neg"] or "", group["image_prompt_negative"] or "")
        seed       = hash(group_key) % (2**32)

        ok = await generate_one(
            session, boundaries, positive, negative, seed,
            out_path, f"{g_short}_mask.png", "GROUP", dry_run,
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
                           p.boundary_geojson,
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
            positive   = make_positive(
                part["area_prompt_base"] or "",
                part["image_prompt_base"] or "",
                part["image_prompt_append"] or "",
                persona_tag=part.get("persona_tag") or "",
            )
            negative   = make_negative(part["area_prompt_neg"] or "", part["group_neg"] or "")
            seed       = hash(pk) % (2**32)

            ok = await generate_one(
                session, boundaries, positive, negative, seed,
                out_path, f"{p_short}_mask.png", p_short, dry_run,
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
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--checkpoint", default=CHECKPOINT_NAME)
    args = parser.parse_args()

    if args.checkpoint != CHECKPOINT_NAME:
        CHECKPOINT_NAME = args.checkpoint

    if not check_comfyui():
        print(f"[ERROR] ComfyUI가 {COMFYUI_HOST}에서 응답하지 않습니다.")
        sys.exit(1)

    async def main():
        if args.group_key and args.per_partition:
            keys = await get_group_partition_keys(args.group_key)
            print(f"[INFO] {args.group_key} → {len(keys)}개 파티션 개별 생성")
            await run_partition_mode(keys, args.dry_run, outline=args.outline)
        elif args.group_key:
            await run_group_mode(args.group_key, args.dry_run)
        else:
            await run_partition_mode(args.partition_keys, args.dry_run, outline=args.outline)

    asyncio.run(main())

    print("\n[DONE]")
