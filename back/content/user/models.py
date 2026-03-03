from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from core.database import Base
import uuid

class User(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True, index=True)
    # 보안: 외부 노출용 랜덤 식별자 (PK 노출 방지)
    uuid = Column(String, unique=True, index=True, default=lambda: str(uuid.uuid4()))
    
    email = Column(String, unique=True, index=True, nullable=False)   # 이메일 (로그인 ID)
    hashed_password = Column(String, nullable=False)                  # 암호화된 비밀번호
    nickname = Column(String, nullable=True)                          # 닉네임
    is_active = Column(Boolean, default=True)                         # 계정 활성 여부
    is_superuser = Column(Boolean, default=False)                     # 관리자 여부
    created_at = Column(DateTime(timezone=True), server_default=func.now()) # 가입 일시
    last_active_at = Column(DateTime(timezone=True), nullable=True)   # 마지막 활동 시간 (접속자 집계용)
