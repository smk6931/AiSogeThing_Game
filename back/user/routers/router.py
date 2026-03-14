from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import timedelta
from typing import Annotated

import user.schemas.schemas as schemas
import user.services.service as service
import user.services.auth as auth
import user.models.models as models
from jose import JWTError, jwt

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# OAuth2 스킴 (토큰 추출용)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ========================================================
#  회원가입 API
# ========================================================
@router.post("/signup", response_model=schemas.UserResponse)
async def signup(user: schemas.UserCreate):
    # 1. 이메일 중복 체크
    db_user = await service.get_user_by_email(email=user.email)
    if db_user:
        raise HTTPException(
            status_code=400, 
            detail="이미 등록된 이메일입니다."
        )
    
    # 2. 계정 생성
    return await service.create_user(user=user)

# ========================================================
#  로그인 API (JWT 토큰 발급)
# ========================================================
@router.post("/login", response_model=schemas.Token)
async def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()]):
    # 1. 사용자 조회 (Async Raw SQL)
    user = await service.get_user_by_email(form_data.username)
    if not user:
        raise HTTPException(status_code=400, detail="이메일 또는 비밀번호가 틀렸습니다.")
    
    # 2. 비밀번호 검증
    if not auth.verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="이메일 또는 비밀번호가 틀렸습니다.")
    
    # 3. 토큰 발급
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user["email"], "uid": user["id"]},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user_id": user["id"],
        "nickname": user["nickname"]
    }

# ========================================================
#  게스트(임시 Admin) 강제 로그인 API (DB 없이 작동)
# ========================================================
@router.post("/guest-login", response_model=schemas.Token)
async def guest_login():
    """
    DB 인증 없이 매번 고유한 ID를 부여하여 여러 게스트가 서로를 볼 수 있게 함
    """
    import random
    import string
    
    # 1. 고유 ID 생성 (50000~99999 사이 랜덤)
    unique_id = random.randint(50000, 99999)
    # 2. 랜덤 닉네임 생성 (Guest_XXXX)
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    unique_nickname = f"Guest_{suffix}"
    guest_email = f"{unique_nickname}@guest.com"
    
    # 토큰 발급
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": guest_email, "uid": unique_id},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user_id": unique_id,
        "nickname": unique_nickname
    }


# ========================================================
#  내 정보 조회 API (토큰 검증)
# ========================================================
async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="자격 증명이 유효하지 않습니다.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # 토큰 디코딩
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # 사용자 조회 (Async Raw SQL)
    try:
        user = await service.get_user_by_email(email=email)
    except Exception as e:
        # DB가 없는 상태 (연결 거부 등)에 대한 Fallback - Guest는 무조건 통과
        if email == "admin@guest.com":
            return {"id": 9999, "email": "admin@guest.com", "nickname": "AdminGuest", "hashed_password": ""}
        raise credentials_exception

    if user is None:
        if email == "admin@guest.com":
            return {"id": 9999, "email": "admin@guest.com", "nickname": "AdminGuest", "hashed_password": ""}
        raise credentials_exception
        
    # [Active 전략] API 호출 시마다 마지막 활동 시간 갱신
    try:
        await service.update_last_active(user["id"])
    except:
        pass # DB 오프라인 시 무시
    
    return user

@router.get("/me", response_model=schemas.UserResponse)
def read_users_me(current_user: Annotated[models.User, Depends(get_current_user)]):
    return current_user

# ========================================================
#  실시간 접속자 (Heartbeat & Stats)
# ========================================================

@router.post("/heartbeat")
async def heartbeat(current_user: Annotated[models.User, Depends(get_current_user)]):
    """
    [Passive 전략] 프론트엔드에서 주기적으로 호출하여 접속 유지 (Last Active 갱신)
    이미 get_current_user에서 갱신하므로, 이 함수는 빈 껍데기만 있어도 됨.
    """
    return {"status": "alive", "uid": current_user["id"]}

@router.get("/stats/online")
async def get_online_stats():
    """
    현재 접속 중인 유저 수 조회 (최근 5분 활동)
    """
    count = await service.count_online_users(minutes=5)
    return {"online_users": count}

@router.get("/stats/online-users")
async def get_online_users_detail():
    """
    접속 중인 유저 상세 목록 조회 (모달용)
    """
    users = await service.get_online_users_list(minutes=5)
    
    # 딕셔너리 리스트로 변환 (필요시)
    return {
        "count": len(users),
        "users": users
    }

@router.get("/stats/all-users")
async def get_all_users_detail():
    """
    전체 유저 목록 조회 (모달용 - 전체 탭)
    """
    users = await service.get_all_users_list(limit=50)
    return {
        "count": len(users),
        "users": users
    }

@router.post("/logout")
async def logout(current_user: Annotated[models.User, Depends(get_current_user)]):
    """
    로그아웃 (서버 측 상태 오프라인으로 변경)
    """
    await service.mark_user_offline(current_user["id"])
    return {"message": "Successfully logged out"}

# ========================================================
#  사용자 프로필 조회 (Public)
# ========================================================
@router.get("/profile/{user_uuid}")
async def get_user_profile(
    user_uuid: str,
    current_user: Annotated[models.User, Depends(get_current_user)]
):
    """
    특정 사용자의 프로필 정보 조회 (로그인 필수)
    - 닉네임, 가입일, 마지막 활동 시간 등
    - user_uuid: UUID 포맷 스트링
    """
    # UUID로 조회
    user = await service.get_user_by_uuid(user_uuid)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    
    # 민감 정보 제외하고 반환
    return {
        "id": user["id"],
        "nickname": user["nickname"],
        "email": user["email"],  # 필요 시 제거 가능
        "created_at": user.get("created_at"),
        "last_active": user.get("last_active")
    }
