from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector  # [New] 벡터 타입 추가
from core.database import Base

class Comment(Base):
    """통합 댓글 테이블 (유튜브, 맛집, 피드 등)"""
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    content_type = Column(String, nullable=False, index=True)      # 'youtube', 'hotplace', 'feed'
    content_id = Column(String, nullable=False, index=True)        # 해당 콘텐츠의 ID (Youtube는 문자열 ID, 나머지는 정수일 수 있음)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=True) # 작성자 ID (회원제)
    username = Column(String, nullable=True)                       # 비회원일 경우 또는 닉네임 캐싱
    content = Column(Text, nullable=False)                         # 댓글 내용
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class YoutubeList(Base):
    """수집된 유튜브 영상 리스트 (메타데이터)"""
    __tablename__ = "youtube_list"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(String, unique=True, index=True, nullable=False)  # 유튜브 비디오 ID
    title = Column(String, nullable=False)                              # 제목
    description = Column(Text, nullable=True)                           # 설명
    thumbnail_url = Column(String, nullable=True)                       # 썸네일
    channel_title = Column(String, nullable=True)                       # 채널명
    channel_id = Column(String, nullable=True)                          # 채널 ID
    country_code = Column(String, nullable=True)                        # 수집 국가 (KR, US 등)
    category_id = Column(String, nullable=True)                         # 카테고리 ID (10, 20 등)
    tags = Column(Text, nullable=True)                                  # 태그
    duration = Column(String, nullable=True)                            # 길이
    is_short = Column(Integer, nullable=True)                           # 쇼츠 여부 (1: 쇼츠, 0: 일반, NULL: 미확인)
    view_count = Column(Integer, nullable=True)                         # 조회수
    
    # [New] 벡터 임베딩 (1536차원 - OpenAI text-embedding-3-small)
    embedding = Column(Vector(1536), nullable=True)

    published_at = Column(DateTime(timezone=True), nullable=True)       # 업로드일
    created_at = Column(DateTime(timezone=True), server_default=func.now()) # 수집일
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now()) # 수정일


class YoutubeChannel(Base):
    """(검색 캐싱용) 수집된 유튜브 채널 정보 - 사용자 취향 분석의 핵심"""
    __tablename__ = "youtube_channels"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(String, unique=True, index=True, nullable=False) # 유튜브 채널 ID
    name = Column(String, nullable=False)                                # 채널명
    keywords = Column(Text, nullable=True)                               # 발견된 키워드 (JSON String)
    category = Column(String, nullable=True)                             # 채널 카테고리 (예: Gaming, Music, Education)
    description = Column(Text, nullable=True)                            # 채널 설명
    
    # [New] 채널 성향 벡터 임베딩 (1536차원)
    embedding = Column(Vector(1536), nullable=True)

    thumbnail_url = Column(Text, nullable=True)                          # 채널 썸네일 URL
    created_at = Column(DateTime(timezone=True), server_default=func.now())



class UserLog(Base):
    """유저 통합 활동 로그 (클릭, 좋아요, 조회 등)"""
    __tablename__ = "user_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False, index=True)
    content_type = Column(String, nullable=False, index=True)      # 'youtube', 'hotplace'
    content_id = Column(String, nullable=False)                    # 콘텐츠 ID
    action = Column(String, nullable=False)                        # 'click', 'like', 'view'
    metadata_json = Column(Text, nullable=True)                    # 추가 정보 (JSON 형태)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UserYoutubeLog(Base):
    """
    [New] 유튜브 시청 로그 (시청 시간 기록)
    UserLog 테이블의 'youtube' & 'view' 역할을 대체하며 시청 시간을 저장함.
    """
    __tablename__ = "user_youtube_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False, index=True)
    video_id = Column(String, nullable=False, index=True)
    
    watched_seconds = Column(Integer, default=0)  # 실제 시청 시간 (초)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

