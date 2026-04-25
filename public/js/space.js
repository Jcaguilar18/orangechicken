/* ═══════════════════════════════════════════════════════════════
   Orange Chicken — Warm Ambient Background
   Floating rice & food particles · Glowing nebulae · Parallax drift
   ═══════════════════════════════════════════════════════════════ */

const canvas = document.getElementById('spaceCanvas');
const ctx    = canvas.getContext('2d');

let W, H, particles = [], mouse = { x: 0, y: 0 };

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', () => { resize(); initParticles(); });
window.addEventListener('mousemove', e => {
  mouse.x = e.clientX / W - 0.5;
  mouse.y = e.clientY / H - 0.5;
});

/* ════════════════════ PARTICLES ════════════════════ */
const FOOD_GLYPHS = ['🍚', '🌾', '✦', '·', '•', '✦', '·', '•', '✦', '✦'];
const WARM_COLORS = [
  '#FF6B1A', '#FFB300', '#FFD060', '#FF8C42',
  '#FFA500', '#E8651A', '#FFCC44', '#FF7F32'
];

class Particle {
  constructor() { this.init(true); }

  init(cold = false) {
    this.x      = Math.random() * W;
    this.y      = cold ? Math.random() * H : H + 20;
    this.baseX  = this.x;
    this.vy     = -(Math.random() * 0.4 + 0.12);
    this.vx     = (Math.random() - 0.5) * 0.15;
    this.alpha  = Math.random() * 0.5 + 0.08;
    this.delta  = (Math.random() * 0.004 + 0.001) * (Math.random() < 0.5 ? 1 : -1);
    this.depth  = Math.random() * 0.7 + 0.3;
    this.size   = Math.random() * 1.8 + 0.4;
    this.color  = WARM_COLORS[Math.floor(Math.random() * WARM_COLORS.length)];
    this.glyph  = null;

    // 6% chance of being a food emoji
    if (Math.random() < 0.06) {
      this.glyph = FOOD_GLYPHS[Math.floor(Math.random() * 3)]; // only first 3 emoji
      this.size  = Math.random() * 12 + 8;
      this.alpha = Math.random() * 0.18 + 0.06;
      this.vy   *= 0.4;
    } else if (Math.random() < 0.04) {
      this.size  = Math.random() * 3.5 + 2.2;
      this.alpha = 0.7;
    }
  }

  update() {
    this.alpha += this.delta;
    if (this.alpha > 0.75 || this.alpha < 0.04) this.delta *= -1;
    this.y  += this.vy;
    this.x   = this.baseX + this.vx * 60 + mouse.x * 14 * this.depth;
    this.baseX += this.vx;
    if (this.y < -40) this.init(false);
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    if (this.glyph) {
      ctx.font = `${this.size}px serif`;
      ctx.fillText(this.glyph, this.x, this.y);
    } else {
      if (this.size > 2) {
        ctx.shadowBlur  = this.size * 4;
        ctx.shadowColor = this.color;
      }
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function initParticles() {
  const count = Math.min(Math.floor((W * H) / 4200), 280);
  particles = Array.from({ length: count }, () => new Particle());
}

/* ════════════════════ RENDER LOOP ════════════════════ */
function draw() {
  requestAnimationFrame(draw);

  // Deep warm background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,    '#0D0600');
  bg.addColorStop(0.45, '#120400');
  bg.addColorStop(1,    '#0A0200');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Warm nebula glow — upper left: orange
  const n1 = ctx.createRadialGradient(
    W * 0.18 + mouse.x * 22, H * 0.28 + mouse.y * 16, 0,
    W * 0.18 + mouse.x * 22, H * 0.28 + mouse.y * 16, W * 0.34
  );
  n1.addColorStop(0,   'rgba(192, 57, 43, 0.16)');
  n1.addColorStop(0.5, 'rgba(160, 40, 20, 0.07)');
  n1.addColorStop(1,   'rgba(0,   0,  0, 0)');
  ctx.fillStyle = n1; ctx.fillRect(0, 0, W, H);

  // Warm nebula — lower right: amber
  const n2 = ctx.createRadialGradient(
    W * 0.80 + mouse.x * 18, H * 0.65 + mouse.y * 14, 0,
    W * 0.80 + mouse.x * 18, H * 0.65 + mouse.y * 14, W * 0.30
  );
  n2.addColorStop(0,   'rgba(255, 107, 26, 0.12)');
  n2.addColorStop(0.5, 'rgba(200, 80,   10, 0.05)');
  n2.addColorStop(1,   'rgba(0,    0,    0, 0)');
  ctx.fillStyle = n2; ctx.fillRect(0, 0, W, H);

  // Subtle gold shimmer — top center
  const n3 = ctx.createRadialGradient(
    W * 0.50 + mouse.x * 12, H * 0.10 + mouse.y * 8, 0,
    W * 0.50 + mouse.x * 12, H * 0.10 + mouse.y * 8, W * 0.22
  );
  n3.addColorStop(0,   'rgba(255, 179, 0, 0.09)');
  n3.addColorStop(1,   'rgba(0,    0,  0, 0)');
  ctx.fillStyle = n3; ctx.fillRect(0, 0, W, H);

  // Particles
  particles.forEach(p => { p.update(); p.draw(); });
}

/* ════════════════════ INIT ════════════════════ */
resize();
initParticles();
draw();
