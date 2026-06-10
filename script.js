console.log("script loaded");

// ── Nav glow effect ───────────────────────────────
(() => {
  const allNavEls = document.querySelectorAll('.nav-links a, .nav-logo');
  const glowOn  = `
    0 0  8px rgba(230,190,255,1.0),
    0 0 22px rgba(200,140,255,0.9),
    0 0 50px rgba(170, 90,255,0.65),
    0 0 90px rgba(140, 50,230,0.35)
  `;

  allNavEls.forEach(el => {
    el.addEventListener('mouseenter', () => {
      el.style.color      = '#edd9ff';
      el.style.textShadow = glowOn;
    });
    el.addEventListener('mouseleave', () => {
      el.style.color      = '';
      el.style.textShadow = '';
    });
  });
})();

// ── Scramble role text ────────────────────────────
(() => {
  const el = document.getElementById('scramble-role');
  if (!el) return;
  const words = ['DEVELOPER', 'OPTIMIZER', 'CASH33', 'CREATOR'];
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@!';
  let wi = 0, iter = 0;

  function scramble() {
    const target = words[wi];
    el.textContent = target.split('').map((c, i) => {
      if (i < iter) return c;
      return chars[Math.floor(Math.random() * chars.length)];
    }).join('');
    iter++;
    if (iter > target.length + 4) {
      el.textContent = target;
      iter = 0;
      wi = (wi + 1) % words.length;
      setTimeout(scramble, 1800);
      return;
    }
    setTimeout(scramble, 45);
  }

  setTimeout(scramble, 800);
})();

// ── Active nav link on scroll ─────────────────────
const sections = document.querySelectorAll('section[id], #hero');
const navLinks  = document.querySelectorAll('.nav-links a');

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

// ── Scroll animations: slide-up + heading glitch ──
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@!';

function glitchText(el) {
  const original = el.dataset.original || el.textContent;
  el.dataset.original = original;
  let iter = 0;
  const total = original.length;
  const iv = setInterval(() => {
    el.textContent = original.split('').map((c, i) => {
      if (c === ' ') return ' ';
      if (i < iter - 2) return c;
      return chars[Math.floor(Math.random() * chars.length)];
    }).join('');
    iter += 0.6;
    if (iter > total + 3) {
      el.textContent = original;
      clearInterval(iv);
    }
  }, 38);
}

// Section headings glitch in
const headingObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const h2 = e.target.querySelector('.section-header h2');
      if (h2) setTimeout(() => glitchText(h2), 80);
      headingObs.unobserve(e.target);
    }
  });
}, { threshold: 0.2 });

document.querySelectorAll('.section').forEach(s => headingObs.observe(s));

// Cards + content slide up with stagger
const fadeEls = document.querySelectorAll('.card, .social-card, .file-item, .tag, .about-text p, .about-tags, .section-sub');

const fadeObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
      fadeObs.unobserve(e.target);
    }
  });
}, { threshold: 0.06 });

fadeEls.forEach((el, i) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(28px)';
  el.style.transition = `opacity 0.6s cubic-bezier(.22,1,.36,1) ${i * 0.05}s, transform 0.6s cubic-bezier(.22,1,.36,1) ${i * 0.05}s, color 0.4s ease, text-shadow 0.4s ease`;
  fadeObs.observe(el);
});

// ── Reactive memoji follows cursor ────────────────
(() => {
  const memoji = document.getElementById('memoji');
  const head   = document.getElementById('m-head');
  const eyes   = document.getElementById('m-eyes');
  const pupils = document.getElementById('m-pupils');
  const brows  = document.getElementById('m-brows');
  const lids   = document.querySelectorAll('.m-lid');
  if (!memoji) return;

  let tx = 0, ty = 0, cx = 0, cy = 0;

  window.addEventListener('mousemove', (e) => {
    const r  = memoji.getBoundingClientRect();
    const ox = r.left + r.width  / 2;
    const oy = r.top  + r.height / 2;
    tx = Math.max(-1, Math.min(1, (e.clientX - ox) / (window.innerWidth  / 2)));
    ty = Math.max(-1, Math.min(1, (e.clientY - oy) / (window.innerHeight / 2)));
  });

  function loop() {
    cx += (tx - cx) * 0.12;
    cy += (ty - cy) * 0.12;

    head.setAttribute('transform',
      `translate(${cx * 22} ${cy * 16}) rotate(${cx * 7} 200 260)`);
    eyes.setAttribute('transform',   `translate(${cx * 8} ${cy * 7})`);
    pupils.setAttribute('transform', `translate(${cx * 12} ${cy * 11})`);
    brows.setAttribute('transform',  `translate(${cx * 6} ${(-Math.max(0,-cy)) * 8 + cy * 4})`);

    requestAnimationFrame(loop);
  }
  loop();

  setInterval(() => {
    lids.forEach(l => l.setAttribute('height', '40'));
    setTimeout(() => lids.forEach(l => l.setAttribute('height', '0')), 130);
  }, 4200);
})();


// ── Orbit rings animation ─────────────────────────
(() => {
  const dot1 = document.getElementById('dot1');
  const dot2 = document.getElementById('dot2');
  const dot3 = document.getElementById('dot3');
  const orbits = document.getElementById('m-orbits');
  if (!dot1) return;

  const CX = 200, CY = 250;
  let spinAngle = 0;
  let tiltX = 0, tiltY = 0, smoothX = 0, smoothY = 0;

  const ringDefs = [
    { el: dot1, orb: 'orb1', rx: 260, ry: 76,  tilt: 0,   angle: 0,   speed: 0.004  },
    { el: dot2, orb: 'orb2', rx: 232, ry: 98,  tilt: -38, angle: 2.1, speed: -0.005 },
    { el: dot3, orb: 'orb3', rx: 206, ry: 122, tilt: 52,  angle: 4.2, speed: 0.006  },
  ];

  window.addEventListener('mousemove', (e) => {
    const r = document.getElementById('memoji').getBoundingClientRect();
    tiltX = Math.max(-1, Math.min(1, (e.clientX - r.left - r.width/2) / (window.innerWidth/2)));
    tiltY = Math.max(-1, Math.min(1, (e.clientY - r.top - r.height/2) / (window.innerHeight/2)));
  });

  function project(x, y, z, rotY, rotX) {
  // Rotate Y
  const x1 = x * Math.cos(rotY) + z * Math.sin(rotY);
  const z1 = -x * Math.sin(rotY) + z * Math.cos(rotY);
  // Rotate X
  const y1 = y * Math.cos(rotX) - z1 * Math.sin(rotX);
  const z2 = y * Math.sin(rotX) + z1 * Math.cos(rotX);
  // Perspective divide
  const fov = 900;
  const scale = fov / (fov + z2);
  return { x: x1 * scale, y: y1 * scale };
}

  function buildPath(rx, ry, tiltDeg, rotY, rotX) {
    const tiltRad = tiltDeg * Math.PI / 180;
    const pts = [];
    for (let a = 0; a <= Math.PI * 2; a += 0.05) {
      const lx = rx * Math.cos(a);
      const ly = ry * Math.sin(a);
      const tx = lx * Math.cos(tiltRad) - ly * Math.sin(tiltRad);
      const ty = lx * Math.sin(tiltRad) + ly * Math.cos(tiltRad);
      const p = project(tx, ty, 0, rotY, rotX);
      pts.push(`${a === 0 ? 'M' : 'L'}${(CX + p.x).toFixed(1)},${(CY + p.y).toFixed(1)}`);
    }
    return pts.join(' ') + ' Z';
  }

  // Convert ellipses to paths
  const glowEls = Array.from(document.querySelectorAll('#m-orbits ellipse:not([id]):not([cx="200"][cy="230"])'));

  ringDefs.forEach((ring, i) => {
    const sharp = document.getElementById(ring.orb);
    if (!sharp) return;

    const sp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    sp.setAttribute('fill', 'none');
    sp.setAttribute('stroke', sharp.getAttribute('stroke'));
    sp.setAttribute('stroke-width', sharp.getAttribute('stroke-width'));
    const da = sharp.getAttribute('stroke-dasharray');
    if (da) sp.setAttribute('stroke-dasharray', da);
    sp.className.baseVal = sharp.className.baseVal;
    sp.id = ring.orb;
    sharp.parentNode.replaceChild(sp, sharp);
    ring.sharpPath = sp;

    if (glowEls[i]) {
      const gp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      gp.setAttribute('fill', 'none');
      gp.setAttribute('stroke', glowEls[i].getAttribute('stroke'));
      gp.setAttribute('stroke-width', glowEls[i].getAttribute('stroke-width'));
      const f = glowEls[i].getAttribute('filter');
      if (f) gp.setAttribute('filter', f);
      gp.className.baseVal = glowEls[i].className.baseVal;
      glowEls[i].parentNode.replaceChild(gp, glowEls[i]);
      ring.glowPath = gp;
    }
  });

  function animate() {
    smoothX += (tiltX - smoothX) * 0.05;
    smoothY += (tiltY - smoothY) * 0.05;
    spinAngle += 0.003;

    const rotY = spinAngle + smoothX * 0.5;
    const rotX = 0.52 + smoothY * 0.35;

    ringDefs.forEach(ring => {
      const d = buildPath(ring.rx, ring.ry, ring.tilt, rotY, rotX);
      if (ring.sharpPath) ring.sharpPath.setAttribute('d', d);
      if (ring.glowPath)  ring.glowPath.setAttribute('d', d);

      ring.angle += ring.speed;
      const tiltRad = ring.tilt * Math.PI / 180;
      const lx = ring.rx * Math.cos(ring.angle);
      const ly = ring.ry * Math.sin(ring.angle);
      const tx = lx * Math.cos(tiltRad) - ly * Math.sin(tiltRad);
      const ty = lx * Math.sin(tiltRad) + ly * Math.cos(tiltRad);
      const p = project(tx, ty, 0, rotY, rotX);
      ring.el.setAttribute('cx', CX + p.x);
      ring.el.setAttribute('cy', CY + p.y);
    });

    requestAnimationFrame(animate);
  }
  animate();
})();



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
  let mx = -999, my = -999;
  let tmx = 0, tmy = 0;

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });

  let stars = [];
  function initStars() {
    stars = Array.from({ length: 320 }, () => ({
      x:    Math.random() * W,
      y:    Math.random() * H,
      r:    Math.random() * 1.3 + 0.2,
      base: Math.random() * 0.6 + 0.15,
      spd:  Math.random() * 0.0008 + 0.0003,
      ph:   Math.random() * Math.PI * 2,
      vx:   (Math.random() - 0.5) * 0.06,
      vy:   (Math.random() - 0.5) * 0.04,
    }));
  }

  function drawStars(t) {
    for (const s of stars) {
      s.x = (s.x + s.vx + W) % W;
      s.y = (s.y + s.vy + H) % H;

      const alpha = s.base + Math.sin(t * s.spd + s.ph) * 0.25;
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



// ── Hero: glitch slice + chromatic aberration ────
(() => {
  const hero      = document.getElementById('hero');
  const heroName  = document.querySelector('.hero-name');
  const glitchMain= document.querySelector('.glitch-main');
  const glitchR   = document.querySelector('.glitch-r');
  const glitchB   = document.querySelector('.glitch-b');
  const heroHello = document.querySelector('.hero-hello');
  const heroRoles = document.querySelector('.hero-roles');
  const memoji    = document.getElementById('memoji');
  const canvas    = document.getElementById('bg-canvas');
  if (!hero || !heroName || !canvas) return;

  const ctx = canvas.getContext('2d');
  let particles = [];

  // ── Particle burst ───────────────────────────────
  function burst(el, count) {
    const rect = el.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = Math.random() * 4 + 1;
      const life  = Math.random() * 50 + 30;
      const r     = Math.random() * 2 + 0.4;
      const cols  = ['rgba(180,130,255,X)','rgba(255,60,120,X)','rgba(80,180,255,X)','rgba(240,220,255,X)'];
      particles.push({
        x:  rect.left + Math.random() * rect.width,
        y:  rect.top  + Math.random() * rect.height + window.scrollY,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 1.4,
        r, life, maxLife: life,
        color: cols[Math.floor(Math.random() * cols.length)]
      });
    }
  }

  const _orig = ctx.clearRect.bind(ctx);
  ctx.clearRect = function(...args) {
    _orig(...args);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy -= 0.07; p.vx *= 0.96;
      p.life--;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      const a = (p.life / p.maxLife) * 0.88;
      ctx.beginPath();
      ctx.arc(p.x, p.y - window.scrollY, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color.replace('X', a);
      ctx.fill();
    }
  };

  // ── Glitch state ─────────────────────────────────
  let glitchTicks  = 0;
  let slices       = [];
  let chromaX      = 0, chromaY = 0;
  let chromaLife   = 0;
  let scaleHit     = 1;
  let helloX       = 0, helloY = 0;
  let rolesX       = 0, rolesY = 0;
  let memojiShakeX = 0, memojiShakeY = 0;

  // Generate random slice clip-paths for VHS slice effect
  function makeSlices() {
    slices = [];
    const count = Math.floor(Math.random() * 4) + 3;
    let y = 0;
    for (let i = 0; i < count; i++) {
      const h   = Math.random() * 28 + 8;
      const off = (Math.random() - 0.5) * 44;
      slices.push({ y, h, off });
      y += h;
    }
  }

  // ── RAF loop ─────────────────────────────────────
  function tick() {
    const sy    = window.scrollY;
    const heroH = hero.offsetHeight;
    const p     = Math.min(sy / (heroH * 0.65), 1);

    scaleHit     = 1 + (scaleHit - 1) * 0.75;
    chromaLife  *= 0.78;
    helloX      *= 0.70; helloY      *= 0.70;
    rolesX      *= 0.70; rolesY      *= 0.70;
    memojiShakeX*= 0.72; memojiShakeY*= 0.72;

    // Cinematic push-out — applied to children only, never #hero itself
    const heroLeft = document.querySelector('.hero-left');
      if (heroLeft) {
        heroLeft.style.transform = `scale(${(1 - p * 0.06) * scaleHit})`;
        heroLeft.style.transformOrigin = 'center top';
      }

    // ── Glitch slice on name ─────────────────────
    if (glitchTicks > 0) {
      glitchTicks--;

      // Build multi-slice transform on main text
      // We fake slices by stacking clip-path animations via filter + transform
      const sliceOff = slices[0] ? slices[0].off : 0;
      glitchMain.style.transform  = `translateX(${sliceOff * 0.4}px)`;
      glitchMain.style.clipPath   = slices[1]
        ? `inset(${slices[0].y}px 0 0 0)`
        : 'none';

      // Chromatic aberration: R copy shifts right+up, B copy shifts left+down
      if (chromaLife > 0.05) {
        const cx = chromaX * chromaLife;
        const cy = chromaY * chromaLife;
        glitchR.style.opacity  = (chromaLife * 0.9).toString();
        glitchR.style.transform= `translate(${cx * 1.8}px, ${cy * -1.2}px)`;
        glitchR.style.clipPath = slices[0]
          ? `inset(0 0 ${100 - slices[0].h}% 0)`
          : 'inset(0 0 60% 0)';

        glitchB.style.opacity  = (chromaLife * 0.8).toString();
        glitchB.style.transform= `translate(${cx * -1.4}px, ${cy * 0.9}px)`;
        glitchB.style.clipPath = slices[1]
          ? `inset(${slices[1].y}% 0 0 0)`
          : 'inset(40% 0 0 0)';
      } else {
        glitchR.style.opacity = '0';
        glitchB.style.opacity = '0';
        glitchMain.style.transform = '';
        glitchMain.style.clipPath  = 'none';
      }
    } else {
      glitchR.style.opacity = '0';
      glitchB.style.opacity = '0';
      glitchMain.style.transform = '';
      glitchMain.style.clipPath  = 'none';
    }

    // Hello reactive
    heroHello.style.transform = `translateX(${helloX}px) translateY(${helloY}px)`;

    // Roles reactive
    heroRoles.style.transform = `translateX(${rolesX}px) translateY(${rolesY}px)`;

    // Memoji parallax + shake
    if (memoji) {
      memoji.style.transform = `translateY(${sy * -0.3 + memojiShakeY}px) translateX(${memojiShakeX}px) scale(${1 - p * 0.08})`;
    }

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ── Per scroll tick ──────────────────────────────
  let cooldown = false;

  window.addEventListener('wheel', (e) => {
    const sy    = window.scrollY;
    const heroH = hero.offsetHeight;
    const p     = Math.min(sy / (heroH * 0.65), 1);
    if (p >= 1 || cooldown) return;

    const dir = e.deltaY > 0 ? 1 : -1;

    // Trigger glitch slices
    makeSlices();
    glitchTicks = Math.floor(Math.random() * 6) + 4;

    // Chromatic aberration intensity
    chromaX    = (Math.random() - 0.5) * 28 + dir * 10;
    chromaY    = (Math.random() - 0.5) * 14;
    chromaLife = 0.9 + Math.random() * 0.1;

    // Scale punch
    scaleHit = 1 - dir * 0.022;

    // Hello + roles snap in opposite directions
    helloX = (Math.random() - 0.5) * 20;
    helloY = dir * -(Math.random() * 16 + 8);
    rolesX = (Math.random() - 0.5) * 16;
    rolesY = dir * (Math.random() * 14 + 6);

    // Memoji micro-shake
    memojiShakeX = (Math.random() - 0.5) * 14;
    memojiShakeY = dir * (Math.random() * 8 + 4);

    // Particle burst
    if (p > 0.02) {
      burst(heroName, 22);
      if (p > 0.2) burst(heroRoles, 8);
    }

    cooldown = true;
    setTimeout(() => cooldown = false, 85);
  }, { passive: true });
})();




// ── Idle VHS glitch on name ───────────────────────
(() => {
  const glitchMain = document.querySelector('.glitch-main');
  const glitchR    = document.querySelector('.glitch-r');
  const glitchB    = document.querySelector('.glitch-b');
  if (!glitchMain) return;

  function idleGlitch() {
    const sliceCount = Math.floor(Math.random() * 3) + 2;
    const cx = (Math.random() - 0.5) * 22;
    const cy = (Math.random() - 0.5) * 10;
    let ticks = Math.floor(Math.random() * 5) + 3;

    let chromaLife = 1.0;

    const iv = setInterval(() => {
      chromaLife *= 0.75;
      ticks--;

      glitchR.style.opacity   = (chromaLife * 0.85).toString();
      glitchR.style.transform = `translate(${cx * chromaLife * 1.6}px, ${cy * -chromaLife}px)`;
      glitchR.style.clipPath  = `inset(${Math.random()*30}% 0 ${Math.random()*30}% 0)`;

      glitchB.style.opacity   = (chromaLife * 0.75).toString();
      glitchB.style.transform = `translate(${cx * -chromaLife}px, ${cy * chromaLife * 0.8}px)`;
      glitchB.style.clipPath  = `inset(${Math.random()*40}% 0 ${Math.random()*20}% 0)`;

      glitchMain.style.transform = `translateX(${(Math.random()-0.5) * 8 * chromaLife}px)`;

      if (ticks <= 0) {
        clearInterval(iv);
        glitchR.style.opacity = '0';
        glitchB.style.opacity = '0';
        glitchMain.style.transform = '';
      }
    }, 40);

    // Schedule next idle glitch: 3-5 seconds
    setTimeout(idleGlitch, Math.random() * 2000 + 3000);
  }

  // First trigger after 2.5s
  setTimeout(idleGlitch, 2500);
})();

// ── Hide scroll indicators on scroll ─────────────
(() => {
  const si = document.getElementById('scroll-indicators');
  if (!si) return;
  window.addEventListener('scroll', () => {
    si.style.opacity = window.scrollY > 40 ? '0' : '1';
    si.style.transition = 'opacity 0.4s ease';
  }, { passive: true });
})();





// ── AI Terminal Chat ──────────────────────────────
(() => {
  const input    = document.getElementById('ai-input');
  const sendBtn  = document.getElementById('ai-send');
  const messages = document.getElementById('ai-messages');
  if (!input || !messages) return;

  const SYSTEM = `You are Clark's personal AI assistant embedded in his portfolio website.

About Clark:
- Name: Clark, known online as "cash33"
- He builds Windows optimization tools and runs the CASH33 community
- His main project is the CASH33 Optimizer: a comprehensive Windows 10/11 batch optimizer with 18 tweak categories, interactive ASCII menu, system detection, and logging
- He specializes in Windows tweaking, PC optimization, batch scripting, and dark themes
- He runs a Discord server called the CASH33 Server
- His GitHub username is @ZnqTvCSFrXDx
- His site has sections: About, Work (projects), Socials, and Vault (files/downloads)
- Two more projects are coming soon (no details yet)
- The site is dark-themed, purple/violet aesthetic, glitchy and techy
- He hasn't finished filling out all the site's information yet

Keep answers short, direct, and helpful. Don't make up details you don't know — just say Clark hasn't added that info yet. Never break character.`;

  const history = [];

  function addMsg(text, type) {
    const div = document.createElement('div');
    div.className = `ai-msg ai-msg--${type}`;
    if (type === 'bot') {
      div.innerHTML = `<span class="t-dim">» </span><span class="t-green-t">[AI]</span> ${text}`;
    } else {
      div.textContent = text;
    }
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  async function send() {
    const val = input.value.trim();
    if (!val) return;
    input.value = '';
    addMsg(val, 'user');
    history.push({ role: 'user', content: val });

    const thinking = addMsg('thinking...', 'thinking');

    try {
  const res = await fetch('http://localhost:3001', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: SYSTEM,
      messages: history
    })
  });
      const data = await res.json();
      const reply = data.content?.[0]?.text ?? data.choices?.[0]?.message?.content ?? 'No response.';
      history.push({ role: 'assistant', content: reply });
      thinking.remove();
      addMsg(reply, 'bot');
    } catch (e) {
      thinking.remove();
      addMsg('Connection error. Try again.', 'thinking');
    }
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
})();