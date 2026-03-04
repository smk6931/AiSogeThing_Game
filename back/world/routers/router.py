import asyncio
from fastapi import APIRouter
from world.services.terrain_service import terrain_service
from world.services.zone_service import fetch_zones
from world.services.district_service import fetch_seoul_districts, get_current_district as _get_current_district

router = APIRouter(prefix="/api/game", tags=["Game World"])

@router.get("/terrain")
async def get_terrain_data(lat: float, lng: float, dist: int = 500):
    """
    특정 좌표 중심의 실시간 지형 데이터를 반환 (Tiled Streaming용)
    """
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, terrain_service.extract_area_terrain, lat, lng, dist)
    return data

@router.get("/zones")
async def get_zone_data(lat: float, lng: float, dist: int = 2000, categories: str = None):
    """
    특정 좌표 중심, 반경(dist)m 내의 구역(Zone) 데이터를 카테고리별로 반환
    """
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, fetch_zones, lat, lng, dist, categories)
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
