import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { MapPin, Star, Navigation, ExternalLink, Trash2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import Card from '../../components/common/Card';
import AddPlaceModal from './AddPlaceModal';
import './HotPlace.css';

// Leaflet 기본 아이콘 깨짐 해결
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

// 지도 이동 컨트롤러 (리스트 클릭 시 이동용)
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5 });
  }, [center, zoom, map]);
  return null;
}

export default function HotPlace() {
  const [activePlaceId, setActivePlaceId] = useState(1);
  const [mapCenter, setMapCenter] = useState([37.5445, 127.0560]);
  const [zoom, setZoom] = useState(14);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 임시 데이터 (중복 방지를 위해 초기값에 모두 포함)
  const [places, setPlaces] = useState([
    {
      id: 1,
      name: '성수 연무장길',
      category: '거리/명소',
      rating: 4.8,
      position: [37.5445, 127.0560],
      image: 'https://picsum.photos/300/200?random=101',
      desc: '힙한 카페와 팝업스토어가 모여있는 데이트 성지 ☕️',
      naverUrl: 'https://map.naver.com/p/search/성수연무장길'
    },
    {
      id: 2,
      name: '서울숲 공원',
      category: '공원',
      rating: 4.9,
      position: [37.5444, 127.0374],
      image: 'https://picsum.photos/300/200?random=102',
      desc: '피크닉하고 산책하기 딱 좋은 도심 속 숲 🌿',
      naverUrl: 'https://map.naver.com/p/entry/place/11636254'
    },
    {
      id: 3,
      name: '뚝섬 한강공원',
      category: '공원',
      rating: 4.7,
      position: [37.5294, 127.0700],
      image: 'https://picsum.photos/300/200?random=103',
      desc: '해질녘 노을 보면서 치킨 먹기 좋은 곳 🍗',
      naverUrl: 'https://map.naver.com/p/entry/place/13446868'
    },
    {
      id: 4,
      name: '송리단길',
      category: '맛집거리',
      rating: 4.6,
      position: [37.5112, 127.1085],
      image: 'https://picsum.photos/300/200?random=104',
      desc: '석촌호수 구경하고 맛집 가기 좋은 핫플 🍜',
      naverUrl: 'https://map.naver.com/p/search/송리단길'
    }
  ]);

  const handleAddNewPlace = (newPlaceData) => {
    const newId = places.length + 1 + Date.now();
    const newPlace = {
      id: newId,
      ...newPlaceData,
      image: `https://picsum.photos/300/200?random=${newId}`, // 이미지는 랜덤
    };

    setPlaces([newPlace, ...places]); // 리스트 최상단에 추가
    setMapCenter(newPlace.position); // 거기로 지도 이동
    setActivePlaceId(newId);
    setIsModalOpen(false);
  };

  const handleRemovePlace = (e, id) => {
    e.stopPropagation(); // 카드 클릭 이벤트 막기
    if (window.confirm('정말 이 장소를 삭제하시겠습니까?')) {
      setPlaces(places.filter(p => p.id !== id));
      if (activePlaceId === id) setActivePlaceId(null);
    }
  };

  const handlePlaceClick = (place) => {
    setActivePlaceId(place.id);
    setMapCenter(place.position);
    setZoom(15);
  };

  const handleNaverLink = (e, url) => {
    e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
    window.open(url, '_blank');
  };

  return (
    <div className="hotplace">
      <div className="hotplace__container">
        {/* 왼쪽: 리스트 영역 */}
        <div className="hotplace__sidebar">
          <header className="hotplace__header">
            <div>
              <h1 className="hotplace__title">
                <MapPin className="hotplace__title-icon" />
                핫플 게시판
              </h1>
              <p className="hotplace__subtitle">요즘 뜨는 데이트 명소 지도</p>
            </div>
            <button className="hotplace__add-btn" onClick={() => setIsModalOpen(true)}>
              + 장소 추천
            </button>
          </header>

          <div className="hotplace__list">
            {places.map((place) => (
              <Card
                key={place.id}
                variant={activePlaceId === place.id ? "gradient" : "glass"}
                padding="small"
                className={`hotplace__card ${activePlaceId === place.id ? 'active' : ''}`}
                onClick={() => handlePlaceClick(place)}
              >
                <div className="hotplace__card-content">
                  <img src={place.image} alt={place.name} className="hotplace__img" />
                  <div className="hotplace__info">
                    <div className="hotplace__top">
                      <span className="hotplace__category">{place.category}</span>
                      <div className="hotplace__top-right">
                        <span className="hotplace__rating">
                          <Star size={12} fill="#fbbf24" stroke="#fbbf24" /> {place.rating}
                        </span>
                        <button className="hotplace__delete-btn" onClick={(e) => handleRemovePlace(e, place.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <h3 className="hotplace__name">{place.name}</h3>
                    <p className="hotplace__desc">{place.desc}</p>
                    <button className="hotplace__naver-btn" onClick={(e) => handleNaverLink(e, place.naverUrl)}>
                      <ExternalLink size={12} /> 네이버 스마트 플레이스
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* 오른쪽: 지도 영역 */}
        <div className="hotplace__map-wrapper">
          <MapContainer
            center={mapCenter}
            zoom={zoom}
            className="hotplace__map"
            zoomControl={false} // 줌 컨트롤 위치 이동 등을 위해 끔 (필요시 커스텀)
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* 다크 모드용 지도 필터 (CSS로 처리) */}

            <MapController center={mapCenter} zoom={zoom} />

            {places.map((place) => (
              <Marker
                key={place.id}
                position={place.position}
                eventHandlers={{
                  click: () => handlePlaceClick(place),
                }}
              >
                <Popup className="hotplace__popup">
                  <div className="hotplace__popup-content">
                    <b>{place.name}</b>
                    <span className="hotplace__popup-cate">{place.category}</span>
                    <button className="hotplace__popup-link" onClick={(e) => handleNaverLink(e, place.naverUrl)}>
                      상세보기 <ExternalLink size={10} />
                    </button>
                    <button className="hotplace__popup-delete" onClick={(e) => handleRemovePlace(e, place.id)}>
                      장소 삭제
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          <button className="hotplace__my-loc-btn">
            <Navigation size={20} />
            현위치
          </button>
        </div>

        {/* 장소 추가 모달 */}
        <AddPlaceModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onAddPlace={handleAddNewPlace}
        />
      </div>
    </div>
  );
}
