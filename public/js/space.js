/* ═══════════════════════════════════════════════════════════════
   Space Network — Immersive Canvas Background
   Stars · Nebulae · Shooting Stars · Parallax Drift
   ═══════════════════════════════════════════════════════════════ */

const canvas = document.getElementById('spaceCanvas');
const ctx    = canvas.getContext('2d');

let W, H, stars = [], shooters = [], mouse = { x: 0, y: 0 };

/* ── Resize ── */
function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', () => { resize(); initStars(); });
window.addEventListener('mousemove', e => {
  mouse.x = e.clientX / W - 0.5;
  mouse.y = e.clientY / H - 0.5;
});

/* ════════════════════ STARS ════════════════════ */
const STAR_COLORS = [
  '#ffffff', '#e0f0ff', '#ffd6a5', '#c8b6ff',
  '#a0c4ff', '#ffadad', '#b9fbc0', '#00d4ff'
];

class Star {
  constructor() { this.init(); }

  init() {
    this.x      = Math.random() * W;
    this.y      = Math.random() * H;
    this.baseX  = this.x;
    this.baseY  = this.y;
    this.r      = Math.random() * 1.6 + 0.2;
    this.color  = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
    this.alpha  = Math.random() * 0.7 + 0.1;
    this.delta  = (Math.random() * 0.006 + 0.002) * (Math.random() < 0.5 ? 1 : -1);
    this.depth  = Math.random() * 0.8 + 0.2; // parallax strength
    // occasional larger "bright" stars
    if (Math.random() < 0.03) { this.r = Math.random() * 2.8 + 1.8; this.alpha = 0.9; }
  }

  update(tick) {
    // Twinkle
    this.alpha += this.delta;
    if (this.alpha > 0.95 || this.alpha < 0.05) this.delta *= -1;
    // Subtle parallax on mouse move
    this.x = this.baseX + mouse.x * 18 * this.depth;
    this.y = this.baseY + mouse.y * 12 * this.depth;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    // Glow for larger stars
    if (this.r > 1.5) {
      ctx.shadowBlur  = this.r * 5;
      ctx.shadowColor = this.color;
    }
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function initStars() {
  const count = Math.min(Math.floor((W * H) / 3800), 360);
  stars = Array.from({ length: count }, () => new Star());
}

/* ════════════════════ SHOOTING STARS ════════════════════ */
class Shooter {
  constructor() { this.reset(true); }

  reset(cold = false) {
    this.delay  = cold ? Math.random() * 400 : Math.random() * 600 + 100;
    this.active = false;

    // Start off-screen upper-left area
    this.x  = Math.random() * W * 0.7;
    this.y  = Math.random() * H * 0.35;
    this.vx = (Math.random() * 10 + 6);
    this.vy = (Math.random() * 5  + 3);
    this.len   = Math.random() * 180 + 60;
    this.alpha = 1;
    this.width = Math.random() * 1.5 + 0.5;
  }

  update() {
    if (!this.active) {
      this.delay--;
      if (this.delay <= 0) this.active = true;
      return;
    }
    this.x     += this.vx;
    this.y     += this.vy;
    this.alpha -= 0.018;
    if (this.alpha <= 0 || this.x > W + 100 || this.y > H + 100) this.reset();
  }

  draw() {
    if (!this.active || this.alpha <= 0) return;
    const tailX = this.x - (this.vx / Math.hypot(this.vx, this.vy)) * this.len;
    const tailY = this.y - (this.vy / Math.hypot(this.vx, this.vy)) * this.len;

    ctx.save();
    ctx.globalAlpha = this.alpha;
    const grad = ctx.createLinearGradient(this.x, this.y, tailX, tailY);
    grad.addColorStop(0,   'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(0, 212, 255, 0.6)');
    grad.addColorStop(1,   'rgba(0, 212, 255, 0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth   = this.width;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();

    // Bright head flash
    ctx.shadowBlur  = 12;
    ctx.shadowColor = '#00d4ff';
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.width * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ════════════════════ NEBULA LAYER ════════════════════ */
// Pre-generated nebula blobs (re-calculated on resize)
let nebulaBlobs = [];

function buildNebula() {
  nebulaBlobs = [
    { cx: W * 0.15, cy: H * 0.25, rx: W * 0.30, ry: H * 0.30, r: 0, g: 0,   b: 120, a: 0.10 },
    { cx: W * 0.80, cy: H * 0.65, rx: W * 0.28, ry: H * 0.35, r: 60, g: 0,  b: 120, a: 0.08 },
    { cx: W * 0.50, cy: H * 0.15, rx: W * 0.22, ry: H * 0.22, r: 0, g: 0,   b: 80,  a: 0.07 },
    { cx: W * 0.60, cy: H * 0.80, rx: W * 0.20, ry: H * 0.25, r: 30, g: 0,  b: 90,  a: 0.06 },
  ];
}

function drawNebula() {
  nebulaBlobs.forEach(b => {
    const grad = ctx.createRadialGradient(
      b.cx + mouse.x * 30, b.cy + mouse.y * 20, 0,
      b.cx + mouse.x * 30, b.cy + mouse.y * 20, Math.max(b.rx, b.ry)
    );
    grad.addColorStop(0,   `rgba(${b.r}, ${b.g}, ${b.b}, ${b.a})`);
    grad.addColorStop(0.5, `rgba(${b.r}, ${b.g}, ${b.b}, ${b.a * 0.4})`);
    grad.addColorStop(1,   'rgba(0,0,0,0)');

    ctx.save();
    ctx.scale(b.rx / Math.max(b.rx, b.ry), b.ry / Math.max(b.rx, b.ry));
    ctx.fillStyle = grad;
    ctx.fillRect(
      (b.cx - b.rx) / (b.rx / Math.max(b.rx, b.ry)),
      (b.cy - b.ry) / (b.ry / Math.max(b.rx, b.ry)),
      (b.rx * 2)    / (b.rx / Math.max(b.rx, b.ry)),
      (b.ry * 2)    / (b.ry / Math.max(b.rx, b.ry))
    );
    ctx.restore();
  });
}

/* ════════════════════ RENDER LOOP ════════════════════ */
let tick = 0;

function draw() {
  requestAnimationFrame(draw);
  tick++;

  // ── Background gradient ──
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,   '#04040e');
  bg.addColorStop(0.45,'#060819');
  bg.addColorStop(1,   '#030308');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Nebulae (painted simply with full-canvas radial grads) ──
  const n1 = ctx.createRadialGradient(
    W * 0.18 + mouse.x * 25, H * 0.28 + mouse.y * 18, 0,
    W * 0.18 + mouse.x * 25, H * 0.28 + mouse.y * 18, W * 0.32
  );
  n1.addColorStop(0,   'rgba(0, 30, 110, 0.14)');
  n1.addColorStop(0.5, 'rgba(0, 20, 80,  0.07)');
  n1.addColorStop(1,   'rgba(0,  0,  0,  0)');
  ctx.fillStyle = n1; ctx.fillRect(0, 0, W, H);

  const n2 = ctx.createRadialGradient(
    W * 0.78 + mouse.x * 20, H * 0.62 + mouse.y * 15, 0,
    W * 0.78 + mouse.x * 20, H * 0.62 + mouse.y * 15, W * 0.28
  );
  n2.addColorStop(0,   'rgba(60, 0, 110, 0.13)');
  n2.addColorStop(0.5, 'rgba(40, 0, 80,  0.06)');
  n2.addColorStop(1,   'rgba(0,  0,  0,  0)');
  ctx.fillStyle = n2; ctx.fillRect(0, 0, W, H);

  const n3 = ctx.createRadialGradient(
    W * 0.50 + mouse.x * 15, H * 0.12 + mouse.y * 10, 0,
    W * 0.50 + mouse.x * 15, H * 0.12 + mouse.y * 10, W * 0.22
  );
  n3.addColorStop(0,   'rgba(0, 60, 120, 0.10)');
  n3.addColorStop(1,   'rgba(0,  0,  0,  0)');
  ctx.fillStyle = n3; ctx.fillRect(0, 0, W, H);

  // ── Stars ──
  stars.forEach(s => { s.update(tick); s.draw(); });

  // ── Shooting stars ──
  shooters.forEach(s => { s.update(); s.draw(); });
}

/* ════════════════════ INIT ════════════════════ */
resize();
initStars();
buildNebula();
shooters = Array.from({ length: 6 }, () => new Shooter());
draw();
