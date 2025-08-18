export default class RaceSelectScene extends Phaser.Scene {
  constructor() {
    super('RaceSelectScene');
    this.races = [];
    this.ui = {};
  }

  create() {
    // eslint-disable-next-line no-console
    console.log('[RaceSelectScene] create');
    const { width, height } = this.scale;
    this.add.image(0, 0, 'bgGradient').setOrigin(0);

    this.add.text(width / 2, 34, 'Derby Dash — Race Card', {
      fontSize: '32px', color: '#e6edf3', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial'
    }).setOrigin(0.5, 0);

    // Build a small card of upcoming races
    this.rng = this.makeRng(Date.now());
    const n = 5;
    this.races = Array.from({ length: n }, (_, i) => this.makeRaceMeta(i + 1));

    const top = 96;
    const rowH = 78;
    this.ui.rows = [];
    this.races.forEach((r, i) => {
      const y = top + i * rowH;
      const g = this.add.graphics();
      g.fillStyle(0x0f1a2c, 0.95);
      g.fillRoundedRect(24, y, width - 48, 64, 8);
      g.lineStyle(1, 0x1f2a3b, 1);
      g.strokeRoundedRect(24.5, y + 0.5, width - 49, 63, 8);

      const label = `Race ${i + 1}  •  ${r.distanceF.toFixed(1)}f  •  ${r.surface} ${r.condition}  •  Field: ${r.fieldSize}`;
      this.add.text(40, y + 12, label, { fontSize: '18px', color: '#9ecbff' });
      this.add.text(40, y + 36, `${r.weather}  •  Purse: $${r.purse.toLocaleString()}`, { fontSize: '14px', color: '#c8d1e6' });

      const btn = this.makeButton(width - 180, y + 16, 130, 36, 'Select', () => {
        // Set race meta and go to menu
        this.registry.set('raceMeta', r);
        this.scene.start('MenuScene');
      });
      this.ui.rows.push({ g, btn });
    });
  }

  makeRaceMeta(idx) {
    // Surfaces: keep Dirt for now
    const surface = 'Dirt';
    const weather = (this.rng() < 0.7) ? (this.rng() < 0.5 ? 'Sunny' : 'Cloudy') : 'Rain';
    let condition = 'Fast';
    if (weather === 'Cloudy') condition = this.rng() < 0.5 ? 'Fast' : 'Good';
    if (weather === 'Rain') condition = this.rng() < 0.6 ? 'Sloppy' : 'Muddy';
    const distances = [5.0, 6.0, 7.0, 8.0, 8.5, 9.0];
    const distanceF = distances[Math.floor(this.rng() * distances.length)];
    const fieldSize = 7 + Math.floor(this.rng() * 4); // 7..10
    const purse = 20000 + Math.floor(this.rng() * 100000);
    const trackType = 'Straight';
    return { id: idx, surface, weather, condition, distanceF, trackType, fieldSize, purse };
  }

  makeButton(x, y, w, h, label, onClick) {
    const g = this.add.graphics();
    const container = this.add.container(x, y);

    g.fillStyle(0x2f5f93, 1);
    g.fillRoundedRect(0, 0, w, h, 8);
    g.lineStyle(1, 0x1f3f63, 1);
    g.strokeRoundedRect(0.5, 0.5, w - 1, h - 1, 8);

    const t = this.add.text(w / 2, h / 2, label, { fontSize: '16px', color: '#e6edf3' }).setOrigin(0.5);

    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0).setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.tweens.add({ targets: g, alpha: 0.85, duration: 80, yoyo: true });
        onClick?.();
      });

    container.add([g, t, hit]);
    return container;
  }

  makeRng(seed) {
    // Mulberry32
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ t >>> 15, 1 | t);
      r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
      return ((r ^ r >>> 14) >>> 0) / 4294967296;
    };
  }
}
