import { useState } from 'react';
import { Search, MapPin, Plus, X } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import ApiInfo from '../../components/common/ApiInfo';
import { searchPlace } from '@api/content/hotplace'; // API 함수 임포트
import './AddPlaceModal.css';

export default function AddPlaceModal({ isOpen, onClose, onAddPlace }) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [quota, setQuota] = useState(null);

  // API 호출 (Refactored)
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!keyword.trim()) return;

    setIsSearching(true);
    setResults([]);

    try {
      // 이제 URL을 몰라도 됩니다. 함수만 호출!
      const data = await searchPlace(keyword);

      if (data.items) {
        setResults(data.items);
        if (data.meta) setQuota(data.meta);
      } else if (data.error) {
        alert("검색 실패: " + data.error);
      }
    } catch (error) {
      // Axios 에러 처리 (client.js에서 콘솔 로그는 찍힘)
      alert("검색 중 오류가 발생했습니다. (백엔드 연결 확인)");
    } finally {
      setIsSearching(false);
    }
  };

  // HTML 태그 제거 함수 (네이버 API는 <b>태그를 줘서 제거 필요)
  const removeTags = (str) => str.replace(/(<([^>]+)>)/ig, "");

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <header className="modal-header">
          <h3>핫플 장소 등록</h3>

          {/* API 정보 표시 (항상 표시하되 데이터 없으면 로딩중) */}
          <div className="modal-api-info">
            <ApiInfo remaining={quota?.remaining} limit={quota?.limit} />
          </div>

          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSearch} className="modal-search-form">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="장소명 입력 (예: 성수 다락)"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="search-input"
              autoFocus
            />
          </div>
          <Button size="small" type="submit" disabled={isSearching}>
            {isSearching ? '검색 중...' : '검색'}
          </Button>
        </form>

        <div className="search-results">
          {results.length === 0 && !isSearching && (
            <div className="empty-state">
              <MapPin size={32} opacity={0.3} />
              <p>장소를 검색하여 지도에 추가해보세요.<br />(네이버 검색 API 연동됨)</p>
            </div>
          )}

          {results.map((place, index) => (
            <div key={index} className="search-item">
              <div className="search-item-info">
                <h4 className="search-item-title">{removeTags(place.title)}</h4>
                <p className="search-item-addr">{place.address}</p>
                <span className="search-item-cate">{place.category}</span>
              </div>
              <button
                className="add-place-btn"
                onClick={() => onAddPlace({
                  name: removeTags(place.title),
                  desc: '내가 추천하는 핫한 장소! 👍',
                  category: place.category.split('>')[1] || place.category,
                  position: [place.lat, place.lng],
                  rating: 5.0,
                  naverUrl: place.naver_map_url
                })}
              >
                <Plus size={16} /> 추가
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
