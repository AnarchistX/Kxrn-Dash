// Dynamic imports with cache-busting to ensure latest modules load
const v = Date.now();
const [BootScene, RaceSelectScene, MenuScene, RaceScene, GameOverScene] = await Promise.all([
  import(`./scenes/BootScene.js?v=${v}`),
  import(`./scenes/RaceSelectScene.js?v=${v}`),
  import(`./scenes/MenuScene.js?v=${v}`),
  import(`./scenes/RaceScene.js?v=${v}`),
  import(`./scenes/GameOverScene.js?v=${v}`)
]).then(mods => mods.map(m => m.default));

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
  dom: { createContainer: true },
  scene: [BootScene, RaceSelectScene, MenuScene, RaceScene, GameOverScene],
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
