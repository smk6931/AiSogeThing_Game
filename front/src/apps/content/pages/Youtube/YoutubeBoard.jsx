import { useState, useEffect } from 'react';
import { Search, PlayCircle, Eye, Sparkles, XCircle, PlusCircle } from 'lucide-react';
import { searchYoutube, getPopularYoutube, getDatingYoutube, discoverDatingChannels, discoverInterest, getInterestYoutube, subscribeChannel, unsubscribeChannel, getMySubscriptions, getAdhocRssVideos, getDBVideos } from '@api/content/youtube';
import YoutubePlayer from './YoutubePlayer';
import ApiInfo from '../../components/common/ApiInfo';
import GlobalCollector from '../../components/GlobalCollector';
import './YoutubeBoard.css';

export default function YoutubeBoard() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [quota, setQuota] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [hideShorts, setHideShorts] = useState(false);

  const [datingChannels, setDatingChannels] = useState([]);
  const [selectedDatingChannel, setSelectedDatingChannel] = useState(null);
  const [datingSubCategory, setDatingSubCategory] = useState('reality'); // 'reality' | 'sketch'
  const [customKeyword, setCustomKeyword] = useState('');
  const [interestChannels, setInterestChannels] = useState([]);
  const [selectedInterestChannel, setSelectedInterestChannel] = useState(null);
  const [mySubscriptions, setMySubscriptions] = useState([]);
  const [showSidebar, setShowSidebar] = useState(false);

  const categories = [
    { id: null, name: '🔥 전체' },
    { id: 'dating', name: '💘 연애/코칭', special: true },
    { id: 'custom', name: '⭐ 내 관심사', special: true },
    { id: '1', name: '🎬 애니/영화' },
    { id: '2', name: '🚗 자동차' },
    { id: '10', name: '🎵 음악' },
    { id: '15', name: '🐶 동물' },
    { id: '17', name: '⚽ 스포츠' },
    { id: '19', name: '✈️ 여행' },
    { id: '20', name: '🎮 게임' },
    { id: '22', name: '📷 일상' },
    { id: '23', name: '🤣 코미디' },
    { id: '24', name: '📺 엔터' },
    { id: '25', name: '📰 뉴스' },
    { id: '26', name: '💄 뷰티/패션' },
    { id: '27', name: '📚 교육' },
    { id: '28', name: '🧪 과학/기술' },
    { id: '29', name: '🤝 사회/봉사' },
  ];

  useEffect(() => {
    loadPopular(null);
  }, []);

  const loadPopular = async (categoryId) => {
    setLoading(true);
    setSelectedCategory(categoryId);
    setKeyword('');
    setSelectedDatingChannel(null);

    try {
      let data;

      if (categoryId === 'dating') {
        data = await getDatingYoutube();
        if (data.channels) setDatingChannels(data.channels);
      } else if (categoryId === 'custom') {
        // 커스텀 관심사 (RSS)
        data = await getInterestYoutube(customKeyword || null);
        if (data.channels) setInterestChannels(data.channels);
      } else {
        // 1. DB 먼저 조회 (Hybrid Strategy: Cost 0)
        // TODO: 현재 국가 설정이 'KR'로 고정되어 있음. GlobalCollector와 연동 필요.
        const dbRes = await getDBVideos('KR', categoryId);

        if (dbRes.items && dbRes.items.length > 0) {
          console.log("Using DB Data:", dbRes.count);
          data = dbRes;
        } else {
          // 2. DB 없으면 실시간 API 호출 (Cost 발생)
          console.log("DB Empty -> Fetching API");
          data = await getPopularYoutube(categoryId);
        }
      }

      console.log("Youtube Data:", data);

      if (data.items) {
        const shortsCount = data.items.filter(v => v.isShort).length;
        const videoCount = data.items.length - shortsCount;

        // 최신순 정렬 (Date 객체로 변환하여 비교)
        let sortedItems = [...data.items];
        sortedItems.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

        setVideos(sortedItems);
        if (data.meta) setQuota(data.meta);
      } else if (data.error) {
        alert("영상 불러오기 실패: " + data.error);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 시간 포맷팅 (예: 2시간 전, 3일 전)
  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = (now - date) / 1000; // 초 단위

    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!keyword.trim()) return;

    setLoading(true);
    setSelectedCategory('search');

    try {
      const data = await searchYoutube(keyword);
      if (data.items) {
        setVideos(data.items);
        if (data.meta) setQuota(data.meta);
      } else if (data.error) {
        alert("검색 실패: " + data.error);
      }
    } catch (error) {
      alert("검색 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDiscover = async () => {
    const genreName = datingSubCategory === 'reality' ? "연애 코칭/예능" : "스케치 코미디";
    if (!confirm(`🤖 AI가 '${genreName}' 관련 인기 채널을 찾아냅니다.\n(API 100점 소모)\n\n계속하시겠습니까?`)) return;

    setLoading(true);
    try {
      const res = await discoverDatingChannels(datingSubCategory);
      if (res.error) {
        alert("오류 발생: " + res.error);
      } else {
        alert(`🎉 성공! ${res.added}개의 새로운 채널을 발견했습니다.\n이제 자동으로 목록에 추가됩니다.`);
        loadPopular('dating');
      }
    } catch (e) {
      alert("요청 실패");
    } finally {
      setLoading(false);
    }
  };

  const handleDiscoverInterest = async () => {
    if (!customKeyword.trim()) return alert("키워드를 입력해주세요.");
    if (!confirm(`🤖 AI가 '${customKeyword}' 관련 인기 채널을 찾아냅니다.\n(API 100점 소모)\n\n계속하시겠습니까?`)) return;

    setLoading(true);
    try {
      const res = await discoverInterest(customKeyword);
      if (res.error) {
        alert("오류 발생: " + res.error);
      } else {
        // DB 저장 없이 바로 결과 표시
        const found = res.channels || [];
        // 발굴된 채널들의 영상 가져오기 (RSS)
        try {
          const videoData = await getAdhocRssVideos(found);
          if (videoData.items && videoData.items.length > 0) {
            // 1. 실제로 영상이 있는 채널 ID만 추출 (Set으로 중복 제거)
            const activeIds = new Set(videoData.items.map(v => v.channelId));

            // 2. 영상이 있는 채널만 남김 (필터링)
            const activeChannels = found.filter(ch => activeIds.has(ch.id));
            setInterestChannels(activeChannels);

            // 3. 최신순 정렬 및 영상 표시
            const sorted = videoData.items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
            setVideos(sorted);

            // 4. 결과 리포트 (필터링 된 경우 사용자에게 알림)
            const removedCount = found.length - activeChannels.length;
            if (removedCount > 0) {
              // 토스트 메시지나 콘솔로 알림 (여기선 alert 내용 수정 대신 콘솔에만 남김)
              console.log(`🧹 활동 없는 채널 ${removedCount}개를 자동으로 제외했습니다.`);
            }
          } else {
            setInterestChannels([]); // 영상 하나도 없으면 싹 비움
            alert("😔 최근 활동이 있는 채널을 찾지 못했습니다. 다른 키워드로 시도해보세요.");
          }
        } catch (rssError) {
          console.error("RSS Load Error:", rssError);
        }
      }
    } catch (e) {
      alert("요청 실패");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };


  /* 구독 리스트 로드 함수 */
  const loadSubscriptions = async () => {
    try {
      const res = await getMySubscriptions();
      if (res.success) {
        setMySubscriptions(res.channels);
        // 구독 리스트가 있으면 interestChannels에도 반영 (구독 버튼 상태 갱신용)
        setInterestChannels(prev => {
          // 기존 목록에 구독 정보 머지할 수도 있지만, 여기서는 단순 리스트 갱신
          return prev;
        });
      }
    } catch (e) {
      console.error("구독 로드 실패", e);
    }
  };

  useEffect(() => {
    loadPopular(null);
    loadSubscriptions(); // 초기 로딩 시 내 구독 리스트 가져오기
  }, []);

  // ... (기존 loadPopular 등) ...

  const handleSubscribe = async (e, video) => {
    e.stopPropagation();
    if (!video.channelId) return alert("채널 정보를 알 수 없어 구독할 수 없습니다.");

    if (!confirm(`'${video.channelTitle}' 채널을 구독하시겠습니까?`)) return;

    try {
      await subscribeChannel(video.channelId, video.channelTitle);
      // alert("✅ 구독 완료! 사이드바에서 확인할 수 있습니다."); -> 연속 구독 위해 알림 제거
      loadSubscriptions(); // 사이드바 리스트 갱신 & 버튼 UI 자동 변경
    } catch (err) {
      alert("구독 실패: 이미 구독중이거나 오류 발생.");
    }
  };

  const handleUnsubscribe = async (e, channelId, channelName) => {
    e.stopPropagation();
    if (!confirm(`💔 '${channelName}' 구독을 취소하시겠습니까?`)) return;

    try {
      await unsubscribeChannel(channelId);
      // alert("✅ 구독 취소 완료"); -> 알림 제거
      loadSubscriptions(); // 사이드바 리스트 갱신 & 버튼 UI 자동 변경
    } catch (err) {
      alert("취소 실패");
    }
  };

  const formatViewCount = (count) => {
    if (!count) return '';
    const num = Number(count);
    if (isNaN(num)) return '';
    if (num >= 100000000) return (num / 100000000).toFixed(1) + '억회';
    if (num >= 10000) return (num / 10000).toFixed(1) + '만회';
    return num.toLocaleString() + '회';
  };

  // 렌더링용: 현재 서브 카테고리에 맞는 채널만 필터링
  const filteredChannels = datingChannels.filter(ch => (ch.category || 'reality') === datingSubCategory);

  return (
    <div className="youtube-board">
      <div className="youtube-header">
        <h2>🎵 Youtube Lounge</h2>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <ApiInfo
            name="YouTube API"
            remaining={quota?.remaining}
            limit={quota?.limit || 10000}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <button
            onClick={() => setHideShorts(!hideShorts)}
            className="category-chip"
            style={{
              background: hideShorts ? '#ff0000' : 'rgba(255,255,255,0.05)',
              border: hideShorts ? '1px solid #ff0000' : '1px solid rgba(255,255,255,0.2)',
              fontWeight: hideShorts ? 'bold' : 'normal'
            }}
          >
            {hideShorts ? '✅ 쇼츠 숨김 켜짐' : '🚫 쇼츠 숨기기'}
          </button>
        </div>

        <div className="category-tabs">
          {categories.map((cat) => (
            <button
              key={cat.id || 'all'}
              className={`category-chip ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => loadPopular(cat.id)}
              style={cat.special ? { border: '1px solid #ff69b4', color: '#ff69b4' } : {}}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {selectedCategory === 'dating' && (
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '12px', marginTop: '10px' }}>

            {/* 서브 카테고리 토글 */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
              <button
                className={`category-chip ${datingSubCategory === 'reality' ? 'active' : ''}`}
                onClick={() => { setDatingSubCategory('reality'); setSelectedDatingChannel(null); }}
                style={{ borderRadius: '20px', padding: '6px 16px' }}
              >
                💑 연애 예능/코칭
              </button>
              <button
                className={`category-chip ${datingSubCategory === 'sketch' ? 'active' : ''}`}
                onClick={() => { setDatingSubCategory('sketch'); setSelectedDatingChannel(null); }}
                style={{ borderRadius: '20px', padding: '6px 16px' }}
              >
                🎭 스케치 코미디
              </button>
            </div>

            {/* 채널 리스트 & AI 버튼 */}
            <div className="category-control-row" style={{ overflowX: 'auto', display: 'flex', gap: '8px', paddingBottom: '5px' }}>

              <button
                className="category-chip"
                onClick={handleDiscover}
                style={{
                  fontSize: '0.8rem',
                  padding: '4px 12px',
                  background: 'linear-gradient(45deg, #6a11cb 0%, #2575fc 100%)',
                  border: 'none',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                <Sparkles size={14} /> 채널 발굴 (+100점)
              </button>

              <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }}></div>

              <button
                className={`category-chip ${selectedDatingChannel === null ? 'active' : ''}`}
                onClick={() => setSelectedDatingChannel(null)}
                style={{ fontSize: '0.8rem', padding: '4px 12px', whiteSpace: 'nowrap' }}
              >
                전체 보기
              </button>

              {filteredChannels.length === 0 && (
                <span style={{ color: '#999', fontSize: '0.8rem', padding: '6px' }}>채널이 없습니다. 발굴해보세요!</span>
              )}

              {filteredChannels.map(ch => (
                <button
                  key={ch.id}
                  className={`category-chip ${selectedDatingChannel === ch.id ? 'active' : ''}`}
                  onClick={() => setSelectedDatingChannel(ch.id)}
                  style={{ fontSize: '0.8rem', padding: '4px 12px', whiteSpace: 'nowrap' }}
                >
                  {ch.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedCategory === 'custom' && (
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', marginTop: '10px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '8px', color: '#ffd700' }}>⭐ AI 나만의 채널 큐레이터</h3>
            <p style={{ fontSize: '0.8rem', color: '#ccc', marginBottom: '12px' }}>
              관심있는 키워드(예: 주식, 캠핑, 요리)를 입력하면 AI가 관련 유튜버를 찾아내어<br />
              <b>실시간 RSS 피드(무료)</b>를 생성해줍니다.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="관심사 입력 (예: EPL 축구)"
                value={customKeyword}
                onChange={(e) => setCustomKeyword(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: '150px',
                  padding: '8px 12px',
                  borderRadius: '20px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white'
                }}
              />
              <button
                onClick={handleDiscoverInterest}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  background: 'linear-gradient(45deg, #ff9966, #ff5e62)',
                  border: 'none',
                  color: 'white',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer'
                }}
              >
                <Sparkles size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                채널 발굴
              </button>
            </div>

          </div>
        )}


        <form onSubmit={handleSearch} className="youtube-search-bar" style={{ marginTop: '15px' }}>
          <input
            type="text"
            placeholder="좋아하는 영상 검색 (100점 소모)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <button type="submit">
            <Search size={20} />
          </button>
        </form>
      </div>

      {loading ? (
        <div className="youtube-loading">
          <div className="loading-spinner"></div>
          <p>영상을 불러오는 중...</p>
        </div>
      ) : (
        <div className="video-grid">
          {videos
            .filter(v => !hideShorts || !v.isShort)
            .filter(v => {
              if (selectedCategory === 'dating') {
                // 1. 서브 카테고리 필터 (영상 태그 vs 현재 탭)
                const currentSub = datingSubCategory;
                const videoCategory = v.category || 'reality';
                if (videoCategory !== currentSub) return false;

                // 2. 특정 채널 선택 필터
                if (selectedDatingChannel) {
                  const targetName = datingChannels.find(c => c.id === selectedDatingChannel)?.name;
                  return v.channelTitle === targetName;
                }
              }

              if (selectedCategory === 'custom') {
                if (selectedInterestChannel) {
                  // ID로 정확하게 비교 (데이터에 channelId가 포함됨)
                  return v.channelId === selectedInterestChannel;
                }
              }
              return true;
            })
            .map((video) => (
              <div
                key={video.id}
                className="video-card glass-card"
                onClick={async () => {
                  // 로그 저장은 YoutubePlayer 내부에서 처리 (메타데이터 전달)
                  setSelectedVideo(video);
                }}
              >
                <div className="thumbnail-wrapper">
                  <img src={video.thumbnail} alt={video.title} loading="lazy" />
                  {video.isShort && <div className="shorts-badge">Shorts</div>}
                  <div className="play-overlay">
                    <PlayCircle size={48} color="white" />
                  </div>
                </div>

                <div className="video-info">
                  <h3 className="video-title">{video.title}</h3>
                  <div className="video-meta">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="channel-name">{video.channelTitle}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                      {video.viewCount && (
                        <span className="view-count">
                          <Eye size={12} style={{ marginRight: '4px' }} />
                          {formatViewCount(video.viewCount)}
                        </span>
                      )}
                      <span style={{ fontSize: '0.7rem', color: '#888' }}>
                        {formatTimeAgo(video.publishedAt)}
                      </span>
                    </div>
                  </div>

                  {/* 구독 버튼 (카드 하단에 눈에 띄게 배치) */}
                  {!mySubscriptions.some(ch => ch.channel_id === video.channelId) && (
                    <button
                      onClick={(e) => handleSubscribe(e, video)}
                      style={{
                        marginTop: '8px',
                        width: '100%',
                        padding: '8px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'linear-gradient(45deg, #4cd137, #44bd32)',
                        color: 'white',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <PlusCircle size={16} /> 구독하기
                    </button>
                  )}
                  {mySubscriptions.some(ch => ch.channel_id === video.channelId) && (
                    <button
                      onClick={(e) => handleUnsubscribe(e, video.channelId, video.channelTitle)}
                      style={{
                        marginTop: '8px',
                        width: '100%',
                        padding: '8px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'rgba(255,255,255,0.1)',
                        color: '#aaa',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.innerText = "💔 구독 취소";
                        e.currentTarget.style.background = "#ff4757";
                        e.currentTarget.style.color = "white";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.innerText = "✓ 구독 중";
                        e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                        e.currentTarget.style.color = "#aaa";
                      }}
                    >
                      ✓ 구독 중
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {selectedVideo && (
        <YoutubePlayer
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}

      {/* --- 우측 하단 플로팅 버튼 (사이드바 토글) --- */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          zIndex: 1000,
          background: showSidebar ? '#ff6b6b' : '#6c5ce7',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease'
        }}
      >
        {showSidebar ? <XCircle size={30} /> : <div style={{ fontSize: '24px' }}>❤️</div>}
      </button>

      {/* --- 관리자 수집기 --- */}
      <GlobalCollector />

      {/* --- 내 구독 사이드바 (Sliding Panel) --- */}
      <div
        className={`subscription-sidebar ${showSidebar ? 'open' : ''}`}
        style={{
          position: 'fixed',
          top: 0,
          right: showSidebar ? 0 : '-320px', // 토글 애니메이션
          width: '320px',
          height: '100vh',
          background: '#1e1e2e',
          boxShadow: '-5px 0 15px rgba(0,0,0,0.5)',
          padding: '20px',
          zIndex: 999,
          transition: 'right 0.3s ease-in-out',
          overflowY: 'auto'
        }}
      >
        <h3 style={{ marginTop: '40px', marginBottom: '20px', color: '#ff6b6b', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
          ❤️ 내 구독 리스트 ({mySubscriptions.length})
        </h3>

        {mySubscriptions.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666', marginTop: '50px' }}>
            <p>구독한 채널이 없습니다.</p>
            <p style={{ fontSize: '0.8rem', marginTop: '10px' }}>관심사 탭에서 채널을 발굴하고<br />구독 버튼을 눌러보세요!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {mySubscriptions.map(ch => (
              <div key={ch.channel_id} style={{
                background: 'rgba(255,255,255,0.05)',
                padding: '12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer', // 클릭 가능 표시
                transition: 'background 0.2s'
              }}
                className="sidebar-item"
                onClick={async () => {
                  // 클릭 시 해당 채널 영상 로드 (RSS)
                  setLoading(true);
                  try {
                    // getAdhocRssVideos는 배열을 받음
                    const data = await getAdhocRssVideos([{ id: ch.channel_id, name: ch.name }]);

                    if (data.items) {
                      const sorted = data.items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
                      setVideos(sorted);
                      setShowSidebar(false); // 사이드바 닫기
                      setSelectedCategory('custom'); // 영상 그리드 뷰로 전환

                      // 핵심 수정: 필터링을 위해 선택된 채널 ID 설정 (null이면 필터링 없이 다 보임, 여기선 명확히 지정)
                      setSelectedInterestChannel(ch.channel_id);

                      // 칩 UI 갱신을 위해 interestChannels에 이 채널이 없다면 임시로 추가해줄 수도 있음
                      // 하지만 복잡해지니 일단 필터만 맞춤

                      alert(`📺 '${ch.name}' 채널의 최신 영상을 불러왔습니다.`);
                    } else {
                      alert("영상을 불러올 수 없습니다.");
                    }
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setLoading(false);
                  }
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              >
                <div style={{ overflow: 'hidden', pointerEvents: 'none' }}> {/* 텍스트 클릭 통과 */}
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                    {ch.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#888' }}>
                    {new Date(ch.subscribed_at).toLocaleDateString()} 구독
                  </div>
                </div>
                <button
                  onClick={(e) => handleUnsubscribe(e, ch.channel_id, ch.name)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4757' }}
                  title="구독 취소"
                >
                  <XCircle size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
