# Player Leveling

## Current State

- `game_character` already stores `level` and `exp`
- the project adds `player_level_curve` as a balance table

## Why

Do not hardcode level thresholds in multiple places.

Use one table for:

- required total EXP
- optional reward stat points
- optional reward skill points

## Practical Rule

- `game_character.level`: current player level
- `game_character.exp`: current accumulated EXP
- `player_level_curve.required_exp_total`: threshold for each level
