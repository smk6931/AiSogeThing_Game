import { useState, useEffect } from 'react';
import { X, User, MessageCircle, UserPlus } from 'lucide-react';
import userApi from '@api/auth/auth';
import { useAuth } from '@shared/context/AuthContext';
import UserProfile from '../UserProfile';
import './OnlineUsersModal.css';

export default function OnlineUsersModal({ isOpen, onClose }) {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('online'); // 'online' | 'all'
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen, activeTab]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      if (activeTab === 'online') {
        const response = await userApi.getOnlineUsersDetail();
        setUsers(response.data.users);
      } else {
        const response = await userApi.getAllUsers();
        setUsers(response.data.users);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // 오프라인 유저인지 판단 (5분 기준)
  const isUserOffline = (lastActive) => {
    if (!lastActive) return true;
    const diff = new Date() - new Date(lastActive);
    return diff > 5 * 60 * 1000;
  };

  return (
    <>
      <div className="online-modal-overlay" onClick={onClose}>
        <div className="online-modal" onClick={(e) => e.stopPropagation()}>
          <div className="online-modal__header" style={{ flexDirection: 'column', paddingBottom: 0, gap: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: '15px' }}>
              <h3>이웃 목록</h3>
              <button className="online-modal__close" onClick={onClose}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-tabs" style={{ display: 'flex', width: '100%', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                onClick={() => setActiveTab('online')}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'online' ? '2px solid #10B981' : '2px solid transparent',
                  color: activeTab === 'online' ? '#10B981' : '#888',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                🟢 접속 중
              </button>
              <button
                onClick={() => setActiveTab('all')}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'all' ? '2px solid #6c5ce7' : '2px solid transparent',
                  color: activeTab === 'all' ? '#6c5ce7' : '#888',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                👥 전체 이웃
              </button>
            </div>
          </div>

          <div className="online-modal__content">
            {loading ? (
              <div className="online-modal__loading">
                <div className="spinner"></div>
              </div>
            ) : (
              <div className="user-list">
                {users.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>
                    {activeTab === 'online' ? '접속 중인 이웃이 없습니다.' : '등록된 이웃이 없습니다.'}
                  </p>
                )}
                {users.map((u) => {
                  const isMe = currentUser && currentUser.user_id === u.id;
                  const isOffline = activeTab === 'all' && isUserOffline(u.last_active_at);
                  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nickname)}&background=${isOffline ? '999' : '667eea'}&color=fff&size=64`;

                  return (
                    <div
                      key={u.id}
                      className={`user-item ${isMe ? 'me' : 'clickable'}`}
                      onClick={isMe ? undefined : () => setSelectedUserId(u.uuid)}
                      style={{
                        cursor: isMe ? 'default' : 'pointer',
                        opacity: isOffline ? 0.7 : 1
                      }}
                    >
                      <div className="user-item__info">
                        <div style={{ position: 'relative' }}>
                          <img src={avatarUrl} alt={u.nickname} className="user-item__avatar" style={{ filter: isOffline ? 'grayscale(100%)' : 'none' }} />
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: isOffline ? '#999' : '#10B981',
                            border: '2px solid #1a1a2e'
                          }}></div>
                        </div>
                        <div>
                          <div className="user-item__name">
                            {u.nickname}
                            {isMe && <span className="me-badge">나</span>}
                          </div>
                          <div className="user-item__status">
                            {isOffline ? (u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : '활동 없음') : '🟢 활동 중'}
                          </div>
                        </div>
                      </div>

                      {!isMe && (
                        <div className="user-item__actions">
                          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); /* 친구추가 */ }}>
                            <UserPlus size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* UserProfile 모달 */}
      {selectedUserId && (
        <UserProfile
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </>
  );
}
