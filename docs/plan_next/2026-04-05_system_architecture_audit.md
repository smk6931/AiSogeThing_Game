# 시스템 아키텍처 감사 문서

작성일: 2026-04-05
대상 프로젝트: `C:\GitHub\AiSogeThing_Game`
범위:
- 프론트 구조, 라우팅, API 계층, 컴포넌트 모듈화
- 백엔드 모듈 구조, 라우터, 매니저, 서비스, DB 접근 계층
- 렉, 병목, 중복, 구조적 부채

## 1. 요약 결론

이 프로젝트는 지금 단계에서 "완전히 잘못된 구조"는 아니다.
오히려 빠르게 플레이 가능한 1차 시스템을 붙이는 데는 성공한 구조다.

하지만 현재 상태는 아래 특징이 강하다.

- 프론트는 `GameEntry -> GameCanvas -> RpgWorld -> GameOverlay` 중심으로 복잡도가 과도하게 집중됨
- 백엔드는 `router + manager + repository/service`가 섞인 하이브리드 구조
- 도메인 기준 모듈화와 테이블 기준 모듈화가 혼합되어 있음
- 렌더링, WebSocket, UI 상태가 동시에 커지면서 병목 가능성이 이미 드러남

즉, 지금 필요한 것은 "폴더 구조 전체 갈아엎기"가 아니라:

- 중심 파일 분해
- 책임 경계 명확화
- 렌더/소켓/상태 병목 제거
- 월드 시스템과 게임 시스템 분리

순서의 리팩터링이다.

## 2. 현재 구조 진단

## 2.1 프론트 구조

현재 프론트 구조는 대략 아래 패턴이다.

- `App.jsx`
  - `/login`, `/signup`, `/game` 단순 라우팅
- `GameEntry.jsx`
  - 게임 세션 상위 상태 허브
- `engine/GameCanvas.jsx`
  - Canvas와 R3F 월드 진입
- `entity/world/RpgWorld.jsx`
  - 월드 렌더 중심
- `ui/GameOverlay.jsx`
  - HUD, 레이어 패널, 미니맵, 설정, 월드 도구 패널 중심

좋은 점:

- 라우팅이 단순하고 이해하기 쉽다
- `api`, `hooks`, `ui`, `entity`, `engine` 구분은 1차적으로 나쁘지 않다
- 게임 월드와 일반 인증 화면은 분리되어 있다

문제점:

- `/game` 아래 복잡도가 거의 하나의 거대한 화면 셸에 몰린다
- `GameEntry.jsx`가 네트워크, 입력, UI 상태, 월드 토글, 인벤토리, 지역 정보까지 너무 많이 안고 있다
- `GameOverlay.jsx`는 이미 거대한 HUD 통합 파일이 되어 재사용성과 변경 안전성이 낮다
- `RpgWorld.jsx`는 렌더 오케스트레이션을 넘어서 렌더 정책까지 많이 안고 있다

판정:

- 폴더 이름은 괜찮다
- 파일 책임 경계는 무너지고 있다

## 2.2 백엔드 구조

현재 백엔드 구조는 도메인별 폴더를 가지고 있지만 내부 일관성은 완전하지 않다.

예:

- `user/`
  - `models`, `routers`, `schemas`, `services`
- `world/`
  - `models`, `routers`, `services`
- `item/`
  - `models`, `routers`, `repository.py`, `service.py`
- `monster/`
  - `models`, `routers`, `managers`
- `player/`
  - `models`, `routers`, `managers`

좋은 점:

- 사용자, 월드, 아이템, 몬스터, 플레이어 같은 상위 도메인 분리가 되어 있다
- `world`는 서비스 단위 분리가 비교적 잘 되어 있다
- 아이템은 repository/service로 어느 정도 계층 분리가 있다

문제점:

- 어떤 모듈은 `services`, 어떤 모듈은 `managers`, 어떤 모듈은 루트에 `repository.py`가 있는 식으로 패턴이 섞여 있다
- `back/main.py`가 라우터 등록만 하는 수준을 넘어서 런타임 오케스트레이션과 브로드캐스트 정책까지 일부 품고 있다
- `player/routers/router.py`에 WebSocket 처리, 전투 보상, 드롭, DB 저장까지 많이 몰려 있다
- `MonsterManager.py`는 몬스터 메모리 모델, AI 루프, 스폰 정책, 드롭 테이블, 근접 공격 처리까지 다 갖고 있다

판정:

- 백엔드는 "도메인 분리" 방향은 맞다
- 하지만 "도메인 내부 계층 분리"는 아직 덜 정리된 상태다

## 3. 테이블별로 놔둔 게 맞냐?

짧게 답하면:

- "전부 테이블 기준"으로 가는 것은 비추천
- "도메인 기준 상위 모듈 + 테이블 기준 하위 파일"은 가능

현재 프로젝트에 더 맞는 기준은 아래다.

### 추천 기준

- 상위 모듈: 도메인 기준
  - `user`
  - `player`
  - `monster`
  - `item`
  - `world`

- 하위 계층: 역할 기준
  - `routers`
  - `services`
  - `repositories`
  - `models`
  - `schemas`
  - `managers` 또는 `runtime`

### 왜 전부 테이블 기준이 아니어야 하나

이 프로젝트는 단순 CRUD 앱이 아니다.

예:

- `player`는 캐릭터 테이블 하나가 아니라
  - WebSocket 세션
  - 위치 동기화
  - 전투 상태
  - 보상 반영
  - 인벤토리 사용
  를 함께 다룬다.

- `world`는 테이블 몇 개보다
  - 행정구역
  - 구역 판정
  - 지형
  - 텍스처
  - 블록 생성
  - 파티션 그룹
  같은 시스템 성격이 더 강하다.

즉:

- `item_template`, `character_inventory`, `character_equipment` 같은 개별 테이블은 repository 내부 단위로 나누는 것은 괜찮다
- 하지만 상위 폴더까지 테이블 기준으로 쪼개면 게임 시스템 흐름이 찢어진다

### 현재 상태 평결

- 지금처럼 `item`, `world`, `player`, `monster` 같은 도메인 폴더를 두는 방향은 맞다
- 다만 내부 구조를 도메인마다 더 일관되게 맞춰야 한다

## 4. 프론트 병목과 구조 부채

## 4.1 가장 큰 프론트 병목 후보

### 1. `GameOverlay.jsx`

문제:

- 파일이 너무 크다
- HUD, 레이어 패널, 미니맵, 설정, 인벤토리 트리거, 지역 표시, 월드 도구까지 한 파일에 몰려 있다
- 상태가 많아서 작은 변경도 리렌더 영향 범위를 넓힌다

영향:

- 유지보수 난이도 상승
- 토글 로직 충돌 가능성 증가
- UI 변경 시 회귀 위험 큼

### 2. `RpgWorld.jsx`

문제:

- 월드 렌더 오케스트레이션 파일인데 너무 많은 레이어 렌더 조건을 직접 관리한다
- 카메라, 디버그 설정, 월드 로드 단계, 지역 판정, 플레이어/몬스터 렌더까지 다 모인다

영향:

- 레이어 정책 변경 시 중심 파일이 계속 비대해짐
- 렌더 조건 실수로 "레이어는 껐는데 기본 메쉬는 남는" 같은 UX 혼란 발생

### 3. `useGameSocket.js`

문제:

- WebSocket 이벤트 스위치가 길다
- 플레이어, 몬스터, 채팅, 보상, 아이템 드롭, 피격 이벤트가 한 훅에 몰려 있다
- 이벤트 타입이 늘수록 읽기 어려워진다

영향:

- 메시지 프로토콜 변경 비용 증가
- 부분 테스트 어려움

### 4. 중복 API 로딩 패턴

`GameEntry.jsx`에서:

- ground texture folders 로딩
- road texture folders 로딩

패턴이 거의 같다.

이건 당장 큰 병목은 아니지만, 같은 비동기 패턴이 파일 곳곳에 늘어나기 쉬운 신호다.

## 4.2 렉/프레임 저하 후보

### 1. 월드 레이어가 동시에 많다

현재 월드 쪽은 아래가 동시에 렌더될 수 있다.

- `MapTiles`
- `DongGroundMesh`
- `SeoulTerrain`
- `ZoneOverlay`
- `CityBlockOverlay` 여러 개
- `SeoulHeightMap`
- 경계 오버레이들
- 플레이어/몬스터/투사체

이건 레이어를 많이 켜면 GPU/CPU 모두 부담이 커진다.

### 2. `MapTiles`는 항상 `FallbackUnderlay`를 렌더한다

`showOsmMap`이 꺼져도 기본 언더레이가 남는다.

이건 성능보다 UX 문제에 가깝지만,
"레이어를 다 껐는데도 월드 기본 메쉬가 남는다"는 식의 혼란을 만든다.

### 3. 500ms 간격 지역 판정

`GameOverlay.jsx`에서 위치 기반 district/dong 판정을 interval로 계속 돈다.

이건 치명적이진 않지만:

- 이미 `useCurrentRegionInfo`
- `useSeoulDistricts`
- `useSeoulDongs`

같은 훅 체계가 있는 상황에서 지역 판정 경로가 분산되어 있다.

즉, 성능보다 "판정 소스가 여러 군데"인 점이 더 문제다.

### 4. 월드 관련 대형 파일들

특히 아래 파일들은 렌더/지오메트리 계산/로딩을 많이 품는다.

- `ZoneOverlay.jsx`
- `SeoulTerrain.jsx`
- `CityBlockOverlay.jsx`
- `SeoulHeightMap.jsx`

이 영역은 렌더 프레임보다 "geometry build / data fetch / cache invalidation" 전략이 중요하다.

## 5. 백엔드 병목과 구조 부채

## 5.1 가장 큰 백엔드 병목 후보

### 1. `back/main.py`의 몬스터 visibility 브로드캐스트

현재 `broadcast_monster_delta_to_visible_players`는:

- 플레이어마다
- 현재 위치를 읽고
- 반경 내 몬스터를 다시 계산하고
- 이전 visible set과 비교한다

즉, 변경 1회마다 `플레이어 수 x 몬스터 수` 성격의 계산이 반복된다.

초기에는 괜찮지만 접속자와 몬스터 수가 늘면 병목이 된다.

### 2. `MonsterManager.game_loop()`

문제:

- 0.1초마다 전체 몬스터 순회
- 각 몬스터마다 가장 가까운 플레이어 탐색
- 공격/이동/상태 전환/삭제 처리
- 변경분 브로드캐스트

즉, 현재 구조는 전형적인 "작을 때는 빠르지만 커지면 급격히 비싸지는 루프"다.

### 3. `player/routers/router.py`에 로직 집중

문제:

- WebSocket 처리
- 이동 브로드캐스트
- 채팅
- 스킬 중계
- 몬스터 피격
- 보상 지급
- 캐릭터 저장
- 드롭 처리
- 아이템 사용

이게 하나의 WebSocket 라우터 루프 안에 다 있다.

이건 성능보다 구조 병목이다.
즉, 바꾸기 어려워서 기능 확장 때마다 속도가 더 느려질 구조다.

### 4. `PlayerManager.connect()`의 과한 초기 책임

접속 시점에:

- 캐릭터 로드/upsert
- 장비 보너스 합산
- 기본 스탯 초기화
- 메모리 상태 등록

이것도 나쁘진 않지만, 점점 "세션 초기화 서비스"와 "메모리 연결 관리"가 섞일 가능성이 크다.

## 5.2 DB 접근 구조 평결

현재 `back/core/database.py`는 raw SQL helper 중심이다.

장점:

- 빠르게 만들기 좋다
- 쿼리 의도가 명시적이다

단점:

- ORM 모델이 있지만 실제 서비스 계층은 raw SQL helper와 혼합된다
- repository 규칙이 모듈마다 일관되지 않다
- 에러 처리, 트랜잭션 경계, 재사용 패턴이 점점 분산될 수 있다

판정:

- 지금 단계에서는 허용 가능
- 하지만 앞으로는 "ORM vs raw SQL"을 통일하려 하기보다
  "raw SQL은 repository에서만" 정도로 일관성을 잡는 편이 현실적이다

## 6. 중복과 일관성 문제

## 6.1 프론트 중복

- 유사한 texture folder fetch effect가 두 번 존재
- UI 패널 내부에 레이어/설정/월드도구/맵 관련 패턴이 반복
- 지역 정보 계산과 표시가 여러 레이어에서 부분 중복

## 6.2 백엔드 중복

- 반경 기반 필터링 로직이 `PlayerManager`, `MonsterManager`, `main.py`에 분산
- "접속자 상태 + 주변 브로드캐스트" 계열 로직이 여러 군데서 유사하게 등장
- 드롭/보상/저장 타이밍이 WebSocket 라우터에 하드코딩

## 6.3 아키텍처 일관성 문제

- `user`는 service 계층형
- `item`은 repository/service 혼합
- `monster`는 manager 중심
- `player`는 router + manager 중심
- `world`는 service 묶음형

이건 초기 속도에는 유리하지만, 팀이나 기능이 커지면 "어디에 뭘 넣어야 하는지"가 불명확해진다.

## 7. 현재 구조에서 잘한 점

공정하게 보면 좋은 점도 분명하다.

### 1. 프론트 상위 폴더 역할 구분은 나쁘지 않다

- `api`
- `hooks`
- `entity`
- `engine`
- `ui`
- `screens`

이 정도 분리는 1차 게임 프론트 구조로 충분히 쓸 만하다.

### 2. 백엔드 상위 도메인 폴더 전략은 맞다

`user`, `player`, `monster`, `item`, `world` 분리는 유지하는 게 맞다.

### 3. 월드 시스템은 서비스 단위 분리 감각이 있다

`world/services`는 아직 거칠지만,

- district
- zone
- terrain
- partition
- design

처럼 관심사 분리를 시작한 점은 좋다.

### 4. 성능 대응 흔적이 이미 있다

- 몬스터 RAF flush
- 위치 쓰로틀
- 월드 stage loading
- visible flag 기반 렌더 제어

즉, 완전히 무방비 상태는 아니다.
문제는 대응이 "부분 최적화" 수준에 머물러 있다는 점이다.

## 8. 리팩터링 우선순위 제안

전체 구조를 한 번에 갈아엎지 말고 아래 순서로 가는 것이 맞다.

## Phase 1. 중심 파일 분해

가장 먼저 할 일:

- `GameOverlay.jsx` 분해
  - stat panel
  - layer panel
  - map panel
  - world tools
  - floating notices
- `GameEntry.jsx` 분해
  - world settings
  - texture folder loading
  - modal control
  - game session orchestration
- `useGameSocket.js` 분해
  - player message handler
  - monster message handler
  - chat handler
  - reward/item handler

이 단계에서는 폴더 구조를 크게 바꾸지 않아도 된다.

## Phase 2. 백엔드 책임 분리

- `player/routers/router.py`
  - WebSocket endpoint는 유지
  - 전투 처리/보상 처리/아이템 사용은 서비스 함수로 분리
- `MonsterManager.py`
  - 템플릿 정의
  - AI 루프
  - 전투 판정
  - visibility 계산
  를 서서히 분리

추천:

- `monster/runtime/`
- `monster/services/`
- `player/services/`

중 하나로 정리

## Phase 3. 월드 렌더 정책 정리

- "레이어 토글"이 제어하는 범위 정의
- 항상 남는 기본 메쉬/언더레이 정의
- geometry build와 data fetch 경계 정리
- 지역 판정 경로 단일화

## Phase 4. 성능 최적화

- 몬스터 visibility 계산 전략 개선
- 근접 플레이어 탐색 최적화
- 월드 레이어 동시 렌더 수 축소
- 필요 시 spatial index 도입 검토

## 9. 바로 적용할 구조 원칙

앞으로 리팩터링 기준은 아래로 두는 것이 좋다.

### 프론트

- 화면 엔트리 파일은 상태 조합과 화면 연결만
- 렌더 정책 파일은 렌더 오케스트레이션만
- UI 대형 패널은 기능별로 쪼개기
- 월드 데이터 계산은 UI 안에서 반복하지 않기

### 백엔드

- 상위 폴더는 도메인 기준 유지
- 라우터는 입출력만
- 서비스는 비즈니스 로직
- repository는 DB 접근만
- manager/runtime은 메모리 상태나 루프만

### DB/테이블

- 상위 모듈을 테이블 기준으로 찢지 않는다
- 테이블별 책임은 repository나 model 레벨에서 나눈다
- 시스템 흐름은 도메인 기준으로 묶는다

## 10. 최종 판정

### 현재 상태 평가

- 프론트 폴더 구조: 보통 이상
- 프론트 파일 책임 분리: 부족
- 프론트 렌더 병목 관리: 부분 대응
- 백엔드 도메인 분리: 보통 이상
- 백엔드 계층 일관성: 부족
- WebSocket/게임 루프 구조: 확장 전 단계
- 리팩터링 시급성: 높음

### 한 줄 결론

이 프로젝트는 "구조를 전부 다시 짜야 하는 상태"는 아니다.
하지만 지금부터는 기능 추가보다 먼저,

- 거대 중심 파일 분해
- 도메인 내부 계층 정리
- 렌더와 소켓 병목 제거

를 해야 다음 단계 구현 속도가 오히려 빨라진다.

즉, 현재 리팩터링 방향은 맞다.
다만 "전체 폴더 갈아엎기"가 아니라 "중심 병목부터 해체" 순서로 가야 한다.
