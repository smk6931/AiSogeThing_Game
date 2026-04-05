# Project Agent Rules

## Source Of Truth

- Project-wide rules live in [`agents/`](c:/GitHub/AiSogeThing_Game/agents/README.md).
- [`CLAUDE.md`](c:/GitHub/AiSogeThing_Game/CLAUDE.md) and [`CODEX.md`](c:/GitHub/AiSogeThing_Game/CODEX.md) are tool-specific usage guides only.
- Do not duplicate shared architecture or domain rules into tool-specific files.

## Reading Rule

- Before coding, compare the user request, target files, and command purpose against files under [`agents/`](c:/GitHub/AiSogeThing_Game/agents/README.md).
- Read only the files whose `Title`, `Description`, `When-To-Read`, and `Keywords` clearly match the task.
- Do not load the entire `agents/` folder by default.
- After selecting relevant files, follow those rules and reuse similar patterns already used in the codebase.

## Priority Order

- Security, destructive command safety, sensitive data
- Data integrity and source of truth
- Architecture and layer boundaries
- Workflow and verification process
- Style and expression preferences

## Core Index

- [`agents/README.md`](c:/GitHub/AiSogeThing_Game/agents/README.md)
- [`agents/development/core_rules.md`](c:/GitHub/AiSogeThing_Game/agents/development/core_rules.md)
- [`agents/frontend/ui_rules.md`](c:/GitHub/AiSogeThing_Game/agents/frontend/ui_rules.md)
- [`agents/game_design/world_partition_rules.md`](c:/GitHub/AiSogeThing_Game/agents/game_design/world_partition_rules.md)
- [`agents/game_design/road_design_rules.md`](c:/GitHub/AiSogeThing_Game/agents/game_design/road_design_rules.md)
- [`agents/process/workflow_rules.md`](c:/GitHub/AiSogeThing_Game/agents/process/workflow_rules.md)
- [`agents/process/tool_split_rules.md`](c:/GitHub/AiSogeThing_Game/agents/process/tool_split_rules.md)
