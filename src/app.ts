import { GameManager } from './GameManager';
import './style.css';

// コードが長くなったため、モジュールで分割した。
// GameManagerクラスをimportして全体を初期化する。
// GameManagerクラスに個別でインポートするクラスがあるため用意した。

function init() {
    const appContainer = document.getElementById('app');
    if (appContainer) {
        new GameManager(appContainer);
    }
}
window.addEventListener('DOMContentLoaded', init); // 講義のやり方に合わせた。