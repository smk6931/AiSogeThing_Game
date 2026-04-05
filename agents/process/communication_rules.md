# Title: Communication Rules
Description: Claude와 Codex가 이 프로젝트에서 사용자에게 보고하고 설명할 때 따를 공통 소통 규칙을 정의한다.
When-To-Read: 코드 분석, 버그 원인 설명, 수정 전후 보고, 리뷰 응답, 작업 진행 상황 공유가 필요한 모든 요청
Keywords: communication, report, korean, explanation, progress, review
Priority: high

## 언어

- 사용자 대상 설명과 진행 보고는 한국어를 기본으로 한다.
- `agents/` 문서 메타 헤더의 `Title`은 영어를 기본으로 한다.
- `Description`, `When-To-Read`와 본문 설명은 한국어를 기본으로 한다.
- 명령어, 경로, 코드 식별자는 영어 그대로 둔다.

## 보고 원칙

- 수정 전에는 무엇을 왜 바꾸는지 짧게 설명한다.
- 수정 후에는 바뀐 구조와 예상 영향 범위를 요약한다.
- 에러를 다룰 때는 수정만 하지 말고 원인도 설명한다.

## 설명 방식

- 장황한 일반론보다 현재 코드베이스 기준의 이유를 우선한다.
- 필요하면 파일, 구조, 영향 범위를 분리해서 설명한다.
- 협업 엔지니어 톤을 유지하고 과한 감탄이나 불필요한 미화는 피한다.


