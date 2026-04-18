# Agents Entry Point

이 파일은 이 프로젝트에서 작업하는 모든 에이전트용 진입점이다.

## Source Of Truth

- 프로젝트 공통 규칙 본문은 `agents/` 디렉터리에 있다.
- 이 파일은 입구 역할만 하며, 상세 규칙을 중복해서 적지 않는다.
- 툴별 사용법이 필요하면 `CLAUDE.md`, `CODEX.md` 같은 툴 전용 문서에 둔다.

## Reading Rule

- 작업 전 먼저 유저 요청, 수정 대상 파일, 실행 명령 목적을 정리한다.
- `agents/README.md`를 보고 문서 분류와 메타 규칙을 확인한다.
- `Title`, `Description`, `When-To-Read`, `Keywords`를 기준으로 관련 문서만 고른다.
- `agents/` 전체를 기본으로 모두 읽지 않는다.
- 구현과 설명은 선택한 문서 규칙과 현재 코드베이스 패턴을 우선 따른다.

## Priority Order

1. 보안, 권한, 민감 정보 보호
2. 데이터 무결성과 회귀 방지
3. 프로젝트 공통 규칙 준수
4. 검증 가능성과 유지보수성
5. 스타일과 표현 선호

## Required References

- `agents/README.md`
- `agents/process/workflow_rules.md`
- `agents/process/tool_split_rules.md`
- `agents/process/communication_rules.md`
- `agents/process/documentation_rules.md`
- 필요 시 요청과 관련된 세부 규칙 문서

## Document Roles

- `AGENTS.md`: 공통 규칙 진입점과 우선순위
- `agents/`: 프로젝트 공통 규칙 본문
- `CLAUDE.md`: Claude 전용 사용법
- `CODEX.md`: Codex 전용 사용법이 필요할 때만 추가

## Guardrails

- 프로젝트 설계 규칙을 홈 디렉터리 전역 설정에 복제하지 않는다.
- 공통 규칙을 여러 루트 문서에 중복 작성하지 않는다.
- 새 공통 규칙이 필요하면 루트 문서에 임시로 쓰지 말고 `agents/`에 추가한다.
