# Title: 월드 파티션 규칙
Description: 서울 월드를 구/동/파티션/그룹 구조로 나누고 이름, 분위기, 렌더 역할을 부여하는 규칙.
When-To-Read: 월드 파티션 설계, 그룹 묶기, 지역 이름/설명 생성, 레벨 데이터 구조 변경 전.
Keywords: world, partition, group, district, dong, theme, persona, landuse, level design
Priority: high

## 기본 구조

- 계층은 `city -> district -> dong -> micro partition`이다.
- `world_level_partition`는 가장 작은 공간 셀이다.
- 그룹은 별도 row가 아니라 `group_key`, `group_display_name` 등으로 묶는다.

## 역할 분리

- micro partition:
  - 현재 위치 판정
  - 인접 관계
  - 세밀한 스폰 배치
- grouped play region:
  - UI 지역명
  - 월드맵 가독성
  - 큰 분위기/테마

## 감성 규칙

- 서울 지형을 그대로 쓰되 판타지 감성을 덧입힌다.
- 지역 이름은 현실 지명보다 무드와 체험을 우선한다.
- `display_name`, `summary`, `description`, `persona_tag`는 파티션 체험을 구분하는 장치다.

## 분할 규칙

- 최종 셀은 도로 기준 분할을 우선한다.
- landuse는 최종 분할 셀의 성격 분석 입력으로 쓴다.
- 작은 셀을 UI에 그대로 다 노출하지 않고 그룹으로 묶어 읽기성을 확보한다.
