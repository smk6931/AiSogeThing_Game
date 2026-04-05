import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from '@contexts/AuthContext';
import { GameConfigProvider } from '@contexts/GameConfigContext';
import './App.css';

const Login = lazy(() => import('@screens/Login/Login'));
const Signup = lazy(() => import('@screens/Signup/Signup'));
const GameEntry = lazy(() => import('./GameEntry'));

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app">
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
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
