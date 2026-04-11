# Partition Texture 생성 가이드

> 이 문서는 `world_partition`의 텍스처 이미지를 생성하고 게임에 입히는 전 과정을 설명한다.
> 실험 결과와 해결한 버그를 포함하며, 앞으로 텍스처를 추가할 때마다 기준 문서로 사용한다.

---

## 1. 개요

각 `world_partition`(파티션)은 서울 지리 데이터 기반 polygon으로 정의된 구역이다.
이 polygon 안에 RPG 게임 텍스처를 AI로 생성해서 입히는 것이 목표다.

파이프라인:
```
DB boundary_geojson
    → Polygon mask 생성 (PIL)
    → ComfyUI inpainting (AI 이미지 생성, polygon 안만 채움)
    → 결과 PNG 저장 (front/public/world_partition/)
    → DB texture_image_url 업데이트
    → Three.js UV 매핑으로 게임 렌더링
```

---

## 2. 파일 위치

| 항목 | 경로 |
|------|------|
| 생성 스크립트 | `back/scripts/generate_partition_textures.py` |
| 출력 이미지 | `front/public/world_partition/{group_short}/{partition_short}.png` |
| Three.js 렌더러 | `front/src/entity/world/CityBlockOverlay.jsx` |

이미지 명명 규칙: `seoul.dongjak.noryangjin2.primary.p024` → `noryangjin2_p024.png`

---

## 3. UV 좌표계 — 가장 중요한 규칙

### 핵심 공식

```python
# create_mask() / draw_polygon_outline() 내부 to_px()
def to_px(lng, lat):
    x = (lng - min_lng) / span_lng * width
    y = (lat - min_lat) / span_lat * height   # ← 반전(1.0 -) 없음
    return (x, y)
```

**북쪽(lat 큰 값) = 이미지 하단(큰 y)** 이 맞다.

### 왜 이렇게 되는가

Three.js 게임 좌표계 (`CityBlockOverlay.jsx` line 22):

```js
const gpsToGame = (lat, lng) => ({
  x: (lng - GIS_ORIGIN.lng) * LNG_TO_M,
  z: (GIS_ORIGIN.lat - lat) * LAT_TO_M,  // 북쪽 lat → 작은 z
});
```

UV 계산 (`buildTerrainBlock`, fitUV=true):

```js
uvs[ui++] = (p.x - minX) / spanX;   // u
uvs[ui++] = (p.z - minZ) / spanZ;   // v
```

lat가 클수록 z가 작으므로:

```
v = (z - minZ) / spanZ
  = (maxLat - lat) / spanLat
  = 1 - (lat - minLat) / spanLat
```

Three.js `flipY=true` (기본값)에서 GPU 샘플링:

```
image_y = (1 - v) * height
        = (lat - minLat) / spanLat * height
```

결론: **이미지의 y픽셀은 lat 값과 비례해야 한다. 반전 없음.**

### 틀린 공식 (사용 금지)

```python
y = (1.0 - (lat - min_lat) / span_lat) * height   # ← 틀림, 상하 반전됨
```

---

## 4. 이미지 해상도 계산

```python
METERS_PER_PIXEL = 0.5   # 1px = 0.5m (실제 스케일)
LAT_TO_M = 110940
LNG_TO_M = 88200

def compute_image_size(span_lng, span_lat):
    raw_w = span_lng * LNG_TO_M / METERS_PER_PIXEL
    raw_h = span_lat * LAT_TO_M / METERS_PER_PIXEL
    # MAX 1536×1536 클램프, 64 배수 맞춤 (SDXL 요구사항)
    ...
    return w, h
```

이 스케일에서 건물 1개는 약 10~20px — 게임 내 건물과 스케일이 자연스럽게 맞는다.

---

## 5. ComfyUI Inpainting

### 방식

`SetLatentNoiseMask` 노드를 사용한 inpainting:
- 흰색(255) = AI가 생성할 영역 (polygon 내부)
- 검은색(0) = 생성 안 함 (polygon 외부)

polygon 경계는 `MASK_FEATHER=12px` Gaussian blur로 자연스럽게 블렌딩.

### Workflow 노드 구성

```
CheckpointLoaderSimple (SDXL)
    → CLIPTextEncode (positive/negative)
    → EmptyLatentImage (width×height)
    
LoadImage (mask PNG)
    → ImageToMask (red channel)
    → SetLatentNoiseMask (latent + mask)

KSampler (steps=30, cfg=5.0, euler/karras)
    → VAEDecode
    → SaveImage
```

### 프롬프트 구조

```python
STYLE_PREFIX = (
    "top-down bird's eye view RPG ground texture, "
    "directly overhead 90 degrees, flat ground surface, ..."
)

positive = STYLE_PREFIX + area_prompt + group_prompt + persona_hint + scale_hint
```

`scale_hint` 예시: `"area 174m x 177m, each building 10-20m wide"`

---

## 6. Polygon Outline (검증용)

생성된 이미지 위에 polygon 경계선을 하늘색으로 덧그려 UV 정렬 확인:

```python
draw_polygon_outline(out_path, boundaries, bbox, color=(0, 230, 180), thickness=4)
```

게임의 회색 partition 경계선과 하늘색 텍스처 outline이 일치하면 UV가 올바른 것.

---

## 7. 스크립트 실행 방법

```bash
# 활성화
source venv/Scripts/activate

# 특정 파티션 생성 (outline 포함)
python back/scripts/generate_partition_textures.py \
    --partition-keys seoul.dongjak.noryangjin2.primary.p024 \
    --outline

# group 내 전체 파티션 개별 생성
python back/scripts/generate_partition_textures.py \
    --group-key seoul.dongjak.noryangjin2.group.g04 \
    --per-partition \
    --outline

# 기존 이미지에 outline만 다시 그리기
python back/scripts/generate_partition_textures.py \
    --group-key seoul.dongjak.noryangjin2.group.g04 \
    --outline-only

# 이미지 전부 지우고 outline만 있는 빈 이미지 생성 (UV 검증용)
python back/scripts/generate_partition_textures.py \
    --group-key seoul.dongjak.noryangjin2.group.g04 \
    --outline-only --blank
```

---

## 8. DB 연결

생성 성공 시 `world_partition.texture_image_url` 자동 업데이트:

```sql
UPDATE world_partition SET texture_image_url = '/world_partition/noryangjin2_g04/noryangjin2_p024.png'
WHERE id = :id;
```

---

## 9. Three.js 렌더링 구조

### 텍스처 선택 로직

- **고유 URL** (파티션별 개별 이미지): `uvBounds = null` → polygon 자체 bbox로 UV 계산
- **공유 URL** (group 전체 1장): `uvBounds = groupUvBounds` → group bbox로 UV 계산

```js
const isSharedGroupImage = urlCount.get(partition.texture_image_url) > 1;
const uvBounds = isSharedGroupImage ? groupUvBounds : null;
```

현재 `--per-partition` 모드로 생성하면 파티션마다 고유 URL → 개별 bbox UV 사용.

### 재질 설정

```jsx
<meshBasicMaterial
  map={texture}
  transparent={true}
  alphaTest={0.1}   // polygon 외부 투명 처리
  stencilFunc={THREE.EqualStencilFunc}   // 동 마스크 내부만 렌더
/>
```

---

## 10. 문제 해결 이력

| 날짜 | 증상 | 원인 | 해결 |
|------|------|------|------|
| 2026-04-11 | polygon outline이 상하 반전 | `to_px` y에 잘못된 `1.0 -` 반전 적용 | 반전 제거, 원래 공식 복원 |
| 2026-04-11 | asyncio 두 번 호출 오류 | `asyncio.run()` 중복 호출 | `async def main()` 단일 진입점으로 통합 |
| 2026-04-11 | torch import 오류 오탐 | system Python(3.13)으로 확인 (venv 아님) | venv Python으로 재확인, 문제 없음 |

---

*이 문서는 partition texture 작업 진행에 따라 계속 업데이트한다.*
