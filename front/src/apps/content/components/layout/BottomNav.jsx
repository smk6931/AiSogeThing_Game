import { NavLink } from 'react-router-dom';
import { Home, Heart, MessageCircle, Users, User, MapPin, Youtube, BookOpen } from 'lucide-react';
import { useAuth } from '@shared/context/AuthContext';
import './BottomNav.css';

export default function BottomNav() {
  const { user } = useAuth();

  const navItems = [
    { to: '/home', icon: Home, label: '홈' },
    { to: '/hotplace', icon: MapPin, label: '핫플' },
    { to: '/youtube', icon: Youtube, label: 'YouTube' },
    { to: '/novel', icon: BookOpen, label: '웹툰' },
    { to: '/matching', icon: Heart, label: '매칭' },
    { to: '/chat', icon: MessageCircle, label: '채팅' },
    { to: '/community', icon: Users, label: '커뮤니티' },
    { to: '/mypage', icon: User, label: '마이' },
  ];

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav__container">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isMyPage = item.to === '/mypage';

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`
              }
            >
              {isMyPage && user ? (
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.nickname)}&background=667eea&color=fff&size=64`}
                  alt={user.nickname}
                  className="bottom-nav__avatar"
                />
              ) : (
                <Icon size={24} />
              )}
              <span className="bottom-nav__label">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
