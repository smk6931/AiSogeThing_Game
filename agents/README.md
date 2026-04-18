# Agents Context Library

이 폴더는 Codex와 Claude가 작업 전에 참고하는 프로젝트 규칙 문서 모음이다.

## 목적

- 개발 규칙, 프론트 규칙, 게임 기획 규칙을 파일 단위로 분리한다.
- 각 파일 상단 메타를 보고 현재 요청과 관련 있는 문서만 읽는다.
- 모든 문서를 한 번에 넣지 않고 필요한 것만 선택한다.

## 파일 메타 규칙

각 문서는 맨 위에 아래 헤더를 둔다.

```md
# Title: 문서 제목
Description: 이 문서가 다루는 내용의 짧은 설명
When-To-Read: 어떤 요청에서 이 문서를 읽어야 하는지
Keywords: 쉼표로 구분한 키워드 목록
Priority: high | medium | low
```
## 문서 언어 규칙

- 메타 헤더의 `Title`은 영어를 기본으로 둔다.
- `Description`, `When-To-Read`와 본문 설명은 한국어로 써도 된다.
- `Keywords`는 검색과 분류를 위해 영어 위주로 적는다.
- 경로, 명령어, 코드 식별자는 영어 그대로 둔다.

## 사용 규칙

1. 유저 요청, 수정 대상 파일, 실행 명령 목적을 먼저 본다.
2. `agents/` 안 문서들의 `Title`, `Description`, `When-To-Read`, `Keywords`를 대조한다.
3. 관련성 높은 문서만 추가 컨텍스트로 읽는다.
4. 관련 없는 문서는 읽지 않는다.
5. 구현 시 해당 문서 규칙과 코드베이스 기존 패턴을 우선 따른다.

즉, Claude와 Codex는 gents/ 전체를 다 읽는 것이 아니라 메타 헤더를 보고 필요한 문서만 선택해서 읽는 것이 원칙이다.

## 현재 문서 분류

- `development/`
  개발 구조, DB, 배포, 공통 규칙
- `frontend/`
  UI, 레이아웃, 반응형, 인증 화면 규칙
  - `asset_cache_rules.md` — Service Worker 에셋 영구 캐시 전략, manifest 갱신 절차 (GLB/텍스처 추가·변경 시 필독)
- `game_design/`
  월드 구조, 파티션, 도로, 감성 규칙
  - `local_image_generation.md` — 로컬 ComfyUI 이미지 생성 설정 (모델, 파라미터, 스크립트 사용법, 출력 경로 규칙)
  - `world_texture_terrain_direction.md` — 파티션 바닥 텍스처 방향 정리 (폴리곤별 이미지 방식 주의사항, 연속 지형 방향 결정)
  - `world_elevation_cliff_rules.md` — 등고선 렌더링(extruded polygon, push/pull 방식), 절벽 메시 생성, 카메라 회전 대응 규칙
- `auth/`
  로그인, 회원가입, 계정 생성 흐름 규칙
- `planning/`
  게임 방향성, 기획서, 콘텐츠 설계 결정 문서
  - `world_layer_design.md` — Layer 0(정적 지형)과 Layer 1(플레이어 건설) 분리 원칙, placed_objects 스키마, 렌더 규칙 (오브젝트 배치 기능 구현 시 필독)
  - `game_identity_hypothesis.md` — "서울 지형이 캔버스, 유저가 붓" 게임 정체성 가설, 검증 조건, AI 연동 중장기 계획 (방향 논의 시 참고)
- `process/`
  Claude와 Codex가 공통으로 따를 작업 절차, 역할 분리, 검증 흐름 문서
  공통 조언 방식, 공통 소통 규칙도 포함
  - `documentation_rules.md` — 문서 요청 시 `docs/` 카테고리 선택, 오늘 날짜 경로, 파일명 규칙
- `db/`
  DB 전략, 테이블 구조, 파티션 설계, ERD 등 월드 DB 관련 규칙
  - `db_naming_rules.md` — 테이블/컬럼/인덱스 네이밍 규칙 (새 테이블 설계 전 필독)

