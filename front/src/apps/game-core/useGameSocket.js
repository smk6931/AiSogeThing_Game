import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@shared/context/AuthContext';
import gameApi from '@api/game';

export const useGameSocket = (addProjectile) => {
    const { user } = useAuth();
    const socketRef = useRef(null);
    const [otherPlayers, setOtherPlayers] = useState({});
    const [chatMessages, setChatMessages] = useState([]);;
    const [latestChatMap, setLatestChatMap] = useState({});
    const [myStats, setMyStats] = useState(null);
    const [monsters, setMonsters] = useState({}); // [NEW] 몬스터 목록

    useEffect(() => {
        if (!user) return;

        // API 레이어를 통해 소켓 생성
        const socket = gameApi.createSocket(user.id, user.nickname);
        socketRef.current = socket;

        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);

            switch (message.type) {
                // [NEW] 몬스터 목록 동기화
                case 'sync_monsters':
                    setMonsters(message.monsters);
                    break;

                // [NEW] 몬스터 피격 (시각 효과 및 즉시 상태 반영)
                case 'monster_hit':
                    setMonsters(prev => {
                        const m = prev[message.monsterId];
                        if (!m) return prev;
                        return {
                            ...prev,
                            [message.monsterId]: {
                                ...m,
                                hp: Math.max(0, m.hp - message.damage),
                                state: 'hit' // 피격 모션 트리거
                            }
                        };
                    });
                    break;

                // [NEW] 다른 유저의 스킬 사용 수신
                // [NEW] 다른 유저의 스킬 사용 수신
                case 'skill':
                    // 내 스킬은 내가 이미 그렸으니 무시 (옵션)
                    // if (message.userId === String(user.id)) return;

                    if (addProjectile) {
                        const skillData = message.data;

                        // ★ 스킬 종류에 따른 처리 분기
                        if (skillData.skillName === 'pyramid_punch') {
                            // 피라미드 펀치는 양손(Left/Right) 두 번 생성해야 함
                            addProjectile({
                                ...skillData,
                                id: crypto.randomUUID(),
                                side: 'left',
                                isRemote: true
                            });
                            addProjectile({
                                ...skillData,
                                id: crypto.randomUUID(),
                                side: 'right',
                                isRemote: true
                            });
                        } else {
                            // 일반 스킬 (단발)
                            addProjectile({
                                ...skillData,
                                id: skillData.id || crypto.randomUUID(),
                                isRemote: true
                            });
                        }
                    }
                    break;

                // 1. 초기 접속 시 기존 유저 목록 동기화
                case 'sync_players':
                    setOtherPlayers(message.players);
                    break;

                // 2. 새로운 유저 입장
                case 'join':
                    setOtherPlayers(prev => ({
                        ...prev,
                        [message.userId]: {
                            nickname: message.nickname,
                            position: message.position,
                            rotation: 0,
                            animation: 'Idle',
                            mapId: message.mapId // [NEW] 맵 정보 저장
                        }
                    }));
                    break;

                // 3. 유저 이동/행동 업데이트
                case 'update_position':
                    setOtherPlayers(prev => {
                        if (!prev[message.userId]) return prev; // 없는 유저면 패스
                        return {
                            ...prev,
                            [message.userId]: {
                                ...prev[message.userId],
                                position: message.position,
                                rotation: message.rotation,
                                animation: message.animation,
                                mapId: message.mapId // [NEW] 맵 정보 업데이트
                            }
                        };
                    });
                    break;

                // 4. 유저 퇴장
                case 'leave':
                    setOtherPlayers(prev => {
                        const newPlayers = { ...prev };
                        delete newPlayers[message.userId];
                        return newPlayers;
                    });
                    break;

                // 5. 채팅 수신

                case 'chat': setChatMessages(prev => {
                    const newMessages = [...prev, message];
                    if (newMessages.length > 50) return newMessages.slice(-50);
                    return newMessages;
                });

                    setLatestChatMap(prev => ({
                        ...prev,
                        [message.userId]: {
                            message: message.message,
                            timestamp: Date.now()
                        }
                    }));
                    break;

                case 'init_stats':
                    setMyStats(message.stats);
                    break;

                default:
                    break;
            }
        };

        socket.onopen = () => console.log('Game Socket Connected! 🟢');
        socket.onclose = () => console.log('Game Socket Disconnected 🔴');
        socket.onerror = (err) => console.error('Game Socket Error:', err);

        return () => socket.close();
    }, [user?.id]); // user가 바뀔 때만 재연결 (user.id 체크)

    // 전송 로직도 API 레이어에 위임
    const sendPosition = (positionData) => {
        gameApi.sendPosition(socketRef.current, positionData);
    };

    const sendChatMessage = (text) => {
        gameApi.sendChat(socketRef.current, text);
    };

    // [NEW] 스킬 사용 전송
    const sendSkill = (skillData) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'skill',
                data: skillData
            }));
        }
    };

    // [NEW] 몬스터 피격 전송
    const sendHit = (hitData) => {
        gameApi.sendHit(socketRef.current, hitData);
    };

    return { otherPlayers, sendPosition, chatMessages, sendChatMessage, latestChatMap, myStats, sendSkill, monsters, sendHit };
};
