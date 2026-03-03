/* eslint-disable react/prop-types */
import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Users, BookText, ImageIcon, Loader2 } from 'lucide-react';
import { getNovel, deleteNovel } from '@api/content/novel';
import client from '@api/client';
import './NovelView.css';

const NovelView = ({ novelId, onNavigate }) => { // 게임 모드에서 ID와 네비게이션 함수를 받음
  const params = useParams();
  const id = novelId || params.id; // prop 우선 사용
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [novel, setNovel] = useState(null);
  const intervalRef = useRef(null);

  // 뒤로가기 핸들러
  const handleBack = (e) => {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(null); // 모달 닫기 (또는 '도서관 (웹툰/소설)'로 돌아가기 위해 type 전달 가능)
      // 여기서는 목록으로 돌아가기 위해 onNavigate('도서관 (웹툰/소설)')을 호출해야 함
      onNavigate('도서관 (웹툰/소설)');
    }
  };

  useEffect(() => {
    if (!id) return; // ID가 없으면 중단

    const fetchNovel = async () => {
      try {
        const data = await getNovel(id);
        setNovel(data);

        // Error handling for 'failed' status
        if (data && data.status === 'failed') {
          clearInterval(intervalRef.current);
          const errorMsg = data.error_message || '알 수 없는 오류';
          alert(`[Error] 웹툰 생성 실패\n\n${errorMsg}\n\n데이터를 삭제하고 목록으로 복귀합니다.`);
          try { await deleteNovel(id); } catch (e) { console.error(e); }

          if (onNavigate) onNavigate('도서관 (웹툰/소설)');
          else navigate('/novel');
        }

        // Stop polling if completed
        if (data && data.status === 'completed') {
          clearInterval(intervalRef.current);
        }

      } catch (err) {
        console.error("Error fetching novel:", err);

        // 404 Error Handling (Rollback Case)
        if (err.response && err.response.status === 404) {
          clearInterval(intervalRef.current);
          alert("웹툰 생성 중 오류가 발생하여 작업이 취소되었습니다.\n(데이터가 삭제되었습니다)");

          if (onNavigate) onNavigate('도서관 (웹툰/소설)');
          else navigate('/novel');
        }
      }
    };

    fetchNovel();

    // Poll every 2 seconds
    intervalRef.current = setInterval(fetchNovel, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [id, navigate, onNavigate]);

  if (!id) return <div>Invalid ID</div>;

  if (!novel) {
    return (
      <div className="novel-view-page loading-container">
        <div className="loading-spinner-small"></div>
        <p>Loading story...</p>
      </div>
    );
  }

  // Parse Characters
  const parseCharacters = (descriptions) => {
    if (!descriptions) return [];
    try {
      const parsed = JSON.parse(descriptions);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      const lines = descriptions.split('\n').filter(l => l.trim());
      return lines.map((line, idx) => {
        const parts = line.split(':');
        return {
          name: parts[0]?.trim() || `Character ${idx + 1}`,
          description: parts[1]?.trim() || line,
          image: null
        };
      });
    }
    return [];
  };

  const characters = novel.character_descriptions ? parseCharacters(novel.character_descriptions) : [];

  // Parse Summary
  const getSummary = (script) => {
    if (!script) return "";
    if (script.includes('[Summary]')) {
      const parts = script.split('[Scene');
      return parts[0].replace('[Summary]', '').trim();
    }
    const parts = script.split('[Scene');
    if (parts[0].length < 10 && parts.length > 1) return parts[1];
    return parts[0].trim();
  };

  // Text Cleaner
  const cleanText = (text) => {
    if (!text) return "";
    return text.replace(/\*\*/g, '').replace(/\*/g, '');
  };

  const summaryText = cleanText(getSummary(novel.script));

  const hasCover = !!novel.thumbnail_image;
  const hasScript = !!novel.script;
  const cutCount = novel.cuts ? novel.cuts.length : 0;
  const hasImages = novel.cuts && novel.cuts.every(cut => cut.image_path);

  // Image URL Helper
  const getImageUrl = (path) => {
    if (!path) return null;
    let cleanPath = path;
    if (cleanPath.startsWith('/novel/') && !cleanPath.startsWith('/api/novel/')) {
      cleanPath = '/api' + cleanPath;
    }
    return `${client.defaults.baseURL}${cleanPath}`;
  };

  return (
    <div className="novel-view-page">
      <div className="view-nav">
        <Link to="/novel" className="back-link" onClick={handleBack}>← Gallery</Link>
      </div>

      {/* Header */}
      <div className="view-header">
        {novel.thumbnail_image ? (
          <div className="cover-image-container">
            <img
              src={getImageUrl(novel.thumbnail_image)}
              alt="Cover"
              className="cover-img"
            />
            <div className="cover-overlay">
              <h1 className="view-title-overlay">{novel.title || "제목 없음"}</h1>
            </div>
          </div>
        ) : (
          <div className="cover-placeholder">
            {hasScript ? <h1 className="view-title">{novel.title}</h1> : <h1 className="view-title">제목 생성 중...</h1>}
            {!hasCover && <div className="generating-badge"><Loader2 className="spin" size={14} /> 표지 생성 중...</div>}
          </div>
        )}

        <p className="view-date">
          {new Date(novel.created_at).toLocaleDateString('ko-KR')}
          {(!hasImages || !hasCover) && <span className="status-badge">제작 중...</span>}
        </p>
      </div>

      {/* Synopsis */}
      <div className="synopsis-section">
        <div className="section-header">
          <BookText size={20} />
          <h2>줄거리 요약</h2>
        </div>
        {novel.script ? (
          <p className="synopsis-text">{summaryText || cleanText(novel.script)}</p>
        ) : (
          <div className="skeleton-text">
            <Loader2 className="spin" /> 줄거리를 작성하고 있습니다...
          </div>
        )}
      </div>

      {/* Characters */}
      {(characters.length > 0 || hasScript) && (
        <div className="characters-section">
          <div className="section-header">
            <Users size={20} />
            <h2>등장인물</h2>
          </div>
          {characters.length > 0 ? (
            <div className="characters-grid">
              {characters.map((char, idx) => (
                <div key={idx} className="character-card">
                  <div className="character-avatar">
                    {char.image ? (
                      <img
                        src={getImageUrl(char.image)}
                        alt={char.name}
                        className="char-img-real"
                      />
                    ) : (
                      char.name.charAt(0)
                    )}
                  </div>
                  <div className="character-info">
                    <h3 className="character-name">{char.name}</h3>
                    <p className="character-desc">{char.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="skeleton-text">
              <Loader2 className="spin" /> 등장인물을 분석하고 있습니다...
            </div>
          )}
        </div>
      )}

      {/* Main Story */}
      <div className="story-section">
        <div className="section-header">
          <ImageIcon size={20} />
          <h2>웹툰 본문</h2>
        </div>

        <div className="cuts-container">
          {cutCount > 0 ? (
            novel.cuts.map((cut) => (
              <div key={cut.id} className="cut-item">
                <div className="cut-image-wrapper">
                  {cut.image_path ? (
                    <img
                      src={getImageUrl(cut.image_path)}
                      alt={`Scene ${cut.cut_order}`}
                      className="cut-img"
                    />
                  ) : (
                    <div className="cut-placeholder">
                      <Loader2 className="spin" size={32} />
                      <p>작화 작업 중...</p>
                    </div>
                  )}
                </div>
                <div className="cut-content">
                  <span className="cut-label">SCENE #{cut.cut_order}</span>
                  <p className="cut-desc">{cleanText(cut.scene_desc)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="skeleton-cuts">
              <p>콘티를 구성하고 있습니다...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NovelView;
