import * as THREE from 'three';
import { Player } from './Player';
import { TerrainManager } from './TerrainManager';
import { BulletManager } from './BulletManager';
import { EnemyManager } from './EnemyManager';
import { CollisionManager } from './CollisionManager';

// 3つの画面状態を管理する型
export type GameState = 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export class GameManager {
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;
    public state: GameState = 'PLAYING';
    public score: number = 0;

    private player!: Player;
    private terrainManager!: TerrainManager;
    private bulletManager!: BulletManager;
    private enemyManager!: EnemyManager;
    private collisionManager!: CollisionManager;

    private previousTime: number = 0;

    private scoreEl: HTMLElement;
    private finalScoreEl: HTMLElement;
    private pauseScreenEl: HTMLElement;
    private gameOverScreenEl: HTMLElement;

    constructor(container: HTMLElement) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xaaccff); //空の色
        this.scene.fog = new THREE.FogExp2(0xaaccff, 0.005); //霧

        // 
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);

        this.scoreEl = document.getElementById('score')!;
        this.finalScoreEl = document.getElementById('final-score')!;
        this.pauseScreenEl = document.getElementById('pause-screen')!;
        this.gameOverScreenEl = document.getElementById('game-over-screen')!;

        // ライティング
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(100, 200, 50);
        this.scene.add(directionalLight);

        this.initGame();

        window.addEventListener('resize', this.onWindowResize.bind(this));
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));

        this.renderer.setAnimationLoop(this.animate.bind(this));
    }

    private async initGame() {
        this.score = 0;
        this.updateScoreUI();

        if (this.terrainManager) this.terrainManager.dispose();
        if (this.enemyManager) this.enemyManager.dispose();
        if (this.bulletManager) this.bulletManager.dispose();

        this.terrainManager = new TerrainManager(this.scene);
        this.enemyManager = new EnemyManager(this.scene, this.terrainManager);
        this.bulletManager = new BulletManager(this.scene);
        this.collisionManager = new CollisionManager(this);

        this.player = new Player(this.scene, this.camera, this.bulletManager);
        await this.player.loadModel();
    }

    private onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    private onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape' || event.key.toLowerCase() === 'p') {
            if (this.state === 'PLAYING') {
                this.pauseGame();
            } else if (this.state === 'PAUSED') {
                this.resumeGame();
            }
        } else if (event.code === 'Space' && this.state === 'GAME_OVER') {
            this.restartGame();
        } else {
            this.player?.onKeyDown(event);
        }
    }

    private onKeyUp(event: KeyboardEvent) {
        this.player?.onKeyUp(event);
    }

    private pauseGame() {
        this.state = 'PAUSED';
        this.pauseScreenEl.classList.remove('hidden');
    }

    private resumeGame() {
        this.state = 'PLAYING';
        this.pauseScreenEl.classList.add('hidden');
        this.previousTime = performance.now() / 1000;
    }

    public triggerGameOver() {
        if (this.state === 'GAME_OVER') return;
        this.state = 'GAME_OVER';
        this.finalScoreEl.innerText = this.score.toString();
        this.gameOverScreenEl.classList.remove('hidden');
    }

    private restartGame() {
        window.location.reload();
    }

    public addScore(points: number) {
        this.score += points;
        this.updateScoreUI();
    }

    private updateScoreUI() {
        this.scoreEl.innerText = this.score.toString();
    }

    private animate(time: number) {
        const timeInSeconds = time / 1000;
        const deltaTime = timeInSeconds - this.previousTime;
        this.previousTime = timeInSeconds;

        if (this.state === 'PLAYING' && this.player && this.player.isLoaded) {
            const playerPos = this.player.getPosition();
            const playerVel = this.player.getVelocity();

            this.player.update(deltaTime);
            this.bulletManager.update(deltaTime, playerPos);
            this.terrainManager.update(playerPos, deltaTime, this.camera);
            this.enemyManager.update(playerPos, playerVel, deltaTime);
            this.collisionManager.update(
                this.player,
                this.bulletManager,
                this.enemyManager,
                this.terrainManager
            );
        }

        this.renderer.render(this.scene, this.camera);
    }

    public getPlayer(): Player {
        return this.player;
    }
}
