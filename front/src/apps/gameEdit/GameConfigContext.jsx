import React, { createContext, useContext, useState, useEffect } from 'react';
import client from '@api/client';

const GameConfigContext = createContext();

export const useGameConfig = () => {
  const context = useContext(GameConfigContext);
  // Provider 밖에서 호출될 때 (예: 일반 /game 라우트)
  if (!context) {
    return {
      hdriUrl: '/assets/hdri/autumn_field_4k.exr',
      setHdriUrl: () => { },
      moveSpeed: 3.0,
      setMoveSpeed: () => { }
    };
  }
  return context;
};

export const GameConfigProvider = ({ children }) => {
  const [hdriUrl, setHdriUrl] = useState('/assets/hdri/autumn_field_4k.exr');
  const [moveSpeed, setMoveSpeed] = useState(5.0);


  // 백엔드에서 서버에 저장된 현재 HDRI 설정 가져오기 (모든 유저에게 적용됨)
  useEffect(() => {
    client.get('/api/game/settings/hdri')
      .then(res => {
        if (res.data && res.data.path) {
          setHdriUrl(res.data.path);
        }
      })
      .catch(err => console.error('Failed to fetch server-side HDRI settings:', err));
  }, []);

  return (
    <GameConfigContext.Provider value={{ hdriUrl, setHdriUrl, moveSpeed, setMoveSpeed }}>
      {children}
    </GameConfigContext.Provider>
  );
};



