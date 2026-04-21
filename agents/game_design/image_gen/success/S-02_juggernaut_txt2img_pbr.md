# Title: S-02 Juggernaut XL txt2img PBR Seamless Texture
Description: Juggernaut XL v10으로 생성한 사실적 PBR seamless 바닥 텍스처. 재질감 최고 품질, seamless 타일링 용도에 확정 방식.
When-To-Read: 사실적 재질감의 seamless 타일 텍스처가 필요할 때 (얼음, 돌, 흙, 이끼 등)
Keywords: success, txt2img, juggernaut, pbr, seamless, tileable, ice, cobblestone
Priority: high

**날짜**: 2026-04-15  
**스크립트**: `back/scripts/gen_ground_textures.py`  
**출력 경로**: `front/public/ground/generated/`

---

## 설정값

| 항목 | 값 |
|------|-----|
| 모델 | `juggernautXL_v10.safetensors` |
| LoRA | 없음 |
| steps | 22 |
| CFG | 6.0 |
| sampler | dpmpp_2m / karras |
| denoise | 1.0 (txt2img) |
| 파이프라인 | EmptyLatentImage 512 → KSampler → VAEDecode → 4xUltrasharp → 2048px |

---

## 프롬프트 구조

`local_image_generation.md` 의 확정 프롬프트 구조를 따른다.

### Positive 핵심 프레임
```
seamless tileable ground texture, flat overhead view,
[지형 재질 설명],
[재질 세부],
high detail, photorealistic PBR material
```

### Negative 핵심 프레임
```
cartoon, anime, 3D render, depth, perspective, side view, isometric,
trees, plants, rocks above ground, objects, characters, buildings,
sky, horizon, shadow, bright light,
blurry, watermark, text, logo, border
```

---

## 검증된 지형 타입

| 타입 | 결과 파일 | 평가 |
|------|-----------|------|
| ice ★ | `jug_ice_preview.png` | 최고 품질 — 크랙 얼음 사실적 |
| cobblestone | `cobblestone_2k.png` | 우수 |
| moss_stone | `moss_stone_2k.png` | 우수 |
| dirt_path | `dirt_path_2k.png` | 양호 |
| dry_cracked | `dry_cracked_2k.png` | 양호 |

---

## 특징 및 한계

- **강점**: PBR 재질감 최고, seamless 타일링 완벽
- **한계**: 게임 아트 "느낌"보다 사실적 재질감 쪽 → 게임 아트 스타일 원하면 [S-01] 사용
