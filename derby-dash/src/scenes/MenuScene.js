export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
    this.field = [];
    this.selectedIndex = -1;
    this.bet = 0;
    this.ui = {};
  }

  // ===== Odds display helpers (W/P/S all show American/Decimal) =====
  formatDisplayedPrice(i) {
    const type = this.betType || 'win';
    const fmt = this.registry.get('oddsFormat') || 'decimal';
    const d = this.decimalOddsFor(type, i);
    if (!isFinite(d) || d <= 1) return fmt === 'american' ? '—' : '—';
    if (fmt === 'american') {
      const am = this.decimalToAmerican(d);
      return am > 0 ? `+${am}` : `${am}`;
    }
    return `${d.toFixed(2)}x`;
  }

  decimalOddsFor(type, idx) {
    const eps = 1e-6;
    if (!this.pools) {
      // Fallback to computed book odds for Win only
      if (type === 'win' && this.field[idx]) return this.field[idx].oddsDec || NaN;
      return NaN;
    }
    if (type === 'win') {
      const net = this.pools.win.total * (1 - (this.pools.takeout?.win ?? 0.18));
      const alloc = Math.max(eps, this.pools.win.alloc[idx] ?? 0);
      return 1 + (net / alloc);
    }
    if (type === 'place') {
      const net = this.pools.place.total * (1 - (this.pools.takeout?.place ?? 0.18));
      const alloc = Math.max(eps, this.pools.place.alloc[idx] ?? 0);
      return 1 + ((net / 2) / alloc);
    }
    if (type === 'show') {
      const net = this.pools.show.total * (1 - (this.pools.takeout?.show ?? 0.18));
      const alloc = Math.max(eps, this.pools.show.alloc[idx] ?? 0);
      return 1 + ((net / 3) / alloc);
    }
    return NaN;
  }

  buildPublicPools() {
    // Use implied probabilities to distribute public money across horses
    const probs = this.field.map(h => Math.max(1e-6, h.prob || 1 / this.field.length));
    const norm = probs.reduce((a, b) => a + b, 0);
    const P = probs.map(p => p / Math.max(1e-6, norm));
    // Pool totals (USD)
    const totalWin = 12000 * (0.8 + Math.random() * 0.6);
    const totalPlace = 9000 * (0.8 + Math.random() * 0.6);
    const totalShow = 7000 * (0.8 + Math.random() * 0.6);
    const allocFrom = (total) => P.map(p => p * total);
    const takeout = { win: 0.18, place: 0.18, show: 0.18 };
    this.pools = {
      win: { total: totalWin, alloc: allocFrom(totalWin) },
      place: { total: totalPlace, alloc: allocFrom(totalPlace) },
      show: { total: totalShow, alloc: allocFrom(totalShow) },
      takeout
    };
  }

  create() {
    const { width, height } = this.scale;

    // Fresh state each time we enter menu
    this.ui = {};
    this.selectedIndex = -1;
    this.bet = 0;

    this.add.image(0, 0, 'bgGradient').setOrigin(0);
    // eslint-disable-next-line no-console
    console.log('[MenuScene] create');

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

    // Race conditions/meta: require selection from RaceSelectScene
    const selectedMeta = this.registry.get('raceMeta');
    if (!selectedMeta) { this.scene.start('RaceSelectScene'); return; }
    this.race = selectedMeta;
    this.ui.metaText = this.add.text(24, 72, `Surface: ${this.race.surface}  •  Condition: ${this.race.condition}  •  Distance: ${this.race.distanceF}f  •  Weather: ${this.race.weather}`,
      { fontSize: '14px', color: '#9ecbff' });

    // Bankroll (shifted right so it doesn't overlap the Home button)
    const bankroll = this.registry.get('bankroll') ?? 1000;
    this.ui.bankText = this.add.text(72, 24, `Bankroll: $${bankroll}`, {
      fontSize: '18px', color: '#94c6ff'
    });

    // Odds format toggle
    const fmt = this.registry.get('oddsFormat') || 'decimal';
    this.ui.oddsBtn = this.makeButton(width - 200, 22, 160, 36, `Odds: ${fmt === 'decimal' ? 'Decimal' : 'American'}`, () => this.toggleOdds());
    // Back to race card
    this.ui.backBtn = this.makeButton(width - 380, 22, 160, 36, 'Back to Races', () => {
      this.scene.start('RaceSelectScene');
    });
    // Glossary / Index
    this.ui.infoBtn = this.makeButton(width - 560, 22, 160, 36, 'Glossary', () => this.showGlossary());

    // Distance is no longer user-selectable; races are pre-randomized via RaceSelect

    // Track: fixed to Straight (oval disabled)

    // Generate horses field (use race card field size if provided) and compute odds
    const fsize = this.race.fieldSize || 8;
    this.field = this.generateField(fsize);
    this.computeOdds(this.field);

    // Build synthetic public pools for W/P/S based on implied probabilities
    this.buildPublicPools();

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

    // Ensure odds/prices reflect chosen bet type and format
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

    // Typed bet input (DOM element)
    const inputX = 540;
    const inputY = controlsTop + 38;
    const el = document.createElement('input');
    el.type = 'number';
    el.min = '0';
    el.step = '10';
    el.placeholder = 'Type amount';
    el.style.width = '140px';
    el.style.height = '28px';
    el.style.padding = '4px 8px';
    el.style.borderRadius = '6px';
    el.style.border = '1px solid #1f2a3b';
    el.style.background = '#0e1622';
    el.style.color = '#e6edf3';
    el.style.outline = 'none';
    const domInput = this.add.dom(inputX, inputY, el).setOrigin(0, 0.5);
    this.ui.betDomInput = domInput;

    const setTyped = () => {
      const bankroll = this.registry.get('bankroll');
      const raw = parseInt(el.value, 10);
      if (!Number.isFinite(raw)) { this.flashMsg('Enter a number'); return; }
      this.bet = Math.max(0, Math.min(raw, bankroll));
      this.ui.betText.setText(`$${this.bet}`);
    };
    // Set button for typed bet
    this.ui.setBetBtn = this.makeButton(inputX + 160, controlsTop + 20, 90, 36, 'Set', setTyped);
    // Enter key support
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') setTyped(); });

    // Clean up DOM on scene shutdown
    this.events.once('shutdown', () => { try { domInput.destroy(); } catch (_) {} });

    // Bet Type: Win / Place / Show
    this.betType = this.registry.get('betType') || 'win';
    const types = ['win','place','show'];
    const labels = { win: 'Win', place: 'Place', show: 'Show' };
    const typeColors = { win: 0x22c55e, place: 0x38bdf8, show: 0xa78bfa }; // green, sky, violet
    const x0 = inputX + 270;
    const restyle = (btn, active, type) => {
      if (!btn?.bg) return;
      const w = btn._w || 100;
      const h = btn._h || 36;
      const g = btn.bg;
      g.clear();
      if (active) {
        g.fillStyle(typeColors[type] || 0xf59e0b, 1);
        g.fillRoundedRect(0, 0, w, h, 8);
        g.lineStyle(2, 0xffffff, 0.9);
        g.strokeRoundedRect(0.5, 0.5, w - 1, h - 1, 8);
        if (btn.label) btn.label.setColor('#0b0c10');
      } else {
        g.fillStyle(0x2f5f93, 0.75);
        g.fillRoundedRect(0, 0, w, h, 8);
        g.lineStyle(1, 0x1f3f63, 1);
        g.strokeRoundedRect(0.5, 0.5, w - 1, h - 1, 8);
        if (btn.label) btn.label.setColor('#e6edf3');
      }
    };
    const updateBetTypeUI = () => {
      this.ui.betTypeBtns?.forEach(({ btn, type }) => {
        const active = (type === this.betType);
        restyle(btn, active, type);
      });
    };
    this.ui.betTypeBtns = types.map((t, idx) => {
      const btn = this.makeButton(x0 + idx * 110, controlsTop + 20, 100, 36, labels[t], () => {
        this.betType = t;
        this.registry.set('betType', this.betType); // persist immediately
        updateBetTypeUI();
    // Ensure odds/prices reflect the persisted bet type immediately
    this.updateOddsDisplay();
        this.updateOddsDisplay();
      });
      return { btn, type: t };
    });
    updateBetTypeUI();

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

    // Price display (depends on betType)
    const oddsText = this.add.text(x + rowWidth - 160, y + 8, this.formatDisplayedPrice(i), { fontSize: '16px', color: '#7ae582' });

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
    // If user typed a bet but didn't press Set/Enter, capture it now
    try {
      const el = this.ui?.betDomInput?.node;
      if (el && typeof el.value !== 'undefined' && el.value !== '') {
        const bankroll = this.registry.get('bankroll');
        const raw = parseInt(el.value, 10);
        if (Number.isFinite(raw)) {
          this.bet = Math.max(0, Math.min(raw, bankroll));
          this.ui.betText?.setText(`$${this.bet}`);
        }
      }
    } catch (_) { /* no-op */ }

    const bankroll = this.registry.get('bankroll');
    if ((bankroll ?? 0) <= 0) { this.scene.start('GameOverScene'); return; }
    if (this.selectedIndex < 0) { this.flashMsg('Select a horse.'); return; }
    if (this.bet <= 0) { this.flashMsg('Enter a bet amount.'); return; }
    if (this.bet > bankroll) { this.flashMsg('Bet exceeds bankroll.'); return; }

    // Persist state to registry
    this.registry.set('field', this.field);
    this.registry.set('betHorse', this.selectedIndex);
    this.registry.set('betAmount', this.bet);
    this.registry.set('betType', this.betType);
    this.registry.set('raceMeta', this.race);
    this.registry.set('publicPools', this.pools);

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
    // expose parts for dynamic updates
    container.label = t;
    container.bg = g;
    container._w = w;
    container._h = h;
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
    // Factor in surface/condition/distance and pace archetype
    const meta = this.race;
    const distF = meta.distanceF || 6.0;
    const isWet = /Muddy|Sloppy/i.test(meta.condition);
    const isGood = /Good/i.test(meta.condition);

    const prefDistFromStamina = (stam) => {
      // Map stamina ~[0.8..1.4] to ~[6.0..9.0]f
      const t = Phaser.Math.Clamp((stam - 0.8) / 0.6, 0, 1);
      return 6.0 + t * 3.0;
    };

    const distFactor = (h) => {
      const pref = prefDistFromStamina(h.stamina);
      const dx = distF - pref;
      const sigma = 1.1;
      return Math.exp(-(dx * dx) / (2 * sigma * sigma)); // 0..1
    };

    const surfaceFactor = (h) => {
      if (isWet) return 0.88 + 0.24 * Phaser.Math.Clamp(h.mud, 0, 1); // ~0.88..1.12
      if (isGood) return 0.98 + 0.04 * Phaser.Math.Clamp(h.mud, 0, 1);
      // Fast
      return 1.02; // slight speed up on fast track
    };

    const paceFactor = (h) => {
      if (distF <= 6.5) {
        if (h.pace === 'Front-Runner') return 1.06;
        if (h.pace === 'Closer') return 0.95;
      } else if (distF >= 8.0) {
        if (h.pace === 'Closer') return 1.06;
        if (h.pace === 'Front-Runner') return 0.96;
      }
      return 1.0; // stalkers neutral
    };

    const baseScores = field.map(h => (
      h.base * h.gate * (0.6 + 0.4 * h.stamina) * (0.8 + 0.2 * h.burst)
      * distFactor(h) * surfaceFactor(h) * paceFactor(h)
    ));

    const maxS = Math.max(...baseScores, 1e-6);
    const k = 1.15;
    const expScores = baseScores.map(s => Math.pow(s / maxS, k));
    const sumExp = expScores.reduce((a, b) => a + b, 0);

    const margin = 0.9; // 10% house
    for (let i = 0; i < field.length; i++) {
      const p = (expScores[i] / Math.max(1e-6, sumExp)) * margin;
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
    const trackType = 'Straight';
    return { surface, weather, condition, distanceF, trackType };
  }

  toggleTrackType() {
    this.race.trackType = (this.race.trackType === 'Straight') ? 'Oval' : 'Straight';
    this.registry.set('trackType', this.race.trackType);
    if (this.ui?.trackBtn?.label) this.ui.trackBtn.label.setText(`Track: ${this.race.trackType}`);
    this.flashMsg(`Track set to ${this.race.trackType}`);
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
      if (row.oddsText) {
        row.oddsText.setText(this.formatDisplayedPrice(i));
      }
    });
    // Update toggle button label
    if (this.ui.oddsBtn?.label) {
      const fmt = this.registry.get('oddsFormat') || 'decimal';
      this.ui.oddsBtn.label.setText(`Odds: ${fmt === 'decimal' ? 'Decimal' : 'American'}`);
    }
  }

  // ===== Glossary modal =====
  showGlossary() {
    if (this.ui.glossary) { this.hideGlossary(); }
    const { width, height } = this.scale;
    const layer = this.add.container(0, 0);
    const scrim = this.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.hideGlossary());
    const panelW = Math.min(720, width - 80);
    const panelH = Math.min(460, height - 120);
    const px = (width - panelW) / 2;
    const py = (height - panelH) / 2;
    const g = this.add.graphics();
    g.fillStyle(0x0f1a2c, 0.98);
    g.fillRoundedRect(px, py, panelW, panelH, 12);
    g.lineStyle(1, 0x1f2a3b, 1);
    g.strokeRoundedRect(px + 0.5, py + 0.5, panelW - 1, panelH - 1, 12);
    const title = this.add.text(width / 2, py + 16, 'Betting Glossary', { fontSize: '22px', color: '#e6edf3' }).setOrigin(0.5, 0);
    const body = this.add.text(px + 16, py + 52,
`Win (W): Horse must finish 1st. Payouts come from the Win pool.
Place (P): Horse must finish 1st or 2nd. The Place pool is split between the top two finishers.
Show (S): Horse must finish 1st, 2nd, or 3rd. The Show pool is split among the top three.

Pari-mutuel pools: All public bets go into separate pools (W/P/S). The track takeout is ~18%; the remaining net pool is split among winning bettors.

Displayed odds:
- Toggle between Decimal and American odds using the Odds button.
- W/P/S all display odds derived from their respective pools (Place splits pool in half; Show splits in thirds). Actual payouts depend on final pools and finishers.`,
      { fontSize: '14px', color: '#c8d1e6', wordWrap: { width: panelW - 32 } });
    const closeBtn = this.makeButton(width / 2 - 60, py + panelH - 56, 120, 40, 'Close', () => this.hideGlossary());
    layer.add([scrim, g, title, body, closeBtn]);
    this.ui.glossary = layer;
  }

  hideGlossary() {
    try { this.ui.glossary?.destroy(true); } catch (_) {}
    this.ui.glossary = null;
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
