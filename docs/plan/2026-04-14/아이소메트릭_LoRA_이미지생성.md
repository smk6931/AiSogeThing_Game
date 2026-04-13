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
- 8스텝 Lightning은 복잡한 구조물 디테일에서 뭉개짐
- 씬 전체의 광원/원근법 일관성 유지 불가

LoRA 추가 시:
- 아이소메트릭 구조 안정적으로 유지
- 게임에셋 스타일 윤곽선 강화
- 적은 스텝으로도 고퀄 가능

---

## 할 일 체크리스트

### Step 1 — LoRA 수집
- [ ] CivitAI에서 `isometric RPG` 키워드로 검색
- [ ] 추천 검색어: `isometric village`, `isometric game`, `RPG tileset LoRA`
- [ ] XL 계열 LoRA 우선 (DreamShaper XL 호환)
- [ ] SD1.5 LoRA는 rpg_v5.safetensors용으로 따로 구분
- [ ] `.safetensors` 파일 다운로드

### Step 2 — LoRA 설치
- [ ] `tools/ComfyUI/models/loras/` 폴더에 복사
- [ ] ComfyUI 재시작 없이 자동 인식 확인

### Step 3 — 워크플로우 수정
- [ ] `back/scripts/generate_partition_textures.py` LoRA 주입 파라미터 추가
  - `--lora` 파라미터 (파일명)
  - `--lora-strength` 파라미터 (기본 0.7~0.8)
- [ ] ComfyUI 워크플로우 JSON에 `LoraLoader` 노드 추가
  - CheckpointLoader → LoraLoader → CLIPTextEncode 순서

### Step 4 — 테스트 생성
- [ ] 레퍼런스 프롬프트로 1장 테스트
  ```
  isometric RPG village, medieval fantasy town, 
  thatched roof buildings, cobblestone paths, 
  lush greenery, warm lighting, game-ready asset,
  natural layout, organic placement, soft shadows
  ```
- [ ] LoRA strength 0.5 / 0.7 / 0.9 각각 비교
- [ ] `test/lora_compare/` 에 결과 저장

### Step 5 — 결과 적용
- [ ] 만족스러운 설정 `agents/game_design/local_image_generation.md` 에 추가
- [ ] `--style isometric` 프리셋으로 스크립트에 등록

---

## 참고 설정값 (예상)

```
CHECKPOINT  = dreamshaperXL_lightningDPMSDE.safetensors
LORA        = (다운받은 isometric LoRA 파일명)
LORA_STRENGTH = 0.75
STEPS       = 8~12
CFG         = 2.0~3.0
SAMPLER     = dpmpp_sde
SCHEDULER   = karras
SIZE        = 1024×1024 (출력 2048px)
```

---

## 주의사항

- LoRA는 반드시 XL 계열인지 확인 (SD1.5 LoRA는 XL 모델에 사용 불가)
- LoRA strength 너무 높으면 (0.9+) 스타일이 과하게 고정되어 다양성 잃음
- 아이소메트릭 씬은 top-down 90도가 아니므로 기존 바닥 텍스처 생성과 별도 파이프라인
- 건물/오브젝트 포함 씬이므로 `world_partition` DB 업데이트 불필요 — 배경 이미지 에셋용
