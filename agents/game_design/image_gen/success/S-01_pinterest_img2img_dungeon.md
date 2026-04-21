# Title: S-01 Pinterest Img2Img — 최상 확정 파이프라인
Description: Pinterest 씬 이미지를 레퍼런스로 img2img 생성하는 최상 확정 파이프라인. 던전/용암/숲 등 테마 교체 가능. 파라미터는 그대로 유지하고 POSITIVE/NEGATIVE만 교체.
When-To-Read: 게임 아트 스타일의 바닥 텍스처 생성이 필요할 때. 테마 무관하게 이 파이프라인이 기본값.
Keywords: success, best, confirmed, img2img, pinterest, juggernaut, lora, zavy, detail, denoise, dungeon, lava, forest
Priority: high

> ★ 2026-04-21 최상 확정. 이후 이미지 생성은 특별한 이유 없으면 이 파이프라인 사용.

**날짜**: 2026-04-21  
**스크립트**: `back/scripts/gen_pinterest_img2img.py`  
**출력 경로**: `front/public/ground/pinterest_i2i/`

---

## 설정값

| 항목 | 값 |
|------|-----|
| 모델 | `juggernautXL_v10.safetensors` |
| LoRA 1 | `zavy-ctsmtrc-sdxl.safetensors` strength=**0.6** |
| LoRA 2 | `add-detail-xl.safetensors` strength=**0.5** |
| steps | 28 |
| CFG | 6.5 |
| sampler | dpmpp_2m / karras |
| **denoise** | **0.85** ← 가장 중요한 수치 |
| 출력 해상도 | 1024×1024 |
| 파이프라인 | VAEEncode → KSampler → VAEDecode → 4xUltrasharp → ImageScale |

---

## 프롬프트

### Positive
```
strict 90 degree top-down overhead view, flat ground plane fills entire frame,
dark cracked stone dungeon floor texture,
magical teal and cyan glow bleeding through floor cracks,
purple crystal shards embedded flat in ground,
dark jade-green stone tiles with deep fissures,
glowing rune patterns on ancient stone surface,
fantasy RPG dungeon ground texture,
painterly hand-drawn game art style, high detail, ground surface only
```

### Negative
```
crystal pillars standing upright, tall crystal towers, glowing vertical crystals,
characters, warriors, NPCs, monsters,
cave walls, rock walls, ceiling, stalactites,
fire torches, wall decorations,
side view, isometric angle, diagonal perspective, horizon,
sky, outdoor, blurry, watermark, text, UI, border, frame
```

---

## 레퍼런스 이미지

- **파일**: `front/public/images/pinterest/e2d883e3f30b7ac9e222195601498684.jpg`
- **내용**: isometric 2.5D 판타지 던전, 청록/보라 크리스탈 기둥, 캐릭터 포함된 씬 이미지

---

## 성공 원인 분석

1. **denoise 0.85**: 씬의 구성(크리스탈 기둥, 캐릭터, 동굴 벽)은 날리고 색감과 분위기만 추출
2. **씬 이미지 레퍼런스**: 바닥 텍스처 이미지가 아닌 "씬 이미지"가 오히려 좋은 결과 → 모델이 구성 정보는 무시하고 분위기/색감만 가져옴
3. **zavy LoRA**: isometric 게임 아트 느낌 잡아줌

---

## 재사용 방법

```bash
python back/scripts/gen_pinterest_img2img.py \
  --ref front/public/images/pinterest/<파일명>.jpg \
  --count 2
```

다른 테마: `--ref` 경로만 교체. 프롬프트는 스크립트 내 `POSITIVE` / `NEGATIVE` 상수 수정.

---

## 확정된 테마 목록 (스크립트 `--theme` 인자)

| 테마 | `--theme` 값 | 확인 날짜 | 결과 |
|------|-------------|----------|------|
| 던전 (크리스탈) | `dungeon` | 2026-04-21 | ★★★★★ |
| 용암 화산 | `lava` | 2026-04-21 | ★★★★★ — noryangjin2_g04 적용 |
| 숲/강 | `forest` | 2026-04-21 | ★★★★★ — noryangjin2_g03 적용 |

## 레퍼런스 이미지 보관 규칙

- 원본 소스: `front/public/images/pinterest/`
- 그룹별 사용 레퍼런스 사본: `front/public/world_partition/{g_short}/ref_{theme}.png`
- 스크립트가 파티션 모드 실행 시 자동 복사

## 다른 테마 추가 시 교체 포인트

스크립트 `back/scripts/gen_pinterest_img2img.py` 의 `THEMES` 딕셔너리에 추가:

| 테마 | 핵심 Positive 키워드 |
|------|---------------------|
| 얼음 동굴 | `cracked ice floor`, `frozen stone`, `blue-white glow` |
| 해변 신전 | `worn stone tiles`, `wet sand between stones`, `shallow water puddles` |
| 늪지 | `dark swamp mud`, `waterlogged earth`, `decomposed leaves flat on ground` |
