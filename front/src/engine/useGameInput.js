import { useState, useEffect, useRef, useCallback } from 'react';

// 입력 상태 관리 훅 (키보드 + 조이스틱 통합)
export const useGameInput = () => {
  const [input, setInput] = useState({ x: 0, y: 0, isMoving: false, source: 'keyboard' });
  const [keys, setKeys] = useState({ w: false, a: false, s: false, d: false, r: false });
  const joystickActiveRef = useRef(false);

  // 키보드 이벤트 리스너
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'r'].includes(key)) {
        setKeys(prev => prev[key] === true ? prev : { ...prev, [key]: true });
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'r'].includes(key)) {
        setKeys(prev => prev[key] === false ? prev : { ...prev, [key]: false });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 키 입력 → 벡터 변환 (joystickActive는 ref로 읽어 의존성 루프 방지)
  useEffect(() => {
    if (joystickActiveRef.current) return;

    let x = 0, y = 0;
    if (keys.w) y -= 1;
    if (keys.s) y += 1;
    if (keys.a) x -= 1;
    if (keys.d) x += 1;

    const isMoving = x !== 0 || y !== 0;
    if (isMoving) {
      const len = Math.sqrt(x * x + y * y);
      x /= len;
      y /= len;
    }

    setInput(prev => {
      if (prev.x === x && prev.y === y && prev.isMoving === isMoving && prev.source === 'keyboard') return prev;
      return { ...prev, x, y, isMoving, source: 'keyboard' };
    });
  }, [keys]);

  // 조이스틱 핸들러
  const handleJoystickMove = useCallback((event) => {
    if (event.type === 'move') {
      joystickActiveRef.current = true;
      setInput({
        x: event.x / 50,
        y: -event.y / 50,
        isMoving: true,
        joystickActive: true,
        source: 'joystick'
      });
    } else {
      joystickActiveRef.current = false;
      setInput(prev => ({ ...prev, x: 0, y: 0, isMoving: false, joystickActive: false }));
    }
  }, []);

  const [skillInput, setSkillInput] = useState({ x: 0, y: 0, active: false });

  const handleSkillMove = useCallback((event) => {
    setSkillInput({ x: event.x, y: event.y, active: true });
  }, []);

  const handleSkillStop = useCallback(() => {
    setSkillInput({ x: 0, y: 0, active: false });
  }, []);

  const actions = { skill1: keys.r || skillInput.active };

  const simulateKey = useCallback((key, pressed) => {
    setKeys(prev => prev[key] === pressed ? prev : { ...prev, [key]: pressed });
  }, []);

  return { input, actions, handleJoystickMove, skillInput, handleSkillMove, handleSkillStop, simulateKey };
};
