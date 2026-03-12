// NoryangjinTest.js - 노량진 2동 테스트 나무 배치
import * as THREE from 'three';
import TreeManager from '../components/Tree.js';

class NoryangjinTest {
    constructor() {
        this.scene = new THREE.Scene();
        this.treeManager = new TreeManager();
        this.trees = [];
    }

    // 노량진 2동 중심 좌표 (대략적인 위치)
    getNoryangjinCoordinates() {
        return {
            center: new THREE.Vector3(0, 0, 0),
            roads: [
                // 노량진로 (주요 도로)
                [
                    new THREE.Vector3(-50, 0, -30),
                    new THREE.Vector3(0, 0, -30),
                    new THREE.Vector3(50, 0, -30),
                    new THREE.Vector3(100, 0, -30)
                ],
                // 양녕로
                [
                    new THREE.Vector3(-30, 0, -50),
                    new THREE.Vector3(-30, 0, 0),
                    new THREE.Vector3(-30, 0, 50),
                    new THREE.Vector3(-30, 0, 100)
                ],
                // 동작대로
                [
                    new THREE.Vector3(30, 0, -50),
                    new THREE.Vector3(30, 0, 0),
                    new THREE.Vector3(30, 0, 50),
                    new THREE.Vector3(30, 0, 100)
                ]
            ]
        };
    }

    // 노량진 2동에 나무 배치
    async plantTreesInNoryangjin() {
        const { roads } = this.getNoryangjinCoordinates();
        
        // 다양한 나무 종류
        const treeTypes = ['oak_tree', 'pine_tree', 'maple_tree'];
        
        for (let i = 0; i < roads.length; i++) {
            const road = roads[i];
            const treeType = treeTypes[i % treeTypes.length];
            const spacing = 12; // 나무 간격
            
            console.log(`Planting ${treeType} along road ${i + 1}`);
            
            const roadTrees = await this.treeManager.plantTreesAlongRoad(
                road, 
                treeType, 
                spacing
            );
            
            this.trees.push(...roadTrees);
        }

        // 공원 지역에 나무 군집 배치
        await this.plantParkTrees();

        console.log(`Total trees planted in Noryangjin: ${this.trees.length}`);
        return this.trees;
    }

    // 공원 지역 나무 배치
    async plantParkTrees() {
        const parkCenter = new THREE.Vector3(0, 0, 0);
        const parkRadius = 40;
        const treeTypes = ['oak_tree', 'maple_tree'];
        
        // 원형으로 나무 배치
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
            for (let r = 10; r <= parkRadius; r += 15) {
                const x = Math.cos(angle) * r;
                const z = Math.sin(angle) * r;
                const position = new THREE.Vector3(x, 0, z);
                
                const treeType = treeTypes[Math.floor(Math.random() * treeTypes.length)];
                const scale = 0.8 + Math.random() * 0.4; // 크기 다양성
                
                const tree = await this.treeManager.createTree(treeType, position, scale);
                if (tree) {
                    this.trees.push(tree);
                }
            }
        }
    }

    // 씬에 나무 추가
    async initializeNoryangjinScene() {
        await this.plantTreesInNoryangjin();
        
        // 씬에 모든 나무 추가
        this.trees.forEach(tree => {
            this.scene.add(tree);
        });

        // 조명 설정
        this.setupLighting();
        
        // 지면 생성
        this.createGround();
        
        return this.scene;
    }

    // 조명 설정
    setupLighting() {
        // 태양광
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // 환경광
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
    }

    // 지면 생성
    createGround() {
        const groundGeometry = new THREE.PlaneGeometry(300, 300);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x3a5f3a });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    // 카메라 위치 설정 (노량진 2동 상공에서)
    setupCamera() {
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(100, 80, 100);
        camera.lookAt(0, 0, 0);
        return camera;
    }
}

export default NoryangjinTest;
