import React from 'react';
import GameEntry from '../game/GameEntry';
import EditorOverlay from './EditorOverlay';
import { GameConfigProvider } from './GameConfigContext';

// 에디터 모드의 Entry 파일입니다.
// 기존 GameEntry 렌더링에 필요한 모든 기능을 유지한 채, 에디터 UI 조작 계층을 하나 덮어씌웁니다.
const GameEditEntry = () => {
  return (
    <GameConfigProvider>
      <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
        {/* 실제 게임 렌더링 창 */}
        <GameEntry isEditorMode={true} />

        {/* 우측 상단이나 좌측에 뜰 에디터 조작 UI */}
        <EditorOverlay />
      </div>
    </GameConfigProvider>
  );
};

export default GameEditEntry;
