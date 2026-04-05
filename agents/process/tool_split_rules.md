# Title: Claude and Codex Role Split Rules
Description: Claude와 Codex를 함께 사용할 때 어떤 작업을 어느 쪽에 맡길지 공통 기준을 정리한다.
When-To-Read: Claude와 Codex를 함께 쓰는 세션, 작업 분담 기준이 필요한 요청, 툴 혼선이 생긴 경우
Keywords: claude, codex, tool split, role, workflow, planning, implementation
Priority: high

## 기본 원칙

- 프로젝트 규칙은 두 툴 모두 `agents/`를 공통 source of truth로 본다.
- 툴별 문서는 툴 사용법만 다루고 프로젝트 설계 규칙은 다루지 않는다.
- 같은 작업을 두 툴에 중복으로 설명하지 않는다.

## Claude에 더 잘 맞는 작업

- 큰 기능 계획
- 설계 대안 비교
- 문서 초안 작성
- 요구사항 정리
- 리뷰 체크리스트 생성

## Codex에 더 잘 맞는 작업

- 실제 코드 수정
- 로컬 파일 탐색
- 범위가 명확한 리팩터링
- diff 기반 수정
- 로컬 검증 실행

## 공통 운영 규칙

- 큰 작업: Claude나 Codex 중 하나에서 먼저 계획 수립
- 실제 구현: 범위가 정해진 뒤 주력 툴 하나로 일관되게 진행
- 마감: 검증과 리뷰 절차 수행

## 혼선을 줄이는 방법

- 한 세션에서 주력 툴을 먼저 정한다.
- 문서 수정은 공통 규칙이면 `agents/`에만 반영한다.
- Claude 전용 사용법은 `CLAUDE.md`에서만, Codex 전용 사용법은 `CODEX.md`에서만 관리한다.

