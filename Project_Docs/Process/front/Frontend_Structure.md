# 프론트엔드 프로젝트 구조

## 📁 폴더 구조

```
fronted/
├── src/
│   ├── components/              # 재사용 가능한 컴포넌트
│   │   ├── common/             # 기본 UI 컴포넌트
│   │   │   ├── Button.jsx      # 버튼 컴포넌트 (variant, size 옵션)
│   │   │   ├── Button.css
│   │   │   ├── Card.jsx        # 카드 컴포넌트 (glassmorphism)
│   │   │   └── Card.css
│   │   ├── layout/             # 레이아웃 컴포넌트
│   │   │   ├── BottomNav.jsx   # 하단 네비게이션 바
│   │   │   └── BottomNav.css
│   │   └── shared/             # 도메인별 공유 컴포넌트
│   │       ├── MatchCard.jsx   # 매칭 카드 (프로필 + 매칭률)
│   │       └── MatchCard.css
│   ├── pages/                   # 페이지 컴포넌트
│   │   ├── Onboarding/         # 온보딩 페이지
│   │   │   ├── Onboarding.jsx
│   │   │   └── Onboarding.css
│   │   ├── Matching/           # 매칭 페이지 (홈)
│   │   │   ├── Matching.jsx
│   │   │   └── Matching.css
│   │   ├── Chat/               # 채팅 목록 페이지
│   │   │   ├── Chat.jsx
│   │   │   └── Chat.css
│   │   ├── Community/          # 커뮤니티 (게시판) 페이지
│   │   │   ├── Community.jsx
│   │   │   └── Community.css
│   │   ├── MyPage/             # 마이페이지 (프로필 + 피드)
│   │   │   ├── MyPage.jsx
│   │   │   └── MyPage.css
│   │   ├── Profile/            # 다른 유저 프로필 상세
│   │   └── Feed/               # 피드 상세 페이지
│   ├── styles/                  # 글로벌 스타일
│   ├── hooks/                   # 커스텀 훅 (추후 추가)
│   ├── utils/                   # 유틸리티 함수 (추후 추가)
│   ├── App.jsx                  # 메인 앱 + 라우팅
│   ├── App.css
│   ├── index.css                # 글로벌 CSS (디자인 시스템)
│   └── main.jsx                 # 진입점
├── public/                      # 정적 파일
├── package.json
└── vite.config.js
```

## 🎨 디자인 시스템

### 컬러 팔레트
- **Primary Gradient**: `#667eea` → `#764ba2` (보라색)
- **Secondary Gradient**: `#f093fb` → `#f5576c` (핑크색)
- **Background**: 다크 테마 (`#0f0f1e`, `#1a1a2e`)
- **Text**: 화이트 계열 (`#ffffff`, `#b4b4c8`)

### 컴포넌트 설계 원칙
1. **재사용성**: `components/common/` - 프로젝트 전역에서 사용
2. **도메인 분리**: `components/shared/` - 특정 도메인에서 공유
3. **페이지 독립성**: 각 `pages/` 폴더는 독립적인 기능 단위
4. **CSS 모듈화**: 각 컴포넌트마다 별도 CSS 파일

## 🧩 주요 컴포넌트

### 1. Button (공통)
```jsx
<Button variant="primary" size="medium" fullWidth icon={<Icon />}>
  텍스트
</Button>
```
- **Variants**: `primary`, `secondary`, `outline`, `ghost`
- **Sizes**: `small`, `medium`, `large`

### 2. Card (공통)
```jsx
<Card variant="glass" padding="medium" hover>
  {children}
</Card>
```
- **Variants**: `glass` (glassmorphism), `solid`, `gradient`

### 3. MatchCard (공유)
매칭 대시보드에서 사용하는 프로필 카드
- 프로필 사진, 이름, 나이
- 매칭 퍼센테이지 배지
- 관심사 태그
- "AI 분석 보기" 버튼

### 4. BottomNav (레이아웃)
하단 고정 네비게이션
- 홈, 매칭, 채팅, 커뮤니티, 마이페이지
- Active 상태 표시
- 모바일 최적화

## 📄 페이지 설명

| 페이지 | 경로 | 설명 |
|--------|------|------|
| **온보딩** | `/onboarding` | YouTube 연동 + 채팅 분석 |
| **매칭** | `/matching` | AI 추천 매칭 리스트 (홈) |
| **채팅** | `/chat` | 대화 목록 |
| **커뮤니티** | `/community` | 게시판 (연애 고민 공유) |
| **마이페이지** | `/mypage` | 프로필 + 인스타 스타일 피드 그리드 |

## 🔧 추가 예정 기능

### 1. Profile 페이지 (다른 유저 상세)
- AI 분석 리포트 표시
- 공통 유튜브 관심사
- 대화 스타일 분석 (레이더 차트)
- 공통 토픽 태그

### 2. Feed 상세 페이지
- 개별 피드 확대 보기
- 댓글, 좋아요 기능

### 3. 채팅 상세 페이지
- 실시간 메시징 (WebSocket)
- AI 추천 대화 주제

## 🚀 실행 방법

```bash
# 개발 서버 실행
cd fronted
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

## 📦 설치된 패키지

- `react` (v19.2.0) - UI 라이브러리
- `react-dom` - React DOM 렌더링
- `react-router-dom` - 클라이언트 사이드 라우팅
- `lucide-react` - 아이콘 라이브러리
- `vite` - 빌드 도구

## 🎯 다음 단계

1. ✅ 기본 페이지 구조 완성
2. ⏳ 백엔드 API 연동
3. ⏳ YouTube OAuth 구현
4. ⏳ RAG 기반 매칭 알고리즘 연동
5. ⏳ WebSocket 채팅 구현
6. ⏳ 반응형 디자인 개선
7. ⏳ 애니메이션 추가 (페이지 전환 등)
