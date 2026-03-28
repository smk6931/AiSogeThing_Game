# Project Rules

## Agents Context Loading Rule

- 코드 실행이나 수정 전에 먼저 `agents/` 폴더 문서의 `Title`, `Description`, `When-To-Read`, `Keywords`를 본다.
- 유저 요청, 수정 대상 파일, 실행 명령 목적과 대조해서 필요한 문서만 추가 컨텍스트로 읽는다.
- `agents/`에 없는 규칙은 새 문서로 추가하거나 기존 문서로 옮긴 뒤 사용한다.
- 구현 시 `agents/` 안 규칙과 코드베이스 기존 패턴을 우선 따른다.
- 시작 문서:
  - [`agents/README.md`](C:/GitHub/AiSogeThing_Game/agents/README.md)
  - [`agents/development/core_rules.md`](C:/GitHub/AiSogeThing_Game/agents/development/core_rules.md)
  - [`agents/development/player_leveling_rules.md`](C:/GitHub/AiSogeThing_Game/agents/development/player_leveling_rules.md)
  - [`agents/frontend/ui_rules.md`](C:/GitHub/AiSogeThing_Game/agents/frontend/ui_rules.md)
  - [`agents/frontend/intro_signup_rules.md`](C:/GitHub/AiSogeThing_Game/agents/frontend/intro_signup_rules.md)
  - [`agents/game_design/world_partition_rules.md`](C:/GitHub/AiSogeThing_Game/agents/game_design/world_partition_rules.md)
  - [`agents/game_design/road_design_rules.md`](C:/GitHub/AiSogeThing_Game/agents/game_design/road_design_rules.md)
  - [`agents/auth/auth_flow_rules.md`](C:/GitHub/AiSogeThing_Game/agents/auth/auth_flow_rules.md)
