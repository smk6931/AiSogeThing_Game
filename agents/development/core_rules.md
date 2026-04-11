# Title: Core Development Rules
Description: 데이터 구조, 배포, 민감정보, 파일 생성 규칙에 대한 기본 엔지니어링 정책.
When-To-Read: DB 수정, 배포 스크립트 수정, 프로젝트 구조 변경, 민감정보 처리 작업 전.
Keywords: database, deploy, env, backup, migration, gitignore, structure, security
Priority: high

## 기본 원칙

- 민감정보는 Git에 올리지 않는다.
- `.env`, SQL dump, 키 파일, 인증서 파일은 로컬/서버 전송용으로만 사용한다.
- 배포 전에 DB dump와 롤백 경로를 먼저 생각한다.
- 자동화 스크립트는 한 파일에 모든 책임을 몰지 말고 역할별로 분리한다.

## DB 원칙

→ `agents/db/` 참고 (db_strategy, level_db_classification, partition_grouping_concept)

## 배포 원칙

- 기본 흐름은 `git push -> local backup -> remote upload -> remote restore -> migrate -> restart`다.
- 원격 DB 복원 전에는 서버 현재 DB를 먼저 백업한다.
- 실패 시 최소한 DB 롤백 경로가 있어야 한다.

## Git 원칙

- dump, 키, 임시 백업은 `.gitignore`에 추가한다.
- 이미 추적된 민감 파일은 `git rm --cached`로 인덱스에서 제거한다.

## 콘솔 출력 원칙

- 백엔드(Python) print/log 문에 이모지를 절대 사용하지 않는다.
- 이유: Windows 기본 인코딩(cp949)이 이모지(유니코드 고번위)를 처리 못해 UnicodeEncodeError 발생 → WebSocket 등 ASGI 핸들러가 크래시됨.
- 대체: `[OK]`, `[WARN]`, `[ERROR]`, `[LEAVE]` 같은 ASCII 태그 사용.

