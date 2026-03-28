# Auth Flow

## Current Direction

- login page should act as the game intro entry
- signup should be a first-class screen, not a dead footer link
- normal signup should create both:
  - `user`
  - `game_character`

## Signup Rule

When a user signs up:

1. create `user`
2. create `game_character`
3. initialize:
   - `level = 1`
   - `exp = 0`
   - `hp = 100`
   - `max_hp = 100`
   - `mp = 50`
   - `max_mp = 50`

## UX Rule

- signup success should lead directly into usable play
- auto-login after signup is preferred
- guest login stays available as a fast entry path
