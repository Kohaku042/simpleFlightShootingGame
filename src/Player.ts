import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BulletManager } from './BulletManager';


export class Player {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private bulletManager: BulletManager;

    private mesh!: THREE.Group;
    public isLoaded = false; //外部で使うためpublic
    private exhaustMesh!: THREE.Mesh;

    // 移動のパラメータ
    private speed = 100; // 1秒あたりの移動距離
    private maxAltitude = 250;

    // 入力関連
    private keys = { w: false, s: false, a: false, d: false, space: false };
    private lastShotTime = 0;
    private shootInterval = 0.1; // 発射間隔の秒数

    // 物理・回転関連
    private velocity = new THREE.Vector3(0, 0, -1);
    private targetRotation = new THREE.Quaternion();
    private currentPitch = 0;

    // カメラのパラメータ
    private cameraOffset = new THREE.Vector3(0, 4, 8); // ジェットの後方
    private cameraTarget = new THREE.Vector3(0, 2, 0);

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, bulletManager: BulletManager) {
        this.scene = scene;
        this.camera = camera;
        this.bulletManager = bulletManager;
    }

    public async loadModel() {
        const loader = new GLTFLoader();
        return new Promise<void>((resolve, reject) => {
            loader.load(
                '/jet.glb', // publicディレクトリからの読み込み
                (gltf) => {
                    this.mesh = gltf.scene;
                    this.mesh.position.set(0, 100, 0);
                    this.mesh.scale.set(10, 10, 10);

                    const light = new THREE.PointLight(0xffaa00, 1, 10);
                    light.position.set(0, 2, 2);
                    this.mesh.add(light);

                    // ジェット噴射エフェクト
                    const exhaustGeometry = new THREE.ConeGeometry(0.1, 0.9, 8);
                    // 中心を底面にずらして、スケール変更時に後ろ方向にだけ伸びるようにする
                    exhaustGeometry.translate(0, -0.5, 0);
                    // コーンはデフォルトでY軸上を向いているため、機体の後方(Z軸プラス方向)に向ける
                    exhaustGeometry.rotateX(Math.PI / 2);

                    const exhaustMaterial = new THREE.MeshBasicMaterial({
                        color: 0x00ffff,
                        transparent: true,
                        opacity: 0.8,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false
                    });

                    this.exhaustMesh = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
                    this.exhaustMesh.position.set(0, 0, 2);
                    this.mesh.add(this.exhaustMesh);

                    this.scene.add(this.mesh);
                    this.isLoaded = true;
                    resolve();
                },
                undefined,
                (err) => {
                    console.error('An error happened loading jet.glb', err);
                    reject(err);
                }
            );
        });
    }

    public onKeyDown(event: KeyboardEvent) {
        const key = event.key.toLowerCase();
        if (this.keys.hasOwnProperty(key)) {
            this.keys[key as keyof typeof this.keys] = true;
        } else if (event.code === 'Space') {
            this.keys.space = true;
        }
    }

    public onKeyUp(event: KeyboardEvent) {
        const key = event.key.toLowerCase();
        if (this.keys.hasOwnProperty(key)) {
            this.keys[key as keyof typeof this.keys] = false;
        } else if (event.code === 'Space') {
            this.keys.space = false;
        }
    }

    public update(deltaTime: number) {
        if (!this.isLoaded) return;

        // ジェット噴射のゆらぎアニメーション
        if (this.exhaustMesh) {
            this.exhaustMesh.scale.z = 0.8 + Math.random() * 0.4;
            const thickness = 0.9 + Math.random() * 0.2;
            this.exhaustMesh.scale.x = thickness;
            this.exhaustMesh.scale.y = thickness;
        }

        // 1. 失速の処理（最大高度の制限用）
        let isStalling = false;
        if (this.mesh.position.y > this.maxAltitude) {
            isStalling = true;
            this.keys.s = false; // 上昇を無効化する
        }

        // 2. 入力からの目標回転の計算
        const yawSpeed = 1.0 * deltaTime;
        const pitchSpeed = 3.0 * deltaTime;
        const maxRoll = 0.8;

        let yaw = 0;
        let roll = 0;

        if (isStalling) {
            this.currentPitch -= pitchSpeed * 2; // 失速時はピッチを速やかに下げる
        } else {
            if (this.keys.w) this.currentPitch -= pitchSpeed;
            if (this.keys.s) this.currentPitch += pitchSpeed;
        }

        // 1回転を防ぐためのピッチの制限（約±80度）これでかなり操作しやすい
        const maxPitchLimit = Math.PI / 2.2;
        this.currentPitch = Math.max(-maxPitchLimit, Math.min(maxPitchLimit, this.currentPitch));

        if (this.keys.a) {
            yaw += yawSpeed;
            roll += maxRoll;
        }
        if (this.keys.d) {
            yaw -= yawSpeed;
            roll -= maxRoll;
        }

        // ヨーを現在の回転に直接加算して蓄積する
        this.mesh.rotateY(yaw);

        // ピッチとロールはローカルのオフセット
        const euler = new THREE.Euler(this.currentPitch, 0, roll, 'YXZ');
        const localRot = new THREE.Quaternion().setFromEuler(euler);

        // 蓄積したヨーとローカルのピッチ・ロールを合成する
        const currentEuler = new THREE.Euler().setFromQuaternion(this.mesh.quaternion, 'YXZ');
        const yawRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), currentEuler.y);

        this.targetRotation.copy(yawRot).multiply(localRot);

        // 現在の回転から目標の回転へスムーズに補間する
        this.mesh.quaternion.slerp(this.targetRotation, 10 * deltaTime);

        // 3. 前進処理（標準の前方は-Z）
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
        this.velocity.copy(forward).multiplyScalar(this.speed);
        this.mesh.position.addScaledVector(this.velocity, deltaTime);

        // 4. カメラの更新
        this.updateCamera(deltaTime);

        // 5. 発射処理
        if (this.keys.space) {
            const timeNow = performance.now() / 1000;
            if (timeNow - this.lastShotTime >= this.shootInterval) {
                this.shoot();
                this.lastShotTime = timeNow;
            }
        }
    }

    private updateCamera(deltaTime: number) {
        // カメラをジェットの後方に配置する
        const idealOffset = this.cameraOffset.clone().applyQuaternion(this.mesh.quaternion);
        idealOffset.add(this.mesh.position);

        const idealLookAt = this.cameraTarget.clone().applyQuaternion(this.mesh.quaternion);
        idealLookAt.add(this.mesh.position);

        //カメラ位置を線形補間して追従する
        this.camera.position.lerp(idealOffset, 5 * deltaTime);

        const currentLookAt = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        currentLookAt.add(this.camera.position);
        currentLookAt.lerp(idealLookAt, 5 * deltaTime);

        this.camera.lookAt(currentLookAt);
    }

    private shoot() {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.mesh.quaternion);
        const wingOffset = 3;

        const bulletPosRight = this.mesh.position.clone();
        bulletPosRight.addScaledVector(forward, 5);
        bulletPosRight.addScaledVector(right, wingOffset);

        const bulletPosLeft = this.mesh.position.clone();
        bulletPosLeft.addScaledVector(forward, 5);
        bulletPosLeft.addScaledVector(right, -wingOffset);

        this.bulletManager.fire(bulletPosRight, this.mesh.quaternion, this.velocity);
        this.bulletManager.fire(bulletPosLeft, this.mesh.quaternion, this.velocity);
    }

    public getPosition(): THREE.Vector3 {
        return this.mesh ? this.mesh.position : new THREE.Vector3();
    }

    public getVelocity(): THREE.Vector3 {
        return this.velocity;
    }
}
