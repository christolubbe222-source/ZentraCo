
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
document.querySelectorAll('[data-open-modal]').forEach(b => b.addEventListener('click', e => {
  e.preventDefault();
  document.getElementById('modal').classList.add('open');
}));
document.getElementById('closeModal').addEventListener('click', () => document.getElementById('modal').classList.remove('open'));
document.getElementById('modal').addEventListener('click', e => {
  if (e.target.id === 'modal') e.currentTarget.classList.remove('open');
});

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
  let bolts = [];
  let particles = [];
  let flash = 0;
  let nextStrike = 800;
  let lastT = 0;

  // Electric blue palette
  const CORE   = 'rgba(210,235,255,';  // bright white-blue core
  const GLOW   = 'rgba(60,140,255,';   // electric blue glow
  const BRANCH = 'rgba(100,170,255,';  // branch glow
  const FLASH  = 'rgba(60,120,255,';   // screen flash tint
  const DUST   = 'rgba(90,160,255,';   // ambient charge particles

  /* ── Resize ── */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = c.width  = innerWidth  * dpr;
    h = c.height = innerHeight * dpr;
    c.style.width  = innerWidth  + 'px';
    c.style.height = innerHeight + 'px';
    spawnParticles();
  }

  /* ── Particles ── */
  function spawnParticles() {
    particles = [];
    const n = Math.floor((w * h) / (90000 * dpr));
    for (let i = 0; i < n; i++) particles.push(makeParticle(true));
  }
  function makeParticle(anywhere) {
    return {
      x:  Math.random() * w,
      y:  anywhere ? Math.random() * h : h + 8,
      vy: -(Math.random() * 0.5 + 0.08) * dpr,
      vx: (Math.random() - 0.5) * 0.15 * dpr,
      r:  (Math.random() * 1.1 + 0.25) * dpr,
      a:  Math.random() * 0.45 + 0.08,
      ph: Math.random() * Math.PI * 2,
    };
  }

  /* ── Bolt segment generator (recursive midpoint displacement) ── */
  function buildSegs(x1, y1, x2, y2, spread, depth, out, isBranch) {
    if (depth === 0) { out.push({x1,y1,x2,y2,br:isBranch}); return; }
    const mx = (x1+x2)/2 + (Math.random()-0.5) * spread;
    const my = (y1+y2)/2 + (Math.random()-0.5) * spread * 0.18;
    buildSegs(x1, y1, mx, my, spread*0.52, depth-1, out, isBranch);
    buildSegs(mx, my, x2, y2, spread*0.52, depth-1, out, isBranch);
    // random branch
    if (!isBranch && depth > 2 && Math.random() < 0.42) {
      const angle = (Math.random()-0.5) * 1.1;
      const len   = (Math.abs(y2-y1) + Math.abs(x2-x1)) * (0.25 + Math.random()*0.35);
      buildSegs(mx, my,
        mx + Math.sin(angle)*len,
        my + Math.cos(angle)*len*0.75,
        spread*0.38, depth-2, out, true);
    }
  }

  function createBolt() {
    const sx = (0.1 + Math.random()*0.8) * w;
    const ex = sx + (Math.random()-0.5) * w * 0.35;
    const ey = (0.45 + Math.random()*0.5) * h;
    const spread = Math.abs(ex-sx)*0.9 + h*0.12;
    const segs = [];
    buildSegs(sx, 0, ex, ey, spread, 7, segs, false);
    return {
      segs,
      life:  1.0,
      decay: 0.016 + Math.random()*0.014,
      ph:    Math.random()*Math.PI*2,
      sx,
    };
  }

  function scheduleNext() {
    nextStrike = 2200 + Math.random() * 5500;
  }

  /* ── Draw one bolt ── */
  function drawBolt(bolt) {
    const flicker = 0.72 + Math.sin(bolt.ph) * 0.28;
    const a = bolt.life * flicker;
    bolt.ph += 0.35;

    ctx.lineCap = 'round';
    for (const s of bolt.segs) {
      const br = s.br;
      // outer glow
      ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2);
      ctx.strokeStyle = GLOW   + (a*(br?0.18:0.32)) + ')';
      ctx.lineWidth   = (br ? 14 : 26) * dpr;
      ctx.stroke();
      // mid glow
      ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2);
      ctx.strokeStyle = BRANCH + (a*(br?0.28:0.48)) + ')';
      ctx.lineWidth   = (br ? 5 : 9) * dpr;
      ctx.stroke();
      // core
      ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2);
      ctx.strokeStyle = CORE   + (a*(br?0.55:1.0)) + ')';
      ctx.lineWidth   = (br ? 1.2 : 2.2) * dpr;
      ctx.stroke();
    }
  }

  scheduleNext();

  /* ── Main loop ── */
  function draw(t) {
    const dt = Math.min(t - lastT, 50);
    lastT = t;

    ctx.clearRect(0, 0, w, h);

    // Atmospheric dark vignette
    const atm = ctx.createRadialGradient(w*.5,h*.35,0, w*.5,h*.5, Math.max(w,h)*.75);
    atm.addColorStop(0,   'rgba(8,15,40,0.42)');
    atm.addColorStop(0.55,'rgba(4,8,22,0.22)');
    atm.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = atm;
    ctx.fillRect(0,0,w,h);

    // Screen flash (decays quickly)
    if (flash > 0.008) {
      ctx.fillStyle = FLASH + (flash * 0.16) + ')';
      ctx.fillRect(0,0,w,h);
      flash *= 0.78;
    }

    // Ambient charged particles
    for (let i = particles.length-1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.ph += 0.055;
      // glow brighter near active bolts
      let boost = 0;
      for (const b of bolts) boost = Math.max(boost, b.life * Math.max(0, 1-(Math.abs(p.x-b.sx)/(w*0.3))));
      const alpha = Math.min((p.a * (0.55 + Math.sin(p.ph)*0.45)) + boost*0.5, 0.9);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = DUST + alpha + ')';
      ctx.fill();
      if (p.y < -8) particles[i] = makeParticle(false);
    }

    // Strike timer
    nextStrike -= dt;
    if (nextStrike <= 0) {
      const count = Math.random() < 0.28 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          bolts.push(createBolt());
          flash = Math.max(flash, 0.55 + Math.random()*0.45);
        }, i * (70 + Math.random()*160));
      }
      scheduleNext();
    }

    // Draw & age bolts
    for (let i = bolts.length-1; i >= 0; i--) {
      drawBolt(bolts[i]);
      bolts[i].life -= bolts[i].decay;
      if (bolts[i].life <= 0) bolts.splice(i,1);
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(draw);
})();
