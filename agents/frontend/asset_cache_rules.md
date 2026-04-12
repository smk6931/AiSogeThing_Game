# Title: Asset Cache Rules
Description: 브라우저 영구 에셋 캐시 전략 — Service Worker, 매니페스트 해시 비교, 자동 갱신 흐름 정의
When-To-Read: GLB 모델 추가, 파티션 텍스처 생성, 정적 이미지 변경, 캐시 무효화, 로딩 속도 개선 작업 시
Keywords: service-worker, cache, manifest, glb, texture, asset, preload, invalidation, performance
Priority: high

## 목적

- GLB 모델(2~10MB × 20종), 파티션 텍스처, 지형 이미지를 브라우저에 영구 저장
- 파일이 바뀐 경우에만 re-fetch → 바뀌지 않은 파일은 네트워크 요청 없이 즉시 반환
- 접속할 때마다 같은 파일을 내려받는 낭비 제거

## 구조

```
scripts/generate_manifest.py     ← 에셋 MD5 해시 계산 → asset_manifest.json 생성
front/public/asset_manifest.json ← 파일 경로 : 해시 8자리 목록
front/public/sw.js               ← Service Worker (Cache First + 해시 비교 갱신)
front/src/main.jsx               ← SW 등록 + 앱 시작 시 manifest CHECK_MANIFEST 전송
```

## 동작 흐름

```
앱 시작
  └─ main.jsx: SW 등록
  └─ /asset_manifest.json 네트워크에서 fetch (항상 최신)
  └─ SW에 CHECK_MANIFEST 메시지 전송
        └─ SW: 캐시된 manifest와 해시 비교
        └─ 해시 다른 파일만 re-fetch → Cache Storage 업데이트
        └─ 사라진 파일은 캐시에서 삭제

이후 에셋 요청
  └─ SW: Cache First → 캐시에 있으면 즉시 반환 (네트워크 0)
  └─ 캐시 없으면 네트워크 fetch → 저장
```

## 캐시 전략별 분류

| 대상 | 전략 | 이유 |
|------|------|------|
| GLB 모델, PNG 텍스처 | Cache First | 바이너리, 용량 크고 변경 드묾 |
| CartoCDN 지도 타일 | Cache First | 외부 API, 오프라인 지원 |
| /api/**, /ws/** | Network Only | 게임 상태는 항상 서버에서 |
| /asset_manifest.json | Network Only | 해시 비교용, 항상 최신 필요 |

## 에셋 변경 시 필수 절차

```bash
# 1. 텍스처 생성 또는 모델 추가 후
python scripts/generate_manifest.py

# 2. 커밋에 asset_manifest.json 포함
git add front/public/asset_manifest.json
git commit -m "update asset manifest"
```

manifest를 업데이트하지 않으면 클라이언트가 변경을 감지하지 못하고 구버전 캐시를 계속 사용한다.

## 스캔 대상 폴더 (`front/public/` 기준)

| 폴더 | 내용 |
|------|------|
| `models/` | GLB 몬스터, 플레이어 모델 |
| `ground/` | 바닥 텍스처 세트 |
| `road/` | 도로 텍스처 세트 |
| `world_partition/` | AI 생성 파티션 이미지 |
| `noise/` | 노이즈 텍스처 |
| `images/` | UI 이미지 |

캐시 대상 확장자: `.glb`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.hdr`

## Cache Storage vs localStorage

| | localStorage | Cache Storage (SW) |
|---|---|---|
| 용량 | 5~10MB | 수백MB (브라우저 디스크 여유 기준) |
| 저장 가능 타입 | 텍스트만 | 바이너리, 이미지, GLB 전부 |
| 영구성 | 브라우저 재시작 후 유지 | 브라우저 재시작 후 유지 |
| 만료 | 없음 (수동 삭제) | 없음 (SW 버전 업 시 old cache 삭제) |
| 적합한 용도 | GeoJSON, 설정값 | GLB, 텍스처, 지도 타일 |

→ GeoJSON (구/동 경계)는 기존 localStorage 유지  
→ GLB, 이미지, 텍스처는 모두 Service Worker Cache Storage 사용

## SW 버전 올리는 경우

`front/public/sw.js` 상단의 `CACHE_NAME = 'game-assets-v1'` 에서 버전 번호를 올린다.

올릴 때: activate 핸들러가 구버전 캐시를 자동 삭제함.

올리는 시점:
- SW 로직 자체가 바뀔 때
- 캐시 전략이 바뀔 때
- 전체 캐시 강제 초기화가 필요할 때

manifest 해시 변경만으로 개별 파일을 갱신하는 경우에는 버전을 올릴 필요 없다.

## 주의사항

- `front/public/sw.js` 는 반드시 `front/public/` 루트에 위치해야 scope가 `/` 전체를 커버한다.
- `/api/**` 요청은 SW가 가로채지 않는다. 게임 로직, WebSocket은 항상 서버에서 처리된다.
- 개발 중 캐시 때문에 변경이 안 보이면: 브라우저 DevTools → Application → Storage → Clear storage
