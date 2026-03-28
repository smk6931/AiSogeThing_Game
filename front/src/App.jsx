import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from '@contexts/AuthContext';
import { GameConfigProvider } from '@contexts/GameConfigContext';
import Login from '@screens/Login/Login';
import Signup from '@screens/Signup/Signup';

import GameEntry from './GameEntry';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app">
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
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
