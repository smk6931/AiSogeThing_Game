# Title: Backend Structure Rules
Description: 백엔드 폴더 구조, 도메인 분리, 공통 모듈 배치 원칙을 정의한다.
When-To-Read: 백엔드 새 기능 추가, 라우터/서비스/레포지토리 구조 변경, 공통 모듈 정리가 필요한 작업 전
Keywords: backend, structure, domain, router, repository, service, client, exception
Priority: high

## 기본 원칙

- 백엔드는 `기능별 도메인` 기준으로 나눈다.
- 루트 아래에 모든 `router`, `repository`, `service`를 한곳에 몰아넣는 구조는 기본 규칙으로 강제하지 않는다.
- 새 기능은 가능하면 `back/<domain>/...` 아래에 배치한다.
- 도메인 내부에서 계층이 필요하면 `routers`, `services`, `repositories`, `schemas`, `models`처럼 분리한다.

## 권장 구조

- `back/<domain>/routers`
- `back/<domain>/services`
- `back/<domain>/repositories`
- `back/<domain>/schemas`
- `back/<domain>/models`

모든 도메인이 모든 하위 폴더를 다 가질 필요는 없다.
실제로 필요한 계층만 만든다.

## 공통 모듈 규칙

- 여러 도메인에서 재사용되는 기능만 공통 모듈로 뺀다.
- 공통 후보 예:
  - API client
  - DB session / transaction helper
  - 공통 exception / error response
  - 인증/권한 보조 로직
  - 공통 serializer / utility
- 아직 한 도메인에서만 쓰는 코드는 먼저 도메인 내부에 둔다.

## 예외처리 원칙

- 예외처리는 라우터에서 사용자 응답 형태를 정리하고, 서비스에서는 도메인 로직 기준으로 에러를 만든다.
- DB/외부 연동 실패를 숨기지 말되, 앱 전체 크래시보다 안전한 fallback을 우선한다.
- migration 전/후 차이처럼 환경 상태에 따라 실패할 수 있는 코드는 보호 코드를 둔다.

## 금지 패턴

- 모든 도메인 라우터를 `back/router` 하나에 몰기
- 서비스와 DB 접근 코드를 라우터에 직접 섞기
- 공통 모듈이라는 이유만으로 아직 공통이 아닌 코드를 루트 shared 영역으로 올리기
- 예외처리 기준 없이 `try/except`만 넓게 감싸서 원인 추적을 어렵게 만들기
