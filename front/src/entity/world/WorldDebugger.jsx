import { useEffect } from 'react';
import { GUI } from 'lil-gui';

/**
 * lil-gui를 이용한 실시간 월드 디버깅 및 배치 헬퍼 컴포넌트
 * SeoulTerrain 제거 후 간소화된 버전 (Zone 시스템 도입 예정)
 */
const WorldDebugger = ({ config, onUpdate, resetToDefaults, controls, options }) => {
  useEffect(() => {
    if (window.innerWidth <= 768) {
      return undefined;
    }

    const gui = new GUI({
      title: '🛠️ World Editor (Advanced)',
      width: 300
    });

    gui.close();
    gui.hide();
    gui.domElement.style.zIndex = '1000';
    window.__worldGui = gui;

    // 1. 환경 설정 (안개, 조명)
    const envFolder = gui.addFolder('Environment & Sky').close();
    envFolder.add(config, 'fogNear', 0, 1000).step(1).name('Fog Near').onChange(onUpdate).listen();
    envFolder.add(config, 'fogFar', 100, 20000).step(10).name('Fog Far').onChange(onUpdate).listen();
    envFolder.addColor(config, 'fogColor').name('Fog Color').onChange(onUpdate);
    envFolder.add(config, 'ambientIntensity', 0, 5).step(0.1).name('Ambient Light').onChange(onUpdate).listen();

    // HDRI 스카이 설정
    const skyFolder = gui.addFolder('Sky (HDRI)').close();
    if (options && options.hdriPresets) {
      skyFolder.add(config, 'hdriUrl', options.hdriPresets).name('Sky Preset').onChange(onUpdate);
    } else {
      skyFolder.add(config, 'hdriUrl').name('Sky HDRI URL').onFinishChange(onUpdate);
    }

    // 2. 레이어 높이 관리
    const levelFolder = gui.addFolder('Layer Management (Y-Axis)').close();
    levelFolder.add(config, 'baseFloorElevation', -10, 5).step(0.01).name('Base Ground Y').onChange(onUpdate).listen();
    levelFolder.add(config, 'mapElevation', -5, 5).step(0.01).name('Map Tile Y').onChange(onUpdate).listen();
    levelFolder.add(config, 'gridElevation', -5, 5).step(0.01).name('Grid Helper Y').onChange(onUpdate).listen();
    levelFolder.add(config, 'terrainBaseHeight', -100, 100).step(0.1).name('Terrain Base Y').onChange(onUpdate).listen();

    // 3. 지면 및 바닥 설정
    const floorFolder = gui.addFolder('Floor & Terrain').close();
    floorFolder.add(config, 'showBaseFloor').name('Show Base Floor').onChange(onUpdate);
    floorFolder.addColor(config, 'floorColor').name('Floor Color').onChange(onUpdate);
    floorFolder.add(config, 'floorOpacity', 0, 1).step(0.01).name('Floor Opacity').onChange(onUpdate).listen();
    floorFolder.add(config, 'showGrid').name('Show Grid').onChange(onUpdate);
    floorFolder.add(config, 'terrainHeightScale', 0, 5).step(0.1).name('Terrain Height').onFinishChange(onUpdate).listen();

    // 4. 캐릭터 설정
    const playerFolder = gui.addFolder('Character').close();
    playerFolder.add(config, 'playerHeightMeters', 1, 30).step(0.1).name('Height (m)').onChange(onUpdate).listen();
    playerFolder.add(config, 'playerScale', 0.1, 10).step(0.01).name('Internal Scale (Ref)').disable().listen();

    // 5. OSM 데이터 설정
    const osmFolder = gui.addFolder('OSM Data (Zones)').close();
    osmFolder.add(config, 'zoneFetchRadius', 500, 10000).step(100).name('OSM 패치 반경 (m)').onFinishChange(onUpdate).listen();
    osmFolder.add(config, 'roadWidthMajor', 1, 100).step(1).name('주요도로 너비 (m)').onChange(onUpdate).listen();
    osmFolder.add(config, 'roadWidthMinor', 1, 50).step(1).name('일반도로 너비 (m)').onChange(onUpdate).listen();

    // 6. 카메라 설정 (공통 + 쿼터뷰)
    const camFolder = gui.addFolder('Camera Settings').close();
    camFolder.add(config, 'isOrthographic').name('무원근 모드 (Orthographic)').onChange(onUpdate);
    camFolder.add(config, 'cameraFov', 5, 120).step(1).name('FOV (원근 모드일 때만 적용)').onChange(onUpdate).listen();

    const isoSub = camFolder.addFolder('Isometric Details');
    isoSub.add(config, 'camIsoPitch', 0, 90).step(1).name('Pitch (수직)').onChange(onUpdate).listen();
    isoSub.add(config, 'camIsoAzimuth', -180, 180).step(1).name('Azimuth (수평)').onChange(onUpdate).listen();
    isoSub.add(config, 'camIsoDistMult', 1, 2000).step(1).name('Dist Mult').onChange(onUpdate).listen();

    const playSub = camFolder.addFolder('Play Mode Details');
    playSub.add(config, 'playCamPitch', 0, 90).step(1).name('Pitch (수직)').onChange(onUpdate).listen();
    playSub.add(config, 'playCamDistMult', 1, 1000).step(1).name('Dist Mult').onChange(onUpdate).listen();


    // 6. 배치 모드 설정
    const transformFolder = gui.addFolder('Object Editor').close();
    if (controls) {
      transformFolder.add(controls, 'mode', ['translate', 'rotate', 'scale'])
        .name('Edit Mode')
        .onChange((val) => {
          if (controls.onChange) controls.onChange(val);
        });
    }

    // 7. 유틸리티
    const utils = {
      saveConfig: () => {
        console.log('=== Saved World Configuration ===');
        console.log(JSON.stringify(config, null, 2));
        
        // 브라우저 로컬 저장소에 반영구적 저장
        localStorage.setItem('world_debug_config', JSON.stringify({ ...config, _version: 2 }));
        
        alert('모든 설정값이 브라우저 저장소(localStorage)에 저장되었습니다! 이제 새로고침해도 유지됩니다.');
      },
      toggleAll: () => {
        const folders = gui.folders;
        if (!folders || folders.length === 0) return;
        const allClosed = folders.every(f => f._closed);
        folders.forEach(f => allClosed ? f.open() : f.close());
      },
      resetAll: () => {
        if (confirm('모든 설정을 초기값으로 되돌리시겠습니까?')) {
          if (resetToDefaults) resetToDefaults();
          onUpdate();
        }
      },
      hideGui: () => {
        gui.hide();
        console.log('GUI가 숨겨졌습니다. "H" 키를 누르면 다시 나타날 수 있습니다.');
      }
    };
    gui.add(utils, 'toggleAll').name('📂 Toggle All Folders');
    gui.add(utils, 'resetAll').name('🔄 Reset to Defaults');
    gui.add(utils, 'saveConfig').name('💾 Save All Settings');
    gui.add(utils, 'hideGui').name('❌ Hide Editor');

    return () => { gui.destroy(); window.__worldGui = null; };
  }, [controls]);

  return null;
};

export default WorldDebugger;
