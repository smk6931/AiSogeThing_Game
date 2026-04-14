# LoRA 활용 고퀄 이미지 생성 계획

> 작성: 2026-04-14  
> 목적: 퀄리티 LoRA + 아이소메트릭 LoRA 추가로 전반적 생성 퀄리티 향상  
> 모델: DreamShaper XL Lightning + Quality LoRA + Isometric RPG LoRA

---

## 목표 이미지 스타일

- 아이소메트릭 45도 사선뷰
- 건물 구조가 일관된 3D 느낌
- 지붕, 벽, 그림자 광원 통일
- 픽셀/게임에셋 특유의 깔끔한 윤곽선
- 레퍼런스: tools/ComfyUI/output/partition_tex_00003_.png (마을 씬)

---

## 왜 LoRA가 필요한가

DreamShaper XL Lightning 단독으로는:
- 아이소메트릭 건물 구조가 뒤틀리거나 비율 틀어짐
- 8스텝 Lightning은 디테일이 뭉개짐
- 씬 전체의 광원/원근법 일관성 유지 불가

LoRA 추가 시:
- 아이소메트릭 구조 안정적으로 유지
- 8스텝에서도 20~30스텝 수준 디테일 가능
- 게임에셋 특유의 윤곽선·텍스처 느낌 강화

---

## LoRA 종류 및 용도

### A. 퀄리티 LoRA (바닥 텍스처 + 전체 생성에 바로 적용 가능)

| LoRA | CivitAI 검색어 | 효과 | strength 권장 |
|------|--------------|------|--------------|
| **DetailTweaker XL** | `detail tweaker xl` | 전체 선명도·디테일 향상, 8스텝 보완 | 0.5~0.8 |
| **Add More Details XL** | `add detail xl` | 텍스처 세밀도 강화 | 0.5~0.7 |
| **Game Texture LoRA** | `game texture seamless` | 타일링 텍스처 특화, 경계 자연스럽게 | 0.6~0.8 |
| **Top-down RPG Map** | `top down rpg map` | 오버헤드 뷰 지형 일관성 | 0.6~0.8 |

### B. 스타일 LoRA (아이소메트릭 씬 전용)

| LoRA | CivitAI 검색어 | 효과 | strength 권장 |
|------|--------------|------|--------------|
| **Isometric RPG** | `isometric rpg village xl` | 아이소메트릭 구조 고정 | 0.7~0.9 |
| **Isometric Game Asset** | `isometric game asset` | 건물·오브젝트 게임에셋 스타일 | 0.7~0.8 |

> **주의**: 반드시 **XL 계열** LoRA 다운로드 (SD1.5 LoRA는 DreamShaper XL과 호환 불가)

---

## 할 일 체크리스트

### Step 1 — LoRA 수집 (CivitAI)
- [ ] **퀄리티 LoRA** (우선순위 높음 — 바닥 텍스처에 바로 적용)
  - [ ] `DetailTweaker XL` 검색 → XL 버전 다운
  - [ ] `game texture seamless XL` 검색 → XL 버전 다운
- [ ] **아이소메트릭 LoRA**
  - [ ] `isometric rpg village xl` 검색 → XL 버전 다운
  - [ ] `isometric game asset xl` 검색 → XL 버전 다운
- [ ] 다운받을 때 모델 페이지에서 **Base Model: SDXL** 확인 필수

### Step 2 — LoRA 설치
- [ ] `tools/ComfyUI/models/loras/` 폴더에 복사
- [ ] ComfyUI 재시작 없이 자동 인식 확인

### Step 3 — 스크립트 LoRA 지원 추가
- [ ] `back/scripts/generate_partition_textures.py` 수정
  - `--lora` 파라미터 추가 (파일명, 여러 개 가능)
  - `--lora-strength` 파라미터 추가 (기본 0.75)
- [ ] ComfyUI 워크플로우 JSON에 `LoraLoader` 노드 추가
  ```
  CheckpointLoaderSimple → LoraLoader → KSampler
                                      ↘ CLIPTextEncode
  ```

### Step 4 — 퀄리티 LoRA 테스트 (바닥 텍스처)
- [ ] DetailTweaker 없이 vs 있을 때 비교 (strength 0.5 / 0.7)
- [ ] 기존 theme 프롬프트 (grass, stone, ice) + LoRA 조합
- [ ] `test/lora_compare/quality/` 에 저장

### Step 5 — 아이소메트릭 LoRA 테스트
- [ ] 레퍼런스 프롬프트로 테스트
  ```
  isometric RPG village, medieval fantasy town,
  thatched roof buildings, cobblestone paths,
  lush greenery, warm lighting, game-ready asset,
  natural layout, organic placement, soft shadows
  ```
- [ ] LoRA strength 0.5 / 0.7 / 0.9 비교
- [ ] `test/lora_compare/isometric/` 에 저장

### Step 6 — 결과 적용
- [ ] 퀄리티 LoRA 설정 → 기존 바닥 텍스처 생성 기본값에 추가
- [ ] `agents/game_design/local_image_generation.md` 업데이트
- [ ] `--style isometric` 프리셋 스크립트에 등록

---

## 참고 설정값 (예상)

### 바닥 텍스처용 (퀄리티 LoRA)
```
CHECKPOINT    = dreamshaperXL_lightningDPMSDE.safetensors
LORA          = DetailTweaker_XL.safetensors
LORA_STRENGTH = 0.7
STEPS         = 8
CFG           = 1.8
SAMPLER       = dpmpp_sde
SCHEDULER     = karras
SIZE          = 1024×1024 (출력 2048px)
```

### 아이소메트릭 씬용
```
CHECKPOINT    = dreamshaperXL_lightningDPMSDE.safetensors
LORA_1        = DetailTweaker_XL.safetensors   (strength 0.5)
LORA_2        = isometric_rpg_xl.safetensors   (strength 0.8)
STEPS         = 10~12
CFG           = 2.5~3.0
SAMPLER       = dpmpp_sde
SCHEDULER     = karras
SIZE          = 1024×1024 (출력 2048px)
```

---

## 주의사항

- LoRA는 반드시 XL 계열인지 확인 (SD1.5 LoRA는 XL 모델에 사용 불가)
- LoRA strength 너무 높으면 (0.9+) 스타일이 과하게 고정되어 다양성 잃음
- 아이소메트릭 씬은 top-down 90도가 아니므로 기존 바닥 텍스처 생성과 별도 파이프라인
- 건물/오브젝트 포함 씬이므로 `world_partition` DB 업데이트 불필요 — 배경 이미지 에셋용
