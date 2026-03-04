---
name: 프론트엔드 경로 별칭 규칙 (Front Alias Rules)
description: Vite alias 목록과 임포트 경로 규칙입니다. 상대경로 사용을 금지하고 alias를 강제합니다.
---

# 프론트엔드 경로 별칭 (Alias) 규칙

## Vite Alias 목록 (`front/vite.config.js` 기준)

| 별칭 | 실제 경로 (`front/src/` 상대) | 용도 |
|---|---|---|
| `@` | `src/` | src 루트 |
| `@api` | `src/api` | API 클라이언트 |
| `@contexts` | `src/contexts` | 전역 Context |
| `@hooks` | `src/hooks` | 전역 Hook |
| `@screens` | `src/screens` | 전체화면 페이지 |
| `@ui` | `src/ui` | 인게임 HUD |
| `@entity` | `src/entity` | 3D 엔티티 |
| `@engine` | `src/engine` | 3D 엔진 코어 |

## 사용 예시

```javascript
// 인증 상태
import { useAuth } from '@contexts/AuthContext';

// 게임 설정
import { useGameConfig } from '@contexts/GameConfigContext';

// 맵 설정 (entity/world 하위)
import { getMap, getAllMaps } from '@entity/world/mapConfig';

// 지형 높이 계산
import { getTerrainHeight } from '@entity/world/terrainHandler';

// 인게임 HUD
import GameOverlay from '@ui/GameOverlay';

// 엔진 입력 훅
import { useGameInput } from '@engine/useGameInput';

// 전역 훅
import { useSeoulDistricts } from '@hooks/useSeoulDistricts';
```

## 금지 사항
- `../../` 상대경로 사용 금지. 반드시 위 alias를 사용할 것
- alias를 추가하면 반드시 `vite.config.js`의 `resolve.alias` 섹션에도 등록할 것
