// ModelViewer.js - Anti-Gravity 3D 모델 뷰어
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

class ModelViewer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.controls = null;
        this.currentModel = null;
        this.models = new Map();
        
        this.init();
    }

    init() {
        // 렌더러 설정
        this.renderer.setSize(400, 400);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // 카메라 위치
        this.camera.position.set(5, 5, 5);

        // 컨트롤 설정
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // 조명 설정
        this.setupLighting();

        // 배경 설정
        this.scene.background = new THREE.Color(0xf0f0f0);

        // 그리드 추가
        this.addGrid();

        // 애니메이션 루프
        this.animate();
    }

    setupLighting() {
        // 메인 라이트
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        this.scene.add(directionalLight);

        // 보조 라이트
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
    }

    addGrid() {
        const gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0xcccccc);
        this.scene.add(gridHelper);
    }

    // 모델 로드
    async loadModel(modelPath, modelName = 'model') {
        if (this.models.has(modelName)) {
            this.setModel(this.models.get(modelName));
            return;
        }

        const loader = new GLTFLoader();
        
        try {
            const gltf = await loader.loadAsync(modelPath);
            const model = gltf.scene;
            
            // 모델 최적화
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // 모델 크기 조정
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2 / maxDim; // 모델을 적절한 크기로 조정
            model.scale.setScalar(scale);

            // 모델 중앙 정렬
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center.multiplyScalar(scale));

            this.models.set(modelName, model);
            this.setModel(model);

            console.log(`Model loaded: ${modelName}`);
        } catch (error) {
            console.error(`Failed to load model: ${modelPath}`, error);
        }
    }

    // 현재 모델 설정
    setModel(model) {
        // 이전 모델 제거
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
        }

        this.currentModel = model;
        this.scene.add(model);

        // 카메라가 모델을 바라보도록 설정
        this.fitCameraToModel();
    }

    // 카메라를 모델에 맞추기
    fitCameraToModel() {
        if (!this.currentModel) return;

        const box = new THREE.Box3().setFromObject(this.currentModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));

        cameraZ *= 1.5; // 여유 공간

        this.camera.position.set(center.x, center.y, center.z + cameraZ);
        this.camera.lookAt(center);
        this.controls.target.copy(center);
        this.controls.update();
    }

    // 애니메이션 루프
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    // 모델 회전
    rotateModel(axis, speed) {
        if (!this.currentModel) return;
        
        const rotationVector = new THREE.Vector3();
        switch(axis) {
            case 'x': rotationVector.x = speed; break;
            case 'y': rotationVector.y = speed; break;
            case 'z': rotationVector.z = speed; break;
        }
        
        this.currentModel.rotation.add(rotationVector);
    }

    // 모델 리셋
    resetModel() {
        if (!this.currentModel) return;
        
        this.currentModel.rotation.set(0, 0, 0);
        this.currentModel.position.set(0, 0, 0);
        this.fitCameraToModel();
    }
}

export default ModelViewer;
