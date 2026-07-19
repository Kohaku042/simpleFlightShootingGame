import * as THREE from 'three';

export interface Bullet {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    distanceTraveled: number;
}

export class BulletManager {
    private scene: THREE.Scene;
    private bullets: Bullet[] = [];

    private geometry: THREE.CylinderGeometry;
    private material: THREE.MeshBasicMaterial;

    private bulletSpeed = 400; // 1秒あたりの移動距離
    private maxDistance = 600; // この距離を移動した後に破棄する

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.geometry = new THREE.CylinderGeometry(0.2, 0.2, 10, 8);
        this.geometry.rotateX(Math.PI / 2); // Z軸に合わせる
        this.material = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    }

    public fire(position: THREE.Vector3, rotation: THREE.Quaternion, playerVelocity: THREE.Vector3) {
        const mesh = new THREE.Mesh(this.geometry, this.material);
        mesh.position.copy(position);
        mesh.quaternion.copy(rotation);

        this.scene.add(mesh);

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(rotation);
        const velocity = forward.multiplyScalar(this.bulletSpeed);

        // 弾がすぐに置いていかれないようプレイヤーの速度を加える
        velocity.add(playerVelocity);

        this.bullets.push({
            mesh,
            velocity,
            distanceTraveled: 0
        });
    }

    public update(deltaTime: number, playerPos: THREE.Vector3) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];

            const step = bullet.velocity.clone().multiplyScalar(deltaTime);
            bullet.mesh.position.add(step);
            bullet.distanceTraveled += step.length();

            // 移動距離が上限を超えるか、プレイヤーから離れすぎた場合は削除する
            if (bullet.distanceTraveled > this.maxDistance || bullet.mesh.position.distanceTo(playerPos) > this.maxDistance) {
                this.removeBullet(i);
            }
        }
    }

    public getBullets(): Bullet[] {
        return this.bullets;
    }

    public removeBullet(index: number) {
        const bullet = this.bullets[index];
        this.scene.remove(bullet.mesh);
        // ジオメトリとマテリアルは共有されているため、ここで破棄しない！！
        // 破棄するのはBulletManagerが破棄される時のみにする！！
        this.bullets.splice(index, 1);
    }

    public dispose() {
        for (const bullet of this.bullets) {
            this.scene.remove(bullet.mesh);
        }
        this.bullets = [];
        this.geometry.dispose();
        this.material.dispose();
    }
}
