# 2026-03-29 World DB Deploy Road Update

## 요약

- `world_level_partition`를 노량진1동 기준 도로 분할 `222`개 micro partition으로 정리했다.
- micro partition 위에 `group_*` 메타를 추가해 grouped play region 구조를 만들었다.
- 로컬 DB를 SQL dump로 백업해 서버 Postgres 컨테이너에 복원하는 배포 흐름을 만들었다.
- 프론트는 `grounds` 폴더 텍스처를 기준으로 파티션 바닥을 랜덤 매핑하도록 정리했다.
- 도로는 JSON 레이어 상태로 유지하고, 폭/색/중복 렌더를 1차 조정했다.

## DB / 월드

- `world_admin_area`
  - city -> district -> dong 계층 유지
- `world_level_partition`
  - 최하위 partition geometry
  - `group_key`, `group_seq`, `group_display_name`, `group_theme_code` 추가
  - `dominant_landuse`, `persona_tag`, `area_m2` 등 메타 추가

## 배포

- `scripts/local_backup_db.ps1`
  - 로컬 Docker Postgres 컨테이너 기준 SQL dump 생성
- `scripts/deploy_server.ps1`
  - git push
  - local SQL backup
  - 서버 업로드
  - 서버 DB 컨테이너 기동
  - 서버 DB 사전 백업
  - SQL restore
  - alembic
  - frontend build
  - PM2 reload
- `docker-compose.server.yml`
  - 서버 DB 컨테이너용 compose 추가

## Git / 민감정보

- `.env`, `*.sql`, `*.key`, `*.pem`, `/backups/deploy/`는 GitHub에 올리지 않도록 `.gitignore` 보강
- 이미 추적된 deploy SQL dump는 Git index에서 제거

## 프론트 / 월드 렌더

- `CityBlockOverlay`
  - `TEXTURE_PROFILE_MAP` 하드코딩 제거
  - `grounds` 폴더 목록 기반 랜덤 매핑
- `ZoneOverlay`
  - 도로 기본 폭 축소
  - 도로 회색 톤 제거
  - 도로 중복 렌더 제거
  - 메인/소로 투명도 조정

## 현재 남은 작업

- 도로 텍스처를 단색 띠가 아니라 decal/texture 방식으로 바꾸기
- `start-back.ps1` 로컬 백그라운드 실행 안정화 확인
- agents 문서를 기준으로 도로 기획과 구현 규칙을 계속 누적
