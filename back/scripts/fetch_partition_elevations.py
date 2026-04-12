"""
파티션 centroid 고도 수집 스크립트 (OpenTopoData SRTM 30m)

사용법:
  python back/scripts/fetch_partition_elevations.py
  python back/scripts/fetch_partition_elevations.py --dong 용산구 --dry-run
  python back/scripts/fetch_partition_elevations.py --dong 노량진1동

동작:
  1. world_partition 테이블에서 elevation_m IS NULL 또는 = 0 인 파티션 로드
  2. centroid_lat / centroid_lng 기준 OpenTopoData SRTM 30m API 호출 (배치 100점)
  3. elevation_m 업데이트 (단위: m)

API 제한:
  - https://api.opentopodata.org/v1/srtm30m
  - 무료: 배치당 최대 100점, 초당 1요청 (1초 sleep 적용)
"""
import asyncio
import argparse
import sys
import time
import json
import urllib.request
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parents[2]
BACK_DIR = ROOT_DIR / "back"
if str(BACK_DIR) not in sys.path:
    sys.path.append(str(BACK_DIR))

from dotenv import load_dotenv
load_dotenv(BACK_DIR / ".env")

from core.database import fetch_all, execute

BATCH_SIZE = 100
SLEEP_SEC = 1.1  # API 초당 1요청 제한 — 약간 여유
ELEV_API = "https://api.opentopodata.org/v1/srtm30m"


def _fetch_elevations(locations: list[tuple[float, float]]) -> list[float | None]:
    """
    locations: [(lat, lng), ...]  최대 100개
    returns: [elevation_m or None, ...]  API 실패 시 None
    """
    loc_str = "|".join(f"{lat},{lng}" for lat, lng in locations)
    url = f"{ELEV_API}?locations={loc_str}"
    try:
        with urllib.request.urlopen(url, timeout=15) as res:
            data = json.loads(res.read())
        results = data.get("results", [])
        return [r.get("elevation") for r in results]
    except Exception as e:
        print(f"  [API 오류] {e}")
        return [None] * len(locations)


async def run(dong_name: str | None, dry_run: bool):
    # 1. 파티션 로드 (elevation_m NULL 또는 0인 것만)
    where = "WHERE (elevation_m IS NULL OR elevation_m = 0) AND centroid_lat IS NOT NULL AND centroid_lng IS NOT NULL"
    params: dict = {}
    if dong_name:
        where += " AND dong_name = :dong"
        params["dong"] = dong_name

    rows = await fetch_all(
        f"SELECT id, partition_key, centroid_lat, centroid_lng FROM world_partition {where} ORDER BY id",
        params,
    )
    print(f"대상 파티션: {len(rows)}개" + (f" (동: {dong_name})" if dong_name else ""))

    if not rows:
        print("처리할 파티션 없음.")
        return

    # 2. 배치 처리
    total_updated = 0
    total_failed = 0
    batches = [rows[i:i + BATCH_SIZE] for i in range(0, len(rows), BATCH_SIZE)]

    for batch_idx, batch in enumerate(batches):
        locations = [(r["centroid_lat"], r["centroid_lng"]) for r in batch]
        print(f"배치 {batch_idx + 1}/{len(batches)} ({len(batch)}개) 요청 중...", end=" ", flush=True)

        elevations = _fetch_elevations(locations)

        updated = 0
        failed = 0
        for row, elev in zip(batch, elevations):
            if elev is None:
                failed += 1
                continue
            if not dry_run:
                await execute(
                    "UPDATE world_partition SET elevation_m = :elev WHERE id = :id",
                    {"elev": float(elev), "id": row["id"]},
                )
            updated += 1

        total_updated += updated
        total_failed += failed
        print(f"완료 (업데이트: {updated}, 실패: {failed})")

        # 다음 배치 전 대기
        if batch_idx < len(batches) - 1:
            time.sleep(SLEEP_SEC)

    print(f"\n처리 완료 — 업데이트: {total_updated}, 실패: {total_failed}")
    if dry_run:
        print("[DRY-RUN] DB는 변경되지 않았습니다.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="파티션 centroid 고도 수집 (OpenTopoData SRTM)")
    parser.add_argument("--dong", type=str, default=None, help="특정 동 이름만 처리 (예: 노량진1동)")
    parser.add_argument("--dry-run", action="store_true", help="API만 호출, DB 업데이트 안 함")
    args = parser.parse_args()

    asyncio.run(run(dong_name=args.dong, dry_run=args.dry_run))
