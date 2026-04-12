# 파티션 바닥 텍스처 생성 계획

## 목표

- `world_level_partition`의 `boundary_geojson` 좌표를 마스크로 변환
- 파티션 실제 형태(폴리곤)에 맞게 바닥 텍스처를 ComfyUI로 생성
- `texture_profile`, `theme_code`, `image_prompt_append` 기반으로 프롬프트 자동 선택
- 전체 파티션 일괄 자동화 가능한 구조

---

## 검증 결과 (p024 기준)

- `boundary_geojson` → 픽셀 폴리곤 마스크 변환 성공
- `area_m2: 256.74` (실제 크기 19m × 29.9m)
- DreamShaper XL Lightning + 인페인팅으로 폴리곤 내부에 텍스처 정확히 채워짐
- 소프트 RPG 애니 스타일 (partition_tex 스타일)로 방향 확정

---

## 생성 파이프라인

### Step 1 — 폴리곤 마스크 생성

```python
# tools/generate_partition_mask.py
import json, ast, math
from PIL import Image, ImageDraw

def generate_mask(partition: dict, size: int = 1024, pad: int = 80) -> Image:
    geojson = partition['boundary_geojson']
    if isinstance(geojson, str):
        geojson = json.loads(geojson.replace("'", '"'))
    coords = geojson['coordinates'][0]  # [[lng, lat], ...]

    lngs = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    lng_min, lng_max = min(lngs), max(lngs)
    lat_min, lat_max = min(lats), max(lats)

    def to_px(lng, lat):
        x = (lng - lng_min) / (lng_max - lng_min) * (size - pad*2) + pad
        y = (1 - (lat - lat_min) / (lat_max - lat_min)) * (size - pad*2) + pad
        return (x, y)

    poly_px = [to_px(c[0], c[1]) for c in coords]
    img = Image.new('L', (size, size), 0)
    ImageDraw.Draw(img).polygon(poly_px, fill=255)
    return img
```

### Step 2 — 스케일별 해상도 결정

| area_m² | 마스크 해상도 | 비고 |
|--------|------------|------|
| < 200 | 512×512 | 소형 파티션 |
| 200~600 | 1024×1024 | 일반 (p024: 256m²) |
| 600~1500 | 1536×1536 | 중대형 |
| > 1500 | 2048×2048 | 대형 |

### Step 3 — 프롬프트 선택

`texture_profile`과 `image_prompt_append` 기반으로 자동 선택.

#### texture_profile → 기본 프롬프트 매핑

| texture_profile | 기본 Positive 프롬프트 |
|----------------|----------------------|
| `forest_path_02` | forest floor, dirt path, mossy ground, tree roots, leaf litter, dappled light |
| `green_courtyard` | soft grass courtyard, stone tiles, flower beds, warm sunlight |
| `dense_block_ground` | urban dirt ground, worn stone, compacted earth, gravel |
| `fantasy_stone_road` | ancient cobblestone road, moss cracks, old stone pavement |
| `frozen_bank` | frost-covered ground, icy soil, bare winter earth, snow patches |
| `event_surface` | magical rune circle, glowing stone floor, mystical ground |

#### 공통 Positive 접두어
```
top-down 90 degree overhead, fantasy RPG game map ground tile,
soft painterly anime RPG art style, vibrant colors, clean readable game asset,
no characters, no buildings
```

#### 공통 Negative 프롬프트
```
photorealistic, 3d render, isometric, side view, building, character,
text, watermark, dark gloomy, blurry, border, frame, bad quality
```

#### image_prompt_append 활용
파티션 DB의 `image_prompt_append` 값을 Positive에 추가한다.
예) p024: `ancient tree roots, underground network, deep garden magic, winding dirt path through dense trees, dappled light, leaf litter`

### Step 4 — ComfyUI 워크플로우

```
CheckpointLoaderSimple (dreamshaperXL_lightningDPMSDE)
    ↓
CLIPTextEncode (positive / negative)
    ↓
LoadImage (partition_PXXX_poly_base.png)   LoadImage (partition_PXXX_poly_mask.png)
    ↓                                              ↓
    └──────── VAEEncodeForInpaint ◄────────────────┘
                  grow_mask_by: 4
    ↓
KSampler
  sampler: dpmpp_sde
  scheduler: karras
  cfg: 2.0
  steps: 8
  denoise: 1.0
    ↓
VAEDecode → SaveImage (partition_PXXX_floor_v1)
```

### Step 5 — 결과 후처리 및 저장

```
tools/ComfyUI/output/partition_PXXX_floor_v1_00001_.png
    ↓
front/public/ground/PXXX/partition_PXXX_floor_v1.png
```

---

## 모델 설정

| 항목 | 값 |
|-----|---|
| 체크포인트 | `dreamshaperXL_lightningDPMSDE.safetensors` |
| 업스케일러 | `4xUltrasharp_4xUltrasharpV10.pt` (고퀄 필요 시) |
| Sampler | `dpmpp_sde` |
| Scheduler | `karras` |
| CFG | `2.0` |
| Steps | `8` |
| Denoise | `1.0` |
| grow_mask_by | `4` |

---

## 일괄 자동화 구조 (확장)

```python
for partition in all_partitions:
    # 1. 마스크 생성
    mask = generate_mask(partition)
    mask.save(f'input/partition_{pkey}_poly_mask.png')

    # 2. 베이스 이미지 생성
    base = Image.new('RGB', mask.size, (20, 20, 20))
    base.save(f'input/partition_{pkey}_poly_base.png')

    # 3. 프롬프트 조합
    positive = build_prompt(partition['texture_profile'], partition['image_prompt_append'])

    # 4. ComfyUI API 제출
    submit_to_comfyui(pkey, positive, mask_size=determine_size(partition['area_m2']))

    # 5. 완료 대기 후 저장
    wait_and_save(pkey)
```

---

## 파일 경로 규칙

```
tools/ComfyUI/input/
├── partition_PXXX_poly_mask.png     ← 폴리곤 마스크 (흑백)
└── partition_PXXX_poly_base.png     ← 베이스 이미지 (검정)

tools/ComfyUI/output/
└── partition_PXXX_floor_v1_00001_.png

front/public/ground/
└── PXXX/
    └── partition_PXXX_floor_v1.png  ← 최종 사용본
```

---

## 현재 상태

- [x] p024 boundary_geojson → 폴리곤 마스크 변환 검증 완료
- [x] DreamShaper XL Lightning 소프트 스타일 방향 확정
- [x] 폴리곤 인페인팅 생성 성공
- [ ] texture_profile별 프롬프트 템플릿 정교화
- [ ] 전체 파티션 일괄 자동화 스크립트 작성
- [ ] 생성 결과 DB 연동 (resolved_prompt, prompt_resolved_at 업데이트)
