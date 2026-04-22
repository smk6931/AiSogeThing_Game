# Title: External Data Sources
Description: 이 프로젝트에서 실제로 사용한 외부 데이터·에셋·API 소스 목록. 필요할 때 여기서 먼저 찾는다.
When-To-Read: 텍스처·이미지·지도·지형·사운드·3D 에셋 등 외부 리소스가 필요할 때. 새 외부 소스를 추가하기 전에 여기 이미 있는지 확인.
Keywords: polyhaven, texture, api, external, asset, map, terrain, geojson, dem, satellite
Priority: high

---

## 텍스처 / 이미지 에셋

### Polyhaven
- **URL**: https://polyhaven.com/textures
- **API**: https://api.polyhaven.com/files/{slug}
- **라이선스**: CC0 (무료, 상업용 가능, 출처 표기 불필요)
- **용도**: 바닥 텍스처, 벽 텍스처, PBR 재질 (diffuse/normal/roughness)
- **다운로드 URL 구조**:
  ```
  https://dl.polyhaven.org/file/ph-assets/Textures/jpg/{resolution}/{slug}/{slug}_diff_{resolution}.jpg
  ```
- **API 사용법** (Python):
  ```python
  import urllib.request, json
  headers = {'User-Agent': 'Mozilla/5.0'}
  req = urllib.request.Request(f'https://api.polyhaven.com/files/{slug}', headers=headers)
  data = json.loads(urllib.request.urlopen(req).read())
  url = data['Diffuse']['2k']['jpg']['url']
  ```
- **목록 API**: `GET https://api.polyhaven.com/assets?t=textures` (User-Agent 필수)
- **검증된 slug 목록** (이 프로젝트에서 사용):

| slug | 용도 | landuse 적합 |
|------|------|-------------|
| `stony_dirt_path` | 돌+흙 섞인 길 | residential |
| `pebble_ground_01` | 작은 자갈 지면 | residential |
| `gravel_floor` | 자갈 바닥 | residential |
| `park_dirt` | 공원 흙 | residential |
| `dirt_floor` | 일반 흙 | residential |
| `gravel_concrete` | 콘크리트 자갈 | industrial |
| `dirty_concrete` | 낡은 콘크리트 | industrial |
| `rock_ground` | 바위 지면 | industrial |
| `forest_floor` | 숲 바닥 낙엽 | forest |
| `mud_forest` | 숲 진흙 | forest |
| `leaves_forest_ground` | 낙엽 지면 | forest |

- **주의**: API 직접 호출 시 `User-Agent` 헤더 없으면 403 반환

---

## 지도 / 지형 데이터

### 국토지리정보원 (NGII)
- **URL**: https://map.ngii.go.kr
- **용도**: DEM 5m 고도 데이터, 행정경계 GeoJSON
- **적용**: `elevation_m` 계산 → `world_partition` DB 저장 → 파티션 고도 렌더링

### OpenStreetMap (OSM)
- **URL**: https://www.openstreetmap.org
- **Overpass API**: https://overpass-api.de/api/interpreter
- **용도**: 도로망, 건물 footprint, landuse 데이터
- **적용**: `landuse_code`, `is_road` 등 파티션 속성 원본

---

## ComfyUI 모델 소스

### CivitAI
- **URL**: https://civitai.com/models
- **용도**: Stable Diffusion 체크포인트, LoRA 다운로드
- **적용 모델** (이 프로젝트 확정):
  - `juggernautXL_v10.safetensors` — 바닥 텍스처 PBR (기본)
  - `dreamshaperXL_lightningDPMSDE.safetensors` — 빠른 테스트용
  - `add-detail-xl.safetensors` — 디테일 강화 LoRA
  - `zavy-ctsmtrc-sdxl.safetensors` — isometric 구도 LoRA

---

## 새 소스 추가 규칙

새 외부 소스를 쓸 때:
1. 이 파일에 먼저 추가한다
2. 형식: 이름, URL, 라이선스, 용도, 실제 사용 예시
3. 검증된 slug/ID/엔드포인트만 기재 (미검증은 주석 처리)
4. `agents/README.md`는 이미 이 파일을 등록했으면 추가 수정 불필요
