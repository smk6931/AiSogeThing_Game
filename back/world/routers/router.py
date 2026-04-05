import asyncio
import os

from fastapi import APIRouter, HTTPException

from world.services.block_service import block_service
from world.services.district_service import (
    fetch_seoul_districts,
    fetch_seoul_sub_districts,
    get_current_district as _get_current_district,
    get_current_dong as _get_current_dong,
)
from world.services.partition_service import get_current_region_info, get_partitions_by_dong_osm_id
from world.services.terrain_service import terrain_service
from world.services.world_design_service import get_yongsan_world_profile
from world.services.zone_service import fetch_zones, zone_service

router = APIRouter(prefix="/api/world", tags=["World"])


@router.get("/terrain")
async def get_terrain_data(lat: float, lng: float, dist: int = 500):
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, terrain_service.extract_area_terrain, lat, lng, dist)
    return data


@router.get("/zones")
async def get_zone_data(lat: float, lng: float, dist: int = 2000, categories: str = None, district_id: int = None):
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, fetch_zones, lat, lng, dist, categories, district_id)
    return data


@router.get("/districts")
async def get_districts(refresh: bool = False):
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, fetch_seoul_districts, refresh)
    return data


@router.get("/district/current")
async def get_current_district(lat: float, lng: float):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _get_current_district, lat, lng)
    return result or {"name": None, "name_en": None, "id": None}


@router.get("/dongs")
async def get_dongs(refresh: bool = False):
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, fetch_seoul_sub_districts, refresh)
    return data


@router.get("/dong/current")
async def get_current_dong(lat: float, lng: float):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _get_current_dong, lat, lng)
    return result or {"name": None, "id": None}


@router.get("/region/current")
async def get_current_region(lat: float, lng: float):
    return await get_current_region_info(lat, lng)


@router.get("/partitions/dong/{dong_id}")
async def get_dong_partitions(dong_id: int):
    return await get_partitions_by_dong_osm_id(dong_id)


@router.get("/terrain/district/{district_id}")
async def get_district_terrain(district_id: int):
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, terrain_service.extract_district_terrain, district_id)
    if not data:
        raise HTTPException(status_code=404, detail="District not found")
    return data


@router.get("/terrain/dong/{dong_id}")
async def get_dong_terrain(dong_id: int):
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, terrain_service.extract_dong_terrain, dong_id)
    if not data:
        raise HTTPException(status_code=404, detail="Dong not found")
    return data


@router.get("/zones/district/{district_id}")
async def get_district_zones(district_id: int):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, zone_service.extract_district_zones, district_id)


@router.get("/zones/dong/{dong_id}")
async def get_dong_zones(dong_id: int):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, zone_service.extract_dong_zones, dong_id)


@router.get("/blocks/district/{district_id}")
async def get_district_blocks(district_id: int):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, block_service.extract_district_blocks, district_id)


@router.get("/blocks/dong/{dong_id}")
async def get_dong_blocks(dong_id: int):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, block_service.extract_dong_blocks, dong_id)


def _resolve_ground_root() -> str:
    base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    return os.path.join(base_path, "front", "public", "ground")


def _resolve_road_root() -> str:
    base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    return os.path.join(base_path, "front", "public", "road")


def _list_texture_files(asset_root: str, folder: str | None = None, url_prefix: str = "") -> list[str]:
    if not os.path.exists(asset_root):
        return []

    normalized_folder = (folder or "").strip().strip("/\\")
    images_dir = os.path.join(asset_root, normalized_folder) if normalized_folder else asset_root

    try:
        resolved_asset_root = os.path.realpath(asset_root)
        resolved_images_dir = os.path.realpath(images_dir)
        if os.path.commonpath([resolved_asset_root, resolved_images_dir]) != resolved_asset_root:
            raise HTTPException(status_code=400, detail=f"Invalid {url_prefix.strip('/')} texture folder")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid {url_prefix.strip('/')} texture folder") from exc

    if not os.path.exists(images_dir):
        return []

    files = sorted(
        entry for entry in os.listdir(images_dir)
        if os.path.isfile(os.path.join(images_dir, entry))
        and entry.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
    )
    prefix = f"{url_prefix}/{normalized_folder}".rstrip("/")
    return [f"{prefix}/{entry}" for entry in files]


def _list_texture_folders(asset_root: str) -> list[str]:
    if not os.path.exists(asset_root):
        return []

    return sorted(
        entry for entry in os.listdir(asset_root)
        if os.path.isdir(os.path.join(asset_root, entry))
    )


@router.get("/block-textures")
async def get_block_textures(folder: str | None = None):
    return _list_texture_files(_resolve_ground_root(), folder, "/ground")


@router.get("/block-texture-folders")
async def get_block_texture_folders():
    return _list_texture_folders(_resolve_ground_root())


@router.get("/road-textures")
async def get_road_textures(folder: str | None = None):
    return _list_texture_files(_resolve_road_root(), folder, "/road")


@router.get("/road-texture-folders")
async def get_road_texture_folders():
    return _list_texture_folders(_resolve_road_root())


@router.get("/design/yongsan")
async def get_yongsan_design_profile():
    return get_yongsan_world_profile()
