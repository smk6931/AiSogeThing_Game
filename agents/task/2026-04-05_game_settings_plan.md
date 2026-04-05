# Title: 게임 환경설정 시스템 계획
Description: 미니맵 옆 ⚙️ 버튼으로 열리는 환경설정 모달 — 전투 범위, UI 표시 토글, 설정 저장(localStorage → DB)
When-To-Read: 환경설정, UI 토글, 자동사냥 범위, 몬스터 감지 범위, 설정 저장 작업 시
Keywords: settings, ui-toggle, auto-farm-range, attack-range, monster-detect, localStorage, DB-settings
Priority: high

---

## 배경 및 목적

- 자동사냥 타겟 범위 / 자동공격 사정거리가 현재 코드에 하드코딩
- 몬스터 AI 플레이어 감지 범위도 무제한(nearest 탐색, 거리 체크 없음)
- UI 요소(미니맵, 스탯창, 채팅, 조이스틱 등)를 유저가 끄고 켤 수 없음
- 설정을 화면에서 바꾸고 DB에 저장하는 흐름 필요

---

## 설정 항목 정의

### 전투 (Combat)
| 키 | 설명 | 범위 | 기본값 |
|---|---|---|---|
| `autoFarmRange` | 자동사냥 타겟 탐색 반경 | 20~120 | 60 |
| `autoAttackRange` | 자동공격 사정거리 | 10~60 | 30 |
| `monsterDetectRange` | 몬스터가 플레이어 추적 시작 거리 | 10~50 | 25 |

### UI 표시 (Display)
| 키 | 설명 | 기본값 |
|---|---|---|
| `showStatPanel` | HP/MP/EXP 스탯 패널 | true |
| `showMinimap` | 미니맵 | true |
| `showChat` | 채팅창 | true |
| `showJoystick` | 조이스틱 | true |
| `showItemNotif` | 아이템 획득 알림 | true |
| `showRegionTitle` | 지역명 팝업 | true |

---

## 구현 구조

### 프론트엔드

```
front/src/
  hooks/
    useGameSettings.js      ← 설정 로드/저장 훅 (localStorage + API)
  ui/
    GameSettingsModal.jsx   ← 환경설정 모달 (슬라이더 + 토글)
  GameOverlay.jsx           ← ⚙️ 버튼 추가 (🗺 버튼 왼쪽)
  GameEntry.jsx             ← useGameSettings 연결, props 전달
  hooks/useAutoFarm.js      ← autoFarmRange 파라미터 추가
  hooks/useAutoAttack.js    ← autoAttackRange 파라미터 추가
```

### 백엔드 (Phase 2 — DB 저장)

```
back/
  player/
    routers/router.py       ← GET/PUT /api/game/settings/{user_id}
    repository.py           ← get_settings, save_settings
  migrations/               ← game_character에 ui_settings JSONB 컬럼 추가
```

### 저장 전략

```
1차 (즉시): localStorage에 저장 (게스트 포함 모두 동작)
2차 (저장 버튼): API PUT → DB game_character.ui_settings JSONB
로드 순서: DB → localStorage → 기본값
```

---

## 화면 위치

미니맵 좌상단 버튼 줄:
```
[⚙️설정] [🗺레이어]   [미니맵]
```
- `⚙️` 클릭 → `GameSettingsModal` 열림
- 모달은 레이어 팝업과 같은 floating 스타일

---

## 구현 순서

### Phase 3-A: 프론트엔드 설정 시스템 (localStorage) ✅ 완료
- [x] `useGameSettings.js` 훅 생성 — localStorage 읽기/쓰기, 기본값 관리
- [x] `GameSettingsModal.jsx` 생성 — 전투/UI 탭, 슬라이더, 토글
- [x] `GameOverlay.jsx` — ⚙️ 버튼 추가 (🗺 버튼 왼쪽 38px), 설정 팝업 렌더링
- [x] `GameEntry.jsx` — useGameSettings 연결, settings props 전달
- [x] `useAutoFarm.js` — range 파라미터 추가 (기본 60)
- [x] `useAutoAttack.js` — attackRange 파라미터 추가 (기본 30)
- [x] `GameCanvas.jsx` → `RpgWorld.jsx` — autoFarmRange/autoAttackRange props 파이프라인
- [x] UI 토글 — showStatPanel/showMinimap(+확장맵)/showItemNotif/showRegionTitle → GameOverlay 조건부 렌더링
- [x] UI 토글 — showChat/showJoystick → GameEntry 조건부 렌더링

### Phase 3-B: 백엔드 DB 저장 ✅ 완료
- [x] `game_character` 테이블 — `ui_settings JSONB` 컬럼 추가 + migration (g4h5i6j7k8l9)
- [x] `player/models/models.py` — ui_settings JSON 컬럼 추가
- [x] `player/repository.py` — get_ui_settings, save_ui_settings 함수
- [x] `player/routers/router.py` — GET/PUT /api/game/settings/{user_id}
- [x] `front/src/api/game.js` — getSettings, saveSettings API 추가
- [x] `useGameSettings.js` — 로그인 시 DB 로드, 저장 버튼으로 DB 동기화
- [x] `GameSettingsModal.jsx` — 💾 저장 버튼 추가

### Phase 3-C: 몬스터 감지 범위 백엔드 적용 ✅ 완료
- [x] `MonsterManager.game_loop()` — DETECT_RANGE = 25.0 상수 추가, 범위 내 플레이어만 추적

> **migration 실행 필요**: `alembic upgrade head`

---

## 진행 기록

- 2026-04-05: 계획 수립
