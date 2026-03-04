"""
district_service.py
서울시 25개 구(행정구역) 경계 데이터 관리 서비스.
- Overpass API에서 admin_level=6 (구 단위) 경계 패치
- back/cache/seoul_districts.json 에 영구 캐시
- 캐릭터 GPS 좌표 → 현재 구 판별 (Ray-casting PIP)
"""

import urllib.request
import urllib.parse
import json
import os
import time

CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "cache", "districts")
DISTRICT_CACHE_FILE = os.path.join(CACHE_DIR, "seoul_districts.json")
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

# Overpass에서 서울 25구 관계 경계를 가져오는 쿼리
# admin_level=6 in South Korea = 구(gu) 단위
OVERPASS_QUERY = """
[out:json][timeout:90];
area["name"="서울특별시"]["admin_level"="4"]->.seoul;
(
  relation["admin_level"="6"](area.seoul);
);
out body;
>;
out skel qt;
"""


def fetch_seoul_districts(force_refresh: bool = False) -> dict:
    """
    서울시 25개 구 행정 경계를 Overpass API에서 가져와 영구 캐시합니다.
    한 번 캐시되면 재시작해도 파일에서 즉시 로드합니다.
    """
    os.makedirs(CACHE_DIR, exist_ok=True)

    # 기존 캐시 확인 (force_refresh 아닐 경우)
    if not force_refresh and os.path.exists(DISTRICT_CACHE_FILE):
        try:
            with open(DISTRICT_CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if data.get("districts"):
                print(f"[DistrictService] 캐시 로드: {len(data['districts'])}개 구")
                return data
        except Exception as e:
            print(f"[DistrictService] 캐시 읽기 오류, 재패치: {e}")

    print("[DistrictService] Overpass API에서 서울 구 경계 패치 중...")

    raw = None
    for mirror in OVERPASS_MIRRORS:
        try:
            data_encoded = urllib.parse.urlencode({"data": OVERPASS_QUERY}).encode("utf-8")
            req = urllib.request.Request(mirror, data=data_encoded)
            req.add_header("User-Agent", "SeoulDistrictService/1.0 (game-project)")
            with urllib.request.urlopen(req, timeout=90) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
            print(f"[DistrictService] 미러 성공: {mirror}")
            break
        except Exception as e:
            print(f"[DistrictService] 미러 실패({mirror}): {e}")
            time.sleep(1)

    if raw is None:
        print("[DistrictService] 모든 미러 실패 - 빈 데이터 반환")
        return {"districts": [], "error": "All Overpass mirrors failed"}

    districts = _parse_district_response(raw)

    result = {
        "districts": districts,
        "fetched_at": time.time(),
        "count": len(districts)
    }

    try:
        with open(DISTRICT_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"[DistrictService] {len(districts)}개 구 경계 캐시 저장 완료")
    except Exception as e:
        print(f"[DistrictService] 캐시 저장 오류: {e}")

    return result


def _parse_district_response(data: dict) -> list:
    """Overpass 응답 → 구별 폴리곤 배열로 변환"""
    nodes = {}
    ways_map = {}
    relations = []

    for elem in data.get("elements", []):
        etype = elem.get("type")
        eid = elem.get("id")
        if etype == "node":
            nodes[eid] = (elem["lat"], elem["lon"])
        elif etype == "way":
            ways_map[eid] = elem.get("nodes", [])
        elif etype == "relation":
            relations.append(elem)

    districts = []
    for rel in relations:
        tags = rel.get("tags", {})
        name_ko = tags.get("name", tags.get("name:ko", ""))
        name_en = tags.get("name:en", "")
        admin_level = tags.get("admin_level", "")

        # 구 단위(admin_level=6)만 처리
        if admin_level != "6":
            continue

        # outer 멤버 way들의 node ID 리스트 수집
        outer_ways = []
        for member in rel.get("members", []):
            if member.get("type") == "way" and member.get("role") == "outer":
                ref = member.get("ref")
                if ref in ways_map:
                    outer_ways.append(list(ways_map[ref]))

        if not outer_ways:
            continue

        # 길 이어붙이기 (Stitching)
        stitched_nodes = outer_ways.pop(0)

        while outer_ways:
            added = False
            for i, way in enumerate(outer_ways):
                if way[0] == stitched_nodes[-1]:
                    stitched_nodes.extend(way[1:])
                    outer_ways.pop(i)
                    added = True
                    break
                elif way[-1] == stitched_nodes[-1]:
                    stitched_nodes.extend(reversed(way[:-1]))
                    outer_ways.pop(i)
                    added = True
                    break
                elif way[-1] == stitched_nodes[0]:
                    stitched_nodes = way[:-1] + stitched_nodes
                    outer_ways.pop(i)
                    added = True
                    break
                elif way[0] == stitched_nodes[0]:
                    stitched_nodes = list(reversed(way[1:])) + stitched_nodes
                    outer_ways.pop(i)
                    added = True
                    break
            
            # 연결되는 선분이 없으면 강제로 남은 선분 중 첫 번째를 이어붙임 (섬, 섬 외부 경계 등 독립된 루프)
            if not added:
                stitched_nodes.extend(outer_ways.pop(0))

        outer_coords = []
        for nid in stitched_nodes:
            if nid in nodes:
                pt = list(nodes[nid])
                # 이전 점과 동일하면 스킵 (중복 제거)
                if not outer_coords or outer_coords[-1] != pt:
                    outer_coords.append(pt)

        if len(outer_coords) < 3:
            continue

        # 중심점 계산
        lat_avg = sum(c[0] for c in outer_coords) / len(outer_coords)
        lng_avg = sum(c[1] for c in outer_coords) / len(outer_coords)

        districts.append({
            "id": rel["id"],
            "name": name_ko,
            "name_en": name_en,
            "admin_level": admin_level,
            "center": [round(lat_avg, 6), round(lng_avg, 6)],
            "coords": outer_coords   # [[lat, lng], ...]
        })

    # 이름 기준 정렬
    districts.sort(key=lambda d: d["name"])
    return districts


def get_current_district(lat: float, lng: float) -> dict | None:
    """
    현재 GPS 좌표가 어느 구에 속하는지 반환합니다.
    Ray-casting 알고리즘으로 point-in-polygon 판별.
    """
    try:
        data = fetch_seoul_districts()
        for district in data.get("districts", []):
            if _point_in_polygon(lat, lng, district["coords"]):
                return {
                    "name": district["name"],
                    "name_en": district["name_en"],
                    "id": district["id"],
                    "center": district["center"]
                }
    except Exception as e:
        print(f"[DistrictService] 구 판별 오류: {e}")
    return None


def _point_in_polygon(lat: float, lng: float, polygon: list) -> bool:
    """Ray-casting 알고리즘: 점이 폴리곤 내부에 있으면 True"""
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        # polygon[i] = [lat, lng]
        yi, xi = polygon[i][0], polygon[i][1]
        yj, xj = polygon[j][0], polygon[j][1]
        if ((yi > lat) != (yj > lat)) and (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside
