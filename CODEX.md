# Codex Workflow

## Project Rule Entry

- Shared project rules live in [`AGENTS.md`](C:/GitHub/AiSogeThing_Game/AGENTS.md) and [`agents/`](C:/GitHub/AiSogeThing_Game/agents/README.md).
- This file is only for Codex-specific workflow guidance.
- Do not duplicate shared architecture or domain rules here.

## Codex Scope

- Codex-specific:
  - local code edits
  - file exploration
  - bounded refactor
  - local verification
- Project-specific:
  - backend structure
  - DB and world rules
  - UI placement
  - editing/encoding safety
  - deployment flow

Project-specific items must stay in `agents/`.

## Best Use Cases

- 실제 코드 수정
- 로컬 파일 탐색
- 범위가 명확한 리팩터링
- diff 기반 점검과 수정
- 구현 후 로컬 검증

## Working Style

- 작업 전 관련 파일과 관련 `agents/` 문서만 읽는다.
- 수정은 최소 범위로 한다.
- 기존 패턴과 충돌하지 않게 구현한다.
- 불필요한 전역 리팩터링을 피한다.

## Execution Rules

- 안전한 조회 명령은 바로 실행할 수 있다.
- 설치, 서버 실행, 상태 변경, 파괴적 작업은 Codex 승인 정책을 따른다.
- 승인 정책과 prefix rule은 프로젝트 규칙이 아니라 Codex 로컬 설정에서 관리한다.

## Guardrails

- 새 공통 규칙이 필요하면 `agents/`에 추가한다.
- Codex 전용 사용법만 여기서 관리한다.
- 로컬 툴 편의 규칙이 프로젝트 공통 규칙을 덮어쓰지 않는다.
