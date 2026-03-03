import { useState, useEffect } from 'react';
import { X, PlayCircle, Eye, Check, Heart } from 'lucide-react';
import { getAdhocRssVideos, subscribeChannel, unsubscribeChannel, getMySubscriptions, logYoutubeVideo } from '@api/content/youtube';
import YoutubePlayer from '../pages/Youtube/YoutubePlayer'; // 플레이어 import
import './ChannelVideoModal.css';

export default function ChannelVideoModal({ channelId, channelName, onClose }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(false);

  // 영상 재생용
  const [playingVideoId, setPlayingVideoId] = useState(null);

  useEffect(() => {
    if (channelId) {
      loadVideos();
      checkSubscription();
    }
  }, [channelId]);

  const loadVideos = async () => {
    setLoading(true);
    try {
      // 1. RSS로 영상 가져오기 (배열 형태)
      const data = await getAdhocRssVideos([{ id: channelId, name: channelName }]);
      if (data.items) {
        // 최신순 정렬
        const sorted = data.items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        setVideos(sorted);
      }
    } catch (error) {
      console.error("영상 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  // 내가 이미 구독했는지 확인
  const checkSubscription = async () => {
    try {
      const res = await getMySubscriptions();
      if (res.success && res.channels) {
        const found = res.channels.find(ch => ch.channel_id === channelId);
        setIsSubscribed(!!found);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubscribe = async () => {
    if (subLoading) return;
    setSubLoading(true);
    try {
      if (isSubscribed) {
        if (!confirm('정말 구독을 취소하시겠습니까?')) return;
        await unsubscribeChannel(channelId);
        setIsSubscribed(false);
      } else {
        await subscribeChannel({
          channel_id: channelId,
          channel_name: channelName,
          keywords: 'User Pick' // 다른 유저 추천으로 구독함
        });
        setIsSubscribed(true);
      }
    } catch (e) {
      alert("처리 중 오류가 발생했습니다.");
    } finally {
      setSubLoading(false);
    }
  };

  // 영상 클릭 핸들러
  const handleVideoClick = (video) => {
    setPlayingVideoId(video.id);
    // 시청 기록 로그 남기기 (선택 사항)
    try {
      logYoutubeVideo({
        id: video.id,
        title: video.title,
        description: "",
        thumbnail: video.thumbnail,
        channelTitle: channelName
      });
    } catch (e) {
      console.error("로그 실패", e);
    }
  };

  // 포맷 유틸리티
  const formatTimeAgo = (dateString) => {
    const diff = new Date() - new Date(dateString);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}일 전`;
    if (hours > 0) return `${hours}시간 전`;
    return `${minutes}분 전`;
  };

  return (
    <>
      <div className="channel-modal-overlay" onClick={onClose}>
        <div className="channel-modal" onClick={e => e.stopPropagation()}>
          {/* 헤더 */}
          <div className="channel-modal-header">
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{channelName}</h2>
              <span style={{ fontSize: '0.8rem', color: '#ccc' }}>최신 영상 미리보기</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                className={`subscribe-btn ${isSubscribed ? 'subscribed' : ''}`}
                onClick={handleSubscribe}
                disabled={subLoading}
              >
                {subLoading ? '...' : (isSubscribed ? '구독중' : '❤️ 구독하기')}
              </button>
              <button className="close-btn" onClick={onClose}>
                <X size={24} />
              </button>
            </div>
          </div>

          {/* 컨텐츠 */}
          <div className="channel-modal-content">
            {loading ? (
              <div className="loading-spinner"></div>
            ) : videos.length === 0 ? (
              <p className="no-data">최신 영상이 없습니다. 😥</p>
            ) : (
              <div className="video-grid">
                {videos.map(video => (
                  <div key={video.id} className="mini-video-card" onClick={() => handleVideoClick(video)}>
                    <div className="thumbnail-wrapper">
                      <img src={video.thumbnail} alt={video.title} loading="lazy" />
                      <div className="play-overlay">
                        <PlayCircle size={32} color="white" />
                      </div>
                    </div>
                    <div className="video-info">
                      <h4 className="video-title">{video.title}</h4>
                      <span className="video-time">{formatTimeAgo(video.publishedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 영상 플레이어 모달 (가장 최상위 z-index 필요) */}
      {playingVideoId && (
        <YoutubePlayer
          videoId={playingVideoId}
          onClose={() => setPlayingVideoId(null)}
        />
      )}
    </>
  );
}
