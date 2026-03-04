import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@contexts/AuthContext';
import { GameConfigProvider } from '@contexts/GameConfigContext';

import Login from '@screens/Login/Login';

import GameEntry from './GameEntry';

import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app">
          <Routes>
            {/* 기본 진입점: 로그인 */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* 인증 관련 */}
            <Route path="/login" element={<Login />} />

            {/* 메인 게임 */}
            <Route path="/game" element={
              <GameConfigProvider>
                <GameEntry />
              </GameConfigProvider>
            } />



            {/* 없는 경로는 모두 로그인 리다이렉트 */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
