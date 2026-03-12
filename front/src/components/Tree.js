// Tree.js - 3D 나무 모델 로딩 컴포넌트
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

class TreeManager {
    constructor() {
        this.loader = new GLTFLoader();
        this.trees = new Map(); // 나무 모델 캐시
    }

    // 나무 모델 로드
    async loadTreeModel(treeType) {
        if (this.trees.has(treeType)) {
            return this.trees.get(treeType);
        }

        try {
            const gltf = await this.loader.loadAsync(`/models/trees/${treeType}.glb`);
            const model = gltf.scene;
            
            // 모델 최적화
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            this.trees.set(treeType, model);
            return model;
        } catch (error) {
            console.error(`Failed to load tree model: ${treeType}`, error);
            return null;
        }
    }

    // 나무 생성
    async createTree(treeType, position, scale = 1) {
        const model = await this.loadTreeModel(treeType);
        if (!model) return null;

        const tree = model.clone();
        tree.position.copy(position);
        tree.scale.setScalar(scale);
        
        // 랜덤 회전
        tree.rotation.y = Math.random() * Math.PI * 2;
        
        return tree;
    }

    // 도로에 나무 배치
    async plantTreesAlongRoad(roadPoints, treeType = 'oak_tree', spacing = 10) {
        const trees = [];
        
        for (let i = 0; i < roadPoints.length - 1; i++) {
            const start = roadPoints[i];
            const end = roadPoints[i + 1];
            const distance = start.distanceTo(end);
            const steps = Math.floor(distance / spacing);
            
            for (let j = 0; j <= steps; j++) {
                const t = j / steps;
                const position = new THREE.Vector3().lerpVectors(start, end, t);
                
                // 도로 양옆으로 나무 배치
                const offset = 5; // 도로에서 거리
                const leftPosition = position.clone().add(new THREE.Vector3(0, 0, offset));
                const rightPosition = position.clone().add(new THREE.Vector3(0, 0, -offset));
                
                const leftTree = await this.createTree(treeType, leftPosition);
                const rightTree = await this.createTree(treeType, rightPosition);
                
                if (leftTree) trees.push(leftTree);
                if (rightTree) trees.push(rightTree);
            }
        }
        
        return trees;
    }
}

export default TreeManager;
