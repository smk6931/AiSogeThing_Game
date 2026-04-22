# Title: Themed Partition Img2Img — G11 Dark Marble & G4 Emerald Arcane
Description: 노량진1동 G11(dark_marble 1024px)와 노량진2동 G4(emerald_arcane 2048px) 파티션 일괄 텍스처 생성 성공 케이스. ref 이미지 → img2img → 파티션별 파일 저장 + DB 자동 매핑 전체 흐름 검증 완료.
When-To-Read: 새 그룹에 themed img2img 텍스처를 적용할 때. 1024px vs 2048px 품질 선택 기준이 필요할 때. 이미지 생성 파이프라인 전체 구조 파악 필요 시.
Keywords: img2img, partition, dark_marble, emerald_arcane, 1024, 2048, hires, juggernautXL, lora, 4xUltrasharp, G11, G4, noryangjin
Priority: high

---

## 적용 그룹

| 그룹 | g_short | 테마 | ref | 파티션 수 | 해상도 | 날짜 |
|------|---------|------|-----|-----------|--------|------|
| 노량진1동 G11 고시촌 경전 전당 | noryangjin1_g11 | dark_marble | texture/normal/17.png | 15 | 1024px | 2026-04-22 |
| 노량진2동 G4 학인의 뜰권 (3장 테스트) | noryangjin2_g04 | emerald_arcane | texture/normal/15.png | 3 (0038~0040) | 2048px | 2026-04-22 |

---

## 공통 파이프라인 (1024 & 2048 모두 동일)

```
ref image
  → ImageScale (OUT_PX 크기로 리사이즈)
  → VAEEncode
  → KSampler (denoise=0.85 → 분위기/색감만 추출, 구조 대부분 새로 생성)
  → VAEDecode
  → 4xUltrasharp upscale (항상 포함)
  → ImageScale (최종 OUT_PX로 다운스케일)
  → SaveImage
```

## 공통 모델 & 파라미터

| 항목 | 값 |
|------|-----|
| 모델 | `juggernautXL_v10.safetensors` |
| LoRA 1 | `zavy-ctsmtrc-sdxl.safetensors` strength=0.6 |
| LoRA 2 | `add-detail-xl.safetensors` strength=0.5 |
| steps | 28 |
| cfg | 6.5 |
| sampler | dpmpp_2m / karras |
| denoise | 0.85 |
| 업스케일러 | `4xUltrasharp_4xUltrasharpV10.pt` (항상 포함) |

---

## 1024px vs 2048px 차이

| 항목 | 1024px (기본) | 2048px (`--hires`) |
|------|--------------|-------------------|
| KSampler 입력 latent | 1024×1024 | 2048×2048 |
| 4xUltrasharp 중간 크기 | ~4096px | ~8192px |
| 최종 출력 파일 | 1024×1024 png | 2048×2048 png |
| 생성 시간 (파티션 1장) | ~2~3분 | ~5~8분 |
| VRAM 사용 | 낮음 | 높음 (latent 4배) |
| 세부 묘사 품질 | 보통 | 높음 (latent 자체가 크므로 균열/표면 디테일 선명) |
| 파일 용량 | ~0.5~1MB | ~2~4MB |

**핵심**: 프롬프트·모델·LoRA는 동일. `--hires`는 초기 latent를 2048로 올려 세부 묘사가 늘어나는 것이지 사후 업스케일만 하는 게 아님.

---

## 실행 명령 (참조용)

### G11 — dark_marble 1024px
```bash
python back/scripts/gen_pinterest_img2img.py \
  --ref "front/public/ground/texture/normal/17.png" \
  --theme dark_marble \
  --partition-keys \
    seoul..1.v2.0015 seoul..1.v2.0203 seoul..1.v2.0261 \
    seoul..1.v2.0262 seoul..1.v2.0263 seoul..1.v2.0264 \
    seoul..1.v2.0265 seoul..1.v2.0266 seoul..1.v2.0267 \
    seoul..1.v2.0268 seoul..1.v2.0269 seoul..1.v2.0277 \
    seoul..1.v2.0278 seoul..1.v2.0279 seoul..1.v2.0280
```

### G4 테스트 3장 — emerald_arcane 2048px
```bash
python back/scripts/gen_pinterest_img2img.py \
  --ref "front/public/ground/texture/normal/15.png" \
  --theme emerald_arcane \
  --hires \
  --partition-keys \
    seoul..2.v2.0038 seoul..2.v2.0039 seoul..2.v2.0040
```

### G4 나머지 13장 (승인 후 실행)
```bash
python back/scripts/gen_pinterest_img2img.py \
  --ref "front/public/ground/texture/normal/15.png" \
  --theme emerald_arcane \
  --hires \
  --partition-keys \
    seoul..2.v2.0041 seoul..2.v2.0042 seoul..2.v2.0043 \
    seoul..2.v2.0044 seoul..2.v2.0045 seoul..2.v2.0055 \
    seoul..2.v2.0056 seoul..2.v2.0081 seoul..2.v2.0082 \
    seoul..2.v2.0083 seoul..2.v2.0094 seoul..2.v2.0096 \
    seoul..2.v2.0097
```

---

## 프롬프트 — emerald_arcane

**Positive**:
```
strict 90 degree top-down overhead view, flat ground plane fills entire frame edge to edge,
dark emerald green cracked stone floor texture,
golden glowing luminescent crack lines distributed irregularly across entire surface,
irregular branching crack network spread uniformly, no central origin point,
deep dark green jade stone slabs with warm gold glowing fissures,
ancient arcane scholar hall floor, mystical enchanted stone tiles,
distributed fracture pattern across flat surface, varied crack widths,
dark teal and forest green stone with bright amber gold veins,
fantasy RPG arcane scholarly ground texture, painterly game art style, high detail, ground surface only
```

**Negative**:
```
radial burst pattern, central focal point, starburst cracks from center,
crystal pillars standing upright, vertical structures,
characters, warriors, NPCs, monsters,
cave walls, rock walls, ceiling,
blue tones, cyan glow, orange lava, red fire,
side view, isometric angle, diagonal perspective, horizon,
sky, outdoor, blurry, watermark, text, UI, border, frame
```

---

## 핵심 교훈

- `no central origin point, distributed fracture pattern` → 방사형 패턴 방지 핵심 키워드 (17.png ref 사용 시 특히 중요)
- denoise=0.85 → ref 구조 70~80% 무시하고 분위기/색감만 가져옴. 구도는 프롬프트가 결정
- 파티션마다 seed 랜덤 → 동일 테마지만 균열 패턴이 다르게 나와 자연스러운 다양성 확보
- 2048 --hires는 1장당 5~8분. 16파티션이면 약 80~130분. 배치 실행 전 시간 계산 필요
