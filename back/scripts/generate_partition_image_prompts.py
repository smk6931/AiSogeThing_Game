"""
월드 파티션 이미지 생성 프롬프트 자동 생성 스크립트

- world_partition_group.image_prompt_base : 없는 그룹(5개) 생성
- world_partition.image_prompt_append    : 전체 파티션(328개) 생성
- world_partition.resolved_prompt        : base + append + style suffix 합산 저장
- world_partition.prompt_resolved_at     : 생성 타임스탬프

실행: python back/scripts/generate_partition_image_prompts.py
"""

import sys
import os
import asyncio
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "back"))

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

from core.database import fetch_all, fetch_one, execute  # noqa: E402

# ──────────────────────────────────────────────
# 공통 스타일 suffix (resolved_prompt 끝에 항상 추가)
# ──────────────────────────────────────────────
STYLE_SUFFIX = (
    "top-down RPG game map tile, hand-painted texture style, "
    "korean urban fantasy, rich environmental detail, "
    "warm atmospheric lighting, no characters, no UI elements"
)

# ──────────────────────────────────────────────
# 그룹 image_prompt_base (없는 5개 노량진2동 그룹)
# ──────────────────────────────────────────────
GROUP_BASE_OVERRIDES = {
    22: (  # 녹음 비탈권 북측 서편  sanctuary_green / grove_keeper
        "steep green hillside on northern noryangjin urban fringe, "
        "overgrown embankment where residential streets meet ancient grove, "
        "tangled tree roots gripping mossy stone retaining walls, "
        "narrow dirt paths worn by local walkers, "
        "glimpse of han river through dense canopy, "
        "dusk amber light filtering through old zelkova branches"
    ),
    23: (  # 수목 완충권 북측 중앙  sanctuary_green / grove_keeper
        "narrow tree buffer corridor between korean apartment blocks and hillside slope, "
        "mature zelkova and ginkgo canopy over cracked stone benches, "
        "faded trail markers half-buried in leaf litter, "
        "morning mist pooled in the low hollow, "
        "city birdsong and distant traffic muffled by green walls, "
        "spirit-moss glowing faint green on shaded stone"
    ),
    24: (  # 숨결 언덕권 중앙 서편  sanctuary_green / grove_keeper
        "gently sloping hillside park connecting upper and lower noryangjin districts, "
        "zigzag stone stairways between terraced garden plots, "
        "small wooden rest pavilion with weathered timber beams, "
        "overgrown medicinal herb beds along fence lines, "
        "spirit wind rustling through bamboo clusters at corners, "
        "paved shortcut paths linking neighbourhoods across the slope"
    ),
    25: (  # 학인의 뜰권 중앙 중앙  academy_sanctum / academy_watcher
        "noryangjin cram school district inner courtyard, "
        "densely packed study-hall buildings with lit parchment windows, "
        "ink-stained stone plaza with runic focus circles etched in pavement, "
        "floating study orbs casting pale blue light from upper floors, "
        "bulletin boards covered in schedule scrolls and exam timetables, "
        "weight of concentrated ambition hanging in the still air, muted slate-blue palette"
    ),
    29: (  # 수목 완충권 남측 서편  sanctuary_green / grove_keeper
        "southern green buffer corridor on noryangjin urban slope, "
        "old oaks with gnarled roots overhanging crumbling stone walls, "
        "wild vegetation reclaiming unused urban margins, "
        "scattered stone spirit-shrines half-swallowed by undergrowth, "
        "shafts of golden light breaking through the canopy at dusk, "
        "hidden rest spots for lone walkers between hillside neighbourhoods"
    ),
}

# ──────────────────────────────────────────────
# 파티션 append 템플릿 풀
# key: (theme_code, dominant_landuse)
# 각 풀에서 partition.id % len(pool) 으로 결정론적 선택
# ──────────────────────────────────────────────
APPEND_POOL: dict[tuple[str, str], list[str]] = {
    ("residential_zone", "residential"): [
        "dense korean apartment rooftop cluster, varied tile colors, narrow service alleys between blocks, small rooftop water tanks and AC units, iron stairwells on building sides, evening light from stacked windows",
        "tight urban residential block, concrete inner courtyard with potted plants, worn pavement drain grates, corner convenience store awning edge, low stone boundary wall with iron fence",
        "mixed-age korean housing micro-block, laundry lines stretched between buildings, narrow stone steps to upper floor unit, old zelkova tree canopy overhanging alley corner, faded wall murals",
        "apartment cluster with small central plaza, dried persimmon hanging on balcony poles, communal recycling bins by entrance gate, cracked tile path to mailbox row, oil-paper lantern above doorway",
        "hillside residential terrace row, staggered building heights following slope, stone retaining wall with painted mural, small garden patch behind ground-floor unit, rooftop pigeon loft",
    ],
    ("sanctuary_green", "park"): [
        "small neighbourhood park with ancient ginkgo, stone exercise equipment along perimeter path, wooden rest pavilion with curved tile roof, sparse grass worn smooth by daily foot traffic, spirit lantern on stone post",
        "hillside urban park platform, stone steps ascending to viewing terrace, memorial stone marker with moss-filled inscription, iron bench facing valley, morning mist trapped in low corners",
        "pocket park between apartment blocks, circular gravel path around old pine tree, low hedge border with spirit-moss glow, stone chess table with seated ghost of a regular player",
        "terraced park on urban slope, tiered stone flower beds, gnarled plum trees in bloom, carved stone animal guardian at entrance, weathered tiled pavilion roof catching leaf litter",
    ],
    ("sanctuary_green", "forest"): [
        "dense urban hillside forest, irregular canopy of oak and pine, narrow dirt trail through fern undergrowth, lichen-covered boulders in deep shade, spirit lantern posts along path edges",
        "steep forested slope in korean city, bamboo grove at lower edge, mossy stone wall ruins, filtered light on fern beds, fox spirit marker stone half-buried in roots",
        "old hillside woodland remnant, ancient tree trunks with bark carvings, hollow log with glowing fungus colony, scattered acorn caps on soft earth, spirit-thread spun between branches overhead",
        "mixed deciduous forest patch on urban hill, fallen trunk bridging gully, shrine alcove in rock face with coin offerings, carpet of deep moss, shafts of green light through canopy gap",
    ],
    ("forge_district", "industrial"): [
        "compact industrial yard with runed storage tanks, metal walkways connecting workshop roofs, barrel stacks marked with magical sigil chalk, glowing forge exhaust pipe, scorch marks on concrete apron",
        "small factory block, pipe network across rooftop, loading dock with rune-chalked crates, industrial chimney with sigil rings, oil-stained service courtyard, arcane pressure gauges clustered on wall",
        "machine workshop cluster, iron-grate floor sections, sparks drifting from vented roof forge, rune-welded chain hanging on wall bracket, metal filing debris in corner, cooling rack of enchanted ingots",
        "industrial storage compound, corrugated metal walls with rust stains, locked rune-gate at entrance, magical condensation pipes dripping into collection barrels, forklift tracks in hardened mud",
    ],
    ("ancient_waterway", "water"): [
        "still dark river channel between reinforced embankments, iron railing along concrete edge, reed clusters growing at waterline, spirit-light shimmer on reflected sky surface, algae rings on stone pylons",
        "wide han river section with exposed sandbar, ancient stone ferry landing with worn steps, willow branch trailing on slow current, glowing koi traces beneath water surface, lotus pad cluster",
        "river inlet with stagnant backwater, water hyacinth mat covering surface, rusted chain mooring ring on stone post, waterbird roost platform, faint bioluminescent algae bloom at edge",
        "flood channel between urban blocks, concrete lining with crack-grass growth, stepping stone crossing half-submerged, frogs on mossy ledge, distant weir sound, spirit water-marks on embankment wall",
    ],
    ("academy_sanctum", "educational"): [
        "cram school inner courtyard, densely packed study-hall buildings, worn stone plaza with ink-circle practice marks, floating study orbs in windows, exam schedule scroll boards on wall",
        "educational building cluster with narrow connecting paths, rune-board postings on walls, small central courtyard with stone scholar statue, candle-lit upper windows, stacked textbook towers visible inside",
        "private academy rooftop study terrace, glass greenhouse study pod, potted medicinal herb rows, suspended focus-crystal overhead, student name-plaques on small wooden boxes",
    ],
    ("sanctuary_healing", "medical"): [
        "small healing garden between clinic buildings, stone medicinal herb planters, softly glowing apothecary windows, purifying-rune water basin, muted sage and cream colour palette, wind chimes by entrance",
        "infirmary courtyard, white-stone paving with herb-circle inscription, recovery bench under willow shade, spirit-salt boundary markers at gate, faint aloe-green glow from treatment ward windows",
    ],
    ("urban_district", "commercial"): [
        "busy commercial micro-block, lantern-lit shopfront awnings in row, street vendor stall at corner, cobblestone foot-traffic area, hanging sign boards in korean script with rune embellishments",
        "market alley block, colourful stall canopies, food steam rising from cart, chalk price-rune boards, worn stone gutter, merchant cat familiar sleeping on windowsill overhead",
    ],
}

# fallback: 매핑 없는 (theme, landuse) 조합
APPEND_FALLBACK = [
    "urban terrain block with mixed surface textures, stone paving and packed earth, boundary walls and small gate, scattered daily-life objects, ambient soft lighting from nearby windows",
    "transitional zone between building types, varied ground surface, tree shadow pattern on pavement, small signpost with korean text, worn path corners revealing older stone beneath",
    "mid-density urban block, inner alley with drain channel, old utility pole with bundled cables, painted kerb stones, shadow patterns from nearby structures overhead",
]


def pick(pool: list[str], partition_id: int) -> str:
    return pool[partition_id % len(pool)]


def make_resolved(base: str, append: str) -> str:
    return f"{base}, {append}, {STYLE_SUFFIX}"


# ──────────────────────────────────────────────
# 메인 로직
# ──────────────────────────────────────────────
async def main() -> None:
    now = datetime.now(timezone.utc)

    # 1. 그룹 프롬프트 보완 (5개)
    print("=== 그룹 image_prompt_base 생성 ===")
    groups_missing = await fetch_all(
        """
        SELECT id, display_name, theme_code, persona_tag
        FROM world_partition_group
        WHERE is_active = true
          AND (image_prompt_base IS NULL OR image_prompt_base = '')
        ORDER BY id
        """,
        {},
    )
    for g in groups_missing:
        gid = g["id"]
        base = GROUP_BASE_OVERRIDES.get(gid)
        if not base:
            print(f"  [SKIP] id={gid} {g['display_name']} - 오버라이드 없음")
            continue
        await execute(
            "UPDATE world_partition_group SET image_prompt_base = :base WHERE id = :id",
            {"base": base, "id": gid},
        )
        print(f"  [OK] id={gid} {g['display_name']}")

    # 2. 파티션 append + resolved 생성
    print("\n=== 파티션 image_prompt_append / resolved_prompt 생성 ===")
    partitions = await fetch_all(
        """
        SELECT
            p.id, p.display_name, p.theme_code, p.dominant_landuse,
            pg.image_prompt_base as group_base,
            pg.display_name as group_name
        FROM world_partition p
        LEFT JOIN world_partition_group_member pgm ON pgm.partition_id = p.id
        LEFT JOIN world_partition_group pg ON pg.id = pgm.group_id
        WHERE p.is_road = false
        ORDER BY p.id
        """,
        {},
    )

    updated = 0
    skipped_no_base = 0
    for p in partitions:
        pid = p["id"]
        theme = p["theme_code"] or ""
        landuse = p["dominant_landuse"] or ""
        group_base = p["group_base"] or ""

        pool_key = (theme, landuse)
        pool = APPEND_POOL.get(pool_key, APPEND_FALLBACK)
        append = pick(pool, pid)

        resolved = make_resolved(group_base, append) if group_base else f"{append}, {STYLE_SUFFIX}"
        if not group_base:
            skipped_no_base += 1

        await execute(
            """
            UPDATE world_partition
            SET image_prompt_append = :append,
                resolved_prompt     = :resolved,
                prompt_resolved_at  = :ts
            WHERE id = :id
            """,
            {"append": append, "resolved": resolved, "ts": now, "id": pid},
        )
        updated += 1

    print(f"  파티션 처리: {updated}개 (그룹 base 없어 base 생략: {skipped_no_base}개)")

    # 3. 결과 요약
    print("\n=== 최종 확인 ===")
    g_stat = await fetch_one(
        """
        SELECT
            COUNT(*) FILTER (WHERE image_prompt_base IS NOT NULL AND image_prompt_base != '') as has_base,
            COUNT(*) as total
        FROM world_partition_group WHERE is_active = true
        """,
        {},
    )
    p_stat = await fetch_one(
        """
        SELECT
            COUNT(*) FILTER (WHERE resolved_prompt IS NOT NULL) as resolved,
            COUNT(*) FILTER (WHERE image_prompt_append IS NOT NULL) as has_append,
            COUNT(*) as total
        FROM world_partition WHERE is_road = false
        """,
        {},
    )
    print(f"그룹  : {g_stat['has_base']}/{g_stat['total']} base 완료")
    print(f"파티션: resolved={p_stat['resolved']}, append={p_stat['has_append']}, total={p_stat['total']}")

    # 4. 샘플 출력
    samples = await fetch_all(
        """
        SELECT p.display_name, pg.display_name as group_name,
               p.resolved_prompt
        FROM world_partition p
        LEFT JOIN world_partition_group_member pgm ON pgm.partition_id = p.id
        LEFT JOIN world_partition_group pg ON pg.id = pgm.group_id
        WHERE p.resolved_prompt IS NOT NULL
        ORDER BY p.id
        LIMIT 3
        """,
        {},
    )
    print("\n=== 샘플 resolved_prompt ===")
    for s in samples:
        print(f"\n[{s['group_name']}] {s['display_name']}")
        print(f"  {s['resolved_prompt'][:180]}...")


if __name__ == "__main__":
    asyncio.run(main())
