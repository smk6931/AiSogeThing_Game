"""
노량진2동 전 파티션 텍스처 생성
- Juggernaut XL v10 + 텍스처 프롬프트 방식
- 그룹별 테마 → 파티션별 seed 다르게 → 98개 개별 이미지
- 저장: front/public/world_partition/noryangjin2_{gXX}/{pXXX}.png
- DB: world_partition.texture_image_url 업데이트

실행:
  python back/scripts/gen_noryangjin2_textures.py
  python back/scripts/gen_noryangjin2_textures.py --group g01    # 특정 그룹만
  python back/scripts/gen_noryangjin2_textures.py --dry-run       # DB/파일 없이 목록만 출력
"""
import sys, time, json, argparse, urllib.request, shutil
from pathlib import Path
from sqlalchemy import create_engine, text

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT     = Path(__file__).resolve().parents[2]
BACK_DIR = ROOT / "back"
sys.path.insert(0, str(BACK_DIR))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

# ── DB ──────────────────────────────────────────────────────────────────────
DB_URL   = "postgresql://game_sogething:0000@127.0.0.1:5100/game_sogething"
engine   = create_engine(DB_URL)

# ── ComfyUI ──────────────────────────────────────────────────────────────────
COMFYUI  = "http://127.0.0.1:8188"
CKPT     = "juggernautXL_v10.safetensors"
STEPS    = 22
CFG      = 6.0
SAMPLER  = "dpmpp_2m"
SCHEDULER= "karras"
BASE_SIZE= 512
BASE_SEED= 10000000

NEGATIVE = (
    "cartoon, anime, 3D render, depth, perspective, side view, isometric, "
    "mushrooms, flowers, fruits, seeds, acorns, nuts, berries, worms, insects, "
    "trees, plants protruding, tall objects, standing objects, 3D items, "
    "characters, buildings, walls, fences, sky, horizon, "
    "strong shadows, bright light, bloom, vignette, "
    "blurry, watermark, text, logo, border, frame, "
    "ugly, deformed, bad quality, duplicate"
)

# ── 테마별 텍스처 프롬프트 ────────────────────────────────────────────────────
THEME_PROMPTS = {
    "sanctuary_green": (
        "seamless tileable ground texture, flat overhead view, "
        "dark forest soil surface covered with patchy green moss, "
        "thin dry leaves and pine needles lying flat on earth, "
        "surface texture of damp organic soil, "
        "flat ground material with natural color variation, "
        "deep brown soil tones with muted green moss patches, "
        "no objects, no depth, pure flat surface pattern, "
        "high detail, photorealistic PBR material"
    ),
    "academy_sanctum": (
        "seamless tileable ground texture, flat overhead view, "
        "compacted dirt road surface, warm brown packed earth, "
        "fine gravel and sand mixed into soil, subtle stone fragments flush with ground, "
        "worn natural path surface with slight color variation, "
        "flat earthy ground material, warm beige and brown tones, "
        "no objects, no depth, pure flat surface pattern, "
        "high detail, photorealistic PBR material"
    ),
    "ancient_stone_route": (
        "seamless tileable ground texture, flat overhead view, "
        "worn cobblestone pavement surface, flat irregular grey stones flush with ground, "
        "moss and lichen growing in thin cracks between stones, "
        "dark earthy mortar filling gaps, aged stone surface with natural variation, "
        "flat stone ground material, cool grey and muted green tones, "
        "no objects, no depth, pure flat surface pattern, "
        "high detail, photorealistic PBR material"
    ),
}

# ── 출력 경로 ─────────────────────────────────────────────────────────────────
OUT_ROOT = ROOT / "front" / "public" / "world_partition"


def g_short(group_key: str) -> str:
    """seoul.dongjak.noryangjin2.group.g01 → noryangjin2_g01"""
    parts = group_key.split(".")
    return f"{parts[2]}_{parts[-1]}"

def p_short(partition_key: str) -> str:
    """seoul..2.v2.0048 → 0048"""
    return partition_key.split(".")[-1]


# ── ComfyUI 헬퍼 ──────────────────────────────────────────────────────────────
def comfy_post(path, data):
    req = urllib.request.Request(
        f"{COMFYUI}{path}",
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def comfy_get(path):
    with urllib.request.urlopen(f"{COMFYUI}{path}") as r:
        return json.loads(r.read())

def wait_for_job(prompt_id, timeout=300):
    start = time.time()
    while time.time() - start < timeout:
        h = comfy_get(f"/history/{prompt_id}")
        if prompt_id in h:
            imgs = []
            for v in h[prompt_id].get("outputs", {}).values():
                imgs.extend(v.get("images", []))
            return imgs
        time.sleep(2)
    raise TimeoutError(f"timeout: {prompt_id}")

def copy_from_comfy(filename: str, dest: Path):
    """ComfyUI output → 목적지로 직접 파일 복사 (urlretrieve 원본 덮어쓰기 방지)"""
    src = ROOT / "tools" / "ComfyUI" / "output" / filename
    if src.exists():
        shutil.copy2(src, dest)
    else:
        # fallback: HTTP 다운로드 (청크)
        url = f"{COMFYUI}/view?filename={filename}&subfolder=&type=output"
        with urllib.request.urlopen(url) as r, open(dest, "wb") as f:
            while chunk := r.read(65536):
                f.write(chunk)

def build_workflow(prompt: str, seed: int, prefix: str) -> dict:
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": NEGATIVE, "clip": ["1", 1]}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": BASE_SIZE, "height": BASE_SIZE, "batch_size": 1}},
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed, "steps": STEPS, "cfg": CFG,
                "sampler_name": SAMPLER, "scheduler": SCHEDULER, "denoise": 1.0,
                "model": ["1", 0], "positive": ["2", 0],
                "negative": ["3", 0], "latent_image": ["4", 0],
            },
        },
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "UpscaleModelLoader", "inputs": {"model_name": "4xUltrasharp_4xUltrasharpV10.pt"}},
        "8": {"class_type": "ImageUpscaleWithModel", "inputs": {"upscale_model": ["7", 0], "image": ["6", 0]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": prefix}},
    }


# ── DB 조회 ───────────────────────────────────────────────────────────────────
def load_partitions(group_filter=None):
    """노량진2동 그룹+파티션 목록 반환 [(group_key, theme_code, partition_key, partition_id)]"""
    with engine.connect() as conn:
        cond = "AND g.group_key LIKE :gf" if group_filter else ""
        q = f"""
            SELECT g.group_key, g.theme_code, p.partition_key, p.id
            FROM world_partition_group g
            JOIN world_partition_group_member m ON m.group_id = g.id
            JOIN world_partition p ON p.id = m.partition_id
            WHERE g.group_key LIKE '%noryangjin2%' {cond}
            ORDER BY g.group_key, p.partition_key
        """
        params = {"gf": f"%{group_filter}%"} if group_filter else {}
        rows = conn.execute(text(q), params).fetchall()
    return rows

def update_db_url(partition_id: int, url: str):
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE world_partition SET texture_image_url = :url WHERE id = :id"),
            {"url": url, "id": partition_id},
        )


# ── 메인 ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--group", help="특정 그룹만 (예: g01)")
    parser.add_argument("--dry-run", action="store_true", help="목록만 출력, 생성 안 함")
    args = parser.parse_args()

    rows = load_partitions(args.group)
    total = len(rows)
    print(f"대상 파티션: {total}개\n")

    if args.dry_run:
        for gk, theme, pk, pid in rows:
            print(f"  [{g_short(gk)}] {p_short(pk)} | {theme}")
        return

    done = 0
    errors = []
    t_start = time.time()

    for idx, (group_key, theme_code, partition_key, partition_id) in enumerate(rows):
        gs   = g_short(group_key)
        ps   = p_short(partition_key)
        seed = BASE_SEED + idx
        prompt = THEME_PROMPTS.get(theme_code, THEME_PROMPTS["sanctuary_green"])
        prefix = f"nrj2_{gs}_{ps}"

        out_dir = OUT_ROOT / gs
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{ps}.png"

        elapsed = int(time.time() - t_start)
        remaining_est = int(elapsed / max(idx, 1) * (total - idx)) if idx > 0 else 0
        print(f"[{idx+1}/{total}] {gs}/{ps} | {theme_code} | ~{remaining_est//60}분{remaining_est%60}초 남음")

        try:
            wf    = build_workflow(prompt, seed, prefix)
            resp  = comfy_post("/prompt", {"prompt": wf})
            pid_c = resp["prompt_id"]
            imgs  = wait_for_job(pid_c)
            if not imgs:
                raise RuntimeError("이미지 출력 없음")

            copy_from_comfy(imgs[0]["filename"], out_path)
            url = f"/world_partition/{gs}/{ps}.png"
            update_db_url(partition_id, url)
            done += 1
            print(f"  저장: {out_path.name} ({out_path.stat().st_size // 1024} KB) → DB 업데이트")

        except Exception as e:
            errors.append((partition_key, str(e)))
            print(f"  ERROR: {e}")

    total_time = int(time.time() - t_start)
    print(f"\n완료: {done}/{total}개 ({total_time//60}분 {total_time%60}초)")
    if errors:
        print(f"실패 {len(errors)}개:")
        for pk, err in errors:
            print(f"  {pk}: {err}")

if __name__ == "__main__":
    main()
