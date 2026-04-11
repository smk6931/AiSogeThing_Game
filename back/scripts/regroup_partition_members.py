"""
world_partition_group_member 재배치 스크립트 v4
— Voronoi 초기 배정 + 단절 컴포넌트 수정 (연속 덩어리 보장)

알고리즘:
  Phase 1: 각 파티션을 가장 가까운 그룹 centroid에 배정 (Voronoi)
  Phase 2: 그룹별 연결 컴포넌트 BFS 확인 → 단절된 파티션은 인접한 다른 그룹으로 재배정
  반복:    Phase 2를 최대 5회 반복하여 완전히 연결될 때까지 수렴

사용법:
  python back/scripts/regroup_partition_members.py --dong-osm-id 3879474 [--dry-run]
"""

import asyncio
import argparse
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

# Windows 콘솔 CP949 환경에서 한글 깨짐 방지
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parents[2]
BACK_DIR = ROOT_DIR / "back"
if str(BACK_DIR) not in sys.path:
    sys.path.append(str(BACK_DIR))

from sqlalchemy import text
from core.database import async_session_factory

LAT_TO_M = 111000
LNG_TO_M = 88000
ADJ_BUFFER_DEG = 0.00005   # ~5m 버퍼로 인접 판단
MAX_REASSIGN_M = 150        # 단절 파티션 재배정 시 인접 파티션까지 허용 거리
ROAD_THEME_CODES = {"ancient_stone_route", "road", "urban_road"}


def dist_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    return math.sqrt(((lat1 - lat2) * LAT_TO_M) ** 2 + ((lng1 - lng2) * LNG_TO_M) ** 2)


def build_adjacency(partitions: list[dict]) -> dict[int, set[int]]:
    """Shapely로 실제로 붙어있는 파티션 쌍을 구한다."""
    try:
        from shapely.geometry import shape
    except ImportError:
        print("[WARN] shapely 없음 → centroid 거리 120m 이하로 adjacency 근사")
        return _build_adjacency_fallback(partitions)

    geoms: dict[int, object] = {}
    for p in partitions:
        raw = p.get("boundary_geojson")
        if not raw:
            continue
        try:
            geom = shape(raw) if isinstance(raw, dict) else shape(json.loads(raw))
            geoms[p["id"]] = geom.buffer(ADJ_BUFFER_DEG)
        except Exception:
            pass

    adj: dict[int, set[int]] = defaultdict(set)
    ids = list(geoms.keys())
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            if geoms[ids[i]].intersects(geoms[ids[j]]):
                adj[ids[i]].add(ids[j])
                adj[ids[j]].add(ids[i])

    total_edges = sum(len(v) for v in adj.values()) // 2
    print(f"[ADJ] 인접 엣지 {total_edges}개 계산 완료 (Shapely)")
    return adj


def _build_adjacency_fallback(partitions: list[dict]) -> dict[int, set[int]]:
    FALLBACK_M = 120
    adj: dict[int, set[int]] = defaultdict(set)
    for i, a in enumerate(partitions):
        if not a.get("centroid_lat"):
            continue
        for b in partitions[i + 1:]:
            if not b.get("centroid_lat"):
                continue
            d = dist_m(a["centroid_lat"], a["centroid_lng"],
                       b["centroid_lat"], b["centroid_lng"])
            if d <= FALLBACK_M:
                adj[a["id"]].add(b["id"])
                adj[b["id"]].add(a["id"])
    total_edges = sum(len(v) for v in adj.values()) // 2
    print(f"[ADJ] 인접 엣지 {total_edges}개 계산 완료 (거리 근사)")
    return adj


def voronoi_assign(groups: list[dict], partitions: list[dict]) -> dict[int, int]:
    """Phase 1: 각 파티션을 가장 가까운 그룹 centroid에 배정 (순수 Voronoi)"""
    assignment: dict[int, int] = {}
    valid_groups = [g for g in groups if g.get("centroid_lat")]
    for p in partitions:
        p_lat = p.get("centroid_lat")
        p_lng = p.get("centroid_lng")
        if not p_lat or not p_lng:
            continue
        best = min(valid_groups,
                   key=lambda g: dist_m(p_lat, p_lng, g["centroid_lat"], g["centroid_lng"]))
        assignment[p["id"]] = best["id"]
    return assignment


def fix_disconnected(
    assignment: dict[int, int],
    partitions: list[dict],
    adj: dict[int, set[int]],
) -> tuple[dict[int, int], int]:
    """
    Phase 2: 각 그룹의 연결 컴포넌트를 BFS로 확인.
    가장 큰 컴포넌트만 해당 그룹으로 유지.
    단절된 작은 파티션들은 인접한 이웃 중 다른 그룹의 파티션이 있으면 그쪽으로 재배정.
    Returns: (updated_assignment, 재배정 수)
    """
    pid_map = {p["id"]: p for p in partitions}
    group_members: dict[int, list[int]] = defaultdict(list)
    for pid, gid in assignment.items():
        group_members[gid].append(pid)

    reassignment: dict[int, int] = {}
    total_fixed = 0

    for gid, members in group_members.items():
        member_set = set(members)
        visited: set[int] = set()
        components: list[list[int]] = []

        for start in members:
            if start in visited:
                continue
            component: list[int] = []
            queue = [start]
            visited.add(start)
            while queue:
                curr = queue.pop(0)
                component.append(curr)
                for nb in adj.get(curr, set()):
                    if nb in member_set and nb not in visited:
                        visited.add(nb)
                        queue.append(nb)
            components.append(component)

        if len(components) <= 1:
            continue  # 연결됨, 건너뜀

        # 가장 큰 컴포넌트 유지, 나머지 단절 파티션 재배정
        components.sort(key=len, reverse=True)
        main_component = set(components[0])

        for fragment in components[1:]:
            for pid in fragment:
                p = pid_map.get(pid)
                if not p or not p.get("centroid_lat"):
                    continue
                # 인접 파티션 중 다른 그룹에 속하면서
                # 그 그룹의 현재 멤버(main component)에 인접한 경우에만 이동
                best_gid = None
                best_d = float("inf")
                for nb_id in adj.get(pid, set()):
                    nb_gid = reassignment.get(nb_id) or assignment.get(nb_id)
                    if not nb_gid or nb_gid == gid:
                        continue
                    nb = pid_map.get(nb_id)
                    if nb and nb.get("centroid_lat"):
                        d = dist_m(p["centroid_lat"], p["centroid_lng"],
                                   nb["centroid_lat"], nb["centroid_lng"])
                        # MAX_REASSIGN_M 이하인 경우만 재배정 (연쇄 확장 방지)
                        if d < best_d and d <= MAX_REASSIGN_M:
                            best_d = d
                            best_gid = nb_gid
                if best_gid:
                    reassignment[pid] = best_gid
                    total_fixed += 1

    assignment.update(reassignment)
    return assignment, total_fixed


def group_and_fix(
    groups: list[dict],
    partitions: list[dict],
    adj: dict[int, set[int]],
    road: bool,
) -> dict[int, int]:
    """Voronoi + 반복 단절 수정으로 연속 덩어리 보장"""
    if road:
        target_groups = [g for g in groups if g.get("theme_code") in ROAD_THEME_CODES]
        target_partitions = [p for p in partitions if p.get("is_road")]
    else:
        target_groups = [g for g in groups if g.get("theme_code") not in ROAD_THEME_CODES]
        target_partitions = [p for p in partitions if not p.get("is_road")]

    if not target_groups or not target_partitions:
        return {}

    # Phase 1: Voronoi 초기 배정
    assignment = voronoi_assign(target_groups, target_partitions)

    # Phase 2: 단절 수정 (최대 5회 반복 수렴)
    for iteration in range(5):
        assignment, fixed = fix_disconnected(assignment, target_partitions, adj)
        if fixed:
            print(f"  [단절 수정 {iteration + 1}회차] {fixed}개 재배정")
        else:
            break

    return assignment


async def regroup(dong_osm_id: int, dry_run: bool = False) -> None:
    async with async_session_factory() as session:
        area_row = await session.execute(
            text("SELECT id FROM world_area WHERE osm_id = :osm_id AND area_level = 'dong' LIMIT 1"),
            {"osm_id": dong_osm_id},
        )
        area = area_row.mappings().first()
        if not area:
            print(f"[ERROR] dong osm_id={dong_osm_id} not found")
            return
        admin_area_id = area["id"]

        # 파티션 로드 (boundary_geojson 포함)
        partition_rows = await session.execute(
            text("""
                SELECT id, partition_seq, theme_code, dominant_landuse,
                       is_road, area_m2, centroid_lat, centroid_lng, boundary_geojson
                FROM world_partition
                WHERE admin_area_id = :admin_area_id
                ORDER BY partition_seq
            """),
            {"admin_area_id": admin_area_id},
        )
        partitions = [dict(r) for r in partition_rows.mappings()]
        n_road = sum(1 for p in partitions if p["is_road"])
        print(f"[INFO] {len(partitions)}개 파티션 (비도로={len(partitions)-n_road}, 도로={n_road})")

        # 그룹 로드
        group_rows = await session.execute(
            text("""
                SELECT id, group_key, theme_code, centroid_lat, centroid_lng
                FROM world_partition_group
                WHERE admin_area_id = :admin_area_id
                ORDER BY group_seq
            """),
            {"admin_area_id": admin_area_id},
        )
        groups = [dict(r) for r in group_rows.mappings()]
        print(f"[INFO] {len(groups)}개 그룹 (centroid 있음: {sum(1 for g in groups if g['centroid_lat'])}개)")

        # 인접성 그래프 구축
        print("[INFO] 인접성 그래프 계산 중...")
        adj = build_adjacency(partitions)

        # 비도로 / 도로 각각 배정
        print("[INFO] 비도로 파티션 배정 중...")
        non_road_assignment = group_and_fix(groups, partitions, adj, road=False)
        print("[INFO] 도로 파티션 배정 중...")
        road_assignment = group_and_fix(groups, partitions, adj, road=True)

        partition_to_group = {**non_road_assignment, **road_assignment}
        unmapped = len(partitions) - len(partition_to_group)
        print(f"[INFO] 배정 완료. 미배정={unmapped}개")

        # 결과 통계 출력
        group_members: dict[int, list[int]] = defaultdict(list)
        for pid, gid in partition_to_group.items():
            group_members[gid].append(pid)

        pid_map = {p["id"]: p for p in partitions}

        print("\n[RESULT] 그룹별 배정 결과:")
        for g in groups:
            members = group_members.get(g["id"], [])
            if not members:
                continue
            lats = [pid_map[m]["centroid_lat"] for m in members if pid_map[m].get("centroid_lat")]
            lngs = [pid_map[m]["centroid_lng"] for m in members if pid_map[m].get("centroid_lng")]
            if lats:
                lat_span = (max(lats) - min(lats)) * LAT_TO_M
                lng_span = (max(lngs) - min(lngs)) * LNG_TO_M
                cx = sum(lats) / len(lats)
                cy = sum(lngs) / len(lngs)
                max_r = max(dist_m(cx, cy, la, ln) for la, ln in zip(lats, lngs)) if len(lats) > 1 else 0
            else:
                lat_span = lng_span = max_r = 0
            gk = g["group_key"].split(".")[-1]
            road_tag = "[road]" if g.get("theme_code") in ROAD_THEME_CODES else ""
            print(f"  [{gk}]{road_tag} {len(members):3d}개 | {lat_span:.0f}x{lng_span:.0f}m | max_r={max_r:.0f}m")

        if dry_run:
            print("\n[DRY-RUN] DB 변경 없음.")
            return

        # DB 갱신
        print("\n[UPDATE] world_partition_group_member 갱신 중...")
        partition_ids = [p["id"] for p in partitions]
        await session.execute(
            text("DELETE FROM world_partition_group_member WHERE partition_id = ANY(:ids)"),
            {"ids": partition_ids},
        )

        max_id_row = await session.execute(
            text("SELECT COALESCE(MAX(id), 0) FROM world_partition_group_member")
        )
        next_id = max_id_row.scalar() + 1
        member_order_counter: dict[int, int] = defaultdict(int)
        insert_count = 0

        for p in partitions:
            group_id = partition_to_group.get(p["id"])
            if not group_id:
                continue
            member_order_counter[group_id] += 1
            role = "road" if p.get("is_road") else "level"
            await session.execute(
                text("""
                    INSERT INTO world_partition_group_member
                        (id, group_id, partition_id, member_order, member_role, weight)
                    VALUES (:id, :group_id, :partition_id, :member_order, :member_role, :weight)
                    ON CONFLICT ON CONSTRAINT uq_world_partition_group_member_group_partition DO UPDATE
                        SET member_order = EXCLUDED.member_order,
                            member_role  = EXCLUDED.member_role,
                            weight       = EXCLUDED.weight
                """),
                {
                    "id": next_id,
                    "group_id": group_id,
                    "partition_id": p["id"],
                    "member_order": member_order_counter[group_id],
                    "member_role": role,
                    "weight": p.get("area_m2") or 0.0,
                },
            )
            next_id += 1
            insert_count += 1

        await session.commit()
        print(f"[DONE] 완료. {insert_count}개 멤버 삽입.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dong-osm-id", type=int, required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(regroup(dong_osm_id=args.dong_osm_id, dry_run=args.dry_run))
