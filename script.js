// ── Star field ──────────────────────────────────────
const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d');

let stars = [];
let W, H;

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}

function initStars(count = 260) {
  stars = Array.from({ length: count }, () => ({
    x:       Math.random() * W,
    y:       Math.random() * H,
    r:       Math.random() * 1.4 + 0.2,
    opacity: Math.random() * 0.7 + 0.1,
    speed:   Math.random() * 0.012 + 0.004,
    phase:   Math.random() * Math.PI * 2,
  }));
}

function drawStars(t) {
  ctx.clearRect(0, 0, W, H);
  for (const s of stars) {
    const pulse = s.opacity + Math.sin(t * s.speed + s.phase) * 0.18;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200, 215, 255, ${Math.max(0, Math.min(1, pulse))})`;
    ctx.fill();
  }
}

// Subtle shooting star every ~8s
let lastShoot = 0;
function maybeShoot(t) {
  if (t - lastShoot < 8000 + Math.random() * 4000) return;
  lastShoot = t;
  const sx = Math.random() * W * 0.6 + W * 0.1;
  const sy = Math.random() * H * 0.3;
  const len = 90 + Math.random() * 60;
  let prog = 0;
  function shoot() {
    const dur = 28;
    prog++;
    const frac = prog / dur;
    const tx = sx + len * frac;
    const ty = sy + len * 0.3 * frac;
    ctx.beginPath();
    ctx.moveTo(tx - len * 0.07, ty - len * 0.07 * 0.3);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = `rgba(200, 215, 255, ${(1 - frac) * 0.7})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    if (prog < dur) requestAnimationFrame(shoot);
  }
  shoot();
}

let rafId;
function loop(t) {
  drawStars(t);
  maybeShoot(t);
  rafId = requestAnimationFrame(loop);
}

function init() {
  resize();
  initStars();
  cancelAnimationFrame(rafId);
  loop(0);
}

window.addEventListener('resize', () => { resize(); initStars(); });
init();

// ── Nav active link on scroll ─────────────────────
const sections = document.querySelectorAll('.section, #hero');
const navLinks = document.querySelectorAll('nav ul a');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      navLinks.forEach(l => l.classList.remove('active'));
      const id = e.target.id;
      const match = document.querySelector(`nav ul a[href="#${id}"]`);
      if (match) match.classList.add('active');
    }
  });
}, { threshold: 0.4 });

sections.forEach(s => observer.observe(s));

// Active nav link style (inject once)
const style = document.createElement('style');
style.textContent = `nav ul a.active { color: var(--accent); }`;
document.head.appendChild(style);

// ── Fade-in on scroll ─────────────────────────────
const fadeEls = document.querySelectorAll('.card, .social-card, .file-item, .tag, .about-text');

const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
      fadeObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

fadeEls.forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(18px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  fadeObserver.observe(el);
});
