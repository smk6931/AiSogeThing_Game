import bcrypt
import os
from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt

# ========================================================
#  보안 및 인증 유틸리티 (비밀번호 해싱, JWT 토큰)
# ========================================================

# JWT 설정 (환경변수에서 가져오되 없으면 기본값 사용)
SECRET_KEY = os.getenv("SECRET_KEY", "super_secret_key_for_aisogething_change_this")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7일 (일주일) 유지

def verify_password(plain_password, hashed_password):
    """입력된 비밀번호가 해시된 비밀번호와 일치하는지 확인"""
    # bcrypt는 바이트 문자열을 원하므로 encode 필요
    # checkpw(사용자입력_byte, DB저장된해시_byte)
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'), 
            hashed_password.encode('utf-8')
        )
    except Exception as e:
        print(f"Password verify error: {e}")
        return False

def get_password_hash(password):
    """비밀번호를 해시 암호화"""
    # gensalt()로 솔트 생성 후 해싱
    # decode('utf-8')로 문자열로 변환하여 DB 저장
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """JWT 액세스 토큰 생성"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
