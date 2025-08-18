export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create() {
    const { width, height } = this.scale;
    this.add.image(0, 0, 'bgGradient').setOrigin(0);

    // Title
    this.add.text(width / 2, 80, 'Game Over', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial',
      fontSize: '44px',
      color: '#ff7d7d'
    }).setOrigin(0.5, 0);

    this.add.text(width / 2, 150, 'Bankroll Depleted', {
      fontSize: '22px',
      color: '#e6edf3'
    }).setOrigin(0.5, 0);

    // Rebuy button
    const btn = this.makeButton(width / 2 - 100, height / 2 - 20, 200, 48, 'Rebuy $1000', () => {
      this.registry.set('bankroll', 1000);
      this.scene.start('RaceSelectScene');
    });
    btn.setDepth(5);

    // Small tip
    this.add.text(width / 2, height - 36, 'Tip: You can switch odds format from the menu.', { fontSize: '14px', color: '#9aa5b1' }).setOrigin(0.5);
  }

  makeButton(x, y, w, h, label, onClick) {
    const g = this.add.graphics();
    const container = this.add.container(x, y);

    g.fillStyle(0x2f5f93, 1);
    g.fillRoundedRect(0, 0, w, h, 8);
    g.lineStyle(1, 0x1f3f63, 1);
    g.strokeRoundedRect(0.5, 0.5, w - 1, h - 1, 8);

    const t = this.add.text(w / 2, h / 2, label, { fontSize: '18px', color: '#e6edf3' }).setOrigin(0.5);

    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0).setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.tweens.add({ targets: g, alpha: 0.85, duration: 80, yoyo: true });
        onClick?.();
      });

    container.add([g, t, hit]);
    return container;
  }
}
