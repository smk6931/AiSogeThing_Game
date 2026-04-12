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
STEPS       = 12
CFG         = 3.5
SAMPLER     = dpmpp_sde
SCHEDULER   = karras
DENOISE     = 1.0
WORKFLOW    = VAEEncodeForInpaint (grow_mask_by=4) + 검정 base + feathered polygon mask
MASK_FEATHER= 12  ← polygon 경계 부드럽게 → ring border 방지 핵심
MAX_SIZE    = 1024px
```

### RPG v5 (SD 1.5 기반) — 대안
```
STEPS    = 25
CFG      = 7.0
SAMPLER  = dpm_2_ancestral
SCHEDULER= karras
MAX_SIZE = 768px  (SD 1.5 최적: 512~768)
```

## 스크립트 사용법

```bash
# 파티션 개별 생성
python back/scripts/generate_partition_textures.py \
    --partition-keys seoul..2.v2.0040

# 그룹 전체 파티션 개별 생성
python back/scripts/generate_partition_textures.py \
    --group-key seoul.dongjak.noryangjin2.group.g04 \
    --per-partition

# 모델 지정
python back/scripts/generate_partition_textures.py \
    --partition-keys ... \
    --checkpoint rpg_v5.safetensors
```

## 파티션 텍스처 프롬프트 가이드

### 구조
```
STYLE_PREFIX + 그룹 image_prompt_base → ComfyUI
```
- **Negative 프롬프트 없음** — 모델 자유도 확보, 그룹 프롬프트 + seed가 분위기와 변형을 담당
- FLOOR_CONTEXT / PERSONA 레이어 없음 — 그룹 단위 프롬프트로 통합

### STYLE_PREFIX (공통 접두어)
```
top-down 90 degree overhead view, fantasy RPG world ground surface,
soft painterly anime art style, vibrant natural colors,
seamless organic terrain texture
```

### 프롬프트 작성 원칙 (그룹 image_prompt_base)
- 바닥 지형 재질 중심 묘사 (stone, moss, dirt, grass, roots 등)
- 건물 내부·창문·가구·소품 표현 금지
- "clay tile roofs", "lit windows", "from upper floors" 같은 건물 시점 금지
- 그룹 테마(academy_sanctum, sanctuary_green 등)의 **바닥 분위기**를 묘사

### 파티션 면적 → scale hint (자동 삽입)
| 면적 | 힌트 |
|------|------|
| < 1,000 m² | `small NxNm ground area, detailed surface, seamless organic terrain` |
| 1,000~10,000 m² | `medium NxNm ground area, varied natural ground, seamless organic terrain` |
| > 10,000 m² | `large NxNm ground area, wide terrain with organic color variation, seamless` |

## 마스크 전략 (VAEEncodeForInpaint)

**polygon mask + MASK_FEATHER=12 (Gaussian blur) 사용**

- `MASK_FEATHER=12` 로 polygon 경계를 소프트하게 블러 처리
- 경계가 부드러워지면 AI가 hard border line에 stone/rock을 배치하지 않음
- grow_mask_by=4 로 경계 안쪽까지 약간 inpaint → 자연스러운 블렌딩
- Three.js polygon geometry가 최종 클리핑 담당

**ring border 방지 핵심**: MASK_FEATHER 값이 0이면 AI가 딱딱한 polygon 경계를 시각적 테두리(stone ring)로 강조함.
feather를 주면 경계가 그라디언트로 처리되어 자연스럽게 지형이 이어짐.

## 이미지 생성 핵심 설계

### 스케일
- `METERS_PER_PIXEL = 0.5` → 1px = 0.5m
- `MAX_ASPECT = 3.0` → 종횡비 3:1 초과 시 타일 분할

### 타일링 처리
- 긴 파티션(예: 301m×35m, 비율 8.6:1)은 3:1 비율 타일 이미지 생성
- Three.js에서 UV repeat으로 자동 타일링
- 타일링 파티션은 전체 흰 마스크 사용 (polygon 마스크 불필요)

### Y축 좌표 (Three.js flipY 일치)
```python
y = (lat - min_lat) / span_lat * height
```

## 출력 경로

```
front/public/world_partition/{g_short}/{p_short}.png
예: front/public/world_partition/noryangjin2_g04/0040.png
```

## 새 모델 추가 방법

1. CivitAI에서 `.safetensors` 다운로드
2. `tools/ComfyUI/models/checkpoints/` 에 복사
3. ComfyUI 자동 인식 (재시작 불필요)
4. 스크립트 `--checkpoint` 파라미터로 지정

## 권장 모델 (CivitAI)

| 모델 | 특징 | 기반 |
|------|------|------|
| **DreamShaper XL Lightning** | 판타지 일러스트, 빠름, 기본 | SDXL |
| RPG v5 | 판타지 RPG 게임 에셋 | SD 1.5 |
| Juggernaut XL | 디테일 강함, 느림 | SDXL |
