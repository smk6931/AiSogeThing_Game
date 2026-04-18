"""
Partition texture img2img generator from cached satellite references.

Flow:
1. Load partition info from DB
2. Find cached masked satellite reference under back/cache/partition_ref/{g_short}/
3. Copy reference to tools/ComfyUI/input
4. Run ComfyUI img2img workflow
5. Re-apply polygon mask to the generated image
6. Save final PNG to front/public/world_partition/{g_short}/{p_short}.png
7. Update world_partition.texture_image_url
"""

import argparse
import asyncio
import json
import shutil
import sys
import time
import urllib.request
from pathlib import Path
from comfy_output_utils import dated_comfy_prefix

from PIL import Image, ImageDraw, ImageFilter

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parents[2]
BACK_DIR = ROOT_DIR / "back"
FRONT_PUBLIC = ROOT_DIR / "front" / "public"
CACHE_ROOT = BACK_DIR / "cache" / "partition_ref"
COMFY_INPUT = ROOT_DIR / "tools" / "ComfyUI" / "input"
COMFY_OUTPUT = ROOT_DIR / "tools" / "ComfyUI" / "output"

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


def cache_short_name(key: str) -> str:
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


def build_positive_prompt(part: dict) -> str:
    landuse = (part.get("landuse_code") or "").lower()
    context = FLOOR_CONTEXT.get(landuse, FLOOR_CONTEXT["default"])
    group_prompt = (part.get("image_prompt_base") or "").strip()
    pieces = [POSITIVE_PREFIX, context]
    if group_prompt:
        pieces.append(group_prompt)
    pieces.append(
        "avoid tall objects, avoid oversized decorative elements, "
        "keep the surface readable as playable ground, preserve spatial layout from the reference"
    )
    return ", ".join(pieces)


def build_workflow(input_filename: str, positive: str, negative: str, seed: int) -> dict:
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": positive, "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["1", 1]}},
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
        "8": {"class_type": "SaveImage", "inputs": {"images": ["7", 0], "filename_prefix": dated_comfy_prefix("partition_img2img")}},
    }


def resolve_reference_path(group_short: str, partition_key: str) -> Path:
    cache_dir = CACHE_ROOT / group_short
    p_short = short_name(partition_key)
    exact = cache_dir / f"{p_short}_satellite.png"
    if exact.exists():
        return exact
    legacy = cache_short_name(partition_key)
    candidates = sorted(cache_dir.glob(f"*{legacy}_satellite.png"))
    if candidates:
        return candidates[0]
    raise FileNotFoundError(f"satellite reference not found for {partition_key} in {cache_dir}")


async def load_partitions(partition_keys: list[str]) -> list[dict]:
    async with async_session_factory() as session:
        rows = await session.execute(
            text(
                """
                SELECT
                    p.id,
                    p.partition_key,
                    p.display_name,
                    p.boundary_geojson,
                    p.landuse_code,
                    g.group_key,
                    g.image_prompt_base
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


async def update_partition_texture(partition_id: int, texture_url: str) -> None:
    async with async_session_factory() as session:
        await session.execute(
            text("UPDATE world_partition SET texture_image_url = :url WHERE id = :id"),
            {"url": texture_url, "id": partition_id},
        )
        await session.commit()


async def generate_for_partition(part: dict, force: bool = False) -> None:
    pk = part["partition_key"]
    p_short = short_name(pk)
    g_short = short_name(part["group_key"])
    ref_path = resolve_reference_path(g_short, pk)
    out_dir = FRONT_PUBLIC / "world_partition" / g_short
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{p_short}.png"
    ref_preview_path = out_dir / f"{p_short}.ref.png"
    image_preview_path = out_dir / f"{p_short}.image.png"
    texture_url = f"/world_partition/{g_short}/{p_short}.png"

    comfy_input_name = f"{g_short}_{p_short}_satellite.png"
    comfy_input_path = COMFY_INPUT / comfy_input_name
    shutil.copy2(ref_path, comfy_input_path)
    shutil.copy2(ref_path, ref_preview_path)

    if out_path.exists() and not force:
        print(f"[SKIP] {p_short} already exists")
        print(f"  ref preview: {ref_preview_path}")
        return

    positive = build_positive_prompt(part)
    seed = hash(pk) % (2 ** 32)
    workflow = build_workflow(comfy_input_name, positive, NEGATIVE, seed)

    print(f"[IMG2IMG] {part['display_name']} ({pk})")
    print(f"  ref: {ref_path}")
    resp = comfy_post("/prompt", {"prompt": workflow})
    prompt_id = resp["prompt_id"]
    print(f"  queued: {prompt_id}")
    images = wait_for_job(prompt_id)
    if not images:
        raise RuntimeError(f"no image returned for {pk}")

    tmp_path = out_dir / f"{p_short}__tmp.png"
    image_info = images[0]
    download_image(image_info["filename"], image_info.get("subfolder", ""), tmp_path)
    shutil.copy2(tmp_path, image_preview_path)

    gen_img = Image.open(tmp_path).convert("RGB")
    boundaries = [part["boundary_geojson"]]
    bbox = compute_bbox(boundaries)
    poly_mask = create_mask(boundaries, bbox, gen_img.width, gen_img.height)
    black = Image.new("RGB", gen_img.size, (0, 0, 0))
    clipped = Image.composite(gen_img, black, poly_mask.convert("L"))
    if SOFTEN_RADIUS > 0:
        softened = clipped.filter(ImageFilter.GaussianBlur(radius=SOFTEN_RADIUS))
        clipped = Image.composite(softened, black, poly_mask.convert("L"))
    clipped.save(out_path, format="PNG")
    tmp_path.unlink(missing_ok=True)

    await update_partition_texture(part["id"], texture_url)
    print(f"  saved: {out_path}")
    print(f"  ref preview: {ref_preview_path}")
    print(f"  image preview: {image_preview_path}")
    print(f"  db: {texture_url}")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--partition-keys", nargs="+", required=True)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    try:
        comfy_get("/system_stats")
    except Exception:
        print(f"[ERROR] ComfyUI is not responding at {COMFYUI_HOST}")
        sys.exit(1)

    partitions = await load_partitions(args.partition_keys)
    if not partitions:
        print("[ERROR] no partitions found")
        sys.exit(1)

    print(f"[START] {len(partitions)} partitions")
    for part in partitions:
        await generate_for_partition(part, force=args.force)
    print("[DONE]")


if __name__ == "__main__":
    asyncio.run(main())
