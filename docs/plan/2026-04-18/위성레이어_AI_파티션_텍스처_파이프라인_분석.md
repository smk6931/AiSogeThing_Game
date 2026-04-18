# 위성레이어 AI 파티션 텍스처 파이프라인 분석

## 목적

현재 프로젝트에서 다음 방식으로 파티션 바닥 텍스처 제작 파이프라인을 도입할 수 있는지 분석하고, 실제 적용 기준안을 정리한다.

- 실시간 생성은 하지 않는다
- 개발 중 오프라인으로 생성하고 결과를 저장한다
- front에서 특정 파티션 구역을 polygon 기준으로 맞춘 reference 이미지를 만든다
- 같은 구역의 위성사진 reference도 polygon / 크기 / 스케일 기준으로 맞춘다
- ComfyUI img2img로 RPG 스타일 top-down 바닥 텍스처를 만든다
- 결과를 `world_partition` 경로에 다시 매핑해 1:1 파티션 적용 테스트를 한다

이 문서는 이제 단순 가능성 검토 문서가 아니라, 현재 기준으로 채택할 방식을 정리한 기준안이다.

---

## 확정 방향

이번 시도는 아래 조건으로 진행한다.

### 하지 않는 것

- 브라우저 실시간 캡처 기반 자동 생성
- 서버 배포 후 런타임 생성
- Cesium 도입
- 최종 게임에서 위성사진 자체를 직접 렌더하는 방식

### 하는 것

1. front 기준으로 특정 파티션 영역을 정확히 맞춘 reference view를 만든다
2. 같은 파티션 bbox / polygon 기준의 위성 reference 이미지를 만든다
3. ComfyUI img2img로 RPG 스타일 바닥 텍스처를 생성한다
4. 결과를 `front/public/world_partition/...`에 저장한다
5. `CityBlockOverlay`에서 기존 텍스처와 동일하게 1:1 매핑 테스트를 한다
6. 테스트 결과를 본 뒤 2차 기획으로 확장 여부를 판단한다

즉, 이 방식은 **개발용 오프라인 자산 생성 파이프라인**이다.

---

## 현재 프로젝트 기준으로 가능한 이유

현재 프로젝트는 이미 아래 요소를 갖고 있다.

- `world_partition.boundary_geojson`
- 파티션별 `texture_image_url`
- `CityBlockOverlay.jsx`의 개별 파티션 텍스처 적용 구조
- `generate_partition_textures.py` 기반 ComfyUI 생성 흐름
- `front/src/entity/world/MapTiles.jsx`와 `LeafletMapBackground.jsx`의 지도 기반 좌표 표현

즉, 새로 만들어야 하는 핵심은 아래 두 가지다.

- 파티션 기준 reference image 생성 단계
- img2img 기반 생성 단계

렌더링 구조 자체를 뒤엎을 필요는 없다.

---

## 채택 방식 상세

## Step 1. front 기준 파티션 reference 캡처

여기서 말하는 "front의 특정 파티션 구역 캡처"는 실시간 런타임 캡처가 아니라, 개발용 reference 생산 단계다.

핵심 조건:

- 파티션 polygon의 bbox와 같은 기준 좌표 사용
- 정해진 줌과 정해진 비율 사용
- UI 없는 순수 reference view 확보
- 결과가 다시 생성되어도 같은 결과가 나오도록 재현성 유지

이 단계에서 원하는 출력:

- `partition_source_front.png`

이 이미지의 역할:

- 현재 게임에서 보이는 공간 감각 기준점
- 파티션 경계 / 스케일 / 위치 정합 확인 기준
- 위성 reference와 최종 생성 결과 비교용 기준 이미지

## Step 2. 위성 reference 이미지 생성

이건 front 화면 스크린샷과 별개다.

핵심은 아래다.

- 같은 partition bbox를 기준으로 위성 이미지 확보
- 같은 크기, 같은 종횡비, 같은 마스크 기준 적용
- 필요하면 polygon 밖은 검정 또는 투명 처리

이 단계 출력:

- `partition_source_satellite.png`
- 필요 시 `partition_mask.png`

이 이미지의 역할:

- 실제 서울 구조를 AI 입력에 제공
- 도로 흐름, 블록 덩어리, 지형 밀도를 유지하게 만드는 힌트

## Step 3. ComfyUI img2img 생성

이 단계는 기존 `agents/game_design/local_image_generation.md`의 바닥 텍스처 프롬프트 원칙을 그대로 따른다.

핵심 원칙:

- 최종 결과는 "풍경 이미지"가 아니라 "바닥 텍스처"여야 한다
- `flat overhead view`
- `seamless tileable ground texture`
- 오브젝트, 캐릭터, 건물, 하늘, 원근감을 제거

추가로 이번 방식에서 중요한 점:

- 위성 source를 그대로 따라가게 하지 않는다
- 위성 이미지는 구조 힌트로만 사용한다
- 최종 이미지는 게임 바닥 텍스처 미감을 우선한다

즉:

- source의 역할 = 구조
- prompt의 역할 = 미감

## Step 4. world_partition 재매핑

생성 결과는 최종적으로 기존 파티션 텍스처와 동일한 경로 체계에 맞춰 넣는다.

예:

- `front/public/world_partition/{g_short}/{p_short}.png`

그리고 기존과 같은 방식으로 `texture_image_url`을 연결하거나 테스트용 파일 경로를 직접 읽게 한다.

이 단계의 목표는 단순 저장이 아니라 아래다.

- 위성 reference와 같은 크기
- polygon 기준 정합
- 실제 렌더 시 파티션 geometry와 1:1 매핑
- 반복 / 이음새 / 경계 밀림 여부 확인

---

## 왜 이 방식이 현실적인가

## 1. 실시간 생성이 아니라서 운영이 안정적이다

생성은 개발 단계에서만 한다.
따라서 아래 문제가 크게 줄어든다.

- 런타임 지연
- 브라우저 상태 의존성
- 생성 중 UI 꼬임
- 사용자 환경별 결과 흔들림

## 2. 현재 렌더 구조를 그대로 쓸 수 있다

특히 `CityBlockOverlay.jsx`는 이미 아래를 지원한다.

- partition polygon geometry
- partition별 개별 이미지 적용
- uv repeat 계산
- group / partition fallback

즉, 새 파이프라인은 "텍스처 공급 방식"만 바꾸면 된다.

## 3. 서울 구조를 살리면서도 게임풍으로 재해석 가능하다

위성 이미지를 그대로 쓰는 게 아니라,
현실 구조를 참고한 RPG top-down 바닥으로 바꾸는 것이 핵심이다.

이 방식은 네 프로젝트의 정체성과도 잘 맞는다.

---

## 기술 제안

## 프론트 역할

프론트는 메인 생성기가 아니라 기준 좌표와 검수 도구 역할을 맡는다.

권장 역할:

- 현재 파티션 선택
- 해당 파티션 polygon / bbox 시각화
- reference view 확인
- 생성 후 결과 미리보기
- source / satellite / final 비교

추가 권장 UI:

- "reference source"
- "satellite source"
- "generated result"
- "final mapped result"

4단 토글 또는 패널 비교

## 백엔드 / 스크립트 역할

실제 생성은 스크립트로 한다.

권장 신규 스크립트:

- `back/scripts/build_partition_front_reference.py`
- `back/scripts/fetch_partition_satellite_reference.py`
- `back/scripts/generate_partition_textures_img2img.py`

## 출력 구조

권장 경로:

- `back/cache/partition_ref/{g_short}/{p_short}_front.png`
- `back/cache/partition_ref/{g_short}/{p_short}_satellite.png`
- `back/cache/partition_ref/{g_short}/{p_short}_mask.png`
- `back/cache/partition_ref/{g_short}/{p_short}_generated.png`
- `front/public/world_partition/{g_short}/{p_short}.png`

이 구조가 좋은 이유:

- 중간 산출물은 캐시에 둔다
- 최종 게임 자산만 `front/public`에 둔다
- 디버그 비교와 재생성이 쉬워진다

---

## 권장 렌더링 방식

## 결론: 현재 구조 유지

이번 시도에서 바꿔야 하는 것은 지도 엔진이 아니다.
바꿔야 하는 것은 텍스처 생성 입력 파이프라인이다.

따라서 아래를 유지한다.

- `React + R3F + Three.js`
- `MapTiles`
- `SeoulTerrain`
- `CityBlockOverlay`

그리고 새 자산만 연결한다.

### 최종 렌더 원칙

- 위성사진은 최종 렌더용이 아니다
- 위성사진은 AI source다
- 최종 렌더에는 stylized 결과만 올린다

---

## 품질 검증 포인트

이번 1차 테스트에서 반드시 봐야 할 것은 아래다.

## 1. 정합성

- 파티션 geometry와 텍스처의 중심이 맞는가
- polygon 기준으로 밀림이 없는가
- bbox와 실제 적용 범위가 일치하는가

## 2. 스케일감

- 위성 reference에서 보인 블록 덩어리감이 너무 작거나 크게 왜곡되지 않는가
- 도로/마당/광장 같은 표면 리듬이 말이 되는가

## 3. 미감

- 위성사진 느낌이 너무 남지 않는가
- 그냥 흐린 페인트 얼룩처럼 보이지 않는가
- 기존 prompt-only보다 지역 차이가 더 잘 느껴지는가

## 4. 파티션 경계

- 인접 파티션과 끊김이 심하지 않은가
- road partition과 non-road partition 경계가 부자연스럽지 않은가

## 5. 게임 적용성

- 실제 top-down 플레이 화면에서 정보량이 너무 많지 않은가
- 캐릭터, 몬스터, 이펙트 가독성을 해치지 않는가

---

## 리스크

## 1. 위성 source가 너무 강하게 남을 수 있다

이 경우 결과가 게임풍이 아니라 위성사진 필터 처리처럼 보일 수 있다.

해결 방향:

- img2img denoise 조절
- positive prompt를 더 강하게 texture 중심으로 작성
- negative에서 object/building/perspective 제거 강화

## 2. 파티션별 개별 생성으로 경계가 끊길 수 있다

해결 방향:

- 같은 group 단위 source와 seed family 사용
- road / park / residential별 profile 정리
- 테스트 단계에서는 group 내 일부 파티션만 먼저 검증

## 3. front reference와 satellite reference의 정합 차이

이게 크면 생성 결과가 geometry에 얹혔을 때 어색할 수 있다.

해결 방향:

- bbox 계산식 단일화
- width / height / meters-per-pixel 규칙 단일화
- polygon mask 생성 로직 단일화

---

## 현재 기준 최종 판단

이번 방식은 충분히 시도할 가치가 있다.
그리고 지금 프로젝트 구조에서 가장 무리 없는 실험 방식이다.

핵심 판단은 아래다.

> 실시간 생성은 하지 않는다.
> 현재 front 렌더 구조는 유지한다.
> 파티션 기준 reference와 위성 reference를 만들고,
> ComfyUI img2img로 stylized floor texture를 생성한 뒤,
> `world_partition`에 1:1 매핑 테스트를 한다.

이 1차 테스트 결과가 좋으면 그 다음에

- 더 많은 group 확장
- ControlNet 도입
- road / park / school 별 generation profile 분리

로 넘어간다.

---

## 바로 다음 액션

1. 테스트 대상 group / partition 범위를 정한다
2. reference image 생성 규칙을 스크립트 기준으로 고정한다
3. satellite reference 생성 규칙을 스크립트 기준으로 고정한다
4. ComfyUI img2img 스크립트를 분리한다
5. `CityBlockOverlay`에서 결과를 1:1 매핑해 본다
6. 결과를 보고 2차 기획으로 넘어간다
