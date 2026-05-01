/* ═══════════════════════════════════════════════════════════════
   Orange Chicken — Farmhouse Night Background
   Fireflies · Hay dust · Farm floaters · Lantern warmth
   ═══════════════════════════════════════════════════════════════ */

const canvas = document.getElementById('spaceCanvas');
const ctx    = canvas.getContext('2d');

let W, H, fireflies = [], dustMotes = [], floaters = [], mouse = { x: 0, y: 0 };

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', () => { resize(); init(); });
window.addEventListener('mousemove', e => {
  mouse.x = e.clientX / W - 0.5;
  mouse.y = e.clientY / H - 0.5;
});

/* ════════════════════ FIREFLIES ════════════════════ */
const FIREFLY_COLORS = [
  '#E8C547', '#F5D87A', '#D4A020', '#FFD060',
  '#E0B030', '#C8A028', '#F0CC50', '#D8B840'
];

class Firefly {
  constructor() { this.reset(true); }

  reset(cold = false) {
    this.x      = Math.random() * W;
    this.baseX  = this.x;
    this.y      = cold ? Math.random() * H : H + 10;
    this.vy     = -(Math.random() * 0.40 + 0.10);
    this.vx     = (Math.random() - 0.5) * 0.18;
    this.size   = Math.random() * 1.8 + 0.5;
    this.alpha  = 0;
    this.maxA   = Math.random() * 0.7 + 0.2;
    this.phase  = Math.random() * Math.PI * 2;
    this.speed  = Math.random() * 0.025 + 0.012;
    this.color  = FIREFLY_COLORS[Math.floor(Math.random() * FIREFLY_COLORS.length)];
    this.glow   = Math.random() < 0.35;
  }

  update() {
    this.phase += this.speed;
    this.alpha  = ((Math.sin(this.phase) + 1) / 2) * this.maxA;
    this.y     += this.vy;
    this.baseX += this.vx;
    this.x      = this.baseX + Math.sin(this.phase * 0.6) * 12 + mouse.x * 8;
    if (this.y < -20) this.reset(false);
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    if (this.glow) {
      ctx.shadowBlur  = this.size * 9;
      ctx.shadowColor = this.color;
    }
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ════════════════════ HAY DUST MOTES ════════════════════ */
class DustMote {
  constructor() { this.reset(true); }

  reset(cold = false) {
    this.x         = Math.random() * W;
    this.baseX     = this.x;
    this.y         = cold ? Math.random() * H : H + 60;
    this.vy        = -(Math.random() * 0.18 + 0.04);
    this.wobble    = Math.random() * Math.PI * 2;
    this.wobbleSpd = Math.random() * 0.018 + 0.005;
    this.size      = Math.random() * 40 + 20;
    this.alpha     = Math.random() * 0.035 + 0.006;
    this.da        = (Math.random() * 0.0015 + 0.0004) * (Math.random() < 0.5 ? 1 : -1);
  }

  update() {
    this.alpha   += this.da;
    if (this.alpha > 0.05 || this.alpha < 0.003) this.da *= -1;
    this.y       += this.vy;
    this.wobble  += this.wobbleSpd;
    this.x        = this.baseX + Math.sin(this.wobble) * 22 + mouse.x * 6;
    if (this.y < -this.size * 2) this.reset(false);
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
    g.addColorStop(0, 'rgba(232, 197, 71, 1)');
    g.addColorStop(1, 'rgba(180, 120, 30, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ════════════════════ FARM FLOATERS ════════════════════ */
const FARM_GLYPHS = ['🐔', '🌾', '🥚', '🌻', '🐓', '🌽', '🪺'];

class FarmFloat {
  constructor() { this.reset(true); }

  reset(cold = false) {
    this.x        = Math.random() * W;
    this.baseX    = this.x;
    this.y        = cold ? Math.random() * H : H + 50;
    this.vy       = -(Math.random() * 0.14 + 0.04);
    this.vx       = (Math.random() - 0.5) * 0.08;
    this.size     = Math.random() * 12 + 9;
    this.alpha    = Math.random() * 0.12 + 0.03;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpd   = (Math.random() - 0.5) * 0.004;
    this.glyph    = FARM_GLYPHS[Math.floor(Math.random() * FARM_GLYPHS.length)];
  }

  update() {
    this.y        += this.vy;
    this.baseX    += this.vx;
    this.x         = this.baseX + mouse.x * 4;
    this.rotation += this.rotSpd;
    if (this.y < -60) this.reset(false);
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.font = `${this.size}px serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.glyph, 0, 0);
    ctx.restore();
  }
}

/* ════════════════════ INIT ════════════════════ */
function init() {
  const fc = Math.min(Math.floor((W * H) / 3000), 280);
  const dc = Math.min(Math.floor((W * H) / 14000), 24);
  const ff = Math.min(Math.floor((W * H) / 40000), 10);
  fireflies = Array.from({ length: fc }, () => new Firefly());
  dustMotes = Array.from({ length: dc }, () => new DustMote());
  floaters  = Array.from({ length: ff }, () => new FarmFloat());
}

/* ════════════════════ RENDER LOOP ════════════════════ */
function draw() {
  requestAnimationFrame(draw);

  // Deep warm barn night background
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0,   '#130A02');
  bg.addColorStop(0.5, '#1E0E04');
  bg.addColorStop(1,   '#0E0602');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Warm lantern glow — left
  const g1 = ctx.createRadialGradient(
    W * 0.20 + mouse.x * 20, H * 0.40 + mouse.y * 14, 0,
    W * 0.20 + mouse.x * 20, H * 0.40 + mouse.y * 14, W * 0.36
  );
  g1.addColorStop(0,   'rgba(180, 90, 15, 0.18)');
  g1.addColorStop(0.55,'rgba(120, 55, 8, 0.07)');
  g1.addColorStop(1,   'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);

  // Warm lantern glow — right
  const g2 = ctx.createRadialGradient(
    W * 0.80 + mouse.x * 16, H * 0.55 + mouse.y * 12, 0,
    W * 0.80 + mouse.x * 16, H * 0.55 + mouse.y * 12, W * 0.32
  );
  g2.addColorStop(0,   'rgba(139, 32, 32, 0.14)');
  g2.addColorStop(0.55,'rgba(100, 20, 10, 0.06)');
  g2.addColorStop(1,   'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

  // Golden hay shimmer — bottom
  const g3 = ctx.createRadialGradient(
    W * 0.5 + mouse.x * 8, H * 0.90 + mouse.y * 5, 0,
    W * 0.5 + mouse.x * 8, H * 0.90 + mouse.y * 5, W * 0.28
  );
  g3.addColorStop(0,   'rgba(232, 197, 71, 0.10)');
  g3.addColorStop(0.6, 'rgba(180, 130, 20, 0.04)');
  g3.addColorStop(1,   'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g3; ctx.fillRect(0, 0, W, H);

  dustMotes.forEach(d  => { d.update(); d.draw(); });
  fireflies.forEach(f  => { f.update(); f.draw(); });
  floaters.forEach(fl  => { fl.update(); fl.draw(); });
}

resize();
init();
draw();
