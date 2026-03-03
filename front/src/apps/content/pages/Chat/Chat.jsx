import { MessageCircle } from 'lucide-react';
import Card from '../../components/common/Card';
import './Chat.css';

export default function Chat() {
  const chats = [
    { id: 1, name: '지수', lastMessage: '내일 시간 괜찮으세요?', time: '방금', unread: 2, online: true },
    { id: 2, name: '민준', lastMessage: '그 영화 정말 재밌더라구요', time: '10분 전', unread: 0, online: true },
    { id: 3, name: '서연', lastMessage: '사진 감사합니다!', time: '1시간 전', unread: 1, online: false },
  ];

  return (
    <div className="chat">
      <div className="chat__container">
        <header className="chat__header">
          <h1 className="chat__title">
            <MessageCircle size={24} />
            채팅
          </h1>
        </header>

        <div className="chat__list">
          {chats.map((chat) => (
            <Card key={chat.id} variant="glass" padding="medium" hover className="chat__item">
              <div className="chat__avatar-wrapper">
                <img
                  src={`https://placehold.co/60`}
                  alt={chat.name}
                  className="chat__avatar"
                />
                {chat.online && <span className="chat__online-badge"></span>}
              </div>

              <div className="chat__content">
                <div className="chat__top">
                  <h3 className="chat__name">{chat.name}</h3>
                  <span className="chat__time">{chat.time}</span>
                </div>
                <div className="chat__bottom">
                  <p className="chat__message">{chat.lastMessage}</p>
                  {chat.unread > 0 && (
                    <span className="chat__unread">{chat.unread}</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
