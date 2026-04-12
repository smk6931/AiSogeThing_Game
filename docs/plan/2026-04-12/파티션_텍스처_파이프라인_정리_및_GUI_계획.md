# 파티션 바닥 텍스처 파이프라인 정리 및 GUI 생성 도구 계획

## 배경 및 목표

오늘(2026-04-12) 파티션 바닥 텍스처 생성·적용 전체 파이프라인을 확립했다.
현재 CLI 기반 생성 방식으로는 파티션별로 이미지를 일일이 확인하고 재생성하기 어렵다.
**다음 단계: 인게임 또는 관리 GUI에서 파티션을 선택해 텍스처를 생성·교체할 수 있는 도구 개발.**

---

## 오늘 완료한 작업

### 1. 파티션 텍스처 경로 정렬
- 기존 ad-hoc 스크립트로 뽑은 이미지(`ground/noryangjin2_g04/g04_p038_floor_v1.png`)를
  DB 경로 기준(`world_partition/noryangjin2_g04/0038.png`)으로 이관.
- DB `texture_image_url` 이미 올바르게 세팅되어 있음 — 파일명만 맞추면 됐음.

### 2. PartitionTextureOverlay 제거
- 이전 세션에서 만든 `PartitionTextureOverlay.jsx` 삭제.
  - 이유: `CityBlockOverlay` + `texture_image_url` 방식(기존 시스템)과 완전히 중복.
  - `showPartitionTextures` 레이어 설정도 제거.
- 기존 `showCurrentGroupTexture` 토글(`◆ 그룹텍`) → `CityBlockOverlay`가 DB URL로 텍스처 표시.

### 3. generate_partition_textures.py 1차 실행 (rpg_v5)
- `--per-partition` 옵션으로 noryangjin2_g04 16개 파티션 폴리곤 정렬 이미지 생성.
- 문제: rpg_v5 스타일(`medieval korean village`)은 계획 파일과 다름.

### 4. generate_partition_textures.py 스크립트 수정 (DreamShaper XL Lightning)
- `partition_floor_texture_생성계획.md` 기준으로 스크립트 업데이트:

| 항목 | 이전 | 변경 후 |
|------|------|---------|
| 모델 | `rpg_v5.safetensors` | `dreamshaperXL_lightningDPMSDE.safetensors` |
| Steps | 25 | 8 |
| CFG | 7.0 | 2.0 |
| Sampler | dpm_2_ancestral | dpmpp_sde |
| 워크플로우 | EmptyLatentImage + SetLatentNoiseMask | VAEEncodeForInpaint (grow_mask_by=4) + 검정 base |
| Style prefix | medieval korean village ground | top-down 90° overhead, soft painterly anime RPG art style |
| FLOOR_CONTEXT | rooftop 중심 묘사 | theme별 DreamShaper 스타일 프롬프트 |

- 2차 생성 완료 (16개 파티션, DreamShaper XL Lightning).

### 5. agents 문서 업데이트
- `agents/game_design/local_image_generation.md`:
  - DreamShaper XL Lightning을 기본 모델로 명시.
  - texture_profile / theme_code → Positive 프롬프트 가이드 추가.
  - VAEEncodeForInpaint 워크플로우 명시.
- `CLAUDE.md` Core Index에 `local_image_generation.md`, `world_texture_terrain_direction.md` 추가.
- `agents/README.md`에 두 파일 분류 항목 추가.

### 6. CityBlockOverlay 404 크래시 수정
- 에러: `Could not load /world_partition/noryangjin2_g02/0046.png` → 앱 전체 크래시.
- 원인: `useTexture(allTexturePaths)`에 존재하지 않는 파티션 URL이 포함되면 throw.
- 수정:
  - `usePartitionTextures(urls)` 커스텀 훅 추가 — `THREE.TextureLoader` 개별 로드, 404 시 null.
  - `useTexture`는 pool 텍스처(항상 존재)만 담당.
  - `partitionTexIndexMap` (index 기반) → `partitionTexUrlMap` (url 기반) 변경.
  - 렌더 시 partitionUrl 있으면 커스텀 맵에서 조회, null이면 pool fallback.

---

## 현재 상태

```
front/public/world_partition/noryangjin2_g04/
├── 0038.png ~ 0097.png  (16개, DreamShaper XL Lightning 생성, DB URL 일치)

DB world_partition.texture_image_url:
  /world_partition/noryangjin2_g04/0038.png ~ /world_partition/noryangjin2_g04/0097.png

인게임 활성화:
  ◆ 그룹텍 토글 ON → CityBlockOverlay가 DB URL로 폴리곤에 텍스처 표시
  파일 없는 그룹(g02 등) → 404 무시, pool 텍스처 fallback (크래시 없음)
```

---

## 다음 계획: 파티션 텍스처 관리 GUI

### 문제
- 현재 파티션 텍스처 생성은 CLI만 가능.
- 결과 이미지를 확인하고 마음에 안 들면 재생성하기 불편.
- 전체 동(洞) 파티션 수십~수백 개를 관리하기 어렵.

### GUI 목표
- 파티션 목록에서 특정 파티션 선택 → 미리보기 + 재생성 버튼.
- 전체 그룹/동 단위 일괄 생성 트리거.
- 생성 진행률 표시 (ComfyUI 큐 상태 폴링).
- DB `texture_image_url` 자동 업데이트 확인.

### 구현 위치 옵션

| 옵션 | 장점 | 단점 |
|------|------|------|
| **인게임 WorldEditor 패널 확장** | 맵 위에서 파티션 클릭 → 즉시 재생성 | 인게임 UI 복잡도 증가 |
| **별도 관리 웹페이지** (`/admin/textures`) | 독립적, 테이블 뷰 + 썸네일 | 별도 라우트/페이지 개발 필요 |
| **백엔드 API + 스크립트 래퍼** | 기존 스크립트 재사용 | 프론트 UI는 별도 개발 필요 |

### 권장 방향
1. **백엔드 API 추가** (`POST /api/world/partition/generate-texture`)
   - `partition_key` 또는 `group_key` 받아서 ComfyUI 큐 제출.
   - 생성 완료 후 DB `texture_image_url` 업데이트.
   - 진행 상태 폴링 엔드포인트 (`GET /api/world/partition/texture-status/{job_id}`).

2. **인게임 WorldEditor 패널 확장**
   - 현재 `WORLD TOOLS` 섹션 아래 `TEXTURE GEN` 서브패널 추가.
   - 현재 플레이어 위치 기반 파티션/그룹 자동 감지.
   - `현재 파티션 재생성`, `현재 그룹 전체 재생성` 버튼.
   - 생성 상태 표시 (대기/생성 중/완료).

### 할 일 체크리스트

- [ ] 백엔드: `POST /api/world/partition/generate-texture` 라우트 추가
  - `generate_partition_textures.py` 스크립트를 API로 래핑
  - ComfyUI job_id 반환
- [ ] 백엔드: `GET /api/world/partition/texture-status/{job_id}` 폴링 엔드포인트
  - ComfyUI `/history/{pid}` 프록시
- [ ] 프론트: WorldEditor 패널에 텍스처 생성 UI 추가
  - 현재 파티션/그룹 표시
  - `재생성` 버튼 → API 호출 → 진행 중 스피너
  - 완료 시 Three.js 텍스처 캐시 무효화 (`window.clearPartitionCache()`)
- [ ] (선택) 관리 페이지: `/admin/textures` — 전체 파티션 썸네일 그리드

---

## 주의사항

- `generate_partition_textures.py`가 기본 모델이다. 변경 시 `agents/game_design/local_image_generation.md` 동시 업데이트.
- 이미지 재생성 후 브라우저 캐시 강제 갱신 필요 (`Ctrl+Shift+R` 또는 캐시 무효화 API).
- `world_texture_terrain_direction.md` 결론: 폴리곤별 개별 이미지 방식은 실험용. 장기적으로는 연속 지형 + 파티션 마스크 방향.
