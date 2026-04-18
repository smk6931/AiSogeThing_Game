# Title: Local Image Generation (ComfyUI)
Description: 로컬 ComfyUI로 바닥 텍스처 생성 시 사용하는 모델, 파라미터, 스크립트 사용법. Juggernaut XL + 텍스처 프롬프트 방식이 확정 기준.
When-To-Read: 이미지 생성 요청, 바닥 텍스처 생성, ComfyUI 설정 변경, 모델 추가, 컨셉 변경 시
Keywords: comfyui, image-generation, texture, juggernaut, checkpoint, model, stable-diffusion, upscale, pbr, seamless
Priority: high

# 로컬 이미지 생성 가이드 (ComfyUI)

## 환경

- **ComfyUI 경로**: `tools/ComfyUI/`
- **실행**: ComfyUI 서버가 `http://localhost:8188` 에서 동작 중이어야 함
- **바닥 텍스처 스크립트**: `back/scripts/gen_ground_textures.py`
- **파티션 텍스처 스크립트**: `back/scripts/generate_partition_textures.py`

---

## ★ 확정 모델: Juggernaut XL v10

> 2026-04-15 검증 완료. DreamShaper XL Lightning 대비 PBR 재질감, 반사/광택 표현이 압도적으로 우수.
> 바닥 텍스처 목적에서는 Juggernaut XL이 기본 모델이다.

| 모델 | 파일 | 용도 | 상태 |
|------|------|------|------|
| **Juggernaut XL v10** ★ 기본 | `juggernautXL_v10.safetensors` | 바닥 텍스처 (PBR 품질) | **확정** |
| DreamShaper XL Lightning | `dreamshaperXL_lightningDPMSDE.safetensors` | 빠른 테스트용 (8 steps) | 보조 |
| RPG v5 | `rpg_v5.safetensors` | 판타지 씬 생성 보조 | 보조 |

경로: `tools/ComfyUI/models/checkpoints/`

---

## 확정 파이프라인: 512 → 4xUltrasharp → 2048px

```
EmptyLatentImage (512×512)
  → KSampler (STEPS=22, CFG=6.0, dpmpp_2m, karras, denoise=1.0)
  → VAEDecode
  → ImageUpscaleWithModel (4xUltrasharp)   ← 512 → 2048px
  → SaveImage
```

- **속도**: RTX 4060 Laptop 8GB 기준 약 12~15초/장
- **출력**: 2048×2048px
- **4096px 필요 시**: UltimateSDUpscale 추가 (약 10분, `gen_forest_ruins_4k.py` 참고)

### 업스케일 모델

| 모델 | 파일 | 경로 |
|------|------|------|
| **4xUltrasharp V10** ★ 필수 | `4xUltrasharp_4xUltrasharpV10.pt` | `tools/ComfyUI/models/upscale_models/` |

---

## ★ 핵심 원칙: 텍스처 프롬프트 vs 씬 프롬프트

**이게 가장 중요한 규칙이다.**

| 방식 | 프롬프트 예 | 결과 |
|------|-----------|------|
| ❌ 씬 프롬프트 | `top-down view of ancient forest ruins, trees, magic circle...` | 나무/오브젝트 포함, 바닥 텍스처 불적합 |
| ✅ 텍스처 프롬프트 | `seamless tileable ground texture, flat overhead view, [재질], photorealistic PBR material` | 순수 바닥 재질, UV 매핑 적합 |

- `top-down 90 degree overhead view` 처럼 구도 강제 문구는 **모델을 혼란스럽게** 만든다
- `seamless tileable ground texture, flat overhead view` 로 시작하면 모델이 텍스처 패턴으로 인식
- 오브젝트(나무, 벽, 기둥) 제거는 negative로 처리

---

## 확정 프롬프트 구조

### Positive

```
seamless tileable ground texture, flat overhead view,
[지형 재질 설명 — 돌/흙/이끼/얼음 등],
[재질 세부 — 균열/이끼/물기/모래 등],
[크기 다양성 — mixed large and small, irregular sizes],
high detail, photorealistic PBR material
```

### Negative

```
cartoon, anime, 3D render, depth, perspective, side view, isometric,
trees, plants, rocks above ground, objects, characters, buildings, walls,
sky, horizon, shadow, bright light, bloom,
blurry, watermark, text, logo, border, frame,
ugly, deformed, bad quality, duplicate
```

---

## 지형 타입별 프롬프트 레퍼런스

### 검증된 타입 (2026-04-15)

| 타입 | 핵심 키워드 | 결과 파일 |
|------|-----------|---------|
| **ice** ★ 최고 품질 | `frozen tundra ice ground, cracked ice sheets, snow-dusted angular rocks embedded in ice, pale blue atmospheric light, mixed large and small ice fragments, irregular cracks` | `jug_ice_preview.png` |
| cobblestone | `angular irregular cobblestone pavement, mixed large and small stones, varied stone sizes randomly placed, sharp-edged flat stones, dirt and moss filling gaps` | `cobblestone_2k.png` |
| moss_stone | `angular flat stone slabs with heavy green moss, irregular sized stone pieces scattered randomly, thick moss patches, mixed large slabs and small pebbles` | `moss_stone_2k.png` |
| dirt_path | `natural dirt path with scattered flat stones, irregular flat pebbles and rocks of mixed sizes embedded in soil, packed earth with gravel` | `dirt_path_2k.png` |
| dry_cracked | `dry cracked earth with irregular stone fragments, deep crack lines between dried mud polygons, flat angular pebbles scattered randomly` | `dry_cracked_2k.png` |

### 신규 타입 추가 시 참고

| 컨셉 | 권장 키워드 |
|------|-----------|
| 용암 지대 | `cooled lava ground, cracked obsidian surface, glowing orange cracks between dark basalt stones, igneous rock fragments` |
| 설원 | `snow-covered frozen ground, compacted snow, ice crystals, frosted earth, pale white and blue tones` |
| 모래 사막 | `desert sand ground, fine sand texture, small pebbles scattered, sand ripple patterns, warm beige and tan tones` |
| 습지 | `swamp ground, dark muddy soil, wet moss, waterlogged earth, decomposed leaves, dark green and brown` |
| 신전 바닥 | `ancient stone floor tiles, weathered marble, carved stone slabs, dusty cracks, geometric tile pattern` |

---

## 컨셉 변경 시 대응 방법

게임 세계관이나 지형 컨셉이 바뀌어도 아래 순서만 따르면 된다.

1. **모델은 그대로** — Juggernaut XL v10은 사실적 재질이면 모두 잘 표현
2. **Positive 핵심 프레임 유지** — `seamless tileable ground texture, flat overhead view, ... photorealistic PBR material`
3. **지형 재질 키워드만 교체** — 위 레퍼런스 테이블 또는 새로 작성
4. **Negative는 그대로** — 오브젝트 제거 negative는 컨셉 무관하게 동일하게 유지
5. **seed 변경으로 변형 생성** — 같은 프롬프트에서 seed만 바꾸면 다른 패턴 나옴

### DreamShaper로 돌아가야 할 때

- **빠른 프로토타입** — 8 steps, ~10초, 아이디어 확인용
- **판타지 씬(오브젝트 포함)** — Juggernaut보다 판타지 표현 강함
- 이 경우 `STEPS=8, CFG=2.0, SAMPLER=dpmpp_sde` 로 변경

---

## 스크립트 사용법

### gen_ground_textures.py (바닥 텍스처 전용)

```bash
# 전체 4개 타입 생성
python back/scripts/gen_ground_textures.py

# 특정 타입만
python back/scripts/gen_ground_textures.py --keys cobblestone ice

# 출력: front/public/ground/generated/{타입}_2k.png
```

스크립트 내 `CHECKPOINT`, `TILES` 딕셔너리에서 모델/프롬프트 수정.

### generate_partition_textures.py (파티션 DB 연동)

```bash
# 파티션 개별 생성
python back/scripts/generate_partition_textures.py \
    --partition-keys seoul..2.v2.0040

# 모델 지정 (Juggernaut 사용 시)
python back/scripts/generate_partition_textures.py \
    --partition-keys seoul..2.v2.0040 \
    --checkpoint juggernautXL_v10.safetensors
```

---

## 출력 경로

| 용도 | 경로 |
|------|------|
| 바닥 텍스처 테스트 | `front/public/ground/generated/{name}_2k.png` |
| 파티션 텍스처 | `front/public/world_partition/{g_short}/{p_short}.png` |
| ComfyUI 원본 출력 | `tools/ComfyUI/output/` |

**주의**: ComfyUI output 폴더에서 직접 urlretrieve로 다운로드 시 원본 파일을 덮어쓸 수 있음.
파일 복사는 항상 `shutil.copy2` 또는 다른 경로에 저장.

---

## 하드웨어 기준 (RTX 4060 Laptop 8GB)

| 파이프라인 | 시간 | VRAM | 품질 |
|-----------|------|------|------|
| Juggernaut XL + 4xUltrasharp → 2048px | ~12초 | ~6GB | ★★★★★ |
| DreamShaper Lightning + 4xUltrasharp → 2048px | ~10초 | ~5GB | ★★★ |
| + UltimateSDUpscale → 4096px | +10분 | ~7GB | ★★★★★ |
| Flux.1 schnell fp8 → 2048px | ~40초 | ~8GB (빠듯) | ★★★★★ |

---

## 새 모델 추가

1. CivitAI에서 `.safetensors` 다운로드
2. `tools/ComfyUI/models/checkpoints/` 에 복사
3. ComfyUI 자동 인식 (재시작 불필요)
4. 스크립트 내 `CHECKPOINT` 변수 또는 `--checkpoint` 파라미터로 지정
