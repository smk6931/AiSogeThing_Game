# Group Reference Square Crop World Partition Test Plan

## 개요

- 작성일: `2026-04-18`
- 대상 group: `noryangjin2_g04`
- 1차 테스트 범위: `world_partition 6개`
- 목적:
  - `partition 개별 reference` 중심 방식 대신
  - `group 전체 위성 reference`를 먼저 잡고
  - 그 reference의 큰 구조와 분위기를 공유하는 `partition별 서로 다른 이미지`를 생성하는 방식이 더 나은지 검증한다.

---

## 문제의식

현재 테스트에서 확인된 문제는 다음과 같다.

- 파티션별 위성 reference를 바로 img2img에 넣으면 모델이 각 파티션을 따로 해석한다.
- 그 결과 `파티션마다 다른 작은 조감도`처럼 보일 수 있고, 그룹 전체가 하나의 월드처럼 이어지는 느낌이 약해진다.
- polygon 마스크된 reference는 실제 shape 정합성에는 유리하지만, 생성 단계에서는 검은 바깥 영역 때문에 이미지 품질과 구도 해석이 흔들릴 수 있다.
- 일부 결과는 `strict top-down ground texture`보다 `미니어처 정원/오브젝트 조감도`로 해석되는 문제가 있었다.

즉 지금 필요한 것은:

1. 그룹 전체가 공유하는 하나의 큰 월드 감
2. strict 90도 topdown ground texture 해석
3. 파티션별 서로 다른 디테일이 있으면서도 같은 세계 안에 속한 것처럼 보이는 결과

---

## 새 가설

### 핵심 가설

`group 전체 위성 reference + 강한 ground-only prompt + partition별 변형`

이 조합이 `partition 개별 reference`보다 더 안정적으로 그룹 일관성을 만들 수 있다.

### 기대 효과

- 같은 group 안 파티션끼리 색감과 지형 문법이 맞는다.
- 파티션 간 연결감이 좋아진다.
- 공원/주거/길/숲이 섞여 있어도 하나의 큰 월드 일부처럼 느껴진다.
- 높은 오브젝트를 평탄화한 뒤에도 구조 보존이 상대적으로 쉬워질 수 있다.

---

## 제안 파이프라인

### 방식 A. Group Reference Shared Input

1. `world_partition_group` 전체 경계 polygon을 기준으로 위성 reference를 캡처한다.
2. 이 reference를 그룹 전체 분위기 source로 사용한다.
3. 각 partition는 같은 group reference를 공유하되, seed / prompt append / local mask 차이로 서로 다른 이미지를 생성한다.
4. 최종 결과는 각 partition 경계에 맞게 개별 매핑한다.

이 방식의 장점:

- 그룹 전체가 하나의 큰 지역처럼 느껴질 가능성이 높다.
- 파티션 간 연결감이 좋아질 수 있다.

이 방식의 위험:

- 각 partition별 지역 차이가 너무 약해질 수 있다.
- 그룹 전체 reference를 모든 partition가 공유하면 지역 특성이 뭉개질 수 있다.

### 방식 B. Group Reference + Partition Local Crop

1. group 전체 reference를 먼저 만든다.
2. 각 partition는 group reference 내부에서 자기 위치에 해당하는 local crop을 잘라 쓴다.
3. prompt는 group 공통 프롬프트 + partition별 미세 차이만 준다.
4. 최종 결과를 partition별로 매핑한다.

이 방식의 장점:

- 그룹 공유 구조와 partition별 지역 차이를 둘 다 어느 정도 확보할 수 있다.
- 현재 가장 현실적인 타협안이다.

초기 추천:

- `방식 B`를 우선 테스트한다.

---

## Square Crop vs Polygon Crop 분석

### polygon crop 장점

- 실제 파티션 경계와 정확히 일치한다.
- 정합성 검증은 쉽다.

### polygon crop 단점

- 바깥의 검은 영역이 이미지 생성 단계에서 노이즈로 작용할 수 있다.
- 모델이 “이상한 실루엣 안의 장면”으로 해석해서 구도나 물체 배치를 오해할 수 있다.
- strict top-down ground texture보다 조감도/오브젝트 구성으로 가는 경우가 있다.

### square crop 장점

- 모델이 더 안정적으로 이미지를 해석한다.
- 구도와 질감 품질이 더 좋아질 가능성이 높다.
- 고퀄 ground texture 계열은 square 입력에서 잘 나올 가능성이 크다.

### square crop 단점

- 실제 경계와 바로 맞지는 않는다.
- 최종 매핑 전 별도의 polygon clip이 필요하다.

### 현재 판단

생성용 입력은 `square 또는 rectangular bbox`가 더 유리할 가능성이 높다.

즉 다음처럼 분리하는 것이 좋다.

- 생성 단계: square / rect input
- 최종 매핑 단계: polygon clip

한 줄 결론:

`고퀄 생성`과 `정확한 매핑`은 같은 입력 shape를 고집하지 말고 분리해서 다루는 편이 낫다.

---

## 프롬프트 방향

이번 테스트에서 프롬프트는 아래 원칙을 강하게 건다.

- strict 90 degree top-down
- ground-only interpretation
- high objects flattened into terrain
- buildings treated as flat ground masks
- roads / green / water placement preserved
- fantasy RPG tone only in texture and mood
- no object composition, no miniature garden look

핵심 방향:

- `예쁜 장면 생성`이 아니라 `탑다운 게임용 바닥 텍스처 생성`
- 건물, 나무, 구조물은 “오브젝트”가 아니라 “평탄화된 지형 흔적”으로 해석

---

## noryangjin2_g04 1차 테스트 계획

### 목표

- `g04`에서 6개만 선택해 새 방식이 기존 방식보다 나은지 본다.

### 테스트 항목

1. group 위성 reference 생성
2. group 기반 local crop 생성
3. square/rect 입력으로 img2img 생성
4. final polygon clip
5. `ref`, `image`, `final` 비교

### 저장 규칙

기존과 동일하게 같은 폴더에 비교용 파일을 둔다.

- final mapped texture: `{p_short}.png`
- group/local reference preview: `{p_short}.ref.png`
- raw img2img result preview: `{p_short}.image.png`

필요하면 group 공유 source도 같이 둔다.

- group source preview: `group.ref.png`

---

## 성공 기준

- 생성 결과가 `strict topdown ground texture`로 읽힌다.
- 파티션마다 서로 다르지만 같은 group 안에 속한 것처럼 보인다.
- 길, 녹지, 수변, 공터의 큰 구조가 reference와 어긋나지 않는다.
- 건물/나무가 높은 오브젝트가 아니라 평탄화된 지면 정보처럼 보인다.
- polygon clip 이후에도 경계가 크게 어색하지 않다.

---

## 실패 기준

- 결과가 다시 `정원 조감도`, `미니어처`, `오브젝트 일러스트`처럼 보인다.
- square 입력이 품질은 좋아도 구조 보존이 크게 무너진다.
- 파티션별 결과가 너무 따로 놀아 group 일관성이 약하다.
- final polygon clip 이후 경계와 내부 질감 차이가 심해진다.

---

## 실행 우선순위

1. `g04` 테스트 대상 6개 선정
2. `group reference` 생성 스크립트 설계
3. `group -> partition local crop` 로직 설계
4. `square generation -> polygon final clip` 비교 실험
5. 결과를 `agents/testing`과 `docs/complete/`에 기록

---

## 현재 추천 결론

이 방향은 충분히 다시 테스트해볼 가치가 있다.

특히 지금까지의 실패가 `polygon masked small local reference`에서 오는 해석 왜곡일 가능성이 있기 때문에,

- `group 단위 큰 reference`
- `square 또는 직사각형 입력`
- `최종 단계에서만 polygon clip`

이 조합은 다음 단계의 가장 유력한 대안이다.
