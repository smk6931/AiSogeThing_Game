import { useState, useEffect, useRef } from 'react';
import { X, Loader } from 'lucide-react';
import { getRandomVideo, logYoutubeVideo, updateWatchTime } from '@api/content/youtube';
import './YoutubePlayer.css';

// 전역 변수: API 로드 상태
let ytApiLoaded = false;

export default function YoutubePlayer({ video: initialVideo, onClose }) {
  const [currentVideo, setCurrentVideo] = useState(initialVideo);
  const [nextLoading, setNextLoading] = useState(false);

  // Refs
  const playerRef = useRef(null);
  const currentLogIdRef = useRef(null);
  const watchTimeRef = useRef(0);
  const totalDurationRef = useRef(0);
  const intervalRef = useRef(null);

  // UI States
  const [showHint, setShowHint] = useState(true);
  const [showSubscribeBtn, setShowSubscribeBtn] = useState(true);

  // 1. 초기 API 스크립트 로드
  useEffect(() => {
    if (!ytApiLoaded) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      ytApiLoaded = true;
    }
  }, []);

  // 2. 비디오 라이프사이클 관리 (ID가 바뀌면 플레이어 재성성)
  useEffect(() => {
    if (!currentVideo) return;

    // UI 초기화
    setShowHint(true);
    setShowSubscribeBtn(true);
    const hintTimer = setTimeout(() => setShowHint(false), 2500);
    const subTimer = setTimeout(() => setShowSubscribeBtn(false), 2500);

    // 플레이어 생성 함수
    const createPlayer = () => {
      // 안전장치: 기존 것이 있으면 파괴
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (e) { }
      }

      // 유니크 ID 사용 (React 충돌 방지)
      const elementId = `youtube-player-${currentVideo.id}`;

      // 요소를 찾을 때까지 약간 대기 (DOM 렌더링 시점 차이)
      // 하지만 useEffect 안이라서 DOM은 이미 있을 것임.
      if (!document.getElementById(elementId)) {
        console.warn("Player element not found, retrying...");
        setTimeout(createPlayer, 100);
        return;
      }

      playerRef.current = new window.YT.Player(elementId, {
        height: '100%',
        width: '100%',
        videoId: currentVideo.id,
        playerVars: {
          'autoplay': 1,
          'playsinline': 1,
          'controls': 1,
          'rel': 0
        },
        events: {
          'onReady': onPlayerReady,
          'onStateChange': onPlayerStateChange
        }
      });
    };

    // API 준비 확인 후 실행
    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      window.onYouTubeIframeAPIReady = () => {
        createPlayer();
      };
    }

    // 시청 로그 시작
    startTracking(currentVideo.id);

    // Cleanup
    return () => {
      clearTimeout(hintTimer);
      clearTimeout(subTimer);
      stopTracking();
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (e) { }
        playerRef.current = null;
      }
    };
  }, [currentVideo.id]); // currentVideo.id가 바뀔 때마다 실행 (완전 리셋)


  // --- Event Handlers ---

  const onPlayerReady = (event) => {
    event.target.playVideo();
    totalDurationRef.current = event.target.getDuration();
  };

  const onPlayerStateChange = (event) => {
    if (event.data === window.YT.PlayerState.PLAYING) {
      startInterval();
      totalDurationRef.current = playerRef.current.getDuration();
    } else {
      stopInterval();
    }
    if (event.data === window.YT.PlayerState.ENDED) {
      loadNextVideo();
    }
  };

  const startInterval = () => {
    stopInterval();
    intervalRef.current = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        watchTimeRef.current = playerRef.current.getCurrentTime();
      }
    }, 1000);
  };

  const stopInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // --- Logging Logic ---

  const startTracking = async (videoId) => {
    watchTimeRef.current = 0;
    currentLogIdRef.current = null;
    let videoMeta = { id: videoId, title: "Watching..." };
    if (currentVideo && currentVideo.id === videoId) videoMeta = currentVideo;

    const res = await logYoutubeVideo(videoMeta);
    if (res && res.log_id) {
      currentLogIdRef.current = res.log_id;
    }
  };

  const stopTracking = () => {
    stopInterval();
    if (currentLogIdRef.current && watchTimeRef.current > 0) {
      updateWatchTime(currentLogIdRef.current, watchTimeRef.current);
    }
    currentLogIdRef.current = null;
    watchTimeRef.current = 0;
  };

  // --- Next Video Logic ---

  const loadNextVideo = async () => {
    console.log("👉 Loading Next Video...");
    setNextLoading(true);

    try {
      const res = await getRandomVideo();
      console.log("👉 Random Video Result:", res);

      if (res && res.video) {
        setTimeout(() => {
          const nextVideo = {
            id: res.video.video_id,
            title: res.video.title,
            description: res.video.description,
            thumbnail: res.video.thumbnail_url,
            channelTitle: res.video.channel_title,
            channelId: res.video.channel_id,
            isShort: res.video.is_short,
            viewCount: res.video.view_count,
            publishedAt: res.video.published_at
          };
          setCurrentVideo(nextVideo);
          setNextLoading(false);
        }, 500);
      } else {
        alert("다음 영상을 불러올 수 없습니다.");
        setNextLoading(false);
      }
    } catch (error) {
      console.error("Next Video Error:", error);
      alert("영상 로딩 중 오류가 발생했습니다.");
      setNextLoading(false);
    }
  };

  if (!currentVideo) return null;

  // --- Subscribe ---

  const handleSubscribe = async () => {
    const channelId = currentVideo.channelId || currentVideo.channel_id;
    const channelName = currentVideo.channelTitle || currentVideo.channel_title;

    if (!channelId) return alert('채널 정보가 없습니다.');

    try {
      const { default: client } = await import('@api/client');
      await client.post('/api/youtube/channel/subscribe', { channel_id: channelId });
      alert(`✅ "${channelName}" 구독 완료!`);
    } catch (error) {
      console.error(error);
      alert('구독 실패');
    }
  };

  // React Key 전략: Wrapper에 key를 주어 React가 Wrapper 내부를 신경 쓰지 않고 통째로 갈아끼우도록 함
  // Youtube API는 내부 div를 iframe으로 바꿔치기 하므로, React가 이를 감지하면 에러 발생함.
  // 따라서 매 비디오마다 새로운 Wrapper와 새로운 ID를 가진 Div를 렌더링.
  return (
    <div className="youtube-modal-overlay" onClick={onClose}>
      <div className="youtube-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="youtube-close-btn" onClick={onClose}>
          <X size={24} />
        </button>

        {nextLoading && (
          <div className="next-video-loader">
            <Loader size={48} className="spinner-icon" />
            <p>다음 영상 연결 중...</p>
          </div>
        )}

        <div className="youtube-iframe-container">

          {/* 
            CRITICAL FIX: 
            key를 줌으로써 React가 이 div를 매번 새로 생성하게 함.
            Youtube API가 내부 DOM을 훼손해도, React는 Unmount -> Mount 과정을 거치므로 에러 없음.
          */}
          <div key={currentVideo.id} style={{ width: '100%', height: '100%' }}>
            <div id={`youtube-player-${currentVideo.id}`}></div>
          </div>

          {!nextLoading && (
            <>
              <div
                className="next-video-touch-area"
                onClick={(e) => {
                  e.stopPropagation();
                  loadNextVideo();
                }}
                title="다음 영상"
              >
                {showHint && (
                  <div className="next-video-hint">
                    <span>👉</span>
                    <span className="hint-text">Next</span>
                  </div>
                )}
              </div>

              <button
                className={`simple-subscribe-btn ${!showSubscribeBtn ? 'hidden' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSubscribe();
                }}
              >
                <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>+</span> 구독
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
