from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

# ========================================================
#  User 스키마 (데이터 전송 객체, DTO)
# ========================================================

# 회원가입 요청
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=4)  # 최소 4자 이상
    nickname: str = Field(..., min_length=2)

# 로그인 응답 (토큰)
class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    nickname: str

# 사용자 정보 조회 (응답용)
class UserResponse(BaseModel):
    id: int
    email: EmailStr
    nickname: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
