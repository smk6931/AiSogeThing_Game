# Title: Ground Shader AO Normal Testing
Description: 바닥 텍스처 입체감 개선을 위한 GroundShaderMat (fBm noise + AO + Normal) 테스트 규칙. 아직 AO/Normal 연결 전이며, 확정 후 game_design/ 으로 이동 예정.
When-To-Read: 파티션 바닥 셰이더 수정, AO/Normal 맵 연결, gen_normal_ao.py 실행, GroundShaderMat 파라미터 조정 시.
Keywords: ground shader, fBm, noise, ao map, normal map, GroundShaderMat, meshBasicMaterial, partition texture, gen_normal_ao
Priority: medium

---

## 목적

`meshBasicMaterial`이 조명을 완전히 무시하기 때문에 AI 생성 텍스처가 완전히 평면으로 보이는 문제를 셰이더로 개선한다.
AO / Normal 맵 연결 완료 후 `agents/game_design/`으로 이동한다.

---

## 현재 상태

| 기법 | 상태 | 비고 |
|---|---|---|
| fBm world-space noise | ✅ 적용 중 | 타일링 패턴 깨짐, 미세 명암 변화 |
| AO 맵 | 스크립트 완료, 연결 대기 | `ao.png` 자동 추출 가능 |
| Normal 맵 | 스크립트 완료, 연결 대기 | `normal.png` 자동 추출 가능 |
| Parallax | 미착수 | 아이소메트릭 효과 중간 |
| SSAO | 미착수 | GPU 비용 높음, 나중에 검토 |

---

## GroundShaderMat 위치 및 구조

**파일**: `front/src/entity/world/CityBlockOverlay.jsx`

**적용 위치**: `[C]` 블록 — flat 파티션/존 바닥 렌더링

**유니폼**:
```js
uDiffuse       // 필수 — diffuse 텍스처
uAO            // 선택 — ao.png (없으면 스킵)
uNormal        // 선택 — normal.png (없으면 스킵)
uHasAO         // bool
uHasNormal     // bool
uAOStrength    // 0~1, 기본 0.7
uNoiseStrength // 0~1, 기본 0.55
uLightDir      // 고정 방향 (-0.6, 1.0, -0.8) normalized
```

**stencil / transparent / depthWrite** prop — meshBasicMaterial과 동일하게 전달 가능.

---

## AO / Normal 자동 추출

**스크립트**: `back/scripts/gen_normal_ao.py`

```bash
# 단일 파일
python back/scripts/gen_normal_ao.py front/public/ground/forest/image.png

# 강도 조절
python back/scripts/gen_normal_ao.py image.png --strength 5.0 --ao-radius 12
```

**출력**: `<same_dir>/normal.png` + `<same_dir>/ao.png`

**원리**:
- `normal.png`: diffuse grayscale → Sobel gradient → tangent-space normal map (RGB)
- `ao.png`: local brightness contrast (gaussian diff) → 오목한 어두운 영역 AO 감소

**파라미터 가이드**:
| 파라미터 | 기본값 | 효과 |
|---|---|---|
| `--strength` | 3.0 | 높을수록 normal 요철 강함 (5~8 권장 for 돌바닥) |
| `--ao-radius` | 8 | 높을수록 AO 영향 범위 넓음 (px 기준) |

---

## AO/Normal 셰이더 연결 (다음 단계)

현재 `GroundShaderMat`에 `aoMap` / `normalMap` prop이 있으나 텍스처 로드 로직이 연결 안 됨.

연결 방법:
1. 파티션 텍스처 URL에서 ao/normal URL 유추
   - `texture_image_url` → `<dir>/ao.png`, `<dir>/normal.png`
2. `THREE.TextureLoader`로 404-safe 로드 (기존 `loadTex` 패턴 재사용)
3. `GroundShaderMat`의 `aoMap` / `normalMap` prop에 전달

```js
// URL 유추 예시
const aoUrl = textureUrl.replace(/\/[^/]+$/, '/ao.png');
const normalUrl = textureUrl.replace(/\/[^/]+$/, '/normal.png');
```

---

## 주의사항

- `uLightDir`은 고정 방향 — 동적 조명 시스템 없음. 아이소메트릭 상단 좌측 기준.
- Normal map은 tangent-space 기준으로 추출해야 함. world-space로 추출하면 회전 시 틀어짐.
- `uNoiseStrength=0`으로 설정하면 노이즈 완전 비활성화 (기존 meshBasicMaterial과 동일).
- terrain 모드 블록도 같은 `GroundShaderMat`을 타므로, terrain 텍스처에도 동일하게 적용됨.
