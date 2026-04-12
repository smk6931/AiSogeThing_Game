# Title: Local Image Generation (ComfyUI)
Description: 로컬 ComfyUI로 파티션 바닥 텍스처 생성 시 사용하는 모델, 파라미터, 스크립트 사용법
When-To-Read: 이미지 생성 요청, 파티션 텍스처 생성, ComfyUI 설정 변경, 모델 추가 시
Keywords: comfyui, image-generation, texture, partition, rpg, checkpoint, model, stable-diffusion
Priority: high

# 로컬 이미지 생성 가이드 (ComfyUI)

## 환경

- **ComfyUI 경로**: `tools/ComfyUI/`
- **실행**: ComfyUI 서버가 `http://localhost:8188` 에서 동작 중이어야 함
- **생성 스크립트**: `back/scripts/generate_partition_textures.py`

## 현재 사용 모델

| 모델 | 파일 | 용도 | 품질 |
|------|------|------|------|
| **DreamShaper XL Lightning** ★ 기본 | `dreamshaperXL_lightningDPMSDE.safetensors` | 파티션 바닥 텍스처 | soft anime RPG 스타일 최적, 빠름 |
| RPG v5 | `rpg_v5.safetensors` | 대안 (medieval 스타일) | 판타지 RPG 게임 에셋 |
| SDXL Base 1.0 | `sd_xl_base_1.0.safetensors` | 범용 (비추) | 게임 에셋 부적합 |

## 모델별 최적 설정

### DreamShaper XL Lightning (SDXL 기반) — 기본값 ★
```
STEPS    = 8
CFG      = 2.0
SAMPLER  = dpmpp_sde
SCHEDULER= karras
DENOISE  = 1.0
WORKFLOW = VAEEncodeForInpaint (grow_mask_by=4) + 검정 base 이미지 + polygon mask
MAX_SIZE = 1024px
```

### RPG v5 (SD 1.5 기반) — 대안
```
STEPS    = 25
CFG      = 7.0
SAMPLER  = dpm_2_ancestral
SCHEDULER= karras
MAX_SIZE = 768px  (SD 1.5 최적: 512~768)
```

### SDXL Base (사용 비추)
```
STEPS    = 20
CFG      = 4.0
SAMPLER  = euler
MAX_SIZE = 1536px
```

## 스크립트 사용법

```bash
# 파티션 개별 생성 (outline 포함)
python back/scripts/generate_partition_textures.py \
    --partition-keys seoul.dongjak.noryangjin2.primary.p024 \
    --outline

# 그룹 전체 파티션 개별 생성
python back/scripts/generate_partition_textures.py \
    --group-key seoul.dongjak.noryangjin2.group.g04 \
    --per-partition --outline

# 기존 이미지에 outline만 다시 그리기 (이미지 재생성 없음)
python back/scripts/generate_partition_textures.py \
    --group-key seoul.dongjak.noryangjin2.group.g04 \
    --outline-only

# 기존 이미지 전부 지우고 outline만 있는 빈 이미지 생성 (방향 확인용)
python back/scripts/generate_partition_textures.py \
    --group-key seoul.dongjak.noryangjin2.group.g04 \
    --outline-only --blank

# 모델 지정 (기본값 변경 시)
python back/scripts/generate_partition_textures.py \
    --partition-keys ... \
    --checkpoint rpg_v5.safetensors
```

## 파티션 텍스처 프롬프트 가이드 (DreamShaper XL Lightning 기준)

### 공통 Positive 접두어
```
top-down 90 degree overhead, fantasy RPG game map ground tile,
soft painterly anime RPG art style, vibrant colors, clean readable game asset,
no characters, no buildings
```

### 공통 Negative
```
photorealistic, 3d render, isometric, side view, building, character,
text, watermark, dark gloomy, blurry, border, frame, bad quality
```

### texture_profile → Positive 추가 프롬프트
| texture_profile | 추가 Positive |
|----------------|--------------|
| `forest_path_02` | forest floor, dirt path, mossy ground, tree roots, leaf litter, dappled light |
| `green_courtyard` | soft grass courtyard, stone tiles, flower beds, warm sunlight |
| `dense_block_ground` | urban dirt ground, worn stone, compacted earth, gravel |
| `fantasy_stone_road` | ancient cobblestone road, moss cracks, old stone pavement |
| `frozen_bank` | frost-covered ground, icy soil, bare winter earth, snow patches |
| `event_surface` | magical rune circle, glowing stone floor, mystical ground |

### theme_code → Positive 추가 프롬프트 (texture_profile 없을 때)
| theme_code | 추가 Positive |
|-----------|--------------|
| `RESIDENTIAL_ZONE` | warm rooftop view, clay tile roofs, small courtyards, mossy stone paths, cozy residential ground |
| `FORGE_DISTRICT` | industrial stone floor, metal grates, forge ash ground, dark worn cobblestone, heat-cracked earth |
| `ACADEMY_SANCTUM` | stone courtyard, worn flagstone, ancient academy ground, moss between tiles |
| `SANCTUARY` | sacred stone paving, ceremonial tile patterns, soft earth and moss |
| `GREEN_ZONE` | lush grass, garden path, flower beds, soft natural ground |
| `COMMERCIAL_ZONE` | market stone floor, worn cobblestone, merchant district ground |

### image_prompt_append 활용
DB의 `image_prompt_append` 값을 Positive에 추가 (파티션별 고유 디테일).

## 이미지 생성 핵심 설계

### 스케일
- `METERS_PER_PIXEL = 0.5` → 1px = 0.5m
- `MAX_ASPECT = 3.0` → 종횡비 3:1 초과 시 타일 분할

### 타일링 처리
- 긴 파티션(예: 301m×35m, 비율 8.6:1)은 3:1 비율 타일 이미지 생성
- Three.js에서 UV repeat으로 자동 타일링
- Python/JS 모두 동일한 `MAX_ASPECT=3.0` 공식 사용

### Y축 좌표 (Three.js flipY 일치)
```python
# 마스크/outline 모두 동일하게 적용
y = (1.0 - (lat - min_lat) / span_lat) * height
```

### 마스크 전략
- 타일링 파티션 (repeat > 1.05): 전체 흰 마스크 (내용 전체 채움)
- 일반 파티션: polygon 경계 마스크

## 출력 경로

```
front/public/world_partition/{g_short}/{p_short}.png
예: front/public/world_partition/noryangjin2_g04/noryangjin2_p024.png
```

## 새 모델 추가 방법

1. CivitAI에서 `.safetensors` 다운로드
2. `tools/ComfyUI/models/checkpoints/` 에 복사
3. ComfyUI 자동 인식 (재시작 불필요)
4. 스크립트 상단 `CHECKPOINT_NAME` 변경 또는 `--checkpoint` 파라미터 사용

## 권장 모델 (CivitAI)

| 모델 | 특징 | 기반 |
|------|------|------|
| **RPG v5** | 판타지 RPG 게임 에셋, 빠름 | SD 1.5 |
| DreamShaper XL | 판타지 일러스트, 고품질 | SDXL |
| Juggernaut XL | 디테일 강함, 느림 | SDXL |
