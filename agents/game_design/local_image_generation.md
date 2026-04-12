# Title: Local Image Generation (ComfyUI)
Description: 로컬 ComfyUI로 파티션 바닥 텍스처 생성 시 사용하는 모델, 파라미터, 스크립트 사용법
When-To-Read: 이미지 생성 요청, 파티션 텍스처 생성, ComfyUI 설정 변경, 모델 추가 시
Keywords: comfyui, image-generation, texture, partition, rpg, checkpoint, model, stable-diffusion, hires-fix, upscale
Priority: high

# 로컬 이미지 생성 가이드 (ComfyUI)

## 환경

- **ComfyUI 경로**: `tools/ComfyUI/`
- **실행**: ComfyUI 서버가 `http://localhost:8188` 에서 동작 중이어야 함
- **생성 스크립트**: `back/scripts/generate_partition_textures.py`

## 현재 사용 모델

| 모델 | 파일 | 용도 |
|------|------|------|
| **DreamShaper XL Lightning** ★ 기본 | `dreamshaperXL_lightningDPMSDE.safetensors` | 파티션 바닥 텍스처 |
| RPG v5 | `rpg_v5.safetensors` | 대안 (--style village 프리셋) |

## 업스케일 모델

| 모델 | 파일 | 용도 |
|------|------|------|
| **4xUltrasharp V10** ★ 필수 | `4xUltrasharp_4xUltrasharpV10.pt` | hi-res fix 후 최종 업스케일 |

경로: `tools/ComfyUI/models/upscale_models/`

## 워크플로우 (hi-res fix + 4xUltrasharp)

참조 이미지(`ds_lava_canyon`, `ds_crystal_cave` 등)와 동일한 파이프라인.

```
Pass 1: EmptyLatentImage (img_w × img_h)
         → KSampler (STEPS=8, CFG=2.0, denoise=1.0)
         → VAEDecode

Pass 2: ImageScaleBy 1.5x (lanczos)
         → VAEEncode
         → KSampler (STEPS=8, CFG=2.0, denoise=0.5) ← hi-res fix
         → VAEDecode

Pass 3: ImageUpscaleWithModel (4xUltrasharp)
         → ImageScale → min(img_w×2, 2048) × min(img_h×2, 2048)
         → SaveImage

Post:   PIL polygon 클리핑 (polygon 외부 → 검정)
         feather=6 으로 경계 부드럽게
```

**이전 방식(VAEEncodeForInpaint)과 차이점:**
- ring border 문제 원천 제거 (AI 생성 시 마스크 없음)
- 퀄리티 대폭 향상 (2배 해상도 + 4xUltrasharp)
- polygon 클리핑은 PIL post-process로 (Three.js가 최종 UV 처리)

## 현재 설정값

```
STEPS            = 8
CFG              = 2.0
SAMPLER          = dpmpp_sde
SCHEDULER        = karras
HIRESFIX_DENOISE = 0.5
UPSCALE_MODEL    = 4xUltrasharp_4xUltrasharpV10.pt
POLY_MASK_FEATHER= 6      ← PIL 클리핑 경계 feather
```

## 프롬프트 가이드

### Positive 구조
```
그룹 image_prompt_base  (또는 --override-prompt 직접 지정)
+ scale hint (면적 기반 자동 삽입)
```

- `image_prompt_base`는 `world_partition_group` 테이블에 저장
- 프롬프트 스타일: `"top-down 90 degree overhead view, fantasy RPG world [지형], high detail, painterly illustration"`
- 건물·소품·실내 묘사 금지 → 자연 지형(바닥, 암석, 초목, 용암, 빙하 등) 중심
- **주의**: "crystal formations", "cavern", "canyon wall" 같은 수직 구도 단어는 top-down 지시어를 무시하고 side-view를 생성함. 대신 "crystal-covered ground floor", "cave floor seen from above", "overhead view of cave ground" 처럼 **바닥/floor** 중심으로 작성할 것

### Negative (STYLE_NEGATIVE)
```
cartoon, anime, flat colors, isometric, bright daylight, cheerful,
blurry, watermark, text, logo, frame, border, bad quality, ugly, deformed, duplicate,
building interior, room, furniture, indoor, rooftop view
```

### 파티션 면적 → scale hint (자동 삽입)
| 면적 | 힌트 |
|------|------|
| < 1,000 m² | `small NxNm ground area, detailed surface, seamless organic terrain` |
| 1,000~10,000 m² | `medium NxNm ground area, varied natural ground, seamless organic terrain` |
| > 10,000 m² | `large NxNm ground area, wide terrain with organic color variation, seamless` |

## 스크립트 사용법

```bash
# 파티션 개별 생성
python back/scripts/generate_partition_textures.py \
    --partition-keys seoul..2.v2.0040

# 그룹 전체 파티션 개별 생성
python back/scripts/generate_partition_textures.py \
    --group-key seoul.dongjak.noryangjin2.group.g04 \
    --per-partition

# 프롬프트 직접 지정 (테스트용, DB 프롬프트 무시)
python back/scripts/generate_partition_textures.py \
    --partition-keys seoul..2.v2.0040 \
    --override-prompt "top-down overhead view, fantasy RPG ancient forest ruins, ..."

# 모델 지정
python back/scripts/generate_partition_textures.py \
    --partition-keys ... \
    --checkpoint rpg_v5.safetensors
```

## 이미지 생성 품질이 낮게 나올 때

1. **4xUltrasharp 모델 확인**: `tools/ComfyUI/models/upscale_models/4xUltrasharp_4xUltrasharpV10.pt` 존재 여부 확인
2. **프롬프트 점검**: 건물·소품 묘사 제거, 자연 지형 중심으로 재작성
3. **Negative 점검**: `STYLE_NEGATIVE` 에 `building interior, rooftop view` 포함 여부 확인
4. **ComfyUI 재시작**: 모델 로딩 오류 시

## 이미지 스케일

- `METERS_PER_PIXEL = 0.5` → 1px = 0.5m (Pass 1 기준)
- `MAX_ASPECT = 3.0` → 종횡비 3:1 초과 시 타일 분할
- 최종 출력: Pass 1 해상도 × 2 (최대 2048px)

## 타일링 처리

- 긴 파티션(비율 > 3:1)은 타일 이미지 생성 후 Three.js UV repeat
- 타일링 파티션: PIL 클리핑 없이 전체 이미지 사용

## 출력 경로

```
front/public/world_partition/{g_short}/{p_short}.png
예: front/public/world_partition/noryangjin2_g04/0040.png
```

## 새 모델 추가

1. CivitAI에서 `.safetensors` 다운로드
2. `tools/ComfyUI/models/checkpoints/` 에 복사
3. ComfyUI 자동 인식 (재시작 불필요)
4. `--checkpoint` 파라미터로 지정
