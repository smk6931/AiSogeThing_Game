# Title: 인증 흐름 규칙
Description: 로그인, 회원가입, 게스트 진입, 가입 직후 캐릭터 생성 같은 인증 흐름 규칙을 정리한다.
When-To-Read: 로그인 페이지 수정, 회원가입 UX 수정, 인증 API 연결, 가입 후 초기 캐릭터 생성 흐름을 다룰 때
Keywords: auth, login, signup, register, guest, account, character creation
Priority: high

## 기본 방향

- 로그인 화면은 단순 관리자 폼이 아니라 게임 진입 인트로 역할을 해야 한다.
- 회원가입은 죽은 링크가 아니라 실제 동작하는 별도 화면으로 제공한다.
- 일반 회원가입 시 `user`와 `game_character`를 함께 생성한다.

## 가입 규칙

회원가입이 성공하면 아래를 기본값으로 초기화한다.

- `level = 1`
- `exp = 0`
- `hp = 100`
- `max_hp = 100`
- `mp = 50`
- `max_mp = 50`

## UX 규칙

- 회원가입 성공 후 바로 플레이 가능한 흐름을 우선한다.
- 가능하면 가입 후 자동 로그인으로 이어간다.
- 게스트 로그인도 빠른 진입 경로로 유지한다.
