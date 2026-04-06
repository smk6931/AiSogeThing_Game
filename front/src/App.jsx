import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AuthProvider } from '@contexts/AuthContext';
import { GameConfigProvider } from '@contexts/GameConfigContext';
import './App.css';

const Login = lazy(() => import('@screens/Login/Login'));
const Signup = lazy(() => import('@screens/Signup/Signup'));
const GameEntry = lazy(() => import('./GameEntry'));

function AppFrame() {
  const location = useLocation();
  const isGameRoute = location.pathname === '/game';
  const appClassName = isGameRoute ? 'app app-game' : 'app app-auth';

  return (
    <div className={appClassName}>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/game"
            element={(
              <GameConfigProvider>
                <GameEntry />
              </GameConfigProvider>
            )}
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppFrame />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
