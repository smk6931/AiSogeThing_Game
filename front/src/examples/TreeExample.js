// Game.js - 나무 배치 사용 예시
import TreeManager from './components/Tree.js';

class Game {
    constructor() {
        this.treeManager = new TreeManager();
        this.scene = new THREE.Scene();
    }

    async setupEnvironment() {
        // 도로 경로 정의
        const roadPath = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(50, 0, 0),
            new THREE.Vector3(100, 0, 20),
            new THREE.Vector3(150, 0, 20)
        ];

        // 도로 양옆에 나무 배치
        const trees = await this.treeManager.plantTreesAlongRoad(
            roadPath, 
            'oak_tree',  // 나무 종류
            15           // 간격
        );

        // 씬에 나무 추가
        trees.forEach(tree => {
            this.scene.add(tree);
        });

        console.log(`Planted ${trees.length} trees along the road`);
    }
}

export default Game;
