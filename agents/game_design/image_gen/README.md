# Title: Image Generation Experiment Index
Description: 이미지 생성 실험 결과 인덱스. 에이전트가 이미지 생성 전 가장 먼저 읽는 파일. 성공/중간/실패 폴더로 분기해서 필요한 케이스를 찾는다.
When-To-Read: 바닥 텍스처, 파티션 이미지, 게임 맵 이미지를 생성하기 전 항상 읽는다.
Keywords: comfyui, img2img, txt2img, lora, texture, ground, experiment, index
Priority: high

---

## 폴더 구조

```
image_gen/
  README.md         ← 지금 이 파일. 항상 여기서 시작
  success/          ← 검증 완료. 그대로 복사해서 써도 됨
  partial/          ← 조건부 사용. 주의사항 읽고 판단
  failure/          ← 재시도 금지. 왜 실패했는지만 읽는다
```

---

## 에이전트 사용 흐름

```
이미지 생성 요청 받음
  → 1. 이 README 읽기
  → 2. success/ 에 원하는 케이스 있으면 → 그대로 재사용
  → 3. 없으면 partial/ 확인 → 주의사항 만족하면 사용
  → 4. 새 실험 필요 → failure/ 읽고 같은 실수 피하기
  → 5. 실험 후 결과를 해당 폴더에 문서 추가
```

---

## 성공 목록 (success/)

| ID | 파일 | 방법 | 결과 | 용도 |
|----|------|------|------|------|
| S-01 | [pinterest_img2img_dungeon.md](success/S-01_pinterest_img2img_dungeon.md) | Pinterest 씬 → img2img | ★★★★★ | 게임 아트 던전/특수 바닥 |
| S-02 | [juggernaut_txt2img_pbr.md](success/S-02_juggernaut_txt2img_pbr.md) | txt2img seamless | ★★★★ | PBR 사실적 타일 텍스처 |
| S-03 | [S-03_themed_partition_img2img_G11_G4.md](success/S-03_themed_partition_img2img_G11_G4.md) | ref→img2img→파티션 매핑 | ★★★★★ | 테마별 파티션 일괄 생성 (G11 dark_marble 1024px / G4 emerald_arcane 2048px) |

---

## 중간 목록 (partial/)

| ID | 파일 | 방법 | 결과 | 주요 제약 |
|----|------|------|------|-----------|
| M-01 | [2.5d_tile_themed.md](partial/M-01_2.5d_tile_themed.md) | 2.5D tile txt2img | ★★★ | 오브젝트 간혹 섞임 |
| M-02 | [partition_clipping_2.5d.md](partial/M-02_partition_clipping_2.5d.md) | 폴리곤 클리핑 | ★★ | 경계 너덜, 조건 제한적 |

---

## 실패 목록 (failure/)

| ID | 파일 | 방법 | 실패 원인 요약 |
|----|------|------|--------------|
| F-01 | [jungle_roots_moss.md](failure/F-01_jungle_roots_moss.md) | 정글 txt2img | roots/moss 키워드 → 사이드뷰 생성 |
| F-02 | [polygon_clipping.md](failure/F-02_polygon_clipping.md) | 폴리곤 클리핑 | 경계선 너덜, 인접 파티션 단절 |
| F-03 | [satellite_img2img.md](failure/F-03_satellite_img2img.md) | 위성사진 img2img | 도시 구조가 정원 조감도로 재해석 |

---

## 파라미터 빠른 참조

| 용도 | 방법 | 모델 | LoRA | denoise | steps | 출력 |
|------|------|------|------|---------|-------|------|
| 게임 아트 특수 바닥 | img2img [S-01] | JugXL | zavy(0.6)+detail(0.5) | 0.85 | 28 | 1024px |
| 파티션 테마 (표준) | img2img [S-03] | JugXL | zavy(0.6)+detail(0.5) | 0.85 | 28 | 1024px |
| 파티션 테마 (고퀄) | img2img [S-03] `--hires` | JugXL | zavy(0.6)+detail(0.5) | 0.85 | 28 | **2048px** |
| 사실적 PBR 타일 | txt2img [S-02] | JugXL | 없음 | 1.0 | 22 | 2048px |
| 2.5D 테마 타일 | txt2img tile [M-01] | JugXL | zavy(0.7)+detail(0.6) | 1.0 | 30 | 1536px |

## LoRA 빠른 참조

| 파일 | 역할 | 권장 strength |
|------|------|--------------|
| `zavy-ctsmtrc-sdxl.safetensors` | isometric 게임 아트 구도 | 0.6~0.7 |
| `add-detail-xl.safetensors` | 텍스처 디테일/선명도 | 0.5~0.6 |
