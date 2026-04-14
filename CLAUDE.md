# Claude Workflow

## Source Of Truth

- 프로젝트 공통 규칙은 [`agents/`](C:/GitHub/AiSogeThing_Game/agents/README.md)에 있다.
- 이 파일은 Claude 전용 워크플로우 안내만 담는다.
- 공통 아키텍처나 도메인 규칙을 여기에 중복하지 않는다.

## Reading Rule

- 코딩 전 요청 내용, 대상 파일, 명령 목적을 `agents/` 파일들과 대조한다.
- `Title`, `Description`, `When-To-Read`, `Keywords`가 명확히 일치하는 파일만 읽는다.
- `agents/` 전체를 기본으로 로드하지 않는다.
- 관련 파일을 선택한 뒤 해당 규칙을 따르고 기존 패턴을 재사용한다.

## Priority Order

1. 보안, 파괴적 명령 안전, 민감 데이터
2. 데이터 무결성과 소스 오브 트루스
3. 아키텍처와 계층 경계
4. 워크플로우와 검증 절차
5. 스타일과 표현 선호

## Core Index

- [`agents/README.md`](C:/GitHub/AiSogeThing_Game/agents/README.md)
- [`agents/development/core_rules.md`](C:/GitHub/AiSogeThing_Game/agents/development/core_rules.md)
- [`agents/development/backend_structure_rules.md`](C:/GitHub/AiSogeThing_Game/agents/development/backend_structure_rules.md)
- [`agents/development/editing_safety_rules.md`](C:/GitHub/AiSogeThing_Game/agents/development/editing_safety_rules.md)
- [`agents/frontend/ui_rules.md`](C:/GitHub/AiSogeThing_Game/agents/frontend/ui_rules.md)
- [`agents/game_design/world_partition_rules.md`](C:/GitHub/AiSogeThing_Game/agents/game_design/world_partition_rules.md)
- [`agents/game_design/road_design_rules.md`](C:/GitHub/AiSogeThing_Game/agents/game_design/road_design_rules.md)
- [`agents/game_design/local_image_generation.md`](C:/GitHub/AiSogeThing_Game/agents/game_design/local_image_generation.md) — 파티션 텍스처 생성 스크립트, 모델, 출력 경로 규칙 (파티션 이미지 생성 작업 시 필독)
- [`agents/frontend/asset_cache_rules.md`](C:/GitHub/AiSogeThing_Game/agents/frontend/asset_cache_rules.md) — Service Worker 에셋 영구 캐시, manifest 해시 갱신 절차 (GLB/텍스처 추가·변경 시 필독)
- [`agents/game_design/world_texture_terrain_direction.md`](C:/GitHub/AiSogeThing_Game/agents/game_design/world_texture_terrain_direction.md) — 바닥/파티션 텍스처 방향, 폴리곤별 이미지 방식 주의사항 (텍스처 구조 변경 시 필독)
- [`agents/game_design/world_elevation_cliff_rules.md`](C:/GitHub/AiSogeThing_Game/agents/game_design/world_elevation_cliff_rules.md) — 등고선 extruded 렌더링, 절벽 메시, showElevation 토글 규칙 (등고선/절벽 수정 시 필독)
- [`agents/process/workflow_rules.md`](C:/GitHub/AiSogeThing_Game/agents/process/workflow_rules.md)
- [`agents/process/tool_split_rules.md`](C:/GitHub/AiSogeThing_Game/agents/process/tool_split_rules.md)
- [`agents/process/global_tooling_scope_rules.md`](C:/GitHub/AiSogeThing_Game/agents/process/global_tooling_scope_rules.md)
- [`agents/process/advisory_rules.md`](C:/GitHub/AiSogeThing_Game/agents/process/advisory_rules.md)
- [`agents/process/communication_rules.md`](C:/GitHub/AiSogeThing_Game/agents/process/communication_rules.md)
- [`agents/planning/world_layer_design.md`](C:/GitHub/AiSogeThing_Game/agents/planning/world_layer_design.md) — Layer 0/1 분리 원칙, placed_objects 스키마, InstancedMesh 렌더 규칙 (오브젝트 배치 구현 시 필독)
- [`agents/planning/game_identity_hypothesis.md`](C:/GitHub/AiSogeThing_Game/agents/planning/game_identity_hypothesis.md) — 게임 정체성 가설, 검증 조건, AI 연동 로드맵 (방향 논의 시 참고)

## Claude Scope

- Claude 전용: 계획, 설계 비교, 리뷰 체크리스트, 문서 초안
- 프로젝트 전용: 백엔드 구조, UI 배치, DB 소스 오브 트루스, 편집 안전, 월드 규칙

프로젝트 전용 항목은 `agents/`에 둔다.

## Best Use Cases

- 큰 기능 계획
- 설계 대안 비교
- 요구사항 정리
- 문서 초안 작성
- 구현 후 리뷰 체크리스트 수행

## Recommended Workflow

- 큰 작업은 먼저 계획을 세운다.
- 공통 규칙은 `agents/`에서 읽고 구현한다.
- 구현 후에는 검증 절차를 수행한다.
- 위험 변경은 리뷰 기준으로 한 번 더 점검한다.

## Claude-Specific Commands

- `/plan`: 구현 전 계획 수립
- `/verify`: 빌드, 타입, 테스트, 로그 점검
- `/code-review`: 변경사항 리뷰
- `/handoff`: 다음 세션용 인계 정리

## Subagent Guidance

- `planner`: 큰 기능, 구조 변경, 리팩터링 계획
- `debugger`: 원인 분석
- `code-reviewer`: 품질과 보안 리뷰
- `architect`: 구조 선택 검토

## agents/ 추가 규칙

새 문서를 `agents/`에 추가하기 전에 반드시 아래 절차를 따른다.

1. `agents/README.md`를 읽어 현재 문서 목록과 분류를 파악한다.
2. 관련 카테고리 폴더 안의 기존 파일들의 메타 헤더(`Title`, `Description`, `Keywords`)를 읽는다.
3. 추가하려는 내용과 기존 파일 내용을 비교해 겹치는 항목이 있는지 확인한다.
4. 판단 기준:
   - **겹치는 내용 없음** → 새 파일 추가, `agents/README.md`와 `CLAUDE.md` Core Index에 등록
   - **일부 겹침** → 기존 파일에 내용 보강, 새 파일 추가 안 함
   - **완전히 동일** → 스킵, 기존 파일로 충분
5. 새 파일을 추가할 때는 반드시 메타 헤더(`Title`, `Description`, `When-To-Read`, `Keywords`, `Priority`)를 포함한다.
6. `agents/README.md`의 현재 문서 분류 목록을 최신 상태로 유지한다.

## Guardrails

- 새 공통 규칙이 필요하면 `agents/`에 추가한다.
- Claude 전용 사용법만 여기서 관리한다.
- 툴 편의 기능보다 프로젝트 공통 규칙을 우선한다.
- 프로젝트 규칙을 전역 설정이나 skill에 중복 작성하지 않는다.
