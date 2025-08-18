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

  // ===== Rounded-oval helpers (racetrack: straights + semicircles) =====
  rrPerimeter(r, straightHalf) {
    // two semicircles + two straights (top & bottom)
    return 2 * Math.PI * r + 4 * straightHalf;
  }

  rrPointAtS(s, offset = 0) {
    // Parametric point along the rounded-rectangle for distance s (clockwise),
    // with an outward normal offset. rOff affects the arcs' radius; straights keep same length.
    const { cx, cy } = this.track;
    const rOff = this.rrR + offset;
    const straight = this.rrStraight; // half-length of each straight between arc centers
    const perim = this.rrPerimForR(rOff);
    let u = ((s % perim) + perim) % perim; // wrap 0..perim

    // segment lengths
    const L0 = Math.PI * rOff;               // right semicircle (top -> bottom)
    const L1 = 2 * straight;                 // bottom straight (right -> left)
    const L2 = Math.PI * rOff;               // left semicircle (bottom -> top)
    const L3 = 2 * straight;                 // top straight (left -> right)

    // right arc center
    const rx = cx + straight;
    const ry = cy;

    if (u < L0) {
      // Right semicircle: φ from -π/2 -> +π/2
      const phi = -Math.PI / 2 + (u / rOff);
      const x = rx + rOff * Math.cos(phi);
      const y = ry + rOff * Math.sin(phi);
      const tangent = phi + Math.PI / 2;
      return { x, y, tangent };
    }
    u -= L0;

    if (u < L1) {
      // Bottom straight: right -> left at y = cy + rOff
      const x = cx + straight - u;
      const y = cy + rOff;
      const tangent = Math.PI; // heading left
      return { x, y, tangent };
    }
    u -= L1;

    if (u < L2) {
      // Left semicircle: φ from +π/2 -> +3π/2
      const lx = cx - straight;
      const ly = cy;
      const phi = Math.PI / 2 + (u / rOff);
      const x = lx + rOff * Math.cos(phi);
      const y = ly + rOff * Math.sin(phi);
      const tangent = phi + Math.PI / 2;
      return { x, y, tangent };
    }
    u -= L2;

    // Top straight: left -> right at y = cy - rOff
    // u in [0, L3)
    const x = cx - straight + u;
    const y = cy - rOff;
    const tangent = 0; // heading right
    return { x, y, tangent };
  }

  rrPointByS(s, laneIdx) {
    const d = (laneIdx - this.track.lanes / 2 + 0.5) * this.track.laneH;
    return this.rrPointAtS(s, d);
  }

  rrPerimForR(r) {
    return this.rrPerimeter(r, this.rrStraight);
  }

  drawOffsetRRPath(g, offset) {
    const steps = 64;
    const { cx, cy } = this.track;
    const r = this.rrR + offset;
    const straight = this.rrStraight;

    // Right arc: -π/2 -> +π/2
    g.beginPath();
    for (let i = 0; i <= steps; i++) {
      const phi = -Math.PI / 2 + (i / steps) * Math.PI;
      const x = cx + straight + r * Math.cos(phi);
      const y = cy + r * Math.sin(phi);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    // Bottom straight to left
    g.lineTo(cx - straight, cy + r);
    // Left arc: +π/2 -> +3π/2
    for (let i = 0; i <= steps; i++) {
      const phi = Math.PI / 2 + (i / steps) * Math.PI;
      const x = cx - straight + r * Math.cos(phi);
      const y = cy + r * Math.sin(phi);
      g.lineTo(x, y);
    }
    // Top straight to right
    g.lineTo(cx + straight, cy - r);
    g.strokePath();
  }

  // Trace a rounded-rectangle into current path without stroking/filling
  traceRR(g, offset, dir = 1, steps = 64) {
    const { cx, cy } = this.track;
    const r = this.rrR + offset;
    const straight = this.rrStraight;
    if (dir === 1) {
      // start at top of right arc
      for (let i = 0; i <= steps; i++) {
        const phi = -Math.PI / 2 + (i / steps) * Math.PI;
        const x = cx + straight + r * Math.cos(phi);
        const y = cy + r * Math.sin(phi);
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.lineTo(cx - straight, cy + r);
      for (let i = 0; i <= steps; i++) {
        const phi = Math.PI / 2 + (i / steps) * Math.PI;
        const x = cx - straight + r * Math.cos(phi);
        const y = cy + r * Math.sin(phi);
        g.lineTo(x, y);
      }
      g.lineTo(cx + straight, cy - r);
    } else {
      // reverse direction
      g.moveTo(cx + straight, cy - r);
      g.lineTo(cx - straight, cy - r);
      for (let i = steps; i >= 0; i--) {
        const phi = Math.PI / 2 + (i / steps) * Math.PI;
        const x = cx - straight + r * Math.cos(phi);
        const y = cy + r * Math.sin(phi);
        g.lineTo(x, y);
      }
      g.lineTo(cx + straight, cy + r);
      for (let i = steps; i >= 0; i--) {
        const phi = -Math.PI / 2 + (i / steps) * Math.PI;
        const x = cx + straight + r * Math.cos(phi);
        const y = cy + r * Math.sin(phi);
        g.lineTo(x, y);
      }
    }
  }

  // Fill the track band (outer to inner) with a solid color
  fillRRBand(g, innerOffset, outerOffset, color, alpha = 1) {
    g.fillStyle(color, alpha);
    g.beginPath();
    this.traceRR(g, outerOffset, 1);
    this.traceRR(g, innerOffset, -1);
    g.closePath();
    g.fillPath();
  }

  create() {
    const field = this.registry.get('field');
    const betIdx = this.registry.get('betHorse');
    const betAmt = this.registry.get('betAmount');
    const betType = this.registry.get('betType') || 'win';
    const publicPools = this.registry.get('publicPools');

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
    this.betType = betType;
    this.pools = publicPools;

    // Race meta (surface, condition, distance, weather) from MenuScene
    this.meta = this.registry.get('raceMeta') || { surface: 'Dirt', condition: 'Fast', distanceF: 6.0, weather: 'Sunny' };
    // Force straight track only (disable oval mode entirely)
    this.meta.trackType = 'Straight';
    this.registry.set('raceMeta', this.meta);

    // Deduct stake
    const bank = this.registry.get('bankroll') ?? 1000;
    const newBank = Math.max(0, bank - this.betAmt);
    this.registry.set('bankroll', newBank);

    // RNG
    this.rng = this.makeRng(Date.now());

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0d1117');

    // Pixels per furlong (used by oval distance)
    this.pxPerF = 400;

    // World size and track
    if ((this.meta?.trackType) === 'Oval') {
      // Oval track mode (no scrolling camera)
      const lanes = this.field.length;
      const laneH = 48;
      const ringMargin = 20;
      const ringW = lanes * laneH + ringMargin * 2;
      const aOuter = Math.min(width, height) * 0.42; // x-radius outer (visual guide)
      const bOuter = aOuter * 0.65; // y-radius outer (visual guide)
      const aMid = aOuter - ringW * 0.5; // mid-lane semi-major (visual guide)
      const bMid = bOuter - ringW * 0.5; // mid-lane semi-minor (visual guide)
      const cx = width / 2;
      const cy = height / 2 + 10;
      // Rounded-rectangle parameters derived from mid radii
      const rrR = bMid; // arc radius equals minor radius
      const rrStraight = Math.max(40, aMid - bMid); // half straight length between arc centers
      const startS = 0; // start at top of right arc

      this.track = {
        mode: 'oval',
        lanes,
        laneH,
        ringMargin,
        ringW,
        cx,
        cy,
        aOuter,
        bOuter,
        aMid,
        bMid,
        // rounded rectangle specific
        rrR,
        rrStraight,
        startS,
      };
      // Camera bounds to screen
      this.cameras.main.setBounds(0, 0, width, height);
      this.drawTrack();
      // Precompute path length for mid-lane (rounded rectangle)
      this.ovalPathLen = this.rrPerimForR(this.track.rrR);
      // Calibrate so that one lap ~ 8 furlongs (typical 1 mile oval)
      this.pxPerF = this.ovalPathLen / 8;
      this.ovalDistancePx = Math.max(200, (this.meta.distanceF || 6) * this.pxPerF);
    } else {
      // Straight track — scale length by selected distance
      const distF = (this.meta?.distanceF) || 6.0;
      const lengthPx = Math.round(distF * this.pxPerF);
      const left = 80;
      const startX = 160;
      // Include start offset so (finishX - startX) === distF * pxPerF exactly
      const totalLen = lengthPx + (startX - left);
      this.track = {
        mode: 'straight',
        lanes: this.field.length,
        laneH: 48,
        top: 120,
        left,
        startX,
        length: totalLen,
      };
      this.cameras.main.setBounds(0, 0, this.track.left + this.track.length + 240, height);
      this.drawTrack();
    }

    // Create horses: prefer numbered image assets; fallback to procedural vector build
    this.horses = this.field.map((h, i) => {
      let x0, y0, rot0 = 0;
      if (this.track.mode === 'oval') {
        const p = this.rrPointByS(0, i);
        x0 = p.x; y0 = p.y; rot0 = p.tangent;
      } else {
        const y = this.track.top + i * this.track.laneH + this.track.laneH * 0.5;
        x0 = this.track.startX - 40; y0 = y; rot0 = 0;
      }

      let sprite, baseScaleX = 1, baseScaleY = 1;
      let legs, tail, mane, head, headBaseY;
      const key = h.spriteKey;
      if (key && this.textures.exists(key)) {
        // Use provided image and scale to lane height
        const targetH = this.track.laneH * 0.86;
        sprite = this.add.image(x0, y0, key).setOrigin(0.5, 0.5);
        const s = targetH / sprite.height;
        baseScaleX = s;
        baseScaleY = s;
        sprite.setScale(baseScaleX, baseScaleY);
        sprite.setDepth(10 + i);
        if (this.track.mode === 'oval') sprite.setRotation(rot0);
      } else {
        // Fallback: procedural vector art container
        const built = this.buildHorseContainer(h, i, x0, y0);
        sprite = built.container;
        legs = built.legs;
        tail = built.tail;
        mane = built.mane;
        head = built.head;
        headBaseY = built.headBaseY;
        if (this.track.mode === 'oval') sprite.setRotation(rot0);
      }
      const num = this.add.text(x0, y0 - 28, `${i + 1}`, { fontSize: '12px', color: '#0b0c10' }).setOrigin(0.5);

      // Runtime state
      return {
        data: h,
        idx: i,
        sprite,
        num,
        x: x0,
        y: y0,
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
        // precompute simple preferences
        prefDistF: this.prefDistFromStamina(h.stamina),
        // oval-specific progress in pixels along mid-lane
        sPx: 0,
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

    // Infield / background
    g.fillStyle(0x163a24, 1);
    g.fillRect(0, 0, this.cameras.main.getBounds().width, height);

    if (this.track.mode === 'oval') {
      // Filled dirt band (outer/inner) for a clean racetrack look
      const dirt = 0x7f5a3a;
      this.fillRRBand(g, -this.track.ringW / 2, +this.track.ringW / 2, dirt, 1);

      // Lane separator lines
      g.lineStyle(2, 0xd2b48c, 0.6);
      for (let i = 0; i <= this.track.lanes; i++) {
        const d = (i - this.track.lanes / 2) * this.track.laneH;
        this.drawOffsetRRPath(g, d);
      }

      // Inner/Outer safety rails
      g.lineStyle(3, 0xffffff, 0.95);
      this.drawOffsetRRPath(g, -this.track.ringW / 2 + 6);
      this.drawOffsetRRPath(g, +this.track.ringW / 2 - 6);

      // Start / Finish marks along path distance
      const startS = (this.track.startS || 0) % this.ovalPathLen;
      const finishS = (startS + (this.ovalDistancePx % this.ovalPathLen)) % this.ovalPathLen;
      const drawGate = (s, col) => {
        const pIn = this.rrPointAtS(s, -this.track.ringW / 2);
        const pOut = this.rrPointAtS(s, +this.track.ringW / 2);
        g.lineStyle(3, col, 1);
        g.beginPath(); g.moveTo(pIn.x, pIn.y); g.lineTo(pOut.x, pOut.y); g.strokePath();
      };
      drawGate(startS, 0xffffff);
      drawGate(finishS, 0xffffff);

      // Title banner (kept minimal)
      this.add.text(16, 16, 'Derby Dash — Oval Track', { fontSize: '20px', color: '#e6edf3' });
    } else {
      // Straight dirt rectangle
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

      // Start gate
      g.fillStyle(0xffffff, 1);
      g.fillRect(this.track.startX - 4, trackTop, 8, trackH);

      // Finish — checkered stripe with label
      this.finishX = this.track.left + this.track.length;
      const stripeW = 24;
      const square = 8;
      const x0 = this.finishX - stripeW / 2;
      for (let yy = 0; yy < trackH; yy += square) {
        for (let xx = 0; xx < stripeW; xx += square) {
          const isWhite = ((Math.floor(xx / square) + Math.floor(yy / square)) % 2 === 0);
          g.fillStyle(isWhite ? 0xffffff : 0x0b0c10, 1);
          g.fillRect(x0 + xx, trackTop + yy, square, square);
        }
      }
      g.lineStyle(1, 0xffffff, 0.9);
      g.strokeRect(x0, trackTop, stripeW, trackH);
      // Move FINISH label to bottom so it doesn't obscure the leaderboard
      this.add.text(this.finishX, trackTop + trackH + 18, 'FINISH', { fontSize: '16px', color: '#e6edf3' }).setOrigin(0.5);

      // Furlong poles (every 1f, and half-furlong if applicable)
      const distF = (this.meta?.distanceF) || 6.0;
      const wholeF = Math.floor(distF);
      g.fillStyle(0xe6edf3, 0.85);
      for (let i = 1; i < wholeF; i++) {
        const x = this.track.startX + i * this.pxPerF;
        g.fillRect(x - 1, trackTop, 2, trackH);
      }
      if (Math.abs(distF - (wholeF + 0.5)) < 0.001) {
        const xh = this.track.startX + (wholeF + 0.5) * this.pxPerF;
        g.fillStyle(0xffd58a, 0.9);
        g.fillRect(xh - 1, trackTop, 2, trackH);
      }

      // Safety rails (top/bottom)
      g.lineStyle(4, 0xffffff, 0.9);
      const railYTop = this.track.top - 14;
      const railYBot = this.track.top + this.track.lanes * this.track.laneH + 14;
      g.strokeLineShape(new Phaser.Geom.Line(this.track.left, railYTop, this.track.left + this.track.length + 200, railYTop));
      g.strokeLineShape(new Phaser.Geom.Line(this.track.left, railYBot, this.track.left + this.track.length + 200, railYBot));

      // Title banner
      this.add.text(this.track.left + 10, 20, `Derby Dash — Straight Track — ${((this.meta?.distanceF) || 6).toFixed(1)}f`, { fontSize: '20px', color: '#e6edf3' });
    }
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
    // Race meta (fixed HUD top-left)
    const distF = (this.meta?.distanceF) || 6.0;
    const metaLine = `Distance: ${distF.toFixed(1)}f  •  ${this.meta?.surface || 'Dirt'} ${this.meta?.condition || 'Fast'}`;
    this.hud.meta = this.add.text(16, 16, metaLine, { fontSize: '14px', color: '#e6edf3' }).setScrollFactor(0);
    this.hud.bank = this.add.text(16, height - 44, `Bankroll: $${bank}`, { fontSize: '16px', color: '#94c6ff' }).setScrollFactor(0);
    const d = this.decimalOddsFor(this.betType || 'win', this.betIdx, sel?.oddsDec);
    // Debug: verify HUD odds source
    try {
      // eslint-disable-next-line no-console
      console.log('[RaceScene][HUD]', {
        betType: this.betType,
        horseIndex: this.betIdx,
        horseName: sel?.name,
        poolsPresent: !!this.pools,
        decimalOdds: d,
        fallbackML: sel?.oddsDec
      });
    } catch (_) {}
    const oddsStr = (Number.isFinite(d) && d > 1) ? this.formatOdds(d) : this.formatOdds(sel.oddsDec || 2.0);
    const label = (this.betType || 'win').toUpperCase();
    this.hud.bet = this.add.text(16, height - 24, `Bet (${label}): $${this.betAmt} on #${this.betIdx + 1} (${sel.name}) @ ${oddsStr}`, { fontSize: '14px', color: '#ffd58a' }).setScrollFactor(0);

    // Leaderboard (moved slightly up)
    this.leaderboard = this.add.text(width - 240, 8, '', { fontSize: '14px', color: '#e6edf3' }).setScrollFactor(0);
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
        // Base movement & meta effects
        const base = h.data.base; // px/frame at 60fps
        let speed = base;

        // Race meta
        const distTotal = (this.track.mode === 'oval')
          ? Math.max(1, this.ovalDistancePx)
          : Math.max(1, (this.finishX - this.track.startX));
        const progress = (this.track.mode === 'oval')
          ? Phaser.Math.Clamp((h.sPx || 0) / distTotal, 0, 1)
          : Phaser.Math.Clamp((h.x - this.track.startX) / distTotal, 0, 1);
        const distF = (this.meta?.distanceF) || 6.0;
        const isWet = /Muddy|Sloppy/i.test(this.meta?.condition || '');
        const isGood = /Good/i.test(this.meta?.condition || '');

        // Surface multiplier
        const mud = Phaser.Math.Clamp(h.data.mud ?? 1, 0, 1);
        let surfaceMul = 1.02; // Fast slight buff
        if (isGood) surfaceMul = 0.98 + 0.04 * mud;
        if (isWet) surfaceMul = 0.88 + 0.24 * mud;

        // Distance fit multiplier (Gaussian around pref distance)
        const dx = (distF - (h.prefDistF ?? 6.5));
        const sigma = 1.1;
        const distFit = Math.exp(-(dx * dx) / (2 * sigma * sigma)); // 0..1

        // Phase pacing based on archetype
        let phaseMul = 1.0;
        let drainMul = 1.0;
        if (progress < 0.33) {
          // Early
          if (h.data.pace === 'Front-Runner') { phaseMul *= 1.06; drainMul *= 1.12; }
          if (h.data.pace === 'Closer') { phaseMul *= 0.97; drainMul *= 0.92; }
        } else if (progress < 0.66) {
          // Mid
          if (h.data.pace === 'Stalker') { phaseMul *= 1.03; }
        } else {
          // Late
          if (h.data.pace === 'Closer') { phaseMul *= 1.08 + 0.06 * Phaser.Math.Clamp(h.data.burst - 0.8, 0, 0.6); drainMul *= 1.04; }
          if (h.data.pace === 'Front-Runner') { phaseMul *= 0.96; drainMul *= 1.08; }
        }

        // Energy drain and fatigue
        let drain = 0.0035; // base per frame (60fps-scaled later)
        if (isWet) drain *= 1.05; // slog
        drain *= drainMul;
        h.energy = Math.max(0, h.energy - drain * scale);
        const fatigue = 0.6 + 0.4 * (h.energy / (4.5 * h.data.stamina));
        speed *= fatigue;

        // Apply meta-driven multipliers
        speed *= surfaceMul * (0.9 + 0.1 * distFit) * phaseMul;

        // Random variance
        const noise = (this.rng() - 0.5) * h.data.variance;
        speed *= 1 + noise;

        // Occasional bursts (pace-sensitive timing)
        h.burstCooldown -= delta;
        let burstChance = 0.08;
        if (h.data.pace === 'Closer' && progress > 0.7) burstChance = 0.16;
        if (h.data.pace === 'Front-Runner' && progress < 0.35) burstChance = 0.13;
        if (h.burstCooldown < 0 && this.rng() < burstChance) {
          speed *= 1 + 0.22 * h.data.burst;
          h.burstCooldown = 1200 + this.rng() * 2200;
        }

        // Previous positions for precise finish interpolation
        const prevX = h.x;
        const prevS = h.sPx || 0;

        h.v = speed;
        if (this.track.mode === 'oval') {
          const newS = prevS + h.v * scale;
          if (newS >= this.ovalDistancePx) {
            // Interpolate exact crossing time within this frame
            const frac = Phaser.Math.Clamp((this.ovalDistancePx - prevS) / Math.max(1e-6, newS - prevS), 0, 1);
            h.sPx = this.ovalDistancePx;
            const sExact = (this.track.startS || 0) + h.sPx;
            const p = this.rrPointByS(sExact, h.idx);
            h.x = p.x; h.y = p.y;
            if (h.sprite?.setRotation) h.sprite.setRotation(p.tangent);
            h.finished = true;
            h.finishTime = (time - delta) + frac * delta;
            this.finished.push(h);
          } else {
            h.sPx = newS;
            // map sPx -> rounded-rectangle distance along mid-lane
            const s = (this.track.startS || 0) + h.sPx;
            const p = this.rrPointByS(s, h.idx);
            h.x = p.x; h.y = p.y;
            if (h.sprite?.setRotation) h.sprite.setRotation(p.tangent);
          }
        } else {
          const newX = prevX + h.v * scale;
          if (newX >= this.finishX) {
            // Interpolate exact crossing time within this frame
            const frac = Phaser.Math.Clamp((this.finishX - prevX) / Math.max(1e-6, newX - prevX), 0, 1);
            h.x = this.finishX;
            h.finished = true;
            h.finishTime = (time - delta) + frac * delta;
            this.finished.push(h);
          } else {
            h.x = newX;
          }
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
            // Convert container-local hoof point to world, accounting for rotation
            const lx = leg.group.x + leg.hoof.x;
            const ly = leg.hoof.y;
            const rot = h.sprite.rotation || 0;
            const cos = Math.cos(rot), sin = Math.sin(rot);
            const wx = h.sprite.x + (lx * cos - ly * sin);
            const wy = h.sprite.y + (lx * sin + ly * cos);
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
      if (this.track.mode === 'straight') {
        leadX = Math.max(leadX, h.x);
      }
    });

    // Camera follows leader
    if (this.track.mode === 'straight') {
      const cam = this.cameras.main;
      const targetScroll = Phaser.Math.Clamp(leadX - 200, 0, this.track.left + this.track.length + 240 - cam.width);
      cam.scrollX = Phaser.Math.Linear(cam.scrollX, targetScroll, 0.08);
    }

    // Update leaderboard (stable): finished first by precise finishTime, then distance
    const order = [...this.horses].sort((a, b) => {
      const af = !!a.finished, bf = !!b.finished;
      if (af && bf) {
        return (a.finishTime || Infinity) - (b.finishTime || Infinity);
      } else if (af) {
        return -1;
      } else if (bf) {
        return 1;
      }
      // Both still running: sort by distance covered
      if (this.track.mode === 'oval') return (b.sPx || 0) - (a.sPx || 0);
      return (b.x || 0) - (a.x || 0);
    });

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

    // Final order by finishTime, fallback by distance covered (x or sPx)
    const results = [...this.horses]
      .sort((a, b) => {
        const ft = (a.finishTime - b.finishTime);
        if (ft !== 0) return ft;
        if (this.track.mode === 'oval') return (b.sPx || 0) - (a.sPx || 0);
        return (b.x - a.x);
      })
      .map(h => h.idx);

    const winnerIdx = results[0];
    const winner = this.field[winnerIdx];

    // Show final leaderboard order by results
    const lines = results.map((idx, i) => `${i + 1}. #${idx + 1} ${this.field[idx].name}`);
    this.leaderboard.setText(lines.join('\n'));

    // Payouts: Win/Place/Show using pari-mutuel pools if available
    let bank = this.registry.get('bankroll');
    let payout = 0;
    const pos = results.indexOf(this.betIdx); // 0-based placing
    const pools = this.pools;
    const type = this.betType || 'win';

    const clampAlloc = (x) => Math.max(1e-6, x || 0);
    if (pools && pools.takeout) {
      // Important: We deducted stake at race start. Tote (decimal) odds include the returned stake.
      // Therefore we must pay back (stake + winnings). That is: payout = betAmt * (1 + netSharePerDollar).
      if (type === 'win' && pos === 0) {
        const after = pools.win.total * (1 - (pools.takeout.win ?? 0.18));
        const alloc = clampAlloc(pools.win.alloc[this.betIdx]);
        const perDollarNet = after / alloc;          // winnings per $1 (excludes stake)
        const perDollarReturn = 1 + perDollarNet;    // total returned per $1 (includes stake)
        payout = Math.round(this.betAmt * perDollarReturn);
      } else if (type === 'place' && pos > -1 && pos <= 1) {
        const after = pools.place.total * (1 - (pools.takeout.place ?? 0.18));
        const split = after / 2;
        const alloc = clampAlloc(pools.place.alloc[this.betIdx]);
        const perDollarNet = split / alloc;
        const perDollarReturn = 1 + perDollarNet;
        payout = Math.round(this.betAmt * perDollarReturn);
      } else if (type === 'show' && pos > -1 && pos <= 2) {
        const after = pools.show.total * (1 - (pools.takeout.show ?? 0.18));
        const split = after / 3;
        const alloc = clampAlloc(pools.show.alloc[this.betIdx]);
        const perDollarNet = split / alloc;
        const perDollarReturn = 1 + perDollarNet;
        payout = Math.round(this.betAmt * perDollarReturn);
      }
    } else {
      // Fallback: legacy fixed odds (decimal includes stake)
      if (type === 'win' && pos === 0) {
        payout = Math.round(this.betAmt * (winner.oddsDec || 2.0));
      }
    }

    if (payout > 0) {
      bank += payout;
      const label = type.toUpperCase();
      this.showBanner(`WINNER #${winnerIdx + 1} ${winner.name}\n${label} payout $${payout}`, '#7ae582');
    } else {
      const post = bank <= 0 ? '\nYou are out of money.' : '\nBetter luck next time.';
      this.showBanner(`WINNER #${winnerIdx + 1} ${winner.name}${post}`, '#ff7d7d', bank <= 0 ? {
        label: 'Rebuy $1000',
        action: () => { this.registry.set('bankroll', 1000); this.scene.start('RaceSelectScene'); }
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

    const label = altBtn?.label || 'Back to Races';
    const click = altBtn?.action || (() => { this.scene.start('RaceSelectScene'); });
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

  // Derive decimal odds from pari-mutuel pools for the selected bet type
  decimalOddsFor(type, idx, fallbackDec = NaN) {
    const eps = 1e-6;
    const pools = this.pools;
    if (!pools) {
      // Fallback to ML for Win only
      if (type === 'win' && Number.isFinite(fallbackDec)) return fallbackDec;
      return NaN;
    }
    if (type === 'win') {
      const net = pools.win.total * (1 - (pools.takeout?.win ?? 0.18));
      const alloc = Math.max(eps, pools.win.alloc[idx] ?? 0);
      return 1 + (net / alloc);
    }
    if (type === 'place') {
      const net = pools.place.total * (1 - (pools.takeout?.place ?? 0.18));
      const alloc = Math.max(eps, pools.place.alloc[idx] ?? 0);
      return 1 + ((net / 2) / alloc);
    }
    if (type === 'show') {
      const net = pools.show.total * (1 - (pools.takeout?.show ?? 0.18));
      const alloc = Math.max(eps, pools.show.alloc[idx] ?? 0);
      return 1 + ((net / 3) / alloc);
    }
    return Number.isFinite(fallbackDec) ? fallbackDec : NaN;
  }

  // Preferred distance estimator from stamina
  prefDistFromStamina(stam) {
    const t = Phaser.Math.Clamp((stam - 0.8) / 0.6, 0, 1);
    return 6.0 + t * 3.0; // 6f .. 9f
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
