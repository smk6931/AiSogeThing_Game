from fastapi import APIRouter, HTTPException
from client.naver_client import search_place

# 라우터 정의
router = APIRouter(prefix="/api/content/hotplace", 
    tags=["Hotplace"]
)

@router.get("/search")
def search_place_endpoint(query: str):
    """
    네이버 장소 검색 API
    """
    if not query:
        raise HTTPException(status_code=400, detail="검색어를 입력해주세요.")
    
    result = search_place(query)
    
    if "error" in result:
        return result
        
    # 결과 타입에 따라 반환 형식 조정 (List -> Dict Wrapper)
    if isinstance(result, list):
        return {"items": result}
        
    return result
