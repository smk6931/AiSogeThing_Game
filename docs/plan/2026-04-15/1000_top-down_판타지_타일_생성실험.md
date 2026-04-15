# Top-Down 판타지 타일 생성 실험 (2026-04-15)

## 배경 및 목표

- DreamShaper XL Lightning + add-detail-xl LoRA 조합으로 top-down 판타지 게임 바닥 타일 품질 검증
- juggernautXL vs dreamshaperXL Lightning 비교 전, 먼저 DreamShaper + LoRA 베이스라인 확보
- 지형 유형별 프롬프트 + 설정값 정리

## 모델 구성

| 항목 | 값 |
|------|-----|
| Checkpoint | `dreamshaperXL_lightningDPMSDE.safetensors` |
| LoRA | `add-detail-xl.safetensors` (strength 0.7) |
| Upscaler | `4xUltrasharp_4xUltrasharpV10.pt` |
| Steps | 8 (Lightning 최적) |
| CFG | 2.0 |
| Sampler | dpmpp_sde / karras |
| Size | 512px pass1 → 1024px 출력 |

## LoRA 설명

- **add-detail-xl** (Detail Tweaker XL): XL 모델에 세밀한 표면 디테일 추가. 바닥 텍스처에 특히 효과적.
  - strength 0.5~0.8 권장. 너무 높으면 노이즈 과다.
- **zavy-ctsmtrc-sdxl**: 아이소메트릭/top-down 구도 강화 LoRA. 향후 실험 예정.

## 생성 지형 순서

- [ ] 마을길 (cobblestone village road)
- [ ] 숲 바닥 (forest ground, roots, moss)
- [ ] 강가 (riverbank, pebbles, wet sand)
- [ ] 용암지대 (volcanic cracked ground)
- [ ] 설원 (snowy ground, ice patches)
- [ ] 도시 석판길 (city plaza stone floor)

## 프롬프트 공통 구조

```
top-down 90 degree overhead view, fantasy RPG [지형],
ground floor seen from directly above, detailed surface texture,
[지형 세부묘사], painterly illustration, high detail,
no shadows, no perspective distortion, seamless tiling texture
```

## Negative 공통

```
cartoon, anime, flat colors, isometric, perspective view, side view,
buildings, interior, furniture, rooftop, sky, horizon,
blurry, watermark, text, logo, border, frame,
bright daylight, cheerful, deformed, duplicate
```

## 출력 경로

`front/public/ground/generated/[이름].png`

## 주의사항

- "canyon wall", "cavern", "crystal formations" 등 수직 구도 단어 금지
- **floor / ground / overhead / seen from above** 단어 필수
- Lightning 모델은 CFG 2.0 고정 (높이면 artifact 발생)
- LoRA strength > 0.8 시 과도한 노이즈 위험
