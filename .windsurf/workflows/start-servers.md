---
description: Start both frontend and backend servers for AiSogeThing Game
---

# Start AiSogeThing Game Servers

## 1. Start Backend Server (Port 8100)
```bash
cd back
..\venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8100 --reload
```
The backend server will start on port 8100.

## 2. Start Frontend Development Server (Port 3100)
```bash
cd front
npm run dev -- --port 3100
```
The frontend server will start on port 3100.

## 3. Open Browser Preview
Once both servers are running, you can:
- Open browser preview for frontend: http://localhost:3100
- Backend API will be available at: http://localhost:8100

## Notes
- Backend serves game data and API endpoints
- Frontend connects to backend for data loading
- Make sure both servers are running for full functionality
