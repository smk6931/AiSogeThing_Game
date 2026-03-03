import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import GameEntry from './apps/game/GameEntry';
import { AuthProvider } from '@shared/context/AuthContext';
import { GameConfigProvider } from './apps/gameEdit/GameConfigContext';
import GameEditEntry from './apps/gameEdit/GameEditEntry';
import BottomNav from './apps/content/components/layout/BottomNav';
import UserStatus from './apps/content/components/layout/UserStatus';
import Home from './apps/content/pages/Home/Home'; // 추가
import Onboarding from './apps/content/pages/Onboarding/Onboarding';
import Matching from './apps/content/pages/Matching/Matching';
import Chat from './apps/content/pages/Chat/Chat';
import Community from './apps/content/pages/Community/Community';
import MyPage from './apps/content/pages/MyPage/MyPage';
import Login from './apps/auth/pages/Login/Login';
import PlatformEntry from './apps/auth/pages/Entry/PlatformEntry';
import HotPlace from './apps/content/pages/HotPlace/HotPlace';
import YoutubeBoard from './apps/content/pages/Youtube/YoutubeBoardNew';
import NovelCreate from './apps/content/pages/Novel/NovelCreate';
import NovelView from './apps/content/pages/Novel/NovelView';
import NovelList from './apps/content/pages/Novel/NovelList';
import NovelPortfolio from './apps/content/pages/Novel/NovelPortfolio';
import './App.css';

// 메인 앱 레이아웃 (UserStatus + BottomNav 포함)
function AppLayout() {
  return (
    <>
      <UserStatus />
      <div style={{ paddingTop: '60px', paddingBottom: '70px' }}>
        <Outlet />
      </div>
      <BottomNav />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app">
          <Routes>
            {/* 로그인 & 온보딩 (레이아웃 없음) */}
            <Route path="/login" element={<Login />} />
            <Route path="/entry" element={<PlatformEntry />} />
            <Route path="/onboarding" element={<Onboarding />} />

            {/* 3D 게임 실 서비스 환경 (독립) */}
            <Route path="/game" element={
              <GameConfigProvider>
                <GameEntry />
              </GameConfigProvider>
            } />

            {/* 3D 게임 에디터 모드 (HDRI 등 에셋 설정용 UI) */}
            <Route path="/gameEdit" element={<GameEditEntry />} />

            {/* 메인 앱 (UserStatus + BottomNav) */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/entry" replace />} />
              <Route path="/home" element={<Home />} />
              <Route path="/hotplace" element={<HotPlace />} />
              <Route path="/youtube" element={<YoutubeBoard />} />
              <Route path="/matching" element={<Matching />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/community" element={<Community />} />
              <Route path="/mypage" element={<MyPage />} />

              {/* Novel Routes */}
              <Route path="/novel" element={<NovelList />} />
              <Route path="/novel/create" element={<NovelCreate />} />
              <Route path="/novel/portfolio" element={<NovelPortfolio />} />
              <Route path="/novel/:id" element={<NovelView />} />
            </Route>
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
