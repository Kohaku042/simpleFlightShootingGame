
import { GameManager } from './GameManager';
import { Player } from './Player';
import { BulletManager } from './BulletManager';
import { EnemyManager } from './EnemyManager';
import { TerrainManager } from './TerrainManager';

// あたり判定の管理
export class CollisionManager {
    private gameManager: GameManager;

    constructor(gameManager: GameManager) {
        this.gameManager = gameManager;
    }

    public update(
        player: Player,
        bulletManager: BulletManager,
        enemyManager: EnemyManager,
        terrainManager: TerrainManager
    ) {
        // 1. プレイヤーと地面の判定
        const playerPos = player.getPosition();
        const groundHeight = terrainManager.getHeightAt(playerPos.x, playerPos.z);
        // プレイヤーのY座標が地面より低い場合はゲームオーバーとする
        // 接触後すぐにめり込まないようにオフセットを加算して調整
        const playerRadius = 2.0;
        if (playerPos.y - playerRadius < groundHeight) {
            this.gameManager.triggerGameOver();
        }

        // 2. 弾と敵の判定
        const bullets = bulletManager.getBullets();
        const enemies = enemyManager.getEnemies();
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            const bulletPos = bullet.mesh.position;

            for (let j = enemies.length - 1; j >= 0; j--) {
                const enemy = enemies[j];

                // 箱の中に点が含まれているかの判定
                if (enemy.boundingBox.containsPoint(bulletPos)) {
                    this.gameManager.addScore(100);
                    bulletManager.removeBullet(i);
                    enemyManager.removeEnemy(j);
                    break;  // 弾が消失したため内側の内側のループを終了
                }
            }
        }
    }
}
