import { getWebSocketUrl } from '@api/client';

/**
 * 게임 관련 실시간 및 데이터 API
 */
const gameApi = {
  /**
   * 게임 웹소켓 연결 생성
   */
  createSocket: (userId, nickname) => {
    const wsUrl = getWebSocketUrl(`/api/game/ws/${userId}/${nickname}`);
    return new WebSocket(wsUrl);
  },

  /**
   * 위치 데이터 전송 포맷팅
   */
  /**
   * 위치 데이터 전송 포맷팅 (Backend Protocol Matching)
   */
  sendPosition: (socket, positionData) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'position', // event -> type
        position: {
          x: positionData.x,
          y: positionData.y || 0, // y가 없으면 0 (지상)
          z: positionData.z
        },
        rotation: positionData.rotation,
        animation: positionData.animation || 'Run', // 움직이니까 Run
        mapId: positionData.mapId // [NEW] 맵 정보 추가
      };
      socket.send(JSON.stringify(payload));
    }
  },

  /**
   * 채팅 데이터 전송 포맷팅
   */
  sendChat: (socket, message) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'chat', // event -> type
        message: message,
        timestamp: Date.now()
      };
      socket.send(JSON.stringify(payload));
    }
  },

  /**
   * 몬스터 피격 데이터 전송
   */
  sendHit: (socket, hitData) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'hit_monster',
        monsterId: hitData.monsterId,
        damage: hitData.damage,
        skillName: hitData.skillName
      };
      socket.send(JSON.stringify(payload));
    }
  }
};

export default gameApi;
