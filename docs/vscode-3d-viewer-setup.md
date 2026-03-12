# VS Code/Windsurf 3D 모델 미리보기 설정

## 추천 Extension

### 1. glTF Tools (Microsoft 공식)
- **Extension ID**: `ms-vscode.vscode-json`
- **검색**: `glTF Tools`
- **기능**: 
  - .glb/.gltf 파일 미리보기
  - 3D 뷰어 내장
  - 모델 정보 표시
  - 애니메이션 재생

### 2. 3D Viewer
- **Extension ID**: `slevesque.vscode-3dviewer`
- **검색**: `3D Viewer`
- **기능**:
  - 다양한 3D 포맷 지원
  - 회전/확대 컨트롤
  - 와이어프레임 모드

## 설치 방법

### 1. Extensions 탭 열기
- 단축키: `Ctrl+Shift+X`
- 또는 사이드바에서 확장 아이콘 클릭

### 2. Extension 검색 및 설치
1. 검색창에 `glTF Tools` 입력
2. Microsoft 공식 Extension 선택
3. `Install` 버튼 클릭

### 3. 재시작
- VS Code/Windsurf 재시작

## 사용 방법

### 파일 미리보기
1. `.glb` 파일 더블클릭
2. 자동으로 3D 뷰어 열림
3. 마우스로 회전/확대 가능

### 탭 그룹으로 보기
1. 파일 우클릭 → `Open to the Side`
2. 코드 + 3D 뷰어 동시 확인

## 추가 설정

### 기본 뷰어 설정
```json
// settings.json
{
    "gltf.preview.background": "#ffffff",
    "gltf.preview.showGrid": true,
    "gltf.preview.autoPlay": false
}
```

### 파일 연결 설정
```json
// settings.json
{
    "files.associations": {
        "*.glb": "gltf"
    }
}
```
