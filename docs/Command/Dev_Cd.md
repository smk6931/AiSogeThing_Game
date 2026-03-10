================================================================================
                                개발 명령어 모음집
================================================================================

[ 가상환경 (Virtual Environment) ]
--------------------------------------------------------------------------------
1. 생성 (Windows)
   python -m venv venv

2. 활성화 (Windows Powershell)
   .\venv\Scripts\activate

3. 비활성화
   deactivate


[ 패키지 관리 (Pip) ]
--------------------------------------------------------------------------------
1. 패키지 설치
   pip install [패키지명]

2. 현재 패키지 목록 저장 (requirements.txt 생성)
   pip freeze > requirements.txt

3. requirements.txt로 한방에 설치
   pip install -r requirements.txt

4. react module 설치
   npm install


[ 로컬 서버 실행 (Server Run) ]
--------------------------------------------------------------------------------

1. Python 가상환경 활성화
   .\venv\Scripts\activate

2. Next.js (Frontend)
   cd front; npm run dev

3. FastAPI (Uvicorn)
   .\venv\Scripts\activate; python -m uvicorn main:app --reload --port 8000

[ Git (자주 쓰는 명령어) ]
--------------------------------------------------------------------------------
1. 상태 확인
   git status

2. 모든 변경사항 스테이징
   git add .

3. 커밋
   git commit -m "메시지 내용"

4. 푸시
   git push origin main


[ Docker (컨테이너) ]
--------------------------------------------------------------------------------
1. 컨테이너 실행 (빌드 포함)
   docker-compose up --build

2. 컨테이너 중지
   docker-compose down


[ React (Frontend) 설치 및 실행 ]
--------------------------------------------------------------------------------
* 주의: React는 Python 가상환경(venv)이 아닌, Node.js 환경에서 별도로 설치됩니다.

1. 프로젝트 생성 (Vite 사용)
   npx create-vite@latest frontend --template react

2. 의존성 설치
   cd frontend
   npm install

3. 개발 서버 실행
   npm run dev

