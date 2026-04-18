"""
Generate partition textures from a shared group satellite reference.

Flow:
1. Load all partitions for a group and build one shared group satellite image
2. For each target partition, crop a square local reference from the group image
3. Run ComfyUI img2img from the square reference
4. Clip the result back to the partition polygon
5. Save previews and final mapped texture
"""

import argparse
import asyncio
import io
import json
import math
import shutil
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parents[2]
BACK_DIR = ROOT_DIR / "back"
FRONT_PUBLIC = ROOT_DIR / "front" / "public"
CACHE_ROOT = BACK_DIR / "cache" / "group_partition_ref"
COMFY_INPUT = ROOT_DIR / "tools" / "ComfyUI" / "input"

if str(BACK_DIR) not in sys.path:
    sys.path.append(str(BACK_DIR))

from dotenv import load_dotenv
from sqlalchemy import text

from core.database import async_session_factory

load_dotenv(ROOT_DIR / ".env")

COMFYUI_HOST = "http://localhost:8188"
CHECKPOINT = "juggernautXL_v10.safetensors"
STEPS = 22
CFG = 6.0
SAMPLER = "dpmpp_2m"
SCHEDULER = "karras"
DENOISE = 0.42
POLY_MASK_FEATHER = 6
SOFTEN_RADIUS = 0.8
DEFAULT_ZOOM = 18
SQUARE_PAD_RATIO = 0.18
SQUARE_OUT_SIZE = 768
SATELLITE_TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
TILE_SIZE = 256

POSITIVE_PREFIX = (
    "strict 90 degree top-down view, flat playable ground plane, "
    "preserve the large-scale layout of roads, paths, green zones, water edges, and open areas from the reference image, "
    "transform building areas into calm flat terrain instead of objects, "
    "treat all urban structures as flattened ground masks, not as physical objects, "
    "soft fantasy RPG ground atmosphere, subtle depth only, readable terrain first, surface texture second, "
    "top-down map ground, no side surfaces, no perspective"
)
NEGATIVE = (
    "rocks, stone blocks, ruins, flagstones, courtyard, walls, buildings, rooftops, windows, facades, "
    "cars, street signs, billboards, text, power lines, perspective, isometric, angled camera, side view, horizon, "
    "oversized plants, fantasy props, decorative objects, clutter, strong shadows, black gaps, "
    "photoreal city detail, border, frame, watermark, logo, blurry, low quality, duplicate objects"
)

FLOOR_CONTEXT = {
    "residential": "calm flat neighborhood ground, soft earth and grass blend, faint worn footpath traces, muted ground variation, no stone objects",
    "industrial": "flat dark compacted ground, muted soil variation, worn utility paths, low object detail, no stone blocks",
    "park": "lush flat park ground, soft grass, mossy earth, gentle path traces, natural green floor pattern, no tall objects",
    "forest": "flat forest floor, soft mossy earth, gentle dirt path traces, dark green canopy pattern pressed into the ground, subtle organic depth",
    "default": "flat stylized ground, soft earth and grass blend, readable top-down terrain, low object detail, no stone objects",
}


def short_name(key: str) -> str:
    parts = key.split(".")
    if "group" in parts:
        idx = parts.index("group")
        dong = parts[idx - 1] if idx > 0 else parts[2]
        return f"{dong}_{parts[-1]}"
    if len(parts) >= 2 and parts[1] == "":
        return parts[-1]
    if len(parts) >= 5 and parts[2]:
        return f"{parts[2]}_{parts[4]}"
    return key.replace(".", "_")


def comfy_post(endpoint: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{COMFYUI_HOST}{endpoint}",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


def comfy_get(endpoint: str) -> dict:
    with urllib.request.urlopen(f"{COMFYUI_HOST}{endpoint}", timeout=30) as resp:
        return json.loads(resp.read())


def wait_for_job(prompt_id: str, timeout: int = 600) -> list[dict]:
    started = time.time()
    while time.time() - started < timeout:
        history = comfy_get(f"/history/{prompt_id}")
        if prompt_id in history:
            images: list[dict] = []
            for node_output in history[prompt_id].get("outputs", {}).values():
                images.extend(node_output.get("images", []))
            return images
        time.sleep(2)
    raise TimeoutError(f"job {prompt_id} timed out")


def download_image(filename: str, subfolder: str, out_path: Path) -> None:
    url = f"{COMFYUI_HOST}/view?filename={filename}&subfolder={subfolder}&type=output"
    urllib.request.urlretrieve(url, out_path)


def compute_bbox(boundaries: list[dict]) -> tuple[float, float, float, float]:
    min_lng = min_lat = float("inf")
    max_lng = max_lat = float("-inf")
    for boundary in boundaries:
        if not boundary:
            continue
        if isinstance(boundary, str):
            boundary = json.loads(boundary)
        for coord in boundary.get("coordinates", [[]])[0]:
            min_lng = min(min_lng, coord[0])
            max_lng = max(max_lng, coord[0])
            min_lat = min(min_lat, coord[1])
            max_lat = max(max_lat, coord[1])
    return min_lng, min_lat, max_lng, max_lat


def create_mask(boundaries: list[dict], bbox: tuple[float, float, float, float], width: int, height: int) -> Image.Image:
    min_lng, min_lat, max_lng, max_lat = bbox
    span_lng = max_lng - min_lng or 1e-9
    span_lat = max_lat - min_lat or 1e-9

    def to_px(lng: float, lat: float) -> tuple[float, float]:
        x = (lng - min_lng) / span_lng * width
        y = (lat - min_lat) / span_lat * height
        return x, y

    mask = Image.new("RGB", (width, height), (0, 0, 0))
    draw = ImageDraw.Draw(mask)
    for boundary in boundaries:
        if not boundary:
            continue
        if isinstance(boundary, str):
            boundary = json.loads(boundary)
        outer = boundary.get("coordinates", [[]])[0]
        poly_px = [to_px(coord[0], coord[1]) for coord in outer]
        if len(poly_px) >= 3:
            draw.polygon(poly_px, fill=(255, 255, 255))
        for hole in boundary.get("coordinates", [[]])[1:]:
            hole_px = [to_px(coord[0], coord[1]) for coord in hole]
            if len(hole_px) >= 3:
                draw.polygon(hole_px, fill=(0, 0, 0))
    if POLY_MASK_FEATHER > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(POLY_MASK_FEATHER))
    return mask


def deg2tile_frac(lat: float, lng: float, zoom: int) -> tuple[float, float]:
    lat_rad = math.radians(lat)
    n = 2 ** zoom
    xtile = (lng + 180.0) / 360.0 * n
    ytile = (1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi) / 2.0 * n
    return xtile, ytile


def fetch_tile(z: int, x: int, y: int) -> Image.Image:
    url = SATELLITE_TILE_URL.format(z=z, x=x, y=y)
    req = urllib.request.Request(url, headers={"User-Agent": "AiSogeThing-GroupReference/1.0"})
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
    for tx in range(x_start, x_end + 1):
        for ty in range(y_start, y_end + 1):
            tile = fetch_tile(zoom, tx, ty)
            mosaic.paste(tile, ((tx - x_start) * TILE_SIZE, (ty - y_start) * TILE_SIZE))

    left = round((x_min_f - x_start) * TILE_SIZE)
    top = round((y_top_f - y_start) * TILE_SIZE)
    right = round((x_max_f - x_start) * TILE_SIZE)
    bottom = round((y_bottom_f - y_start) * TILE_SIZE)
    cropped = mosaic.crop((left, top, right, bottom))
    return cropped.resize((out_w, out_h), Image.Resampling.LANCZOS)


def build_positive_prompt(part: dict) -> str:
    landuse = (part.get("landuse_code") or "").lower()
    context = FLOOR_CONTEXT.get(landuse, FLOOR_CONTEXT["default"])
    group_prompt = (part.get("image_prompt_base") or "").strip()
    parts = [POSITIVE_PREFIX, context]
    if group_prompt:
        parts.append(group_prompt)
    parts.append("avoid object composition, keep spatial layout from the shared group reference")
    return ", ".join(parts)


def build_workflow(input_filename: str, positive: str, seed: int) -> dict:
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": positive, "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": NEGATIVE, "clip": ["1", 1]}},
        "4": {"class_type": "LoadImage", "inputs": {"image": input_filename}},
        "5": {"class_type": "VAEEncode", "inputs": {"pixels": ["4", 0], "vae": ["1", 2]}},
        "6": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed,
                "steps": STEPS,
                "cfg": CFG,
                "sampler_name": SAMPLER,
                "scheduler": SCHEDULER,
                "denoise": DENOISE,
                "model": ["1", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["5", 0],
            },
        },
        "7": {"class_type": "VAEDecode", "inputs": {"samples": ["6", 0], "vae": ["1", 2]}},
        "8": {"class_type": "SaveImage", "inputs": {"images": ["7", 0], "filename_prefix": "groupref_partition"}},
    }


async def load_group_partitions(group_key: str) -> list[dict]:
    async with async_session_factory() as session:
        rows = await session.execute(
            text(
                """
                SELECT
                    p.id,
                    p.partition_key,
                    p.partition_seq,
                    p.display_name,
                    p.boundary_geojson,
                    p.landuse_code,
                    g.group_key,
                    g.image_prompt_base
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


async def update_partition_texture(partition_id: int, texture_url: str) -> None:
    async with async_session_factory() as session:
        await session.execute(
            text("UPDATE world_partition SET texture_image_url = :url WHERE id = :id"),
            {"url": texture_url, "id": partition_id},
        )
        await session.commit()


def lnglat_to_px(lng: float, lat: float, bbox: tuple[float, float, float, float], width: int, height: int) -> tuple[float, float]:
    min_lng, min_lat, max_lng, max_lat = bbox
    x = (lng - min_lng) / (max_lng - min_lng or 1e-9) * width
    y = (lat - min_lat) / (max_lat - min_lat or 1e-9) * height
    return x, y


def build_square_geo_bbox(part_bbox: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
    min_lng, min_lat, max_lng, max_lat = part_bbox
    center_lng = (min_lng + max_lng) / 2
    center_lat = (min_lat + max_lat) / 2
    span_lng = max_lng - min_lng
    span_lat = max_lat - min_lat
    side = max(span_lng, span_lat) * (1.0 + SQUARE_PAD_RATIO * 2.0)
    return (
        center_lng - side / 2,
        center_lat - side / 2,
        center_lng + side / 2,
        center_lat + side / 2,
    )


def crop_square_from_group(group_img: Image.Image, group_bbox: tuple[float, float, float, float], crop_bbox: tuple[float, float, float, float]) -> Image.Image:
    left, top = lnglat_to_px(crop_bbox[0], crop_bbox[1], group_bbox, group_img.width, group_img.height)
    right, bottom = lnglat_to_px(crop_bbox[2], crop_bbox[3], group_bbox, group_img.width, group_img.height)
    crop = group_img.crop((round(left), round(top), round(right), round(bottom)))
    return crop.resize((SQUARE_OUT_SIZE, SQUARE_OUT_SIZE), Image.Resampling.LANCZOS)


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--group-key", required=True)
    parser.add_argument("--partition-keys", nargs="+", required=True)
    parser.add_argument("--zoom", type=int, default=DEFAULT_ZOOM)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    try:
        comfy_get("/system_stats")
    except Exception:
        print(f"[ERROR] ComfyUI is not responding at {COMFYUI_HOST}")
        sys.exit(1)

    partitions = await load_group_partitions(args.group_key)
    part_map = {p["partition_key"]: p for p in partitions}
    targets = [part_map[pk] for pk in args.partition_keys if pk in part_map]
    if not targets:
        print("[ERROR] no target partitions found")
        sys.exit(1)

    g_short = short_name(args.group_key)
    cache_dir = CACHE_ROOT / g_short
    cache_dir.mkdir(parents=True, exist_ok=True)
    front_dir = FRONT_PUBLIC / "world_partition" / g_short
    front_dir.mkdir(parents=True, exist_ok=True)

    group_bbox = compute_bbox([p["boundary_geojson"] for p in partitions])
    group_raw_path = cache_dir / "group_raw.png"
    group_masked_path = cache_dir / "group_masked.png"
    group_ref_preview_path = front_dir / "group.ref.png"

    if args.force or not group_raw_path.exists():
        print(f"[GROUP REF] {args.group_key}")
        group_img = build_satellite_bbox_image(group_bbox, args.zoom, 2048, 2048)
        group_img.save(group_raw_path, format="PNG")
        group_mask = create_mask([p["boundary_geojson"] for p in partitions], group_bbox, 2048, 2048)
        black = Image.new("RGB", group_img.size, (0, 0, 0))
        group_masked = Image.composite(group_img, black, group_mask.convert("L"))
        group_masked.save(group_masked_path, format="PNG")
    else:
        group_img = Image.open(group_raw_path).convert("RGB")
        group_masked = Image.open(group_masked_path).convert("RGB")

    shutil.copy2(group_masked_path, group_ref_preview_path)

    print(f"[START] {len(targets)} partitions from shared group reference")
    for part in targets:
        pk = part["partition_key"]
        p_short = short_name(pk)
        out_path = front_dir / f"{p_short}.png"
        ref_preview = front_dir / f"{p_short}.ref.png"
        image_preview = front_dir / f"{p_short}.image.png"
        texture_url = f"/world_partition/{g_short}/{p_short}.png"
        if out_path.exists() and not args.force:
            print(f"[SKIP] {p_short} already exists")
            continue

        part_bbox = compute_bbox([part["boundary_geojson"]])
        square_bbox = build_square_geo_bbox(part_bbox)
        square_ref = crop_square_from_group(group_img, group_bbox, square_bbox)
        square_ref.save(ref_preview, format="PNG")

        comfy_input_name = f"{g_short}_{p_short}_groupref.png"
        comfy_input_path = COMFY_INPUT / comfy_input_name
        square_ref.save(comfy_input_path, format="PNG")

        positive = build_positive_prompt(part)
        seed = hash(f"groupref::{pk}") % (2 ** 32)
        workflow = build_workflow(comfy_input_name, positive, seed)
        print(f"[IMG2IMG] {part['display_name']} ({pk})")
        resp = comfy_post("/prompt", {"prompt": workflow})
        images = wait_for_job(resp["prompt_id"])
        if not images:
            raise RuntimeError(f"no image returned for {pk}")

        tmp_path = front_dir / f"{p_short}__tmp.png"
        image_info = images[0]
        download_image(image_info["filename"], image_info.get("subfolder", ""), tmp_path)
        shutil.copy2(tmp_path, image_preview)

        gen_img = Image.open(tmp_path).convert("RGB")
        poly_mask = create_mask([part["boundary_geojson"]], square_bbox, gen_img.width, gen_img.height)
        black = Image.new("RGB", gen_img.size, (0, 0, 0))
        clipped = Image.composite(gen_img, black, poly_mask.convert("L"))
        if SOFTEN_RADIUS > 0:
            softened = clipped.filter(ImageFilter.GaussianBlur(radius=SOFTEN_RADIUS))
            clipped = Image.composite(softened, black, poly_mask.convert("L"))
        clipped.save(out_path, format="PNG")
        tmp_path.unlink(missing_ok=True)

        await update_partition_texture(part["id"], texture_url)
        print(f"  saved: {out_path}")
        print(f"  ref: {ref_preview}")
        print(f"  image: {image_preview}")
        print(f"  db: {texture_url}")

    print("[DONE]")


if __name__ == "__main__":
    asyncio.run(main())
