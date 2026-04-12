# 파티션 텍스처 생성 가이드

## 개요

월드 파티션 폴리곤 형태에 맞게 바닥 텍스처를 ComfyUI로 생성하는 방법을 정리한다.
현재 구현된 p024 파티션을 기준으로 작성됐으며, 스케일별 설정도 포함한다.

---

## 레이어 구조

파티션 하나는 3가지 레이어로 나뉜다.

| 레이어 | 파일 패턴 | 역할 |
|--------|----------|------|
| core | `partition_PXXX_core_*.png` | 파티션 내부 바닥 텍스처 |
| rim | `partition_PXXX_rim_*.png` | 도로와 맞닿는 가장자리 전환 텍스처 |
| edge | `partition_PXXX_edge_natural_*.png` | 자연 경계 (숲/바위/수풀 등) |

---

## 마스크 준비

### 마스크 생성 규칙
- 파티션 폴리곤을 흰색으로, 외부를 검정으로 그린다
- 청록색(cyan) 테두리선이 있는 경우 반드시 제거해야 한다 → 생성 결과에 파란 아티팩트 발생 원인
- 해상도는 파티션 스케일에 따라 아래 표를 따른다

### 마스크 청록 테두리 제거 스크립트
```python
from PIL import Image
import numpy as np

img = Image.open('partition_PXXX_mask_input.png')
arr = np.array(img)

# alpha > 0 인 모든 픽셀 = 흰색 (파티션 내부)
clean = np.where(arr[:,:,3] > 0, 255, 0).astype(np.uint8)
clean_img = Image.fromarray(clean, mode='L')
clean_img.save('partition_PXXX_mask_clean.png')
```

---

## 스케일별 설정

파티션 크기에 따라 마스크 해상도와 KSampler 설정을 조정한다.

| 파티션 규모 | 마스크 해상도 | Steps | CFG | 생성 방식 |
|------------|------------|-------|-----|---------|
| 소형 (< 200m²) | 1024×1024 | 24 | 6.2 | Inpaint |
| 중형 (200~500m²) | 1536×1536 | 28 | 6.5 | Inpaint |
| 대형 (> 500m²) | 2048×2048 | 32 | 7.0 | Hires Fix |

### Hires Fix 방식 (대형 파티션 권장)
1. EmptyLatentImage 1024×1024 → KSampler (steps 30, denoise 1.0)
2. VAEDecode → ImageScaleBy ×1.5
3. VAEEncode → KSampler (steps 20, denoise 0.55)
4. VAEDecode → UpscaleModelLoader (4xUltrasharp) → ImageUpscaleWithModel
5. ImageScale → 2048×2048 → SaveImage

---

## 레이어별 프롬프트

### core 레이어 (내부 바닥)
```
Positive:
top down game floor texture, [theme] courtyard grass ground, flat lighting,
soft grass, compacted soil, subtle moss variation, no structures, no paths,
no objects, no landmarks, no border decoration, readable terrain material

Negative:
building, road, path, wall, tower, tree trunk, rocks pile, water, pond,
bridge, object, symbol, text, logo, perspective, dramatic shadow
```

### rim 레이어 (도로 경계 전환)
```
Positive:
top down roadside transition ground, worn dirt shoulder, compacted earth,
sparse gravel, subtle broken stone dust, edge transition material for roads,
flat lighting, game terrain texture, no buildings, no paths, no large rocks,
no water, no trees, no landmarks

Negative:
building, road center line, path network, wall, pond, river, cliff,
mountain, tree, bush clump, structure, symbol, text, logo, perspective,
dramatic shadow
```

### edge 레이어 (자연 경계)
```
Positive:
top down fantasy [theme] ground texture, flat terrain only, soft grass,
worn stone dust, subtle dirt variation, gentle lawn color shifts,
readable from afar, suitable for game floor.
outer edge should naturally become shrubs, rocks, embankment, pond edge,
tree clusters, or rough vegetation border so cropped edges look intentional.
no buildings, no houses, no towers, no walls, no plazas, no circular landmarks,
no road center lines, no man made structures, no text, no symbols, no frame,
no perspective camera

Negative:
building, house, tower, temple, ruin, wall, bridge, fountain, circle plaza,
path network, road stripe, character, text, watermark, logo, border,
square frame, isometric city, perspective, dramatic shadow, large object,
architecture
```

---

## texture_profile별 [theme] 치환표

파티션 DB의 `texture_profile` 값에 따라 프롬프트의 `[theme]`을 치환한다.

| texture_profile | [theme] 치환 | 분위기 |
|----------------|------------|-------|
| `green_courtyard` | `academy` | 잔디 정원, 부드러운 풀밭 |
| `dense_block_ground` | `urban fantasy residential` | 도심 주거지, 낡은 돌바닥 |
| `fantasy_stone_road` | `ancient stone` | 고대 석조 도로, 이끼 낀 돌 |
| `frozen_bank` | `frozen riverfront` | 얼어붙은 강변, 서리 낀 흙 |
| `event_surface` | `mystical event plaza` | 마법진, 특수 이벤트 바닥 |

---

## 현재 검증된 설정 (p024 기준)

```
모델: rpg_v5.safetensors (판타지 RPG 특화)
업스케일러: 4xUltrasharp_4xUltrasharpV10.pt
Sampler: dpmpp_2m / Scheduler: karras
Seed: 고정값 사용 시 동일 결과 재현 가능
grow_mask_by: 4~6 (Inpaint 방식 사용 시)
```

---

## ComfyUI 노드 흐름

### Inpaint 방식 (소형/중형)
```
CheckpointLoaderSimple
    ↓
CLIPTextEncode (positive/negative)
    ↓
LoadImage (mask_clean.png) → VAEEncodeForInpaint
    ↓
KSampler → VAEDecode → SaveImage
```

### Hires Fix + 업스케일 방식 (대형 / 고퀄)
```
CheckpointLoaderSimple
    ↓
CLIPTextEncode (positive/negative)
    ↓
EmptyLatentImage (1024×1024)
    ↓
KSampler (denoise 1.0, steps 30)
    ↓
VAEDecode → ImageScaleBy (×1.5)
    ↓
VAEEncode → KSampler (denoise 0.55, steps 20)
    ↓
VAEDecode
    ↓
UpscaleModelLoader (4xUltrasharp) → ImageUpscaleWithModel
    ↓
ImageScale (2048×2048) → SaveImage
```

---

## 자동화 확장 방향

파티션 DB의 `texture_profile`, `theme_code` 값을 읽어 스크립트로 자동 생성 가능하다.

```python
# 예시: DB에서 파티션 목록 읽어 일괄 생성
for partition in partitions:
    profile = partition['texture_profile']
    theme = THEME_MAP[profile]
    mask_path = f"partition_{partition['id']}_mask_clean.png"
    
    positive_prompt = POSITIVE_TEMPLATE.replace('[theme]', theme)
    submit_to_comfyui(mask_path, positive_prompt, scale=partition['size_class'])
```

---

## 파일 저장 위치

```
tools/ComfyUI/
├── input/
│   └── partition_PXXX_mask_clean.png   ← 정제된 마스크
└── output/
    └── partition_PXXX_{layer}_{variant}_00001_.png

front/public/ground/
└── PXXX_{scene}/
    └── partition_PXXX_{layer}_texture_v1.png  ← 최종 사용본
```
