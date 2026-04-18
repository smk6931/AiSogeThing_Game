# Title: Partition Satellite Img2Img Testing
Description: 위성사진 캡처, polygon 마스크, ComfyUI img2img, world_partition 매핑까지의 테스트 중간 규칙과 임시 자산 확인 규칙.
When-To-Read: 파티션 바닥 텍스처를 위성 reference 기반으로 테스트하거나, ref/image/final 산출물을 함께 비교해야 할 때 읽는다.
Keywords: testing, satellite, img2img, partition, texture, comfyui, reference, polygon, mapping
Priority: high

# 목적

이 문서는 아직 확정 전인 테스트용 임시 컨텍스트다.

- 테스트가 끝나기 전까지 위성 reference 기반 텍스처 생성 흐름을 빠르게 반복하기 위해 둔다.
- 완성 규칙이 아니라 현재 검증 중인 작업 규칙과 파일 배치 규칙을 기록한다.
- 테스트 종료 후 살아남는 규칙만 `agents/game_design/` 또는 `agents/process/`로 옮긴다.

# 현재 테스트 파이프라인

1. `back/scripts/fetch_partition_satellite_reference.py`
   파티션 bbox를 계산하고 위성 타일을 stitch한 뒤 polygon mask를 적용한다.
2. `back/cache/partition_ref/{g_short}/`
   raw / masked satellite reference를 캐시한다.
3. `back/scripts/generate_partition_textures_img2img.py`
   cached satellite reference를 ComfyUI img2img 입력으로 넣는다.
4. `front/public/world_partition/{g_short}/`
   최종 매핑용 texture와 비교용 preview 자산을 함께 저장한다.
5. `world_partition.texture_image_url`
   최종 매핑용 texture만 연결한다.

# 테스트 자산 네이밍 규칙

동일 파티션에 대해 아래 파일을 같은 폴더에 둔다.

- final mapped texture: `{p_short}.png`
- satellite reference preview: `{p_short}.ref.png`
- raw img2img result preview: `{p_short}.image.png`

예시:

- `front/public/world_partition/noryangjin2_g03/0029.png`
- `front/public/world_partition/noryangjin2_g03/0029.ref.png`
- `front/public/world_partition/noryangjin2_g03/0029.image.png`

중요:

- 실제 게임 매핑에는 `{p_short}.png`만 사용한다.
- `.ref.png`, `.image.png`는 비교 확인용이며 DB 경로에 연결하지 않는다.
- preview 파일은 테스트를 빠르게 반복하기 위한 것이므로, 정식 빌드 산출 규칙으로 확정된 것은 아니다.

# 현재 판단 기준

- `ref`
  위성 source와 polygon 경계가 제대로 맞는지 본다.
- `image`
  img2img가 reference의 길, 녹지 분포, 큰 덩어리 구조를 얼마나 보존했는지 본다.
- `final`
  polygon 재클립 이후 실제 world_partition에 얹었을 때 경계, 가독성, 미감이 괜찮은지 본다.

# 현재 문제의식

- 현 단계 결과는 구조 보존은 일부 되지만 스타일 과장이 크고 스케일이 다소 작게 느껴질 수 있다.
- 특히 path, stone cluster, vegetation chunk가 실제 플레이 스케일보다 장식적으로 커지거나 튈 수 있다.
- 다음 반복에서는 denoise, prompt, 출력 해상도, 필요 시 ControlNet 계열 보조를 검토한다.

# 작업 중 문서화 원칙

- 테스트 중간 판단, 실패 원인, 괜찮았던 파라미터는 `docs/complete/` 또는 `docs/plan/`에 날짜 기준으로 남긴다.
- 여기에는 작업 지침과 임시 규칙만 두고, 세부 결과 리포트는 두지 않는다.

# 2026-04-18 현재 테스트 판단

## 잘된 점

- 위성 reference를 `polygon mask`로 잘라 `world_partition` 형태에 맞게 넣는 단계는 성공했다.
- `ref`, `image`, `final`을 같은 폴더에 저장하는 비교 방식은 매우 유용하다.
- `front/public/world_partition/{g_short}/` 아래에서 바로 비교할 수 있어 반복 테스트 속도가 빨라졌다.
- `image-to-image` 자체는 reference의 큰 구역감과 색 분포를 어느 정도 따라간다.
- 공원/숲/주거가 섞인 구역에서도 파티션별 개별 생성과 매핑은 정상 동작한다.

## 현재 확인된 문제

- 각도 문제:
  엄격한 90도 탑다운 대신, 일부 결과가 살짝 기울어진 일러스트 시점처럼 보인다.
- 스케일 문제:
  나무 덩어리, 정원 패턴, 길 굵기, 수풀 군집이 실제 위성 기준보다 장식적으로 크다.
- 구조 해석 문제:
  건물이나 도시 블록이 평탄한 지면이 아니라 별도 오브젝트나 정원 조형처럼 재해석되는 경향이 있다.
- 패턴 과장:
  실제 위성의 미세한 분포보다 곡선형 정원, 둥근 덩어리, 장식형 숲 패턴이 강하게 생긴다.
- 파티션 경계 체감:
  파티션 내부 이미지는 예뻐도, 인접 파티션끼리 이어졌을 때는 길 축과 녹지 흐름이 자연스럽게 이어지지 않을 수 있다.

## 스크린샷 기준 해석

- 위성 원본 스크린샷은 거의 정석 탑다운이다.
- 생성 결과 스크린샷은 위에서 보긴 하지만, 실제 지형을 그대로 눌러 만든 바닥 텍스처라기보다
  `탑다운 일러스트 정원 조감도` 쪽으로 해석되었다.
- 즉 현재 문제의 핵심은 “탑다운 여부” 자체보다
  `지면 생성`이 아니라 `오브젝트가 있는 미니어처 정원 생성`으로 모델이 가는 점이다.

## 현재 단계에서의 결론

- `지도 기반 image-to-image 생성` 자체는 성공으로 본다.
- 하지만 `정확한 ground texture generation` 관점에서는 아직 미완성이다.
- 지금 결과는 “reference guided stylized topdown art”에는 가깝지만,
  “strict playable ground texture”에는 아직 부족하다.

## 다음 개선 포인트

- 프롬프트에서 `garden`, `courtyard`, `ornamental`, `stones`, `clustered trees`로 읽힐 여지를 더 줄인다.
- `flat ground plane`, `terrain mask`, `ground-only interpretation`, `no object composition`를 더 강하게 건다.
- `denoise`를 더 낮춰 reference 구조를 더 강하게 보존하는 방향도 검토한다.
- 필요하면 일반 img2img만 쓰지 말고 shape/layout 고정 성격이 더 강한 보조 방법을 검토한다.
- 성공 기준은 “예쁜 이미지”보다 아래를 우선한다.
  - 길 위치가 맞는가
  - 공원/숲/주거 덩어리 위치가 맞는가
  - 파티션끼리 이어 붙였을 때 흐름이 맞는가
  - 오브젝트 일러스트가 아니라 바닥처럼 읽히는가

# 2026-04-18 추가 가설

## Group Reference First

- partition 개별 위성 reference만 바로 넣으면 파티션마다 모델 해석이 따로 놀기 쉽다.
- 그래서 `world_partition_group` 전체를 하나의 큰 위성 reference로 먼저 잡고,
  그 그룹이 공유하는 큰 분위기와 구조를 기준으로 파티션별 이미지를 생성하는 가설을 테스트한다.
- 기대 효과:
  - 같은 그룹 안 파티션들이 하나의 큰 월드 일부처럼 보일 가능성 증가
  - 공원/주거/길 흐름이 파티션 단위보다 그룹 단위로 더 자연스럽게 유지될 가능성
  - 파티션 간 미감 단절 완화

## Square Generation vs Polygon Crop

- 생성 입력 단계에서는 polygon crop보다 `square` 또는 `rectangular bbox` 입력이 더 안정적일 가능성이 높다.
- 이유:
  - polygon 외부의 검은 영역이 모델 해석을 흐릴 수 있다.
  - 정사각형/직사각형 입력은 ComfyUI img2img가 더 일관된 구도와 질감을 뽑는 경향이 있다.
  - 특히 top-down ground texture 계열은 square frame 안에서 고퀄이 더 잘 나올 가능성이 있다.
- 현재 가설:
  - 생성 전: group 또는 partition 기준 `square/rect reference`
  - 생성 후: 최종 결과만 polygon clip
- 즉 `생성용 frame`과 `최종 매핑 shape`를 분리해서 생각한다.

## 다음 실험 방향

- `noryangjin2_g04` 안 6개 partition으로 테스트
- group 단위 위성 reference를 먼저 뽑는다.
- 같은 group reference + 강한 ground-only prompt로 파티션별 서로 다른 이미지를 생성한다.
- 가능하면 아래 두 방식을 비교한다.
  - A. polygon masked reference -> img2img
  - B. square reference -> img2img -> final polygon clip
- 비교 기준:
  - 탑다운 각도 일관성
  - ground texture 품질
  - 파티션 간 공통 월드 감
  - 구조 보존
