"""
Partition satellite reference fetcher.

역할:
- world_partition boundary_geojson 기준 bbox를 동적으로 계산
- 위성 타일(Esri World Imagery) 합성
- bbox 기준 raw satellite image 생성
- polygon mask를 씌운 masked reference image 생성
- 결과를 back/cache/partition_ref/{g_short}/ 아래에 저장

예시:
  python back/scripts/fetch_partition_satellite_reference.py \
      --group-key seoul.dongjak.noryangjin2.group.g03

  python back/scripts/fetch_partition_satellite_reference.py \
      --partition-keys seoul..2.v2.0035 seoul..2.v2.0036
"""

import argparse
import asyncio
import io
import json
import math
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parents[2]
BACK_DIR = ROOT_DIR / "back"
CACHE_ROOT = ROOT_DIR / "back" / "cache" / "partition_ref"
if str(BACK_DIR) not in sys.path:
    sys.path.append(str(BACK_DIR))

from dotenv import load_dotenv
from sqlalchemy import text

from core.database import async_session_factory

load_dotenv(ROOT_DIR / ".env")

SATELLITE_TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
TILE_SIZE = 256
DEFAULT_ZOOM = 18
POLY_MASK_FEATHER = 6
SOFTEN_RADIUS = 0.8

LAT_TO_M = 110940
LNG_TO_M = 88200
METERS_PER_PIXEL = 0.5
MAX_ASPECT = 3.0
TARGET_PIXELS = 512 * 512
MAX_IMAGE_SIZE = 1024


def short_name(key: str) -> str:
    parts = key.split(".")
    if not parts:
        return key.replace(".", "_")
    if parts[-1].startswith("p"):
        return parts[-1][1:]
    if len(parts) >= 5 and parts[2]:
        return f"{parts[2]}_{parts[4]}"
    return key.replace(".", "_")


def compute_bbox(boundaries: list[dict]) -> tuple[float, float, float, float]:
    min_lng = min_lat = float("inf")
    max_lng = max_lat = float("-inf")
    for b in boundaries:
        if not b:
            continue
        if isinstance(b, str):
            b = json.loads(b)
        for c in b.get("coordinates", [[]])[0]:
            if c[0] < min_lng:
                min_lng = c[0]
            if c[0] > max_lng:
                max_lng = c[0]
            if c[1] < min_lat:
                min_lat = c[1]
            if c[1] > max_lat:
                max_lat = c[1]
    return min_lng, min_lat, max_lng, max_lat


def compute_image_size(span_lng: float, span_lat: float) -> tuple[int, int]:
    real_w = span_lng * LNG_TO_M
    real_h = span_lat * LAT_TO_M

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

    total = raw_w * raw_h
    if total < TARGET_PIXELS:
        scale = (TARGET_PIXELS / total) ** 0.5
        raw_w *= scale
        raw_h *= scale

    max_px = MAX_IMAGE_SIZE * MAX_IMAGE_SIZE
    if raw_w * raw_h > max_px:
        scale = (max_px / (raw_w * raw_h)) ** 0.5
        raw_w *= scale
        raw_h *= scale

    w = max(64, round(raw_w / 64) * 64)
    h = max(64, round(raw_h / 64) * 64)
    return w, h


def create_mask(boundaries: list[dict], bbox: tuple, width: int, height: int,
                feather: int = POLY_MASK_FEATHER) -> Image.Image:
    min_lng, min_lat, max_lng, max_lat = bbox
    span_lng = max_lng - min_lng or 1e-9
    span_lat = max_lat - min_lat or 1e-9

    def to_px(lng: float, lat: float) -> tuple[float, float]:
        x = (lng - min_lng) / span_lng * width
        y = (lat - min_lat) / span_lat * height
        return x, y

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


def deg2tile_frac(lat: float, lng: float, zoom: int) -> tuple[float, float]:
    lat_rad = math.radians(lat)
    n = 2 ** zoom
    xtile = (lng + 180.0) / 360.0 * n
    ytile = (1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi) / 2.0 * n
    return xtile, ytile


def fetch_tile(z: int, x: int, y: int) -> Image.Image:
    url = SATELLITE_TILE_URL.format(z=z, x=x, y=y)
    req = urllib.request.Request(url, headers={"User-Agent": "AiSogeThing-ReferenceFetcher/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    return Image.open(io.BytesIO(data)).convert("RGB")


def build_satellite_bbox_image(bbox: tuple[float, float, float, float], zoom: int, out_w: int, out_h: int) -> Image.Image:
    min_lng, min_lat, max_lng, max_lat = bbox

    x_min_f, y_top_f = deg2tile_frac(max_lat, min_lng, zoom)
    x_max_f, y_bottom_f = deg2tile_frac(min_lat, max_lng, zoom)

    x_start = math.floor(x_min_f)
    y_start = math.floor(y_top_f)
    x_end = math.ceil(x_max_f) - 1
    y_end = math.ceil(y_bottom_f) - 1

    mosaic_w = (x_end - x_start + 1) * TILE_SIZE
    mosaic_h = (y_end - y_start + 1) * TILE_SIZE
    mosaic = Image.new("RGB", (mosaic_w, mosaic_h))

    total = (x_end - x_start + 1) * (y_end - y_start + 1)
    done = 0
    for tx in range(x_start, x_end + 1):
        for ty in range(y_start, y_end + 1):
            tile = fetch_tile(zoom, tx, ty)
            mosaic.paste(tile, ((tx - x_start) * TILE_SIZE, (ty - y_start) * TILE_SIZE))
            done += 1
            print(f"    tile {done}/{total} z{zoom}/{tx}/{ty}")

    left = round((x_min_f - x_start) * TILE_SIZE)
    top = round((y_top_f - y_start) * TILE_SIZE)
    right = round((x_max_f - x_start) * TILE_SIZE)
    bottom = round((y_bottom_f - y_start) * TILE_SIZE)
    cropped = mosaic.crop((left, top, right, bottom))
    return cropped.resize((out_w, out_h), Image.Resampling.LANCZOS)


async def load_partitions_for_group(group_key: str) -> list[dict]:
    async with async_session_factory() as session:
        rows = await session.execute(
            text(
                """
                SELECT
                    p.id,
                    p.partition_key,
                    p.display_name,
                    p.boundary_geojson,
                    g.group_key
                FROM world_partition p
                JOIN world_partition_group_member m ON m.partition_id = p.id
                JOIN world_partition_group g ON g.id = m.group_id
                WHERE g.group_key = :gk
                ORDER BY p.partition_seq
                """
            ),
            {"gk": group_key},
        )
        return list(rows.mappings().all())


async def load_partitions_by_keys(partition_keys: list[str]) -> list[dict]:
    async with async_session_factory() as session:
        rows = await session.execute(
            text(
                """
                SELECT
                    p.id,
                    p.partition_key,
                    p.display_name,
                    p.boundary_geojson,
                    g.group_key
                FROM world_partition p
                JOIN world_partition_group_member m ON m.partition_id = p.id
                JOIN world_partition_group g ON g.id = m.group_id
                WHERE p.partition_key = ANY(:keys)
                ORDER BY p.partition_seq
                """
            ),
            {"keys": partition_keys},
        )
        return list(rows.mappings().all())


def save_reference_images(partition: dict, zoom: int, force: bool = False) -> None:
    pk = partition["partition_key"]
    gk = partition["group_key"]
    p_short = short_name(pk)
    g_short = short_name(gk)
    out_dir = CACHE_ROOT / g_short
    out_dir.mkdir(parents=True, exist_ok=True)

    raw_path = out_dir / f"{p_short}_satellite_raw.png"
    masked_path = out_dir / f"{p_short}_satellite.png"
    meta_path = out_dir / f"{p_short}_satellite_meta.json"

    if not force and raw_path.exists() and masked_path.exists():
        print(f"[SKIP] {p_short} already cached")
        return

    boundaries = [partition["boundary_geojson"]]
    bbox = compute_bbox(boundaries)
    span_lng = bbox[2] - bbox[0]
    span_lat = bbox[3] - bbox[1]
    out_w, out_h = compute_image_size(span_lng, span_lat)

    print(f"[FETCH] {partition['display_name']} ({pk})")
    print(f"  bbox: {bbox[0]:.6f}, {bbox[1]:.6f}, {bbox[2]:.6f}, {bbox[3]:.6f}")
    print(f"  size: {out_w}x{out_h}px @ z{zoom}")

    raw_img = build_satellite_bbox_image(bbox, zoom, out_w, out_h)
    raw_img.save(raw_path, format="PNG")

    mask = create_mask(boundaries, bbox, out_w, out_h)
    black = Image.new("RGB", raw_img.size, (0, 0, 0))
    masked = Image.composite(raw_img, black, mask.convert("L"))
    if SOFTEN_RADIUS > 0:
        softened = masked.filter(ImageFilter.GaussianBlur(radius=SOFTEN_RADIUS))
        masked = Image.composite(softened, black, mask.convert("L"))
    masked.save(masked_path, format="PNG")

    meta = {
        "partition_key": pk,
        "group_key": gk,
        "bbox": bbox,
        "width": out_w,
        "height": out_h,
        "zoom": zoom,
        "raw_path": str(raw_path.relative_to(ROOT_DIR)),
        "masked_path": str(masked_path.relative_to(ROOT_DIR)),
    }
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  saved raw: {raw_path}")
    print(f"  saved masked: {masked_path}")


async def main() -> None:
    parser = argparse.ArgumentParser()
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--group-key", help="group 내 모든 partition reference 생성")
    src.add_argument("--partition-keys", nargs="+", help="특정 partition key 목록")
    parser.add_argument("--zoom", type=int, default=DEFAULT_ZOOM, help="satellite tile zoom")
    parser.add_argument("--force", action="store_true", help="기존 캐시가 있어도 다시 생성")
    args = parser.parse_args()

    if args.group_key:
        partitions = await load_partitions_for_group(args.group_key)
    else:
        partitions = await load_partitions_by_keys(args.partition_keys)

    if not partitions:
        print("[ERROR] no partitions found")
        sys.exit(1)

    print(f"[START] {len(partitions)} partitions")
    for part in partitions:
        save_reference_images(part, args.zoom, force=args.force)
    print("[DONE]")


if __name__ == "__main__":
    asyncio.run(main())
