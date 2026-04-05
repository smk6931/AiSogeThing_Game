# Title: Editing Safety Rules
Description: 소스 파일 인코딩, 자동 재저장, 터미널 기반 편집 시 지켜야 할 안전 규칙을 정의한다.
When-To-Read: 파일 편집, 인코딩 수정, 대량 치환, PowerShell 기반 파일 재저장이 필요한 작업 전
Keywords: editing, encoding, utf-8, powershell, apply_patch, safety
Priority: high

## 기본 원칙

- 소스 파일 편집은 가능하면 `apply_patch`를 우선한다.
- 파일 전체를 셸 문자열로 읽고 다시 쓰는 방식은 피한다.
- UTF-8 텍스트 파일은 바이트 보존이 중요하므로 인코딩을 추정하는 도구 체인을 거치지 않는다.

## 금지 패턴

- `Get-Content ... | Set-Content ...`
- `Get-Content -Raw`로 읽은 뒤 전체 재저장
- `Out-File`, `>` 리다이렉션으로 소스 파일 덮어쓰기
- 이미 깨진 문자열을 다시 UTF-8로 저장하는 방식의 복구 시도

## 위험 이유

- PowerShell 문자열 파이프라인은 한글, 이모지, 특수문자를 잘못 해석할 수 있다.
- 한 번 잘못 해석된 문자열을 다시 저장하면 JSX, JSON, Python 소스가 문법적으로 깨질 수 있다.
- Windows 기본 인코딩과 툴별 인코딩 추정 차이 때문에 재현이 어렵고 원인 추적이 힘들다.

## 권장 방식

- 텍스트 소스 수정: `apply_patch`
- 단순 확인: `Get-Content`, `rg`, `git show`
- 인코딩 복구: 원본 소스에서 다시 가져오고, 필요한 수정만 최소 patch로 재적용

## 복구 원칙

- 인코딩이 깨진 파일은 우선 정상 원본과 diff를 비교한다.
- 원본 복구 후 필요한 변경만 다시 얹는다.
- 깨진 파일을 그대로 보존한 채 일괄 치환으로 복구하려 하지 않는다.
