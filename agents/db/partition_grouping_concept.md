# 파티션 그룹핑 개념 정리

## 핵심 규칙

`world_level_partition`는 계속 **하나의 테이블**로 관리한다.

한 row는 끝까지 "가장 작은 파티션 1개"를 뜻해야 한다.

대신 각 row에 아래 **그룹용 컬럼**을 추가한다.

- `group_key`
- `group_seq`
- `group_display_name`
- `group_theme_code`

## 왜 `type=sector/group`으로 섞으면 안 되나

한 테이블에 "작은 파티션 row"와 "큰 그룹 row"를 섞으면 아래 로직이 더러워진다.

- 현재 위치 판정
- 경계선 표시
- 텍스처 덮기
- UI 지역명 출력
- 인접 구역 계산

같은 테이블이라도 "서로 다른 크기의 geometry row를 같이 넣는 것"은 피한다.

## 실제 게임에서 사용 방식

### 현재 위치 판정
플레이어는 가장 작은 파티션 기준으로 판정한다.

```
player -> p042 안에 들어감
```

### UI 지역 이름
화면에는 `p042` 자체 이름이 아니라 그 row가 속한 그룹 이름을 띄운다.

```
p042.group_display_name = "기원의 뜰목"
```

### 경계선
- 디버그 모드: micro 경계 (모든 작은 파티션 경계)
- 실제 플레이 UI: group 경계 (group이 달라지는 바깥 경계만 표시)

### 텍스처
- 판정: micro 기준
- 지역명: group 기준
- 큰 무드/텍스처: group 기준
- 디버그 확인: micro 기준

## 한 줄 요약

group을 "새 row 타입"으로 넣지 말고, 기존 micro partition row에 "그룹 소속 정보" 컬럼을 넣는다.
