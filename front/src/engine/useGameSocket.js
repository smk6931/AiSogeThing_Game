import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@contexts/AuthContext';
import gameApi from '@api/game';

export const useGameSocket = (addProjectile) => {
    const { user } = useAuth();
    const socketRef = useRef(null);
    const [otherPlayers, setOtherPlayers] = useState({});
    const [chatMessages, setChatMessages] = useState([]);;
    const [latestChatMap, setLatestChatMap] = useState({});
    const [myStats, setMyStats] = useState(null);
    const [monsters, setMonsters] = useState({});

    // 몬스터 배칭: ref로 최신값 유지, RAF로 프레임당 1회 flush
    const monstersRef = useRef({});
    const monsterFlushRef = useRef(null);
    const scheduleMonsterFlush = () => {
        if (!monsterFlushRef.current) {
            monsterFlushRef.current = requestAnimationFrame(() => {
                setMonsters({ ...monstersRef.current });
                monsterFlushRef.current = null;
            });
        }
    };

    // 위치 쓰로틀: 유저별 마지막 업데이트 시각 추적 (50ms = 20Hz)
    const lastPositionTimeRef = useRef({});

    useEffect(() => {
        if (!user) return;

        // API 레이어를 통해 소켓 생성
        const socket = gameApi.createSocket(user.id, user.nickname);
        socketRef.current = socket;

        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);

            switch (message.type) {
                case 'sync_monsters':
                    monstersRef.current = message.monsters;
                    setMonsters(message.monsters); // 전체 동기화는 즉시 반영
                    break;

                case 'monster_hit': {
                    const m = monstersRef.current[message.monsterId];
                    if (!m) break;
                    monstersRef.current = {
                        ...monstersRef.current,
                        [message.monsterId]: {
                            ...m,
                            hp: message.hp ?? Math.max(0, m.hp - message.damage),
                            maxHp: message.maxHp ?? m.maxHp,
                            state: message.state || (message.killed ? 'dead' : 'hit')
                        }
                    };
                    scheduleMonsterFlush();
                    break;
                }

                case 'monster_dead': {
                    const m = monstersRef.current[message.monsterId];
                    if (!m) break;
                    monstersRef.current = {
                        ...monstersRef.current,
                        [message.monsterId]: { ...m, hp: 0, state: 'dead' }
                    };
                    scheduleMonsterFlush();
                    break;
                }

                case 'player_reward':
                    setMyStats(message.stats);
                    break;

                // [NEW] 다른 유저의 스킬 사용 수신
                case 'skill':
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

                // 3. 유저 이동/행동 업데이트 (50ms 쓰로틀 = 20Hz)
                case 'update_position': {
                    const now = Date.now();
                    if (now - (lastPositionTimeRef.current[message.userId] || 0) < 50) break;
                    lastPositionTimeRef.current[message.userId] = now;
                    setOtherPlayers(prev => {
                        if (!prev[message.userId]) return prev;
                        return {
                            ...prev,
                            [message.userId]: {
                                ...prev[message.userId],
                                position: message.position,
                                rotation: message.rotation,
                                animation: message.animation,
                                mapId: message.mapId
                            }
                        };
                    });
                    break;
                }

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

        socket.onopen = () => console.log('[OK] Game Socket Connected');
        socket.onclose = () => console.log('[LEAVE] Game Socket Disconnected');
        socket.onerror = (err) => console.error('[ERROR] Game Socket Error:', err);

        return () => {
            socket.close();
            if (monsterFlushRef.current) cancelAnimationFrame(monsterFlushRef.current);
        };
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
