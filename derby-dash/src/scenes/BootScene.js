export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Load numbered horse images from assets/horse (e.g., 1.png .. 18.png)
    // Keys will be horse-1, horse-2, ... for easy selection.
    for (let i = 1; i <= 18; i++) {
      this.load.image(`horse-${i}`, `assets/horse/${i}.png`);
    }
  }

  create() {
    // Initialize shared registry state
    const startingBankroll = 1000;
    if (typeof this.registry.get('bankroll') !== 'number') {
      this.registry.set('bankroll', startingBankroll);
    }
    // Default odds display format
    const fmt = this.registry.get('oddsFormat');
    if (fmt !== 'decimal' && fmt !== 'american') {
      this.registry.set('oddsFormat', 'decimal');
    }

    // A simple background gradient texture for reuse
    const { width, height } = this.scale;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    for (let y = 0; y < height; y++) {
      const t = y / Math.max(1, height - 1);
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x0d1117),
        Phaser.Display.Color.ValueToColor(0x182236),
        100,
        Math.floor(t * 100)
      );
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, y, width, 1);
    }
    g.generateTexture('bgGradient', width, height);
    g.destroy();

    // eslint-disable-next-line no-console
    console.log('[BootScene] starting RaceSelectScene');
    // Clear any stale selection so we always begin at the race card on load
    try { this.registry.set('raceMeta', null); } catch (_) {}
    this.scene.start('RaceSelectScene');
  }
}
