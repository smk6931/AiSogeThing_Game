import json
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
SEED_PATH = ROOT_DIR / "back" / "world" / "data" / "noryangjin1_level_partition_seed.json"
CACHE_PATH = ROOT_DIR / "back" / "cache" / "zones" / "v20_dong_3879474.json"


RIVER_NAMES = [
    "서리나루 전망대",
    "유리강 언덕",
    "달서리 둔덕",
    "은안개 제방",
    "별물결 초소",
    "빙류 감시처",
    "청광 나루터",
    "물안개 성루",
    "서풍 부두턱",
    "백파도 외곽",
]
RIVER_SUMMARIES = [
    "한강 바람과 마력이 겹치는 외곽 수변 파티션",
    "개방 시야와 냉기 잔광이 도는 강변 경계 파티션",
    "수변 순찰과 원거리 교전이 어울리는 외연 파티션",
]

RESIDENTIAL_NAMES = [
    "등불골 거주지",
    "안개등 골목권",
    "노을문 주거지",
    "고요샘 생활권",
    "은촉 거리권",
    "서민달 주거권",
    "비단별 마을길",
    "잔광 골목진",
    "벽등 주택권",
    "달빛살림 구역",
]
RESIDENTIAL_SUMMARIES = [
    "생활 흔적과 소규모 모험이 섞이는 주거 중심 파티션",
    "NPC 일상, 소규모 사건, 근거리 교전이 어울리는 주거 파티션",
    "서울 골목의 결을 살리되 판타지 생활권 감성을 입힌 중심 파티션",
]

CAMPUS_NAMES = [
    "성역뜰 완충지",
    "서고숲 경계지",
    "학인의 뜰",
    "청목 정원권",
    "기원의 뜰목",
    "별씨앗 공터",
    "조용한 서원가",
    "비취뜰 완충권",
]
CAMPUS_SUMMARIES = [
    "학교와 녹지의 성격이 겹치는 완충 파티션",
    "전투 템포를 늦추고 탐색 감각을 살리는 휴식형 파티션",
    "성역과 학당의 기운이 엷게 남아 있는 완충 파티션",
]

ROUTE_NAMES = [
    "월광석 길목",
    "청동문 교차로",
    "룬석 통행로",
    "회랑의 모서리",
    "바람깃 연결로",
    "은맥 분기점",
    "등불 회차로",
    "서리비탈 길목",
]
ROUTE_SUMMARIES = [
    "내부 동선과 교전 흐름을 제어하는 연결 파티션",
    "주요 이동선과 우회선이 갈라지는 판타지형 길목 파티션",
    "오브젝트와 순찰 몬스터 배치에 적합한 경로 중심 파티션",
]

SPECIAL_NAMES = [
    "숨은 성소터",
    "망각의 공터",
    "결계 틈새",
    "붉은 종루 아래",
    "별조각 광장",
    "환영 우물터",
    "은폐된 제단지",
    "유물 매복지",
]
SPECIAL_SUMMARIES = [
    "이벤트, 희귀 NPC, 포털, 미니보스 배치를 고려할 수 있는 특수 파티션",
    "일상 구조에서 벗어난 긴장감과 발견감을 주는 특수 후보 파티션",
    "추후 수동 레벨디자인으로 강하게 개성화할 가치가 큰 특수 파티션",
]


def polygon_to_geojson(coords: list[list[float]], holes: list[list[list[float]]] | None = None) -> dict:
    ring = [[lng, lat] for lat, lng in coords]
    hole_rings = []
    for hole in holes or []:
        hole_rings.append([[lng, lat] for lat, lng in hole])
    return {
        "type": "Polygon",
        "coordinates": [ring, *hole_rings],
    }


def centroid(coords: list[list[float]]) -> tuple[float, float]:
    lat_sum = sum(point[0] for point in coords[:-1] if coords)
    lng_sum = sum(point[1] for point in coords[:-1] if coords)
    count = max(len(coords) - 1, 1)
    return round(lat_sum / count, 6), round(lng_sum / count, 6)


def choose_theme(seq: int) -> tuple[str, str, str, str, bool]:
    if seq <= 20:
        return "river_edge", "frozen_riverfront", "waterfront_mixed", "frozen_bank", False
    if seq <= 40:
        return "residential_core", "urban_fantasy_residential", "residential", "dense_block_ground", False
    if seq <= 55:
        return "campus_buffer", "sanctuary_green", "educational_park_mix", "green_courtyard", False
    if seq <= 70:
        return "inner_route", "ancient_stone_route", "road_link", "fantasy_stone_road", True
    return "special_poi", "event_pocket", "special", "event_surface", False


def choose_copy(bucket: str, seq: int) -> tuple[str, str, str]:
    if bucket == "river_edge":
        name = RIVER_NAMES[(seq - 1) % len(RIVER_NAMES)]
        summary = RIVER_SUMMARIES[(seq - 1) % len(RIVER_SUMMARIES)]
        description = (
            "한강 기슭의 현실 지형 위에 냉기와 광휘가 겹쳐진 수변 파티션. "
            "시야가 넓고 바람이 강해 원거리 견제, 순찰형 몬스터, 강변 경계 오브젝트 배치에 어울린다."
        )
        return name, summary, description
    if bucket == "residential_core":
        name = RESIDENTIAL_NAMES[(seq - 21) % len(RESIDENTIAL_NAMES)]
        summary = RESIDENTIAL_SUMMARIES[(seq - 21) % len(RESIDENTIAL_SUMMARIES)]
        description = (
            "노량진의 생활권 구조를 바탕으로 한 골목형 파티션. "
            "작은 상점, 민가형 소품, 생활형 NPC, 근접 전투와 추격전 연출에 적합하다."
        )
        return name, summary, description
    if bucket == "campus_buffer":
        name = CAMPUS_NAMES[(seq - 41) % len(CAMPUS_NAMES)]
        summary = CAMPUS_SUMMARIES[(seq - 41) % len(CAMPUS_SUMMARIES)]
        description = (
            "학교와 녹지 경계의 실제 도시 리듬 위에 성역 감성을 덧입힌 완충 파티션. "
            "회복 지점, 퀘스트 허브, 저위험 탐색 구간으로 전개하기 좋다."
        )
        return name, summary, description
    if bucket == "inner_route":
        name = ROUTE_NAMES[(seq - 56) % len(ROUTE_NAMES)]
        summary = ROUTE_SUMMARIES[(seq - 56) % len(ROUTE_SUMMARIES)]
        description = (
            "도로 분할로 형성된 이동 중심 파티션. "
            "플레이어 유도, 순찰 루트, 길목 오브젝트, 소규모 매복 전투를 설계하기 쉬운 축선이다."
        )
        return name, summary, description
    name = SPECIAL_NAMES[(seq - 71) % len(SPECIAL_NAMES)]
    summary = SPECIAL_SUMMARIES[(seq - 71) % len(SPECIAL_SUMMARIES)]
    description = (
        "현실 지형의 틈 위에 판타지적 의미를 강하게 부여할 수 있는 특수 파티션. "
        "희귀 몬스터, 비밀 상인, 포털, 미니보스, 지역 이벤트 중심축으로 발전시킬 수 있다."
    )
    return name, summary, description


def main() -> None:
    seed_data = json.loads(SEED_PATH.read_text(encoding="utf-8-sig"))
    cache_data = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    sectors = cache_data["zones"]["sectors"]

    rebuilt = []
    for index, partition in enumerate(seed_data["partitions"], start=1):
        sector = sectors[index - 1]
        bucket, theme_code, landuse_code, texture_profile, is_road = choose_theme(index)
        title, summary, description = choose_copy(bucket, index)
        center_lat, center_lng = centroid(sector["coords"])

        partition["map_name"] = title
        partition["display_name"] = f"{title} [{index:02d}]"
        partition["summary"] = summary
        partition["description"] = description
        partition["theme_code"] = theme_code
        partition["landuse_code"] = landuse_code
        partition["texture_profile"] = texture_profile
        partition["is_road"] = is_road
        partition["boundary_geojson"] = polygon_to_geojson(sector["coords"], sector.get("holes"))
        partition["source_feature"] = sector
        partition["centroid_lat"] = center_lat
        partition["centroid_lng"] = center_lng
        partition["gameplay_meta"] = {
            "bucket": bucket,
            "draft_status": "fantasy_seeded",
            "naming_status": "ai_style_draft",
            "region_tone": title,
            "encounter_hint": (
                "ranged_patrol" if bucket == "river_edge"
                else "civilian_skirmish" if bucket == "residential_core"
                else "rest_quest" if bucket == "campus_buffer"
                else "route_control" if bucket == "inner_route"
                else "boss_or_event"
            ),
        }
        rebuilt.append(partition)

    seed_data["partitions"] = rebuilt
    seed_data["meta"]["note"] = (
        "v20 Sector Plot 기준 81개. 서울 실지형을 바탕으로 판타지 RPG 감성 제목/설명/경계 메타를 포함한 재생성본."
    )
    SEED_PATH.write_text(json.dumps(seed_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Rebuilt fantasy seed: {SEED_PATH}")


if __name__ == "__main__":
    main()

