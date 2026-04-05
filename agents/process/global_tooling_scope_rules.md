# Title: Global Tooling Scope Rules
Description: `.claude/skills`, `.codex`, 전역 툴 설정에 넣어도 되는 것과 프로젝트 문서에 남겨야 하는 것을 구분한다.
When-To-Read: Claude/Codex 전역 설정, skills, hooks, commands, rules를 정리하거나 새로 만들 때
Keywords: global, claude, codex, skills, hooks, commands, rules, scope, project
Priority: high

## 기본 원칙

- 전역 툴 설정은 여러 프로젝트에서 공통으로 써도 안전한 내용만 둔다.
- 특정 저장소 구조, 특정 DB, 특정 UI 배치, 특정 도메인 용어는 프로젝트 문서에 둔다.
- 프로젝트별 source of truth는 항상 `AGENTS.md`와 `agents/`다.

## 전역에 넣어도 되는 것

- 작업 절차
  - 분석 -> 계획 -> 구현 -> 검증 -> 리뷰
- 툴 역할 분담
  - Claude는 계획, 비교, 문서화
  - Codex는 구현, 탐색, 로컬 검증
- 공통 편집 안전 규칙
  - `apply_patch` 우선
  - PowerShell 전체 재저장 금지
- 공통 예외처리 원칙
  - 앱 전체 크래시보다 안전한 fallback 우선
- 공통 모듈 분리 원칙
  - 여러 도메인에서 재사용되는 client/helper만 공통으로 뺀다
- 민감정보/배포 안전 원칙
  - `.env`, key, dump는 Git 금지

## 전역에 넣으면 안 되는 것

- 특정 프로젝트 디렉토리 구조
  - 예: `backend/routes`, `services`, `repositories`를 루트에 강제
- 특정 프로젝트 DB 구조와 source of truth
  - 예: `world_admin_area`, `world_level_partition`
- 특정 프로젝트 UI 배치
  - 예: 미니맵 왼쪽 버튼 배치, HUD 위치
- 특정 프로젝트 도메인 규칙
  - 예: city -> district -> dong -> partition
- 특정 프로젝트 렌더링 정책
  - 예: 그룹텍, 그룹선, 도로/바닥 레이어
- 특정 프로젝트 운영 규칙
  - 예: 노량진 그룹 키, 월드 에디터 토글 위치, 게임 설정 저장 방식

## skills에 넣지 말아야 하는 항목

- 프로젝트 아키텍처 자체를 강제하는 규칙
- 특정 저장소 폴더 구조를 정답처럼 박는 규칙
- 특정 프로젝트 파일 경로를 전제로 한 명령 모음
- 특정 프로젝트의 DB/HTTP API/환경변수 이름에 묶인 지침
- 특정 프로젝트의 UI/기획 결정을 일반 규칙처럼 적은 문서

## skills에 넣어도 되는 항목

- 체크리스트
- 리뷰 템플릿
- 리팩터링 사고방식
- 테스트/검증 습관
- 공통 예외처리와 공통 모듈 분리 원칙
- 인코딩/편집 안전 수칙

## 이 저장소 기준 정리

- 백엔드 구조 규칙은 `agents/development/backend_structure_rules.md`
- 편집/인코딩 안전 규칙은 `agents/development/editing_safety_rules.md`
- 툴 역할 분담은 `agents/process/tool_split_rules.md`
- 전역 skill에는 위 문서 내용을 복사하지 말고, 필요한 경우 "프로젝트에서는 AGENTS/agents를 따르라"는 진입 규칙만 둔다.
