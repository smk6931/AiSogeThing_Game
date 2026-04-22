# Title: Ground Texture Design Guidelines
Description: AAA 게임 월드 디자이너 기준의 바닥 텍스처 설계 원칙. 인간 스케일, PBR 알베도 규칙, 노말맵 추출 친화 설계, 길/쉼터 자연스러운 통합, 공동 프롬프트 구조 정의.
When-To-Read: 바닥 텍스처 프롬프트 작성, 공동 prefix 수정, 새 테마 추가, 텍스처 품질 방향 논의 시
Keywords: ground, texture, normal-map, pbr, scale, human-scale, path, rest-area, gravel, particle, prompt, seamless, albedo
Priority: high

---

## 핵심 원칙 요약 (TL;DR)

1. **스케일** — 자갈/입자는 5~20cm 혼합 크기. 인간 기준 어색하지 않아야 함
2. **PBR 알베도** — 방향성 그림자, 반사광 절대 금지. 색상 정보만 담는다
3. **노말맵 친화** — 입자 경계는 선명하고 어둡게. 높이 차이가 색값으로 암시되어야 함
4. **경로/쉼터 통합** — 별도 오브젝트 아님. 짓눌린 흙, 마모된 패턴으로 알베도에 녹아야 함
5. **타일링** — 방향성 패턴/줄무늬/그라디언트 절대 금지. 균일 분포

---

## 1. 인간 스케일 기준

| 요소 | 실제 크기 | 텍스처에서 읽히는 방식 |
|------|-----------|----------------------|
| 미세 먼지/모래 | <2cm | noise texture, 세부 표면감 |
| **자갈/소석 (기본)** | **5~15cm** | **개별 식별 가능, 주력 요소** |
| 중간 돌 | 15~30cm | 눈에 띄는 특징 요소 |
| 대형 암석 | >30cm | 장애물/지형 특징 (텍스처 아님) |

- 타일 하나가 약 2m×2m 실제 지형을 커버한다고 가정
- 60% 소형, 30% 중형, 10% 대형 비율로 혼합하면 자연스러움
- 완전히 균일한 크기는 인공적으로 보임 → `mixed large and small, irregular sizes` 필수

---

## 2. PBR 알베도 규칙 (Quixel Megascans / Substance Designer 기준)

### 반드시 지켜야 할 것

| 규칙 | 이유 |
|------|------|
| 방향성 그림자 없음 | 노말맵이 실시간 조명을 대신하기 때문 |
| 반사 하이라이트 없음 | roughness/metallic 맵이 담당 |
| 알베도 명도: 30~220 (0~255 기준) | 순 검정/순 흰색은 PBR에서 물리적으로 불가능 |
| 흐린 날 자연광처럼 | "overcast diffuse light" — 무방향, 균일한 밝기 |

### 노말맵 추출에 유리한 설계

- 입자 간 경계(갭)는 **선명하고 어두운 선**으로 표현
- 같은 입자 면 안은 **부드러운 명도 그라디언트** (볼록한 형태 암시)
- flat하게 보이지만 높이 정보는 색값에 내포돼야 함
- 흐리고 부드러운 경계 = 노말 추출 실패

---

## 3. 경로/쉼터 자연 통합 방법

게임 월드 디자이너는 경로와 쉼터를 별도 메시로 얹지 않고  
**알베도 톤/패턴 변화**로 지형에 녹여낸다.

### 경로 (Worn Path)

- 중심부: 짓눌린 흙, 자갈이 눌려 납작해진 패턴, 약간 어두운 색조
- 가장자리: 흙 침식 패턴, 소석이 옆으로 밀린 흔적
- 프롬프트: `subtle worn dirt path integrated in texture, compacted soil center, eroded edges, small stones pushed aside naturally`

### 쉼터 (Rest Area)

- 중심: 잔디/낙엽이 눌려 납작해진 패턴, 약간 반들반들한 흙
- 가장자리: 자연스러운 식생 전환
- 프롬프트: `subtle resting spot with matted ground, slightly worn center, natural transition edges`

### 주의

- 경로/쉼터는 텍스처 전체 면적의 20~30%를 넘으면 타일링 시 이상하게 반복됨
- 오브젝트(벤치, 나무, 기둥)는 절대 텍스처에 포함하지 않음

---

## 4. 타일링 (Seamless Tiling) 원칙

| 금지 | 허용 |
|------|------|
| 수직/수평 줄무늬 | 불규칙 분산 패턴 |
| 한쪽으로 치우친 클러스터 | 균일 분포 (Poisson disk 느낌) |
| 방향성 그라디언트 | 미세한 전체 색조 변화 |
| 눈에 띄는 반복 요소 | 비슷하지만 다른 형태들 |

- `no directional stripes, uniformly distributed` 프롬프트로 모델 유도

---

## 5. 확정 공동 프롬프트 구조

### COMMON_POSITIVE_PREFIX

아래 prefix를 모든 테마 앞에 붙인다.

```
seamless tileable ground texture, flat overhead view,
diffuse natural overcast lighting no directional shadows,
irregular mixed-size particles 5 to 20 centimeter scale,
sharp-edged material boundaries for normal map extraction,
PBR albedo only no specular highlights no baked shadows,
uniformly distributed no stripes no gradient,
high detail photorealistic material
```

### COMMON_NEGATIVE

```
cartoon, anime, 3D render, depth, perspective, side view, isometric,
trees, tall plants, rocks above ground, mushrooms, flowers, characters, buildings, walls, fences,
sky, horizon, directional shadow, bright spotlight, bloom, lens flare,
blurry, watermark, text, logo, border, frame,
pure white, pure black,
ugly, deformed, bad quality, duplicate,
uniform same size particles, perfectly round stones, symmetric pattern
```

### 테마별 추가 프롬프트 예시

```python
# grass_dirt
COMMON + "patchy grass and bare dirt, green grass tufts and brown soil, organic scattered coverage, subtle worn center path compacted soil"

# cobblestone
COMMON + "angular irregular cobblestone pavement, mixed stone sizes, dark mortar gaps between stones, slight moss in gaps"

# moss_stone
COMMON + "flat stone slabs with heavy green moss, damp dark soil between stones, wet surface micro-texture"

# snow_ground
COMMON + "snow-covered frozen ground, compacted snow with icy patches, slight blue tint in shadows, sparse frost crystals"
```

---

## 6. 불규칙 다중 스케일 석판 원칙 (Irregular Multi-Scale Slab)

> 출처: `front/public/world_partition/noryangjin2_g04/ref_emerald_arcane.png` 기반 설계 검증 (2026-04-22)

### 핵심 철학

"균열이 있는 바닥"이 아니라 **"크기가 다른 석판 덩어리들이 쌓여 있는 바닥"** 으로 설계한다.  
크기 다양성 자체가 입체감과 시각적 풍부함을 만든다.

### 스케일 3계층 구조

| 계층 | 상대 크기 | 역할 |
|------|-----------|------|
| 대형 석판 (Primary) | 텍스처 면적의 20~40% 차지 | 지형의 주요 구조 정의 |
| 중형 석판 (Secondary) | 15~20% | 대형 석판 사이 채움 |
| 소형 파편 (Fragment) | 5~10% | 균열 사이 작은 조각, 디테일 |

- 세 계층이 **동시에** 화면에 보여야 함 → `mix of large boulder-sized chunks and small stone fragments`
- 균일한 크기는 인공적으로 보임 → `irregular polygon slabs of wildly varying sizes` 강제

### 균열 위계 (Crack Hierarchy)

```
1차 균열 (Primary)  — 넓고 깊은 선, 석판 경계 정의
2차 균열 (Secondary) — 중간 폭, 석판 내부 갈라짐
3차 균열 (Tertiary)  — 가는 실선, 표면 미세 균열
```

- 세 굵기가 모두 공존해야 자연스러움 → `wide primary cracks and thin hairline fractures coexisting`
- 균일한 굵기의 균열 = 단조롭고 인공적

### 발광 집중 원칙 (Glow Concentration)

- 균열 교차점(3방향 이상 만나는 지점) = 최고 밝기
- 균열 선 중간 = 중간 밝기
- 석판 면 = 어둡거나 고유 재질 색만

```
프롬프트: intense amber gold luminescence pooling at crack intersections and junctions,
          glow concentrated where multiple cracks converge, brighter at nodes
```

### 입체감 연출 방법 (Depth Without Geometry)

평면 텍스처에서 입체감을 만드는 방법:
- 석판 가장자리 → 어두운 테두리 (AO처럼)
- 균열 내부 → 매우 어둡게 (깊은 공간처럼)
- 발광 선이 깊이에서 올라오는 것처럼 표현

```
프롬프트: strong 3D relief depth between elevated stone slab surfaces,
          recessed glowing gaps, deep shadows at slab edges
```

### img2img 적용 시 핵심 프롬프트 블록

```
large irregular polygon stone slabs of wildly varying sizes,
mix of large boulder-sized chunks and small stone fragments between them,
deep wide cracks and thin hairline fractures coexisting, variable crack width network,
intense amber gold luminescence pooling at crack intersections and junctions,
strong 3D relief depth between elevated stone slab surfaces, recessed glowing gaps,
no central origin point, distributed irregular polygon fracture network
```

### Negative (이 원칙 위반 방지)

```
uniform same size tiles, regular grid pattern, uniform crack width,
central radial pattern, starburst from center,
flat surface no depth, no texture variation
```

---

## 7. 실무 레퍼런스 (산업 기준)

| 출처 | 핵심 룰 |
|------|---------|
| **Quixel Megascans** | 흐린 날 실외 촬영 → 방향 그림자 없는 알베도 |
| **Substance Designer** | 알베도 = 색상 전용, 조명 정보 없음 |
| **UE5 Nanite/WPO** | 텍스처 50~200% 스케일 변화에도 읽혀야 함 |
| **Horizon Forbidden West** | 모든 지면은 intact → worn → weathered 3단계 상태 |
| **The Witcher 3** | 바닥이 공간의 역사를 말해야 한다 (마모 흔적 내러티브) |

---

## 7. 적용 우선순위

1. **COMMON_POSITIVE_PREFIX** — 모든 테마에 공통 적용 (스케일+PBR+타일링)
2. **COMMON_NEGATIVE** — 방향그림자, 오브젝트, 그라디언트 제거
3. **테마별 재질 키워드** — 위에서 정의한 구조로 추가
4. **경로/쉼터** — 필요한 테마에만 선택 추가 (전체 면적 20~30% 내)
5. **seed 변형** — 같은 프롬프트에서 seed만 바꿔 패턴 다양성 확보
