# Title: Fantasy Art Img2Img Texture Testing
Description: Pinterest 등 외부 고퀄 판타지 RPG 탑다운 아트를 reference로 ComfyUI img2img에 넣어 바닥 텍스처를 생성하는 방식의 분석, 리스크, 권장 파이프라인.
When-To-Read: 외부 레퍼런스 이미지 기반 img2img 텍스처 생성, 스타일 전이, Pinterest reference 활용 계획 검토 시
Keywords: testing, img2img, fantasy, pinterest, reference, texture, isometric, topdown, style-transfer, ground
Priority: high

# 목적

이 문서는 아직 확정 전인 테스트용 임시 컨텍스트다.

- 외부 고퀄 판타지 RPG 아트를 img2img reference로 사용하는 방식의 가능성과 제약을 정리한다.
- 기존 위성사진 기반 img2img(`partition_satellite_img2img_testing.md`)와 다른 별도 접근이다.
- 테스트 후 살아남은 파이프라인은 `agents/game_design/local_image_generation.md`에 통합한다.

---

# 계획 개요

## 유저 계획 요약

1. Pinterest 등에서 고퀄 판타지 RPG 탑다운 이미지를 여러 장 수집
2. ComfyUI img2img에 reference로 입력
3. 오브젝트를 최대한 제거하고 바닥 텍스처만 남기는 프롬프트 적용
4. 생성 결과를 `world_partition` 또는 `world_partition_group`에 매핑

---

# 강점 분석

## 1. 아트 디렉션 명확화

- txt2img 프롬프트만으로는 "느낌"을 잡기 어렵다.
- 고퀄 reference image는 색감, 재질 조합, 전체 무드를 모델에 직접 전달한다.
- 특히 Juggernaut XL에서는 스타일 reference가 프롬프트 단어보다 결과에 더 강하게 작용한다.

## 2. 위성사진 img2img 문제 해소

- 기존 위성 reference는 "지도처럼 읽히는" 문제가 있었다.
- 판타지 RPG 아트 reference는 이 문제를 처음부터 피한다.
- 색감과 스타일 레벨에서 월드 감성에 더 가깝게 접근할 수 있다.

## 3. 기존 파이프라인 재사용 가능

- `back/scripts/generate_partition_textures_img2img.py`가 이미 있다.
- reference 소스를 위성 cache에서 Pinterest 수집 이미지로 교체하면 된다.

---

# 핵심 리스크

## 리스크 1 (최우선): Perspective 오염 — isometric/25D 상속

**문제:**
- Pinterest에서 검색되는 판타지 RPG 아트 상당수는 isometric 또는 25D 시점이다.
- 예시 파일명: `Lucid_Origin_isometric_25D_fantasy_RPG_background_topdown_diag_2.jpg`
- img2img는 reference의 원근감·각도를 강하게 상속한다.
- denoise가 낮을수록 reference 구도가 그대로 결과에 나온다.

**기존 경험과 연결:**
- 위성 img2img 테스트에서도 이미 확인: "탑다운 여부보다 오브젝트 있는 정원 생성으로 모델이 가는 게 핵심 문제"
- isometric reference를 그대로 넣으면 이 문제가 더 심해진다.

**해결 조건:**
- reference 선별 기준: 반드시 **90도 탑다운** (overhead) 이미지만 사용
- `topdown_diag` 계열은 사용 금지 — 이름에 diagonal이 있으면 제외
- denoise 0.85 이상으로 reference 구도 해방
- positive에 `flat overhead view, 90 degree top-down, no perspective` 강제 포함

---

## 리스크 2: 오브젝트 잔류

**문제:**
- 판타지 RPG 아트에는 건물, 나무, 캐릭터, 구조물이 가득하다.
- img2img에서 negative prompt로 오브젝트를 제거하는 것은 txt2img보다 훨씬 어렵다.
- reference가 오브젝트를 강하게 포함하면 negative가 먹히지 않는다.

**해결 조건:**
- **전체 씬을 그대로 input으로 넣지 말 것**
- reference 이미지에서 **ground만 보이는 영역을 crop**해서 input으로 사용
- 건물/나무/캐릭터가 없는 바닥 위주 구역을 선택
- negative를 현재 기준보다 강하게 설정:
  ```
  buildings, walls, trees, plants, rocks above ground,
  characters, NPCs, decorations, props, structures,
  isometric view, 3D perspective, diagonal view,
  objects, furniture
  ```

---

## 리스크 3: 구조적 문제 — per-partition 매핑

**기존 확정 결론 (`world_texture_terrain_direction.md`):**
> "폴리곤마다 전용 이미지를 한 장씩 만드는 방식은 관리 비용이 크고 확장성이 낮다"

**per-partition 매핑의 문제:**
- 파티션 재구성 시 전체 재생성 필요
- 인접 파티션 간 연속성 단절
- 자산 수 폭증

**권장 방향:**
- 생성된 텍스처를 **파티션 1:1 매핑용이 아니라** texture palette(타일러블 텍스처 라이브러리)로 사용
- 연속 지형 시스템에서 이 텍스처를 재료로 사용
- 특정 지역 강조용 특수 연출에만 개별 매핑 허용

---

# 권장 파이프라인

## 올바른 사용 방법

```
Pinterest 수집 이미지
  → ground 영역만 crop (오브젝트 없는 구역)
  → 90도 탑다운 여부 검수 통과한 것만 사용
  → ComfyUI img2img (denoise 0.85 이상)
  → positive: "seamless tileable ground texture, flat overhead view, ..."
  → negative: 오브젝트 전부 포함
  → 출력: tileable texture → ground/ 폴더에 저장
  → 연속 지형 시스템에서 재질 팔레트로 사용
```

## 피해야 할 방법

```
❌ isometric/25D 전체 씬 → img2img → partition 1:1 매핑
❌ 건물/나무 포함 전체 씬 → input으로 직접 사용
❌ denoise 0.5 이하로 reference 구도 강하게 유지
```

---

# Reference 이미지 선별 기준

| 조건 | 허용 | 불허 |
|------|------|------|
| 시점 | 90도 탑다운 overhead | isometric, 25D, diagonal, side view |
| 오브젝트 비중 | 바닥 70% 이상 | 건물/나무가 절반 이상 점유 |
| 스타일 | fantasy, painterly, realistic | 3D render, anime flat color |
| 파일명 힌트 | `topdown`, `overhead`, `ground` | `isometric`, `25D`, `diag`, `3D` |

---

# 기존 txt2img와의 병행 전략

| 방식 | 강점 | 적합한 상황 |
|------|------|-----------|
| txt2img (Juggernaut XL) | 완전한 구도 통제, 오브젝트 없음 보장 | 특정 재질 정밀 생성, 반복 재사용 타일 |
| img2img (위성 reference) | 실제 서울 지형 구조 보존 | 위치 기반 지형 구조 재현 |
| img2img (판타지 art reference) | 아트 스타일 전이, 고퀄 분위기 | 지역별 분위기·색감 팔레트 확보 |

세 방식은 경쟁이 아니라 **보완 관계**다.

---

# 다음 실험 방향

1. Pinterest 수집 시 탑다운 90도 필터 적용해서 10장 이상 확보
2. 각 이미지에서 ground 영역만 crop (전체 씬 금지)
3. denoise 0.85 / 0.90 / 0.95 세 케이스 비교
4. 결과를 `front/public/ground/reference_style/` 에 저장
5. 연속 지형 시스템 재질 팔레트로 통합 가능한지 검토

---

# 판단 기준 (테스트 종료 시)

- 각도가 탑다운으로 유지되는가
- 오브젝트가 없는 순수 ground texture로 읽히는가
- 기존 Juggernaut XL txt2img 대비 스타일이 더 풍부한가
- 연속 지형 시스템에 재질로 편입 가능한가

위 4가지를 충족하면 `agents/game_design/local_image_generation.md`에 정식 방식으로 통합한다.
