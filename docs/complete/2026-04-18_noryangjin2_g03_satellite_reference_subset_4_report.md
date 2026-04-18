# 2026-04-18 noryangjin2 g03 satellite reference subset 4 report

## 개요

- 대상 group: `seoul.dongjak.noryangjin2.group.g03`
- 목적: g03 전체 17개 대신 서로 가까운 4개 partition만 먼저 위성 reference 생성
- 실행 스크립트: `back/scripts/fetch_partition_satellite_reference.py`
- 실행 일시: `2026-04-18`

## 선정한 4개 partition

- `seoul..2.v2.0029`
- `seoul..2.v2.0033`
- `seoul..2.v2.0034`
- `seoul..2.v2.0035`

선정 이유:
- g03 중심부에서 서로 가까운 묶음이다.
- `0034`, `0035`를 기준으로 인접한 주거 partition이어서 마스크 정합성과 경계 연결감을 보기 좋다.
- 전체를 한 번에 돌리기 전에 bbox, 위성 타일 stitching, polygon mask 결과를 빠르게 검증하기 مناسب한 크기다.

## 실행 명령

```powershell
venv\Scripts\python.exe back/scripts/fetch_partition_satellite_reference.py --partition-keys seoul..2.v2.0029 seoul..2.v2.0033 seoul..2.v2.0034 seoul..2.v2.0035 --force
```

## 실행 결과

- 4개 partition 모두 성공
- Esri World Imagery 타일 fetch 성공
- bbox 기준 raw satellite image 저장 성공
- polygon mask 적용한 satellite reference 저장 성공
- 메타 json 저장 성공

## 산출물

경로: `back/cache/partition_ref/noryangjin2_g03/`

- `2_0029_satellite_raw.png`
- `2_0029_satellite.png`
- `2_0029_satellite_meta.json`
- `2_0033_satellite_raw.png`
- `2_0033_satellite.png`
- `2_0033_satellite_meta.json`
- `2_0034_satellite_raw.png`
- `2_0034_satellite.png`
- `2_0034_satellite_meta.json`
- `2_0035_satellite_raw.png`
- `2_0035_satellite.png`
- `2_0035_satellite_meta.json`

## partition별 출력 크기

- `0029`: `576x448`
- `0033`: `640x384`
- `0034`: `896x320`
- `0035`: `640x384`

## 관찰 포인트

- 현재 단계는 reference 생성만 완료된 상태다.
- 아직 ComfyUI `img2img`로 넘기지 않았고, front `texture_image_url`에도 연결하지 않았다.
- 파일명 prefix가 `2_0035`처럼 보이는 이유는 현재 `short_name()`이 `seoul..2.v2.0035`에서 `parts[2] + '_' + parts[4]`를 사용하기 때문이다.

## 다음 단계

1. 생성된 `*_satellite.png` 4장을 육안으로 비교해 mask 경계와 주변 black outside 처리가 자연스러운지 확인한다.
2. 괜찮으면 같은 4개를 ComfyUI `img2img` 입력으로 사용한다.
3. 결과가 좋으면 g03 나머지 partition으로 범위를 넓힌다.
