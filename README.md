# 💘 AiSogeThing (Project AST)

> **AI 기반 매칭 및 유튜브 콘텐츠 큐레이션 플랫폼**  
> *AI-Powered Dating & Content Curation Platform*

---

> ### 🚧 Work In Progress (현재 개발 진행 중)
> **이 프로젝트는 현재 활발히 개발 및 기능 고도화가 진행 중인 상태입니다.**  
> (This project is currently under active development.)
>
> *   실시간으로 코드가 업데이트되므로, 간헐적인 서비스 불안정이 발생할 수 있습니다.
> *   매일 새로운 기능이 추가되고 있으며, 상세한 개발 과정은 [Daily Log](./Project_Docs/Daily_Log)에서 확인하실 수 있습니다.

---

## 🌐 Live Service
**👉 [https://sogething.com](https://sogething.com) (실시간 배포 서버)**  
*(개발 중인 버전이 실시간으로 반영됩니다.)*

---

## 📅 Real-time Development Log (개발 일지)
**"완성된 결과물보다 성장하는 과정에 집중합니다."**  
개발자의 매일매일의 고민과 트러블 슈팅 과정이 궁금하다면 아래 문서를 참고해주세요.

*   📂 **[Project_Docs/Daily_Log](./Project_Docs/Daily_Log)**: 일별 상세 개발 로그 (Error Log, Idea)
*   📂 **[Project_Docs/Process](./Project_Docs/Process)**: 인프라 구축, 도메인 연결, 아키텍처 설계 문서

**[Recent Milestones]**
*   ✅ **Infrastructure**: Oracle Cloud 서버 구축 & 도메인(`sogething.com`) 연결 완료
*   ✅ **Security**: Nginx 리버스 프록시 및 Lets Encrypt HTTPS(SSL) 보안 적용
*   ✅ **Feature**: YouTube "RSS Seed & Harvest" 알고리즘을 통한 저비용 고효율 큐레이션 구현
*   ✅ **UI/UX**: Mobile-First 기반 반응형 웹 디자인 적용 중

---

## 🛠 Tech Stack

### Infrastructure
![Oracle Cloud](https://img.shields.io/badge/Oracle_Cloud-F80000?style=for-the-badge&logo=oracle&logoColor=white) 
![Nginx](https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white)
![Ubuntu](https://img.shields.io/badge/Ubuntu-E95420?style=for-the-badge&logo=ubuntu&logoColor=white)

### Frontend
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Axios](https://img.shields.io/badge/Axios-5A29E4?style=for-the-badge&logo=axios&logoColor=white)

### Backend
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![YouTube API](https://img.shields.io/badge/YouTube_API-FF0000?style=for-the-badge&logo=youtube&logoColor=white)

---

## 📂 Project Structure (Docs)
프로젝트의 모든 기획과 기술적 의사결정은 `Project_Docs` 폴더에 문서화되어 있습니다.

```bash
AiSogeThing/
├── Project_Docs/
│   ├── Daily_Log/       # 매일의 개발 기록 (Development Journal)
│   ├── Idea/            # 핵심 기능 기획 (Feature Ideas)
│   ├── Process/         # 기술 구현 가이드 (Implementation Guide)
│   └── SQL/             # DB 스키마 (Database Schema)
├── back/                # FastAPI Backend Server
└── front/               # React Frontend Client
```