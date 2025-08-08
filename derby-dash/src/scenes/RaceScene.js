export default class RaceScene extends Phaser.Scene {
  constructor() {
    super('RaceScene');
    this.field = [];
    this.betIdx = -1;
    this.betAmt = 0;
    this.horses = [];
    this.leaderboard = null;
    this.finished = [];
    this.rng = null;
    this.raceState = 'init'; // init|countdown|running|results
  }

  create() {
    const field = this.registry.get('field');
    const betIdx = this.registry.get('betHorse');
    const betAmt = this.registry.get('betAmount');

    if (!field || typeof betIdx !== 'number' || typeof betAmt !== 'number') {
      this.scene.start('MenuScene');
      return;
    }
    // Reset runtime state for fresh race
    this.finished = [];
    this.horses = [];
    this.leaderboard = null;
    this.raceState = 'init';

    this.field = field;
    this.betIdx = betIdx;
    this.betAmt = betAmt;

    // Deduct stake
    const bank = this.registry.get('bankroll') ?? 1000;
    const newBank = Math.max(0, bank - this.betAmt);
    this.registry.set('bankroll', newBank);

    // RNG
    this.rng = this.makeRng(Date.now());

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0d1117');

    // World size and track
    this.track = {
      lanes: this.field.length,
      laneH: 48,
      top: 120,
      left: 80,
      startX: 160,
      length: Math.max(2400, Math.floor(width * 2.2)),
    };
    this.cameras.main.setBounds(0, 0, this.track.left + this.track.length + 240, height);

    this.drawTrack();

    // Back to site home (fixed to screen)
    const backBtn = this.makeButton(16, 16, 90, 32, '← Back', () => {
      window.location.href = 'https://kxrnage.com/';
    });
    backBtn.setDepth(3000);
    if (typeof backBtn.setScrollFactor === 'function') backBtn.setScrollFactor(0);

    // Create horses: prefer numbered image assets; fallback to procedural vector build
    this.horses = this.field.map((h, i) => {
      const y = this.track.top + i * this.track.laneH + this.track.laneH * 0.5;
      let sprite, baseScaleX = 1, baseScaleY = 1;
      let legs, tail, mane, head, headBaseY;
      const key = h.spriteKey;
      if (key && this.textures.exists(key)) {
        // Use provided image and scale to lane height
        sprite = this.add.image(this.track.startX - 40, y, key).setOrigin(0.5, 0.5);
        const targetH = this.track.laneH * 0.86;
        const s = targetH / sprite.height;
        baseScaleX = s;
        baseScaleY = s;
        sprite.setScale(baseScaleX, baseScaleY);
        sprite.setDepth(10 + i);
      } else {
        // Fallback: procedural vector art container
        const built = this.buildHorseContainer(h, i, this.track.startX - 40, y);
        sprite = built.container;
        legs = built.legs;
        tail = built.tail;
        mane = built.mane;
        head = built.head;
        headBaseY = built.headBaseY;
      }
      const num = this.add.text(this.track.startX - 40, y - 28, `${i + 1}`, { fontSize: '12px', color: '#0b0c10' }).setOrigin(0.5);

      // Runtime state
      return {
        data: h,
        idx: i,
        sprite,
        num,
        x: this.track.startX - 40,
        y,
        v: 0,
        energy: 4.5 * h.stamina, // abstract energy pool
        startDelay: (1.2 - Math.min(1.2, h.gate)) * 600, // ms delay 0..~180
        burstCooldown: 1000 + this.rng() * 1500,
        finished: false,
        finishTime: Infinity,
        bobPh: this.rng() * Math.PI * 2,
        legs,
        tail,
        mane,
        head,
        headBaseY,
        baseScaleX,
        baseScaleY,
      };
    });

    // UI overlays
    this.makeHud();

    // Countdown then start
    this.countdown(3, () => {
      this.raceState = 'running';
      this.startTime = this.time.now;
    });
  }

  drawTrack() {
    const { width, height } = this.scale;
    const g = this.add.graphics();

    // Infield grass
    g.fillStyle(0x163a24, 1);
    g.fillRect(0, 0, this.cameras.main.getBounds().width, height);

    // Dirt track
    const trackTop = this.track.top - 20;
    const trackH = this.track.lanes * this.track.laneH + 40;
    g.fillStyle(0x7f5a3a, 1);
    g.fillRect(this.track.left, trackTop, this.track.length + 200, trackH);

    // Lane lines
    g.lineStyle(2, 0xd2b48c, 0.6);
    for (let i = 0; i <= this.track.lanes; i++) {
      const y = this.track.top + i * this.track.laneH;
      g.strokeLineShape(new Phaser.Geom.Line(this.track.left, y, this.track.left + this.track.length + 200, y));
    }

    // Start / Finish lines
    g.fillStyle(0xffffff, 1);
    // Start
    g.fillRect(this.track.startX - 4, trackTop, 8, trackH);
    // Finish
    this.finishX = this.track.left + this.track.length;
    g.fillRect(this.finishX - 4, trackTop, 8, trackH);

    // Title banner
    this.add.text(this.track.left + 10, 20, 'Derby Dash — Top-Down', { fontSize: '20px', color: '#e6edf3' });
  }

  // ===== Procedural horse art =====
  shadeMul(hex, f) {
    const r = Math.max(0, Math.min(255, Math.round(((hex >> 16) & 255) * f)));
    const g = Math.max(0, Math.min(255, Math.round(((hex >> 8) & 255) * f)));
    const b = Math.max(0, Math.min(255, Math.round((hex & 255) * f)));
    return (r << 16) | (g << 8) | b;
  }

  // Spawn simple dust puffs at (x, y) using fading ellipses (no texture dependency)
  spawnDust(x, y) {
    for (let i = 0; i < 2; i++) {
      const e = this.add.ellipse(x + (Math.random() * 6 - 3), y + (Math.random() * 3 - 1), 6 + Math.random() * 5, 3 + Math.random() * 2, 0x6f5741, 0.6);
      const driftX = -20 - Math.random() * 25;
      const driftY = -2 + Math.random() * 6;
      this.tweens.add({
        targets: e,
        x: e.x + driftX,
        y: e.y + driftY,
        alpha: 0,
        scaleX: 1.3,
        scaleY: 1.15,
        duration: 500 + Math.random() * 200,
        onComplete: () => e.destroy(),
      });
    }
  }

  buildHorseContainer(h, idx, x, y) {
    const base = h.color;
    const dark = this.shadeMul(base, 0.75);
    const darker = this.shadeMul(base, 0.55);
    const light = this.shadeMul(base, 1.15);
    const hoof = 0x2c1a10;

    const c = this.add.container(x, y);

    // Legs (added first so they render under the body) — articulated: upper + lower + hoof
    const legs = [];
    const hipY = 7;
    const legAnchors = [
      { x: 10, front: true },  // FR
      { x: 5,  front: true },  // FL
      { x: -7, front: false }, // RR
      { x: -13, front: false } // RL
    ];
    legAnchors.forEach(a => {
      const group = this.add.container(a.x, hipY);
      const upperLen = a.front ? 11 : 12;
      const lowerLen = a.front ? 11 : 10;
      const thick = a.front ? 3 : 3.2;
      const upper = this.add.rectangle(0, 0, thick, upperLen, hoof).setOrigin(0.5, 0);
      const lower = this.add.rectangle(0, upperLen, Math.max(2.2, thick - 0.6), lowerLen, hoof).setOrigin(0.5, 0);
      const hoofEl = this.add.ellipse(0, upperLen + lowerLen, 4.5, 2.4, 0x1d120b).setAlpha(0.95);
      group.add([upper, lower, hoofEl]);
      c.add(group);
      legs.push({ group, upper, lower, hoof: hoofEl, upperLen, lowerLen, front: a.front, wasDown: false, dustCooldown: 0 });
    });

    // Tail (wedge behind)
    const tail = this.add.triangle(-22, -2, 0, 0, -12, -7, -12, 7, dark).setStrokeStyle(1, 0x0b0c10, 0.5);
    c.add(tail);

    // Body silhouette (polygon) — longer and slimmer
    const bodyPolyUnder = this.add.polygon(0, 0, [
      -26, -5,  -22, -10,  -10, -12,   4, -11,   12, -9,   18, -6,
       20, -2,   20,  5,    8,   9,   -6,  10,  -18,  8,  -24,  2
    ], darker).setStrokeStyle(1, 0x0b0c10, 0.5);
    const bodyPoly = this.add.polygon(0, -1, [
      -24, -4,  -20, -9,  -8, -11,   4, -10,  12, -8,   18, -5,
       19, -1,   18,  4,    8,   8,   -6,  9,  -18,  7,  -22,  2
    ], base).setStrokeStyle(1, 0x0b0c10, 0.5);
    c.add(bodyPolyUnder);
    c.add(bodyPoly);

    // Neck (tapered) and Head (elongated with muzzle)
    const neck = this.add.polygon(14, -6, [
       -2, -3,   8, -7,   11, -3,    0,  1
    ], base).setStrokeStyle(1, 0x0b0c10, 0.5);
    const head = this.add.polygon(27, -7, [
       -2, -3,   7, -3,   12, -2,  10,  1,   4,  3,   -1,  1
    ], dark).setStrokeStyle(1, 0x0b0c10, 0.5);
    c.add(neck);
    c.add(head);

    // Ears
    const ear1 = this.add.triangle(29, -13, 0, 0, -2, -6, -1, 0, dark).setStrokeStyle(1, 0x0b0c10, 0.5);
    const ear2 = this.add.triangle(31, -12, 0, 0, -2, -6, -1, 0, dark).setStrokeStyle(1, 0x0b0c10, 0.5);
    c.add(ear1);
    c.add(ear2);

    // Mane (zig-zag polygon along top)
    const maneColor = this.shadeMul(base, 0.45);
    const mane = this.add.polygon(2, -10, [
      -12, 0,  -8, -3,  -4, -1,   0, -3,   4, -2,   8, -3,  12, -2,
       10,  1,   6,  0,   2,  1,  -2,  0
    ], maneColor).setAlpha(0.9).setStrokeStyle(1, 0x0b0c10, 0.4);
    c.add(mane);

    // Highlight stripe on back
    const highlight = this.add.rectangle(-6, -8, 18, 3, light).setAlpha(0.24).setAngle(-8);
    c.add(highlight);

    // Underbelly shade
    const belly = this.add.polygon(-2, 2, [
      -14, 4,  -2, 6,  10, 5,   8, 7,  -2, 8,  -14, 6
    ], 0x000000).setAlpha(0.12);
    c.add(belly);

    // Muzzle patch + eye
    const muzzle = this.add.ellipse(36, -6, 6, 4, this.shadeMul(base, 1.3)).setAlpha(0.9);
    const nostril = this.add.ellipse(34, -5, 1.5, 1.5, 0x1a1a1a).setAlpha(0.9);
    const eye = this.add.ellipse(30, -8, 2, 2, 0x0b0c10).setAlpha(0.95);
    c.add(muzzle);
    c.add(nostril);
    c.add(eye);

    // Simple shadow under horse
    const shadow = this.add.ellipse(0, 10, 34, 10, 0x000000, 0.22);
    shadow.setScale(1, 0.9);
    shadow.setDepth(-1);
    c.addAt(shadow, 0);

    // Saddle cloth (small rectangle on barrel)
    const clothColors = [0xf94144, 0xf3722c, 0xf9c74f, 0x90be6d, 0x43aa8b, 0x577590, 0x9b5de5, 0x00bbf9];
    const cloth = this.add.rectangle(2, -3, 10, 8, clothColors[idx % clothColors.length]).setStrokeStyle(1, 0x0b0c10, 0.6);
    c.add(cloth);
    const clothNum = this.add.text(2, -3, `${idx + 1}`, { fontSize: '8px', color: '#ffffff' }).setOrigin(0.5);
    c.add(clothNum);

    // Slight overall scale to fit lane
    c.setScale(0.98);

    return { container: c, legs, tail, mane, head, headBaseY: head.y };
  }

  makeHud() {
    const { width, height } = this.scale;

    // Bankroll & Bet
    const bank = this.registry.get('bankroll');
    const sel = this.field[this.betIdx];
    this.hud = {};
    this.hud.bank = this.add.text(16, height - 44, `Bankroll: $${bank}`, { fontSize: '16px', color: '#94c6ff' }).setScrollFactor(0);
    const oddsStr = this.formatOdds(sel.oddsDec);
    this.hud.bet = this.add.text(16, height - 24, `Bet: $${this.betAmt} on #${this.betIdx + 1} (${sel.name}) @ ${oddsStr}`, { fontSize: '14px', color: '#ffd58a' }).setScrollFactor(0);

    // Leaderboard
    this.leaderboard = this.add.text(width - 240, 16, '', { fontSize: '14px', color: '#e6edf3' }).setScrollFactor(0);
  }

  countdown(n, onGo) {
    const { width, height } = this.scale;
    const t = this.add.text(width / 2, height / 2, `${n}`, { fontSize: '86px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0);
    const tick = (k) => {
      t.setText(k > 0 ? `${k}` : 'GO!');
      this.tweens.add({ targets: t, scale: 1.2, duration: 200, yoyo: true });
      if (k > 0) {
        this.time.delayedCall(700, () => tick(k - 1));
      } else {
        this.time.delayedCall(400, () => { t.destroy(); onGo?.(); });
      }
    };
    tick(n);
    this.raceState = 'countdown';
  }

  update(time, delta) {
    if (this.raceState !== 'running') return;

    const scale = delta / 16.6667; // frames at 60fps

    // Update horses
    let allFinished = true;
    let leadX = 0;
    this.horses.forEach(h => {
      if (h.finished) return;
      allFinished = false;

      const tSinceStart = time - (this.startTime + h.startDelay);
      if (tSinceStart < 0) {
        h.v = 0;
      } else {
        // Base movement
        const base = h.data.base; // px/frame at 60fps
        let speed = base;

        // Energy drain and fatigue
        const drain = 0.0035;
        h.energy = Math.max(0, h.energy - drain * scale);
        const fatigue = 0.6 + 0.4 * (h.energy / (4.5 * h.data.stamina));
        speed *= fatigue;

        // Random variance
        const noise = (this.rng() - 0.5) * h.data.variance;
        speed *= 1 + noise;

        // Occasional bursts
        h.burstCooldown -= delta;
        if (h.burstCooldown < 0 && this.rng() < 0.1) {
          speed *= 1 + 0.25 * h.data.burst;
          h.burstCooldown = 1200 + this.rng() * 2200;
        }

        h.v = speed;
        h.x += h.v * scale;

        if (h.x >= this.finishX) {
          h.x = this.finishX;
          h.finished = true;
          h.finishTime = time;
          this.finished.push(h);
        }
      }

      h.sprite.x = h.x;
      // Subtle vertical bob for life-like movement
      const bob = Math.sin((time / 120) + h.bobPh) * 2;
      h.sprite.y = h.y + bob;
      // Speed-based stretch (slight squash/stretch) multiplied over base scale
      const spNow = Phaser.Math.Clamp(h.v, 0, 20);
      const sxMul = 1 + Math.min(0.06, spNow * 0.015);
      const syMul = 1 - Math.min(0.04, spNow * 0.008);
      const baseX = h.baseScaleX ?? 1;
      const baseY = h.baseScaleY ?? 1;
      h.sprite.setScale(baseX * sxMul, baseY * syMul);
      h.num.x = h.x;
      h.num.y = h.sprite.y - 28;
      // Animate legs (articulated) and tail/mane/head if present
      if (h.legs && h.legs.length === 4) {
        const sp = Phaser.Math.Clamp(h.v, 0, 20);
        const freq = 0.7 + sp * 0.04;
        const t = (time / 120) * freq + h.bobPh;
        // Gallop pairings: FR+RL and FL+RR alternate
        const phases = [0, Math.PI, Math.PI, 0]; // FR, FL, RR, RL
        h.legs.forEach((leg, i) => {
          // cool down dust timer
          leg.dustCooldown = Math.max(0, (leg.dustCooldown || 0) - delta);
          const base = t + phases[i];
          const hipA = Math.sin(base) * (leg.front ? 0.55 : 0.4);
          const kneeA = Math.sin(base + 0.9) * (leg.front ? 0.6 : 0.5);

          // Upper segment rotation about hip
          leg.upper.rotation = hipA;
          // Position lower segment top at end of upper segment
          const ux = Math.sin(hipA) * leg.upperLen;
          const uy = Math.cos(hipA) * leg.upperLen;
          leg.lower.x = ux;
          leg.lower.y = uy;
          // Lower segment rotation relative to vertical (hip+knee)
          const lowerA = hipA + kneeA;
          leg.lower.rotation = lowerA;
          // Hoof at end of lower
          const lx = Math.sin(lowerA) * leg.lowerLen;
          const ly = Math.cos(lowerA) * leg.lowerLen;
          leg.hoof.x = leg.lower.x + lx;
          leg.hoof.y = leg.lower.y + ly;

          // Contact detection against local ground plane (~shadow y=10)
          const groundYLocal = 10;
          const isDown = leg.hoof.y >= groundYLocal - 0.5;
          if (isDown && !leg.wasDown && leg.dustCooldown <= 0 && sp > 4) {
            // Convert to world position for dust
            const wx = h.sprite.x + leg.group.x + leg.hoof.x;
            const wy = h.sprite.y + leg.hoof.y;
            this.spawnDust(wx, wy);
            leg.dustCooldown = 140; // ms between puffs per leg
          }
          leg.wasDown = isDown;
        });
      }
      if (h.tail) {
        const tphase = (time / 140) + h.bobPh * 0.7;
        h.tail.setRotation(Math.sin(tphase) * 0.25);
      }
      if (h.mane) {
        const sp = Phaser.Math.Clamp(h.v, 0, 20);
        const mphase = (time / 160) + h.bobPh * 0.5;
        h.mane.rotation = Math.sin(mphase) * 0.06 * (0.6 + sp * 0.04);
      }
      if (h.head) {
        h.head.y = h.headBaseY + bob * 0.35;
        h.head.rotation = -0.03 + bob * 0.02;
      }
      leadX = Math.max(leadX, h.x);
    });

    // Camera follows leader
    const cam = this.cameras.main;
    const targetScroll = Phaser.Math.Clamp(leadX - 200, 0, this.track.left + this.track.length + 240 - cam.width);
    cam.scrollX = Phaser.Math.Linear(cam.scrollX, targetScroll, 0.08);

    // Update leaderboard
    const order = [...this.horses].sort((a, b) => b.x - a.x);
    const lines = order.map((h, i) => `${i + 1}. #${h.idx + 1} ${h.data.name}`);
    this.leaderboard.setText(lines.join('\n'));

    // End condition: all finished or timeout after first 3
    if (allFinished || (this.finished.length >= Math.min(3, this.horses.length) && time - this.finished[0].finishTime > 2000)) {
      this.endRace();
    }
  }

  endRace() {
    if (this.raceState === 'results') return;
    this.raceState = 'results';

    // Final order by finishTime, fallback by x
    const results = [...this.horses]
      .sort((a, b) => (a.finishTime - b.finishTime) || (b.x - a.x))
      .map(h => h.idx);

    const winnerIdx = results[0];
    const winner = this.field[winnerIdx];

    // Show final leaderboard order by results
    const lines = results.map((idx, i) => `${i + 1}. #${idx + 1} ${this.field[idx].name}`);
    this.leaderboard.setText(lines.join('\n'));

    // Payout: decimal odds includes stake back
    let bank = this.registry.get('bankroll');
    if (this.betIdx === winnerIdx) {
      const payout = Math.round(this.betAmt * winner.oddsDec);
      bank += payout;
      this.showBanner(`WINNER #${winnerIdx + 1} ${winner.name}\nYou won $${payout}!`, '#7ae582');
    } else {
      const post = bank <= 0 ? '\nYou are out of money.' : '\nBetter luck next time.';
      this.showBanner(`WINNER #${winnerIdx + 1} ${winner.name}${post}`, '#ff7d7d', bank <= 0 ? {
        label: 'Rebuy $1000',
        action: () => { this.registry.set('bankroll', 1000); this.scene.start('MenuScene'); }
      } : undefined);
    }
    this.registry.set('bankroll', bank);
  }

  showBanner(text, color = '#ffffff', altBtn) {
    const { width, height } = this.scale;

    const bg = this.add.rectangle(this.cameras.main.scrollX + width / 2, height / 2, width, height, 0x000000, 0.45).setDepth(2000);
    const panel = this.add.rectangle(this.cameras.main.scrollX + width / 2, height / 2, 560, 220, 0x0e1622, 0.95).setDepth(2001);
    panel.setStrokeStyle(2, 0x1f2a3b, 1);

    const t = this.add.text(this.cameras.main.scrollX + width / 2, height / 2 - 20, text, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial',
      fontSize: '24px',
      color,
      align: 'center'
    }).setOrigin(0.5).setDepth(2002);

    const label = altBtn?.label || 'Back to Menu';
    const click = altBtn?.action || (() => { this.scene.start('MenuScene'); });
    const btn = this.makeButton(this.cameras.main.scrollX + width / 2 - 80, height / 2 + 50, 160, 40, label, () => {
      bg.destroy(); panel.destroy(); t.destroy(); btn.destroy();
      click();
    });
    btn.setDepth(2002);
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

  // ===== Odds helpers (display only) =====
  decimalToAmerican(d) {
    if (d >= 2) return Math.round((d - 1) * 100);
    return -Math.round(100 / (d - 1));
  }

  formatOdds(d) {
    const fmt = this.registry.get('oddsFormat') || 'decimal';
    if (fmt === 'american') {
      const am = this.decimalToAmerican(d);
      return am > 0 ? `+${am}` : `${am}`;
    }
    return `${d.toFixed(2)}x`;
  }

  makeRng(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ t >>> 15, 1 | t);
      r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
      return ((r ^ r >>> 14) >>> 0) / 4294967296;
    };
  }
}
