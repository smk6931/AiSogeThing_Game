# 위성레이어 AI 파티션 텍스처 적용 체크리스트

## 목표

오프라인 개발 파이프라인으로 다음 흐름을 실제 적용한다.

1. front 기준 파티션 reference 확보
2. 위성 reference 확보
3. ComfyUI img2img 생성
4. `world_partition` 경로 매핑
5. `CityBlockOverlay`에서 1:1 적용 테스트

## 이번 1차 적용 범위

- 테스트 dong: `노량진2동`
- 테스트 group: `seoul.dongjak.noryangjin2.group.g03`
- 그룹 표시명: `숨결 언덕권 중앙 서편`
- 이번 1차 목표:
  - `world_partition_group` 기준 `group.png` 바닥 텍스처 1장 먼저 생성해 구조 확인
  - 그 다음 `group`이 아닌 `world_partition` 개별 파일 구조로 전환
  - `noryangjin2_g04`처럼 `g03`도 파티션 개수만큼 파일 생성
  - 실제 front 화면에서 개별 매핑 정합성 확인
- 이번 단계에서 아직 하지 않는 것:
  - 위성 reference 기반 img2img 전체 파이프라인 완성
  - 실시간 캡처

---

## Phase 0. 범위 확정

- [x] 테스트 대상 dong 1개 선정
- [x] 테스트 대상 group 1개 선정
- [ ] 테스트 대상 partition 3~5개 선정
- [x] `group.png` 공유 구조와 `partition 개별 파일` 구조 차이 확인
- [ ] road partition / non-road partition를 섞어서 고른다
- [ ] 결과 비교 기준을 미리 정한다
  - 정합성
  - 미감
  - 경계 연결감
  - 가독성

---

## Phase 1. reference 규칙 고정

- [ ] partition bbox 계산 공식을 하나로 고정한다
- [ ] width / height / meters-per-pixel 규칙을 정한다
- [ ] polygon mask 생성 규칙을 정한다
- [ ] front reference와 satellite reference가 같은 bbox 규칙을 쓰게 한다
- [ ] 캐시 경로 규칙을 정한다
  - `back/cache/partition_ref/{g_short}/...`

---

## Phase 2. front reference 생성

- [ ] 특정 partition 기준 reference view를 어떻게 만들지 정한다
- [ ] UI 없는 순수 reference 이미지가 나오게 한다
- [ ] 파티션 polygon과 bbox가 이미지에 맞는지 확인한다
- [ ] 출력 파일명을 고정한다
  - `{p_short}_front.png`
- [ ] 최소 3개 partition에서 같은 규칙으로 재생성해 일관성 확인

확인 포인트:

- [ ] 파티션 중심이 이미지 중심과 크게 어긋나지 않는다
- [ ] 종횡비가 뒤틀리지 않는다
- [ ] 확대 비율이 파티션마다 이상하게 흔들리지 않는다

---

## Phase 3. satellite reference 생성

- [ ] 같은 bbox 기준으로 위성 source 이미지를 생성한다
- [ ] polygon mask를 동일 규칙으로 적용한다
- [ ] source 이미지와 front reference를 나란히 비교한다
- [ ] 경계, 중심, 스케일이 맞는지 확인한다
- [ ] 출력 파일명을 고정한다
  - `{p_short}_satellite.png`

확인 포인트:

- [ ] source 이미지가 너무 흐리거나 너무 넓지 않다
- [ ] polygon 바깥 처리가 일관된다
- [ ] 파티션 구조 힌트가 보일 정도의 정보는 남는다

---

## Phase 4. ComfyUI img2img 생성

- [ ] 새 스크립트 분리
  - `generate_partition_textures_img2img.py`
- [ ] source 입력 경로 규칙 정리
- [ ] prompt는 `agents/game_design/local_image_generation.md` 원칙을 따른다
- [ ] positive prompt에 바닥 텍스처 목적을 유지한다
- [ ] negative prompt에서 건물/캐릭터/원근/하늘 제거를 강화한다
- [ ] seed 기록 규칙을 정한다
- [ ] 출력 파일명을 고정한다
  - `{p_short}_generated.png`

확인 포인트:

- [ ] 결과가 풍경 이미지가 아니라 바닥 텍스처처럼 보인다
- [ ] 위성사진 느낌이 과하게 남지 않는다
- [ ] 파티션별 차이는 있으나 게임풍이 유지된다

---

## Phase 5. 최종 매핑

- [x] 1차 빠른 검증: `group.png` 1장 먼저 생성
- [x] `g03`을 partition 개별 파일 구조로 생성
- [x] 최종 결과를 `front/public/world_partition/{g_short}/{p_short}.png`에 저장
- [x] 테스트 대상 partition의 `texture_image_url` 연결 방식 확인
- [ ] `CityBlockOverlay`에서 개별 partition image 로드 확인
- [ ] texture fallback과 충돌하지 않는지 확인

확인 포인트:

- [ ] geometry와 텍스처가 1:1로 맞는다
- [ ] uv repeat가 이상하지 않다
- [ ] 파티션 경계 밀림이 없다

---

## Phase 6. 플레이 화면 검수

- [ ] isometric 뷰에서 확인
- [ ] play 뷰에서 확인
- [ ] showElevation off 상태 확인
- [ ] showElevation on 상태 확인
- [ ] road / park / residential의 읽기성이 유지되는지 확인
- [ ] 캐릭터/몬스터/이펙트 가독성을 해치지 않는지 확인

---

## Phase 7. 비교 평가

- [ ] 기존 prompt-only 텍스처와 비교
- [ ] front reference / satellite reference / generated / final mapped 비교
- [ ] 어떤 partition에서 잘 되고 어떤 partition에서 깨지는지 기록
- [ ] 2차 기획 후보를 정리
  - ControlNet 도입 여부
  - road 전용 profile 분리 여부
  - group 단위 source 공유 여부

---

## 성공 기준

- [ ] 최소 3개 partition에서 정합성이 맞는다
- [ ] 기존 prompt-only보다 지역 구조감이 잘 느껴진다
- [ ] 위성사진 그대로 붙인 느낌이 아니다
- [ ] 실제 게임 화면에서 정보 과밀이 생기지 않는다
- [ ] 다음 확장 실험으로 넘어갈 가치가 있다고 판단된다

---

## 실패 기준

- [ ] geometry와 텍스처 정합이 반복적으로 어긋난다
- [ ] 위성 흔적이 너무 강해 게임풍이 무너진다
- [ ] 파티션 경계가 지나치게 부자연스럽다
- [ ] 기존 prompt-only보다 체감 품질이 낫지 않다

---

## 다음 액션 메모

- [ ] 테스트 결과 문서를 `docs/plan/2026-04-18/` 또는 `docs/complete/`에 남긴다
- [ ] 성공 시 `agents/game_design/local_image_generation.md`에 새 파이프라인 반영
- [ ] 실패 시 원인 분류
  - source 문제
  - mask 문제
  - img2img 문제
  - mapping 문제
