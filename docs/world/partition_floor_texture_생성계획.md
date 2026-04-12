# Partition 바닥 텍스처 생성 계획

> 목표: `front/public/images/`의 RPG 배틀맵 퀄리티를 partition 텍스처에 적용

---

## 1. 목표 품질 분석 (front/public/images 기준)

| 이미지 | 스타일 | 특징 |
|--------|--------|------|
| image.png | 클래식 JRPG 마을 맵 | 건물·나무·길이 top-down, 손그림 느낌 |
| image copy 3.png | 핸드페인팅 배틀맵 (Mimosa20) | 자연지형, 위에서 내려다보는 씬 |
| image copy 5.png | 핸드페인팅 배틀맵 (Mimosa20) | 숲+캠프, 풍부한 디테일 |
| 2b8a23a7... | 3D 렌더 배틀맵 (Zen Maps) | 약간 기울어진 overhead, 사실적 조명 |
| 5ee644c3... | 페인터리 던전 맵 (Mauna Maps) | 마법적 분위기, overhead 씬 |

**핵심 결론:** 이것들은 seamless texture가 아니라 **한 장면 전체를 위에서 내려다 본 RPG 씬**이다.  
partition 텍스처도 이 방향이어야 한다 — 각 파티션이 고유한 판타지 지역 씬 1장.

---

## 2. 지금까지 실패 원인

| 시도 | 문제 |
|------|------|
| "seamless tileable texture" | 모델이 재질 패턴(원형 메달리온 등)으로 해석 |
| "apartment cluster, rooftop" | 측면 투시도 건물 씬 생성 |
| "clay tile pattern" | 화려한 모자이크 원형 패턴 |

→ **"texture"라는 단어 자체를 버려야 한다.**  
→ **"map", "scene", "area", "battle map"으로 교체.**

---

## 3. 올바른 프롬프트 구조

### 기본 STYLE_PREFIX (교체 필요)
```
hand-painted top-down RPG map, bird's eye view overhead,
fantasy korean neighborhood scene,
detailed environment art, warm natural lighting,
professional tabletop battle map style,
rich colors, painterly, high detail
```

### STYLE_NEGATIVE
```
blurry, low quality, watermark, text, signature,
humans, characters, animals,
perspective view, isometric, side view, angled,
modern, sci-fi, photorealistic,
seamless texture, pattern repeat, tile grid
```

### 테마별 씬 프롬프트 (FLOOR_CONTEXT 교체)

```python
FLOOR_CONTEXT = {
    "RESIDENTIAL_ZONE":
        "overhead view of dense korean residential neighborhood, "
        "clay tile rooftops from above, narrow alleyways between buildings, "
        "small courtyards with trees, laundry lines, stone paths, "
        "warm terracotta and grey tones, lived-in atmosphere",

    "COMMERCIAL_ZONE":
        "overhead view of korean market street, "
        "merchant stalls with awnings seen from above, "
        "cobblestone paths, wooden crates, lanterns along road, "
        "busy atmosphere, warm evening lighting",

    "ACADEMY_SANCTUM":
        "overhead view of ancient korean academy courtyard, "
        "stone flagstone plaza, pavilion rooftops from above, "
        "scholars' garden, ink stone well, moss between paving stones, "
        "serene atmosphere, grey and green tones",

    "GREEN_ZONE":
        "overhead view of korean hillside forest park, "
        "dense tree canopy from above, stone garden path, "
        "mossy boulders, small shrine, dappled light through trees, "
        "lush green atmosphere",

    "SANCTUARY":
        "overhead view of shinto-influenced korean shrine grounds, "
        "stone torii base, ceremonial stone path, sacred trees from above, "
        "offering tables, stone lanterns, sacred atmosphere",

    "INDUSTRIAL":
        "overhead view of industrial district, "
        "factory rooftops from above, storage yards, "
        "rail tracks, metal roofing, concrete slabs, "
        "gritty urban atmosphere",
}
```

---

## 4. 모델 설정

### 현재 가용 체크포인트
| 모델 | 평가 | 용도 |
|------|------|------|
| `rpg_v5.safetensors` | ⭐⭐⭐ 좋음 | RPG 씬 생성, 한국 건축 이해 |
| `sd_xl_base_1.0.safetensors` | ⭐⭐ 보통 | 너무 photorealistic 경향 |

**→ rpg_v5 계속 사용. 단, 프롬프트를 "씬" 중심으로 변경.**

### 권장 추가 모델 (우선순위 순)
1. **DreamShaper XL** — 판타지 씬, 디테일 강함
2. **Deliberate v6** — 핸드페인팅 배틀맵에 최적
3. **AbsoluteReality** — 사실적 top-down 맵

### ComfyUI 설정
```python
CHECKPOINT_NAME = "rpg_v5.safetensors"
STEPS    = 28          # 품질/속도 균형
CFG      = 7.5         # 프롬프트 충실도
SAMPLER  = "dpm_2_ancestral"
SCHEDULER = "karras"
```

---

## 5. 이미지 생성 방식 (기존 inpainting → txt2img 검토)

### 현재 방식: Inpainting (SetLatentNoiseMask)
- polygon 마스크 안에만 생성
- 장점: polygon 경계에 맞게 클리핑
- 단점: 작은 polygon에서 씬 구성이 어색해짐

### 권장 방식: txt2img → polygon clip (2단계)
```
1. txt2img로 전체 씬 생성 (bbox 크기 기준)
2. polygon 마스크로 외부 픽셀 투명 처리 (PIL)
3. 결과 PNG 저장
```
→ 씬 구성이 자연스럽고 inpainting mask 제약 없음

---

## 6. 실행 계획

### Phase 1: 프롬프트 검증 (지금)
- [ ] STYLE_PREFIX → "hand-painted top-down RPG map scene" 으로 교체
- [ ] FLOOR_CONTEXT → 씬 묘사로 전면 교체
- [ ] g04 대표 파티션 2개로 테스트 생성
- [ ] 인게임 확인

### Phase 2: 워크플로우 개선
- [ ] txt2img + polygon clip 방식으로 전환
- [ ] 결과 품질 비교 (inpainting vs txt2img+clip)

### Phase 3: 전체 생성
- [ ] g04 16개 파티션 전체 생성
- [ ] 다른 그룹(g01, g03, g08)으로 확대

---

## 7. 인게임 적용 방법

1. `back/scripts/generate_partition_textures.py` 실행
2. 이미지 → `front/public/world_partition/{group}/{partition}.png`
3. DB `texture_image_url` 자동 업데이트
4. 브라우저 `Ctrl+Shift+R` 강력 새로고침
5. 해당 파티션 위에 캐릭터가 있으면 자동 로드됨

---

*참고: UV 좌표 시스템은 `partition_texture_생성가이드.md` 참조*
