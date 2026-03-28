# Title: 플레이어 레벨링 규칙
Description: 캐릭터 레벨, 경험치, 레벨 곡선 테이블과 밸런스 조정 규칙을 정리한다.
When-To-Read: 레벨업 공식 수정, 경험치 테이블 추가, 캐릭터 성장 밸런스 조정, 스탯 보상 설계를 할 때
Keywords: player, leveling, level, exp, progression, curve, balance
Priority: medium

## 현재 방향

- `game_character`는 현재 레벨과 누적 경험치를 가진다.
- `player_level_curve`는 레벨 기준표 역할을 맡는다.

## 규칙

- 레벨 기준 경험치를 여러 곳에 하드코딩하지 않는다.
- `player_level_curve.required_exp_total`을 단일 기준으로 사용한다.
- 레벨업 보상은 필요하면 `reward_stat_points`, `reward_skill_points`로 분리한다.

## 실무 원칙

- `game_character.level`: 현재 레벨
- `game_character.exp`: 누적 경험치
- `player_level_curve`: 밸런스 조정용 표
