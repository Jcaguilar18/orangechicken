/* ═══════════════════════════════════════════════════════════════
   Orange Chicken — Farm Scene
   Red Barn · Chickens · Green Pasture · Afternoon Sky
   ═══════════════════════════════════════════════════════════════ */

const canvas = document.getElementById('spaceCanvas');
const ctx    = canvas.getContext('2d');

let W, H, time = 0;
let chickens = [], feathers = [], clouds = [];
let mouse = { x: 0, y: 0 };

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', () => { resize(); init(); });
window.addEventListener('mousemove', e => {
  mouse.x = e.clientX / W - 0.5;
  mouse.y = e.clientY / H - 0.5;
});

const GND = () => H * 0.68;

/* ════════════════════ CLOUDS ════════════════════ */
class Cloud {
  constructor(cold) {
    this.x  = cold ? Math.random() * (W + 600) - 200 : -400;
    this.y  = Math.random() * GND() * 0.42 + GND() * 0.04;
    this.vx = Math.random() * 0.22 + 0.06;
    this.w  = Math.random() * 220 + 120;
    this.a  = Math.random() * 0.88 + 0.12;
  }
  update() {
    this.x += this.vx + mouse.x * 0.3;
    if (this.x > W + 460) {
      this.x = -380;
      this.y = Math.random() * GND() * 0.42 + GND() * 0.04;
    }
  }
  draw() {
    const x = this.x, y = this.y, w = this.w, h = w * 0.38;
    ctx.save();
    ctx.globalAlpha = this.a;
    ctx.fillStyle   = '#FFFFFF';
    ctx.shadowBlur  = 18;
    ctx.shadowColor = 'rgba(255,255,255,0.4)';
    // Puffs
    ctx.beginPath();
    ctx.ellipse(x,             y,           w * 0.46, h * 0.56, 0, 0, Math.PI * 2);
    ctx.ellipse(x - w * 0.22,  y + h * 0.1, w * 0.30, h * 0.44, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.24,  y + h * 0.1, w * 0.30, h * 0.44, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.08,  y + h * 0.22,w * 0.44, h * 0.30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ════════════════════ CHICKEN ════════════════════ */
const PALETTES = [
  { body: '#C85A10', wing: '#8A3408', comb: '#CC1600' },  // Rhode Island Red
  { body: '#D48820', wing: '#A86008', comb: '#CC1600' },  // Orange
  { body: '#DEC080', wing: '#B89050', comb: '#DD2010' },  // Buff
  { body: '#D8D0B8', wing: '#B0A890', comb: '#CC1600' },  // White
  { body: '#302018', wing: '#201008', comb: '#CC1600' },  // Black
];

class Chicken {
  constructor(cold, isRooster) {
    const p      = PALETTES[Math.floor(Math.random() * PALETTES.length)];
    this.body    = p.body;
    this.wing    = p.wing;
    this.comb    = p.comb;
    this.isRooster = !!isRooster;
    this.s       = this.isRooster
                     ? Math.random() * 6 + 26
                     : Math.random() * 9 + 16;
    this.reset(cold);
  }

  reset(cold) {
    this.dir   = Math.random() < 0.5 ? 1 : -1;
    this.x     = cold ? Math.random() * W : (this.dir > 0 ? -80 : W + 80);
    this.vx    = (Math.random() * 0.5 + 0.14) * this.dir;
    this.phase = Math.random() * Math.PI * 2;
    this.pspd  = Math.random() * 0.040 + 0.022;
    this.state = 'walk';
    this.timer = Math.random() * 260 + 80;
    this.peckAmt = 0;
  }

  update() {
    this.phase += this.pspd;
    this.timer--;
    if (this.timer <= 0) {
      if (this.state === 'walk') {
        this.state = 'peck'; this.timer = Math.random() * 100 + 40;
      } else {
        this.state = 'walk';  this.timer = Math.random() * 260 + 80;
        if (Math.random() < 0.35) { this.dir *= -1; this.vx *= -1; }
      }
    }
    if (this.state === 'walk') {
      this.x += this.vx;
      this.peckAmt = 0;
    } else {
      this.peckAmt = (Math.sin(this.phase * 5) + 1) / 2;
    }
    if (this.x < -110) this.x = W + 60;
    if (this.x > W + 110) this.x = -60;
  }

  draw() {
    const { s, dir, phase, state, peckAmt, body, wing, comb, isRooster } = this;
    const gY = GND();
    const y  = gY;
    const x  = this.x;

    const legSwing = state === 'walk' ? Math.sin(phase * 2) * s * 0.22 : 0;
    const headBob  = state === 'walk' ? Math.sin(phase)     * s * 0.08 : 0;
    const peckFwd  = peckAmt * s * 0.45;
    const peckDown = peckAmt * s * 0.52;

    ctx.save();
    ctx.translate(x, y);
    if (dir < 0) ctx.scale(-1, 1);

    /* — Drop shadow on grass — */
    ctx.beginPath();
    ctx.ellipse(0, 2, s * 0.55, s * 0.10, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();

    /* — Tail feathers — */
    if (isRooster) {
      // Long rooster tail
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        const angle = -0.6 - i * 0.25;
        ctx.moveTo(-s * 0.30, -s * 0.85);
        ctx.quadraticCurveTo(
          -s * 0.85 + Math.cos(angle) * s * 0.3,
          -s * 1.20 + Math.sin(angle) * s * 0.5,
          -s * 0.70 + Math.cos(angle) * s * 0.4,
          -s * 0.55 + Math.sin(angle) * s * 0.3
        );
        ctx.fillStyle = i % 2 === 0 ? body : comb;
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(-s * 0.34, -s * 0.86);
      ctx.quadraticCurveTo(-s * 0.82, -s * 1.44, -s * 0.56, -s * 0.60);
      ctx.fillStyle = body; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s * 0.26, -s * 0.80);
      ctx.quadraticCurveTo(-s * 0.58, -s * 1.12, -s * 0.44, -s * 0.56);
      ctx.fillStyle = wing; ctx.fill();
    }

    /* — Body — */
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.86, s * 0.53, s * 0.38, -0.12, 0, Math.PI * 2);
    ctx.fillStyle = body; ctx.fill();

    /* — Wing highlight — */
    ctx.beginPath();
    ctx.ellipse(-s * 0.06, -s * 0.84, s * 0.31, s * 0.21, 0.32, 0, Math.PI * 2);
    ctx.fillStyle = wing; ctx.fill();

    /* — Neck — */
    ctx.beginPath();
    ctx.moveTo(s * 0.28, -s * 1.06);
    ctx.quadraticCurveTo(
      s * 0.44 + peckFwd * 0.4, -s * 1.18 + peckDown * 0.4,
      s * 0.48 + peckFwd,       -s * 1.34 + peckDown + headBob
    );
    ctx.lineWidth  = s * 0.23;
    ctx.strokeStyle = body;
    ctx.lineCap    = 'round';
    ctx.stroke();

    /* — Head — */
    const hx = s * 0.50 + peckFwd;
    const hy = -s * 1.42 + peckDown + headBob;
    ctx.beginPath();
    ctx.arc(hx, hy, s * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = body; ctx.fill();

    /* — Comb — */
    const combCount = isRooster ? 4 : 3;
    for (let i = 0; i < combCount; i++) {
      ctx.beginPath();
      ctx.arc(hx - s * 0.06 + i * s * 0.07, hy - s * (isRooster ? 0.22 : 0.19), s * (isRooster ? 0.08 : 0.065), 0, Math.PI * 2);
      ctx.fillStyle = comb; ctx.fill();
    }

    /* — Wattle — */
    ctx.beginPath();
    ctx.ellipse(hx + s * 0.10, hy + s * 0.12, s * 0.055, s * 0.09, 0, 0, Math.PI * 2);
    ctx.fillStyle = comb; ctx.fill();

    /* — Beak — */
    ctx.beginPath();
    ctx.moveTo(hx + s * 0.19, hy - s * 0.03);
    ctx.lineTo(hx + s * 0.38, hy + s * 0.01);
    ctx.lineTo(hx + s * 0.19, hy + s * 0.07);
    ctx.fillStyle = '#E0A018'; ctx.fill();

    /* — Eye — */
    ctx.beginPath();
    ctx.arc(hx + s * 0.07, hy - s * 0.06, s * 0.038, 0, Math.PI * 2);
    ctx.fillStyle = '#100800'; ctx.fill();
    ctx.beginPath();
    ctx.arc(hx + s * 0.075, hy - s * 0.065, s * 0.014, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF8E0'; ctx.fill();

    /* — Legs — */
    ctx.strokeStyle = '#C89018';
    ctx.lineWidth   = s * 0.07;
    ctx.lineCap     = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.09, -s * 0.52); ctx.lineTo(-s * 0.10 - legSwing, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( s * 0.12, -s * 0.52); ctx.lineTo( s * 0.13 + legSwing, 0); ctx.stroke();

    /* — Feet — */
    ctx.lineWidth = s * 0.050;
    const lf = -s * 0.10 - legSwing, rf = s * 0.13 + legSwing;
    ctx.beginPath(); ctx.moveTo(lf, 0); ctx.lineTo(lf - s * 0.21, s * 0.10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lf, 0); ctx.lineTo(lf + s * 0.04, s * 0.12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lf, 0); ctx.lineTo(lf - s * 0.07, -s * 0.10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rf, 0); ctx.lineTo(rf - s * 0.04, s * 0.12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rf, 0); ctx.lineTo(rf + s * 0.21, s * 0.10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rf, 0); ctx.lineTo(rf + s * 0.07, -s * 0.10); ctx.stroke();

    ctx.restore();
  }
}

/* ════════════════════ FEATHERS ════════════════════ */
class Feather {
  constructor(cold) { this.reset(cold); }
  reset(cold) {
    this.x   = cold ? Math.random() * W : Math.random() * W;
    this.y   = cold ? Math.random() * H * 0.65 : GND() - 5;
    this.vy  = -(Math.random() * 0.20 + 0.04);
    this.vx  = (Math.random() - 0.5) * 0.30;
    this.rot = Math.random() * Math.PI * 2;
    this.rs  = (Math.random() - 0.5) * 0.025;
    this.len = Math.random() * 14 + 7;
    this.a   = Math.random() * 0.50 + 0.18;
    this.wob = Math.random() * Math.PI * 2;
    this.ws  = Math.random() * 0.016 + 0.006;
    this.col = ['#C87818', '#E8C040', '#B84E0C', '#EEE0B0', '#D8D0A8'][Math.floor(Math.random() * 5)];
  }
  update() {
    this.y   += this.vy;
    this.wob += this.ws;
    this.x   += this.vx + Math.sin(this.wob) * 0.40;
    this.rot += this.rs;
    if (this.y < -40) this.reset(false);
  }
  draw() {
    ctx.save();
    ctx.globalAlpha = this.a;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    const l = this.len;
    ctx.beginPath();
    ctx.moveTo(0, -l);
    ctx.quadraticCurveTo( l * 0.36, -l * 0.12, 0,  l);
    ctx.quadraticCurveTo(-l * 0.36, -l * 0.12, 0, -l);
    ctx.fillStyle = this.col; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(0, -l); ctx.lineTo(0, l); ctx.stroke();
    ctx.restore();
  }
}

/* ════════════════════ SCENE LAYERS ════════════════════ */

function drawSky() {
  const gY  = GND();
  const sky = ctx.createLinearGradient(0, 0, 0, gY);
  sky.addColorStop(0,    '#1A4A8C');
  sky.addColorStop(0.30, '#3A78C8');
  sky.addColorStop(0.60, '#6AAAE0');
  sky.addColorStop(0.85, '#A8CDE8');
  sky.addColorStop(1,    '#D8E8C8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, gY);

  // Sun
  const sx = W * 0.82 + mouse.x * 8, sy = H * 0.10 + mouse.y * 4;
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.28);
  sg.addColorStop(0,   'rgba(255,240,140,0.55)');
  sg.addColorStop(0.3, 'rgba(255,210,80,0.18)');
  sg.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, gY);

  const sunR = Math.min(W, H) * 0.042;
  ctx.beginPath();
  ctx.arc(sx, sy, sunR, 0, Math.PI * 2);
  ctx.fillStyle = '#FFF0A0';
  ctx.shadowBlur = 40; ctx.shadowColor = 'rgba(255,230,100,0.9)';
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawDistantTrees() {
  const gY = GND();
  // Row of trees on the far right horizon
  for (let tx = W * 0.60; tx < W + 30; tx += 38 + Math.sin(tx) * 12) {
    const th = H * 0.08 + Math.sin(tx * 0.07) * H * 0.04;
    const tw = th * 0.38;
    // Trunk
    ctx.fillStyle = '#3A1A08';
    ctx.fillRect(tx - 3, gY - th * 0.35, 6, th * 0.35);
    // Canopy (layered)
    ctx.fillStyle = '#2A5E14';
    ctx.beginPath();
    ctx.ellipse(tx, gY - th * 0.62, tw * 0.7, th * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#356A1A';
    ctx.beginPath();
    ctx.ellipse(tx, gY - th * 0.80, tw * 0.55, th * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3C7820';
    ctx.beginPath();
    ctx.ellipse(tx, gY - th * 0.95, tw * 0.38, th * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGround() {
  const gY = GND();

  // Main grass
  const grad = ctx.createLinearGradient(0, gY, 0, H);
  grad.addColorStop(0,   '#4A9820');
  grad.addColorStop(0.18,'#3A7E18');
  grad.addColorStop(0.55,'#2C6010');
  grad.addColorStop(1,   '#1A4008');
  ctx.fillStyle = grad;
  ctx.fillRect(0, gY, W, H - gY);

  // Grass rim glow (sun hitting the field)
  const rim = ctx.createLinearGradient(0, gY, 0, gY + 30);
  rim.addColorStop(0, 'rgba(200,255,120,0.22)');
  rim.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rim; ctx.fillRect(0, gY, W, 30);

  // Dirt patches near barn
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#8A5020';
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.ellipse(
      W * 0.32 + i * W * 0.04 + Math.sin(i * 3.1) * 20,
      gY + (H - gY) * 0.22,
      W * 0.022, (H - gY) * 0.09, 0, 0, Math.PI * 2
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBarn() {
  const gY = GND();
  const bx = W * 0.22;
  const bw = Math.min(W * 0.22, 210);
  const bh = bw * 1.20;

  /* ─ Ground shadow ─ */
  const shad = ctx.createRadialGradient(bx, gY, 0, bx, gY, bw * 0.8);
  shad.addColorStop(0, 'rgba(0,0,0,0.30)');
  shad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shad; ctx.fillRect(bx - bw, gY - 8, bw * 2, bw * 0.4);

  /* ─ Barn main walls ─ */
  ctx.fillStyle = '#8B1A1A';
  ctx.fillRect(bx - bw / 2, gY - bh, bw, bh);

  /* ─ Vertical plank lines ─ */
  ctx.strokeStyle = 'rgba(60,0,0,0.35)'; ctx.lineWidth = 1.5;
  for (let px = bx - bw / 2 + 18; px < bx + bw / 2; px += 18) {
    ctx.beginPath(); ctx.moveTo(px, gY - bh); ctx.lineTo(px, gY); ctx.stroke();
  }

  /* ─ White corner trim ─ */
  ctx.fillStyle = '#F5E8D0'; ctx.lineWidth = 0;
  ctx.fillRect(bx - bw / 2,     gY - bh, 6, bh);  // left
  ctx.fillRect(bx + bw / 2 - 6, gY - bh, 6, bh);  // right

  /* ─ Roof ─ */
  ctx.beginPath();
  ctx.moveTo(bx - bw * 0.60, gY - bh);
  ctx.lineTo(bx,               gY - bh * 1.40);
  ctx.lineTo(bx + bw * 0.60,   gY - bh);
  ctx.fillStyle = '#3A1E08'; ctx.fill();

  // Roof ridge cap
  ctx.fillStyle = '#2A1004';
  ctx.beginPath();
  ctx.moveTo(bx - bw * 0.05, gY - bh * 1.38);
  ctx.lineTo(bx + bw * 0.05, gY - bh * 1.38);
  ctx.lineTo(bx + bw * 0.08, gY - bh * 1.00);
  ctx.lineTo(bx - bw * 0.08, gY - bh * 1.00);
  ctx.fill();

  // Roof shingles (horizontal lines)
  ctx.strokeStyle = 'rgba(0,0,0,0.20)'; ctx.lineWidth = 1.2;
  for (let ri = 1; ri < 7; ri++) {
    const t = ri / 7;
    const lx = bx - (bw * 0.60) * (1 - t), rx = bx + (bw * 0.60) * (1 - t);
    const ry = gY - bh - (bh * 0.40) * t;
    ctx.beginPath(); ctx.moveTo(lx, ry); ctx.lineTo(rx, ry); ctx.stroke();
  }

  /* ─ Hayloft door (triangle peak) ─ */
  ctx.beginPath();
  ctx.moveTo(bx - bw * 0.10, gY - bh);
  ctx.quadraticCurveTo(bx, gY - bh - bw * 0.14, bx + bw * 0.10, gY - bh);
  ctx.fillStyle = '#220808'; ctx.fill();

  /* ─ Main door ─ */
  const dw = bw * 0.34, dh = bh * 0.42;
  ctx.fillStyle = '#1C0606';
  ctx.fillRect(bx - dw / 2, gY - dh, dw, dh);
  // Door arch top
  ctx.beginPath();
  ctx.arc(bx, gY - dh, dw / 2, Math.PI, 0);
  ctx.fillStyle = '#1C0606'; ctx.fill();
  // Door frame
  ctx.strokeStyle = '#F5E8D0'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bx - dw / 2, gY);
  ctx.lineTo(bx - dw / 2, gY - dh);
  ctx.arc(bx, gY - dh, dw / 2, Math.PI, 0);
  ctx.lineTo(bx + dw / 2, gY);
  ctx.stroke();
  // X brace on door
  ctx.strokeStyle = '#F5E8D0'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx - dw / 2, gY - dh * 0.6);
  ctx.lineTo(bx + dw / 2, gY - dh * 0.05);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx + dw / 2, gY - dh * 0.6);
  ctx.lineTo(bx - dw / 2, gY - dh * 0.05);
  ctx.stroke();

  /* ─ Side windows ─ */
  const winData = [
    { x: bx - bw * 0.32, y: gY - bh * 0.62 },
    { x: bx + bw * 0.32, y: gY - bh * 0.62 },
  ];
  winData.forEach(w => {
    ctx.fillStyle = '#A0C8E8';
    ctx.fillRect(w.x - 12, w.y - 12, 24, 20);
    ctx.strokeStyle = '#F5E8D0'; ctx.lineWidth = 2.5;
    ctx.strokeRect(w.x - 12, w.y - 12, 24, 20);
    // Cross pane
    ctx.beginPath(); ctx.moveTo(w.x, w.y - 12); ctx.lineTo(w.x, w.y + 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w.x - 12, w.y - 2); ctx.lineTo(w.x + 12, w.y - 2); ctx.stroke();
  });

  /* ─ Weathervane ─ */
  const vx = bx, vy = gY - bh * 1.40 - 6;
  ctx.strokeStyle = '#4A2808'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(vx, vy - 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(vx - 2, vy - 8); ctx.lineTo(vx + 2, vy - 8);
  ctx.lineTo(vx + 2, vy - 22); ctx.lineTo(vx - 2, vy - 22); ctx.stroke();
  // Arrow
  ctx.fillStyle = '#4A2808';
  ctx.beginPath();
  ctx.moveTo(vx - 14, vy - 22);
  ctx.lineTo(vx + 18, vy - 20);
  ctx.lineTo(vx - 14, vy - 18);
  ctx.fill();
  ctx.beginPath(); ctx.arc(vx + 18, vy - 20, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#4A2808'; ctx.fill();
}

function drawHayBales() {
  const gY = GND();
  // Two hay bales by the barn
  [[W * 0.38, gY], [W * 0.41, gY]].forEach(([hx, hy], i) => {
    const hw = 32 + i * 6, hh = 22 + i * 4;
    ctx.fillStyle = '#C8A020';
    ctx.beginPath();
    ctx.roundRect(hx - hw / 2, hy - hh, hw, hh, 4);
    ctx.fill();
    // Wrap lines
    ctx.strokeStyle = '#A07818'; ctx.lineWidth = 1.5;
    for (let li = 1; li < 3; li++) {
      const lx = hx - hw / 2 + hw * (li / 3);
      ctx.beginPath(); ctx.moveTo(lx, hy - hh); ctx.lineTo(lx, hy); ctx.stroke();
    }
    ctx.strokeRect(hx - hw / 2, hy - hh, hw, hh);
  });
}

function drawFence() {
  const gY  = GND();
  const ph  = H * 0.072;
  const pw  = 5.5;
  const sp  = W * 0.055;

  // Rails
  ctx.strokeStyle = '#8B5A28'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  [0.26, 0.60].forEach(fr => {
    ctx.beginPath();
    ctx.moveTo(W * 0.36, gY - ph * fr);
    ctx.lineTo(W + 10,   gY - ph * fr);
    ctx.stroke();
  });
  // Posts
  for (let px = W * 0.36; px <= W + sp * 0.5; px += sp) {
    // Post shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(px - pw / 2 + 3, gY - ph + 3, pw, ph);
    // Post
    ctx.fillStyle = '#7A4E20';
    ctx.fillRect(px - pw / 2, gY - ph, pw, ph);
    // Post cap
    ctx.fillStyle = '#9A6830';
    ctx.fillRect(px - pw / 2 - 1.5, gY - ph, pw + 3, 5);
  }
}

function drawWheat() {
  const gY = GND();
  // Wheat patch on left side (behind barn area)
  const n = Math.floor(W * 0.18 / 14);
  for (let i = 0; i < n; i++) {
    const wx = W * 0.01 + (W * 0.17 / n) * i + Math.sin(i * 1.7) * 5;
    const wh = H * 0.056 + Math.sin(i * 2.1) * H * 0.014;
    const sw = Math.sin(time * 0.6 + i * 0.35) * 4.5 + mouse.x * 6;
    ctx.strokeStyle = `rgba(${170 + Math.sin(i) * 22}, ${120 + Math.cos(i) * 14}, 18, 0.55)`;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(wx, gY);
    ctx.quadraticCurveTo(wx + sw * 0.5, gY - wh * 0.55, wx + sw, gY - wh);
    ctx.stroke();
    ctx.fillStyle = `rgba(215, 170, 25, 0.60)`;
    ctx.beginPath();
    ctx.ellipse(wx + sw, gY - wh, 2, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGrassBlades() {
  const gY = GND();
  // Foreground grass blades for depth
  const n = Math.floor(W / 8);
  for (let i = 0; i < n; i++) {
    const gx = (W / n) * i;
    const gh = H * 0.025 + Math.sin(i * 1.8) * H * 0.010;
    const sw = Math.sin(time * 0.5 + i * 0.22) * 2.5;
    const g  = 150 + Math.sin(i * 1.4) * 20;
    ctx.strokeStyle = `rgba(30, ${g}, 20, 0.55)`;
    ctx.lineWidth   = 1.0;
    ctx.beginPath();
    ctx.moveTo(gx, H);
    ctx.quadraticCurveTo(gx + sw, H - gh * 0.5, gx + sw * 1.5, H - gh);
    ctx.stroke();
  }
}

/* ════════════════════ INIT ════════════════════ */
function init() {
  const chickenCount = Math.min(Math.floor(W / 140), 16);
  clouds   = Array.from({ length: Math.min(Math.floor(W / 280), 8) },  () => new Cloud(true));
  chickens = [
    ...Array.from({ length: Math.floor(chickenCount * 0.88) }, () => new Chicken(true, false)),
    new Chicken(true, true),  // one rooster
  ];
  feathers = Array.from({ length: Math.min(Math.floor(W * H / 22000), 22) }, () => new Feather(true));
}

/* ════════════════════ RENDER LOOP ════════════════════ */
function draw() {
  requestAnimationFrame(draw);
  time += 0.016;
  ctx.clearRect(0, 0, W, H);

  drawSky();
  clouds.forEach(c  => { c.update(); c.draw(); });
  drawDistantTrees();
  drawGround();
  drawWheat();
  drawHayBales();
  drawBarn();
  drawFence();
  feathers.forEach(f => { f.update(); f.draw(); });
  chickens.forEach(c => { c.update(); c.draw(); });
  drawGrassBlades();
}

resize();
init();
draw();
