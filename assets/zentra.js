
// locked design tokens
document.documentElement.style.setProperty('--accent-h', 230);
document.documentElement.setAttribute('data-theme', 'dark');
document.documentElement.style.setProperty('--motion', 0.02);

/* ── NAV SCROLL ── */
const navEl = document.getElementById('nav');
window.addEventListener('scroll', () => {
  navEl.classList.toggle('scrolled', window.scrollY > 60);
}, {passive:true});

/* ── MODAL ── */
const CALENDLY_URL = 'https://calendly.com/christolubbe222/15min';

document.querySelectorAll('[data-open-modal]').forEach(b => b.addEventListener('click', e => {
  e.preventDefault();
  document.getElementById('modal').classList.add('open');
}));
document.getElementById('closeModal').addEventListener('click', () => document.getElementById('modal').classList.remove('open'));
document.getElementById('modal').addEventListener('click', e => {
  if (e.target.id === 'modal') e.currentTarget.classList.remove('open');
});

document.getElementById('diagnosisForm').addEventListener('submit', e => {
  e.preventDefault();
  document.getElementById('modal').classList.remove('open');
  window.open(CALENDLY_URL, '_blank');
});

/* ── TICKER DUPLICATION (seamless loop) ── */
document.querySelectorAll('.ticker-track').forEach(t => { t.innerHTML += t.innerHTML; });

/* ── DRAWER NAV ── */
const drawer = document.getElementById('drawer');
const drawerBackdrop = document.getElementById('drawerBackdrop');
function openDrawer(){ drawer.classList.add('open'); drawerBackdrop.classList.add('open'); drawer.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; }
function closeDrawer(){ drawer.classList.remove('open'); drawerBackdrop.classList.remove('open'); drawer.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }
document.getElementById('menuTrigger')?.addEventListener('click', openDrawer);
document.getElementById('drawerClose')?.addEventListener('click', closeDrawer);
drawerBackdrop?.addEventListener('click', closeDrawer);
drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { if (!a.hasAttribute('data-open-modal')) closeDrawer(); }));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

/* ── LIGHTNING CANVAS ── */
(() => {
  const c = document.getElementById('stellar');
  if (!c) return;
  const ctx = c.getContext('2d', {alpha: true});

  let w, h, dpr;
  let bolts      = [];
  let particles  = [];
  let flash      = 0;
  let nextStrike = 1200;
  let lastT      = 0;

  /* ── Resize ── */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = c.width  = innerWidth  * dpr;
    h = c.height = innerHeight * dpr;
    c.style.width  = innerWidth  + 'px';
    c.style.height = innerHeight + 'px';
    spawnParticles();
  }

  /* ── Ambient particles ── */
  function spawnParticles() {
    particles = [];
    const n = Math.floor((w * h) / 110000);
    for (let i = 0; i < n; i++) particles.push(makeParticle(true));
  }
  function makeParticle(anywhere) {
    return {
      x:  Math.random() * w,
      y:  anywhere ? Math.random() * h : h + 6,
      vy: -(Math.random() * 0.3 + 0.06) * dpr,
      vx: (Math.random() - 0.5) * 0.1 * dpr,
      r:  (Math.random() * 0.9 + 0.2) * dpr,
      a:  Math.random() * 0.3 + 0.05,
      ph: Math.random() * Math.PI * 2,
    };
  }

  /* ── Bolt builder: recursive midpoint displacement ── */
  function buildSegs(x1, y1, x2, y2, spread, depth, out, isBranch) {
    if (depth === 0) { out.push({x1, y1, x2, y2, br: isBranch}); return; }
    const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * spread;
    const my = (y1 + y2) / 2 + (Math.random() - 0.5) * spread * 0.14;
    buildSegs(x1, y1, mx, my, spread * 0.54, depth - 1, out, isBranch);
    buildSegs(mx, my, x2, y2, spread * 0.54, depth - 1, out, isBranch);
    if (!isBranch && depth > 2 && Math.random() < 0.38) {
      const ang = (Math.random() - 0.5) * 1.0;
      const len = (Math.abs(y2 - y1) + Math.abs(x2 - x1)) * (0.2 + Math.random() * 0.3);
      buildSegs(mx, my, mx + Math.sin(ang) * len, my + Math.cos(ang) * len * 0.7,
                spread * 0.35, depth - 2, out, true);
    }
  }

  function createBolt() {
    const sx  = (0.12 + Math.random() * 0.76) * w;
    const ex  = sx + (Math.random() - 0.5) * w * 0.3;
    const ey  = (0.5  + Math.random() * 0.45) * h;
    const spread = Math.abs(ex - sx) * 0.85 + h * 0.1;
    const segs = [];
    buildSegs(sx, 0, ex, ey, spread, 7, segs, false);
    return { segs, life: 1.0, decay: 0.018 + Math.random() * 0.012, ph: Math.random() * Math.PI * 2, sx };
  }

  function scheduleNext() {
    nextStrike = 2800 + Math.random() * 5000;
  }

  /* ── Draw bolt using shadowBlur for natural glow ── */
  function drawBolt(bolt) {
    const flicker = 0.75 + Math.sin(bolt.ph) * 0.25;
    const a = bolt.life * flicker;
    bolt.ph += 0.4;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const s of bolt.segs) {
      const br = s.br;
      const coreW   = (br ? 0.6 : 1.1) * dpr;
      const glowBlur = (br ? 6  : 14) * dpr;
      const coreA   = a * (br ? 0.5 : 1.0);
      const glowA   = a * (br ? 0.3 : 0.65);

      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);

      // glow pass using shadowBlur — gives soft diffuse electric look
      ctx.shadowColor = `rgba(80,160,255,${glowA})`;
      ctx.shadowBlur  = glowBlur;
      ctx.strokeStyle = `rgba(180,220,255,${coreA})`;
      ctx.lineWidth   = coreW;
      ctx.stroke();

      // second pass: pure white core, no shadow
      ctx.shadowBlur  = 0;
      ctx.strokeStyle = `rgba(230,245,255,${coreA * 0.9})`;
      ctx.lineWidth   = coreW * 0.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  scheduleNext();

  /* ── Main loop ── */
  function draw(t) {
    const dt = Math.min(t - lastT, 50);
    lastT = t;

    ctx.clearRect(0, 0, w, h);

    // ── Central atmospheric depth (restores the original depth glow) ──
    const depth = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
    depth.addColorStop(0,    'rgba(14,22,54,0.50)');
    depth.addColorStop(0.45, 'rgba(7,12,32,0.28)');
    depth.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = depth;
    ctx.fillRect(0, 0, w, h);

    // ── Edge glow: subtle blue bleed inward from all 4 sides ──
    let eg;
    // top
    eg = ctx.createLinearGradient(0, 0, 0, h * 0.14);
    eg.addColorStop(0, 'rgba(30,90,220,0.20)');
    eg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = eg; ctx.fillRect(0, 0, w, h * 0.14);
    // bottom
    eg = ctx.createLinearGradient(0, h, 0, h * 0.86);
    eg.addColorStop(0, 'rgba(30,90,220,0.20)');
    eg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = eg; ctx.fillRect(0, h * 0.86, w, h * 0.14);
    // left
    eg = ctx.createLinearGradient(0, 0, w * 0.11, 0);
    eg.addColorStop(0, 'rgba(30,90,220,0.18)');
    eg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = eg; ctx.fillRect(0, 0, w * 0.11, h);
    // right
    eg = ctx.createLinearGradient(w, 0, w * 0.89, 0);
    eg.addColorStop(0, 'rgba(30,90,220,0.18)');
    eg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = eg; ctx.fillRect(w * 0.89, 0, w * 0.11, h);

    // ── Screen flash on strike ──
    if (flash > 0.006) {
      ctx.fillStyle = `rgba(55,120,255,${flash * 0.12})`;
      ctx.fillRect(0, 0, w, h);
      flash *= 0.76;
    }

    // ── Ambient charged particles ──
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.ph += 0.05;
      let boost = 0;
      for (const b of bolts)
        boost = Math.max(boost, b.life * Math.max(0, 1 - Math.abs(p.x - b.sx) / (w * 0.28)));
      const alpha = Math.min(p.a * (0.5 + Math.sin(p.ph) * 0.5) + boost * 0.4, 0.75);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100,175,255,${alpha})`;
      ctx.fill();
      if (p.y < -6) particles[i] = makeParticle(false);
    }

    // ── Strike timer ──
    nextStrike -= dt;
    if (nextStrike <= 0) {
      const count = Math.random() < 0.25 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          bolts.push(createBolt());
          flash = Math.max(flash, 0.5 + Math.random() * 0.5);
        }, i * (80 + Math.random() * 140));
      }
      scheduleNext();
    }

    // ── Draw & age bolts ──
    for (let i = bolts.length - 1; i >= 0; i--) {
      drawBolt(bolts[i]);
      bolts[i].life -= bolts[i].decay;
      if (bolts[i].life <= 0) bolts.splice(i, 1);
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(draw);
})();
