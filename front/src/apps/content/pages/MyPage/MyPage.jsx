import { useState, useEffect } from 'react';
import { Settings, Grid, Heart, LogOut, History, PlayCircle } from 'lucide-react';
import { useAuth } from '@shared/context/AuthContext';
import { getHistory, getMySubscriptions } from '@api/content/youtube';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import AuthModal from '../../components/common/AuthModal';
import './MyPage.css';

export default function MyPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('feed');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [viewHistory, setViewHistory] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);

  // 더미 데이터 (나중에 API 연동)
  const [posts] = useState([
    { id: 1, image: 'https://placehold.co/300/2a2a2a', likes: 45 },
    { id: 2, image: 'https://placehold.co/300/333333', likes: 32 },
    { id: 3, image: 'https://placehold.co/300/1a1a1a', likes: 67 },
  ]);

  // 데이터 로드
  useEffect(() => {
    if (!user) return;

    if (activeTab === 'activity') {
      getHistory().then(data => {
        if (Array.isArray(data)) {
          setViewHistory(data);
        }
      }).catch(err => console.error(err));
    } else if (activeTab === 'subscriptions') {
      getMySubscriptions().then(data => {
        if (data.channels) {
          setSubscriptions(data.channels);
        }
      }).catch(err => console.error(err));
    }
  }, [user, activeTab]);

  // 비로그인 상태 처리
  if (!user) {
    return (
      <div className="mypage">
        <div className="mypage__container" style={{ justifyContent: 'center', height: '80vh' }}>
          <Card variant="glass" padding="large" className="mypage__login-card">
            <h2 className="mypage__login-title">로그인이 필요해요 🔒</h2>
            <p className="mypage__login-desc">나만의 프로필을 만들고 활동해보세요!</p>
            <Button variant="primary" onClick={() => setShowLoginModal(true)}>
              로그인 / 회원가입
            </Button>
          </Card>
          <AuthModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
        </div>
      </div>
    );
  }

  // 아바타 생성
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nickname)}&background=667eea&color=fff&size=128`;

  return (
    <div className="mypage">
      <div className="mypage__container">
        <Card variant="glass" padding="large" className="mypage__profile">
          <div className="mypage__profile-header">
            <img
              src={avatarUrl}
              alt={user.nickname}
              className="mypage__profile-photo"
            />
            <button className="mypage__settings">
              <Settings size={20} />
            </button>
          </div>

          <h2 className="mypage__name">{user.nickname}</h2>
          <p className="mypage__email">@{user.email.split('@')[0]}</p>
          <p className="mypage__bio">아직 소개가 없습니다. 프로필을 꾸며보세요! ✨</p>

          <div className="mypage__stats">
            <div className="mypage__stat">
              <div className="mypage__stat-value">{viewHistory.length || 0}</div>
              <div className="mypage__stat-label">시청 기록</div>
            </div>
            <div className="mypage__stat">
              <div className="mypage__stat-value">{subscriptions.length || 0}</div>
              <div className="mypage__stat-label">구독 채널</div>
            </div>
            <div className="mypage__stat">
              <div className="mypage__stat-value">0</div>
              <div className="mypage__stat-label">좋아요</div>
            </div>
          </div>

          <div className="mypage__actions">
            <Button variant="outline" fullWidth icon={<LogOut size={18} />} onClick={logout}>
              로그아웃
            </Button>
          </div>
        </Card>

        {/* 탭 영역 */}
        <div className="mypage__tabs">
          <button
            className={`mypage__tab ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveTab('feed')}
          >
            <Grid size={20} />
            <span>피드</span>
          </button>
          <button
            className={`mypage__tab ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            <History size={20} />
            <span>시청 기록</span>
          </button>
          <button
            className={`mypage__tab ${activeTab === 'subscriptions' ? 'active' : ''}`}
            onClick={() => setActiveTab('subscriptions')}
          >
            <PlayCircle size={20} />
            <span>구독 채널</span>
          </button>
          <button
            className={`mypage__tab ${activeTab === 'liked' ? 'active' : ''}`}
            onClick={() => setActiveTab('liked')}
          >
            <Heart size={20} />
            <span>좋아요</span>
          </button>
        </div>

        <div className="mypage__grid">
          {activeTab === 'feed' && posts.map((post) => (
            <div key={post.id} className="mypage__post">
              <img src={post.image} alt="" className="mypage__post-image" />
              <div className="mypage__post-overlay">
                <Heart size={20} />
                <span>{post.likes}</span>
              </div>
            </div>
          ))}

          {activeTab === 'activity' && viewHistory.map((video, idx) => (
            <div key={`${video.video_id}-${idx}`} className="mypage__post" onClick={() => window.open(`https://youtu.be/${video.video_id}`, '_blank')}>
              <img src={video.thumbnail_url} alt={video.title} className="mypage__post-image" style={{ objectFit: 'cover' }} />
              <div className="mypage__post-overlay">
                <PlayCircle size={32} />
                <span style={{ fontSize: '0.8rem', marginTop: '4px', textAlign: 'center', padding: '0 10px' }}>
                  {video.title.length > 20 ? video.title.substring(0, 20) + '...' : video.title}
                </span>
              </div>
            </div>
          ))}

          {activeTab === 'subscriptions' && subscriptions.map((ch, idx) => (
            <div key={`${ch.channel_id}-${idx}`} className="mypage__post" onClick={() => window.open(`https://youtube.com/channel/${ch.channel_id}`, '_blank')}>
              <img
                src={ch.thumbnail_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(ch.name)}&background=random`}
                alt={ch.name}
                className="mypage__post-image"
                style={{ objectFit: 'cover' }}
              />
              <div className="mypage__post-overlay">
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', textAlign: 'center', padding: '0 10px' }}>
                  {ch.name}
                </span>
                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                  {new Date(ch.subscribed_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}

          {activeTab === 'activity' && viewHistory.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#888' }}>
              아직 시청 기록이 없어요 😢<br /> 유튜브 라운지에서 영상을 시청해보세요!
            </div>
          )}

          {activeTab === 'subscriptions' && subscriptions.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#888' }}>
              아직 구독한 채널이 없어요 📺<br /> 마음에 드는 채널을 구독해보세요!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
