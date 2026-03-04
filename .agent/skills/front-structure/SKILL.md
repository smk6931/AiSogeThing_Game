---
name: 프론트엔드 폴더 구조 규칙 (Front Structure)
description: React+Three.js 프론트엔드의 역할 기반 폴더 구조와 각 폴더의 책임을 정의합니다.
---

# 프론트엔드 구조 규칙 (`front/src/`)

## 최상위 폴더 = 기술적 역할 기반

```
front/src/
├── api/             # 백엔드 통신 클라이언트
│   ├── client.js    → Axios 공통 인스턴스
│   ├── auth.js      → 로그인/유저 API
│   └── game.js      → 게임 REST/WebSocket API
│
├── contexts/        # 전역 상태 (React Context)
│   ├── AuthContext.jsx        → user, token, login, logout
│   └── GameConfigContext.jsx  → moveSpeed 등 게임 설정
│
├── hooks/           # 전역 공용 로직 훅
│   ├── useSeoulDistricts.js   → 서울 구 경계 탐지
│   └── useProjectiles.js      → 투사체 상태 관리
│
├── screens/         # 라우팅 전환 / 화면 전체를 덮는 페이지 (Full View)
│   └── Login/       → Login.jsx, Login.css
│
├── ui/              # 인게임 HUD - 게임 위에 떠 있는 2D UI 조각들
│   ├── GameOverlay.jsx        → HP/MP바, 스킬 슬롯, 미니맵
│   ├── ChatBox.jsx
│   ├── WorldMapModal.jsx
│   ├── MapControlOverlay.jsx  → 지도 레이어 토글
│   └── LeafletMapBackground.jsx
│
├── entity/          # 3D 엔티티 (백엔드 도메인과 1:1 매핑)
│   ├── world/       → RpgWorld.jsx, mapConfig.js, ZoneOverlay.jsx, terrainHandler.js 등
│   ├── player/      → Player.jsx, RemotePlayer.jsx
│   │   ├── logic/   → usePlayerMovement.js, usePlayerSkills.js, PlayerChat.jsx
│   │   └── projectile/ → PunchProjectile.jsx
│   └── monster/     → Monster.jsx
│
├── engine/          # 3D 구동 핵심 (Canvas, Socket, Input, Camera)
│   ├── GameCanvas.jsx
│   ├── ZoomController.jsx
│   ├── useGameInput.js
│   └── useGameSocket.js
│
├── App.jsx          # 라우팅 및 전역 Provider 조립
└── GameEntry.jsx    # 모든 3D 부품의 최종 조립 진입점
```

## 규칙
- `screens/`: 라우팅(`App.jsx`의 `<Route>`)과 1:1 대응. 새 화면 추가 시 App.jsx에도 Route 추가 필수
- `ui/`: React 2D 레이어. Three.js 코드 혼입 금지
- `entity/`: Three.js/React-Three-Fiber 코드. 백엔드 도메인과 동일한 이름의 서브폴더 사용
- `engine/`: Canvas 초기화, 소켓, 입력 등 게임 구동에 필요한 인프라만 포함
