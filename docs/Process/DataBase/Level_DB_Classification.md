# Level DB Classification

## 목적

서울 월드의 바닥, 도로, 용도, 분할 레이어를 게임용 레벨 파티션 데이터로 정규화한다.

핵심은 "예쁜 텍스처 목록"을 저장하는 것이 아니라, 플레이어가 밟고 있는 현재 파티션을 식별하고 그 파티션의 이름, 설명, 테마, 이동성, 연결 관계를 DB에서 읽을 수 있게 만드는 것이다.

## 1차 분류 원칙

1차는 행정구역과 분할 레이어를 결합해서 기본 파티션을 만든다.

- 시/도: `서울특별시`
- 구: 예) `동작구`
- 동: 예) `노량진1동`
- 1차 파티션: `도로 레이어 + 동 경계` 기준으로 분리된 `Sector Plot`

이 단계의 목적은 "현재 발판이 어느 구역인가"를 안정적으로 식별하는 것이다.

## 2차 분류 원칙

2차는 1차 파티션 위에 용도와 디자인 메타를 덧씌운다.

- 용도 레이어: `residential`, `commercial`, `industrial`, `educational`, `medical`, `park`, `forest`, `water`
- 디자인 레이어: `theme_code`, `texture_profile`, `danger_level`, `cover_density`, `poi_weight`
- 연결 레이어: 파티션 간 인접, 주동선, 우회로, 병목

즉 1차는 "경계와 식별", 2차는 "게임플레이 성격"이다.

## 권장 테이블

### `world_admin_area`

행정 계층 캐시.

- `osm_id`: 원본 행정구역 ID
- `area_level`: `city`, `district`, `dong`
- `name`, `name_en`
- `parent_id`
- `center_lat`, `center_lng`
- `boundary_geojson`

### `world_level_partition`

실제 바닥 파티션 테이블.

- `partition_key`: 예) `seoul.dongjak.noryangjin1.primary.p001`
- `admin_area_id`: 소속 동
- `city_name`, `district_name`, `dong_name`
- `partition_stage`: `primary`, `secondary`
- `partition_seq`
- `partition_type`: `sector`, `road`, `plaza`, `poi`
- `source_layer`: `road_split`, `landuse_overlay`, `manual_design`
- `map_name`
- `display_name`
- `summary`
- `description`
- `theme_code`
- `landuse_code`
- `texture_profile`
- `is_road`
- `is_walkable`
- `boundary_geojson`
- `source_feature`
- `gameplay_meta`

### `world_partition_adjacency`

파티션 연결 테이블.

- `from_partition_id`
- `to_partition_id`
- `relation_type`: `touching`, `road_link`, `stairs`, `portal`
- `traversal_cost`
- `edge_meta`

## 파티션 키 규칙

파티션 키는 사람이 읽을 수 있어야 한다.

- 형식: `{city}.{district}.{dong}.{stage}.p{seq}`
- 예시: `seoul.dongjak.noryangjin1.primary.p001`

이 키는 렌더링, 디버그, 로그, 스폰, 퀘스트, GM 툴에서 공통 식별자로 쓴다.

## 노량진1동 1차 기준

현재 캐시 파일 기준:

- 동 이름: `노량진1동`
- 동 OSM ID: `3879474`
- 캐시 파일: `back/cache/zones/v20_dong_3879474.json`
- 1차 파티션 수: `81`

이 `81개`는 현재 `Sector Plot` 개수 기준이며, 이후 `용도 + 수동 디자인`을 반영하면 2차 파티션 수는 증가할 수 있다.

## 노량진1동 샘플 분류 규칙

초기 샘플은 아래 규칙으로 넣는다.

- `p001` ~ `p020`: 한강 접경부 또는 외곽 경계형 파티션
- `p021` ~ `p040`: 주거 밀집형 파티션
- `p041` ~ `p055`: 학교/공원 인접 완충 파티션
- `p056` ~ `p070`: 내부 연결로와 교차 파티션
- `p071` ~ `p081`: 특수 포인트 후보 파티션

이 이름은 임시지만, DB에 먼저 적재해두면 이후 수동 레벨디자인 과정에서 세부 이름과 설명만 교체하면 된다.

## 적재 순서

1. `world_admin_area`에 서울/구/동 계층 적재
2. `world_level_partition`에 1차 `Sector Plot` 적재
3. 각 파티션에 `map_name`, `description`, `theme_code`, `landuse_code` 부여
4. `world_partition_adjacency` 계산 및 적재
5. 2차 수동 분할이 필요하면 `partition_stage = secondary`로 추가 적재

## 운영 기준

- 도로는 화면 장식이 아니라 연결 그래프이므로 별도 메타를 유지한다.
- 바닥 텍스처는 파티션의 결과물이지 원본 데이터가 아니다.
- 파티션 설명은 AI 생성 문구를 써도 되지만, 키와 행정 계층은 기계적으로 안정적이어야 한다.
- 대규모 서울 전역 확장을 고려해 `행정구역 -> 파티션 -> 인접관계` 구조를 유지한다.
