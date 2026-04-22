# Title: Partition Texture Img2Img Workflow
Description: 레퍼런스 이미지 → img2img → world_partition 파일 생성 + DB 매핑 전체 워크플로우. 그룹별 바닥 텍스처를 일괄 생성하고 파티션에 자동 적용하는 확정 절차.
When-To-Read: world_partition 그룹에 바닥 텍스처를 생성하거나 교체할 때. 새 그룹/테마 추가 시. 파티션 텍스처 매핑 작업 시.
Keywords: img2img, partition, texture, world_partition, gen_pinterest_img2img, theme, ref, group, 2048, workflow
Priority: high

---

## 핵심 원칙

- **레퍼런스 이미지가 결과의 80%를 결정한다** — 좋은 ref 이미지 선택이 가장 중요
- ref는 씬 이미지(캐릭터/기둥 있어도 됨) — denoise 0.85가 분위기/색감만 추출
- 파티션마다 seed를 랜덤으로 달리해서 패턴 다양성 확보
- 출력 파일은 반드시 `world_partition/{g_short}/{p_short}.png` 경로에 저장
- DB `texture_image_url` 자동 업데이트 (스크립트가 처리)

---

## 확정 파이프라인 (S-01 기준)

| 항목 | 값 |
|------|-----|
| 스크립트 | `back/scripts/gen_pinterest_img2img.py` |
| 모델 | `juggernautXL_v10.safetensors` |
| LoRA 1 | `zavy-ctsmtrc-sdxl.safetensors` strength=0.6 |
| LoRA 2 | `add-detail-xl.safetensors` strength=0.5 |
| steps | 28 |
| CFG | 6.5 |
| sampler | dpmpp_2m / karras |
| denoise | 0.85 (핵심 파라미터) |
| 기본 출력 | 1024×1024 |
| 고품질 출력 | 2048×2048 (`--hires`) |

---

## 레퍼런스 이미지 소스

- **경로**: `front/public/ground/texture/normal/`
- **규칙**: 레퍼런스 원본은 `world_partition/{g_short}/ref_{theme}.png` 로 자동 복사 저장됨
- **선택 기준**: 분위기/색감/조명이 그룹 컨셉과 맞으면 됨. 씬 구성은 무시됨.

| 파일 | 특징 | 적합 테마 |
|------|------|-----------|
| `texture/13.png` | 용암 균열, 주황-빨강 글로우 | industrial, forge, lava zone |
| `texture/14.png` | 파란 균열 바위, 중간 강도 | dungeon, cold zone |
| `texture/15.png` | 에메랄드+금 균열 | scholarly, arcane, residential mystical |
| `texture/16.png` | 다크 그린 바위 | forest edge, shadow zone |
| `texture/17.png` | 딥 블루 균열 대리석 | dungeon, mystical hall (G11 사용) |
| `texture/18.png` | (확인 필요) | — |
| `texture/19.png` | (확인 필요) | — |

---

## 실행 방법

### 기본 (1024px)
```bash
python back/scripts/gen_pinterest_img2img.py \
  --ref front/public/ground/texture/normal/17.png \
  --theme dark_marble \
  --partition-keys \
    seoul..1.v2.0015 \
    seoul..1.v2.0261 ...
```

### 고품질 (2048px)
```bash
python back/scripts/gen_pinterest_img2img.py \
  --ref front/public/ground/texture/normal/15.png \
  --theme emerald_arcane \
  --hires \
  --partition-keys \
    seoul..2.v2.0038 ...
```

### 테스트 먼저 (저장 경로: ground/pinterest_i2i/)
```bash
python back/scripts/gen_pinterest_img2img.py \
  --ref front/public/ground/texture/normal/15.png \
  --theme emerald_arcane \
  --count 3
```

---

## 테마 목록 (THEMES 딕셔너리)

| 테마 키 | 레퍼런스 | 색감 | 적용 그룹 |
|---------|---------|------|-----------|
| `dungeon` | pinterest 던전 | 청록+보라 | — |
| `lava` | — | 주황+검정 | noryangjin2_g04 (industrial) |
| `forest` | — | 초록+갈색 | noryangjin2_g03 |
| `dark_marble` | `texture/17.png` | 딥블루+청록 | noryangjin1_g11 ✓ |
| `emerald_arcane` | `texture/15.png` | 에메랄드+금 | noryangjin2_g04 ✓ |
| `village_lane` | — | 따뜻한 돌 | — |
| `canyon_river` | — | 청록 강+바위 | — |
| `forest_path` | — | 숲+나무 판자 | — |
| `seamless_soil` | — | 흙 | — |

---

## 프롬프트 설계 규칙

### 방사형 패턴 방지
레퍼런스가 중앙 focal point를 가지면 모든 파티션이 비슷한 방사형 패턴으로 나옴.
→ 방지: `irregular branching crack network spread uniformly, no central origin point, distributed fracture pattern`

### 핵심 구조 (모든 테마 공통)
```
strict 90 degree top-down overhead view, flat ground plane fills entire frame,
[테마 핵심 묘사],
[색감/재질 세부],
[분위기 형용사] fantasy RPG ground texture,
painterly game art style, high detail, ground surface only
```

### Negative 핵심 (항상 포함)
```
side view, isometric angle, diagonal perspective, horizon,
characters, NPCs, buildings, sky, blurry, watermark, text, UI, border, frame
```

---

## 출력 파일 구조

```
front/public/world_partition/
  {g_short}/
    {p_short}.png        ← 파티션 텍스처 (1024 or 2048px)
    ref_{theme}.png      ← 사용한 레퍼런스 이미지 사본 (자동 저장)
```

## 그룹별 적용 이력

| 그룹 | g_short | 테마 | ref | 파티션 수 | 해상도 | 날짜 |
|------|---------|------|-----|-----------|--------|------|
| 노량진1 G11 고시촌 경전 전당 | noryangjin1_g11 | dark_marble | texture/17.png | 15 | 1024 | 2026-04-22 |
| 노량진2 G4 학인의 뜰권 | noryangjin2_g04 | emerald_arcane | texture/15.png | 16 | 2048 | 2026-04-22 |
