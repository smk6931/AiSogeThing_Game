import json
from collections import Counter, defaultdict
from math import cos, floor, radians
from pathlib import Path

from shapely.geometry import Polygon


ROOT_DIR = Path(__file__).resolve().parents[2]
SEED_PATH = ROOT_DIR / "back" / "world" / "data" / "noryangjin2_level_partition_seed.json"
CACHE_PATH = ROOT_DIR / "back" / "cache" / "zones" / "v20_dong_3879477.json"

CITY_NAME = "서울특별시"
DISTRICT_NAME = "동작구"
DONG_NAME = "노량진2동"
DONG_OSM_ID = 3879477
CITY_SLUG = "seoul"
DISTRICT_SLUG = "dongjak"
DONG_SLUG = "noryangjin2"

BUCKET_COPY = {
    "river_edge": {
        "names": ["안개 수문터", "물빛 경계포", "흐름 감시대", "서리 수로목"],
        "summaries": [
            "수변 접근이나 개방 경계 연출에 쓰기 좋은 파티션",
            "시야 확보와 추적 전투가 잘 어울리는 물가형 파티션",
        ],
        "description": "노량진2동에서 드문 수변 감각을 강조하는 예외 구역이다. 개방 시야와 경계 연출, 추적형 조우를 넣기 좋다.",
    },
    "green_buffer": {
        "names": ["수목 결계 언덕", "은엽 정원턱", "숨은 녹음 비탈", "고요한 숲계단"],
        "summaries": [
            "녹지와 비탈이 만나는 숨 고르기 파티션",
            "채집과 짧은 휴식 이벤트가 어울리는 녹지형 파티션",
        ],
        "description": "언덕 녹지와 주거 비탈이 맞닿는 완충 구역이다. 숨 고르기, 채집, 짧은 조우 이벤트 배치에 적합하다.",
    },
    "campus_buffer": {
        "names": ["학인의 언덕", "기숙 서고뜰", "강론 회랑", "청람 배움마당"],
        "summaries": [
            "교육 시설 분위기와 정적이 섞인 파티션",
            "탐문, 의뢰, 보조 퀘스트 배치가 쉬운 학원형 파티션",
        ],
        "description": "교육 시설과 조용한 생활권이 겹치는 구간이다. NPC 탐문, 문서 수집, 보호 의뢰형 콘텐츠와 잘 맞는다.",
    },
    "route_node": {
        "names": ["석단 관문길", "등성이 교차로", "골목 계단로", "순찰 능선길"],
        "summaries": [
            "이동과 추격전의 리듬을 만드는 연결 파티션",
            "골목 전투와 순찰 경로 연출에 적합한 길목 파티션",
        ],
        "description": "도로 분할 기반의 연결 구역이다. 계단, 비탈, 골목이 얽힌 이동 축이라 추격전과 순찰형 전투에 잘 맞는다.",
    },
    "special_poi": {
        "names": ["봉인의 공터", "숨은 집회터", "밤결 제단터", "잔광 망루지"],
        "summaries": [
            "강한 판타지 연출을 넣기 좋은 특수 파티션",
            "이벤트, 보스 전조, 비밀 퀘스트 거점으로 적합한 파티션",
        ],
        "description": "노량진2동 내에서 유독 분위기 전환이 강한 특수 지점이다. 보스 전조, 제단, 비밀 의식, 이벤트 배치용으로 좋다.",
    },
    "living_block": {
        "names": ["비탈빛 주거지", "계단 골목 단지", "연등 골목마을", "경사 주거 구획"],
        "summaries": [
            "비탈 주거와 생활 골목 감각이 살아 있는 파티션",
            "생활형 퀘스트와 소규모 교전이 자연스러운 주거 파티션",
        ],
        "description": "노량진2동의 비탈 주거와 계단 골목 감각을 담는 핵심 구역이다. 생활형 퀘스트, 경계 전투, NPC 동선 연출에 적합하다.",
    },
}

GROUP_THEME_TEMPLATES = {
    "frozen_riverfront": ["물안개 경계권", "수문 감시권", "흐름 관측권"],
    "sanctuary_green": ["녹음 비탈권", "수목 완충권", "숨결 언덕권"],
    "academy_sanctum": ["학인의 뜰권", "배움 회랑권", "서고 언덕권"],
    "urban_fantasy_residential": ["계단 주거권", "비탈 골목권", "연등 생활권"],
    "ancient_stone_route": ["석단 길목권", "능선 교차권", "순찰 가도권"],
    "event_pocket": ["봉인 특이권", "야경 제단권", "잔광 사건권"],
}


def polygon_to_geojson(coords: list[list[float]], holes: list[list[list[float]]] | None = None) -> dict:
    shell = [[lng, lat] for lat, lng in coords]
    interiors = [[[lng, lat] for lat, lng in hole] for hole in (holes or [])]
    return {"type": "Polygon", "coordinates": [shell, *interiors]}


def centroid(coords: list[list[float]]) -> tuple[float, float]:
    points = coords[:-1] if len(coords) > 1 else coords
    count = max(len(points), 1)
    return (
        round(sum(point[0] for point in points) / count, 6),
        round(sum(point[1] for point in points) / count, 6),
    )


def polygon_from_coords(coords: list[list[float]], holes: list[list[list[float]]] | None = None) -> Polygon | None:
    if len(coords) < 4:
        return None
    shell = [(lng, lat) for lat, lng in coords]
    interiors = [[(lng, lat) for lat, lng in hole] for hole in (holes or []) if len(hole) >= 4]
    polygon = Polygon(shell=shell, holes=interiors)
    if not polygon.is_valid:
        polygon = polygon.buffer(0)
    if polygon.is_empty:
        return None
    if hasattr(polygon, "geoms"):
        polygon = max((geom for geom in polygon.geoms if isinstance(geom, Polygon)), key=lambda geom: geom.area, default=None)
    return polygon if polygon and polygon.is_valid else None


def scaled_area_m2(polygon: Polygon) -> float:
    ref_lat = polygon.centroid.y
    lat_scale = 111_000.0
    lng_scale = 111_000.0 * cos(radians(ref_lat))
    shell = [(x * lng_scale, y * lat_scale) for x, y in polygon.exterior.coords]
    holes = [[(x * lng_scale, y * lat_scale) for x, y in ring.coords] for ring in polygon.interiors]
    return round(abs(Polygon(shell=shell, holes=holes).area), 2)


def build_landuse_polygons(zones: dict) -> dict[str, list[Polygon]]:
    excluded = {"road_major", "road_minor", "sectors"}
    result: dict[str, list[Polygon]] = {}
    for category, features in zones.items():
        if category in excluded:
            continue
        polygons: list[Polygon] = []
        for feature in features or []:
            if feature.get("type") != "polygon":
                continue
            polygon = polygon_from_coords(feature.get("coords") or [], feature.get("holes") or [])
            if polygon is not None:
                polygons.append(polygon)
        result[category] = polygons
    return result


def analyze_landuse(sector: dict, landuse_polygons: dict[str, list[Polygon]]) -> tuple[str, float, str, dict[str, float]]:
    sector_polygon = polygon_from_coords(sector.get("coords") or [], sector.get("holes") or [])
    if sector_polygon is None:
        return "unclassified", 0.0, "missing_sector_polygon", {}

    sector_area = max(scaled_area_m2(sector_polygon), 1.0)
    overlap_by_landuse: dict[str, float] = {}
    for category, polygons in landuse_polygons.items():
        total = 0.0
        for polygon in polygons:
            if not sector_polygon.intersects(polygon):
                continue
            overlap = sector_polygon.intersection(polygon)
            if overlap.is_empty:
                continue
            if hasattr(overlap, "geoms"):
                total += sum(scaled_area_m2(geom) for geom in overlap.geoms if isinstance(geom, Polygon))
            elif isinstance(overlap, Polygon):
                total += scaled_area_m2(overlap)
        if total > 0:
            overlap_by_landuse[category] = round(total, 2)

    if overlap_by_landuse:
        dominant_landuse, dominant_area = max(overlap_by_landuse.items(), key=lambda item: item[1])
        return dominant_landuse, round(min(dominant_area / sector_area, 1.0), 4), "overlap", overlap_by_landuse

    nearest_category = "unclassified"
    nearest_distance = None
    for category, polygons in landuse_polygons.items():
        for polygon in polygons:
            distance = sector_polygon.distance(polygon)
            if nearest_distance is None or distance < nearest_distance:
                nearest_distance = distance
                nearest_category = category
    return nearest_category, 0.0, "nearest", {}


def choose_bucket(dominant_landuse: str, area_m2: float, mix_score: float) -> tuple[str, str, str, str]:
    if dominant_landuse == "water":
        return "river_edge", "frozen_riverfront", "waterfront_mixed", "river_patrol"
    if dominant_landuse in {"park", "forest"}:
        return "green_buffer", "sanctuary_green", dominant_landuse, "grove_keeper"
    if dominant_landuse == "educational":
        return "campus_buffer", "academy_sanctum", "educational", "academy_watcher"
    if dominant_landuse in {"commercial", "industrial", "medical"}:
        return "route_node", "ancient_stone_route", dominant_landuse, "route_keeper"
    if area_m2 < 900 or mix_score < 0.12:
        return "route_node", "ancient_stone_route", "connector", "crossroad_runner"
    if area_m2 > 6000:
        return "special_poi", "event_pocket", "special", "event_keeper"
    return "living_block", "urban_fantasy_residential", dominant_landuse or "residential", "street_resident"


def choose_texture_profile(bucket: str, dominant_landuse: str, seq: int, area_m2: float) -> str:
    if bucket == "river_edge":
        return ["glacier_rift_01", "glacier_rift_02", "glacier_rift_03"][(seq - 1) % 3]
    if bucket == "green_buffer":
        if dominant_landuse == "forest":
            return "forest_path_01" if seq % 2 else "forest_path_02"
        return "cliff_meadow_01" if area_m2 > 2200 else "pond_meadow_01"
    if bucket == "campus_buffer":
        return "academy_ruin_yard_01" if seq % 2 else "sanctuary_trail_01"
    if bucket == "route_node":
        return "stone_route_trim" if area_m2 < 600 else ("sunlit_stone_route_01" if seq % 2 else "sunlit_stone_route_02")
    if bucket == "special_poi":
        return "arcane_floor_01" if seq % 2 else "arcane_floor_02"
    return "village_square_01" if seq % 2 else "cliff_meadow_01"


def choose_copy(bucket: str, seq: int) -> tuple[str, str, str]:
    profile = BUCKET_COPY[bucket]
    name = profile["names"][(seq - 1) % len(profile["names"])]
    summary = profile["summaries"][(seq - 1) % len(profile["summaries"])]
    return name, summary, profile["description"]


def build_partition(seq: int, sector: dict, landuse_polygons: dict[str, list[Polygon]]) -> dict:
    dominant_landuse, landuse_mix_score, landuse_source, overlap_by_landuse = analyze_landuse(sector, landuse_polygons)
    polygon = polygon_from_coords(sector.get("coords") or [], sector.get("holes") or [])
    area_m2 = scaled_area_m2(polygon) if polygon is not None else 0.0
    bucket, theme_code, landuse_code, persona_tag = choose_bucket(dominant_landuse, area_m2, landuse_mix_score)
    texture_profile = choose_texture_profile(bucket, dominant_landuse, seq, area_m2)
    map_name, summary, description = choose_copy(bucket, seq)
    center_lat, center_lng = centroid(sector["coords"])

    return {
        "partition_key": f"{CITY_SLUG}.{DISTRICT_SLUG}.{DONG_SLUG}.primary.p{seq:03d}",
        "partition_seq": seq,
        "partition_stage": "primary",
        "partition_type": "sector",
        "source_layer": "road_split",
        "source_version": "v20",
        "map_name": map_name,
        "display_name": f"{map_name} [{seq:02d}]",
        "summary": summary,
        "description": description,
        "theme_code": theme_code,
        "landuse_code": landuse_code,
        "dominant_landuse": dominant_landuse,
        "persona_tag": persona_tag,
        "texture_profile": texture_profile,
        "is_road": bucket == "route_node",
        "is_walkable": True,
        "area_m2": round(area_m2, 2),
        "landuse_mix_score": landuse_mix_score,
        "centroid_lat": center_lat,
        "centroid_lng": center_lng,
        "boundary_geojson": polygon_to_geojson(sector["coords"], sector.get("holes")),
        "source_feature": sector,
        "gameplay_meta": {
            "bucket": bucket,
            "draft_status": "fantasy_seeded",
            "naming_status": "ai_style_draft",
            "persona_tag": persona_tag,
            "area_m2": round(area_m2, 2),
            "dominant_landuse": dominant_landuse,
            "landuse_mix_score": landuse_mix_score,
            "landuse_source": landuse_source,
            "landuse_overlap_m2": overlap_by_landuse,
            "region_tone": map_name,
            "encounter_hint": (
                "ranged_patrol" if bucket == "river_edge"
                else "grove_rest" if bucket == "green_buffer"
                else "rest_quest" if bucket == "campus_buffer"
                else "route_control" if bucket == "route_node"
                else "boss_or_event" if bucket == "special_poi"
                else "civilian_skirmish"
            ),
        },
    }


def normalize_centroids(partitions: list[dict]) -> tuple[float, float, float, float]:
    lats = [partition["centroid_lat"] for partition in partitions]
    lngs = [partition["centroid_lng"] for partition in partitions]
    return min(lats), max(lats), min(lngs), max(lngs)


def select_grid_size(partition_count: int) -> tuple[int, int]:
    if partition_count >= 180:
        return 4, 6
    if partition_count >= 120:
        return 4, 5
    return 3, 4


def region_suffix(row_idx: int, col_idx: int, rows: int, cols: int) -> str:
    vertical = "북측" if row_idx == 0 else "중앙" if row_idx < rows - 1 else "남측"
    horizontal = "서편" if col_idx == 0 else "중앙" if col_idx < cols - 1 else "동편"
    return f"{vertical} {horizontal}"


def build_group_name(group_theme_code: str, group_seq: int, row_idx: int, col_idx: int, rows: int, cols: int) -> str:
    names = GROUP_THEME_TEMPLATES.get(group_theme_code) or GROUP_THEME_TEMPLATES["urban_fantasy_residential"]
    base = names[(group_seq - 1) % len(names)]
    return f"{base} {region_suffix(row_idx, col_idx, rows, cols)}"


def assign_groups(partitions: list[dict]) -> list[dict]:
    min_lat, max_lat, min_lng, max_lng = normalize_centroids(partitions)
    lat_span = max(max_lat - min_lat, 0.000001)
    lng_span = max(max_lng - min_lng, 0.000001)
    cols, rows = select_grid_size(len(partitions))

    buckets: dict[tuple[int, int], list[dict]] = defaultdict(list)
    for partition in partitions:
        lat_ratio = (partition["centroid_lat"] - min_lat) / lat_span
        lng_ratio = (partition["centroid_lng"] - min_lng) / lng_span
        row_idx = min(rows - 1, max(0, rows - 1 - floor(lat_ratio * rows)))
        col_idx = min(cols - 1, max(0, floor(lng_ratio * cols)))
        buckets[(row_idx, col_idx)].append(partition)

    group_seq = 1
    for row_idx in range(rows):
        for col_idx in range(cols):
            members = buckets.get((row_idx, col_idx))
            if not members:
                continue

            theme_counter = Counter(member["theme_code"] for member in members if member.get("theme_code"))
            dominant_theme = theme_counter.most_common(1)[0][0] if theme_counter else "urban_fantasy_residential"
            group_key = f"{CITY_SLUG}.{DISTRICT_SLUG}.{DONG_SLUG}.group.g{group_seq:02d}"
            group_name = build_group_name(dominant_theme, group_seq, row_idx, col_idx, rows, cols)

            for member in members:
                member["group_key"] = group_key
                member["group_seq"] = group_seq
                member["group_display_name"] = group_name
                member["group_theme_code"] = dominant_theme
                member.setdefault("gameplay_meta", {})
                member["gameplay_meta"]["group_key"] = group_key
                member["gameplay_meta"]["group_seq"] = group_seq
                member["gameplay_meta"]["group_display_name"] = group_name
                member["gameplay_meta"]["group_theme_code"] = dominant_theme

            group_seq += 1

    return partitions


def main() -> None:
    cache_data = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    sectors = cache_data["zones"].get("sectors") or []
    landuse_polygons = build_landuse_polygons(cache_data["zones"])

    partitions = [build_partition(index, sector, landuse_polygons) for index, sector in enumerate(sectors, start=1)]
    partitions = assign_groups(partitions)

    seed_data = {
        "meta": {
            "city": CITY_NAME,
            "city_slug": CITY_SLUG,
            "district": DISTRICT_NAME,
            "district_slug": DISTRICT_SLUG,
            "dong": DONG_NAME,
            "dong_slug": DONG_SLUG,
            "dong_osm_id": DONG_OSM_ID,
            "source_cache": "back/cache/zones/v20_dong_3879477.json",
            "primary_partition_count": len(partitions),
            "group_count": len({partition["group_key"] for partition in partitions}),
            "note": f"v20 pure road-split sectors regenerated for {DONG_NAME} with grouped play regions.",
        },
        "partitions": partitions,
    }

    SEED_PATH.write_text(json.dumps(seed_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"Rebuilt fantasy seed with {len(partitions)} partitions and "
        f"{seed_data['meta']['group_count']} groups: {SEED_PATH}"
    )


if __name__ == "__main__":
    main()
