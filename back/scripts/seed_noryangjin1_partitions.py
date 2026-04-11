import asyncio
import argparse
import json
from pathlib import Path
import sys

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

from sqlalchemy import text

ROOT_DIR = Path(__file__).resolve().parents[2]
BACK_DIR = ROOT_DIR / "back"
if str(BACK_DIR) not in sys.path:
    sys.path.append(str(BACK_DIR))

from core.database import async_session_factory
from world.services.district_service import fetch_seoul_districts, fetch_seoul_sub_districts

DEFAULT_SEED_PATH = ROOT_DIR / "back" / "world" / "data" / "noryangjin1_level_partition_seed.json"

CITY_SLUG_MAP = {
    "서울특별시": "seoul",
}

DISTRICT_SLUG_MAP = {
    "동작구": "dongjak",
}

DONG_SLUG_MAP = {
    "노량진1동": "noryangjin1",
    "노량진2동": "noryangjin2",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--seed",
        default=str(DEFAULT_SEED_PATH),
        help="Path to the partition seed JSON file.",
    )
    return parser.parse_args()


def polygon_from_coords(coords: list[list[float]]) -> str:
    return json.dumps(
        {
            "type": "Polygon",
            "coordinates": [[[lng, lat] for lat, lng in coords]],
        },
        ensure_ascii=False,
    )


def find_district(name: str) -> dict:
    data = fetch_seoul_districts()
    for district in data.get("districts", []):
        if district["name"] == name:
            return district
    raise RuntimeError(f"District not found: {name}")


def find_dong(osm_id: int) -> dict:
    data = fetch_seoul_sub_districts()
    for dong in data.get("dongs", []):
        if dong["id"] == osm_id:
            return dong
    raise RuntimeError(f"Dong not found: {osm_id}")


async def upsert_admin_area(session, payload: dict) -> None:
    await session.execute(
        text(
            """
            INSERT INTO world_area (
                id,
                osm_id,
                area_level,
                area_code,
                name,
                name_en,
                parent_id,
                center_lat,
                center_lng,
                boundary_geojson,
                area_meta
            ) VALUES (
                :id,
                :osm_id,
                :area_level,
                :area_code,
                :name,
                :name_en,
                :parent_id,
                :center_lat,
                :center_lng,
                CAST(:boundary_geojson AS JSON),
                CAST(:area_meta AS JSON)
            )
            ON CONFLICT (id) DO UPDATE SET
                osm_id = EXCLUDED.osm_id,
                area_level = EXCLUDED.area_level,
                area_code = EXCLUDED.area_code,
                name = EXCLUDED.name,
                name_en = EXCLUDED.name_en,
                parent_id = EXCLUDED.parent_id,
                center_lat = EXCLUDED.center_lat,
                center_lng = EXCLUDED.center_lng,
                boundary_geojson = EXCLUDED.boundary_geojson,
                area_meta = EXCLUDED.area_meta,
                updated_at = now()
            """
        ),
        payload,
    )


async def upsert_partition(session, admin_area_id: int, partition: dict, meta: dict) -> None:
    payload = {
        "id": int(meta["dong_osm_id"]) * 1000 + int(partition["partition_seq"]),
        "partition_key": partition["partition_key"],
        "admin_area_id": admin_area_id,
        "city_name": meta["city"],
        "district_name": meta["district"],
        "dong_name": meta["dong"],
        "partition_stage": partition["partition_stage"],
        "partition_seq": partition["partition_seq"],
        "source_layer": partition["source_layer"],
        "display_name": partition["display_name"],
        "summary": partition.get("summary"),
        "description": partition.get("description"),
        "theme_code": partition.get("theme_code"),
        "group_key": partition.get("group_key"),
        "group_seq": partition.get("group_seq"),
        "group_display_name": partition.get("group_display_name"),
        "group_theme_code": partition.get("group_theme_code"),
        "landuse_code": partition.get("landuse_code"),
        "dominant_landuse": partition.get("dominant_landuse"),
        "persona_tag": partition.get("persona_tag"),
        "texture_profile": partition.get("texture_profile"),
        "is_road": partition.get("is_road", False),
        "area_m2": partition.get("area_m2"),
        "centroid_lat": partition.get("centroid_lat"),
        "centroid_lng": partition.get("centroid_lng"),
        "boundary_geojson": json.dumps(partition.get("boundary_geojson") or {}, ensure_ascii=False),
        "source_feature": json.dumps(partition.get("source_feature") or {}, ensure_ascii=False),
        "gameplay_meta": json.dumps(partition.get("gameplay_meta") or {}, ensure_ascii=False),
    }

    await session.execute(
        text(
            """
            INSERT INTO world_level_partition (
                id,
                partition_key,
                admin_area_id,
                city_name,
                district_name,
                dong_name,
                partition_stage,
                partition_seq,
                source_layer,
                display_name,
                summary,
                description,
                theme_code,
                group_key,
                group_seq,
                group_display_name,
                group_theme_code,
                landuse_code,
                dominant_landuse,
                persona_tag,
                texture_profile,
                is_road,
                area_m2,
                centroid_lat,
                centroid_lng,
                boundary_geojson,
                source_feature,
                gameplay_meta
            ) VALUES (
                :id,
                :partition_key,
                :admin_area_id,
                :city_name,
                :district_name,
                :dong_name,
                :partition_stage,
                :partition_seq,
                :source_layer,
                :display_name,
                :summary,
                :description,
                :theme_code,
                :group_key,
                :group_seq,
                :group_display_name,
                :group_theme_code,
                :landuse_code,
                :dominant_landuse,
                :persona_tag,
                :texture_profile,
                :is_road,
                :area_m2,
                :centroid_lat,
                :centroid_lng,
                CAST(:boundary_geojson AS JSON),
                CAST(:source_feature AS JSON),
                CAST(:gameplay_meta AS JSON)
            )
            ON CONFLICT (partition_key) DO UPDATE SET
                admin_area_id = EXCLUDED.admin_area_id,
                city_name = EXCLUDED.city_name,
                district_name = EXCLUDED.district_name,
                dong_name = EXCLUDED.dong_name,
                partition_stage = EXCLUDED.partition_stage,
                partition_seq = EXCLUDED.partition_seq,
                source_layer = EXCLUDED.source_layer,
                display_name = EXCLUDED.display_name,
                summary = EXCLUDED.summary,
                description = EXCLUDED.description,
                theme_code = EXCLUDED.theme_code,
                group_key = EXCLUDED.group_key,
                group_seq = EXCLUDED.group_seq,
                group_display_name = EXCLUDED.group_display_name,
                group_theme_code = EXCLUDED.group_theme_code,
                landuse_code = EXCLUDED.landuse_code,
                dominant_landuse = EXCLUDED.dominant_landuse,
                persona_tag = EXCLUDED.persona_tag,
                texture_profile = EXCLUDED.texture_profile,
                is_road = EXCLUDED.is_road,
                area_m2 = EXCLUDED.area_m2,
                centroid_lat = EXCLUDED.centroid_lat,
                centroid_lng = EXCLUDED.centroid_lng,
                boundary_geojson = EXCLUDED.boundary_geojson,
                source_feature = EXCLUDED.source_feature,
                gameplay_meta = EXCLUDED.gameplay_meta,
                updated_at = now()
            """
        ),
        payload,
    )


async def main() -> None:
    args = parse_args()
    seed_path = Path(args.seed)
    seed_data = json.loads(seed_path.read_text(encoding="utf-8-sig"))
    meta = seed_data["meta"]
    district = find_district(meta["district"])
    dong = find_dong(int(meta["dong_osm_id"]))

    district_id = district["id"]
    dong_id = int(meta["dong_osm_id"])
    city_id = 110000
    city_slug = meta.get("city_slug") or CITY_SLUG_MAP.get(meta["city"], "seoul")
    district_slug = meta.get("district_slug") or DISTRICT_SLUG_MAP.get(meta["district"], "district")
    dong_slug = meta.get("dong_slug") or DONG_SLUG_MAP.get(meta["dong"], f"dong_{dong_id}")
    district_area_code = f"{city_slug}.{district_slug}"
    dong_area_code = f"{district_area_code}.{dong_slug}"

    async with async_session_factory() as session:
        await upsert_admin_area(
            session,
            {
                "id": city_id,
                "osm_id": city_id,
                "area_level": "city",
                "area_code": "seoul",
                "name": meta["city"],
                "name_en": "Seoul",
                "parent_id": None,
                "center_lat": dong["center"][0],
                "center_lng": dong["center"][1],
                "boundary_geojson": json.dumps({"type": "FeatureCollection", "features": []}, ensure_ascii=False),
                "area_meta": json.dumps({"scope": "root_city"}, ensure_ascii=False),
            },
        )

        await upsert_admin_area(
            session,
            {
                "id": district_id,
                "osm_id": district_id,
                "area_level": "district",
                "area_code": district_area_code,
                "name": meta["district"],
                "name_en": district.get("name_en"),
                "parent_id": city_id,
                "center_lat": district["center"][0],
                "center_lng": district["center"][1],
                "boundary_geojson": polygon_from_coords(district["coords"]),
                "area_meta": json.dumps({"city": meta["city"]}, ensure_ascii=False),
            },
        )

        await upsert_admin_area(
            session,
            {
                "id": dong_id,
                "osm_id": dong_id,
                "area_level": "dong",
                "area_code": dong_area_code,
                "name": meta["dong"],
                "name_en": dong.get("name_en"),
                "parent_id": district_id,
                "center_lat": dong["center"][0],
                "center_lng": dong["center"][1],
                "boundary_geojson": polygon_from_coords(dong["coords"]),
                "area_meta": json.dumps(
                    {
                        "city": meta["city"],
                        "district": meta["district"],
                        "source_cache": meta.get("source_cache"),
                        "note": meta.get("note"),
                    },
                    ensure_ascii=False,
                ),
            },
        )

        for partition in seed_data["partitions"]:
            await upsert_partition(session, dong_id, partition, meta)

        await session.execute(text("DROP VIEW IF EXISTS world_partition_detail"))
        await session.execute(
            text(
                """
                CREATE VIEW world_partition_detail AS
                SELECT
                    p.id,
                    p.partition_key,
                    p.partition_stage,
                    p.partition_seq,
                    p.display_name,
                    p.summary,
                    p.description,
                    p.theme_code,
                    p.group_key,
                    p.group_seq,
                    p.group_display_name,
                    p.group_theme_code,
                    p.landuse_code,
                    p.dominant_landuse,
                    p.persona_tag,
                    p.texture_profile,
                    p.is_road,
                    p.area_m2,
                    p.centroid_lat,
                    p.centroid_lng,
                    p.city_name,
                    p.district_name,
                    p.dong_name,
                    a.area_code AS admin_area_code,
                    a.name_en AS dong_name_en,
                    a.parent_id AS district_admin_id,
                    p.gameplay_meta
                FROM world_level_partition p
                JOIN world_area a
                    ON a.id = p.admin_area_id
                """
            )
        )

        await session.commit()

    print(f"Seed complete: {meta['dong']} ({len(seed_data['partitions'])} partitions)")


if __name__ == "__main__":
    asyncio.run(main())
