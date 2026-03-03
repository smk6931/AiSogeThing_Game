---
name: 오류 처리 및 안전한 코드 작성
description: safe_ops.py를 활용한 표준화된 예외 처리 및 JSON 안전 입출력 규칙입니다.
---

# 오류 처리 및 안전한 코드 작성

프로젝트 전체의 안정성을 높이기 위해 `back/utils/safe_ops.py` 사용을 강제합니다.

## 1. JSON 안전 입출력
- **파일 읽기**: `load_json_safe(path, default={})`
- **파일 쓰기**: `save_json_safe(path, data)` (디렉토리 자동 생성)
- **추가**: `append_json_line(path, data)` (로그용)

## 2. 예외 처리 데코레이터
- **FastAPI Router (Async)**: `@handle_exceptions(default_message="메시지")`
- **일반 함수 (Sync)**: `@handle_sync_exceptions(default_message="메시지")`

## 3. 컨텍스트 매니저
- 특정 블록의 에러를 방어할 때 사용:
  ```python
  with safe_execute("작업명"):
      # 위험한 로직
  ```

## 4. 금지 사항
- 원시 `try-except` 블록 사용 지양 (반드시 위 유틸리티를 우선 검토).
- 에러 발생 시 단순 무시 금지 (최소한 로깅 및 유저 알람 처리).
