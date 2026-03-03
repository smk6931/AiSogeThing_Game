import { useState } from 'react';
import { Plus, Heart, MessageCircle } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import './Community.css';

export default function Community() {
  const [posts] = useState([
    {
      id: 1,
      author: '익명의 토끼',
      title: '첫 데이트 장소 추천 부탁드려요!',
      content: '매칭된 분과 처음 만나는데 어디가 좋을까요? 서울 강남 쪽으로...',
      likes: 24,
      comments: 12,
      timeAgo: '10분 전',
      category: '데이트 고민'
    },
    {
      id: 2,
      author: '연애 초보',
      title: 'AI 매칭이 진짜 정확하네요 ㄷㄷ',
      content: '92% 매칭이라길래 반신반의했는데, 만나보니까 진짜 취향이 똑같아서...',
      likes: 156,
      comments: 47,
      timeAgo: '1시간 전',
      category: '후기'
    },
    {
      id: 3,
      author: '소개팅 전문가',
      title: '매칭율 높이는 꿀팁 공유합니다',
      content: 'YouTube 시청기록은 최소 100개 이상, 채팅 분석은...',
      likes: 89,
      comments: 31,
      timeAgo: '3시간 전',
      category: '팁 공유'
    },
  ]);

  return (
    <div className="community">
      <div className="community__container">
        <header className="community__header">
          <div>
            <h1 className="community__title">커뮤니티</h1>
            <p className="community__subtitle">연애 고민과 경험을 나눠보세요</p>
          </div>
          <Button variant="primary" icon={<Plus size={20} />}>
            글쓰기
          </Button>
        </header>

        <div className="community__categories">
          {['전체', '데이트 고민', '후기', '팁 공유', '자유'].map((category) => (
            <button key={category} className="community__category">
              {category}
            </button>
          ))}
        </div>

        <div className="community__posts">
          {posts.map((post) => (
            <Card key={post.id} variant="glass" padding="medium" hover className="community__post">
              <div className="community__post-header">
                <span className="community__post-author">{post.author}</span>
                <span className="community__post-category">{post.category}</span>
              </div>

              <h3 className="community__post-title">{post.title}</h3>
              <p className="community__post-content">{post.content}</p>

              <div className="community__post-footer">
                <div className="community__post-stats">
                  <span className="community__post-stat">
                    <Heart size={16} />
                    {post.likes}
                  </span>
                  <span className="community__post-stat">
                    <MessageCircle size={16} />
                    {post.comments}
                  </span>
                </div>
                <span className="community__post-time">{post.timeAgo}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
