// ── Loading Screen ────────────────────────────────
(() => {
  const loader   = document.getElementById('cash-loader');
  const bar      = document.getElementById('loader-bar-fill');
  const pctEl    = document.getElementById('loader-pct');
  const statusEl = document.getElementById('loader-status');
  if (!loader || !bar) return;

  // ── Particle canvas (floating dots in background) ──
  const canvas = document.getElementById('loader-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let W, H, particles = [];
    function resizeCanvas() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * (window.innerWidth  || 1920),
        y: Math.random() * (window.innerHeight || 1080),
        r: Math.random() * 1.8 + 0.4,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        alpha: Math.random() * 0.5 + 0.1,
      });
    }

    let rafId;
    function drawParticles() {
      if (!canvas.isConnected) return;
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(157,95,245,${p.alpha})`;
        ctx.fill();
      });
      rafId = requestAnimationFrame(drawParticles);
    }
    drawParticles();
  }

  const messages = [
    'Initializing...',
    'Loading assets...',
    'Building galaxy...',
    'Almost there...',
    'Welcome.'
  ];

  let current = 0;

  const arcEl = document.getElementById('loader-arc');
  const arcCircumference = 565; // 2π × r=90

  function setProgress(pct) {
    bar.style.width = pct + '%';
    pctEl.textContent = Math.round(pct) + '%';
    // Drive SVG arc: offset goes from full (565=empty) to 0 (full)
    if (arcEl) {
      arcEl.style.strokeDashoffset = arcCircumference - (arcCircumference * pct / 100);
    }
    const msgIdx = Math.min(Math.floor(pct / 25), messages.length - 1);
    if (msgIdx !== current) {
      current = msgIdx;
      statusEl.style.opacity = '0';
      setTimeout(() => {
        statusEl.textContent = messages[current];
        statusEl.style.opacity = '1';
      }, 180);
    }
  }

  // ── Scale + blur → lens flare → fade dismiss ───────
  function shatterDismiss() {
    setProgress(100);
    statusEl.style.opacity = '0';
    setTimeout(() => { statusEl.textContent = 'Welcome.'; statusEl.style.opacity = '1'; }, 180);

    setTimeout(() => {
      const inner = loader.querySelector('.loader-inner');

      // ── Flare layer — pure circular, no oval pink ──
      const flare = document.createElement('div');
      flare.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 9999998;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.08s ease;
        will-change: opacity;
      `;
      document.body.appendChild(flare);

      // ── Step 1: content explodes outward + blurs ──
      if (inner) {
        inner.style.transition = 'transform 1s cubic-bezier(.2,0,.1,1), filter 1s cubic-bezier(.2,0,.1,1), opacity 0.7s ease 0.15s';
        inner.style.transform  = 'scale(1.55)';
        inner.style.filter     = 'blur(40px) brightness(3)';
        inner.style.opacity    = '0';
      }

      // ── Step 2: white-purple circular burst at peak ──
      setTimeout(() => {
        // Perfectly circular gradient — no ellipse, no pink
        flare.style.background = `
          radial-gradient(circle at 50% 50%,
            rgba(255,255,255,0.92)  0%,
            rgba(220,200,255,0.75) 12%,
            rgba(157,95,245,0.55)  30%,
            rgba(124,58,237,0.25)  52%,
            rgba(80,20,160,0.08)   70%,
            transparent            100%)
        `;
        flare.style.opacity = '1';

        // Immediately start fading the flare — no linger
        requestAnimationFrame(() => {
          flare.style.transition = 'opacity 0.6s cubic-bezier(.4,0,.2,1)';
          flare.style.opacity    = '0';
        });
      }, 380);

      // ── Step 3: fade loader bg out behind the flare ──
      setTimeout(() => {
        loader.classList.add('loader-done');
      }, 520);

      // ── Cleanup ──
      setTimeout(() => flare.remove(), 1400);

    }, 650);
  }

  // ── 60fps rAF progress simulation — realistic ~4s pace ──
  let simPct = 0;
  let simRunning = true;
  let lastSimTime = 0;
  let simRaf;

  function simStep(ts) {
    if (!simRunning) return;
    const dt = Math.min(ts - lastSimTime, 50); // cap to avoid jump after tab switch
    lastSimTime = ts;
    // Eases hard as it approaches 82 — natural loading feel
    const ease = Math.max(0.04, 1 - Math.pow(simPct / 80, 2.8));
    simPct += (dt * 0.018) * ease;
    simPct = Math.min(simPct, 82);
    setProgress(simPct);
    simRaf = requestAnimationFrame(simStep);
  }
  simRaf = requestAnimationFrame(ts => { lastSimTime = ts; simStep(ts); });

  function onLoaded() {
    simRunning = false;
    cancelAnimationFrame(simRaf);
    const startPct = simPct;
    const startTime = performance.now();
    const duration = 1100; // smooth 1.1s coast to 100%
    function fillStep(ts) {
      const t = Math.min(1, (ts - startTime) / duration);
      const eased = t < 1 ? 1 - Math.pow(1 - t, 3) : 1;
      setProgress(startPct + (100 - startPct) * eased);
      if (t < 1) requestAnimationFrame(fillStep);
      else shatterDismiss();
    }
    requestAnimationFrame(fillStep);
  }

  if (document.readyState === 'complete') {
    setTimeout(onLoaded, 4500);
  } else {
    window.addEventListener('load', () => setTimeout(onLoaded, 2000), { once: true });
    setTimeout(onLoaded, 12000);
  }
})();

// ── Page indicator — driven by master RAF, no extra scroll listener ──
(() => {
  const fill = document.getElementById('page-nav-fill');
  if (!fill) return;
  let _docH = document.documentElement.scrollHeight - window.innerHeight;
  window.addEventListener('resize', () => {
    _docH = document.documentElement.scrollHeight - window.innerHeight;
  }, { passive: true });
  window._pageNavTick = function(sy) {
    if (_docH <= 0) return;
    const pct = Math.min(1, Math.max(0, sy / _docH));
    fill.style.transform = `scaleY(${pct.toFixed(4)})`;
  };
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
}, { threshold: 0.15, rootMargin: '-10% 0px -60% 0px' });
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
    if (iter > total + 3) { el.textContent = original; clearInterval(iv); }
  }, 38);
}

const headingObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const h2 = e.target.querySelector('.section-header h2');
      if (h2) setTimeout(() => glitchText(h2), 200);
    }
  });
}, { threshold: 0, rootMargin: '-30% 0px -30% 0px' });
document.querySelectorAll('.section').forEach(s => headingObs.observe(s));

const fadeGroups = [
  document.querySelectorAll('.card'),
  document.querySelectorAll('.social-card'),
  document.querySelectorAll('.contact-info-row'),
  document.querySelectorAll('.section-sub'),
];
const fadeObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
      fadeObs.unobserve(e.target);
      // Free GPU layer after animation completes
      setTimeout(() => { e.target.style.willChange = 'auto'; }, 700);
    }
  });
}, { threshold: 0.06 });
fadeGroups.forEach(group => {
  group.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.willChange = 'opacity, transform';
    // Drop color transition — not needed in this reveal
    el.style.transition = `opacity 0.55s cubic-bezier(.22,1,.36,1) ${i * 0.07}s, transform 0.55s cubic-bezier(.22,1,.36,1) ${i * 0.07}s`;
    fadeObs.observe(el);
  });
});

// ── About text: word-by-word dramatic reveal ──────
(() => {
  const paras = document.querySelectorAll('.about-text p');
  if (!paras.length) return;

  // Split each paragraph into word spans
  paras.forEach((p, pi) => {
    const raw = p.innerHTML;
    // preserve inner HTML tags (like <span class="hi">)
    // split on spaces but keep tag nodes intact
    const temp = document.createElement('div');
    temp.innerHTML = raw;

    const nodes = Array.from(temp.childNodes);
    p.innerHTML = '';

    nodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const words = node.textContent.split(/(\s+)/);
        words.forEach(w => {
          if (/^\s+$/.test(w)) {
            p.appendChild(document.createTextNode(' '));
          } else if (w) {
            const span = document.createElement('span');
            span.className = 'about-word';
            span.textContent = w;
            p.appendChild(span);
            p.appendChild(document.createTextNode(' '));
          }
        });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // wrap the whole inner element as one word-unit
        const words = node.textContent.trim().split(/\s+/);
        words.forEach((w, wi) => {
          const span = document.createElement('span');
          span.className = 'about-word';
          if (node.className) {
            // preserve class like "hi"
            const inner = document.createElement(node.tagName.toLowerCase());
            inner.className = node.className;
            inner.textContent = w;
            span.appendChild(inner);
          } else {
            span.textContent = w;
          }
          p.appendChild(span);
          if (wi < words.length - 1) p.appendChild(document.createTextNode(' '));
        });
        p.appendChild(document.createTextNode(' '));
      }
    });
  });

  // Stagger config per paragraph
  // para 0 = "Hey — I'm Clark..." fast, tight stagger
  // para 1 = body text, medium stagger
  // para 2 = body text, longer stagger
  const paraBaseDelay = [0.4, 0.95, 1.5];
  const wordStagger   = [0.045, 0.038, 0.035];

  paras.forEach((p, pi) => {
    const words = p.querySelectorAll('.about-word');
    words.forEach((w, wi) => {
      w.style.transitionDelay = `${paraBaseDelay[pi] + wi * wordStagger[pi]}s`;
    });
  });

  const aboutSection = document.getElementById('about');
  if (!aboutSection) return;

  const allWords = () => Array.from(document.querySelectorAll('.about-text .about-word'));
  let isShown = false;

  function resetWords() {
    const words = allWords();
    words.forEach(w => {
      w.style.transition = 'none';
      w.classList.remove('word-visible', 'word-flash');
    });
    void words[0]?.offsetWidth;
    words.forEach(w => { w.style.transition = ''; });
  }

  function revealWords() {
    isShown = true;
    resetWords();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      allWords().forEach(w => {
        const delay = parseFloat(w.style.transitionDelay || 0);
        w.classList.add('word-visible');
        if (w.closest('p') === paras[0]) {
          setTimeout(() => w.classList.add('word-flash'), (delay + 0.45) * 1000);
        }
      });
    }));
  }

  // Use IntersectionObserver — zero scroll cost
  const aboutIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting && !isShown) {
        revealWords();
      } else if (!e.isIntersecting) {
        isShown = false;
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -10% 0px' });
  aboutIO.observe(aboutSection);
})();

// ── Reactive memoji follows cursor ────────────────
(() => {
  const memoji = document.getElementById('memoji');
  const head   = document.getElementById('m-head');
  const eyes   = document.getElementById('m-eyes');
  const pupils = document.getElementById('m-pupils');
  const brows  = document.getElementById('m-brows');
  const lids   = document.querySelectorAll('.m-lid');
  if (!memoji) return;

  let tx = 0, ty = 0, cx = 0, cy = 0, isMoving = false, moveTimer = null;

  // Cache rect — only update on resize, not every mousemove
  let _memojiRect = memoji.getBoundingClientRect();
  window.addEventListener('resize', () => { _memojiRect = memoji.getBoundingClientRect(); }, { passive: true });

  window.addEventListener('mousemove', (e) => {
    const ox = _memojiRect.left + _memojiRect.width  / 2;
    const oy = _memojiRect.top  + _memojiRect.height / 2;
    tx = Math.max(-1, Math.min(1, (e.clientX - ox) / (window.innerWidth  / 2)));
    ty = Math.max(-1, Math.min(1, (e.clientY - oy) / (window.innerHeight / 2)));
    isMoving = true;
    clearTimeout(moveTimer);
    moveTimer = setTimeout(() => { isMoving = false; }, 300);
  }, { passive: true });

  // Exposed so the master loop can call it
  window._memojiTick = function() {
    cx += (tx - cx) * 0.10;
    cy += (ty - cy) * 0.10;
    head.setAttribute('transform', `translate(${cx * 22} ${cy * 16}) rotate(${cx * 7} 200 260)`);
    eyes.setAttribute('transform',   `translate(${cx * 8} ${cy * 7})`);
    pupils.setAttribute('transform', `translate(${cx * 12} ${cy * 11})`);
    brows.setAttribute('transform',  `translate(${cx * 6} ${(-Math.max(0,-cy)) * 8 + cy * 4})`);
    const smileClosed = document.getElementById('m-smile-closed');
    const smileOpen   = document.getElementById('m-smile-open');
    if (smileClosed && smileOpen) {
      smileClosed.style.opacity = isMoving ? '0' : '1';
      smileOpen.style.opacity   = isMoving ? '1' : '0';
    }
  };

  // Blink driven by RAF timestamp — no setInterval
  let _blinkNext = 0;
  const _origMemojiTick = window._memojiTick;
  window._memojiTick = function(ts) {
    _origMemojiTick();
    if (!ts) return;
    if (ts > _blinkNext) {
      lids.forEach(l => l.setAttribute('height', '40'));
      setTimeout(() => lids.forEach(l => l.setAttribute('height', '0')), 130);
      _blinkNext = ts + 4200 + Math.random() * 1000;
    }
  };
})();

// ── Orbit rings animation ─────────────────────────
(() => {
  const dot1 = document.getElementById('dot1');
  const dot2 = document.getElementById('dot2');
  const dot3 = document.getElementById('dot3');
  if (!dot1) return;

  const CX = 200, CY = 250;
  let tiltX = 0, tiltY = 0, smoothX = 0, smoothY = 0;

  const ringDefs = [
    { el: dot1, orb: 'orb1', rx: 260, ry: 76,  tiltX: 80, tiltZ: 0,   angle: 0,   speed: 0.004,  baseR: 5.5 },
    { el: dot2, orb: 'orb2', rx: 232, ry: 98,  tiltX: 65, tiltZ: -38, angle: 2.1, speed: -0.005, baseR: 4.0 },
    { el: dot3, orb: 'orb3', rx: 206, ry: 122, tiltX: 55, tiltZ: 52,  angle: 4.2, speed: 0.006,  baseR: 3.5 },
  ];

  let _orbitRect = document.getElementById('memoji').getBoundingClientRect();
  window.addEventListener('resize', () => { _orbitRect = document.getElementById('memoji').getBoundingClientRect(); }, { passive: true });
  window.addEventListener('mousemove', (e) => {
    tiltX = Math.max(-1, Math.min(1, (e.clientX - _orbitRect.left - _orbitRect.width/2) / (window.innerWidth/2)));
    tiltY = Math.max(-1, Math.min(1, (e.clientY - _orbitRect.top - _orbitRect.height/2) / (window.innerHeight/2)));
  }, { passive: true });

  function project(x, y, z, rotY, rotX) {
    const x1 = x * Math.cos(rotY) + z * Math.sin(rotY);
    const z1 = -x * Math.sin(rotY) + z * Math.cos(rotY);
    const y1 = y * Math.cos(rotX) - z1 * Math.sin(rotX);
    const z2 = y * Math.sin(rotX) + z1 * Math.cos(rotX);
    const fov = 900;
    const scale = fov / (fov + z2);
    return { x: x1 * scale, y: y1 * scale, z: z2, scale };
  }

  function buildPath(rx, ry, tiltX, tiltZ, rotY, rotX) {
    const txR = tiltX * Math.PI / 180;
    const tzR = tiltZ * Math.PI / 180;
    const pts = [];
    for (let a = 0; a <= Math.PI * 2; a += 0.05) {
      const ex = rx * Math.cos(a);
      const ey = ry * Math.sin(a);
      const rx1 = ex * Math.cos(tzR) - ey * Math.sin(tzR);
      const ry1 = ex * Math.sin(tzR) + ey * Math.cos(tzR);
      const ry2 = ry1 * Math.cos(txR);
      const rz2 = ry1 * Math.sin(txR);
      const p = project(rx1, ry2, rz2, rotY, rotX);
      pts.push(`${a === 0 ? 'M' : 'L'}${(CX + p.x).toFixed(1)},${(CY + p.y).toFixed(1)}`);
    }
    return pts.join(' ') + ' Z';
  }

  const glowEls = Array.from(document.querySelectorAll('#m-orbits ellipse:not([id]):not([cx="200"][cy="230"])'));
  const svg = document.querySelector('#m-orbits').closest('svg');

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

  let _lastRotY = null, _lastRotX = null;
  window._orbitTick = function() {
    smoothX += (tiltX - smoothX) * 0.07;
    smoothY += (tiltY - smoothY) * 0.07;
    const rotY = smoothX * 0.5;
    const rotX = 1.1 + smoothY * 0.35;

    // Only rebuild paths if tilt changed meaningfully
    const pathDirty = _lastRotY === null || Math.abs(rotY - _lastRotY) > 0.001 || Math.abs(rotX - _lastRotX) > 0.001;
    if (pathDirty) { _lastRotY = rotY; _lastRotX = rotX; }

    ringDefs.forEach(ring => {
      if (pathDirty) {
        const d = buildPath(ring.rx, ring.ry, ring.tiltX, ring.tiltZ, rotY, rotX);
        if (ring.sharpPath) ring.sharpPath.setAttribute('d', d);
        if (ring.glowPath)  ring.glowPath.setAttribute('d', d);
      }
      ring.angle += ring.speed;
      const txR = ring.tiltX * Math.PI / 180;
      const tzR = ring.tiltZ * Math.PI / 180;
      const ex = ring.rx * Math.cos(ring.angle);
      const ey = ring.ry * Math.sin(ring.angle);
      const rx1 = ex * Math.cos(tzR) - ey * Math.sin(tzR);
      const ry1 = ex * Math.sin(tzR) + ey * Math.cos(tzR);
      const p = project(rx1, ry1 * Math.cos(txR), ry1 * Math.sin(txR), rotY, rotX);
      const dot = ring.el;
      dot.setAttribute('cx', CX + p.x);
      dot.setAttribute('cy', CY + p.y);
      dot.setAttribute('r', (ring.baseR * p.scale).toFixed(2));
      const depthOpacity = p.z < 0
        ? Math.max(0.15, 0.45 - (Math.abs(p.z) / 300) * 0.3)
        : Math.min(1, 0.85 + (p.z / 300) * 0.15);
      dot.setAttribute('opacity', depthOpacity.toFixed(3));
    });
  };
})();

// ── Custom cursor + nav/sidebar merge ──────────────
(() => {
  const ring      = document.getElementById('cursor-ring');
  const navEl     = document.querySelector('nav');
  const sidebarEl = document.querySelector('.dev-portal-pill');
  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let rx = mx, ry = my;
  let locked = false;

  window.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; if (!locked) ring.style.opacity = '1'; }, { passive: true });

  window._cursorTick = function() {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    if (!locked) {
      // translate3d keeps this on the compositor thread
      ring.style.transform = `translate3d(calc(${rx}px - 50%), calc(${ry}px - 50%), 0)`;
    }
  };






  function mergeInto(targetEl, clearRef) {
    const r  = targetEl.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    locked = true;
    ring.style.transition = 'none';
    ring.style.transform = `translate3d(calc(${rx}px - 50%), calc(${ry}px - 50%), 0)`;
    requestAnimationFrame(() => {
      ring.classList.add('nav-merge');
      ring.classList.remove('clicking', 'hovering');
      ring.style.transition =
        'transform 0.55s cubic-bezier(.22,1,.36,1), ' +
        'width 0.55s cubic-bezier(.22,1,.36,1), height 0.55s cubic-bezier(.22,1,.36,1), ' +
        'border-radius 0.55s cubic-bezier(.22,1,.36,1), opacity 0.2s ease, filter 0.45s ease, background 0.35s ease';
      ring.style.transform = `translate3d(calc(${cx}px - 50%), calc(${cy}px - 50%), 0)`;
      ring.style.width  = r.width  + 'px';
      ring.style.height = r.height + 'px';
      ring.style.opacity = '0';
      targetEl.classList.add('absorbing');
      clearTimeout(clearRef[0]);
      clearRef[0] = setTimeout(() => targetEl.classList.remove('absorbing'), 600);
    });
  }

  function burstOut(targetEl) {
    locked = false;
    ring.classList.remove('nav-merge');
    const r = targetEl.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    ring.style.transition = 'none';
    ring.style.transform = `translate3d(calc(${cx}px - 50%), calc(${cy}px - 50%), 0)`;
    ring.style.width = r.width + 'px';
    ring.style.height = r.height + 'px';
    ring.style.borderRadius = '999px';
    ring.style.opacity = '0.6';
    requestAnimationFrame(() => {
      ring.style.transition = 'transform 0.4s cubic-bezier(.22,1,.36,1), width 0.4s cubic-bezier(.22,1,.36,1), height 0.4s cubic-bezier(.22,1,.36,1), border-radius 0.4s cubic-bezier(.22,1,.36,1), opacity 0.35s ease, filter 0.4s ease, background 0.35s ease';
      ring.style.width = '56px'; ring.style.height = '56px';
      ring.style.borderRadius = '50%'; ring.style.opacity = '1';
    });
  }

  if (navEl) { const r=[null]; navEl.addEventListener('mouseenter', () => mergeInto(navEl, r)); navEl.addEventListener('mouseleave', () => burstOut(navEl)); }
  if (sidebarEl) { const r=[null]; sidebarEl.addEventListener('mouseenter', () => mergeInto(sidebarEl, r)); sidebarEl.addEventListener('mouseleave', () => burstOut(sidebarEl)); }

  // ── AI widget button + panel: same merge/burst as social cards ──
  requestAnimationFrame(() => {
    const aiBtn   = document.getElementById('ai-widget-btn');
    const aiPanel = document.getElementById('ai-widget-panel');

    function mergeAI(el) {
      const r  = el.getBoundingClientRect();
      const cx = r.left + r.width  / 2;
      const cy = r.top  + r.height / 2;
      locked = true;
      ring.style.transition = 'none';
      ring.style.transform = `translate3d(calc(${rx}px - 50%), calc(${ry}px - 50%), 0)`;
      ring.style.background = 'transparent';
      ring.style.boxShadow  = 'none';
      ring.style.filter     = 'none';
      requestAnimationFrame(() => {
        ring.classList.remove('nav-merge', 'clicking', 'hovering');
        ring.classList.add('card-merge');
        ring.style.transition =
          'transform 0.65s cubic-bezier(.22,1,.36,1), ' +
          'width 0.65s cubic-bezier(.22,1,.36,1), ' +
          'height 0.65s cubic-bezier(.22,1,.36,1), ' +
          'border-radius 0.65s cubic-bezier(.22,1,.36,1), ' +
          'opacity 0.2s ease';
        ring.style.transform  = `translate(calc(${cx}px - 50%), calc(${cy}px - 50%))`;
        ring.style.width      = r.width  + 'px';
        ring.style.height     = r.height + 'px';
        ring.style.borderRadius = el === aiBtn ? '14px' : '20px';
        ring.style.opacity    = '0';
      });
    }

    function burstAI(el) {
      locked = false;
      ring.classList.remove('card-merge');
      const r  = el.getBoundingClientRect();
      const cx = r.left + r.width  / 2;
      const cy = r.top  + r.height / 2;
      ring.style.transition = 'none';
      ring.style.background = '';
      ring.style.boxShadow  = '';
      ring.style.filter     = '';
      ring.style.transform  = `translate(calc(${cx}px - 50%), calc(${cy}px - 50%))`;
      ring.style.width      = r.width  + 'px';
      ring.style.height     = r.height + 'px';
      ring.style.borderRadius = '999px';
      ring.style.opacity    = '0';
      requestAnimationFrame(() => {
        ring.style.transition =
          'transform 0.55s cubic-bezier(.22,1,.36,1), ' +
          'width 0.55s cubic-bezier(.22,1,.36,1), ' +
          'height 0.55s cubic-bezier(.22,1,.36,1), ' +
          'border-radius 0.55s cubic-bezier(.22,1,.36,1), ' +
          'opacity 0.4s ease, filter 0.4s ease, background 0.35s ease';
        ring.style.width        = '56px';
        ring.style.height       = '56px';
        ring.style.borderRadius = '50%';
        ring.style.opacity      = '1';
      });
    }

    if (aiBtn) {
      aiBtn.addEventListener('mouseenter', () => mergeAI(aiBtn));
      aiBtn.addEventListener('mouseleave', () => burstAI(aiBtn));
    }
    if (aiPanel) {
      aiPanel.addEventListener('mouseenter', () => mergeAI(aiPanel));
      aiPanel.addEventListener('mouseleave', () => burstAI(aiPanel));
    }
  });

  // ── Social cards + big preview: merge with no glow ──
  function mergeIntoCard(targetEl) {
    const r  = targetEl.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    locked = true;
    ring.style.transition = 'none';
    ring.style.transform = `translate3d(calc(${rx}px - 50%), calc(${ry}px - 50%), 0)`;
    ring.style.background = 'transparent';
    ring.style.boxShadow  = 'none';
    ring.style.filter     = 'none';
    requestAnimationFrame(() => {
      ring.classList.remove('nav-merge', 'clicking', 'hovering');
      ring.classList.add('card-merge');
      ring.style.transition =
        'transform 0.55s cubic-bezier(.22,1,.36,1), ' +
        'width 0.55s cubic-bezier(.22,1,.36,1), height 0.55s cubic-bezier(.22,1,.36,1), ' +
        'border-radius 0.55s cubic-bezier(.22,1,.36,1), opacity 0.15s ease';
      ring.style.transform = `translate3d(calc(${cx}px - 50%), calc(${cy}px - 50%), 0)`;
      ring.style.width  = r.width  + 'px';
      ring.style.height = r.height + 'px';
      ring.style.opacity = '0';
    });
  }

  function burstOutCard(targetEl) {
    locked = false;
    ring.classList.remove('card-merge');
    const r = targetEl.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    ring.style.transition = 'none';
    ring.style.background = '';
    ring.style.boxShadow  = '';
    ring.style.filter     = '';
    ring.style.transform = `translate3d(calc(${cx}px - 50%), calc(${cy}px - 50%), 0)`;
    ring.style.width = r.width + 'px';
    ring.style.height = r.height + 'px';
    ring.style.borderRadius = '999px';
    ring.style.opacity = '0';
    requestAnimationFrame(() => {
      ring.style.transition = 'transform 0.4s cubic-bezier(.22,1,.36,1), width 0.4s cubic-bezier(.22,1,.36,1), height 0.4s cubic-bezier(.22,1,.36,1), border-radius 0.4s cubic-bezier(.22,1,.36,1), opacity 0.35s ease, filter 0.4s ease, background 0.35s ease';
      ring.style.width = '56px'; ring.style.height = '56px';
      ring.style.borderRadius = '50%'; ring.style.opacity = '1';
    });
  }

  document.querySelectorAll('.social-card').forEach(card => {
    card.addEventListener('mouseenter', () => mergeIntoCard(card));
    card.addEventListener('mouseleave', () => burstOutCard(card));
  });

  // Expose so other elements can hook in
  window._cursorMerge = { mergeInto, burstOut, mergeIntoCard, burstOutCard, ring, getLocked: () => locked, _setLocked: (v) => { locked = v; } };

  window.addEventListener('mousedown', () => { if (!locked) ring.classList.add('clicking'); });
  window.addEventListener('mouseup',   () => ring.classList.remove('clicking'));
  document.querySelectorAll('a, button, .card, .tag, .social-card').forEach(el => {
    el.addEventListener('mouseenter', () => { if (!locked) ring.classList.add('hovering'); });
    el.addEventListener('mouseleave', () => ring.classList.remove('hovering'));
  });
  document.addEventListener('mouseleave', () => { ring.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { if (!locked) ring.style.opacity = '1'; });
})();

// ── Split panel cursor merge ──────────────────────
(() => {
  requestAnimationFrame(() => {
    const cm = window._cursorMerge;
    if (!cm) return;
    const { ring, _setLocked } = cm;

    document.querySelectorAll('.split-panel').forEach(panel => {
      const ref = [null];

      panel.addEventListener('mouseenter', () => {
        const pr   = panel.getBoundingClientRect();
        const boxR = panel.closest('.about-split-box')?.getBoundingClientRect() || pr;
        const w    = pr.width;
        const h    = boxR.height;
        const cx   = pr.left + w / 2;
        const cy   = boxR.top + h / 2;

        if (_setLocked) _setLocked(true);

        ring.classList.remove('nav-merge', 'clicking', 'hovering');
        ring.classList.add('panel-merge');

        ring.style.transition   = 'none';
        ring.style.opacity      = '1';
        ring.style.width        = '56px';
        ring.style.height       = '56px';
        ring.style.borderRadius = '50%';

        requestAnimationFrame(() => {
          ring.style.transition =
            'transform 0.45s cubic-bezier(.22,1,.36,1),' +
            'width 0.45s cubic-bezier(.22,1,.36,1),' +
            'height 0.45s cubic-bezier(.22,1,.36,1),' +
            'border-radius 0.45s cubic-bezier(.22,1,.36,1),' +
            'opacity 0.3s ease';
          ring.style.transform    = `translate(calc(${cx}px - 50%), calc(${cy}px - 50%))`;
          ring.style.width        = w  + 'px';
          ring.style.height       = h  + 'px';
          ring.style.borderRadius = '12px';

          panel.classList.add('absorbing');
          clearTimeout(ref[0]);
          panel.classList.add('absorbing');

          setTimeout(() => {
            ring.style.opacity = '0';
          }, 280);
        });
      });

      panel.addEventListener('mouseleave', () => {
        panel.classList.remove('absorbing');

        ring.classList.remove('panel-merge');
        ring.style.border    = '';
        ring.style.boxShadow = '';

        const pr = panel.getBoundingClientRect();
        const pcx = pr.left + pr.width  / 2;
        const pcy = pr.top  + pr.height / 2;
        ring.style.transition   = 'none';
        ring.style.transform    = `translate(calc(${pcx}px - 50%), calc(${pcy}px - 50%))`;
        ring.style.width        = pr.width  + 'px';
        ring.style.height       = pr.height + 'px';
        ring.style.borderRadius = '12px';
        ring.style.opacity      = '0.7';

        requestAnimationFrame(() => {
          ring.style.transition =
            'transform 0.38s cubic-bezier(.22,1,.36,1),' +
            'width 0.38s cubic-bezier(.22,1,.36,1),' +
            'height 0.38s cubic-bezier(.22,1,.36,1),' +
            'border-radius 0.38s cubic-bezier(.22,1,.36,1),' +
            'opacity 0.3s ease';
          ring.style.width        = '56px';
          ring.style.height       = '56px';
          ring.style.borderRadius = '50%';
          ring.style.opacity      = '1';

          setTimeout(() => {
            if (_setLocked) _setLocked(false);
          }, 400);
        });
      });
    });
  });
})();

// ── Cursor ring merges into sphere on click/hold ──
(() => {
  requestAnimationFrame(() => {
    const cm = window._cursorMerge;
    const sphereWrap = document.querySelector('.sphere-wrap');
    if (!cm || !sphereWrap) return;
    const { ring, _setLocked } = cm;

    sphereWrap.addEventListener('mousedown', () => {
      const r = sphereWrap.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;

      _setLocked(true);
      ring.classList.remove('nav-merge', 'panel-merge', 'clicking', 'hovering');
      ring.classList.add('sphere-merge');

      ring.style.transition = 'none';
      requestAnimationFrame(() => {
        ring.style.transition =
          'transform 0.4s cubic-bezier(.22,1,.36,1),' +
          'width 0.4s cubic-bezier(.22,1,.36,1),' +
          'height 0.4s cubic-bezier(.22,1,.36,1),' +
          'opacity 0.35s ease, filter 0.35s ease';
        ring.style.transform = `translate3d(calc(${cx}px - 50%), calc(${cy}px - 50%), 0)`;
        ring.style.width = '20px';
        ring.style.height = '20px';
        ring.style.opacity = '0';
      });
    });

    window.addEventListener('mouseup', (e) => {
      if (!ring.classList.contains('sphere-merge')) return;
      ring.classList.remove('sphere-merge');

      ring.style.transition = 'none';
      ring.style.transform = `translate3d(calc(${e.clientX}px - 50%), calc(${e.clientY}px - 50%), 0)`;
      ring.style.width = '20px';
      ring.style.height = '20px';
      ring.style.opacity = '0';

      requestAnimationFrame(() => {
        ring.style.transition =
          'transform 0.35s cubic-bezier(.22,1,.36,1),' +
          'width 0.35s cubic-bezier(.22,1,.36,1),' +
          'height 0.35s cubic-bezier(.22,1,.36,1),' +
          'opacity 0.3s ease';
        ring.style.opacity = '1';
        ring.style.width = '56px';
        ring.style.height = '56px';

        setTimeout(() => {
          _setLocked(false);
        }, 380);
      });
    });
  });
})();

// ── Galaxy background ─────────────────────────────
(() => {
  const canvas = document.getElementById('bg-canvas');
  const ctx    = canvas.getContext('2d', { willReadFrequently: false, alpha: true });
  let W, H, mx = -999, my = -999, tmx = 0, tmy = 0;
  let stars = [], meteors = [], dots = [];
  let cols, rows;
  const SPACING = 44;

  // Throttle mousemove updates for grid
  let pendingMX = -999, pendingMY = -999;
  window.addEventListener('mousemove', (e) => { pendingMX = e.clientX; pendingMY = e.clientY; mx = e.clientX; my = e.clientY; }, { passive: true });

  function initStars() {
    stars = Array.from({ length: 160 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.3 + 0.2,
      base: Math.random() * 0.6 + 0.15,
      spd: Math.random() * 0.0008 + 0.0003,
      ph: Math.random() * Math.PI * 2,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.12,
    }));
  }

  function drawStars(t) {
    for (const s of stars) {
      s.x = (s.x + s.vx + W) % W;
      s.y = (s.y + s.vy + H) % H;
      const alpha = s.base + Math.sin(t * s.spd + s.ph) * 0.25;
      const dx = tmx - s.x, dy = tmy - s.y;
      const distSq = dx * dx + dy * dy;
      // Avoid sqrt — use squared threshold (180^2 = 32400)
      const boost = distSq < 32400 ? Math.max(0, 1 - distSq / 32400) * 0.7 : 0;
      const a = Math.min(1, alpha + boost);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r + boost * 1.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(220,210,255,${a.toFixed(2)})`;
      ctx.fill();
    }
  }

  function spawnMeteor() {
    meteors.push({ x: Math.random() * W, y: Math.random() * H * 0.5, len: Math.random() * 160 + 80, speed: Math.random() * 6 + 3, opacity: 1, angle: Math.PI / 4 });
    setTimeout(spawnMeteor, Math.random() * 15000 + 10000);
  }

  function drawMeteors() {
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.x += Math.cos(m.angle) * m.speed;
      m.y += Math.sin(m.angle) * m.speed;
      m.opacity -= 0.012;
      if (m.opacity <= 0) { meteors.splice(i, 1); continue; }
      const tx = m.x - Math.cos(m.angle) * m.len;
      const ty = m.y - Math.sin(m.angle) * m.len;
      const grd = ctx.createLinearGradient(m.x, m.y, tx, ty);
      const op = m.opacity;
      grd.addColorStop(0,   `rgba(255,200,255,${op.toFixed(2)})`);
      grd.addColorStop(0.3, `rgba(220,130,255,${(op * 0.8).toFixed(2)})`);
      grd.addColorStop(1,   'rgba(180,140,255,0)');
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = grd;
      ctx.lineWidth = m.len > 150 ? 2.5 : 1.5;
      ctx.stroke();
    }
  }

  function initGrid() {
    cols = Math.ceil(W / SPACING) + 1;
    rows = Math.ceil(H / SPACING) + 1;
    dots = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        dots.push({ x: c * SPACING, y: r * SPACING, scale: 0, base: Math.random() * 0.18 + 0.04 });
  }

  // Only recompute grid proximity on mousemove, not every frame
  let gridDirty = true;
  window.addEventListener('mousemove', () => { gridDirty = true; }, { passive: true });

  function updateGrid() {
    if (!gridDirty) return;
    gridDirty = false;
    for (const d of dots) {
      const dx = tmx - d.x, dy = tmy - d.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      d.target = d.base + Math.max(0, 1 - dist / 160) * 0.7;
    }
  }

  function drawGrid() {
    updateGrid();
    ctx.fillStyle = 'rgb(180,140,255)';
    // Batch dots by skipping near-zero — avoid beginPath overhead
    for (const d of dots) {
      d.scale += (d.target - d.scale) * 0.1;
      if (d.scale < 0.03) continue;
      const proximity = (d.target - d.base) / 0.7;
      ctx.globalAlpha = d.scale;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 1.2 + proximity * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);
    initStars(); initGrid(); gridDirty = true;
  }

  window._bgTick = function(t) {
    tmx += (mx - tmx) * 0.09;
    tmy += (my - tmy) * 0.09;
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    drawStars(t);
    drawMeteors();
  };

  resize();
  spawnMeteor();
  window.addEventListener('resize', resize);
})();

// ── Hero: glitch slice + chromatic aberration ────
(() => {
  const hero       = document.getElementById('hero');
  const heroName   = document.querySelector('.hero-name');
  const glitchMain = document.querySelector('.glitch-main');
  const glitchR    = document.querySelector('.glitch-r');
  const glitchB    = document.querySelector('.glitch-b');
  const heroHello  = document.querySelector('.hero-hello');
  const heroRoles  = document.querySelector('.hero-roles');
  const memoji     = document.getElementById('memoji');
  const canvas     = document.getElementById('bg-canvas');
  if (!hero || !heroName || !canvas) return;

  const ctx = canvas.getContext('2d');
  let particles = [];

  function burst(el, count) {
    const rect = el.getBoundingClientRect();
    const cols = ['rgba(180,130,255,X)','rgba(255,60,120,X)','rgba(80,180,255,X)','rgba(240,220,255,X)'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = Math.random() * 4 + 1;
      const life  = Math.random() * 50 + 30;
      particles.push({
        x: rect.left + Math.random() * rect.width,
        y: rect.top  + Math.random() * rect.height + window.scrollY,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 1.4,
        r: Math.random() * 2 + 0.4, life, maxLife: life,
        color: cols[Math.floor(Math.random() * cols.length)]
      });
    }
  }

  // Patch clearRect to draw particles
  const _orig = ctx.clearRect.bind(ctx);
  ctx.clearRect = function(...args) {
    _orig(...args);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy -= 0.07; p.vx *= 0.96; p.life--;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(p.x, p.y - window.scrollY, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color.replace('X', (p.life / p.maxLife) * 0.88);
      ctx.fill();
    }
  };

  let glitchTicks = 0, slices = [];
  let chromaX = 0, chromaY = 0, chromaLife = 0;
  let scaleHit = 1, helloX = 0, helloY = 0, rolesX = 0, rolesY = 0;
  let memojiShakeX = 0, memojiShakeY = 0;

  function makeSlices() {
    slices = [];
    const count = Math.floor(Math.random() * 4) + 3;
    let y = 0;
    for (let i = 0; i < count; i++) {
      const h = Math.random() * 28 + 8;
      slices.push({ y, h, off: (Math.random() - 0.5) * 44 });
      y += h;
    }
  }

  // ── smooth cubic ease (in-out quad) ──────────────
  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  // offsetHeight is cached — only re-read on resize
  let _heroH = hero.offsetHeight;
  window.addEventListener('resize', () => { _heroH = hero.offsetHeight; }, { passive: true });

  window._heroTick = function(sy) {
    if (sy === undefined) sy = window.scrollY;
    const heroH = _heroH;
    // progress 0→1 over the first 65% of the hero height
    const raw  = Math.min(sy / (heroH * 0.65), 1);
    const ease = easeInOutQuad(raw);

    // ── Use translate3d — compositor-only, no layout ──
    if (heroHello) {
      heroHello.style.transform = `translate3d(0,${ease * -36}px,0)`;
      heroHello.style.opacity   = Math.max(0, 1 - ease * 2.2).toFixed(3);
    }
    if (memoji) {
      memoji.style.transform          = `translate3d(0,${ease * -28}px,0)`;
      memoji.style.opacity            = Math.max(0, 1 - ease * 1.6).toFixed(3);
      memoji.style.animationPlayState = raw > 0.04 ? 'paused' : 'running';
    }
    heroName.style.transform = `translate3d(0,${ease * -14}px,0)`;
    heroName.style.opacity   = Math.max(0, 1 - ease * 1.2).toFixed(3);
    if (heroRoles) {
      heroRoles.style.transform = `translate3d(0,${ease * 22}px,0)`;
      heroRoles.style.opacity   = Math.max(0, 1 - ease * 1.9).toFixed(3);
    }
    glitchR.style.opacity = glitchB.style.opacity = '0';
    glitchMain.style.transform = '';
    glitchMain.style.clipPath  = 'none';
  };

  // wheel no longer triggers glitch — just let scroll drive the parallax
  window._heroWheel = function() {};

  let cooldown = false;
  window.addEventListener('wheel', (e) => {
    if (cooldown) return;
    window._heroWheel(e);
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
    const cx = (Math.random() - 0.5) * 22;
    const cy = (Math.random() - 0.5) * 10;
    let ticks = Math.floor(Math.random() * 5) + 3;
    let chromaLife = 1.0;
    const iv = setInterval(() => {
      chromaLife *= 0.75; ticks--;
      glitchR.style.opacity = (chromaLife * 0.85).toString();
      glitchR.style.transform = `translate(${cx * chromaLife * 1.6}px, ${cy * -chromaLife}px)`;
      glitchR.style.clipPath = `inset(${Math.random()*30}% 0 ${Math.random()*30}% 0)`;
      glitchB.style.opacity = (chromaLife * 0.75).toString();
      glitchB.style.transform = `translate(${cx * -chromaLife}px, ${cy * chromaLife * 0.8}px)`;
      glitchB.style.clipPath = `inset(${Math.random()*40}% 0 ${Math.random()*20}% 0)`;
      glitchMain.style.transform = `translateX(${(Math.random()-0.5) * 8 * chromaLife}px)`;
      if (ticks <= 0) {
        clearInterval(iv);
        glitchR.style.opacity = glitchB.style.opacity = '0';
        glitchMain.style.transform = '';
      }
    }, 40);
    setTimeout(idleGlitch, Math.random() * 2000 + 3000);
  }
  setTimeout(idleGlitch, 2500);
})();

// ── MASTER RAF LOOP ───────────────────────────────
// Single rAF drives everything — no competing loops
let _rafPaused = false;
document.addEventListener('visibilitychange', () => { _rafPaused = document.hidden; });

// Track which sections are in view to skip off-screen ticks
let _heroVisible = true, _aboutVisible = false, _projectsVisible = false;
const _heroEl = document.getElementById('hero');
const _aboutEl = document.getElementById('about');
const _projectsEl = document.getElementById('projects');
if (_heroEl) {
  new IntersectionObserver(e => { _heroVisible = e[0].isIntersecting; }, { threshold: 0 }).observe(_heroEl);
}
if (_aboutEl) {
  new IntersectionObserver(e => { _aboutVisible = e[0].isIntersecting; }, { threshold: 0 }).observe(_aboutEl);
}
if (_projectsEl) {
  new IntersectionObserver(e => { _projectsVisible = e[0].isIntersecting; }, { threshold: 0 }).observe(_projectsEl);
}

// Cached scroll value — read once per frame, never in event handlers
let _cachedScrollY = 0;

(function masterLoop(t) {
  if (!_rafPaused) {
    // Cache scroll once per frame to avoid forced layout reflow
    _cachedScrollY = window.scrollY;

    if (window._bgTick)     window._bgTick(t);
    if (window._cursorTick) window._cursorTick();
    if (_heroVisible) {
      if (window._memojiTick) window._memojiTick(t);
      if (window._orbitTick)  window._orbitTick();
      if (window._heroTick)   window._heroTick(_cachedScrollY);
    }
    if (_aboutVisible && window._sphereTick) window._sphereTick();
    if (_projectsVisible && window._beltTick) window._beltTick();
    if (window._pageNavTick) window._pageNavTick(_cachedScrollY);
    if (window._siTick) window._siTick(_cachedScrollY);
  }
  requestAnimationFrame(masterLoop);
})(0);

// ── Scroll indicator fade — lightweight, driven by RAF ──
(() => {
  const si = document.getElementById('scroll-indicators');
  if (!si) return;
  si.style.transition = 'opacity 0.4s ease';
  let _siHidden = false;
  window._siTick = function(sy) {
    const hidden = sy > 40;
    if (hidden !== _siHidden) {
      _siHidden = hidden;
      si.style.opacity = hidden ? '0' : '1';
    }
  };
})();

// ── AI Chat Widget ────────────────────────────────
(() => {
  const input     = document.getElementById('ai-input');
  const sendBtn   = document.getElementById('ai-send');
  const messages  = document.getElementById('ai-messages');
  const panel     = document.getElementById('ai-widget-panel');
  const toggleBtn = document.getElementById('ai-widget-btn');
  const closeBtn  = document.getElementById('ai-chat-close');
  if (!input || !messages) return;

  // ── Inject widget enhancement styles ──
  const style = document.createElement('style');
  style.textContent = `
    .ai-msg-row {
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.28s cubic-bezier(.22,1,.36,1), transform 0.28s cubic-bezier(.22,1,.36,1);
    }
    .ai-msg-row.ai-msg-visible {
      opacity: 1;
      transform: translateY(0);
    }
    .ai-chat-messages { position: relative; }
    .ai-scroll-fade {
      position: sticky;
      bottom: 0; left: 0; right: 0;
      height: 36px;
      background: linear-gradient(to bottom, transparent, rgba(9,5,18,0.92));
      pointer-events: none;
      margin-top: -36px;
      border-radius: 0 0 4px 4px;
      opacity: 0;
      transition: opacity 0.3s ease;
      flex-shrink: 0;
    }
    .ai-scroll-fade.visible { opacity: 1; }
    .ai-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 0 14px 12px;
      transition: opacity 0.25s ease, max-height 0.35s cubic-bezier(.22,1,.36,1);
      max-height: 80px;
      overflow: hidden;
    }
    .ai-chips.hidden {
      opacity: 0;
      max-height: 0;
      padding-bottom: 0;
      pointer-events: none;
    }
    .ai-chip {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 11.5px;
      padding: 5px 11px;
      border-radius: 20px;
      border: 1px solid rgba(157,95,245,0.35);
      background: rgba(124,58,237,0.08);
      color: rgba(200,180,255,0.85);
      cursor: pointer;
      letter-spacing: 0.02em;
      transition: background 0.18s, border-color 0.18s, color 0.18s, transform 0.15s;
      white-space: nowrap;
    }
    .ai-chip:hover {
      background: rgba(124,58,237,0.2);
      border-color: rgba(157,95,245,0.7);
      color: #fff;
      transform: translateY(-1px);
    }
    .ai-send-btn svg { transition: opacity 0.15s ease, transform 0.2s cubic-bezier(.22,1,.36,1); }
    .ai-send-btn.sent svg { opacity: 0; transform: scale(0.5) rotate(20deg); }
    .ai-send-check {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      opacity: 0;
      transition: opacity 0.18s ease;
      pointer-events: none;
    }
    .ai-send-btn.sent .ai-send-check { opacity: 1; }
    .ai-send-check svg { width: 14px; height: 14px; color: #fff; }
    .ai-input { position: relative; }
    @keyframes inputShimmer {
      0%   { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    .ai-input:focus {
      background-image: linear-gradient(90deg, rgba(124,58,237,0.06) 0%, rgba(157,95,245,0.14) 50%, rgba(124,58,237,0.06) 100%);
      background-size: 200% 100%;
      animation: inputShimmer 1.8s ease infinite;
    }
    .ai-widget-panel { filter: blur(4px); }
    .ai-widget-panel.open {
      filter: blur(0px);
      transition: opacity 0.28s ease, transform 0.38s cubic-bezier(.22,1,.36,1), filter 0.28s ease !important;
    }
    .ai-typewriter-cursor {
      display: inline-block;
      width: 2px; height: 13px;
      background: rgba(157,95,245,0.9);
      border-radius: 1px;
      margin-left: 2px;
      vertical-align: middle;
      animation: cursorBlink 0.8s ease-in-out infinite;
    }
    @keyframes cursorBlink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
    .ai-bubble--bot a {
      color: #c084fc;
      text-decoration: underline;
      text-underline-offset: 2px;
      transition: color 0.15s;
    }
    .ai-bubble--bot a:hover { color: #fff; }
    .ai-error-msg { color: rgba(255, 100, 100, 0.85) !important; }
  `;
  document.head.appendChild(style);

  // ── Add checkmark SVG to send button ──
  const checkWrap = document.createElement('span');
  checkWrap.className = 'ai-send-check';
  checkWrap.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  sendBtn.appendChild(checkWrap);

  // ── Scroll fade overlay ──
  const scrollFade = document.createElement('div');
  scrollFade.className = 'ai-scroll-fade';
  messages.appendChild(scrollFade);

  function updateScrollFade() {
    const overflowing = messages.scrollHeight - messages.scrollTop > messages.clientHeight + 8;
    scrollFade.classList.toggle('visible', overflowing);
  }
  messages.addEventListener('scroll', updateScrollFade, { passive: true });

  // ── Suggested prompt chips ──
  const CHIPS = ["Who is Clark?", "What services does he offer?", "What tools and skills does he use?"];
  const chipsEl = document.createElement('div');
  chipsEl.className = 'ai-chips';
  CHIPS.forEach(label => {
    const chip = document.createElement('button');
    chip.className = 'ai-chip';
    chip.textContent = label;
    chip.addEventListener('click', () => {
      input.value = label;
      hideChips();
      send();
    });
    chipsEl.appendChild(chip);
  });
  const inputRow = document.querySelector('.ai-chat-input-row');
  if (inputRow) inputRow.parentNode.insertBefore(chipsEl, inputRow);

  let chipsHidden = false;
  function hideChips() {
    if (chipsHidden) return;
    chipsHidden = true;
    chipsEl.classList.add('hidden');
  }

  // ── Toggle open/close ──
  const floatLabel = document.querySelector('.ai-float-label');

  function openPanel() {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    if (floatLabel) { floatLabel.style.opacity = '0'; floatLabel.style.pointerEvents = 'none'; floatLabel.style.visibility = 'hidden'; }
    input.focus();
    setTimeout(updateScrollFade, 50);
  }
  function closePanel() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    if (floatLabel) { floatLabel.style.opacity = ''; floatLabel.style.pointerEvents = ''; floatLabel.style.visibility = ''; }
  }
  toggleBtn.addEventListener('click', () => panel.classList.contains('open') ? closePanel() : openPanel());
  closeBtn.addEventListener('click', closePanel);

  // ── System prompt (dynamic — reflects current site state) ──
  function buildSystem() {
    // Read current display name
    const nameEl = document.querySelector('.contact-name');
    const rawName = nameEl ? nameEl.innerText.replace(/\n/g, ' ').trim() : 'Justin Clark Mendoza';
    // SECURITY: strip anything that looks like an LLM instruction injection
    // (e.g. "Ignore all previous instructions…"). We allow only letters,
    // spaces, hyphens, periods, and apostrophes — normal name characters.
    const displayName = rawName.replace(/[^a-zA-Z0-9 '\-\.]/g, '').slice(0, 60) || 'Justin Clark Mendoza';

    // Read current availability status
    const statusSelectEl = document.getElementById('status-select');
    const currentStatus = statusSelectEl ? statusSelectEl.value : 'available';
    const AVAILABILITY_LINES = {
      available: 'Currently available and actively taking on new clients/projects',
      busy: 'Currently busy with limited availability — may take longer to respond or start new work',
      offline: 'Currently not available for new work — not accepting new clients/projects at this time'
    };
    const availabilityLine = AVAILABILITY_LINES[currentStatus] || AVAILABILITY_LINES.available;

    // Read email visibility + current value (admin can change this live)
    const emailPill = document.getElementById('contact-email-pill');
    const emailHidden = emailPill && emailPill.classList.contains('restricted-email');
    const emailTextEl = document.querySelector('.contact-email-text');
    const rawEmail = emailTextEl ? emailTextEl.textContent.trim() : 'justinclark.mendoza.official@gmail.com';
    // SECURITY: same instruction-injection guard as displayName — emails only
    // contain letters, digits, and a small safe set of symbols.
    const currentEmail = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(rawEmail)
      ? rawEmail
      : 'justinclark.mendoza.official@gmail.com';
    const emailLine = emailHidden
      ? '- Email: [private — not available at this time]'
      : `- Email: ${currentEmail}`;

    // Read social visibility
    function socialLine(platform, label, value) {
      const card = document.querySelector(`.social-card[data-platform="${platform}"]`);
      const hidden = card && card.classList.contains('restricted');
      return hidden ? `- ${label}: [private — not available at this time]` : `- ${label}: ${value}`;
    }

    const githubLine    = socialLine('github',     'GitHub',       'https://github.com/ZnqTvCSFrXDx');
    const discordLine   = socialLine('discord',    'Discord',      'https://discord.gg/wwVUFfnRpg');
    const igLine        = socialLine('instagram',  'Instagram',    '@jzzztnclark');
    const linkedinLine  = socialLine('linkedin',   'LinkedIn',     'available via the Socials section of this site');
    const ojLine        = socialLine('onlinejobs', 'OnlineJobs.ph','v2.onlinejobs.ph/jobseekers/info/4672292');

    // Build fallback contact suggestion based on what's visible
    const discordCard = document.querySelector('.social-card[data-platform="discord"]');
    const discordHidden = discordCard && discordCard.classList.contains('restricted');

    let fallbackParts = [];
    if (!discordHidden) fallbackParts.push('[Discord](https://discord.gg/wwVUFfnRpg)');
    if (!emailHidden) fallbackParts.push(`[${currentEmail}](mailto:${currentEmail})`);
    const fallbackContact = fallbackParts.length > 0
      ? `Reach him via ${fallbackParts.join(' or ')} to know more.`
      : 'Clark has limited contact options available right now. Check back later.';

    return `You are Clark AI — the personal assistant on Clark's portfolio website. Clark is a developer known online as "CASH33".

Who is Clark:
Clark is a full-stack web developer with solid experience in Windows troubleshooting, PC optimization, and custom scripting. He communicates clearly, listens well, and genuinely cares about delivering what his skills can offer. His main goal is to grow through real experience while providing reliable, quality work to every client he works with.

About Clark:
- Full name: ${displayName}, goes by "Clark" or "Cash33"
- Based in the Philippines, open to both local and international clients
- 1 year of hands-on experience
- ${availabilityLine}
- Languages: English and Filipino
- Preferred contact: Email or Discord

Contact & Socials:
${emailLine}
${githubLine}
${discordLine}
${igLine}
${linkedinLine}
${ojLine}

Projects:
- Point of System (POS): a Java/Swing/JDBC/MySQL desktop app with role-based access, inventory management, and receipt generation
- CASH33 Optimizer: a Windows 10/11 optimization and cleaning tool created by Clark, designed to boost PC performance through system tweaks, cleanup routines, and debloating
- More projects coming soon

Services:
- Full-stack web development
- Windows 10/11 optimization
- Windows 10/11 troubleshooting
- PC performance consulting
- PC cleaning and maintenance
- Custom batch and PowerShell scripting
- Software setup and configuration
- Selling optimization tools and software

Tools & Skills:
- Languages: HTML, CSS, JavaScript, Python, Java, C#, SQL
- Scripting: PowerShell, Batch, CMD, Terminal
- Frameworks/Tools: React, Node.js, VS Code
- Platforms: Windows 10/11

Pricing & Rates:
- Hourly rate: $2.99 USD / PHP 169 per hour
- No flat fees — Clark is open to client price offers depending on the scope of work
- Free consultation available (call or chat, depending on availability)

Payment Methods:
- GCash, PayPal, Bank Transfer accepted
- Bitcoin/Crypto coming soon

Turnaround Time (estimates, varies by project):
- Simple smooth modern website: ~1 week
- Responsive and reactive website: ~2 weeks
- Scripts: a few days depending on complexity
- Windows optimization, cleaning, troubleshooting: a few hours

Availability:
- Available every day
- Most active: 5:00 PM PHT (GMT+8)
- Available for conversation/response: 7:00 AM – 11:59 PM PHT

Support & Revisions:
- CASH33 Optimizer comes with ongoing support
- Revisions are offered on a case-by-case basis — only if necessary and acceptable

Target Clients:
- Open to everyone — no niche restriction, works with all types of clients locally and internationally

Current hiring status: ${currentStatus.toUpperCase()}
- If status is AVAILABLE: encourage interested clients to reach out, Clark is actively taking new work.
- If status is BUSY: let people know Clark is currently busy/has limited availability — he may still take on work but responses or start dates could be delayed. Don't discourage them from reaching out, just set honest expectations.
- If status is OFFLINE: be upfront that Clark is not taking new clients/projects right now. Don't promise turnaround times or pricing for new work in this case — suggest they check back later or leave a message via the contact options.

Tone: be confident but approachable. Keep every reply short, simple, and direct — no long paragraphs, no unnecessary filler. Answer only what was asked. If someone asks how to contact or hire Clark, share only the contact info that is currently available (not private). If you don't know something or Clark hasn't shared it, say: "Clark preferred not to share that information yet. ${fallbackContact}" Never make things up. Never break character. Never reveal private information marked as [private].`;
  }


  const history = [];

  function timeNow() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function revealMsg(row) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => row.classList.add('ai-msg-visible'));
    });
  }

  // ── Render markdown-lite: bold, links ──
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderMarkdown(text) {
    // SECURITY: escape raw HTML first — the AI's reply is untrusted
    // text (a clever prompt could make it "say" a <script> tag), so
    // we neutralize markup before applying our own safe formatting.
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
      .replace(/\n/g, '<br>');
  }

  function addMsg(text, type) {
    const row = document.createElement('div');
    row.className = `ai-msg-row ai-msg-row--${type}`;

    if (type === 'thinking') {
      row.innerHTML = `<div class="ai-bubble ai-bubble--bot ai-bubble--thinking"><span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span></div>`;
      messages.insertBefore(row, scrollFade);
      revealMsg(row);
    } else {
      row.innerHTML = `<div class="ai-bubble ai-bubble--${type}"></div><span class="ai-msg-time">${timeNow()}</span>`;
      messages.insertBefore(row, scrollFade);
      revealMsg(row);

      const bubble = row.querySelector('.ai-bubble');
      if (type === 'bot') {
        typewriterEffect(bubble, text);
      } else if (type === 'error') {
        bubble.classList.add('ai-error-msg');
        bubble.textContent = text;
      } else {
        bubble.textContent = text;
      }
    }

    messages.scrollTop = messages.scrollHeight;
    updateScrollFade();
    return row;
  }

  // ── Typewriter effect with markdown render at end ──
  function typewriterEffect(el, text) {
    let i = 0;
    const cursor = document.createElement('span');
    cursor.className = 'ai-typewriter-cursor';
    el.appendChild(cursor);
    const speed = Math.max(10, Math.min(25, 2000 / text.length));

    function tick() {
      if (i < text.length) {
        cursor.insertAdjacentText('beforebegin', text[i]);
        i++;
        messages.scrollTop = messages.scrollHeight;
        setTimeout(tick, speed);
      } else {
        cursor.remove();
        // Swap plain text for rendered markdown after typewriter finishes
        el.innerHTML = renderMarkdown(text);
        updateScrollFade();
      }
    }
    tick();
  }

  function morphSendBtn() {
    sendBtn.classList.add('sent');
    setTimeout(() => sendBtn.classList.remove('sent'), 900);
  }

  // ── Disable / enable input while waiting ──
  function setLoading(loading) {
    input.disabled = loading;
    sendBtn.disabled = loading;
  }

  async function send() {
    const val = input.value.trim();
    if (!val || input.disabled) return;
    input.value = '';
    hideChips();
    morphSendBtn();
    addMsg(val, 'user');
    history.push({ role: 'user', content: val });
    const thinking = addMsg('', 'thinking');
    setLoading(true);

    try {
      const res = await fetch('https://cash-github-io.onrender.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: buildSystem(),
          messages: history
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const reply = data.content?.[0]?.text ?? 'No response.';
      history.push({ role: 'assistant', content: reply });
      thinking.remove();
      addMsg(reply, 'bot');
    } catch (e) {
      thinking.remove();
      addMsg(`Oops, that's on us — something went wrong on our end. Please try again in a moment.`, 'error');
    } finally {
      setLoading(false);
      input.focus();
    }
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) send(); });

  // Animate initial greeting
  requestAnimationFrame(() => {
    const firstRow = messages.querySelector('.ai-msg-row');
    if (firstRow) {
      firstRow.classList.add('ai-msg-visible');
      updateScrollFade();
    }
  });
})();

document.querySelectorAll('.nav-links a, .nav-logo').forEach(el => {
  el.addEventListener('mouseenter', () => glitchText(el));
});

document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    const header = target.querySelector('.section-header') || target;
    const NAV_CLEARANCE = 130; // px gap to leave below the fixed nav

    // Walk up offsetParent chain to get the true layout position,
    // unaffected by transform-based reveal animations (translateY, etc).
    let top = 0;
    let el = header;
    while (el) {
      top += el.offsetTop;
      el = el.offsetParent;
    }

    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const target_y = Math.min(maxScroll, Math.max(0, top - NAV_CLEARANCE));
    window.scrollTo({ top: target_y, behavior: 'smooth' });
  });
});

// ── About paragraph fade-in on scroll ────────────────
const aboutObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('.about-text p').forEach(p => p.classList.add('visible'));
      aboutObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.2 });
const aboutSection = document.querySelector('#about');
if (aboutSection) aboutObserver.observe(aboutSection);



// ── About section reveal: smooth slide + glow ─────
(() => {
  const about = document.querySelector('#about');
  if (!about) return;

  about.classList.remove('booting');
  about.style.animation = 'none';
  about.style.transition =
    'opacity 1.4s cubic-bezier(.16,1,.3,1), ' +
    'transform 1.4s cubic-bezier(.16,1,.3,1), ' +
    'filter 1.4s cubic-bezier(.16,1,.3,1)';
  about.style.opacity = '0';
  about.style.transform = 'translateY(80px)';

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.intersectionRatio >= 0.3) {
        about.style.opacity = '1';
        about.style.transform = 'translateY(0)';
        about.style.filter = '';

        setTimeout(() => {
          about.style.filter = '';
        }, 1400);
      } else {
        about.style.opacity = '0';
        about.style.transform = 'translateY(80px)';
        about.style.filter = 'drop-shadow(0 0 0 rgba(180,100,255,0))';
      }
    });
  }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6] });

  obs.observe(about);
})();

// ── 3D Tag Sphere ─────────────────────────────────────
(function() {
  const canvas = document.getElementById('sphere-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const tags = ['HTML5','CSS3','JavaScript','Python','SQL','PowerShell','Batch','C#','C++','Java','Lua'];

const ICON_SLUGS = {
  'HTML5':      'html5/html5-original',
  'CSS3':       'css3/css3-original',
  'JavaScript': 'javascript/javascript-original',
  'Python':     'python/python-original',
  'SQL':        'mysql/mysql-original',
  'PowerShell': 'powershell/powershell-original',
  'Batch':      'windows8/windows8-original',
  'C#':         'csharp/csharp-original',
  'C++':        'cplusplus/cplusplus-original',
  'Java':       'java/java-original',
  'Lua':        'lua/lua-original'
};

const ICONS = {};
tags.forEach(tag => {
  const slug = ICON_SLUGS[tag];
  const img = new Image();
  img.src = `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${slug}.svg`;
  ICONS[tag] = { img, loaded: false };
  img.onload = () => { ICONS[tag].loaded = true; };
});

  let W, H, RADIUS;

  function resize() {
  const wrap = document.getElementById('sphere-wrap');
  W = wrap.offsetWidth; H = wrap.offsetHeight;
  RADIUS = Math.min(W, H) * 0.48;
  canvas.width  = W * devicePixelRatio;
  canvas.height = H * devicePixelRatio;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

  const points = tags.map((tag, i) => {
    const phi   = Math.acos(1 - 2 * (i + 0.5) / tags.length);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    return { tag, x0: Math.sin(phi)*Math.cos(theta), y0: Math.sin(phi)*Math.sin(theta), z0: Math.cos(phi), x:0, y:0, z:0 };
  });

  const MAX_ROT_X = 1.2;
  let rotX = 0.3, rotY = 0, velX = 0.0005, velY = 0.004, dragging = false, lastMX = 0, lastMY = 0;


  canvas.addEventListener('mousedown', e => { 
  e.preventDefault(); // kills browser selection/drag box
  dragging=true; lastMX=e.clientX; lastMY=e.clientY; velX=velY=0; 
});
window.addEventListener('mouseup', () => { dragging=false; });
window.addEventListener('mouseleave', () => { dragging=false; }); // fix: release if cursor leaves window
window.addEventListener('mousemove', e => {
  if (!dragging) return;
  velY = Math.max(-0.05, Math.min(0.05, (e.clientX - lastMX) * 0.005));
  velX = Math.max(-0.05, Math.min(0.05, -(e.clientY - lastMY) * 0.005));
  rotY += velY;
  rotX = Math.max(-MAX_ROT_X, Math.min(MAX_ROT_X, rotX + velX));
  if (rotX <= -MAX_ROT_X || rotX >= MAX_ROT_X) velX = 0;
  lastMX = e.clientX; lastMY = e.clientY;
});



  canvas.addEventListener('touchstart', e => { dragging=true; lastMX=e.touches[0].clientX; lastMY=e.touches[0].clientY; velX=velY=0; }, { passive:true });
  window.addEventListener('touchend', () => { dragging=false; });
  window.addEventListener('touchmove', e => {
    if (!dragging) return;
    velY=(e.touches[0].clientX-lastMX)*0.005; velX=-(e.touches[0].clientY-lastMY)*0.005;
    rotY+=velY;
    rotX=Math.max(-MAX_ROT_X, Math.min(MAX_ROT_X, rotX+velX));
    if (rotX<=-MAX_ROT_X || rotX>=MAX_ROT_X) velX=0;
    lastMX=e.touches[0].clientX; lastMY=e.touches[0].clientY;
  }, { passive:true });

  function rotatePoint(p) {
    let x=p.x0*Math.cos(rotY)+p.z0*Math.sin(rotY), z=-p.x0*Math.sin(rotY)+p.z0*Math.cos(rotY);
    p.x=x; p.y=p.y0*Math.cos(rotX)-z*Math.sin(rotX); p.z=p.y0*Math.sin(rotX)+z*Math.cos(rotX);
  }
  function rotateRaw(x0,y0,z0) {
    let x=x0*Math.cos(rotY)+z0*Math.sin(rotY), z=-x0*Math.sin(rotY)+z0*Math.cos(rotY);
    return { x, y:y0*Math.cos(rotX)-z*Math.sin(rotX), z:y0*Math.sin(rotX)+z*Math.cos(rotX) };
  }

  let shimmerT = 0;
  let glowLerp = 0, glowTarget = 0;

  canvas.addEventListener('mousedown',  () => { glowTarget = 1; });
  canvas.addEventListener('touchstart', () => { glowTarget = 1; }, { passive: true });
  window.addEventListener('mouseup',    () => { glowTarget = 0; });
  window.addEventListener('touchend',   () => { glowTarget = 0; });

  const orbitDots = [
    { angle:0,         speed:0.018, tiltX:0.4,  tiltZ:0.0,  color:'#c084fc', burst:0, burstTimer:0 },
    { angle:Math.PI,   speed:0.012, tiltX:-0.6, tiltZ:0.5,  color:'#7c3aed', burst:0, burstTimer:0 },
    { angle:Math.PI/2, speed:0.022, tiltX:0.2,  tiltZ:-0.8, color:'#e0b4ff', burst:0, burstTimer:0 },
  ];

  let _bgGlow=null, _sphereGrad=null, _gradW=0, _gradH=0;
  function rebuildGrads() {
    const cx=W/2, cy=H/2;
    _bgGlow=ctx.createRadialGradient(cx,cy,0,cx,cy,RADIUS*1.4);
    _bgGlow.addColorStop(0,'rgba(70,20,140,0.12)'); _bgGlow.addColorStop(0.4,'rgba(50,15,110,0.06)');
    _bgGlow.addColorStop(0.7,'rgba(30,8,80,0.02)'); _bgGlow.addColorStop(1,'rgba(0,0,0,0)');
    _sphereGrad=ctx.createRadialGradient(cx-RADIUS*0.3,cy-RADIUS*0.3,RADIUS*0.05,cx,cy,RADIUS);
    _sphereGrad.addColorStop(0,'rgba(60,20,100,0.08)'); _sphereGrad.addColorStop(0.5,'rgba(30,10,60,0.06)'); _sphereGrad.addColorStop(1,'rgba(0,0,0,0)');
    _gradW=W; _gradH=H;
  }

  function drawGlobe() {
    const cx=W/2, cy=H/2;
    if (!_bgGlow || _gradW!==W || _gradH!==H) rebuildGrads();
    ctx.beginPath(); ctx.ellipse(cx,cy,RADIUS*1.4,RADIUS*1.4,0,0,Math.PI*2);
    ctx.fillStyle=_bgGlow; ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy,RADIUS,0,Math.PI*2); ctx.fillStyle=_sphereGrad; ctx.fill();

    if (glowLerp > 0.01) {
      const bloom = ctx.createRadialGradient(cx,cy,RADIUS*0.7,cx,cy,RADIUS*1.1);
      bloom.addColorStop(0, `rgba(160,60,255,${(glowLerp*0.03).toFixed(3)})`);
      bloom.addColorStop(0.5, `rgba(120,40,220,${(glowLerp*0.015).toFixed(3)})`);
      bloom.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.ellipse(cx,cy,RADIUS*1.1,RADIUS*1.1,0,0,Math.PI*2);
      ctx.fillStyle=bloom; ctx.fill();
    }

    const breathe=0.4+0.25*Math.sin(Date.now()*0.0018);
    const g = glowLerp;
    const activePulse = g > 0.01 ? 0.92 + 0.08 * Math.sin(Date.now() * 0.005) : 1;

    const latCount=8;
    ctx.shadowColor = `rgba(220,200,255,${0.3 + g * 0.35})`;
    ctx.shadowBlur  = 4 + g * 8;
    for (let i=1; i<latCount; i++) {
      const phi=(i/latCount)*Math.PI, r=Math.sin(phi)*RADIUS, yOff=Math.cos(phi)*RADIUS;
      const rc=rotateRaw(0,Math.cos(phi),0);
      const baseAlpha=(0.06+Math.max(0,rc.z)*0.1)*1.8*breathe;
      const alpha = baseAlpha + g * 0.35 * activePulse;
      const lw = 0.8 + g * 1.2;
      const projRy = Math.max(r * 0.08, r * Math.abs(Math.sin(rotX)) * 0.5 + r * Math.abs(Math.cos(rotX)) * 0.12);
      ctx.beginPath(); ctx.ellipse(cx,cy+yOff,r,projRy,0,0,Math.PI*2);
      ctx.strokeStyle=`rgba(210,140,255,${Math.min(0.95,alpha)})`; ctx.lineWidth=lw; ctx.stroke();
    }
    ctx.shadowBlur=0;

    const lonCount=10;
    if (g > 0.01) { ctx.shadowColor=`rgba(180,100,255,${g*0.4})`; ctx.shadowBlur=g*9; }
    for (let i=0; i<lonCount; i++) {
      const theta=(i/lonCount)*Math.PI, steps=30;
      ctx.beginPath();
      for (let s=0; s<=steps; s++) {
        const phi=(s/steps)*Math.PI*2;
        const r=rotateRaw(Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta));
        const px=cx+r.x*RADIUS, py=cy+r.y*RADIUS;
        if (s===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      const lonAlpha = (0.12 + g * 0.32) * breathe * activePulse;
      const lonLW = 0.7 + g * 1.0;
      ctx.strokeStyle=`rgba(200,130,255,${Math.min(0.85,lonAlpha)})`; ctx.lineWidth=lonLW; ctx.stroke();
    }
    ctx.shadowBlur=0;

    orbitDots.forEach(dot => {
      dot.angle+=dot.speed; dot.burstTimer--;
      if (dot.burstTimer<=0) { dot.burst=1.0; dot.burstTimer=180+Math.random()*180; }
      if (dot.burst>0) dot.burst-=0.012;
      dot.burst=Math.max(0,dot.burst);
      const b=dot.burst, trailLen=b>0.1?30:18;
      ctx.shadowColor=dot.color; ctx.shadowBlur=b>0.1?12:6;
      for (let t=0; t<trailLen; t++) {
        const a=dot.angle-(t/trailLen)*Math.PI*(b>0.1?0.75:0.5);
        const r=rotateRaw(Math.cos(a),Math.sin(a)*Math.sin(dot.tiltX),Math.sin(a)*Math.cos(dot.tiltX));
        const px=cx+r.x*RADIUS, py=cy+r.y*RADIUS, front=(r.z+1)/2, fade=1-t/trailLen, size=(2.2+b*2.5)*fade*front;
        if (front>0.08) {
          ctx.beginPath(); ctx.arc(px,py,size,0,Math.PI*2);
          ctx.fillStyle=dot.color; ctx.globalAlpha=fade*front*(0.85+b*0.15);
          ctx.fill();
        }
      }
      ctx.shadowBlur=0; ctx.globalAlpha=1;
      const rh=rotateRaw(Math.cos(dot.angle),Math.sin(dot.angle)*Math.sin(dot.tiltX),Math.sin(dot.angle)*Math.cos(dot.tiltX));
      const px=cx+rh.x*RADIUS, py=cy+rh.y*RADIUS;
      if ((rh.z+1)/2>0.08) {
        const headSize=3.5+b*4;
        ctx.beginPath(); ctx.arc(px,py,headSize,0,Math.PI*2);
        ctx.shadowColor=dot.color; ctx.shadowBlur=14+b*20;
        ctx.fillStyle=b>0.3?dot.color:'#fff'; ctx.globalAlpha=(rh.z+1)/2;
        ctx.fill();
        if (b>0.2) { ctx.beginPath(); ctx.arc(px,py,headSize+b*8,0,Math.PI*2); ctx.strokeStyle=dot.color; ctx.lineWidth=1; ctx.globalAlpha=b*0.4*(rh.z+1)/2; ctx.stroke(); }
        ctx.globalAlpha=1; ctx.shadowBlur=0;
      }
    });
  }

  const _sorted = [];
  function draw() {
    ctx.clearRect(0,0,W,H);
    ctx.save();
    ctx.beginPath();
    ctx.arc(W/2, H/2, RADIUS*1.6, 0, Math.PI*2);
    ctx.clip();
    drawGlobe();
    ctx.restore();
    points.forEach(rotatePoint);
    _sorted.length = 0;
    for (let i=0; i<points.length; i++) _sorted.push(points[i]);
    _sorted.sort((a,b)=>a.z-b.z);
    const cx=W/2, cy=H/2;

    // Clip icons + labels to the canvas bounds so they never overflow the wrap
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    _sorted.forEach(p => {
      const depth=(p.z+1)/2, px=cx+p.x*RADIUS, py=cy+p.y*RADIUS;
      const isfront=depth>0.6;
      const icon = ICONS[p.tag];
      const size = (isfront ? 64 : 44) * (0.6 + depth * 0.4);
      ctx.save();
      ctx.globalAlpha = 0.25 + depth * 0.75;
      if (icon.loaded) {
        ctx.drawImage(icon.img, px - size/2, py - size/2 - 6, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(px, py - 6, size/4, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(180,140,255,0.4)';
        ctx.fill();
      }
      ctx.restore();

      // Label below icon
      const fontSize = Math.round((isfront ? 16 : 11) * (0.6 + depth * 0.4));
      ctx.save();
      ctx.globalAlpha = 0.2 + depth * 0.8;
      ctx.font = `${isfront ? 600 : 400} ${fontSize}px 'Space Grotesk',sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isfront ? '#ffffff' : 'rgba(180,140,255,0.7)';
      ctx.fillText(p.tag, px, py + size/2 + 4);
      ctx.restore();
    });

    ctx.restore(); // end icon+label clip
  }

  window._sphereTick = function() {
    if (!dragging) {
      rotY+=velY;
      rotX=Math.max(-MAX_ROT_X, Math.min(MAX_ROT_X, rotX+velX));
      if (rotX<=-MAX_ROT_X || rotX>=MAX_ROT_X) velX*=-0.3;
      velY*=0.97; velX*=0.97;
      if (Math.abs(velY)<0.004) velY+=(0.004-Math.abs(velY))*0.05*Math.sign(velY||1);
    }
    glowLerp += (glowTarget - glowLerp) * (glowTarget > glowLerp ? 0.08 : 0.035);
    draw();
  };
  resize();
  window.addEventListener('resize', resize);
})();


// ── Holo cards: 3D tilt + glitch + expand ────────
(() => {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@!';
  function glitchEl(el) {
    const orig=el.dataset.text||el.textContent; let iter=0;
    const iv=setInterval(()=>{
      el.textContent=orig.split('').map((c,i)=>{ if(c===' ')return ' '; if(i<iter-2)return c; return CHARS[Math.floor(Math.random()*CHARS.length)]; }).join('');
      iter+=0.7; if(iter>orig.length+4){el.textContent=orig;clearInterval(iv);}
    },36);
  }
  document.querySelectorAll('.card').forEach(card => {
    const main=card.querySelector('.glitch-main'), gr=card.querySelector('.glitch-r'), gb=card.querySelector('.glitch-b'), shine=card.querySelector('.holo-shine');
    let glitching=false;
    let cachedRect=null, tickScheduled=false, pendingEvt=null;
    card.addEventListener('mouseenter',()=>{ cachedRect=card.getBoundingClientRect(); if(!main||glitching)return; glitching=true; glitchEl(main); if(gr){gr.style.opacity='1';gr.style.transform='translate(-2px,1px)';}  if(gb){gb.style.opacity='1';gb.style.transform='translate(2px,-1px)';}  setTimeout(()=>{ if(gr){gr.style.opacity='0';gr.style.transform='none';} if(gb){gb.style.opacity='0';gb.style.transform='none';} glitching=false; },380); });
    card.addEventListener('mousemove',e=>{
      pendingEvt=e;
      if(tickScheduled)return;
      tickScheduled=true;
      requestAnimationFrame(()=>{
        tickScheduled=false;
        if(!cachedRect||!pendingEvt)return;
        const r=cachedRect, e=pendingEvt;
        const mx=((e.clientX-r.left)/r.width)*100, my=((e.clientY-r.top)/r.height)*100;
        if(shine){shine.style.setProperty('--mx',mx+'%');shine.style.setProperty('--my',my+'%');}
        const rx=(0.5-(e.clientY-r.top)/r.height)*14, ry=((e.clientX-r.left)/r.width-0.5)*18;
        card.style.transform=`perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.025,1.025,1.025)`;
      });
    });
    card.addEventListener('mouseleave',()=>{ card.style.transition='transform .5s cubic-bezier(.22,1,.36,1),box-shadow .3s ease,border-color .3s ease'; card.style.transform='perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)'; setTimeout(()=>{card.style.transition='box-shadow .3s ease,border-color .3s ease';},500); });
  });
  window.toggleCard=function(card){ const was=card.classList.contains('expanded'); document.querySelectorAll('.card.expanded').forEach(c=>c.classList.remove('expanded')); if(!was)card.classList.add('expanded'); };
})();

// ── Work Belt ─────────────────────────────────────
(() => {
  const CARDS=6, RADIUS=430, IDLE_SPEED=0.0015;
  const track=document.getElementById('belt-track'), hint=document.getElementById('belt-hint');
  if (!track) return;

  const labels=['006','001','002','003','004','005'];

  const PROJECTS = {
    '001': {
      title: 'Point of System (POS)',
      image: 'assets/project-pos.png',
      type: 'Desktop App',
      status: 'Completed',
      desc: 'A desktop point-of-sale application featuring secure role-based access, real-time inventory management, transaction tracking, and automated receipt generation — built for efficient retail operations.',
      tags: ['Java','Swing','JDBC','MySQL','NetBeans']
    }
  };

  const cardEls=labels.map(num=>{
    const wrap=document.createElement('div'); wrap.className='belt-card';
    const proj = PROJECTS[num];
    if (proj) {
      const tagsHtml = proj.tags.map(t=>`<span class="belt-tag">${t}</span>`).join('');
      wrap.innerHTML=`<div class="belt-card-face belt-card-face--project">
        <div class="belt-card-corner-tl"></div>
        <div class="belt-card-image" style="background-image:url('${proj.image}')">
          <span class="belt-card-status"><span class="belt-status-dot"></span>${proj.status}</span>
        </div>
        <div class="belt-card-content">
          <div class="belt-card-header">
            <h3 class="belt-card-title">${proj.title}</h3>
            <span class="belt-card-type">${proj.type}</span>
          </div>
          <div class="belt-card-divider"></div>
          <p class="belt-card-desc">${proj.desc}</p>
          <div class="belt-card-tags">${tagsHtml}</div>
        </div>
      </div>`;
    } else {
      wrap.innerHTML=`<div class="belt-card-face belt-card-face--empty">
        <div class="belt-empty-top">
          <span class="belt-empty-num">${num}</span>
          <span class="belt-empty-badge">COMING SOON</span>
        </div>
        <div class="belt-empty-body">
          <div class="belt-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <path d="M8 12h8M12 8v8"/>
            </svg>
          </div>
          <p class="belt-empty-title">Next Project</p>
          <p class="belt-empty-sub">Something's brewing.<br>Check back soon.</p>
        </div>
        <div class="belt-empty-footer">
          <div class="belt-empty-dots"><span></span><span></span><span></span></div>
        </div>
      </div>`;
    }
    track.appendChild(wrap); return wrap;
  });

  let angle=0, vel=0, dragging=false, lastX=0, idleTimer=null, isIdle=true;
  const arcActive=document.getElementById('arc-active'), arcActiveBlur=document.getElementById('arc-active-blur');
  const arcDot=document.getElementById('arc-dot'), arcTicks=document.getElementById('arc-ticks');
  const ARC_LEN=620, TICK_COUNT=6;
  const P0={x:20,y:62}, P1={x:300,y:8}, P2={x:580,y:62};

  function bezierPoint(t){ return {x:(1-t)*(1-t)*P0.x+2*(1-t)*t*P1.x+t*t*P2.x, y:(1-t)*(1-t)*P0.y+2*(1-t)*t*P1.y+t*t*P2.y}; }
  function bezierTangent(t){ return {x:2*(1-t)*(P1.x-P0.x)+2*t*(P2.x-P1.x), y:2*(1-t)*(P1.y-P0.y)+2*t*(P2.y-P1.y)}; }

  for (let i=0; i<TICK_COUNT; i++) {
    const t=i/(TICK_COUNT-1), bp=bezierPoint(t), bt=bezierTangent(t), len=Math.sqrt(bt.x*bt.x+bt.y*bt.y), nx=-bt.y/len, ny=bt.x/len, tickH=5;
    const tick=document.createElementNS('http://www.w3.org/2000/svg','line');
    tick.setAttribute('x1',(bp.x+nx*tickH).toFixed(2)); tick.setAttribute('y1',(bp.y+ny*tickH).toFixed(2));
    tick.setAttribute('x2',(bp.x-nx*tickH).toFixed(2)); tick.setAttribute('y2',(bp.y-ny*tickH).toFixed(2));
    tick.setAttribute('class','arc-tick'); tick.dataset.index=i; arcTicks.appendChild(tick);
  }
  const tickEls=arcTicks.querySelectorAll('line');

  function updateArc() {
    const norm=((angle%(Math.PI*2))+Math.PI*2)%(Math.PI*2), pos=norm/(Math.PI*2);
    const dashOffset=ARC_LEN-pos*ARC_LEN;
    arcActive.style.strokeDashoffset=dashOffset.toFixed(2);
    if (arcActiveBlur) arcActiveBlur.style.strokeDashoffset=dashOffset.toFixed(2);
    const bp=bezierPoint(pos);
    arcDot.setAttribute('cx',bp.x.toFixed(2)); arcDot.setAttribute('cy',bp.y.toFixed(2));
    const activeIdx=Math.round(pos*(TICK_COUNT-1))%TICK_COUNT;
    tickEls.forEach((tk,i)=>tk.setAttribute('class',i===activeIdx?'arc-tick arc-tick-active':'arc-tick'));
  }

  function place() {
    const step=(Math.PI*2)/CARDS, FADE_START=400, FADE_END=510;
    let frontIdx=-1, maxZ=-Infinity;
    const data=cardEls.map((card,i)=>{
      const a=angle-step*i, x=Math.sin(a)*RADIUS, z=Math.cos(a)*RADIUS;
      if(z>maxZ){ maxZ=z; frontIdx=i; }
      return {x,z};
    });
    cardEls.forEach((card,i)=>{
      const {x,z}=data[i];
      const t=(z+RADIUS)/(RADIUS*2);
      const isFront=i===frontIdx;
      const isActive=z>RADIUS*0.5;
      const scale=0.72+0.28*t;
      const absX=Math.abs(x);
      const edgeFade=absX<FADE_START?1:absX>FADE_END?0:1-(absX-FADE_START)/(FADE_END-FADE_START);
      const rawOpacity=0.28+0.72*t;
      const opacity=Math.max(0.72, rawOpacity)*edgeFade;
      // Only write if changed — avoids unnecessary style recalcs
      const newTx = `translateX(${Math.round(x)}px) scale(${scale.toFixed(3)})`;
      if (card._lastTx !== newTx) { card.style.transform = newTx; card._lastTx = newTx; }
      const newOp = opacity.toFixed(3);
      if (card._lastOp !== newOp) { card.style.opacity = newOp; card._lastOp = newOp; }
      const newZ = Math.round(t*100);
      if (card._lastZ !== newZ) { card.style.zIndex = newZ; card._lastZ = newZ; }
      if(card._isFront!==isFront){ card._isFront=isFront; card.classList.toggle('card-front',isFront); }
      if(card._isActive!==isActive){ card._isActive=isActive; card.classList.toggle('card-active',isActive); }
    });
  }

  // Belt integrates into master loop
  window._beltTick = function() {
    if (!dragging) {
      if (isIdle) { angle+=IDLE_SPEED; } else { vel*=0.93; angle+=vel; if(Math.abs(vel)<0.0003){vel=0;isIdle=true;} }
    }
    place(); updateArc();
  };

  function onStart(x){ dragging=true;isIdle=false;lastX=x;vel=0;track.classList.add('dragging');if(hint)hint.style.opacity='0';clearTimeout(idleTimer); }
  function onMove(x){ if(!dragging)return; vel=(x-lastX)*0.003; angle+=vel; lastX=x; }
  function onEnd(){ if(!dragging)return; dragging=false; track.classList.remove('dragging'); idleTimer=setTimeout(()=>{isIdle=true;},2200); }

  const scene=document.getElementById('belt-scene');
  scene.addEventListener('mousedown', e=>onStart(e.clientX));
  window.addEventListener('mousemove', e=>onMove(e.clientX), { passive:true });
  window.addEventListener('mouseup', onEnd);
  scene.addEventListener('touchstart', e=>onStart(e.touches[0].clientX), { passive:true });
  window.addEventListener('touchmove', e=>onMove(e.touches[0].clientX), { passive:true });
  window.addEventListener('touchend', onEnd);
})();
// ── Audio Engine (Web Audio API) ──────────────────
window._audio = (() => {
  let ctx = null;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function beep({ freq = 440, type = 'sine', vol = 0.15, dur = 0.08, attack = 0.005, decay = 0.04 } = {}) {
    try {
      const ac = getCtx();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = type; osc.frequency.value = freq;
      const now = ac.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay + dur);
      osc.start(now); osc.stop(now + attack + decay + dur + 0.01);
    } catch(e) {}
  }

  // nav click: quick sci-fi blip
  function navClick() {
    beep({ freq: 880, type: 'square', vol: 0.08, dur: 0.01, attack: 0.002, decay: 0.06 });
    setTimeout(() => beep({ freq: 1200, type: 'sine', vol: 0.06, dur: 0.01, attack: 0.001, decay: 0.04 }), 40);
  }

  // section boot: low thud
  function sectionBoot() {
    beep({ freq: 180, type: 'sine', vol: 0.12, dur: 0.05, attack: 0.005, decay: 0.18 });
    setTimeout(() => beep({ freq: 520, type: 'sine', vol: 0.07, dur: 0.02, attack: 0.003, decay: 0.1 }), 80);
  }

  // terminal send: satisfying tick
  function terminalSend() {
    beep({ freq: 660, type: 'square', vol: 0.07, dur: 0.01, attack: 0.001, decay: 0.05 });
  }

  // terminal receive: soft ding
  function terminalReceive() {
    beep({ freq: 740, type: 'sine', vol: 0.09, dur: 0.02, attack: 0.005, decay: 0.12 });
    setTimeout(() => beep({ freq: 988, type: 'sine', vol: 0.06, dur: 0.01, attack: 0.003, decay: 0.1 }), 60);
  }

  // sleep: gentle descending zzz tones
  function sleepIn() {
    beep({ freq: 440, type: 'sine', vol: 0.07, dur: 0.12, attack: 0.01, decay: 0.3 });
    setTimeout(() => beep({ freq: 330, type: 'sine', vol: 0.06, dur: 0.12, attack: 0.01, decay: 0.35 }), 400);
    setTimeout(() => beep({ freq: 220, type: 'sine', vol: 0.05, dur: 0.12, attack: 0.01, decay: 0.5 }), 850);
  }

  // wake: gentle ascending tones
  function wakeUp() {
    beep({ freq: 220, type: 'sine', vol: 0.05, dur: 0.08, attack: 0.01, decay: 0.25 });
    setTimeout(() => beep({ freq: 330, type: 'sine', vol: 0.07, dur: 0.08, attack: 0.01, decay: 0.2 }), 180);
    setTimeout(() => beep({ freq: 440, type: 'sine', vol: 0.09, dur: 0.1,  attack: 0.01, decay: 0.18 }), 360);
  }

  return { navClick, sectionBoot, terminalSend, terminalReceive, sleepIn, wakeUp };
})();

// ── Cursor Spark Trails ───────────────────────────
(() => {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  let sparks = [];
  let lastX = -999, lastY = -999, lastT = 0;

  window.addEventListener('mousemove', (e) => {
    const now = performance.now();
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    const speed = Math.sqrt(dx * dx + dy * dy);
    // Only spawn sparks when moving fast enough
    if (speed > 8 && now - lastT > 16) {
      const count = Math.min(Math.floor(speed / 10), 5);
      for (let i = 0; i < count; i++) {
        const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.4;
        const spd = Math.random() * 2.5 + 0.5;
        const colors = ['#c084fc', '#e0b4ff', '#f0abfc', '#7c3aed', '#ffffff'];
        sparks.push({
          x: e.clientX, y: e.clientY,
          vx: Math.cos(angle) * spd * 0.6 - dx * 0.05,
          vy: Math.sin(angle) * spd * 0.6 - dy * 0.05,
          r: Math.random() * 1.8 + 0.4,
          life: 1.0,
          decay: Math.random() * 0.04 + 0.03,
          color: colors[Math.floor(Math.random() * colors.length)]
        });
      }
      lastT = now;
    }
    lastX = e.clientX; lastY = e.clientY;
  }, { passive: true });

  // Patch into _bgTick: inject spark draw after clearRect
  const _origBgTick = window._bgTick;
  window._bgTick = function(t) {
    _origBgTick(t);
    if (!sparks.length) return;
    const ctx = canvas.getContext('2d');
    // Group by color to minimize fillStyle switches
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx; s.y += s.vy;
      s.vy += 0.04; s.vx *= 0.97;
      s.life -= s.decay;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.globalAlpha = s.life * 0.75;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y - window.scrollY, s.r * s.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
})();

// ── Nav click sounds ──────────────────────────────
document.querySelectorAll('.nav-links a, .nav-logo, a[href^="#"]').forEach(el => {
  el.addEventListener('click', () => { if (window._audio) window._audio.navClick(); });
});

// ── Section boot sound on scroll-reveal ──────────
(() => {
  const sections = document.querySelectorAll('.section');
  const bootObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        if (window._audio) window._audio.sectionBoot();
        bootObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  sections.forEach(s => bootObs.observe(s));
})();

// ── Terminal audio hooks ──────────────────────────
(() => {
  const sendBtn = document.getElementById('ai-send');
  const input   = document.getElementById('ai-input');
  if (!sendBtn || !input) return;

  // Patch send button and Enter key for send sound
  const origSendClick = sendBtn.onclick;
  sendBtn.addEventListener('click', () => { if (window._audio) window._audio.terminalSend(); }, true);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && window._audio) window._audio.terminalSend();
  }, true);

  // Watch for new bot messages (MutationObserver)
  const msgContainer = document.getElementById('ai-messages');
  if (!msgContainer) return;
  const mo = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.classList && node.classList.contains('ai-msg--bot')) {
          if (window._audio) window._audio.terminalReceive();
        }
      });
    });
  });
  mo.observe(msgContainer, { childList: true });
})();

// ── Idle Sleep Easter Egg ─────────────────────────
(() => {
  const memoji   = document.getElementById('memoji');
  const mHead    = document.getElementById('m-head');
  const mEyes    = document.getElementById('m-eyes');
  const mLids    = document.querySelectorAll('.m-lid');
  if (!memoji || !mHead) return;

  const IDLE_DELAY = 15000; // 15 seconds
  let idleTimer = null;
  let isSleeping = false;
  let zContainer = null;

  // ── ZZZ floater ──
  function spawnZzz() {
    if (!isSleeping) return;
    if (!zContainer) return;
    const z = document.createElementNS ? null : null; // use HTML
    const span = document.createElement('span');
    span.textContent = ['z', 'z', 'Z', 'Z', 'ZZ'][Math.floor(Math.random() * 5)];
    span.className = 'sleep-zzz';
    // randomize starting position near memoji head area
    const rect = memoji.getBoundingClientRect();
    const startX = rect.left + rect.width * (0.42 + Math.random() * 0.12);
    const startY = rect.top  + rect.height * 0.15;
    span.style.cssText = `
      position: fixed;
      left: ${startX}px;
      top: ${startY}px;
      font-family: var(--font, 'Space Grotesk', sans-serif);
      font-size: ${10 + Math.random() * 14}px;
      font-weight: 700;
      color: #9d5ff5;
      opacity: 0;
      pointer-events: none;
      z-index: 9998;
      text-shadow: 0 0 10px rgba(157,95,245,0.8);
      animation: zzzFloat 2.4s cubic-bezier(.22,1,.36,1) forwards;
    `;
    document.body.appendChild(span);
    span.addEventListener('animationend', () => span.remove());
    if (isSleeping) setTimeout(spawnZzz, 800 + Math.random() * 600);
  }

  function injectZzzCSS() {
    if (document.getElementById('zzz-style')) return;
    const style = document.createElement('style');
    style.id = 'zzz-style';
    style.textContent = `
      @keyframes zzzFloat {
        0%   { opacity: 0;   transform: translateY(0px)   scale(0.6) rotate(-8deg); }
        15%  { opacity: 0.9; transform: translateY(-10px)  scale(1.0) rotate(2deg); }
        80%  { opacity: 0.6; transform: translateY(-55px)  scale(1.1) rotate(8deg); }
        100% { opacity: 0;   transform: translateY(-80px)  scale(0.7) rotate(14deg); }
      }
      .sleep-droopy {
        transition: transform 1.2s cubic-bezier(.22,1,.36,1) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function goToSleep() {
    if (isSleeping) return;
    isSleeping = true;
    injectZzzCSS();
    if (window._audio) window._audio.sleepIn();

    // Droop the head down slightly
    if (mHead) {
      mHead.style.transition = 'transform 1.4s cubic-bezier(.22,1,.36,1)';
      mHead.setAttribute('transform', 'translate(0 18) rotate(12 200 260)');
    }

    // Close the eyelids
    setTimeout(() => {
      mLids.forEach(l => l.setAttribute('height', '40'));
    }, 600);

    // Dim the orbit glow
    const orbits = document.getElementById('m-orbits');
    if (orbits) orbits.style.opacity = '0.3';

    // Start ZZZ spawning
    zContainer = document.body; // used as flag
    setTimeout(spawnZzz, 800);
  }

  function wakeUp() {
    if (!isSleeping) return;
    isSleeping = false;
    zContainer = null;
    if (window._audio) window._audio.wakeUp();

    // Snap head back
    if (mHead) {
      mHead.style.transition = 'transform 0.5s cubic-bezier(.22,1,.36,1)';
      mHead.setAttribute('transform', 'translate(0 0) rotate(0 200 260)');
      setTimeout(() => { mHead.style.transition = ''; }, 550);
    }

    // Open eyes
    mLids.forEach(l => l.setAttribute('height', '0'));

    // Restore orbit glow
    const orbits = document.getElementById('m-orbits');
    if (orbits) { orbits.style.transition = 'opacity 0.6s ease'; orbits.style.opacity = '1'; }
  }

  function resetIdleTimer() {
    if (isSleeping) wakeUp();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(goToSleep, IDLE_DELAY);
  }

  // Start the idle countdown
  idleTimer = setTimeout(goToSleep, IDLE_DELAY);

  // Any interaction resets
  ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'].forEach(ev => {
    window.addEventListener(ev, resetIdleTimer, { passive: true });
  });
})();


// ── Section boot flicker visual ───────────────────
(() => {
  const sections = document.querySelectorAll('.section:not(#about)');
  const flickerObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.remove('booting');
        void e.target.offsetWidth;
        e.target.classList.add('booting');
        flickerObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  sections.forEach(s => flickerObs.observe(s));
})();

// ── Sphere click: prevent browser selection/drag box ──
(() => {
  const sphereWrap = document.querySelector('.sphere-wrap');
  if (!sphereWrap) return;
  sphereWrap.addEventListener('selectstart',  e => e.preventDefault());
  sphereWrap.addEventListener('contextmenu',  e => e.preventDefault());
})();

// ── Social cards: name scramble on hover ─────────
(() => {
  const glitchChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@!';
  document.querySelectorAll('.social-card').forEach(card => {
    const nameEl = card.querySelector('.social-name');
    if (!nameEl) return;
    const original = nameEl.textContent;
    let iv = null;

    card.addEventListener('mouseenter', () => {
      let iter = 0;
      clearInterval(iv);
      iv = setInterval(() => {
        nameEl.textContent = original.split('').map((c, i) => {
          if (c === ' ' || c === '+') return c;
          if (i < iter) return c;
          return glitchChars[Math.floor(Math.random() * glitchChars.length)];
        }).join('');
        iter += 0.7;
        if (iter > original.length + 2) {
          nameEl.textContent = original;
          clearInterval(iv);
        }
      }, 35);
    });

    card.addEventListener('mouseleave', () => {
      clearInterval(iv);
      nameEl.textContent = original;
    });
  });
})();

// ── Social card preview popups ────────────────────
(() => {
  const PLATFORM_COLORS = {
    github:     { bg: 'rgba(226,232,240,0.18)', clr: '#e2e8f0', border: 'rgba(226,232,240,0.45)' },
    discord:    { bg: 'rgba(114,137,218,0.22)', clr: '#7289da', border: 'rgba(114,137,218,0.55)' },
    instagram:  { bg: 'rgba(225,48,108,0.20)',  clr: '#e1306c', border: 'rgba(225,48,108,0.52)' },
    linkedin:   { bg: 'rgba(10,102,194,0.22)',  clr: '#4d9fd6', border: 'rgba(77,159,214,0.55)' },
    onlinejobs: { bg: 'rgba(245,158,11,0.20)',  clr: '#f59e0b', border: 'rgba(245,158,11,0.52)' },
  };

  const isDesktop = () => window.matchMedia('(min-width: 769px)').matches;

  // animate a stat value from 0 -> target, preserving prefix/suffix (e.g. "$8/hr")
  function animateStat(el, rawVal) {
    if (!el) return;
    const match = String(rawVal).match(/^(\D*)([\d,.]+)(\D*)$/);
    if (!match) {
      el.textContent = rawVal;
      if (String(rawVal).length > 5) el.classList.add('stat-val--long');
      if (String(rawVal).toUpperCase() === 'FREE') {
        el.classList.add('stat-val--free');
        el.classList.add('stat-pop');
        setTimeout(() => el.classList.remove('stat-pop'), 250);
      }
      return;
    }
    const [, prefix, numStr, suffix] = match;
    const target = parseFloat(numStr.replace(/,/g, ''));
    const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0;
    const duration = 650;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = target * eased;
      const formatted = decimals ? val.toFixed(decimals) : Math.round(val).toLocaleString();
      el.textContent = prefix + formatted + suffix;
      if (p < 1) {
        requestAnimationFrame(tick);
      } else {
        el.classList.add('stat-pop');
        setTimeout(() => el.classList.remove('stat-pop'), 250);
      }
    }
    requestAnimationFrame(tick);
  }

  // ── Desktop: cluster slide + big preview panel ──
  (() => {
    const stage = document.getElementById('socials-stage');
    const bigPreview = document.getElementById('sc-bigpreview');
    if (!stage || !bigPreview) return;

    // inject live wrapper only — idle is now the CSS divider line
    bigPreview.innerHTML = `<div class="sc-bp-live"></div>`;
    const livePanel = bigPreview.querySelector('.sc-bp-live');

    let hideTimer = null;

    function fillBigPreview(card) {
      const data = card.querySelector('.sc-preview').dataset;
      const platform = card.dataset.platform;
      const colors = PLATFORM_COLORS[platform] || PLATFORM_COLORS.github;

      bigPreview.style.setProperty('--popup-clr', colors.clr);
      bigPreview.style.setProperty('--popup-clr-bg', colors.bg);
      bigPreview.style.setProperty('--popup-clr-border', colors.border);

      livePanel.innerHTML = `
        <div class="sc-bp-banner">
          <div class="sc-bp-dots"><span></span><span></span><span></span></div>
        </div>
        <div class="sc-bp-body">
          <div class="sc-bp-avatar">${data.initials}</div>
          <span class="sc-bp-name">${data.name}</span>
          <span class="sc-bp-handle">${data.handle || ''}</span>
          <div class="sc-bp-status"><span class="dot"></span><span>${data.status || ''}</span></div>
          <p class="sc-bp-bio">${data.bio}</p>
          <div class="sc-bp-divider"></div>
          <div class="sc-bp-stats">
            ${[1,2,3].map(i => `
              <div class="sc-bp-stat">
                <span class="sc-bp-stat-val" id="bp-stat-${i}">0</span>
                <span class="sc-bp-stat-label">${data[`stat${i}Label`]}</span>
              </div>
            `).join('')}
          </div>
          <a class="sc-bp-cta" href="${card.getAttribute('href') || '#'}" target="${card.getAttribute('target') || '_self'}" rel="noopener">${data.cta || 'VISIT PROFILE'} <span class="sc-bp-cta-arrow">↗</span></a>
        </div>
      `;
      [1,2,3].forEach(i => animateStat(livePanel.querySelector(`#bp-stat-${i}`), data[`stat${i}Val`]));
    }

    function activate(card) {
      if (!isDesktop()) return;
      clearTimeout(hideTimer);
      fillBigPreview(card);

      // align the panel's grow origin to the hovered card's position
      const cardRect = card.getBoundingClientRect();
      const panelRect = bigPreview.getBoundingClientRect();
      const originY = cardRect.top + cardRect.height / 2 - panelRect.top;
      // negative X pulls the origin point back toward the card (left of the panel)
      const originX = cardRect.right - panelRect.left;
      bigPreview.style.transformOrigin = `${originX}px ${originY}px`;

      requestAnimationFrame(() => stage.classList.add('sc-preview-visible'));
    }

    function deactivate() {
      hideTimer = setTimeout(() => {
        stage.classList.remove('sc-preview-visible');
      }, 250);
    }

    document.querySelectorAll('.social-card').forEach(card => {
      if (!card.querySelector('.sc-preview')) return;
      card.addEventListener('mouseenter', () => activate(card));
      card.addEventListener('mouseleave', deactivate);
    });

    bigPreview.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    bigPreview.addEventListener('mouseleave', deactivate);

    // cursor merge into big preview — no glow
    bigPreview.addEventListener('mouseenter', () => {
      const cm = window._cursorMerge;
      if (cm) cm.mergeIntoCard(bigPreview);
    });
    bigPreview.addEventListener('mouseleave', () => {
      const cm = window._cursorMerge;
      if (cm) cm.burstOutCard(bigPreview);
    });

    stage.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    stage.addEventListener('mouseleave', deactivate);
  })();

  // ── Mobile: small popup near the card (original behavior) ──
  (() => {
    let popup = null;
    let hideTimer = null;

    function createPopup() {
      const el = document.createElement('div');
      el.className = 'sc-popup';
      el.innerHTML = `
        <div class="sc-popup-banner">
          <div class="sc-popup-dots"><span></span><span></span><span></span></div>
        </div>
        <div class="sc-popup-body">
          <div class="sc-popup-avatar" id="sp-avatar"></div>
          <span class="sc-popup-name" id="sp-name"></span>
          <span class="sc-popup-handle" id="sp-handle"></span>
          <div class="sc-popup-status"><span class="dot"></span><span id="sp-status"></span></div>
          <p class="sc-popup-bio" id="sp-bio"></p>
          <div class="sc-popup-divider"></div>
          <div class="sc-popup-stats" id="sp-stats"></div>
          <div class="sc-popup-cta" id="sp-cta"></div>
        </div>
      `;
      document.body.appendChild(el);
      return el;
    }

    function showPopup(card) {
      clearTimeout(hideTimer);
      if (!popup) popup = createPopup();

      const data = card.querySelector('.sc-preview').dataset;
      const platform = card.dataset.platform;
      const colors = PLATFORM_COLORS[platform] || PLATFORM_COLORS.github;

      popup.style.setProperty('--popup-clr', colors.clr);
      popup.style.setProperty('--popup-clr-bg', colors.bg);
      popup.style.setProperty('--popup-clr-border', colors.border);

      popup.querySelector('#sp-avatar').textContent = data.initials;
      popup.querySelector('#sp-name').textContent = data.name;
      popup.querySelector('#sp-handle').textContent = data.handle || '';
      popup.querySelector('#sp-status').textContent = data.status || '';
      popup.querySelector('#sp-bio').textContent = data.bio;
      popup.querySelector('#sp-cta').innerHTML = `${data.cta || 'VISIT PROFILE'} <span class="sc-popup-cta-arrow">↗</span>`;

      const stats = popup.querySelector('#sp-stats');
      stats.innerHTML = [1,2,3].map(i => `
        <div class="sc-popup-stat">
          <span class="sc-popup-stat-val" id="sp-stat-${i}">0</span>
          <span class="sc-popup-stat-label">${data[`stat${i}Label`]}</span>
        </div>
      `).join('');
      [1,2,3].forEach(i => animateStat(popup.querySelector(`#sp-stat-${i}`), data[`stat${i}Val`]));

      const rect = card.getBoundingClientRect();
      const grid = card.closest('.socials-grid');
      const gridRect = grid ? grid.getBoundingClientRect() : rect;
      const popupW = 320;
      const popupH = 290;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const gap = 16;

      const isWide = rect.width >= gridRect.width * 0.9;
      let placeRight;
      if (isWide) {
        placeRight = (vw - gridRect.right) >= gridRect.left;
      } else {
        const cardCenter = rect.left + rect.width / 2;
        const gridCenter = gridRect.left + gridRect.width / 2;
        placeRight = cardCenter > gridCenter;
      }

      let left = placeRight ? gridRect.right + gap : gridRect.left - popupW - gap;
      if (placeRight && left + popupW > vw - 10) left = gridRect.left - popupW - gap;
      if (!placeRight && left < 10) left = gridRect.right + gap;
      left = Math.max(10, Math.min(left, vw - popupW - 10));

      let top = rect.top;
      if (top + popupH > vh - 10) top = vh - popupH - 10;
      if (top < 10) top = 10;

      popup.classList.toggle('sc-popup--left', !placeRight);
      popup.style.left = left + 'px';
      popup.style.top  = top + 'px';
      popup.classList.add('visible');
    }

    function hidePopup() {
      hideTimer = setTimeout(() => {
        if (popup) popup.classList.remove('visible');
      }, 120);
    }

    document.querySelectorAll('.social-card').forEach(card => {
      if (!card.querySelector('.sc-preview')) return;
      card.addEventListener('mouseenter', () => {
        if (isDesktop()) return;
        showPopup(card);
      });
      card.addEventListener('mouseleave', () => {
        if (isDesktop()) return;
        hidePopup();
      });
    });
  })();
})();

// ── Contact Modal ─────────────────────────────────
(() => {
  // Copy email on pill click
  const emailPill = document.getElementById('contact-email-pill');
  if (emailPill) {
    const copyLabel = emailPill.querySelector('.contact-email-copy-label');
    let hasCopied = false;

    emailPill.addEventListener('click', (e) => {
      if (emailPill.classList.contains('restricted-email')) { e.stopImmediatePropagation(); return; }
      const emailTextEl = emailPill.querySelector('.contact-email-text');
      const emailToCopy = (emailTextEl && emailTextEl.textContent.trim()) || 'justinclark.mendoza.official@gmail.com';
      navigator.clipboard.writeText(emailToCopy).then(() => {
        hasCopied = true;
        emailPill.classList.add('copied');
        if (copyLabel) copyLabel.textContent = 'Copied ✓';
      });
    });

    emailPill.addEventListener('mouseleave', () => {
      if (hasCopied) {
        hasCopied = false;
        emailPill.classList.remove('copied');
        if (copyLabel) copyLabel.textContent = 'Copy Email';
      }
    });
  }

  const overlay   = document.getElementById('contact-modal');
  const openBtn   = document.getElementById('contact-open-btn');
  const closeBtn  = document.getElementById('contact-close-btn');
  const submitBtn = document.getElementById('contact-submit-btn');
  const submitTxt = document.getElementById('contact-submit-text');
  const statusMsg = document.getElementById('contact-status-msg');
  if (!overlay || !openBtn) return;

  function openModal() {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('cf-name')?.focus(), 350);
  }

  function closeModal() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    statusMsg.textContent = '';
    statusMsg.className = 'contact-status-msg';
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  submitBtn.addEventListener('click', async () => {
    const name    = document.getElementById('cf-name').value.trim();
    const email   = document.getElementById('cf-email').value.trim();
    const subject = document.getElementById('cf-subject').value.trim();
    const message = document.getElementById('cf-message').value.trim();

    if (!name || !email || !subject || !message) {
      statusMsg.textContent = '⚠ Fill in all fields.';
      statusMsg.className = 'contact-status-msg error';
      return;
    }

    // SECURITY: basic email format check — blocks obviously bad addresses
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) {
      statusMsg.textContent = '⚠ Enter a valid email address.';
      statusMsg.className = 'contact-status-msg error';
      return;
    }

    // SECURITY: length caps — prevents oversized payloads to Formspree
    if (name.length > 100 || email.length > 254 || subject.length > 200 || message.length > 5000) {
      statusMsg.textContent = '⚠ One or more fields exceed the maximum length.';
      statusMsg.className = 'contact-status-msg error';
      return;
    }

    submitBtn.disabled = true;
    submitTxt.textContent = 'SENDING...';

    try {
      const res = await fetch('https://formspree.io/f/mrevwgnw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message })
      });
      const data = await res.json();
      if (data.ok) {
        statusMsg.textContent = '✓ Message sent. I\'ll get back to you soon.';
        statusMsg.className = 'contact-status-msg success';
        submitTxt.textContent = 'Send Message';
        submitBtn.disabled = false;
        document.getElementById('cf-name').value = '';
        document.getElementById('cf-email').value = '';
        document.getElementById('cf-subject').value = '';
        document.getElementById('cf-message').value = '';
      } else {
        throw new Error(data.error);
      }
    } catch(e) {
      console.error('Contact error:', e.message);
      statusMsg.textContent = '✕ Failed to send. Try emailing directly.';
      statusMsg.className = 'contact-status-msg error';
      submitTxt.textContent = 'Send Message';
      submitBtn.disabled = false;
    }
  });
})();
    
    // ── Scroll Reveal: fade + scale, staggered ────────
(function () {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  const map = new Map();
  els.forEach(el => {
    const sec = el.closest('section, aside') || document.body;
    if (!map.has(sec)) map.set(sec, []);
    map.get(sec).push(el);
  });

  map.forEach(group => {
    group.forEach((el, i) => {
      el.style.transitionDelay = `${i * 90}ms`;
    });
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  els.forEach(el => io.observe(el));
})();

// ── Contact: Cursor Merge (same system as nav/sidebar) ───────
(() => {
  requestAnimationFrame(() => {
    const cm = window._cursorMerge;
    if (!cm) return;
    const { ring, _setLocked } = cm;

    function mergeIntoContact(targetEl) {
      const r  = targetEl.getBoundingClientRect();
      const cx = r.left + r.width  / 2;
      const cy = r.top  + r.height / 2;
      _setLocked(true);
      ring.style.transition = 'none';
      requestAnimationFrame(() => {
        ring.classList.add('contact-merge');
        ring.classList.remove('clicking', 'hovering', 'nav-merge');
        ring.style.transition =
          'transform 0.55s cubic-bezier(.22,1,.36,1), ' +
          'width 0.55s cubic-bezier(.22,1,.36,1), ' +
          'height 0.55s cubic-bezier(.22,1,.36,1), ' +
          'border-radius 0.55s cubic-bezier(.22,1,.36,1), ' +
          'opacity 0.2s ease';
        ring.style.transform = `translate3d(calc(${cx}px - 50%), calc(${cy}px - 50%), 0)`;
        ring.style.width  = r.width  + 'px';
        ring.style.height = r.height + 'px';
        ring.style.opacity = '0';
      });
    }

    function burstOutContact(targetEl) {
      _setLocked(false);
      ring.classList.remove('contact-merge');
      const r = targetEl.getBoundingClientRect();
      const cx = r.left + r.width  / 2;
      const cy = r.top  + r.height / 2;
      ring.style.transition = 'none';
      ring.style.transform = `translate3d(calc(${cx}px - 50%), calc(${cy}px - 50%), 0)`;
      ring.style.width = r.width + 'px';
      ring.style.height = r.height + 'px';
      ring.style.borderRadius = '999px';
      ring.style.opacity = '0.6';
      requestAnimationFrame(() => {
        ring.style.transition =
          'transform 0.4s cubic-bezier(.22,1,.36,1), ' +
          'width 0.4s cubic-bezier(.22,1,.36,1), ' +
          'height 0.4s cubic-bezier(.22,1,.36,1), ' +
          'border-radius 0.4s cubic-bezier(.22,1,.36,1), ' +
          'opacity 0.35s ease';
        ring.style.width = '56px';
        ring.style.height = '56px';
        ring.style.borderRadius = '50%';
        ring.style.opacity = '1';
      });
    }

    const emailPill  = document.getElementById('contact-email-pill');
    const contactBtn = document.getElementById('contact-open-btn');

    if (emailPill) {
      emailPill.addEventListener('mouseenter', () => mergeIntoContact(emailPill));
      emailPill.addEventListener('mouseleave', () => burstOutContact(emailPill));
    }
    if (contactBtn) {
      contactBtn.addEventListener('mouseenter', () => mergeIntoContact(contactBtn));
      contactBtn.addEventListener('mouseleave', () => burstOutContact(contactBtn));
    }
  });
})();

// ── Dev Portal: Theme Switcher ────────────────────
(function () {
  const THEMES = {
    dark: {
      '--bg':       '#0a0a0a',
      '--bg2':      '#111111',
      '--bg3':      '#181818',
      '--text':     '#ffffff',
      '--text-dim': '#666666',
      '--text-mid': '#999999',
      '--accent':   '#7c3aed',
      '--accent-l': '#9d5ff5',
      '--accent-g': 'rgba(124, 58, 237, 0.18)',
      '--border':   'rgba(255,255,255,0.07)',
      '--border-h': 'rgba(255,255,255,0.14)',
    },
    light: {
      '--bg':       '#f0eeff',
      '--bg2':      '#e4d9ff',
      '--bg3':      '#d8ccff',
      '--text':     '#1a0a3a',
      '--text-dim': '#7060a0',
      '--text-mid': '#4a2e80',
      '--accent':   '#7c3aed',
      '--accent-l': '#6d28d9',
      '--accent-g': 'rgba(124, 58, 237, 0.15)',
      '--border':   'rgba(100,60,200,0.12)',
      '--border-h': 'rgba(100,60,200,0.22)',
    }
  };

  function applyTheme(name) {
    const vars = THEMES[name];
    if (!vars) return;
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    document.body.classList.toggle('theme-light', name === 'light');
    document.body.classList.toggle('theme-dark',  name === 'dark');
    localStorage.setItem('cash33-theme', name);
    // Update merged toggle icon and label
    const iconDark = document.querySelector('#dp-theme-toggle .icon-dark');
    const iconLight = document.querySelector('#dp-theme-toggle .icon-light');
    const themeLabel = document.getElementById('theme-label');
    if (iconDark && iconLight && themeLabel) {
      if (name === 'dark') {
        iconDark.style.display = ''; iconLight.style.display = 'none';
        themeLabel.textContent = 'Dark';
      } else {
        iconDark.style.display = 'none'; iconLight.style.display = '';
        themeLabel.textContent = 'Light';
      }
    }
  }

  // Apply saved theme on load
  const saved = localStorage.getItem('cash33-theme') || 'dark';
  applyTheme(saved);

  // Wire up merged toggle button
  const themeToggleBtn = document.getElementById('dp-theme-toggle');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = localStorage.getItem('cash33-theme') || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }
})();
// ── Admin Settings Panel ─────────────────────────
document.addEventListener('DOMContentLoaded', () => {
const dpSettings = document.getElementById('dp-settings');
const settingsPanel = document.getElementById('settings-panel');
const settingsClose = document.getElementById('settings-close');
const toggleSocials = document.getElementById('toggle-socials');
const adminPrompt = document.getElementById('admin-prompt');
const adminPassword = document.getElementById('admin-password');
const adminConfirm = document.getElementById('admin-confirm');
const adminCancel = document.getElementById('admin-cancel');
const adminError = document.getElementById('admin-error');

// SECURITY: no password lives here anymore. Login now calls the
// server's /login endpoint, which checks the password server-side
// and hands back a short-lived session token. We only ever hold
// that token (in sessionStorage — cleared when the tab closes).
// (RENDER_URL is declared further down, reused here via closure.)
// SECURITY: token lives only in memory (JS closure). Never written to
// sessionStorage/localStorage — a stolen token can't survive a tab close,
// and XSS can't read it out of storage.
let adminToken = null;
let adminUnlocked = false;

if (dpSettings && settingsPanel) {
  dpSettings.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (adminUnlocked) {
      settingsPanel.classList.toggle('open');
    } else {
      adminPrompt.classList.add('open');
      adminPassword.value = '';
      adminError.textContent = '';
      setTimeout(() => adminPassword.focus(), 100);
    }
  });

  adminConfirm.addEventListener('click', async () => {
    const pw = adminPassword.value;
    adminConfirm.disabled = true;
    try {
      const r = await fetch(`${RENDER_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw })
      });
      if (r.status === 429) {
        adminError.textContent = 'Too many attempts — wait a few minutes and try again.';
        adminPassword.value = '';
        return;
      }
      if (r.status === 403) {
        adminError.textContent = 'Incorrect password.';
        adminPassword.value = '';
        adminPassword.focus();
        return;
      }
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      const data = await r.json();
      adminToken = data.token;
      // SECURITY: token stays in memory only — not written to sessionStorage
      adminUnlocked = true;
      adminPrompt.classList.remove('open');
      setTimeout(() => settingsPanel.classList.add('open'), 280);
    } catch (e) {
      console.error('Login request failed:', e);
      adminError.textContent = 'Could not reach server — check console for details.';
      adminPassword.value = '';
      adminPassword.focus();
    } finally {
      adminConfirm.disabled = false;
    }
  });

  adminPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') adminConfirm.click();
    if (e.key === 'Escape') adminCancel.click();
  });

  adminCancel.addEventListener('click', () => {
    adminPrompt.classList.remove('open');
  });

  // ── Settings panel cursor merge (pink glow) ──
  (() => {
    function tryBindSettingsMerge() {
      const panel = document.getElementById('settings-panel');
      if (!panel || !window._cursorMerge) return;
      const { ring, getLocked, _setLocked } = window._cursorMerge;

      let rx = 0, ry = 0; // track smoothed cursor inside

      panel.addEventListener('mouseenter', () => {
        const r  = panel.getBoundingClientRect();
        const cx = r.left + r.width  / 2;
        const cy = r.top  + r.height / 2;
        _setLocked(true);
        ring.style.transition = 'none';
        ring.style.background = 'transparent';
        ring.style.boxShadow  = 'none';
        ring.style.filter     = 'none';
        requestAnimationFrame(() => {
          ring.classList.remove('nav-merge', 'clicking', 'hovering');
          ring.classList.add('card-merge');
          ring.style.transition =
            'transform 0.6s cubic-bezier(.22,1,.36,1), ' +
            'width 0.6s cubic-bezier(.22,1,.36,1), ' +
            'height 0.6s cubic-bezier(.22,1,.36,1), ' +
            'border-radius 0.6s cubic-bezier(.22,1,.36,1), ' +
            'opacity 0.2s ease';
          ring.style.transform    = `translate(calc(${cx}px - 50%), calc(${cy}px - 50%))`;
          ring.style.width        = r.width  + 'px';
          ring.style.height       = r.height + 'px';
          ring.style.borderRadius = '22px';
          ring.style.opacity      = '0';
          panel.classList.add('absorbing');
          setTimeout(() => panel.classList.remove('absorbing'), 700);
        });
      });

      panel.addEventListener('mouseleave', () => {
        _setLocked(false);
        ring.classList.remove('card-merge');
        const r  = panel.getBoundingClientRect();
        const cx = r.left + r.width  / 2;
        const cy = r.top  + r.height / 2;
        ring.style.transition = 'none';
        ring.style.background = '';
        ring.style.boxShadow  = '';
        ring.style.filter     = '';
        ring.style.transform  = `translate(calc(${cx}px - 50%), calc(${cy}px - 50%))`;
        ring.style.width      = r.width  + 'px';
        ring.style.height     = r.height + 'px';
        ring.style.borderRadius = '999px';
        ring.style.opacity    = '0';
        requestAnimationFrame(() => {
          ring.style.transition =
            'transform 0.5s cubic-bezier(.22,1,.36,1), ' +
            'width 0.5s cubic-bezier(.22,1,.36,1), ' +
            'height 0.5s cubic-bezier(.22,1,.36,1), ' +
            'border-radius 0.5s cubic-bezier(.22,1,.36,1), ' +
            'opacity 0.4s ease, filter 0.4s ease, background 0.35s ease';
          ring.style.width        = '56px';
          ring.style.height       = '56px';
          ring.style.borderRadius = '50%';
          ring.style.opacity      = '1';
        });
      });
    }
    // _cursorMerge is set up in a rAF, so wait a tick
    requestAnimationFrame(() => setTimeout(tryBindSettingsMerge, 100));
  })();

    // ── Settings tab switching ──
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.settings-tab-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const pane = document.getElementById('tab-' + tab.dataset.tab);
      if (pane) pane.classList.add('active');
    });
  });

    settingsClose.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsPanel.classList.remove('open');
  });

  document.addEventListener('click', (e) => {
    if (settingsPanel.classList.contains('open') &&
        !settingsPanel.contains(e.target) &&
        !dpSettings.contains(e.target)) {
      settingsPanel.classList.remove('open');
    }
  });

  // Per-card social toggles
  const PLATFORM_LABELS = {
    github:     'GitHub',
    discord:    'Discord',
    instagram:  'Instagram',
    linkedin:   'LinkedIn',
    onlinejobs: 'OnlineJobs',
  };

  const LOCK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;

  function createRestrictedOverlay(label) {
    const el = document.createElement('div');
    el.className = 'restricted-overlay';
    el.innerHTML = `<div class="restricted-overlay-icon">${LOCK_SVG}</div><span class="restricted-overlay-label">${label}</span>`;
    return el;
  }

  function bindSocialToggle(id, platform) {
    const toggle = document.getElementById(id);
    if (!toggle) return;
    toggle.addEventListener('change', () => {
      const card = document.querySelector(`.social-card[data-platform="${platform}"]`);
      if (!card) return;
      const isRestricted = !toggle.checked;
      card.classList.toggle('restricted', isRestricted);
      const existing = card.querySelector('.restricted-overlay');
      if (isRestricted && !existing) {
        card.appendChild(createRestrictedOverlay(PLATFORM_LABELS[platform] || platform));
      } else if (!isRestricted && existing) {
        existing.remove();
      }
      saveState({ socials: { ...getCurrentSocialsState(), [platform]: toggle.checked } });
    });
  }

  function getCurrentSocialsState() {
    const platforms = ['github','discord','instagram','linkedin','onlinejobs'];
    const state = {};
    platforms.forEach(p => {
      const card = document.querySelector(`.social-card[data-platform="${p}"]`);
      state[p] = card ? !card.classList.contains('restricted') : true;
    });
    return state;
  }
  // Contact name input
  const contactNameInput = document.getElementById('contact-name-input');
  const contactNameApply = document.getElementById('contact-name-apply');
  const contactNameEl = document.querySelector('.contact-name');

  if (contactNameApply && contactNameEl) {
    contactNameApply.addEventListener('click', () => {
      const val = contactNameInput.value.trim();
      const footerName = document.querySelector('.footer-name');
      if (val) {
        contactNameEl.textContent = val; // SECURITY: textContent, not innerHTML — no markup/script injection
        if (footerName) footerName.textContent = val;
        saveState({ displayName: val });
      } else {
        contactNameEl.innerHTML = 'Justin Clark<br>Mendoza'; // static literal, not user input — safe
        if (footerName) footerName.textContent = 'Justin Clark';
        saveState({ displayName: '' });
      }
    });
    contactNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') contactNameApply.click();
    });
  }

  // Email toggle + input
  const toggleEmail = document.getElementById('toggle-email');
  const contactEmailInput = document.getElementById('contact-email-input');
  const contactEmailApply = document.getElementById('contact-email-apply');
  const contactEmailText = document.querySelector('.contact-email-text');
  const contactEmailPill = document.getElementById('contact-email-pill');

  const REAL_EMAIL = 'justinclark.mendoza.official@gmail.com';
  const HIDDEN_EMAIL = '••••••••@••••.com';

  const RENDER_URL = 'https://cash-github-io.onrender.com';

  // Save state to Render
  async function saveState(patch) {
    try {
      const r = await fetch(`${RENDER_URL}/state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ state: patch })
      });
      if (!r.ok) console.error('saveState bad status:', r.status);
    } catch(e) { console.error('saveState fetch failed:', e); }
  }

  // Load state from Render and apply to UI
  async function loadAndApplyState() {
    try {
      const res = await fetch(`${RENDER_URL}/state`);
      if (!res.ok) return;
      const state = await res.json();

      if (state.displayName) {
        const nameEl = document.querySelector('.contact-name');
        const footerName = document.querySelector('.footer-name');
        if (nameEl) nameEl.textContent = state.displayName; // SECURITY: textContent — this value comes from the server/other admins
        if (footerName) footerName.textContent = state.displayName;
        const contactNameInput = document.getElementById('contact-name-input');
        if (contactNameInput) contactNameInput.value = state.displayName;
      }

      applyEmailVisibility(state.showEmail !== false);
      applyStatus(state.status || 'available');

      const PLATFORM_LABELS_MAP = {
        github: 'GitHub', discord: 'Discord', instagram: 'Instagram',
        linkedin: 'LinkedIn', onlinejobs: 'OnlineJobs'
      };
      Object.entries(state.socials || {}).forEach(([platform, visible]) => {
        const card = document.querySelector(`.social-card[data-platform="${platform}"]`);
        const toggle = document.getElementById(`toggle-${platform}`);
        if (!card) return;
        const shouldRestrict = !visible;
        card.classList.toggle('restricted', shouldRestrict);
        if (toggle) toggle.checked = visible;
        const existing = card.querySelector('.restricted-overlay');
        if (shouldRestrict && !existing) {
          card.appendChild(createRestrictedOverlay(PLATFORM_LABELS_MAP[platform] || platform));
        } else if (!shouldRestrict && existing) {
          existing.remove();
        }
      });
    } catch(e) { console.error('loadAndApplyState failed:', e); }
  }

  function applyEmailVisibility(visible) {
    if (!contactEmailPill || !contactEmailText) return;
    if (visible) {
      contactEmailPill.classList.remove('restricted-email');
      contactEmailText.textContent = REAL_EMAIL;
      const existing = contactEmailPill.querySelector('.restricted-overlay');
      if (existing) existing.remove();
    } else {
      contactEmailPill.classList.add('restricted-email');
      contactEmailText.textContent = HIDDEN_EMAIL;
      if (!contactEmailPill.querySelector('.restricted-overlay')) {
        contactEmailPill.appendChild(createRestrictedOverlay('Email'));
      }
    }
    if (toggleEmail) toggleEmail.checked = visible;
  }

  // ── Availability status ──
  const STATUS_LABELS = { available: 'AVAILABLE', busy: 'BUSY', offline: 'NOT AVAILABLE' };
  const statusSelect = document.getElementById('status-select');
  const statusCards = document.querySelectorAll('.status-card');
  const livePill = document.getElementById('contact-status-pill');
  const liveStatusText = livePill ? livePill.querySelector('.contact-status-text') : null;
  const previewPill = document.getElementById('status-preview-pill');
  const previewText = document.getElementById('status-preview-text');

  // LinkedIn card elements
  const liHireTag    = document.getElementById('li-hire-tag');
  const liStatusLabel = document.getElementById('li-status-label');
  const liCard        = document.querySelector('.social-card[data-platform="linkedin"]');
  const liPreview      = liCard ? liCard.querySelector('.sc-preview') : null;

  // OnlineJobs card elements
  const ojHireTag    = document.getElementById('oj-hire-tag');
  const ojStatusLabel = document.getElementById('oj-status-label');
  const ojCard        = document.querySelector('.social-card[data-platform="onlinejobs"]');
  const ojPreview      = ojCard ? ojCard.querySelector('.sc-preview') : null;

  const HIRE_TAG_TEXT   = { available: 'HIRE ME',  busy: 'LIMITED',  offline: 'UNAVAILABLE' };
  const LI_STATUS_TEXT  = { available: 'CONNECT',       busy: 'CONNECT',  offline: 'CONNECT' };
  const OJ_STATUS_TEXT  = { available: 'OPEN TO WORK',  busy: 'LIMITED AVAILABILITY', offline: 'NOT TAKING WORK' };
  const PREVIEW_STATUS_TEXT = { available: 'OPEN TO WORK', busy: 'LIMITED AVAILABILITY', offline: 'NOT AVAILABLE' };

  function applyStatus(status) {
    const s = STATUS_LABELS[status] ? status : 'available';
    const label = STATUS_LABELS[s];

    [livePill, previewPill].forEach(pill => {
      if (!pill) return;
      pill.classList.remove('is-busy', 'is-offline');
      if (s === 'busy') pill.classList.add('is-busy');
      if (s === 'offline') pill.classList.add('is-offline');
    });
    if (liveStatusText) liveStatusText.textContent = label;
    if (previewText) previewText.textContent = label;
    if (statusSelect) statusSelect.value = s;

    // Social cards: LinkedIn + OnlineJobs hire tags & status labels
    [liHireTag, ojHireTag].forEach(tag => {
      if (!tag) return;
      tag.classList.remove('is-busy', 'is-offline');
      if (s === 'busy') tag.classList.add('is-busy');
      if (s === 'offline') tag.classList.add('is-offline');
      tag.textContent = HIRE_TAG_TEXT[s];
    });

    if (liStatusLabel) {
      liStatusLabel.classList.remove('is-busy', 'is-offline');
      if (s === 'busy') liStatusLabel.classList.add('is-busy');
      if (s === 'offline') liStatusLabel.classList.add('is-offline');
      liStatusLabel.textContent = LI_STATUS_TEXT[s];
    }
    if (ojStatusLabel) {
      ojStatusLabel.classList.remove('is-busy', 'is-offline');
      if (s === 'busy') ojStatusLabel.classList.add('is-busy');
      if (s === 'offline') ojStatusLabel.classList.add('is-offline');
      ojStatusLabel.textContent = OJ_STATUS_TEXT[s];
    }

    // Hover-preview tooltips (sc-preview dataset)
    if (liPreview) liPreview.dataset.status = PREVIEW_STATUS_TEXT[s];
    if (ojPreview) ojPreview.dataset.status = PREVIEW_STATUS_TEXT[s];

    // Sync card selector visuals
    statusCards.forEach(card => {
      card.classList.toggle('selected', card.dataset.status === s);
    });
  }

  statusCards.forEach(card => {
    card.addEventListener('click', () => {
      const s = card.dataset.status;
      applyStatus(s);
      saveState({ status: s });
    });
  });

  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      applyStatus(statusSelect.value);
      saveState({ status: statusSelect.value });
    });
  }

  // Load state from server on page load
  loadAndApplyState();

  // ── SSE: live reload listener ──
  const SESSION_ID = Math.random().toString(36).slice(2);
  (() => {
    let es;
    let retryCount = 0;
    const MAX_RETRIES = 20;
    const BASE_DELAY_MS = 5000;

    function connectSSE() {
      if (retryCount >= MAX_RETRIES) {
        // Silently stop reconnecting — avoids hammering the server forever
        return;
      }
      if (es) { try { es.close(); } catch(_) {} }
      es = new EventSource(`${RENDER_URL}/events`);
      es.addEventListener('reload', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.from === SESSION_ID) return;
        } catch(_) {}
        window.location.reload();
      });
      es.onopen = () => {
        // Reset retry count on successful connection
        retryCount = 0;
      };
      es.onerror = () => {
        try { es.close(); } catch(_) {}
        retryCount++;
        // Exponential backoff: 5s, 10s, 20s … capped at 60s
        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retryCount - 1), 60000);
        setTimeout(connectSSE, delay);
      };
    }
    connectSSE();
  })();

  // ── Keep-alive ping every 4 min to prevent Render spin-down ──
  setInterval(async () => {
    try { await fetch(`${RENDER_URL}/ping`); } catch(_) {}
  }, 4 * 60 * 1000);

  // ── Publish button ──
  const publishBtn = document.getElementById('settings-publish');

  async function wakeServer(timeout = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const r = await fetch(`${RENDER_URL}/ping`, { cache: 'no-store' });
        if (r.ok) return true;
      } catch(_) {}
      await new Promise(res => setTimeout(res, 1500));
    }
    return false;
  }

  if (publishBtn) {
    publishBtn.addEventListener('click', async () => {
      const label = publishBtn.querySelector('.settings-publish-label');
      publishBtn.classList.add('publishing');
      publishBtn.disabled = true;

      // Step 1: wake server if sleeping
      label.textContent = 'Waking...';
      const alive = await wakeServer();
      if (!alive) {
        publishBtn.classList.remove('publishing');
        publishBtn.disabled = false;
        label.textContent = 'Server offline';
        setTimeout(() => { label.textContent = 'Publish'; }, 3000);
        return;
      }

      // Step 2: broadcast reload
      label.textContent = 'Publishing...';
      try {
        const res = await fetch(`${RENDER_URL}/reload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify({ sessionId: SESSION_ID })
        });
        if (!res.ok) throw new Error('Bad response: ' + res.status);
        publishBtn.classList.remove('publishing');
        publishBtn.classList.add('published');
        label.textContent = 'Pushed ✓';
        setTimeout(() => {
          publishBtn.classList.remove('published');
          label.textContent = 'Publish';
        }, 2500);
      } catch(e) {
        console.error('Publish error:', e);
        publishBtn.classList.remove('publishing');
        label.textContent = 'Failed';
        setTimeout(() => { label.textContent = 'Publish'; }, 2500);
      } finally {
        publishBtn.disabled = false;
      }
    });
  }

  if (toggleEmail) {
    toggleEmail.addEventListener('change', () => {
      applyEmailVisibility(toggleEmail.checked);
      saveState({ showEmail: toggleEmail.checked });
    });
  }

  if (contactEmailApply && contactEmailText) {
    contactEmailApply.addEventListener('click', () => {
      const val = contactEmailInput.value.trim();
      const isVisible = !contactEmailPill.classList.contains('restricted-email');
      const nameEl = document.querySelector('.contact-name');
      const footerName = document.querySelector('.footer-name');
      if (val) {
        contactEmailText.textContent = isVisible ? val : HIDDEN_EMAIL;
        if (nameEl) nameEl.textContent = val; // SECURITY: textContent, not innerHTML
        if (footerName) footerName.textContent = val;
        saveState({ displayName: val });
      } else {
        contactEmailText.textContent = isVisible ? REAL_EMAIL : HIDDEN_EMAIL;
        if (nameEl) nameEl.innerHTML = 'Justin Clark<br>Mendoza';
        if (footerName) footerName.textContent = 'Justin Clark';
        saveState({ displayName: '' });
      }
    });
    contactEmailInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') contactEmailApply.click();
    });
  }

  bindSocialToggle('toggle-github', 'github');
  bindSocialToggle('toggle-discord', 'discord');
  bindSocialToggle('toggle-instagram', 'instagram');
  bindSocialToggle('toggle-linkedin', 'linkedin');
  bindSocialToggle('toggle-onlinejobs', 'onlinejobs');
}
}); // end DOMContentLoaded