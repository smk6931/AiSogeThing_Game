"""
성향 분석 Tool
- 유저의 시청 패턴 통계 집계
"""
from core.database import fetch_all

async def analyze_user_preference(user_id: int):
    """
    유저 시청 성향 분석
    Returns: dict with statistics
    """
    # 1. 총 시청 영상 수
    total_sql = "SELECT COUNT(*) as total FROM user_youtube_logs WHERE user_id = :uid"
    total_result = await fetch_all(total_sql, {"uid": user_id})
    total_videos = total_result[0]['total'] if total_result else 0
    
    # 2. 가장 많이 본 카테고리 Top 3
    category_sql = """
        SELECT yl.category_id, COUNT(*) as cnt
        FROM user_youtube_logs uyl
        JOIN youtube_list yl ON uyl.video_id = yl.video_id
        WHERE uyl.user_id = :uid AND yl.category_id IS NOT NULL
        GROUP BY yl.category_id
        ORDER BY cnt DESC
        LIMIT 3
    """
    top_categories = await fetch_all(category_sql, {"uid": user_id})
    
    # 3. Shorts vs 긴 영상 비율
    shorts_sql = """
        SELECT yl.is_short, COUNT(*) as cnt
        FROM user_youtube_logs uyl
        JOIN youtube_list yl ON uyl.video_id = yl.video_id
        WHERE uyl.user_id = :uid
        GROUP BY yl.is_short
    """
    shorts_ratio = await fetch_all(shorts_sql, {"uid": user_id})
    
    # 4. 가장 많이 본 채널 Top 5
    channel_sql = """
        SELECT yl.channel_title, COUNT(*) as cnt
        FROM user_youtube_logs uyl
        JOIN youtube_list yl ON uyl.video_id = yl.video_id
        WHERE uyl.user_id = :uid
        GROUP BY yl.channel_title
        ORDER BY cnt DESC
        LIMIT 5
    """
    top_channels = await fetch_all(channel_sql, {"uid": user_id})
    
    # 5. 구독 채널 수
    sub_count_sql = "SELECT COUNT(*) as cnt FROM user_logs WHERE user_id = :uid AND action = 'subscribe'"
    sub_result = await fetch_all(sub_count_sql, {"uid": user_id})
    sub_count = sub_result[0]['cnt'] if sub_result else 0
    
    return {
        "total_videos": total_videos,
        "top_categories": top_categories,
        "shorts_ratio": shorts_ratio,
        "top_channels": top_channels,
        "subscription_count": sub_count
    }
