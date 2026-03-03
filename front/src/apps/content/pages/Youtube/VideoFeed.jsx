import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar, Eye, UserPlus } from 'lucide-react';
import { getVideosFeed } from '@api/content/channels';
import './VideoFeed.css';

export default function VideoFeed({ onVideoClick }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [category, setCategory] = useState('');

  useEffect(() => {
    loadVideos();
  }, [sortBy, category]);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const data = await getVideosFeed({ sort_by: sortBy, category, limit: 50 });
      setVideos(data.videos || []);
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (video) => {
    try {
      // client 동적 import
      const { default: client } = await import('@api/client');

      const channelId = video.channelId || video.channel_id;
      if (!channelId) {
        alert('채널 정보가 없습니다.');
        return;
      }

      await client.post('/api/youtube/channel/subscribe', {
        channel_id: channelId
      });
      alert(`✅ "${video.channelTitle}" 채널을 구독했습니다!`);
    } catch (error) {
      console.error(error);
      alert('구독 실패');
    }
  };

  const formatViewCount = (count) => {
    if (!count) return '조회수 정보 없음';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;
    return `${Math.floor(diffDays / 365)}년 전`;
  };

  return (
    <div className="video-feed">
      {/* Control Bar */}
      <div className="feed-controls">
        <div className="sort-tabs">
          <button
            className={`sort-tab ${sortBy === 'newest' ? 'active' : ''}`}
            onClick={() => setSortBy('newest')}
          >
            <Calendar size={18} />
            최신순
          </button>
          <button
            className={`sort-tab ${sortBy === 'popular' ? 'active' : ''}`}
            onClick={() => setSortBy('popular')}
          >
            <TrendingUp size={18} />
            인기순
          </button>
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="category-filter"
        >
          <option value="">모든 카테고리</option>
          <option value="10">음악</option>
          <option value="20">게임</option>
          <option value="24">엔터테인먼트</option>
          <option value="17">스포츠</option>
        </select>
      </div>

      {/* Video Grid */}
      <div className="video-grid">
        {loading ? (
          <div className="loading-state">영상을 불러오는 중...</div>
        ) : videos.length === 0 ? (
          <div className="empty-state">영상이 없습니다 📺</div>
        ) : (
          videos.map((video) => (
            <div
              key={video.id}
              className="video-card"
              onClick={() => onVideoClick(video)}
            >
              {/* Thumbnail */}
              <div className="video-thumbnail">
                <img src={video.thumbnail} alt={video.title} />
                {video.isShort && (
                  <div className="shorts-badge">Shorts</div>
                )}
              </div>

              {/* Info */}
              <div className="video-info">
                <h4 className="video-title">{video.title}</h4>

                <div className="video-meta">
                  <div className="channel-row">
                    <span className="channel-name">{video.channelTitle}</span>
                    <button
                      className="feed-subscribe-btn"
                      title="채널 구독 및 저장 (User Log)"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSubscribe(video);
                      }}
                    >
                      <UserPlus size={14} />
                    </button>
                  </div>

                  <div className="video-stats">
                    <span className="view-count">
                      <Eye size={14} />
                      {formatViewCount(video.viewCount)}
                    </span>
                    <span className="published-date">
                      {formatDate(video.publishedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
