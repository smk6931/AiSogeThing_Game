# ComfyUI GPU 화면 깨짐 이슈

## 증상
- ComfyUI 실행 시 화면에 핑크 노이즈 + 화면 분열 + 이중 복사 현상
- 전형적인 GPU TDR (Timeout Detection & Recovery) 증상

## 원인
GPU에 부하가 갑자기 크게 걸리면 → 드라이버가 "응답 없음" 판단 → 드라이버 재시작 → 화면 깨짐

### 하드웨어 기준 (RTX 4060 Laptop 8GB)

| 파이프라인 | VRAM | 위험도 |
|-----------|------|--------|
| Juggernaut XL + 4xUltrasharp → 2048px | ~6GB | 안전 |
| + UltimateSDUpscale → 4096px | ~7GB | 주의 |
| Flux.1 schnell fp8 → 2048px | ~8GB (빠듯) | 위험 ← TDR 발생 가능 |

## 해결책

### 1. ComfyUI 실행 옵션 (가장 쉬움)
```bash
python main.py --lowvram
# 또는
python main.py --medvram
```

### 2. 모델 정밀도 낮추기
- Flux.1 fp8 → gguf 모델로 교체하면 VRAM 사용량 감소

### 3. 발열 관리
- 쿨러 패드 사용
- Predator Sense에서 팬 최대로 설정

### 4. Windows TDR 시간 늘리기 (레지스트리)
```
HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\GraphicsDrivers
TdrDelay = 8  (기본 2초 → 8초)
```

## 결론
Flux.1 fp8 돌릴 때 VRAM 8GB 꽉 차면 TDR 발생.
`--lowvram` 옵션 추가하거나 gguf 모델로 교체 권장.
