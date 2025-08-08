import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import RaceScene from './scenes/RaceScene.js';
import GameOverScene from './scenes/GameOverScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0d1117',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  physics: { default: 'arcade' },
  scene: [BootScene, MenuScene, RaceScene, GameOverScene],
};

function startGame() {
  // eslint-disable-next-line no-console
  console.log('[main] starting DerbyDash');
  // eslint-disable-next-line no-new
  new Phaser.Game(config);
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  startGame();
} else {
  window.addEventListener('DOMContentLoaded', startGame, { once: true });
}
