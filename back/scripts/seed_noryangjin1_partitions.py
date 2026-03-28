import asyncio
import json
from pathlib import Path
import sys

from sqlalchemy import text

ROOT_DIR = Path(__file__).resolve().parents[2]
BACK_DIR = ROOT_DIR / "back"
if str(BACK_DIR) not in sys.path:
    sys.path.append(str(BACK_DIR))

from core.database import async_session_factory
from world.services.district_service import fetch_seoul_districts, fetch_seoul_sub_districts

SEED_PATH = ROOT_DIR / "back" / "world" / "data" / "noryangjin1_level_partition_seed.json"


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
            INSERT INTO world_admin_area (
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
        "partition_type": partition["partition_type"],
        "source_layer": partition["source_layer"],
        "source_version": partition.get("source_version"),
        "map_name": partition["map_name"],
        "display_name": partition["display_name"],
        "summary": partition.get("summary"),
        "description": partition.get("description"),
        "theme_code": partition.get("theme_code"),
        "landuse_code": partition.get("landuse_code"),
        "texture_profile": partition.get("texture_profile"),
        "is_road": partition.get("is_road", False),
        "is_walkable": partition.get("is_walkable", True),
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
                partition_type,
                source_layer,
                source_version,
                map_name,
                display_name,
                summary,
                description,
                theme_code,
                landuse_code,
                texture_profile,
                is_road,
                is_walkable,
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
                :partition_type,
                :source_layer,
                :source_version,
                :map_name,
                :display_name,
                :summary,
                :description,
                :theme_code,
                :landuse_code,
                :texture_profile,
                :is_road,
                :is_walkable,
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
                partition_type = EXCLUDED.partition_type,
                source_layer = EXCLUDED.source_layer,
                source_version = EXCLUDED.source_version,
                map_name = EXCLUDED.map_name,
                display_name = EXCLUDED.display_name,
                summary = EXCLUDED.summary,
                description = EXCLUDED.description,
                theme_code = EXCLUDED.theme_code,
                landuse_code = EXCLUDED.landuse_code,
                texture_profile = EXCLUDED.texture_profile,
                is_road = EXCLUDED.is_road,
                is_walkable = EXCLUDED.is_walkable,
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
    seed_data = json.loads(SEED_PATH.read_text(encoding="utf-8-sig"))
    meta = seed_data["meta"]
    district = find_district(meta["district"])
    dong = find_dong(int(meta["dong_osm_id"]))

    district_id = district["id"]
    dong_id = int(meta["dong_osm_id"])
    city_id = 110000

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
                "area_code": "seoul.dongjak",
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
                "area_code": "seoul.dongjak.noryangjin1",
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

        await session.execute(
            text(
                """
                CREATE OR REPLACE VIEW world_partition_detail AS
                SELECT
                    p.id,
                    p.partition_key,
                    p.partition_stage,
                    p.partition_seq,
                    p.partition_type,
                    p.map_name,
                    p.display_name,
                    p.summary,
                    p.description,
                    p.theme_code,
                    p.landuse_code,
                    p.texture_profile,
                    p.is_road,
                    p.is_walkable,
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
                JOIN world_admin_area a
                    ON a.id = p.admin_area_id
                """
            )
        )

        await session.commit()

    print(f"Seed complete: {meta['dong']} ({len(seed_data['partitions'])} partitions)")


if __name__ == "__main__":
    asyncio.run(main())
