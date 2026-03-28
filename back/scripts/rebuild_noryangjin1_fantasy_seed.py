import json
from collections import Counter, defaultdict
from math import cos, floor, radians
from pathlib import Path

from shapely.geometry import Polygon


ROOT_DIR = Path(__file__).resolve().parents[2]
SEED_PATH = ROOT_DIR / "back" / "world" / "data" / "noryangjin1_level_partition_seed.json"
CACHE_PATH = ROOT_DIR / "back" / "cache" / "zones" / "v20_dong_3879474.json"

CITY_NAME = "서울특별시"
DISTRICT_NAME = "동작구"
DONG_NAME = "노량진1동"
DONG_OSM_ID = 3879474

RIVER_NAMES = ["서리나루", "유리강 언덕", "달서리 둔덕", "은안개 제방", "별물결 초소", "청광 나루터"]
RIVER_SUMMARIES = [
    "한강과 맞닿은 냉기 수변 파티션",
    "개방 시야와 원거리 견제가 강한 강변 파티션",
    "수변 순찰과 기동전 연출에 어울리는 외곽 파티션",
]

GREEN_NAMES = ["청목 정원권", "비취뜰 완충권", "성역뜰 완충지", "서고숲 경계지", "바람숲 공터", "잔광 수풀지"]
GREEN_SUMMARIES = [
    "녹지와 완충지대 감성이 강한 파티션",
    "휴식과 탐색 템포를 살리기 좋은 녹색 파티션",
    "생활권과 자연지형이 맞물리는 완충 파티션",
]

CAMPUS_NAMES = ["학인의 뜰", "기원의 뜰목", "조용한 서원가", "별씨앗 공터", "은문 학당길", "청서정 마당"]
CAMPUS_SUMMARIES = [
    "학교와 학당 분위기가 남아 있는 파티션",
    "생활권 사이에서 탐색 감각을 만드는 완충 파티션",
    "성역과 학당의 기운을 덧입힌 판타지형 파티션",
]

LIVING_NAMES = ["등불골 거주지", "안개등 골목권", "노을문 주거지", "고요샘 생활권", "은촉 거리권", "서민달 주거권"]
LIVING_SUMMARIES = [
    "생활 흔적과 소규모 모험이 섞이는 주거 중심 파티션",
    "NPC 일상과 근거리 교전이 어울리는 생활권 파티션",
    "서울 골목의 결을 판타지 톤으로 재해석한 파티션",
]

ROUTE_NAMES = ["청동문 교차로", "룬석 통행로", "월광석 길목", "회랑의 모서리", "은맥 분기점", "등불 회차로"]
ROUTE_SUMMARIES = [
    "이동선과 우회선이 갈라지는 연결 파티션",
    "오브젝트와 순찰 몬스터 배치에 적합한 길목 파티션",
    "도심 흐름과 교전 템포를 제어하는 경로형 파티션",
]

SPECIAL_NAMES = ["숨은 성소터", "망각의 공터", "결계 틈새", "붉은 종루 아래", "별조각 광장", "환영 우물터"]
SPECIAL_SUMMARIES = [
    "특수 이벤트와 희귀 조우를 넣기 좋은 파티션",
    "일상 구조에서 벗어난 긴장감이 도는 특수 파티션",
    "추후 수동 레벨디자인으로 강하게 살릴 여지가 큰 파티션",
]

GROUP_THEME_TEMPLATES = {
    "frozen_riverfront": ["서리 제방권", "빙류 외곽권", "나루 수문권", "청광 수변권"],
    "sanctuary_green": ["성역 숲권", "완충 녹원권", "비취 수풀권", "청목 완충권"],
    "academy_sanctum": ["학당 완충권", "서원 경계권", "기원의 뜰권", "청서 학림권"],
    "urban_fantasy_residential": ["등불 생활권", "안개 골목권", "노을 주거권", "은촉 살림권"],
    "ancient_stone_route": ["청동 길목권", "룬 교차권", "은맥 연결권", "회랑 통행권"],
    "event_pocket": ["결계 특이권", "유물 잠복권", "환영 사건권", "성소 공터권"],
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
        return "pond_meadow_01" if area_m2 < 2500 else "cliff_meadow_01"
    if bucket == "campus_buffer":
        return "sanctuary_trail_01" if seq % 2 else "academy_ruin_yard_01"
    if bucket == "route_node":
        if area_m2 < 600:
            return "stone_route_trim"
        return "sunlit_stone_route_01" if seq % 2 else "sunlit_stone_route_02"
    if bucket == "special_poi":
        return "arcane_floor_01" if seq % 2 else "arcane_floor_02"
    if dominant_landuse == "residential":
        if area_m2 > 3500:
            return "village_square_01"
        return "village_square_01" if seq % 2 else "cliff_meadow_01"
    return "forest_path_02"


def choose_copy(bucket: str, seq: int) -> tuple[str, str, str]:
    if bucket == "river_edge":
        name = RIVER_NAMES[(seq - 1) % len(RIVER_NAMES)]
        summary = RIVER_SUMMARIES[(seq - 1) % len(RIVER_SUMMARIES)]
        description = "한강 변의 냉기와 광휘가 겹쳐지는 수변 파티션이다. 개방 시야와 순찰형 조우 연출에 적합하다."
        return name, summary, description
    if bucket == "green_buffer":
        name = GREEN_NAMES[(seq - 1) % len(GREEN_NAMES)]
        summary = GREEN_SUMMARIES[(seq - 1) % len(GREEN_SUMMARIES)]
        description = "녹지와 완충지대의 결이 강한 파티션이다. 휴식, 탐색, 숲 경계형 오브젝트 배치에 어울린다."
        return name, summary, description
    if bucket == "campus_buffer":
        name = CAMPUS_NAMES[(seq - 1) % len(CAMPUS_NAMES)]
        summary = CAMPUS_SUMMARIES[(seq - 1) % len(CAMPUS_SUMMARIES)]
        description = "학교와 학당의 분위기가 남아 있는 파티션이다. 생활권과 탐색 구간 사이의 완충지대로 쓰기 좋다."
        return name, summary, description
    if bucket == "route_node":
        name = ROUTE_NAMES[(seq - 1) % len(ROUTE_NAMES)]
        summary = ROUTE_SUMMARIES[(seq - 1) % len(ROUTE_SUMMARIES)]
        description = "도로 분할로 만들어진 연결형 파티션이다. 교차점, 순찰 루트, 교전 흐름 제어용 공간으로 적합하다."
        return name, summary, description
    if bucket == "special_poi":
        name = SPECIAL_NAMES[(seq - 1) % len(SPECIAL_NAMES)]
        summary = SPECIAL_SUMMARIES[(seq - 1) % len(SPECIAL_SUMMARIES)]
        description = "현실 지형 위에 특수 이벤트 감성을 얹기 좋은 파티션이다. 포털, 희귀 NPC, 미니보스 후보 공간으로 확장하기 쉽다."
        return name, summary, description

    name = LIVING_NAMES[(seq - 1) % len(LIVING_NAMES)]
    summary = LIVING_SUMMARIES[(seq - 1) % len(LIVING_SUMMARIES)]
    description = "노량진 생활권의 골목과 주거 밀도를 바탕으로 한 파티션이다. NPC 일상, 근거리 교전, 생활형 오브젝트 연출에 적합하다."
    return name, summary, description


def build_partition(seq: int, sector: dict, landuse_polygons: dict[str, list[Polygon]]) -> dict:
    dominant_landuse, landuse_mix_score, landuse_source, overlap_by_landuse = analyze_landuse(sector, landuse_polygons)
    polygon = polygon_from_coords(sector.get("coords") or [], sector.get("holes") or [])
    area_m2 = scaled_area_m2(polygon) if polygon is not None else 0.0
    bucket, theme_code, landuse_code, persona_tag = choose_bucket(dominant_landuse, area_m2, landuse_mix_score)
    texture_profile = choose_texture_profile(bucket, dominant_landuse, seq, area_m2)
    map_name, summary, description = choose_copy(bucket, seq)
    center_lat, center_lng = centroid(sector["coords"])

    return {
        "partition_key": f"seoul.dongjak.noryangjin1.primary.p{seq:03d}",
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
    vertical = "북부" if row_idx == 0 else "중부" if row_idx < rows - 1 else "남부"
    horizontal = "서측" if col_idx == 0 else "중앙" if col_idx < cols - 1 else "동측"
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
            group_key = f"seoul.dongjak.noryangjin1.group.g{group_seq:02d}"
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
            "district": DISTRICT_NAME,
            "dong": DONG_NAME,
            "dong_osm_id": DONG_OSM_ID,
            "source_cache": "back/cache/zones/v20_dong_3879474.json",
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
