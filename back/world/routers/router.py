import asyncio
from fastapi import APIRouter, HTTPException
from world.services.terrain_service import terrain_service
from world.services.zone_service import fetch_zones, zone_service
from world.services.district_service import (
    fetch_seoul_districts,
    fetch_seoul_sub_districts,
    get_current_district as _get_current_district,
    get_current_dong as _get_current_dong
)
from world.services.block_service import block_service
from world.services.world_design_service import get_yongsan_world_profile

router = APIRouter(prefix="/api/world", tags=["World"])

@router.get("/terrain")
async def get_terrain_data(lat: float, lng: float, dist: int = 500):
    """
    특정 좌표 중심의 실시간 지형 데이터를 반환 (Tiled Streaming용)
    """
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, terrain_service.extract_area_terrain, lat, lng, dist)
    return data

@router.get("/zones")
async def get_zone_data(lat: float, lng: float, dist: int = 2000, categories: str = None, district_id: int = None):
    """
    특정 좌표 중심, 반경(dist)m 내의 구역(Zone) 데이터를 카테고리별로 반환
    """
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, fetch_zones, lat, lng, dist, categories, district_id)
    return data

@router.get("/districts")
async def get_districts(refresh: bool = False):
    """
    서울시 25개 구 행정 경계 데이터를 반환합니다.
    """
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, fetch_seoul_districts, refresh)
    return data

@router.get("/district/current")
async def get_current_district(lat: float, lng: float):
    """
    주어진 GPS 좌표가 서울시 어느 구(시도 행정구역)에 속하는지 반환합니다.
    """
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _get_current_district, lat, lng)
    return result or {"name": None, "name_en": None, "id": None}


@router.get("/dongs")
async def get_dongs(refresh: bool = False):
    """
    서울시 동(admin_level=8) 행정 경계 데이터를 반환합니다.
    """
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, fetch_seoul_sub_districts, refresh)
    return data


@router.get("/dong/current")
async def get_current_dong(lat: float, lng: float):
    """
    주어진 GPS 좌표가 어느 '동'에 속하는지 반환합니다.
    """
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _get_current_dong, lat, lng)
    return result or {"name": None, "id": None}


@router.get("/terrain/district/{district_id}")
async def get_district_terrain(district_id: int):
    """
    특정 구 고유의 지형 데이터를 반환합니다.
    """
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, terrain_service.extract_district_terrain, district_id)
    if not data:
        raise HTTPException(status_code=404, detail="District not found")
    return data


@router.get("/terrain/dong/{dong_id}")
async def get_dong_terrain(dong_id: int):
    """
    특정 동 고유의 지형 데이터를 반환합니다.
    """
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

@router.get("/block-textures")
async def get_block_textures():
    """
    front/public/images 폴더 내의 모든 텍스처 파일 목록을 반환합니다.
    """
    import os
    # back/world/routers/router.py -> 4단계 상위가 루트
    base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    images_dir = os.path.join(base_path, "front", "public", "grounds")
    
    if not os.path.exists(images_dir):
        return []
        
    files = [f for f in os.listdir(images_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
    # 프론트엔드에서 바로 접근 가능한 URL 경로로 반환
    return [f"/grounds/{f}" for f in files]


@router.get("/design/yongsan")
async def get_yongsan_design_profile():
    """
    용산구 월드 디자인 메타데이터 초안을 반환합니다.
    """
    return get_yongsan_world_profile()
