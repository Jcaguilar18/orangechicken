/* ═══════════════════════════════════════════════════════════════
   Orange Chicken — Hot Kitchen Background
   Glowing embers · Steam wisps · Floating food · Warm fire glow
   ═══════════════════════════════════════════════════════════════ */

const canvas = document.getElementById('spaceCanvas');
const ctx    = canvas.getContext('2d');

let W, H, embers = [], wisps = [], foods = [], mouse = { x: 0, y: 0 };

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', () => { resize(); init(); });
window.addEventListener('mousemove', e => {
  mouse.x = e.clientX / W - 0.5;
  mouse.y = e.clientY / H - 0.5;
});

/* ════════════════════ EMBERS ════════════════════ */
const EMBER_COLORS = [
  '#FF6B1A', '#FFB300', '#FF8C42', '#FFD060',
  '#C0392B', '#FF4500', '#FFA040', '#FF7020'
];

class Ember {
  constructor() { this.reset(true); }

  reset(cold = false) {
    this.x      = Math.random() * W;
    this.baseX  = this.x;
    this.y      = cold ? Math.random() * H : H + 10;
    this.vy     = -(Math.random() * 0.55 + 0.18);
    this.vx     = (Math.random() - 0.5) * 0.25;
    this.size   = Math.random() * 2.2 + 0.4;
    this.alpha  = Math.random() * 0.55 + 0.15;
    this.da     = (Math.random() * 0.007 + 0.002) * (Math.random() < 0.5 ? 1 : -1);
    this.color  = EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)];
    if (Math.random() < 0.04) {
      this.size  = Math.random() * 5 + 2.5;
      this.alpha = 0.3;
    }
  }

  update() {
    this.alpha += this.da;
    if (this.alpha > 0.88 || this.alpha < 0.06) this.da *= -1;
    this.y     += this.vy;
    this.baseX += this.vx;
    this.x      = this.baseX + mouse.x * 10;
    if (this.y < -20) this.reset(false);
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    if (this.size > 1.8) {
      ctx.shadowBlur  = this.size * 7;
      ctx.shadowColor = this.color;
    }
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ════════════════════ STEAM WISPS ════════════════════ */
class Wisp {
  constructor() { this.reset(true); }

  reset(cold = false) {
    this.x         = Math.random() * W;
    this.baseX     = this.x;
    this.y         = cold ? Math.random() * H : H + 60;
    this.vy        = -(Math.random() * 0.28 + 0.08);
    this.wobble    = Math.random() * Math.PI * 2;
    this.wobbleSpd = Math.random() * 0.022 + 0.006;
    this.size      = Math.random() * 50 + 25;
    this.alpha     = Math.random() * 0.045 + 0.008;
    this.da        = (Math.random() * 0.002 + 0.0005) * (Math.random() < 0.5 ? 1 : -1);
  }

  update() {
    this.alpha   += this.da;
    if (this.alpha > 0.065 || this.alpha < 0.004) this.da *= -1;
    this.y       += this.vy;
    this.wobble  += this.wobbleSpd;
    this.x        = this.baseX + Math.sin(this.wobble) * 18 + mouse.x * 8;
    if (this.y < -this.size * 2) this.reset(false);
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
    g.addColorStop(0, 'rgba(255, 210, 140, 1)');
    g.addColorStop(1, 'rgba(255, 180, 80,  0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ════════════════════ FOOD FLOATERS ════════════════════ */
const FOOD_GLYPHS = ['🍗', '🍚', '🌶️', '🥢', '🍳', '🔥', '⭐'];

class FoodFloat {
  constructor() { this.reset(true); }

  reset(cold = false) {
    this.x        = Math.random() * W;
    this.baseX    = this.x;
    this.y        = cold ? Math.random() * H : H + 50;
    this.vy       = -(Math.random() * 0.18 + 0.05);
    this.vx       = (Math.random() - 0.5) * 0.1;
    this.size     = Math.random() * 14 + 10;
    this.alpha    = Math.random() * 0.14 + 0.04;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpd   = (Math.random() - 0.5) * 0.006;
    this.glyph    = FOOD_GLYPHS[Math.floor(Math.random() * FOOD_GLYPHS.length)];
  }

  update() {
    this.y        += this.vy;
    this.baseX    += this.vx;
    this.x         = this.baseX + mouse.x * 5;
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
  const ec = Math.min(Math.floor((W * H) / 3500), 300);
  const wc = Math.min(Math.floor((W * H) / 16000), 28);
  const fc = Math.min(Math.floor((W * H) / 35000), 14);
  embers = Array.from({ length: ec }, () => new Ember());
  wisps  = Array.from({ length: wc }, () => new Wisp());
  foods  = Array.from({ length: fc }, () => new FoodFloat());
}

/* ════════════════════ RENDER LOOP ════════════════════ */
function draw() {
  requestAnimationFrame(draw);

  // Rich, deep warm background — like a dark restaurant kitchen
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0,   '#1C0700');
  bg.addColorStop(0.5, '#2D0F00');
  bg.addColorStop(1,   '#180500');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Hot glow pool — left
  const g1 = ctx.createRadialGradient(
    W * 0.22 + mouse.x * 22, H * 0.42 + mouse.y * 16, 0,
    W * 0.22 + mouse.x * 22, H * 0.42 + mouse.y * 16, W * 0.38
  );
  g1.addColorStop(0,   'rgba(210, 70, 20, 0.20)');
  g1.addColorStop(0.55,'rgba(160, 40, 10, 0.08)');
  g1.addColorStop(1,   'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);

  // Hot glow pool — right
  const g2 = ctx.createRadialGradient(
    W * 0.80 + mouse.x * 18, H * 0.58 + mouse.y * 13, 0,
    W * 0.80 + mouse.x * 18, H * 0.58 + mouse.y * 13, W * 0.33
  );
  g2.addColorStop(0,   'rgba(255, 120, 0, 0.16)');
  g2.addColorStop(0.55,'rgba(200, 70, 0, 0.06)');
  g2.addColorStop(1,   'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

  // Golden shimmer — bottom center (like a wok glow below)
  const g3 = ctx.createRadialGradient(
    W * 0.5 + mouse.x * 10, H * 0.88 + mouse.y * 6, 0,
    W * 0.5 + mouse.x * 10, H * 0.88 + mouse.y * 6, W * 0.30
  );
  g3.addColorStop(0,   'rgba(255, 180, 0, 0.12)');
  g3.addColorStop(0.6, 'rgba(200, 100, 0, 0.05)');
  g3.addColorStop(1,   'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g3; ctx.fillRect(0, 0, W, H);

  wisps.forEach(w  => { w.update();  w.draw();  });
  embers.forEach(e => { e.update(); e.draw(); });
  foods.forEach(f  => { f.update();  f.draw();  });
}

resize();
init();
draw();
