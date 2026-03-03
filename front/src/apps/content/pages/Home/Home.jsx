import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal, Bookmark } from 'lucide-react';
import Card from '../../components/common/Card';
import './Home.css';

export default function Home() {
  // 임시 피드 데이터 (랜덤 이미지 사용)
  const [posts, setPosts] = useState([
    {
      id: 1,
      user: {
        name: '지수',
        avatar: 'https://i.pravatar.cc/150?u=1',
        location: '서울 성수동'
      },
      image: 'https://picsum.photos/600/600?random=1',
      likes: 124,
      caption: '주말 데이트하기 딱 좋은 카페 발견! ☕️ 분위기 너무 깡패...',
      timeAgo: '2시간 전',
      comments: 18,
      isLiked: true
    },
    {
      id: 2,
      user: {
        name: '민준',
        avatar: 'https://i.pravatar.cc/150?u=2',
        location: '한강공원'
      },
      image: 'https://picsum.photos/600/600?random=2',
      likes: 89,
      caption: '날씨가 너무 좋아서 러닝하러 나왔다 🏃‍♂️ 같이 뛰실 분?',
      timeAgo: '4시간 전',
      comments: 5,
      isLiked: false
    },
    {
      id: 3,
      user: {
        name: '서연',
        avatar: 'https://i.pravatar.cc/150?u=3',
        location: '전시회'
      },
      image: 'https://picsum.photos/600/600?random=3',
      likes: 256,
      caption: '오랜만에 문화생활 ✨ 색감이 너무 예쁘다',
      timeAgo: '6시간 전',
      comments: 42,
      isLiked: false
    },
    {
      id: 4,
      user: {
        name: '승우',
        avatar: 'https://i.pravatar.cc/150?u=4',
        location: '을지로'
      },
      image: 'https://picsum.photos/600/600?random=4',
      likes: 67,
      caption: '힙지로 감성 제대로네 📸',
      timeAgo: '12시간 전',
      comments: 8,
      isLiked: true
    }
  ]);

  /* 무한 스크롤 로직 */
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // 스크롤이 바닥에 가까워지면 (여유분 100px)
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 100 &&
        !loading
      ) {
        loadMorePosts();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading]);

  const loadMorePosts = () => {
    if (loading) return;
    setLoading(true);

    // 1.5초 뒤에 더미 데이터 추가 (API 호출 시뮬레이션)
    setTimeout(() => {
      const newPosts = Array.from({ length: 4 }).map((_, i) => ({
        id: posts.length + i + 1 + Date.now(), // 고유 ID 생성 (Date.now 추가)
        user: {
          name: `유저${Math.floor(Math.random() * 100)}`,
          avatar: `https://i.pravatar.cc/150?u=${posts.length + i + 10}`,
          location: '새로운 핫플레이스'
        },
        image: `https://picsum.photos/600/600?random=${Date.now() + i}`, // 새로운 랜덤 이미지
        likes: Math.floor(Math.random() * 300),
        caption: `새로 불러온 게시물입니다 ✨ #${posts.length + i + 1}`,
        timeAgo: '방금 전',
        comments: Math.floor(Math.random() * 50),
        isLiked: false
      }));

      setPosts(prev => [...prev, ...newPosts]);
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="home">
      <div className="home__container">
        <header className="home__header">
          <h1 className="home__logo">AiSogeThing</h1>
        </header>

        <div className="home__feed">
          {posts.map((post) => (
            <Card key={post.id} variant="glass" padding="none" className="post-card">
              {/* 게시물 헤더 */}
              <div className="post-card__header">
                <div className="post-card__user-info">
                  <img src={post.user.avatar} alt={post.user.name} className="post-card__avatar" />
                  <div className="post-card__meta">
                    <span className="post-card__username">{post.user.name}</span>
                    <span className="post-card__location">{post.user.location}</span>
                  </div>
                </div>
                <button className="post-card__more">
                  <MoreHorizontal size={20} />
                </button>
              </div>

              {/* 게시물 이미지 */}
              <div className="post-card__image-container">
                <img src={post.image} alt="Post content" className="post-card__image" />
              </div>

              {/* 게시물 액션 버튼 */}
              <div className="post-card__actions">
                <div className="post-card__actions-left">
                  <button className={`action-btn ${post.isLiked ? 'active' : ''}`}>
                    <Heart size={24} fill={post.isLiked ? "#f5576c" : "none"} />
                  </button>
                  <button className="action-btn">
                    <MessageCircle size={24} />
                  </button>
                  <button className="action-btn">
                    <Share2 size={24} />
                  </button>
                </div>
                <button className="action-btn">
                  <Bookmark size={24} />
                </button>
              </div>

              {/* 게시물 내용 */}
              <div className="post-card__content">
                <p className="post-card__likes">좋아요 {post.likes}개</p>
                <div className="post-card__caption">
                  <span className="post-card__username">{post.user.name}</span>
                  <span className="post-card__text">{post.caption}</span>
                </div>
                <p className="post-card__comments">댓글 {post.comments}개 모두 보기</p>
                <p className="post-card__time">{post.timeAgo}</p>
              </div>
            </Card>
          ))}
        </div>

        {loading && (
          <div className="home__loading">
            <div className="home__spinner"></div>
          </div>
        )}
      </div>
    </div>
  );
}
