# Claude Workflow

## Project Rule Entry

- Shared project rules live in [`AGENTS.md`](C:/GitHub/AiSogeThing_Game/AGENTS.md) and [`agents/`](C:/GitHub/AiSogeThing_Game/agents/README.md).
- This file is only for Claude-specific workflow guidance.
- Do not duplicate shared architecture or domain rules here.

## Best Use Cases

- 큰 기능 계획
- 설계 대안 비교
- 요구사항 정리
- 문서 초안 작성
- 구현 후 리뷰 체크리스트 수행

## Recommended Workflow

- 큰 작업은 먼저 계획을 세운다.
- 공통 규칙은 `agents/`에서 읽고 구현한다.
- 구현 후에는 검증 절차를 수행한다.
- 위험 변경은 리뷰 기준으로 한 번 더 점검한다.

## Claude-Specific Commands

- `/plan`: 구현 전 계획 수립
- `/verify`: 빌드, 타입, 테스트, 로그 점검
- `/code-review`: 변경사항 리뷰
- `/handoff`: 다음 세션용 인계 정리

## Subagent Guidance

- `planner`: 큰 기능, 구조 변경, 리팩터링 계획
- `debugger`: 원인 분석
- `code-reviewer`: 품질과 보안 리뷰
- `architect`: 구조 선택 검토

## Guardrails

- 새 공통 규칙이 필요하면 `agents/`에 추가한다.
- Claude 전용 사용법만 여기서 관리한다.
- 툴 편의 기능보다 프로젝트 공통 규칙을 우선한다.
