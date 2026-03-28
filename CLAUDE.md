# Project Rules

## Database

- Use `world_admin_area` as the canonical parent table for Seoul, district, and dong hierarchy.
- Use `world_level_partition` as the lowest gameplay partition table.
- Child partitions should reference parent rows with foreign keys.
- Child partitions may store short denormalized labels like city, district, dong, and theme for easier AI prompting and DBeaver inspection.
- Do not copy full parent geometry or full parent metadata into each child row.
- When readable inspection is needed, prefer a joined SQL view instead of heavy duplication.

## Level Data

- The recommended hierarchy is `city -> district -> dong -> partition`.
- Road data should remain part of traversal and adjacency logic, not just texture decoration.
- Primary partitions come from road split and dong boundary.
- Secondary partitions may refine landuse or manual gameplay design later.

## AI and Metadata

- Small denormalized metadata is acceptable if it helps prompts, tools, logs, and debugging.
- Large duplicated documents should not be stored in relational child rows without a strong reason.
- Use vector search only for semantic text retrieval, not for deterministic map ownership or region hierarchy.
