// ── Nav hover ripple ──────────────────────────────
(() => {
  const nav = document.querySelector('nav');

  nav.addEventListener('mousemove', (e) => {
    const rect = nav.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1) + '%';
    nav.style.setProperty('--mx', x);
  });

  nav.addEventListener('mouseenter', () => nav.classList.add('lit'));
  nav.addEventListener('mouseleave', () => nav.classList.remove('lit'));

  // click: burst from exact point then settle
  nav.addEventListener('click', (e) => {
    const rect = nav.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1) + '%';
    nav.style.setProperty('--mx', x);
    nav.classList.add('lit');
  });
})();


const sections = document.querySelectorAll('section[id], #hero');
const navLinks = document.querySelectorAll('.nav-links a');

const obs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      navLinks.forEach(l => l.classList.remove('active'));
      const match = document.querySelector(`.nav-links a[href="#${e.target.id}"]`);
      if (match) match.classList.add('active');
    }
  });
}, { threshold: 0.35 });

sections.forEach(s => obs.observe(s));

// ── Fade in on scroll ─────────────────────────────
const fadeEls = document.querySelectorAll('.card, .social-card, .file-item, .tag, .about-text p');

const fadeObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
      fadeObs.unobserve(e.target);
    }
  });
}, { threshold: 0.08 });

fadeEls.forEach((el, i) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = `opacity 0.5s ease ${i * 0.04}s, transform 0.5s ease ${i * 0.04}s`;
  fadeObs.observe(el);
});

// ── Reactive memoji follows cursor ────────────────
(() => {
  const memoji  = document.getElementById('memoji');
  const head    = document.getElementById('m-head');
  const eyes    = document.getElementById('m-eyes');
  const pupils  = document.getElementById('m-pupils');
  const brows   = document.getElementById('m-brows');
  const lids    = document.querySelectorAll('.m-lid');
  if (!memoji) return;

  let tx = 0, ty = 0, cx = 0, cy = 0;

  window.addEventListener('mousemove', (e) => {
    const r = memoji.getBoundingClientRect();
    const ox = r.left + r.width / 2;
    const oy = r.top + r.height / 2;
    // normalized -1..1
    tx = Math.max(-1, Math.min(1, (e.clientX - ox) / (window.innerWidth / 2)));
    ty = Math.max(-1, Math.min(1, (e.clientY - oy) / (window.innerHeight / 2)));
  });

  function loop() {
    cx += (tx - cx) * 0.12;
    cy += (ty - cy) * 0.12;

    // head leans + rotates toward cursor
    head.setAttribute('transform',
      `translate(${cx * 22} ${cy * 16}) rotate(${cx * 7} 200 260)`);
    // eyes shift a bit, pupils more
    eyes.setAttribute('transform',   `translate(${cx * 8} ${cy * 7})`);
    pupils.setAttribute('transform', `translate(${cx * 12} ${cy * 11})`);
    // eyebrows lift when cursor is high
    brows.setAttribute('transform',  `translate(${cx * 6} ${(-Math.max(0,-cy)) * 8 + cy * 4})`);

    requestAnimationFrame(loop);
  }
  loop();

  // occasional blink
  setInterval(() => {
    lids.forEach(l => l.setAttribute('height', '40'));
    setTimeout(() => lids.forEach(l => l.setAttribute('height', '0')), 130);
  }, 4200);
})();


// ── Hero role scroll ──────────────────────────────
// Handled by CSS animation on .hero-role-scroll span
// Each span cycles through: DEVELOPER → OPTIMIZER → CASH33 → CREATOR


// ── Custom cursor ─────────────────────────────────
(() => {
  const ring = document.getElementById('cursor-ring');
  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let rx = mx, ry = my;

  window.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    ring.style.opacity = '1';
  });

  function follow() {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    ring.style.left = rx + 'px';
    ring.style.top  = ry + 'px';
    requestAnimationFrame(follow);
  }
  follow();

  window.addEventListener('mousedown', () => ring.classList.add('clicking'));
  window.addEventListener('mouseup',   () => ring.classList.remove('clicking'));

  const hoverEls = document.querySelectorAll('a, button, .card, .tag, .social-card, .nav-links a');
  hoverEls.forEach(el => {
    el.addEventListener('mouseenter', () => ring.classList.add('hovering'));
    el.addEventListener('mouseleave', () => ring.classList.remove('hovering'));
  });

  document.addEventListener('mouseleave', () => ring.style.opacity = '0');
  document.addEventListener('mouseenter', () => ring.style.opacity = '1');
})();

// ── Galaxy background ─────────────────────────────
(() => {
  const canvas = document.getElementById('bg-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H;
  let mx = -999, my = -999; // mouse
  let tmx = 0, tmy = 0;     // smoothed

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });

  // ── Stars ─────────────────────────────────────
  let stars = [];
  function initStars() {
    stars = Array.from({ length: 320 }, () => ({
      x:    Math.random() * W,
      y:    Math.random() * H,
      r:    Math.random() * 1.3 + 0.2,
      base: Math.random() * 0.6 + 0.15,
      spd:  Math.random() * 0.0008 + 0.0003,
      ph:   Math.random() * Math.PI * 2,
      // drift
      vx:   (Math.random() - 0.5) * 0.06,
      vy:   (Math.random() - 0.5) * 0.04,
    }));
  }

  function drawStars(t) {
    for (const s of stars) {
      // drift slowly
      s.x = (s.x + s.vx + W) % W;
      s.y = (s.y + s.vy + H) % H;

      // twinkle
      const alpha = s.base + Math.sin(t * s.spd + s.ph) * 0.25;

      // proximity to cursor — star brightens
      const dx = tmx - s.x, dy = tmy - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const boost = Math.max(0, 1 - dist / 180) * 0.7;

      const a = Math.min(1, alpha + boost);

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r + boost * 1.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(220, 210, 255, ${a})`;
      ctx.fill();
    }
  }

  // ── Minimal reactive grid ─────────────────────
  const SPACING = 44;
  let cols, rows, dots = [];

  function initGrid() {
    cols = Math.ceil(W / SPACING) + 1;
    rows = Math.ceil(H / SPACING) + 1;
    dots = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        dots.push({ x: c * SPACING, y: r * SPACING, scale: 0, base: Math.random() * 0.18 + 0.04 });
      }
    }
  }

  function drawGrid() {
    for (const d of dots) {
      const dx = tmx - d.x, dy = tmy - d.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const proximity = Math.max(0, 1 - dist / 160);
      const target = d.base + proximity * 0.7;
      d.scale += (target - d.scale) * 0.08;

      const a = d.scale;
      if (a < 0.03) continue;
      const r = 1.2 + proximity * 2;
      ctx.beginPath();
      ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 140, 255, ${a})`;
      ctx.fill();
    }
  }

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    initStars();
    initGrid();
  }

  // ── Loop ──────────────────────────────────────
  function loop(t) {
    tmx += (mx - tmx) * 0.06;
    tmy += (my - tmy) * 0.06;

    ctx.clearRect(0, 0, W, H);
    drawGrid();
    drawStars(t);

    requestAnimationFrame(loop);
  }

  resize();
  requestAnimationFrame(loop);
})();