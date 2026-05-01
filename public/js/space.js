/* ═══════════════════════════════════════════════════════════════
   Orange Chicken — Ambient Background
   Soft glowing orbs · warm palette · gentle drift
   ═══════════════════════════════════════════════════════════════ */

const canvas = document.getElementById('spaceCanvas');
const ctx    = canvas.getContext('2d');

let W, H, orbs = [], sparks = [];

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', () => { resize(); init(); });

/* ── Palette ── */
const COLORS = [
  [212,  90,  15],   // amber orange
  [180,  35,  25],   // deep red
  [230, 165,  20],   // golden yellow
  [160,  55,  10],   // burnt sienna
  [100,  20,  50],   // dark burgundy
  [200, 120,  10],   // warm gold
];

/* ── Orbs ── */
class Orb {
  constructor(i) {
    const c = COLORS[i % COLORS.length];
    this.r = `${c[0]},${c[1]},${c[2]}`;
    this.reset();
    this.x = Math.random() * W;
    this.y = Math.random() * H;
  }

  reset() {
    this.vx    = (Math.random() - 0.5) * 0.28;
    this.vy    = (Math.random() - 0.5) * 0.28;
    this.size  = (Math.random() * 0.35 + 0.20) * Math.min(W, H);
    this.alpha = Math.random() * 0.16 + 0.07;
    this.phase = Math.random() * Math.PI * 2;
    this.pspd  = Math.random() * 0.006 + 0.002;
  }

  update() {
    this.phase += this.pspd;
    this.x += this.vx + Math.sin(this.phase * 0.8) * 0.18;
    this.y += this.vy + Math.cos(this.phase * 0.6) * 0.18;
    if (this.x < -this.size) this.x = W + this.size;
    if (this.x > W + this.size) this.x = -this.size;
    if (this.y < -this.size) this.y = H + this.size;
    if (this.y > H + this.size) this.y = -this.size;
  }

  draw() {
    const pulse = Math.sin(this.phase) * 0.04 + 1;
    const sz    = this.size * pulse;
    const a     = this.alpha * (Math.sin(this.phase * 0.9) * 0.12 + 0.88);
    const g     = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, sz);
    g.addColorStop(0,   `rgba(${this.r},${a})`);
    g.addColorStop(0.45,`rgba(${this.r},${a * 0.45})`);
    g.addColorStop(1,   `rgba(${this.r},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, sz, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ── Floating sparks ── */
class Spark {
  constructor() { this.reset(true); }

  reset(cold) {
    this.x     = Math.random() * W;
    this.y     = cold ? Math.random() * H : H + 4;
    this.vy    = -(Math.random() * 0.35 + 0.08);
    this.vx    = (Math.random() - 0.5) * 0.15;
    this.size  = Math.random() * 1.4 + 0.4;
    this.alpha = 0;
    this.maxA  = Math.random() * 0.55 + 0.20;
    this.phase = Math.random() * Math.PI * 2;
    this.spd   = Math.random() * 0.028 + 0.010;
    this.baseX = this.x;
  }

  update() {
    this.phase += this.spd;
    this.alpha  = ((Math.sin(this.phase) + 1) / 2) * this.maxA;
    this.y     += this.vy;
    this.baseX += this.vx;
    this.x      = this.baseX + Math.sin(this.phase * 0.7) * 9;
    if (this.y < -10) this.reset(false);
  }

  draw() {
    ctx.save();
    ctx.globalAlpha  = this.alpha;
    ctx.shadowBlur   = this.size * 7;
    ctx.shadowColor  = '#E8B030';
    ctx.fillStyle    = '#F5CC50';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ── Init ── */
function init() {
  orbs   = Array.from({ length: 7  }, (_, i) => new Orb(i));
  sparks = Array.from({ length: Math.min(Math.floor(W * H / 4500), 80) }, () => new Spark());
}

/* ── Render ── */
function draw() {
  requestAnimationFrame(draw);

  // Rich dark base
  ctx.fillStyle = '#0A0401';
  ctx.fillRect(0, 0, W, H);

  // Orbs
  orbs.forEach(o => { o.update(); o.draw(); });

  // Sparks
  sparks.forEach(s => { s.update(); s.draw(); });
}

resize();
init();
draw();
