export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
    this.field = [];
    this.selectedIndex = -1;
    this.bet = 0;
    this.ui = {};
  }

  create() {
    const { width, height } = this.scale;

    // Fresh state each time we enter menu
    this.ui = {};
    this.selectedIndex = -1;
    this.bet = 0;

    this.add.image(0, 0, 'bgGradient').setOrigin(0);
    // Back to site home
    const backBtn = this.makeButton(16, 16, 90, 32, '← Back', () => {
      window.location.href = 'https://kxrnage.com/';
    });
    backBtn.setDepth(2000);
    if (typeof backBtn.setScrollFactor === 'function') backBtn.setScrollFactor(0);

    // If no bankroll, go to Game Over
    const bankroll0 = this.registry.get('bankroll') ?? 0;
    if (bankroll0 <= 0) {
      this.scene.start('GameOverScene');
      return;
    }

    // Title
    this.add.text(width / 2, 40, 'Derby Dash', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial',
      fontSize: '36px',
      color: '#e6edf3'
    }).setOrigin(0.5, 0);

    // Race conditions/meta
    this.race = this.generateRaceConditions();
    this.add.text(24, 72, `Surface: ${this.race.surface}  •  Condition: ${this.race.condition}  •  Distance: ${this.race.distanceF}f  •  Weather: ${this.race.weather}`,
      { fontSize: '14px', color: '#9ecbff' });

    // Bankroll
    const bankroll = this.registry.get('bankroll') ?? 1000;
    this.ui.bankText = this.add.text(24, 24, `Bankroll: $${bankroll}`, {
      fontSize: '18px', color: '#94c6ff'
    });

    // Odds format toggle
    const fmt = this.registry.get('oddsFormat') || 'decimal';
    this.ui.oddsBtn = this.makeButton(width - 200, 22, 160, 36, `Odds: ${fmt === 'decimal' ? 'Decimal' : 'American'}`, () => this.toggleOdds());

    // Generate horses field and compute odds
    this.field = this.generateField(8);
    this.computeOdds(this.field);

    // Horses list UI
    const listTop = 110;
    const rowH = 46;
    this.listTop = listTop;
    this.rowH = rowH;
    this.ui.rows = [];

    for (let i = 0; i < this.field.length; i++) {
      const y = listTop + i * rowH;
      const row = this.makeRow(i, y, width - 48);
      this.ui.rows.push(row);
    }

    // Ensure odds display reflects chosen format
    this.updateOddsDisplay();

    // Bet controls
    const controlsTop = listTop + this.field.length * rowH + 20;
    this.add.text(24, controlsTop, 'Bet Amount', { fontSize: '16px', color: '#e6edf3' });

    this.ui.betText = this.add.text(24, controlsTop + 26, '$0', { fontSize: '22px', color: '#ffd58a' });

    const mkBtn = (x, label, amt) => {
      const b = this.makeButton(x, controlsTop + 20, 90, 36, label, () => {
        if (amt === 0) this.bet = 0; else this.bet += amt;
        this.bet = Math.max(0, Math.min(this.bet, this.registry.get('bankroll')));
        this.ui.betText.setText(`$${this.bet}`);
      });
      b.setDepth(5);
      return b;
    };

    mkBtn(120, '+10', 10);
    mkBtn(220, '+50', 50);
    mkBtn(320, '+100', 100);
    mkBtn(420, 'Clear', 0);

    // Start Race button
    this.ui.startBtn = this.makeButton(width - 200, controlsTop + 16, 160, 44, 'Start Race ▶', () => this.startRace());

    // Info tip
    this.add.text(24, height - 28, 'Select a horse then choose your bet. Start Race to begin.', { fontSize: '14px', color: '#9aa5b1' });
  }

  makeRow(i, y, rowWidth) {
    const horse = this.field[i];

    const g = this.add.graphics();
    const x = 24;
    const h = 40;

    // Background card
    g.fillStyle(0x0f1a2c, 0.85);
    g.fillRoundedRect(x, y, rowWidth, h, 8);
    g.lineStyle(1, 0x1f2a3b, 1);
    g.strokeRoundedRect(x + 0.5, y + 0.5, rowWidth - 1, h - 1, 8);

    // Color chip
    g.fillStyle(horse.color, 1);
    g.fillRoundedRect(x + 8, y + 6, 28, h - 12, 6);

    // Number + Name
    this.add.text(x + 44, y + 8, `#${i + 1}  ${horse.name}`, { fontSize: '16px', color: '#e6edf3' });

    // Odds
    const oddsText = this.add.text(x + rowWidth - 120, y + 8, this.formatOdds(horse), { fontSize: '16px', color: '#7ae582' });

    // Secondary stats line
    const stats = this.describeHorse(horse);
    const detail = this.add.text(x + 44, y + 24, stats, { fontSize: '12px', color: '#9aa5b1' });

    // Hit area for selection
    const hit = this.add.rectangle(x, y, rowWidth, h, 0x000000, 0).setOrigin(0);
    hit.setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.selectHorse(i));

    return { g, hit, oddsText, index: i, detail };
  }

  selectHorse(i) {
    this.selectedIndex = i;
    // Subtle highlight effect
    this.ui.rows.forEach((row, idx) => {
      row.g.clear();
      const x = 24, y = this.listTop + idx * this.rowH, w = this.scale.width - 48, h = 40;
      const bg = (idx === i) ? 0x163150 : 0x0f1a2c;
      row.g.fillStyle(bg, 0.95);
      row.g.fillRoundedRect(x, y, w, h, 8);
      row.g.lineStyle(1, 0x1f2a3b, 1);
      row.g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 8);
    });
  }

  startRace() {
    const bankroll = this.registry.get('bankroll');
    if ((bankroll ?? 0) <= 0) { this.scene.start('GameOverScene'); return; }
    if (this.selectedIndex < 0) { this.flashMsg('Select a horse.'); return; }
    if (this.bet <= 0) { this.flashMsg('Enter a bet amount.'); return; }
    if (this.bet > bankroll) { this.flashMsg('Bet exceeds bankroll.'); return; }

    // Persist state to registry
    this.registry.set('field', this.field);
    this.registry.set('betHorse', this.selectedIndex);
    this.registry.set('betAmount', this.bet);
    this.registry.set('raceMeta', this.race);

    this.scene.start('RaceScene');
  }

  flashMsg(text) {
    const { width } = this.scale;
    const t = this.add.text(width / 2, 72, text, { fontSize: '16px', color: '#ffd58a', backgroundColor: '#3a2f14' })
      .setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 120, yoyo: true, hold: 800, onComplete: () => t.destroy() });
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
    // expose label for dynamic updates
    container.label = t;
    return container;
  }

  generateField(n) {
    const rng = this.makeRng(Date.now());
    const namesA = ['Blue', 'Silver', 'Wild', 'Royal', 'Crimson', 'Dusty', 'Thunder', 'Velvet', 'Lucky', 'Bold', 'Golden', 'Night'];
    const namesB = ['Comet', 'Charm', 'Strike', 'Whisper', 'Blaze', 'Arrow', 'Echo', 'Spirit', 'Mirage', 'Dash', 'Falcon', 'Aurora'];

    const colors = [0xff6b6b, 0x4dabf7, 0xffd166, 0x98f5e1, 0xb692f6, 0x7ae582, 0xf4a261, 0x84a59d, 0xe5989b, 0x56cfe1, 0xf6bd60, 0x6a994e];
    const breeds = ['Thoroughbred', 'Quarter Horse', 'Arabian'];
    // Discover preloaded numbered horse textures (keys like 'horse-1', 'horse-2', ...)
    let horseKeys = [];
    if (this.textures && typeof this.textures.getTextureKeys === 'function') {
      horseKeys = this.textures.getTextureKeys().filter(k => /^horse-\d+$/.test(k));
    } else {
      // Fallback: assume 1..18 if API unavailable
      horseKeys = Array.from({ length: 18 }, (_, i) => `horse-${i + 1}`);
    }
    // Shuffle deterministically using rng for per-run variety
    for (let i = horseKeys.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [horseKeys[i], horseKeys[j]] = [horseKeys[j], horseKeys[i]];
    }
    const picked = horseKeys.slice(0, n);

    const field = [];
    for (let i = 0; i < n; i++) {
      const name = `${namesA[Math.floor(rng() * namesA.length)]} ${namesB[Math.floor(rng() * namesB.length)]}`;
      const color = colors[i % colors.length];
      // Base stats (tuned by feel; used for sim and odds)
      const base = 2.6 + rng() * 0.6; // px/frame baseline
      const stamina = 0.8 + rng() * 0.6; // energy pool
      const burst = 0.6 + rng() * 0.8; // surge multiplier
      const variance = 0.2 + rng() * 0.5; // noise magnitude
      const gate = 0.9 + rng() * 0.2; // start reaction
      const breed = breeds[Math.floor(rng() * breeds.length)];
      const mud = 0.7 + (rng() - 0.5) * 0.6; // mud affinity ~0.4..1.0
      // Unique randomized sprite per horse within a race
      const spriteKey = picked[i] || null;
      const horse = { name, color, base, stamina, burst, variance, gate, oddsDec: 0, prob: 0, breed, mud, spriteKey };
      horse.pace = this.derivePaceStyle(horse);
      field.push(horse);
    }
    return field;
  }

  computeOdds(field) {
    // Convert stats to relative win probability using a soft score
    // Not physically exact, just consistent with sim.
    const k = 1.2;
    const scores = field.map(h => h.base * h.gate * (0.6 + 0.4 * h.stamina) * (0.8 + 0.2 * h.burst));
    const maxS = Math.max(...scores);
    const expScores = scores.map(s => Math.pow(s / maxS, k));
    const sumExp = expScores.reduce((a, b) => a + b, 0);

    // House margin 10%
    const margin = 0.9;
    for (let i = 0; i < field.length; i++) {
      const p = (expScores[i] / sumExp) * margin;
      field[i].prob = p;
      field[i].oddsDec = Math.max(1.1, 1 / Math.max(0.0001, p));
    }
  }

  // ===== Horse and Race descriptors =====
  generateRaceConditions() {
    // Surface fixed to Dirt for MVP visuals
    const surface = 'Dirt';
    const weather = (Math.random() < 0.7) ? (Math.random() < 0.5 ? 'Sunny' : 'Cloudy') : 'Rain';
    let condition = 'Fast';
    if (weather === 'Cloudy') condition = Math.random() < 0.5 ? 'Fast' : 'Good';
    if (weather === 'Rain') condition = Math.random() < 0.6 ? 'Sloppy' : 'Muddy';
    const distances = [5.0, 6.0, 7.0, 8.0, 8.5, 9.0];
    const distanceF = distances[Math.floor(Math.random() * distances.length)];
    return { surface, weather, condition, distanceF };
  }

  derivePaceStyle(h) {
    // Simple heuristic: higher base -> early; higher burst -> late; otherwise stalker
    const e = h.base;
    const l = h.burst;
    if (e > 2.9 && l < 1.0) return 'Front-Runner';
    if (l > 1.2 && e < 2.9) return 'Closer';
    return 'Stalker';
  }

  grade(x, goodHigh = true) {
    // Map ~0.6..1.4 to A/B/C using center at 1.0
    const v = x;
    if (goodHigh) {
      if (v >= 1.2) return 'A';
      if (v >= 0.9) return 'B';
      return 'C';
    } else {
      // for variance where lower is better
      if (v <= 0.25) return 'A';
      if (v <= 0.45) return 'B';
      return 'C';
    }
  }

  describeHorse(h) {
    const breed = h.breed;
    const pace = h.pace;
    const gateG = this.grade(h.gate);
    const stamG = this.grade(h.stamina);
    const burstG = this.grade(h.burst);
    const consistG = this.grade(h.variance, /*goodHigh=*/false);
    const mudG = this.grade(h.mud);
    return `${breed}  |  Pace: ${pace}  |  Gate: ${gateG}  |  Stamina: ${stamG}  |  Burst: ${burstG}  |  Consistency: ${consistG}  |  Mud: ${mudG}`;
  }

  // ===== Odds display helpers =====
  decimalToAmerican(d) {
    if (d >= 2) return Math.round((d - 1) * 100); // positive
    // favorite -> negative
    return -Math.round(100 / (d - 1));
  }

  formatOdds(horse) {
    const fmt = this.registry.get('oddsFormat') || 'decimal';
    if (fmt === 'american') {
      const am = this.decimalToAmerican(horse.oddsDec);
      return am > 0 ? `+${am}` : `${am}`;
    }
    return `${horse.oddsDec.toFixed(2)}x`;
  }

  updateOddsDisplay() {
    this.ui.rows?.forEach(row => {
      const i = row.index;
      if (row.oddsText && this.field[i]) {
        row.oddsText.setText(this.formatOdds(this.field[i]));
      }
    });
    // Update toggle button label
    if (this.ui.oddsBtn?.label) {
      const fmt = this.registry.get('oddsFormat') || 'decimal';
      this.ui.oddsBtn.label.setText(`Odds: ${fmt === 'decimal' ? 'Decimal' : 'American'}`);
    }
  }

  toggleOdds() {
    const cur = this.registry.get('oddsFormat') || 'decimal';
    const next = cur === 'decimal' ? 'american' : 'decimal';
    this.registry.set('oddsFormat', next);
    this.updateOddsDisplay();
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
