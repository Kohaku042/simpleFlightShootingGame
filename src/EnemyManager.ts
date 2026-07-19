import * as THREE from 'three';
import { TerrainManager } from './TerrainManager';

export interface Enemy {
    mesh: THREE.Mesh;
    boundingBox: THREE.Box3;
}

export class EnemyManager {
    private scene: THREE.Scene;
    private terrainManager: TerrainManager;
    private enemies: Enemy[] = [];

    private geometry: THREE.BoxGeometry;
    private material: THREE.MeshStandardMaterial;

    private spawnTimer = 0;
    private spawnInterval = 1.0; // 1秒ごとにスポーンさせる
    private despawnDistance = 300; // これ以上後方に移動した場合はデスポーンさせる

    private enemySize = 10;

    constructor(scene: THREE.Scene, terrainManager: TerrainManager) {
        this.scene = scene;
        this.terrainManager = terrainManager;

        this.geometry = new THREE.BoxGeometry(this.enemySize, this.enemySize, this.enemySize);
        this.material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    }

    public update(playerPos: THREE.Vector3, playerVelocity: THREE.Vector3, deltaTime: number) {
        this.spawnTimer += deltaTime;

        // スポーンロジック、プレイヤーの前方に定期的に敵を出現させる
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.spawnEnemy(playerPos, playerVelocity);
        }

        // バウンディングボックスを更新し、古い敵を削除する
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.boundingBox.setFromObject(enemy.mesh);

            // 敵がプレイヤーより後方かつデスポーン距離以上離れている場合は削除する
            // プレイヤーが概ね-Zまたは+Z方向に進む想定で距離を判定しているが、
            // 前方向ベクトルを基準に後方にいるかどうかのシンプルな判定にしている

            // 現在はシンプルな距離チェックのみ。レイヤーは理論上どの方向にも移動可能だが、基本的には前進するため
            const dist = enemy.mesh.position.distanceTo(playerPos);
            // 内積を使用して後方にいるかチェックする
            const toEnemy = new THREE.Vector3().subVectors(enemy.mesh.position, playerPos);
            const forward = playerVelocity.clone().normalize();

            if (dist > this.despawnDistance && toEnemy.dot(forward) < 0) {
                this.removeEnemy(i);
            }
        }
    }

    private spawnEnemy(playerPos: THREE.Vector3, playerVelocity: THREE.Vector3) {
        // 前方のスポーン距離
        const spawnDistance = 300;
        const forward = playerVelocity.clone().normalize();

        // 横方向のオフセットをランダムに設定する
        const lateralOffset = (Math.random() - 0.5) * this.terrainManager.getChunkSize() * 1.5;
        const right = new THREE.Vector3(forward.z, 0, -forward.x).normalize(); // 概ね右方向のベクトル

        const spawnX = playerPos.x + forward.x * spawnDistance + right.x * lateralOffset;
        const spawnZ = playerPos.z + forward.z * spawnDistance + right.z * lateralOffset;

        const height = this.terrainManager.getHeightAt(spawnX, spawnZ);

        const mesh = new THREE.Mesh(this.geometry, this.material);
        mesh.position.set(spawnX, height + this.enemySize / 2, spawnZ); // 地面に配置するためにthis.enemySize/2する

        this.scene.add(mesh);

        const boundingBox = new THREE.Box3().setFromObject(mesh);

        this.enemies.push({ mesh, boundingBox });
    }

    public getEnemies(): Enemy[] {
        return this.enemies;
    }

    public removeEnemy(index: number) {
        const enemy = this.enemies[index];
        this.scene.remove(enemy.mesh);
        this.enemies.splice(index, 1);
        // ジオメトリとマテリアルは共有されているため、ここで破棄しないこと！！
    }

    public dispose() {
        for (const enemy of this.enemies) {
            this.scene.remove(enemy.mesh);
        }
        this.enemies = [];
        this.geometry.dispose();
        this.material.dispose();
    }
}
