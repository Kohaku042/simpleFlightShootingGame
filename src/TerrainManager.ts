import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

export class TerrainManager {
    private scene: THREE.Scene;
    private chunks: Map<string, THREE.Mesh> = new Map();
    private noise2D = createNoise2D();

    private noiseScale = 0.007; // 山の間隔 0.007がちょうどよかった
    private heightMultiplier = 60;

    private chunkSize = 300;
    private segments = 40; // チャンクの解像度
    private chunkDistance = 3; // 前方に描画するチャンク数
    private terrainMaterial: THREE.MeshStandardMaterial;

    private snowParticles!: THREE.Points;
    private snowGeometry!: THREE.BufferGeometry;
    private snowCount = 1000;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.terrainMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: true, // 距離感が掴みづらいのでフラットシェーディングにする
            vertexColors: true
        });

        this.initSnow();
    }

    private initSnow() {
        this.snowGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.snowCount * 3);

        for (let i = 0; i < this.snowCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 100; // X方向の広がり
            positions[i * 3 + 1] = (Math.random() - 0.5) * 60; // Y方向の広がり
            positions[i * 3 + 2] = -(Math.random() * 200); // z: 0から-200まで（カメラ前方）
        }

        this.snowGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const snowMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.8, // 近距離で高速なため少し小さめに設定する
            transparent: true,
            opacity: 0.8
        });

        this.snowParticles = new THREE.Points(this.snowGeometry, snowMaterial);
        this.scene.add(this.snowParticles);
    }

    public update(playerPos: THREE.Vector3, deltaTime: number, camera: THREE.Camera) {
        // 1. 地形のチャンク
        const currentChunkX = Math.floor(playerPos.x / this.chunkSize);
        const currentChunkZ = Math.floor(playerPos.z / this.chunkSize);

        const activeChunks = new Set<string>();

        // 前方と周囲のチャンクを生成する
        for (let xOffset = -1; xOffset <= 1; xOffset++) {
            for (let zOffset = -this.chunkDistance; zOffset <= 1; zOffset++) {
                const cx = currentChunkX + xOffset;
                const cz = currentChunkZ + zOffset;
                const key = `${cx},${cz}`;
                activeChunks.add(key);

                if (!this.chunks.has(key)) {
                    this.createChunk(cx, cz, key);
                }
            }
        }

        // 古いチャンクを削除する
        for (const [key, mesh] of this.chunks.entries()) {
            if (!activeChunks.has(key)) {
                this.scene.remove(mesh);
                mesh.geometry.dispose();
                // マテリアルは共有されているため破棄しない
                this.chunks.delete(key);
            }
        }

        // 2. 雪のエフェクト（カメラを通り過ぎるワープスピード風）
        this.snowParticles.position.copy(camera.position);
        this.snowParticles.quaternion.copy(camera.quaternion);

        const positions = this.snowGeometry.attributes.position.array as Float32Array;

        const speed = 400; // カメラに向かってくるパーティクルの速度
        for (let i = 0; i < this.snowCount; i++) {
            // パーティクルを+Z方向（カメラが-Zを向いているためカメラの方向）に移動させる
            positions[i * 3 + 2] += speed * deltaTime;

            // ループ処理：カメラの後方に移動した場合は前方にワープさせる
            if (positions[i * 3 + 2] > 5) {
                positions[i * 3 + 2] = -200;
                positions[i * 3] = (Math.random() - 0.5) * 100; // ランダムな新しいX座標
                positions[i * 3 + 1] = (Math.random() - 0.5) * 60; // ランダムな新しいY座標
            }
        }
        this.snowGeometry.attributes.position.needsUpdate = true;
    }

    private createChunk(cx: number, cz: number, key: string) {
        const geometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, this.segments, this.segments);
        geometry.rotateX(-Math.PI / 2);

        const positions = geometry.attributes.position.array as Float32Array;
        const colors = new Float32Array(positions.length);
        const color = new THREE.Color();
        const rockColor = new THREE.Color(0x888888);
        const snowColor = new THREE.Color(0xffffff);

        const worldXOffset = cx * this.chunkSize;
        const worldZOffset = cz * this.chunkSize;

        for (let i = 0; i < positions.length; i += 3) {
            const vx = positions[i] + worldXOffset;
            const vz = positions[i + 2] + worldZOffset;

            let height = this.noise2D(vx * this.noiseScale, vz * this.noiseScale) * this.heightMultiplier;
            height += this.noise2D(vx * this.noiseScale * 2, vz * this.noiseScale * 2) * (this.heightMultiplier * 0.2);

            // 地形全体を少し下げる
            height -= 20;

            positions[i + 1] = height;

            // 高さに基づいて色を設定
            const lerpFactor = THREE.MathUtils.clamp((height + 10) / 25, 0, 1);
            color.lerpColors(rockColor, snowColor, lerpFactor);

            colors[i] = color.r;
            colors[i + 1] = color.g;
            colors[i + 2] = color.b;
        }

        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        geometry.computeVertexNormals();

        const mesh = new THREE.Mesh(geometry, this.terrainMaterial);
        mesh.position.set(worldXOffset, 0, worldZOffset);

        this.scene.add(mesh);
        this.chunks.set(key, mesh);
    }

    public getHeightAt(x: number, z: number): number {
        let height = this.noise2D(x * this.noiseScale, z * this.noiseScale) * this.heightMultiplier;
        height += this.noise2D(x * this.noiseScale * 2, z * this.noiseScale * 2) * (this.heightMultiplier * 0.2);
        height -= 20;

        return height;
    }

    public getChunkSize(): number {
        return this.chunkSize;
    }

    public dispose() {
        for (const mesh of this.chunks.values()) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
        }
        this.chunks.clear();
        this.terrainMaterial.dispose();

        if (this.snowParticles) {
            this.scene.remove(this.snowParticles);
            this.snowGeometry.dispose();
            (this.snowParticles.material as THREE.Material).dispose();
        }
    }
}
