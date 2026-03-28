# Project Agent Rules

## World DB Policy

- `world_admin_area` is the source of truth for city, district, and dong hierarchy.
- `world_level_partition` must reference the parent area by foreign key.
- Child partitions may keep a small denormalized snapshot for readability and debugging:
  - `city_name`
  - `district_name`
  - `dong_name`
  - `partition_key`
  - `theme_code`
  - `landuse_code`
- Do not duplicate full parent geometry or full parent metadata into every child partition row.
- If humans need easy inspection in DBeaver, prefer a SQL view that joins parent and child tables over copying entire parent rows into child tables.

## AI Metadata Policy

- Redundant labels that help prompts, admin tools, logs, and debugging are allowed.
- Large duplicated text blobs are not allowed unless there is a concrete runtime reason.
- Put fast-changing or experimental design data into `gameplay_meta` or another JSON field before creating many new top-level columns.

## Partition Design Policy

- Keep the hierarchy as `city -> district -> dong -> partition`.
- Roads are not only visual layers. They are traversal and adjacency data.
- Primary partitions are generated from administrative boundary plus road split.
- Secondary partitions may be added later for landuse refinement or manual level design.

## Vector DB Policy

- Do not use vector DB for core map hierarchy, foreign keys, or deterministic current-region lookup.
- Use vector DB only for semantic retrieval cases such as:
  - lore search
  - quest text search
  - NPC dialogue memory
  - region flavor text retrieval
- Structured world geography should stay in relational tables first.

