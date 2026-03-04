---
description: Maintain consistent naming conventions and architectural patterns across frontend and backend.
---

# Naming Consistency & Import Rules (변수/함수명 일관성 유지)

## 0. ⭐ Namespace Import Rule (C++ Style 강제) ⭐
- **가능하다면 `import * as ModuleName` 방식을 사용해라.**
- 함수 하나만 덜렁 가져와서 쓰면 출처를 알 수 없다. 클래스 인스턴스처럼 `.`을 찍어서 접근하게 만들어라.
- **예시 (나쁨):** `import { move } from './player'; move();` (누구의 move인지 모름)
- **예시 (좋음):** `import * as Player from './player'; Player.move();` (Player 클래스의 메서드임이 명확함)
- **Python:** `from game.managers.PlayerManager import PlayerManager` (클래스 명시적 import 추천)

## 1. Unreal Engine Style Architecture (OOP & Class-based) ⭐⭐⭐
- **1 Class = 1 File:** 모든 주요 로직(Manager, Entity)은 **반드시 클래스**로 정의하고, **파일 이름은 클래스 이름과 동일**하게 해라.
    - **Bad:** `manager.py` 안에 `PlayerManager`, `GameManager` 다 때려박기.
    - **Good:** `PlayerManager.py`, `GameManager.py` 각각 분리.
- **Singleton Pattern:** 매니저급 클래스는 파일 최하단에 `instance = ClassName()` 형태로 인스턴스를 생성해라.
    - **이유:** 상속(Inheritance)을 통해 기능을 확장하기 위함. 함수형 모듈은 상속이 안 된다.
- **No Random Aliasing:** 줄임말 쓰지 마라. `pm = PlayerManager()` (X) -> `playerManager` (O).

## 2. WebSocket Standard (공통 모듈 상속)
- **Inherit ConnectionManager:** 웹소켓 기능이 필요하면 바닥부터 짜지 말고 `back/utils/websocket.py`의 `ConnectionManager`를 상속받아라.
- **Why:** `connect`, `disconnect`, `broadcast` 같은 기본 통신 로직은 player, monster 모두 동일하다. 중복 코드를 없애라.
- **매니저 위치**: 각 도메인의 `managers/` 서브폴더에 클래스를 정의하고, 파일 최하단에 `instance = ClassName()` 형태로 싱글톤 생성.

## 3. Import Rules (Import 시 원본 이름 유지)
- **제멋대로 이름을 바꾸지 마라.**
- **예시 (나쁨):** `import { router as auth_router }` (X) -> `import { router as userRouter }` (O)

## 4. Callback & Prop Naming (콜백 및 Props 전달 시 일관성)
- 함수를 prop이나 핸들러로 넘길 때 이름을 **그대로 쓰거나** `handle[Action]` -> `on[Event]` 패턴을 따를 것.
- **예시 (나쁨):** `<Button onClick={(e) => execute(e)} />`
- **예시 (좋음):** `<Button onClick={handleClick} />`

## 5. Lambda/Arrow Functions (람다식 변수명)
- 람다식에서도 `u`, `x`, `m` 같은 **한 글자 변수명 금지**.
- **예시 (나쁨):** `users.map(u => u.id)`
- **예시 (좋음):** `users.map(user => user.id)`

**핵심:** 언리얼 C++ 하듯이 엄격하게(OOP) 짜라. 변수명 줄이다가 가독성 망친다.
