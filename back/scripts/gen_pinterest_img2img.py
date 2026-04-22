"""
Pinterest reference image → img2img 바닥 텍스처 생성 스크립트.

모드:
  1. 테스트 모드 (--count): 지정 장수만 생성, front/public/ground/pinterest_i2i/ 저장
  2. 파티션 모드 (--partition-keys): 파티션별 1장씩 생성, world_partition/ 저장 + DB 업데이트

Usage:
  # 테스트 2장
  python back/scripts/gen_pinterest_img2img.py --ref <path> --count 2 --theme lava

  # 파티션 매핑
  python back/scripts/gen_pinterest_img2img.py --ref <path> --theme lava \\
    --partition-keys seoul..2.v2.0038 seoul..2.v2.0039 seoul..2.v2.0040 seoul..2.v2.0041
"""
import argparse
import json
import random
import shutil
import sys
import time
import urllib.request
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR     = Path(__file__).resolve().parents[2]
BACK_DIR     = ROOT_DIR / "back"
FRONT_PUBLIC = ROOT_DIR / "front" / "public"
COMFY_INPUT  = ROOT_DIR / "tools" / "ComfyUI" / "input"
TEST_OUT_DIR = FRONT_PUBLIC / "ground" / "pinterest_i2i"

if str(BACK_DIR) not in sys.path:
    sys.path.append(str(BACK_DIR))

COMFYUI_HOST = "http://localhost:8188"
CHECKPOINT   = "juggernautXL_v10.safetensors"
LORA_1       = "zavy-ctsmtrc-sdxl.safetensors"
LORA_1_STR   = 0.6
LORA_2       = "add-detail-xl.safetensors"
LORA_2_STR   = 0.5
STEPS        = 28
CFG          = 6.5
SAMPLER      = "dpmpp_2m"
SCHEDULER    = "karras"
DENOISE      = 0.85
OUT_PX       = 1024
OUT_PX_HIRES = 2048

# ── 테마 프리셋 ────────────────────────────────────────────────────────────────
THEMES: dict[str, dict] = {
    "dungeon": {
        "positive": (
            "strict 90 degree top-down overhead view, flat ground plane fills entire frame, "
            "dark cracked stone dungeon floor texture, "
            "magical teal and cyan glow bleeding through floor cracks, "
            "purple crystal shards embedded flat in ground, "
            "dark jade-green stone tiles with deep fissures, "
            "glowing rune patterns on ancient stone surface, "
            "fantasy RPG dungeon ground texture, "
            "painterly hand-drawn game art style, high detail, ground surface only"
        ),
        "negative": (
            "crystal pillars standing upright, tall crystal towers, glowing vertical crystals, "
            "characters, warriors, NPCs, monsters, "
            "cave walls, rock walls, ceiling, stalactites, "
            "fire torches, wall decorations, "
            "side view, isometric angle, diagonal perspective, horizon, "
            "sky, outdoor, blurry, watermark, text, UI, border, frame"
        ),
    },
    "forest": {
        "positive": (
            "strict 90 degree top-down overhead view, "
            "seamless ground texture fills entire frame edge to edge, no border, "
            "content extends fully to all four corners, "
            "lush green meadow ground, winding shallow river stream embedded flat in terrain, "
            "soft surface relief in grass, gentle height variation across terrain, "
            "worn dirt footpath, dappled light patches on ground, "
            "subtle ambient occlusion in grass tufts and soil depressions, "
            "fantasy RPG nature ground texture, painterly game art style, "
            "high detail, ground surface only"
        ),
        "negative": (
            "framing trees, border vegetation, edge trees, forest border frame, "
            "tall standing tree trunks, tree canopy blocking view, "
            "characters, NPCs, buildings, sky, horizon, "
            "side view, perspective, diagonal view, "
            "watermark, text, UI, border, frame, logo"
        ),
    },
    "seamless_soil": {
        # 레퍼런스: 단순 평면 흙 텍스처 (image.png)
        # 컨셉: 씬 구조 없는 순수 표면 재질 변형 — 블렌딩용 타일 생성
        # denoise 0.5~0.6 권장 (표면 품질 유지하면서 재질만 변형)
        "positive": (
            "seamless tileable ground surface texture, flat overhead view, "
            "dark moist earth soil with small pebbles and grit embedded flat, "
            "varied surface roughness, organic texture variation, "
            "subtle moisture patches and dry cracked areas, "
            "natural ground material, no objects, no structures, "
            "high detail surface texture, uniform coverage"
        ),
        "negative": (
            "trees, plants, grass blades, vegetation, rocks above surface, "
            "characters, buildings, structures, "
            "border, frame, edge, vignette, "
            "sky, horizon, side view, perspective, watermark, text, UI"
        ),
    },
    "village_lane": {
        # 레퍼런스: moonblossom-laneway.png
        # 컨셉: 석판 골목길이 명확한 동선을 만드는 판타지 게임 아트 스타일 지형
        "positive": (
            "strict 90 degree top-down overhead view, flat ground plane fills entire frame edge to edge, "
            "seamless content extends fully to all four corners, no border, "
            "worn cobblestone lane path as clear movement corridor through terrain, "
            "damp mossy stone tiles with cracks between cobblestones, "
            "cherry blossom petals scattered flat on stone ground surface, "
            "warm torch light glow pooling flat on stone ground at intervals, "
            "distinct path zone creating natural movement lane through terrain, "
            "dark stone ground with earthy soil edges alongside path, "
            "fantasy RPG game map ground texture, painterly game art style, high detail, ground surface only"
        ),
        "negative": (
            "tall cherry blossom trees, tree trunks, vertical tree structures, "
            "buildings, walls, wooden fences elevated above ground, "
            "torches mounted on vertical poles, wall decorations, "
            "characters, NPCs, monsters, "
            "side view, perspective angle, diagonal view, isometric angle, "
            "sky, horizon, watermark, text, UI, border, frame, logo, patreon"
        ),
    },
    "canyon_river": {
        # 레퍼런스: canyon-stream-passage.png
        # 컨셉: 바위 협곡 + 강이 동선과 구역 경계를 만드는 지형
        "positive": (
            "strict 90 degree top-down overhead view, flat ground plane fills entire frame edge to edge, "
            "seamless content extends fully to all four corners, no border, "
            "rocky canyon ground with flat embedded stones and gravel, "
            "turquoise river stream flowing flat through rocky terrain, "
            "sandy dirt path winding alongside the river on flat ground, "
            "weathered grey rock faces embedded flat in ground, "
            "sparse dry vegetation patches between rocks, "
            "natural zone separation by water and rocky terrain, "
            "fantasy RPG nature map ground texture, painterly watercolor game art style, "
            "high detail, ground surface only"
        ),
        "negative": (
            "tall vertical canyon walls, cliff faces standing upright, rock wall columns, "
            "tall standing rock formations, boulder towers rising up, "
            "tree trunks, tall trees, vertical tree structures, dark forest framing, "
            "characters, NPCs, shrines, buildings, wooden structures, cross markers, "
            "side view, perspective angle, diagonal view, isometric angle, "
            "sky, horizon, watermark, text, UI, border, frame, patreon, logo"
        ),
    },
    "forest_path": {
        # 레퍼런스: treehouse-lantern-bridge.png
        # 컨셉: 길·강·절벽 등 자연물이 동선과 구역 경계를 만드는 지형
        "positive": (
            "strict 90 degree top-down overhead view, flat ground plane fills entire frame edge to edge, "
            "seamless content extends fully to all four corners, no border, "
            "winding wooden plank walkway path curving through dark forest floor, "
            "shallow river stream and calm water pools forming natural zone boundaries, "
            "forest floor with mossy stones, roots embedded flat in earth, "
            "distinct terrain zones separated by water and dense undergrowth, "
            "warm golden lantern light glow pooling on ground at path junctions, "
            "soft dappled moonlight filtering onto forest floor clearings, "
            "worn earth trail suggesting foot traffic and movement corridors, "
            "fantasy RPG nature ground texture, painterly game art style, high detail, ground surface only"
        ),
        "negative": (
            "framing trees, border vegetation, edge trees, forest border frame, "
            "tall standing tree trunks blocking view, overhead tree canopy, "
            "treehouse structure above ground, wooden buildings elevated, "
            "characters, NPCs, monsters, "
            "side view, perspective, diagonal view, isometric angle, "
            "sky, horizon, blurry, watermark, text, UI, border, frame, logo"
        ),
    },
    "emerald_arcane": {
        # 레퍼런스: front/public/ground/texture/15.png
        # 컨셉: 에메랄드 녹색 대형 석판 + 금빛 균열 라인, 학자/마법사 구역 바닥
        # 방사형 패턴 방지: distributed crack network 강조
        "positive": (
            "strict 90 degree top-down overhead view, flat ground plane fills entire frame edge to edge, "
            "dark emerald green cracked stone floor texture, "
            "golden glowing luminescent crack lines distributed irregularly across entire surface, "
            "irregular branching crack network spread uniformly, no central origin point, "
            "deep dark green jade stone slabs with warm gold glowing fissures, "
            "ancient arcane scholar hall floor, mystical enchanted stone tiles, "
            "distributed fracture pattern across flat surface, varied crack widths, "
            "dark teal and forest green stone with bright amber gold veins, "
            "fantasy RPG arcane scholarly ground texture, painterly game art style, high detail, ground surface only"
        ),
        "negative": (
            "radial burst pattern, central focal point, starburst cracks from center, "
            "crystal pillars standing upright, vertical structures, "
            "characters, warriors, NPCs, monsters, "
            "cave walls, rock walls, ceiling, "
            "blue tones, cyan glow, orange lava, red fire, "
            "side view, isometric angle, diagonal perspective, horizon, "
            "sky, outdoor, blurry, watermark, text, UI, border, frame"
        ),
    },
    "dark_marble": {
        # 레퍼런스: front/public/ground/texture/17.png
        # 컨셉: 어두운 남색/흑색 대리석, 전기 청록 균열 라인, 마법 던전 바닥
        "positive": (
            "strict 90 degree top-down overhead view, flat ground plane fills entire frame edge to edge, "
            "dark navy black obsidian marble stone floor texture, "
            "electric cyan blue glowing luminescent crack lines bleeding through dark stone surface, "
            "bioluminescent fracture pattern radiating across deep dark midnight blue stone, "
            "dark cracked marble with vivid teal glowing veins, "
            "magical mystical dungeon floor, ancient enchanted stone with glowing fissures, "
            "deep shadows between crack edges, high contrast dark stone and bright cyan glow, "
            "fantasy RPG mystical ground texture, painterly game art style, high detail, ground surface only"
        ),
        "negative": (
            "crystal pillars standing upright, tall crystal towers, vertical structures, "
            "characters, warriors, NPCs, monsters, "
            "cave walls, rock walls, ceiling, stalactites, stalagmites, "
            "orange lava, red fire, warm tones, "
            "side view, isometric angle, diagonal perspective, horizon, "
            "sky, outdoor, blurry, watermark, text, UI, border, frame"
        ),
    },
    "lava": {
        "positive": (
            "strict 90 degree top-down overhead view, flat ground plane fills entire frame, "
            "dark volcanic rock ground texture, cracked obsidian stone floor, "
            "glowing orange-red lava bleeding through deep fissures in ground, "
            "ashen grey stone path winding across scorched flat earth, "
            "smoldering volcanic rock fragments flat on ground, heat-scorched soil, "
            "dramatic orange and red glow from lava cracks, dark charcoal and ember tones, "
            "fantasy RPG volcanic ground texture, painterly game art style, high detail, ground surface only"
        ),
        "negative": (
            "tall rock formations standing upright, cliff walls, boulders above ground, "
            "lava waterfalls, vertical lava streams, eruption, volcano peak, "
            "characters, NPCs, monsters, "
            "smoke clouds blocking ground view, sky, horizon, "
            "side view, perspective angle, diagonal view, "
            "trees, plants, buildings, watermark, text, UI, border, frame, patreon"
        ),
    },
}


# ── ComfyUI 유틸 ───────────────────────────────────────────────────────────────
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


def upload_image(src: Path) -> str:
    dst = COMFY_INPUT / src.name
    shutil.copy2(src, dst)
    return src.name


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


def build_workflow(ref_filename: str, seed: int, positive: str, negative: str,
                   denoise: float = DENOISE) -> dict:
    return {
        "1":  {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}},
        "2":  {
            "class_type": "LoraLoader",
            "inputs": {
                "model": ["1", 0], "clip": ["1", 1],
                "lora_name": LORA_1,
                "strength_model": LORA_1_STR, "strength_clip": LORA_1_STR,
            },
        },
        "3":  {
            "class_type": "LoraLoader",
            "inputs": {
                "model": ["2", 0], "clip": ["2", 1],
                "lora_name": LORA_2,
                "strength_model": LORA_2_STR, "strength_clip": LORA_2_STR,
            },
        },
        "4":  {"class_type": "CLIPTextEncode", "inputs": {"text": positive, "clip": ["3", 1]}},
        "5":  {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["3", 1]}},
        "6":  {"class_type": "LoadImage", "inputs": {"image": ref_filename}},
        "7":  {
            "class_type": "ImageScale",
            "inputs": {"image": ["6", 0], "upscale_method": "lanczos",
                       "width": OUT_PX, "height": OUT_PX, "crop": "center"},
        },
        "8":  {"class_type": "VAEEncode", "inputs": {"pixels": ["7", 0], "vae": ["1", 2]}},
        "9":  {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed, "steps": STEPS, "cfg": CFG,
                "sampler_name": SAMPLER, "scheduler": SCHEDULER,
                "denoise": denoise,
                "model": ["3", 0],
                "positive": ["4", 0], "negative": ["5", 0],
                "latent_image": ["8", 0],
            },
        },
        "10": {"class_type": "VAEDecode", "inputs": {"samples": ["9", 0], "vae": ["1", 2]}},
        "11": {"class_type": "UpscaleModelLoader",
               "inputs": {"model_name": "4xUltrasharp_4xUltrasharpV10.pt"}},
        "12": {"class_type": "ImageUpscaleWithModel",
               "inputs": {"upscale_model": ["11", 0], "image": ["10", 0]}},
        "13": {"class_type": "ImageScale",
               "inputs": {"image": ["12", 0], "upscale_method": "lanczos",
                          "width": OUT_PX, "height": OUT_PX, "crop": "disabled"}},
        "14": {"class_type": "SaveImage",
               "inputs": {"images": ["13", 0], "filename_prefix": "pinterest_i2i"}},
    }


def generate_one(ref_filename: str, seed: int, positive: str, negative: str,
                 out_path: Path, label: str, denoise: float = DENOISE) -> bool:
    wf = build_workflow(ref_filename, seed, positive, negative, denoise=denoise)
    resp = comfy_post("/prompt", {"prompt": wf})
    prompt_id = resp["prompt_id"]
    print(f"  queued: {prompt_id}")
    images = wait_for_job(prompt_id)
    if not images:
        print("  [WARN] 생성 실패")
        return False
    out_path.parent.mkdir(parents=True, exist_ok=True)
    download_image(images[0]["filename"], images[0].get("subfolder", ""), out_path)
    print(f"  saved: {out_path}")
    return True


def p_short(partition_key: str) -> str:
    parts = partition_key.split(".")
    if len(parts) >= 2 and parts[1] == "":
        return parts[-1]
    return partition_key.replace(".", "_")


def g_short_from_group_key(group_key: str) -> str:
    parts = group_key.split(".")
    if "group" in parts:
        idx = parts.index("group")
        dong = parts[idx - 1] if idx > 0 else parts[2]
        return f"{dong}_{parts[-1]}"
    return group_key.replace(".", "_")


# ── 파티션 DB 조회 + 업데이트 ──────────────────────────────────────────────────
async def run_partition_mode(ref_filename: str, partition_keys: list[str],
                             positive: str, negative: str, theme_name: str):
    from dotenv import load_dotenv
    from sqlalchemy import text
    from core.database import async_session_factory

    load_dotenv(ROOT_DIR / ".env")

    async with async_session_factory() as session:
        for pk in partition_keys:
            row = await session.execute(
                text("""
                    SELECT p.id, p.partition_key, p.display_name,
                           g.group_key
                    FROM world_partition p
                    JOIN world_partition_group_member m ON m.partition_id = p.id
                    JOIN world_partition_group g ON g.id = m.group_id
                    WHERE p.partition_key = :pk
                    LIMIT 1
                """), {"pk": pk}
            )
            part = row.mappings().first()
            if not part:
                print(f"[WARN] partition_key 없음: {pk}")
                continue

            ps = p_short(pk)
            gs = g_short_from_group_key(part["group_key"])
            out_path = FRONT_PUBLIC / "world_partition" / gs / f"{ps}.png"
            db_url   = f"/world_partition/{gs}/{ps}.png"

            print(f"\n[PARTITION] {part['display_name']} ({pk})")
            seed = random.randint(0, 2**32)
            print(f"  seed={seed}")

            ok = generate_one(ref_filename, seed, positive, negative, out_path, ps)
            if ok:
                await session.execute(
                    text("UPDATE world_partition SET texture_image_url = :url WHERE id = :id"),
                    {"url": db_url, "id": part["id"]},
                )
                await session.commit()
                print(f"  DB: {pk} → {db_url}")

        # 레퍼런스 이미지 그룹 폴더에 사본 저장 (첫 파티션 처리 후 1회)
        if partition_keys:
            first_pk = partition_keys[0]
            row = await session.execute(
                text("""
                    SELECT g.group_key FROM world_partition p
                    JOIN world_partition_group_member m ON m.partition_id = p.id
                    JOIN world_partition_group g ON g.id = m.group_id
                    WHERE p.partition_key = :pk LIMIT 1
                """), {"pk": first_pk}
            )
            r = row.mappings().first()
            if r:
                gs = g_short_from_group_key(r["group_key"])
                ref_src = COMFY_INPUT / ref_filename
                ref_dst = FRONT_PUBLIC / "world_partition" / gs / f"ref_{theme_name}.png"
                if ref_src.exists():
                    shutil.copy2(ref_src, ref_dst)
                    print(f"\n[REF SAVED] {ref_dst}")


# ── 엔트리포인트 ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import asyncio

    parser = argparse.ArgumentParser()
    parser.add_argument("--ref", required=True, help="레퍼런스 이미지 경로")
    parser.add_argument("--theme", choices=list(THEMES.keys()), default="dungeon",
                        help=f"테마 프리셋: {list(THEMES.keys())}")
    parser.add_argument("--count", type=int, default=None,
                        help="테스트 모드: 생성 장수 (--partition-keys 없을 때)")
    parser.add_argument("--partition-keys", nargs="+", default=None,
                        help="파티션 매핑 모드: partition_key 목록")
    parser.add_argument("--denoise", type=float, default=None,
                        help=f"denoise 강도 오버라이드 (기본값: {DENOISE})")
    parser.add_argument("--hires", action="store_true",
                        help=f"2048px 고품질 출력 (기본값: {OUT_PX}px)")
    args = parser.parse_args()

    ref_path = Path(args.ref)
    if not ref_path.exists():
        print(f"[ERROR] 파일 없음: {ref_path}")
        sys.exit(1)

    positive  = THEMES[args.theme]["positive"]
    negative  = THEMES[args.theme]["negative"]
    denoise   = args.denoise if args.denoise is not None else DENOISE
    out_px    = OUT_PX_HIRES if args.hires else OUT_PX
    ref_filename = upload_image(ref_path)

    globals()["OUT_PX"] = out_px

    print(f"[REF] {ref_path.name} → ComfyUI input")
    print(f"[THEME] {args.theme}")
    print(f"[CONFIG] {CHECKPOINT} | LoRA: {LORA_1}({LORA_1_STR}) + {LORA_2}({LORA_2_STR})")
    print(f"[CONFIG] steps={STEPS}, cfg={CFG}, denoise={denoise}, out={out_px}px")

    if args.partition_keys:
        # 파티션 매핑 모드
        asyncio.run(run_partition_mode(ref_filename, args.partition_keys, positive, negative, args.theme))
    else:
        # 테스트 모드
        count = args.count or 2
        TEST_OUT_DIR.mkdir(parents=True, exist_ok=True)
        for i in range(1, count + 1):
            seed = random.randint(0, 2**32)
            print(f"\n[{i}/{count}] seed={seed}")
            out_path = TEST_OUT_DIR / f"{ref_path.stem}_i2i_{i:02d}.png"
            generate_one(ref_filename, seed, positive, negative, out_path, str(i), denoise=denoise)

    print("\n[DONE]")
