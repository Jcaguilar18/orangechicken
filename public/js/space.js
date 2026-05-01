/* ═══════════════════════════════════════════════════════════════
   Orange Chicken — Sunset Farm Scene
   Chickens · Barn · Wheat · Fireflies · Rolling Hills
   ═══════════════════════════════════════════════════════════════ */

const canvas = document.getElementById('spaceCanvas');
const ctx    = canvas.getContext('2d');

let W, H, time = 0;
let chickens = [], feathers = [], fireflies = [], clouds = [], stars = [];
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

const GND = () => H * 0.72;

/* ════════════════════ STARS ════════════════════ */
function makeStars() {
  stars = [];
  const n = Math.floor(W * H / 5500);
  for (let i = 0; i < n; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * GND() * 0.50,
      r: Math.random() * 1.4 + 0.3,
      a: Math.random() * 0.55 + 0.15,
      tw: Math.random() * Math.PI * 2,
      ts: Math.random() * 0.016 + 0.004
    });
  }
}

/* ════════════════════ CLOUDS ════════════════════ */
class Cloud {
  constructor(cold) {
    this.x  = cold ? Math.random() * W : -320;
    this.y  = Math.random() * GND() * 0.38 + GND() * 0.04;
    this.vx = Math.random() * 0.16 + 0.04;
    this.w  = Math.random() * 190 + 90;
    this.a  = Math.random() * 0.09 + 0.03;
    this.warm = Math.random() < 0.65;
  }
  update() {
    this.x += this.vx;
    if (this.x > W + 360) {
      this.x = -300;
      this.y = Math.random() * GND() * 0.38 + GND() * 0.04;
    }
  }
  draw() {
    const x = this.x, y = this.y, w = this.w, h = w * 0.36;
    ctx.save();
    ctx.globalAlpha = this.a;
    ctx.fillStyle = this.warm ? '#FFB850' : '#FFCF80';
    ctx.beginPath();
    ctx.ellipse(x,            y,           w * 0.45, h * 0.54, 0, 0, Math.PI * 2);
    ctx.ellipse(x - w * 0.21, y + h * 0.1, w * 0.27, h * 0.40, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.23, y + h * 0.1, w * 0.27, h * 0.40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ════════════════════ CHICKEN ════════════════════ */
const PALETTES = [
  { body: '#B84E0C', wing: '#8A3408', comb: '#BB1600' },  // Rhode Island Red
  { body: '#C87818', wing: '#A05A06', comb: '#BB1600' },  // Orange
  { body: '#D8B870', wing: '#B89050', comb: '#CC2010' },  // Buff
  { body: '#C8C0A4', wing: '#A8A080', comb: '#BB1600' },  // White
  { body: '#282012', wing: '#181008', comb: '#BB1600' },  // Black
];

class Chicken {
  constructor(cold) {
    const p = PALETTES[Math.floor(Math.random() * PALETTES.length)];
    this.body = p.body; this.wing = p.wing; this.comb = p.comb;
    this.s    = Math.random() * 10 + 15;
    this.reset(cold);
  }

  reset(cold) {
    this.dir   = Math.random() < 0.5 ? 1 : -1;
    this.x     = cold ? Math.random() * W : (this.dir > 0 ? -80 : W + 80);
    this.vx    = (Math.random() * 0.38 + 0.10) * this.dir;
    this.phase = Math.random() * Math.PI * 2;
    this.pspd  = Math.random() * 0.036 + 0.020;
    this.state = 'walk';
    this.timer = Math.random() * 240 + 80;
    this.peckAmt = 0;
  }

  update() {
    this.phase += this.pspd;
    this.timer--;
    if (this.timer <= 0) {
      if (this.state === 'walk') {
        this.state = 'peck'; this.timer = Math.random() * 100 + 50;
      } else {
        this.state = 'walk';  this.timer = Math.random() * 240 + 80;
        if (Math.random() < 0.35) { this.dir *= -1; this.vx *= -1; }
      }
    }
    if (this.state === 'walk') {
      this.x += this.vx;
      this.peckAmt = 0;
    } else {
      this.peckAmt = (Math.sin(this.phase * 5) + 1) / 2;
    }
    if (this.x < -100) this.x = W + 60;
    if (this.x > W + 100) this.x = -60;
  }

  draw() {
    const { s, dir, phase, state, peckAmt, body, wing, comb } = this;
    const gY = GND();
    const y  = gY;
    const x  = this.x;

    const legSwing = state === 'walk' ? Math.sin(phase * 2) * s * 0.20 : 0;
    const headBob  = state === 'walk' ? Math.sin(phase)     * s * 0.07 : 0;
    const peckFwd  = peckAmt * s * 0.42;
    const peckDown = peckAmt * s * 0.50;

    ctx.save();
    ctx.translate(x, y);
    if (dir < 0) ctx.scale(-1, 1);

    /* — Tail feathers — */
    ctx.beginPath();
    ctx.moveTo(-s * 0.36, -s * 0.88);
    ctx.quadraticCurveTo(-s * 0.82, -s * 1.48, -s * 0.58, -s * 0.62);
    ctx.fillStyle = body; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.28, -s * 0.82);
    ctx.quadraticCurveTo(-s * 0.60, -s * 1.15, -s * 0.46, -s * 0.58);
    ctx.fillStyle = wing; ctx.fill();

    /* — Body — */
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.88, s * 0.52, s * 0.37, -0.12, 0, Math.PI * 2);
    ctx.fillStyle = body; ctx.fill();

    /* — Wing — */
    ctx.beginPath();
    ctx.ellipse(-s * 0.07, -s * 0.86, s * 0.30, s * 0.21, 0.32, 0, Math.PI * 2);
    ctx.fillStyle = wing; ctx.fill();

    /* — Neck — */
    ctx.beginPath();
    ctx.moveTo(s * 0.28, -s * 1.08);
    ctx.quadraticCurveTo(
      s * 0.44 + peckFwd * 0.4, -s * 1.20 + peckDown * 0.4,
      s * 0.48 + peckFwd,       -s * 1.36 + peckDown + headBob
    );
    ctx.lineWidth = s * 0.22;
    ctx.strokeStyle = body; ctx.lineCap = 'round'; ctx.stroke();

    /* — Head — */
    const hx = s * 0.50 + peckFwd;
    const hy = -s * 1.44 + peckDown + headBob;
    ctx.beginPath();
    ctx.arc(hx, hy, s * 0.21, 0, Math.PI * 2);
    ctx.fillStyle = body; ctx.fill();

    /* — Comb (3 bumps) — */
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(hx - s * 0.05 + i * s * 0.07, hy - s * 0.19, s * 0.062, 0, Math.PI * 2);
      ctx.fillStyle = comb; ctx.fill();
    }

    /* — Wattle — */
    ctx.beginPath();
    ctx.ellipse(hx + s * 0.09, hy + s * 0.11, s * 0.052, s * 0.085, 0, 0, Math.PI * 2);
    ctx.fillStyle = comb; ctx.fill();

    /* — Beak — */
    ctx.beginPath();
    ctx.moveTo(hx + s * 0.18, hy - s * 0.03);
    ctx.lineTo(hx + s * 0.37, hy + s * 0.01);
    ctx.lineTo(hx + s * 0.18, hy + s * 0.07);
    ctx.fillStyle = '#E0A018'; ctx.fill();

    /* — Eye — */
    ctx.beginPath();
    ctx.arc(hx + s * 0.07, hy - s * 0.055, s * 0.037, 0, Math.PI * 2);
    ctx.fillStyle = '#140800'; ctx.fill();
    ctx.beginPath();
    ctx.arc(hx + s * 0.075, hy - s * 0.062, s * 0.013, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF8E0'; ctx.fill();

    /* — Legs — */
    ctx.strokeStyle = '#C89018'; ctx.lineWidth = s * 0.068; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.09, -s * 0.52); ctx.lineTo(-s * 0.10 - legSwing, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( s * 0.11, -s * 0.52); ctx.lineTo( s * 0.12 + legSwing, 0); ctx.stroke();

    /* — Feet — */
    ctx.lineWidth = s * 0.048;
    const lf = -s * 0.10 - legSwing, rf = s * 0.12 + legSwing;
    // Left foot
    ctx.beginPath(); ctx.moveTo(lf, 0); ctx.lineTo(lf - s * 0.20, s * 0.09); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lf, 0); ctx.lineTo(lf + s * 0.04, s * 0.11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lf, 0); ctx.lineTo(lf - s * 0.07, -s * 0.09); ctx.stroke();
    // Right foot
    ctx.beginPath(); ctx.moveTo(rf, 0); ctx.lineTo(rf - s * 0.04, s * 0.11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rf, 0); ctx.lineTo(rf + s * 0.20, s * 0.09); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rf, 0); ctx.lineTo(rf + s * 0.07, -s * 0.09); ctx.stroke();

    ctx.restore();
  }
}

/* ════════════════════ FEATHERS ════════════════════ */
class Feather {
  constructor(cold) { this.reset(cold); }
  reset(cold) {
    this.x   = cold ? Math.random() * W : Math.random() * W;
    this.y   = cold ? Math.random() * H * 0.7 : GND() - 5;
    this.vy  = -(Math.random() * 0.22 + 0.04);
    this.vx  = (Math.random() - 0.5) * 0.32;
    this.rot = Math.random() * Math.PI * 2;
    this.rs  = (Math.random() - 0.5) * 0.026;
    this.len = Math.random() * 13 + 6;
    this.a   = Math.random() * 0.16 + 0.05;
    this.wob = Math.random() * Math.PI * 2;
    this.ws  = Math.random() * 0.017 + 0.006;
    this.col = ['#C87818', '#E8C040', '#B84E0C', '#F0E0B0'][Math.floor(Math.random() * 4)];
  }
  update() {
    this.y   += this.vy;
    this.wob += this.ws;
    this.x   += this.vx + Math.sin(this.wob) * 0.42;
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
    ctx.fillStyle = this.col;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, -l); ctx.lineTo(0, l); ctx.stroke();
    ctx.restore();
  }
}

/* ════════════════════ FIREFLIES ════════════════════ */
class Firefly {
  constructor(cold) { this.reset(cold); }
  reset(cold) {
    const gY = GND();
    this.x   = Math.random() * W;
    this.bx  = this.x;
    this.y   = cold ? Math.random() * gY : gY;
    this.vy  = -(Math.random() * 0.26 + 0.06);
    this.vx  = (Math.random() - 0.5) * 0.13;
    this.sz  = Math.random() * 1.5 + 0.5;
    this.a   = 0;
    this.maxA= Math.random() * 0.72 + 0.28;
    this.ph  = Math.random() * Math.PI * 2;
    this.spd = Math.random() * 0.022 + 0.009;
  }
  update() {
    this.ph  += this.spd;
    this.a    = ((Math.sin(this.ph) + 1) / 2) * this.maxA;
    this.y   += this.vy;
    this.bx  += this.vx;
    this.x    = this.bx + Math.sin(this.ph * 0.6) * 11 + mouse.x * 6;
    if (this.y < -20) this.reset(false);
  }
  draw() {
    ctx.save();
    ctx.globalAlpha = this.a;
    ctx.shadowBlur  = this.sz * 9;
    ctx.shadowColor = '#E8C040';
    ctx.fillStyle   = '#F5D460';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.sz, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ════════════════════ SCENE LAYERS ════════════════════ */

function drawSky() {
  const gY = GND();
  const sky = ctx.createLinearGradient(0, 0, 0, gY);
  sky.addColorStop(0,    '#060318');
  sky.addColorStop(0.25, '#0E0620');
  sky.addColorStop(0.52, '#240A06');
  sky.addColorStop(0.78, '#6C2608');
  sky.addColorStop(1,    '#B84C08');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, gY);

  // Sun glow at horizon
  const sx = W * 0.70 + mouse.x * 14;
  const sg = ctx.createRadialGradient(sx, gY, 0, sx, gY, W * 0.50);
  sg.addColorStop(0,    'rgba(255, 155, 25, 0.62)');
  sg.addColorStop(0.22, 'rgba(210,  80, 10, 0.25)');
  sg.addColorStop(0.55, 'rgba(130,  35,  5, 0.08)');
  sg.addColorStop(1,    'rgba(0, 0, 0, 0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, gY * 1.05);

  // Sun disc (half-set)
  const sunR = Math.min(W, H) * 0.048;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, gY + 2); ctx.clip();
  ctx.beginPath();
  ctx.arc(sx, gY + sunR * 0.35, sunR, 0, Math.PI * 2);
  ctx.fillStyle = '#FFCA30';
  ctx.shadowBlur = 55; ctx.shadowColor = 'rgba(255, 175, 30, 0.85)';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  // Horizon amber band
  const hb = ctx.createLinearGradient(0, gY - H * 0.08, 0, gY);
  hb.addColorStop(0, 'rgba(180, 80, 10, 0)');
  hb.addColorStop(1, 'rgba(220, 110, 15, 0.30)');
  ctx.fillStyle = hb;
  ctx.fillRect(0, gY - H * 0.08, W, H * 0.08);
}

function drawStars() {
  for (const s of stars) {
    s.tw += s.ts;
    ctx.globalAlpha = (Math.sin(s.tw) * 0.28 + 0.72) * s.a;
    ctx.fillStyle   = '#FFF0D0';
    ctx.beginPath();
    ctx.arc(s.x + mouse.x * 2.5, s.y + mouse.y * 1.5, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHills() {
  const gY = GND();
  ctx.beginPath();
  ctx.moveTo(0, gY);
  ctx.bezierCurveTo(W * 0.08, gY - H * 0.15, W * 0.26, gY - H * 0.22, W * 0.44, gY - H * 0.10);
  ctx.bezierCurveTo(W * 0.60, gY - H * 0.01, W * 0.76, gY - H * 0.18, W, gY - H * 0.08);
  ctx.lineTo(W, gY); ctx.closePath();
  ctx.fillStyle = '#0E0400'; ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, gY);
  ctx.bezierCurveTo(W * 0.16, gY - H * 0.08, W * 0.36, gY - H * 0.12, W * 0.58, gY - H * 0.05);
  ctx.bezierCurveTo(W * 0.74, gY + H * 0.01, W * 0.87, gY - H * 0.09, W, gY - H * 0.03);
  ctx.lineTo(W, gY); ctx.closePath();
  ctx.fillStyle = '#0A0300'; ctx.fill();
}

function drawBarn() {
  const gY  = GND();
  const bx  = W * 0.13 + mouse.x * 4;
  const bw  = Math.min(W * 0.13, 128);
  const bh  = bw * 1.18;

  // Door warm glow spilling on ground
  const dg = ctx.createRadialGradient(bx, gY, 0, bx, gY, bw * 0.75);
  dg.addColorStop(0, 'rgba(220, 120, 18, 0.22)');
  dg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = dg;
  ctx.fillRect(0, gY - bh * 0.5, W * 0.28, bh);

  // Barn body
  ctx.fillStyle = '#250606';
  ctx.fillRect(bx - bw / 2, gY - bh, bw, bh);

  // Siding lines (horizontal planks)
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
  for (let py = gY - bh + 8; py < gY; py += 12) {
    ctx.beginPath(); ctx.moveTo(bx - bw / 2, py); ctx.lineTo(bx + bw / 2, py); ctx.stroke();
  }

  // Roof
  ctx.beginPath();
  ctx.moveTo(bx - bw * 0.62, gY - bh);
  ctx.lineTo(bx,               gY - bh * 1.42);
  ctx.lineTo(bx + bw * 0.62,   gY - bh);
  ctx.fillStyle = '#1A0303'; ctx.fill();

  // Loft door in roof
  ctx.beginPath();
  ctx.moveTo(bx - bw * 0.08, gY - bh);
  ctx.quadraticCurveTo(bx, gY - bh - bw * 0.18, bx + bw * 0.08, gY - bh);
  ctx.fillStyle = '#0D0202'; ctx.fill();

  // Door
  const dw = bw * 0.30, dh = bh * 0.40;
  ctx.fillStyle = '#0A0100';
  ctx.fillRect(bx - dw / 2, gY - dh, dw, dh);
  // Door X brace
  ctx.strokeStyle = '#180500'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(bx - dw/2, gY - dh); ctx.lineTo(bx + dw/2, gY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx + dw/2, gY - dh); ctx.lineTo(bx - dw/2, gY); ctx.stroke();

  // Window glow
  const wx = bx + bw * 0.24, wy = gY - bh * 0.68;
  ctx.fillStyle = 'rgba(240, 150, 25, 0.65)';
  ctx.fillRect(wx - 7, wy - 7, 14, 12);
  const wg = ctx.createRadialGradient(wx, wy, 0, wx, wy, 38);
  wg.addColorStop(0, 'rgba(240,150,25,0.25)');
  wg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = wg; ctx.fillRect(wx - 38, wy - 38, 76, 76);

  // Weathervane
  const vx = bx, vy = gY - bh * 1.42 - 8;
  ctx.strokeStyle = '#2E1408'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(vx, vy - 20); ctx.stroke();
  ctx.fillStyle = '#2E1408';
  ctx.beginPath();
  ctx.moveTo(vx - 13, vy - 22);
  ctx.lineTo(vx + 16, vy - 20);
  ctx.lineTo(vx - 13, vy - 18);
  ctx.fill();
  // Rooster silhouette on vane
  ctx.beginPath();
  ctx.arc(vx + 16, vy - 20, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#2E1408'; ctx.fill();
}

function drawFence() {
  const gY = GND();
  const ph = H * 0.068;
  const pw = 5;
  const sp = W * 0.058;

  // Rails
  ctx.strokeStyle = '#3C2010'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  [0.28, 0.62].forEach(fr => {
    ctx.beginPath();
    ctx.moveTo(W * 0.22, gY - ph * fr);
    ctx.lineTo(W + 10,   gY - ph * fr);
    ctx.stroke();
  });
  // Posts
  for (let px = W * 0.22; px <= W + sp * 0.5; px += sp) {
    ctx.fillStyle = '#2C1608';
    ctx.fillRect(px - pw / 2, gY - ph, pw, ph);
    ctx.fillStyle = '#4A2A12';
    ctx.fillRect(px - pw / 2 - 1, gY - ph, pw + 2, 4);
  }
}

function drawGround() {
  const gY = GND();
  const grad = ctx.createLinearGradient(0, gY, 0, H);
  grad.addColorStop(0,   '#1C380A');
  grad.addColorStop(0.22,'#142C07');
  grad.addColorStop(1,   '#0A1C04');
  ctx.fillStyle = grad;
  ctx.fillRect(0, gY, W, H - gY);

  // Sunset rim light on grass
  const rim = ctx.createLinearGradient(0, gY, 0, gY + 32);
  rim.addColorStop(0, 'rgba(180, 220, 40, 0.16)');
  rim.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, gY, W, 32);

  // Dirt patches
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#6A3810';
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.ellipse(
      W * 0.07 + i * W * 0.092 + Math.sin(i * 2.9) * 22,
      gY + (H - gY) * 0.28,
      W * 0.035, (H - gY) * 0.10, 0, 0, Math.PI * 2
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawWheat() {
  const gY = GND();
  const n  = Math.floor(W / 15);
  for (let i = 0; i < n; i++) {
    const wx = (W / n) * i + (i % 4) * 3.5;
    const wh = H * 0.052 + Math.sin(i * 2.1) * H * 0.013;
    const sw = Math.sin(time * 0.7 + i * 0.38) * 4.0 + mouse.x * 5;
    const br = 158 + Math.sin(i * 1.5) * 28;
    const bg = 108 + Math.cos(i * 1.2) * 16;
    ctx.strokeStyle = `rgba(${br}, ${bg}, 16, 0.42)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(wx, gY);
    ctx.quadraticCurveTo(wx + sw * 0.52, gY - wh * 0.54, wx + sw, gY - wh);
    ctx.stroke();
    // Grain head
    ctx.fillStyle = `rgba(215, 165, 22, 0.50)`;
    ctx.beginPath();
    ctx.ellipse(wx + sw, gY - wh, 1.7, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ════════════════════ INIT ════════════════════ */
function init() {
  makeStars();
  clouds    = Array.from({ length: Math.min(Math.floor(W / 240), 10) },  () => new Cloud(true));
  chickens  = Array.from({ length: Math.min(Math.floor(W / 160), 15) },  () => new Chicken(true));
  feathers  = Array.from({ length: Math.min(Math.floor(W * H / 26000), 20) }, () => new Feather(true));
  fireflies = Array.from({ length: Math.min(Math.floor(W * H / 5200),  48) }, () => new Firefly(true));
}

/* ════════════════════ RENDER LOOP ════════════════════ */
function draw() {
  requestAnimationFrame(draw);
  time += 0.016;
  ctx.clearRect(0, 0, W, H);

  drawSky();
  drawStars();
  drawHills();
  clouds.forEach(c   => { c.update(); c.draw(); });
  drawBarn();
  drawFence();
  drawGround();
  drawWheat();
  feathers.forEach(f  => { f.update(); f.draw(); });
  chickens.forEach(c  => { c.update(); c.draw(); });
  fireflies.forEach(f => { f.update(); f.draw(); });
}

resize();
init();
draw();
