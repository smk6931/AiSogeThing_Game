# World ERD

## Current Structure

The current world DB has two active responsibilities:

- `world_admin_area`: city, district, dong hierarchy
- `world_level_partition`: smallest gameplay partition

`group_*` fields in `world_level_partition` are not a separate table yet. They are grouping metadata used to bind multiple micro partitions into one playable region label.

```mermaid
erDiagram
    WORLD_ADMIN_AREA ||--o{ WORLD_ADMIN_AREA : parent_of
    WORLD_ADMIN_AREA ||--o{ WORLD_LEVEL_PARTITION : contains

    WORLD_ADMIN_AREA {
        int id PK
        bigint osm_id UK
        string area_level
        string area_code UK
        string name
        string name_en
        int parent_id FK
        float center_lat
        float center_lng
        json boundary_geojson
        json area_meta
    }

    WORLD_LEVEL_PARTITION {
        bigint id PK
        string partition_key UK
        int admin_area_id FK
        string city_name
        string district_name
        string dong_name
        string partition_stage
        int partition_seq
        string partition_type
        string source_layer
        string source_version
        string map_name
        string display_name
        text summary
        text description
        string theme_code
        string group_key
        int group_seq
        string group_display_name
        string group_theme_code
        string landuse_code
        string dominant_landuse
        string persona_tag
        string texture_profile
        bool is_road
        bool is_walkable
        float area_m2
        float landuse_mix_score
        float centroid_lat
        float centroid_lng
        json boundary_geojson
        json source_feature
        json gameplay_meta
    }
```

## Why There Are Two Active Tables

- `world_admin_area` answers: "Which dong or district does this belong to?"
- `world_level_partition` answers: "Where exactly is the player standing?"

## Recommended Expansion For Codex

If the project will build a world codex, region lore, quest routing, monster habitat, and gatherable summaries, then a separate playable-region table is recommended.

- Keep `world_admin_area` for administrative hierarchy
- Keep `world_level_partition` for deterministic position lookup
- Add `world_region_group` for codex-facing playable regions

```mermaid
erDiagram
    WORLD_ADMIN_AREA ||--o{ WORLD_REGION_GROUP : contains
    WORLD_REGION_GROUP ||--o{ WORLD_LEVEL_PARTITION : groups

    WORLD_REGION_GROUP {
        bigint id PK
        string group_key UK
        int admin_area_id FK
        int group_seq
        string display_name
        string theme_code
        text summary
        text description
        int recommended_level
        int danger_tier
        text landmark_text
        json meta
    }

    WORLD_LEVEL_PARTITION {
        bigint id PK
        string partition_key UK
        int admin_area_id FK
        string group_key FK
    }
```

## Practical Rule

Use this mental model:

- `admin_area`: address hierarchy
- `region_group`: codex and content region
- `partition`: exact gameplay cell

This is the cleaner long-term shape for:

- world codex
- quest region references
- monster habitat references
- gatherable region references
- group boundary rendering
- current position lookup
