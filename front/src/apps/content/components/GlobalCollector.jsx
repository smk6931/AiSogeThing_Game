import React, { useState, useEffect } from 'react';
import { Download, Loader, Check, X, ShieldCheck, RefreshCw, Video, Users, ChevronDown, ChevronUp } from 'lucide-react';
import client from '@api/client';

export default function GlobalCollector({ embedded = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('videos'); // 'videos' | 'channels'
  const [loading, setLoading] = useState(false);
  const [activeCountry, setActiveCountry] = useState('KR');

  // 수집 완료된 항목들 (LocalStorage 관리)
  const [collectedItems, setCollectedItems] = useState(new Set());

  // 국가 목록
  const countries = [
    { code: null, name: '🌍 전체' },
    { code: 'KR', name: '🇰🇷 한국' },
    { code: 'US', name: '🇺🇸 미국' },
    { code: 'JP', name: '🇯🇵 일본' },
    { code: 'CA', name: '🇨🇦 캐나다' },
    { code: 'GB', name: '🇬🇧 영국' },
    { code: 'AU', name: '🇦🇺 호주' },
    { code: 'DE', name: '🇩🇪 독일' },
    { code: 'FR', name: '🇫🇷 프랑스' },
    { code: 'VN', name: '🇻🇳 베트남' },
    { code: 'TH', name: '🇹🇭 태국' },
    { code: 'TW', name: '🇹🇼 대만' },
  ];

  // 카테고리 목록 (유튜브 공식 ID 기준)
  const categories = [
    { id: null, name: '🔥 전체 인기' },
    { id: '10', name: '🎵 음악' },
    { id: '20', name: '🎮 게임' },
    { id: '24', name: '📺 엔터테인먼트' },
    { id: '23', name: '🤣 코미디' },
    { id: '17', name: '⚽ 스포츠' },
    { id: '25', name: '📰 뉴스/정치' },
    { id: '22', name: '✨ 인물/블로그' },
    { id: '1', name: '🎬 영화/애니' },
    { id: '26', name: '💄 스타일/뷰티' },
    { id: '27', name: '🏫 교육' },
    { id: '28', name: '🚀 과학기술' },
    { id: '15', name: '🐶 반려동물' },
    { id: '2', name: '🚗 자동차' },
    { id: '19', name: '✈️ 여행/이벤트' },
  ];

  // 로컬스토리지 키 생성 (날짜별 초기화)
  const getStorageKey = () => {
    const today = new Date().toISOString().split('T')[0];
    return `collected_v1_${today}`;
  };

  useEffect(() => {
    // 초기 로드 시 수집 목록 복원
    const key = getStorageKey();
    const saved = localStorage.getItem(key);
    if (saved) {
      setCollectedItems(new Set(JSON.parse(saved)));
    }
  }, []);

  const handleCollect = async (category) => {
    const itemKey = `${activeCountry}-${category.id}`;
    if (collectedItems.has(itemKey)) return;

    setLoading(itemKey);
    try {
      await client.post('/api/youtube/admin/collect-one', {
        country: activeCountry,
        category: category.id || null
      });

      const key = getStorageKey();
      const newSet = new Set(collectedItems);
      newSet.add(itemKey);
      setCollectedItems(newSet);
      localStorage.setItem(key, JSON.stringify([...newSet]));

    } catch (error) {
      console.error(error);
      alert('요청 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (confirm('오늘 수집한 기록(체크 표시)을 초기화하시겠습니까?\n다시 수집할 수 있게 됩니다.')) {
      const key = getStorageKey();
      localStorage.removeItem(key);
      setCollectedItems(new Set());
    }
  };

  if (!isOpen && !embedded) {
    const isMobile = window.innerWidth < 768;
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: isMobile ? '70px' : '20px',
          right: isMobile ? '10px' : '90px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '50px',
          padding: isMobile ? '10px 18px' : '12px 24px',
          boxShadow: '0 4px 15px rgba(255, 107, 107, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 'bold',
          fontSize: isMobile ? '0.85rem' : '1rem',
          transition: 'transform 0.2s',
          letterSpacing: '0.5px'
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        <Download size={isMobile ? 16 : 20} />
        {isMobile ? 'Collect' : 'Admin Collect'}
      </button>
    );
  }

  // Styles based on embedded prop
  const containerStyle = embedded ? {
    width: '100%',
    height: '100%',
    background: 'transparent',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    animation: 'fadeIn 0.2s ease-out',
    // Embedded일 때는 스크롤을 외부에서 제어하거나, 내부에서 full height
  } : {
    position: 'fixed',
    bottom: window.innerWidth < 768 ? '10px' : '80px',
    right: window.innerWidth < 768 ? '10px' : '20px',
    left: window.innerWidth < 768 ? '10px' : 'auto',
    zIndex: 9999,
    background: 'rgba(30, 30, 46, 0.98)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '20px',
    width: window.innerWidth < 768 ? 'calc(100% - 20px)' : '700px',
    maxWidth: '100%',
    maxHeight: window.innerWidth < 768 ? 'calc(100vh - 100px)' : '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
    color: 'white',
    overflow: 'hidden',
    animation: 'fadeIn 0.2s ease-out'
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: embedded ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.2)'
      }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700 }}>
          <ShieldCheck size={24} color="#FF6B6B" />
          글로벌 트렌드 수집기
        </h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleReset}
            title="수집 기록 초기화 (다시 수집)"
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '5px' }}
          >
            <RefreshCw size={20} />
          </button>
          {!embedded && (
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: '5px' }}
            >
              <X size={24} />
            </button>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        gap: '12px',
        padding: '16px 20px 0 20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <button
          onClick={() => setActiveTab('videos')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '12px 12px 0 0',
            border: 'none',
            background: activeTab === 'videos' ? 'rgba(255, 107, 107, 0.2)' : 'rgba(255,255,255,0.05)',
            color: activeTab === 'videos' ? '#FF6B6B' : '#888',
            fontWeight: activeTab === 'videos' ? 'bold' : 'normal',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <Video size={18} />
          영상 수집
        </button>
        <button
          onClick={() => setActiveTab('channels')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '12px 12px 0 0',
            border: 'none',
            background: activeTab === 'channels' ? 'rgba(255, 107, 107, 0.2)' : 'rgba(255,255,255,0.05)',
            color: activeTab === 'channels' ? '#FF6B6B' : '#888',
            fontWeight: activeTab === 'channels' ? 'bold' : 'normal',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <Users size={18} />
          채널 수집
        </button>
      </div>

      {/* Content Area (Scrollable) */}
      {activeTab === 'videos' ? (
        <VideoCollectionTab
          countries={countries}
          categories={categories}
          activeCountry={activeCountry}
          setActiveCountry={setActiveCountry}
          collectedItems={collectedItems}
          loading={loading}
          handleCollect={handleCollect}
        />
      ) : (
        <ChannelCollectionTab />
      )}

      <div style={{
        padding: '15px',
        background: 'rgba(0,0,0,0.3)',
        fontSize: '0.8rem',
        color: '#666',
        textAlign: 'center',
        borderTop: '1px solid rgba(255,255,255,0.05)'
      }}>
        * 클릭 시 즉시 수집 시작 · 수집 결과는 자동 저장됩니다.
      </div>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes loadingBar { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
      `}</style>
    </div>
  );
}

// ========== 영상 수집 탭 ==========
function VideoCollectionTab({ countries, categories, activeCountry, setActiveCountry, collectedItems, loading, handleCollect }) {
  return (
    <div style={{ padding: '20px', overflowY: 'auto' }}>
      {/* Country Tabs */}
      <div style={{ marginBottom: '10px', fontSize: '0.9rem', color: '#bbb', fontWeight: 600 }}>📡 타겟 국가 선택</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
        gap: '8px',
        marginBottom: '25px',
      }}>
        {countries.map(c => (
          <button
            key={c.code}
            onClick={() => setActiveCountry(c.code)}
            style={{
              padding: '10px',
              borderRadius: '12px',
              border: activeCountry === c.code ? '2px solid #FF6B6B' : '1px solid rgba(255,255,255,0.1)',
              background: activeCountry === c.code ? 'rgba(255, 107, 107, 0.15)' : 'rgba(255,255,255,0.03)',
              color: activeCountry === c.code ? '#FF6B6B' : '#888',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: activeCountry === c.code ? 'bold' : 'normal',
              transition: 'all 0.2s',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Categories Grid */}
      <div style={{ marginBottom: '10px', fontSize: '0.9rem', color: '#bbb', fontWeight: 600 }}>🎯 수집 카테고리</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px'
      }}>
        {categories.map(cat => {
          const itemKey = `${activeCountry}-${cat.id}`;
          const isCollected = collectedItems.has(itemKey);
          const isLoading = loading === itemKey;

          return (
            <button
              key={cat.id || 'all'}
              onClick={() => handleCollect(cat)}
              disabled={isCollected || loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '15px',
                borderRadius: '12px',
                border: 'none',
                background: isCollected
                  ? 'linear-gradient(135deg, rgba(46, 213, 115, 0.2), rgba(46, 213, 115, 0.1))'
                  : 'rgba(255,255,255,0.05)',
                color: isCollected ? '#2ed573' : '#eee',
                cursor: (isCollected || loading) ? 'default' : 'pointer',
                opacity: (isCollected || loading) ? 0.7 : 1,
                fontSize: '0.95rem',
                fontWeight: 500,
                textAlign: 'left',
                transition: 'all 0.2s',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseOver={(e) => !isCollected && !loading && (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              onMouseOut={(e) => !isCollected && !loading && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            >
              <span>{cat.name}</span>
              {isLoading ? (
                <Loader size={18} className="spin" color="#FF6B6B" />
              ) : isCollected ? (
                <Check size={18} />
              ) : (
                <Download size={18} style={{ opacity: 0.3 }} />
              )}

              {isLoading && (
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, height: '3px', background: '#FF6B6B',
                  width: '100%', animation: 'loadingBar 2s infinite ease-in-out'
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ========== 채널 수집 탭 (NEW!) ==========
function ChannelCollectionTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedChannel, setExpandedChannel] = useState(null);
  const [channelVideos, setChannelVideos] = useState({});

  const handleSearch = async () => {
    if (!searchQuery.trim()) return alert('검색어를 입력해주세요');

    setLoading(true);
    try {
      const res = await client.get(`/api/youtube/search/channels?query=${encodeURIComponent(searchQuery)}&limit=15`);
      setChannels(res.data.channels || []);
    } catch (error) {
      console.error(error);
      alert('채널 검색 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleChannelToggle = async (channel) => {
    if (expandedChannel === channel.id) {
      setExpandedChannel(null);
    } else {
      setExpandedChannel(channel.id);

      // 영상 로드 (RSS)
      if (!channelVideos[channel.id]) {
        try {
          const res = await client.post('/api/youtube/interest/rss', {
            channels: [{ id: channel.id, name: channel.name }]
          });
          setChannelVideos(prev => ({
            ...prev,
            [channel.id]: res.data.items || []
          }));
        } catch (error) {
          console.error(error);
        }
      }
    }
  };

  const handleSubscribe = async (channel) => {
    try {
      await client.post('/api/youtube/channel/subscribe', {
        channel_id: channel.id
      });
      alert(`✅ "${channel.name}" 채널을 구독했습니다!`);
    } catch (error) {
      console.error(error);
      alert('구독 실패');
    }
  };

  return (
    <div style={{ padding: '20px', overflowY: 'auto' }}>
      {/* Search Input */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px', fontSize: '0.9rem', color: '#bbb', fontWeight: 600 }}>🔍 채널 검색</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="검색어 (예: EPL 축구, 게임)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: 'white',
              fontSize: '0.95rem'
            }}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #FF6B6B, #FF8E53)',
              color: 'white',
              fontWeight: 'bold',
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? '검색중...' : '검색'}
          </button>
        </div>
        <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#888' }}>
          💡 검색 시 자동으로 모든 채널이 DB에 저장됩니다
        </div>
      </div>

      {/* Channel List */}
      {channels.length > 0 && (
        <div>
          <div style={{ marginBottom: '10px', fontSize: '0.9rem', color: '#bbb', fontWeight: 600 }}>
            📺 검색 결과 ({channels.length}개)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {channels.map((channel) => (
              <div key={channel.id} style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                overflow: 'hidden'
              }}>
                {/* Channel Header */}
                <div
                  onClick={() => handleChannelToggle(channel)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {channel.thumbnail ? (
                    <img src={channel.thumbnail} alt={channel.name} style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      objectFit: 'cover'
                    }} />
                  ) : (
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #FF6B6B, #FF8E53)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      fontWeight: 'bold',
                      color: 'white'
                    }}>
                      {channel.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem' }}>{channel.name}</div>
                    <div style={{ color: '#888', fontSize: '0.85rem' }}>활성 채널</div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSubscribe(channel);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      color: 'white',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    구독
                  </button>

                  {expandedChannel === channel.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>

                {/* Channel Videos (Expanded) */}
                {expandedChannel === channel.id && (
                  <div style={{
                    padding: '12px',
                    background: 'rgba(0,0,0,0.3)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: '12px'
                  }}>
                    {channelVideos[channel.id] ? (
                      channelVideos[channel.id].length > 0 ? (
                        channelVideos[channel.id].map((video) => (
                          <div key={video.id} style={{
                            cursor: 'pointer',
                            transition: 'transform 0.2s'
                          }}>
                            <img src={video.thumbnail} alt={video.title} style={{
                              width: '100%',
                              aspectRatio: '16/9',
                              objectFit: 'cover',
                              borderRadius: '8px'
                            }} />
                            <div style={{
                              color: '#ccc',
                              fontSize: '0.85rem',
                              marginTop: '6px',
                              lineHeight: '1.3',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}>
                              {video.title}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ color: '#888', padding: '20px', textAlign: 'center' }}>영상이 없습니다</div>
                      )
                    ) : (
                      <div style={{ color: '#888', padding: '20px', textAlign: 'center' }}>영상을 불러오는 중...</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
