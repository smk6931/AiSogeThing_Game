import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Image as ImageIcon, Info, BookOpen, AlertTriangle } from 'lucide-react';
import { listNovels } from '@api/content/novel';
import client from '@api/client';
import './NovelList.css';

const NovelList = ({ onNavigate }) => {
  const [novels, setNovels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState(null);

  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const ADMIN_PASSWORD = "asd789";

  useEffect(() => {
    fetchNovels();
  }, []);

  const fetchNovels = async () => {
    try {
      const data = await listNovels();
      if (Array.isArray(data)) {
        setNovels(data);
        setDebugInfo(null);
      } else {
        console.warn("Invalid novels data:", data);
        setNovels([]);
        if (typeof data === 'string' && data.includes('<!doctype html>')) {
          setDebugInfo({
            type: 'API_MISCONFIG',
            message: 'API 요청이 프론트엔드 페이지를 반환했습니다. 백엔드 연결 실패.',
            response: data.substring(0, 100) + "...",
            currentApiUrl: client.defaults.baseURL
          });
        } else {
          setDebugInfo({ type: 'INVALID_DATA', data });
        }
      }
    } catch (err) {
      console.error(err);
      setNovels([]);
      setDebugInfo({
        type: 'NETWORK_ERROR',
        message: err.message,
        currentApiUrl: client.defaults.baseURL
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClick = (e) => {
    e.preventDefault();
    setShowAuthModal(true);
  };

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setShowAuthModal(false);
      setPassword('');

      // onNavigate가 있으면(게임 모드) 내부 이동, 없으면 URL 이동
      if (onNavigate) {
        onNavigate('NOVEL_CREATE');
      } else {
        window.location.href = "/novel/create";
      }
    } else {
      setErrorMsg("관리자 암호가 일치하지 않습니다.");
    }
  };

  // 상세 페이지 이동 핸들러
  const handleNovelClick = (e, novelId) => {
    if (onNavigate) {
      e.preventDefault(); // URL 이동 막고
      onNavigate('NOVEL_DETAIL', novelId); // 내부 상태로 이동
    }
  };

  const getImageUrl = (path) => {
    if (!path) return null;
    let cleanPath = path;
    if (cleanPath.startsWith('/novel/') && !cleanPath.startsWith('/api/novel/')) {
      cleanPath = '/api' + cleanPath;
    }
    return `${client.defaults.baseURL}${cleanPath}`;
  };

  return (
    <div className="novel-list-page">
      {/* Header */}
      <div className="novel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 className="novel-title">AI Webtoon Gallery</h1>
          <Link to="#" onClick={handleCreateClick} className="create-btn"><Plus size={24} /></Link>
          <Link to="/novel/portfolio" className="portfolio-link" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>
            <Info size={16} /> <span>About</span>
          </Link>
        </div>
      </div>

      {/* ERROR PANEL */}
      {debugInfo && (
        <div style={{ background: '#330000', color: '#ffaaaa', padding: '15px', margin: '20px', borderRadius: '8px', border: '1px solid red', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><AlertTriangle size={16} /> API Connection Error</h3>
          <p><strong>Status:</strong> {debugInfo.type}</p>
          <button onClick={fetchNovels} style={{ marginTop: '10px', background: '#550000', color: 'white', border: '1px solid #770000', padding: '5px 10px', cursor: 'pointer' }}>Retry Connection</button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="loading-state"><div className="loading-spinner-small"></div></div>
      ) : novels.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={48} className="empty-icon" />
          <p>아직 생성된 웹툰이 없습니다.</p>
        </div>
      ) : (
        <div className="novel-grid">
          {novels.map((novel) => (
            <Link
              to={`/novel/${novel.id}`}
              key={novel.id}
              className="novel-card"
              onClick={(e) => handleNovelClick(e, novel.id)}
            >
              <div className="card-thumbnail">
                {novel.thumbnail_image ? (
                  <img src={getImageUrl(novel.thumbnail_image)} alt={novel.title} loading="lazy" />
                ) : (
                  <div className="thumbnail-placeholder"><ImageIcon size={32} /></div>
                )}
                <div className="thumbnail-overlay">
                  <div className="card-content">
                    <h3 className="card-title">{novel.title || "제목 없음"}</h3>
                    <p className="card-date">{new Date(novel.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                {(!novel.thumbnail_image || !novel.script) && <span className="status-badge">제작 중</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="auth-modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="auth-modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="auth-modal-title">관리자 확인</h3>
            <form onSubmit={handleAuthSubmit}>
              <input type="password" className="auth-input" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
              {errorMsg && <p className="auth-error-msg">{errorMsg}</p>}
              <button type="submit" className="auth-submit-btn">확인</button>
            </form>
            <button className="auth-close-btn" onClick={() => setShowAuthModal(false)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NovelList;
