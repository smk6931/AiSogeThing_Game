import React, { createContext, useContext, useState } from 'react';

const GameConfigContext = createContext();

export const GameConfigProvider = ({ children }) => {
  const [moveSpeed, setMoveSpeed] = useState(20);
  const [hdriPath, setHdriPath] = useState('/assets/hdri/autumn_field_4k.exr');

  const value = {
    moveSpeed,
    setMoveSpeed,
    hdriPath,
    setHdriPath
  };

  return (
    <GameConfigContext.Provider value={value}>
      {children}
    </GameConfigContext.Provider>
  );
};

export const useGameConfig = () => {
  const context = useContext(GameConfigContext);
  if (!context) {
    throw new Error('useGameConfig must be used within a GameConfigProvider');
  }
  return context;
};
