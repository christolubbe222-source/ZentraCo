
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

/* ── STELLAR CANVAS ── */
(() => {
  const c = document.getElementById('stellar');
  const ctx = c.getContext('2d', {alpha:true});
  let w, h, dpr, stars, planets, scroll = 0, targetScroll = 0;

  function getAccent(){
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    return v || 'oklch(0.78 0.12 85)';
  }
  function getInk(){
    return getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#e8e4d8';
  }
  function theme(){ return document.documentElement.getAttribute('data-theme') || 'dark'; }

  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = c.width = innerWidth * dpr;
    h = c.height = innerHeight * dpr;
    c.style.width = innerWidth+'px';
    c.style.height = innerHeight+'px';
    init();
  }

  function init(){
    stars = [];
    const count = Math.floor((innerWidth * innerHeight) / 4200);
    for (let i=0; i<count; i++){
      stars.push({
        x: Math.random()*w,
        y: Math.random()*h * 3, // extend vertically so scroll reveals new stars
        z: Math.random()*0.9 + 0.1,   // depth 0..1
        r: Math.random()*1.3 + .2,
        tw: Math.random()*Math.PI*2,
        hue: Math.random() < 0.12 ? 'accent' : 'star'
      });
    }
    planets = [
      {a: w*0.55, b: h*0.28, cx: w*0.5, cy: h*0.5, speed: 0.000035, phase: 0.2, r: 3.2*dpr, color: 'accent', ring: true,  tilt: -0.35},
      {a: w*0.38, b: h*0.16, cx: w*0.5, cy: h*0.5, speed: 0.000065, phase: 1.8, r: 2.0*dpr, color: 'ink',    ring: false, tilt:  0.18},
      {a: w*0.72, b: h*0.22, cx: w*0.5, cy: h*0.5, speed: 0.000022, phase: 3.0, r: 4.0*dpr, color: 'ink',    ring: true,  tilt:  0.55},
    ];
  }

  function draw(t){
    const motion = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--motion')) || 1;
    const isLight = theme() === 'light';

    scroll += (targetScroll - scroll) * 0.08;

    ctx.clearRect(0,0,w,h);

    // subtle central glow
    const glow = ctx.createRadialGradient(w*0.5, h*0.5 - scroll*0.2, 0, w*0.5, h*0.5 - scroll*0.2, Math.max(w,h)*0.6);
    if (isLight) {
      glow.addColorStop(0, 'rgba(255,240,210,0.25)');
      glow.addColorStop(0.5, 'rgba(255,240,210,0.05)');
      glow.addColorStop(1, 'rgba(255,240,210,0)');
    } else {
      glow.addColorStop(0, 'rgba(40,44,66,0.55)');
      glow.addColorStop(0.4, 'rgba(20,22,38,0.3)');
      glow.addColorStop(1, 'rgba(10,11,20,0)');
    }
    ctx.fillStyle = glow;
    ctx.fillRect(0,0,w,h);

    const accentColor = isLight ? 'rgba(180,140,40,' : 'rgba(240,215,130,';
    const starColor   = isLight ? 'rgba(30,32,40,'   : 'rgba(232,228,216,';

    // stars
    for (let i=0; i<stars.length; i++){
      const s = stars[i];
      const parallax = scroll * (0.3 + s.z*1.4);
      let y = (s.y - parallax) % (h*3);
      if (y < 0) y += h*3;
      y = y - h; // center band
      if (y < -20 || y > h+20) continue;

      s.tw += 0.004 * motion;
      const tw = (Math.sin(s.tw) * 0.5 + 0.5) * 0.7 + 0.3;
      const alpha = s.z * tw * (isLight ? 0.6 : 0.95);
      const r = s.r * dpr * s.z;
      const base = s.hue === 'accent' ? accentColor : starColor;
      ctx.fillStyle = base + alpha + ')';
      ctx.beginPath();
      ctx.arc(s.x, y, r, 0, Math.PI*2);
      ctx.fill();

      // occasional halo on bright stars
      if (s.z > 0.75 && s.hue === 'accent'){
        ctx.fillStyle = base + (alpha*0.15) + ')';
        ctx.beginPath();
        ctx.arc(s.x, y, r*4, 0, Math.PI*2);
        ctx.fill();
      }
    }

    // planets + orbits (motion-controlled)
    const cy = h*0.5 - scroll*0.35;
    for (const p of planets){
      const angle = p.phase + t * p.speed * motion * 1000;
      const cos = Math.cos(p.tilt), sin = Math.sin(p.tilt);

      // orbit path
      ctx.save();
      ctx.translate(p.cx, cy);
      ctx.rotate(p.tilt);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.a, p.b, 0, 0, Math.PI*2);
      ctx.strokeStyle = isLight ? 'rgba(23,24,28,0.08)' : 'rgba(232,228,216,0.07)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // planet position on tilted orbit
      const ex = Math.cos(angle) * p.a;
      const ey = Math.sin(angle) * p.b;
      const px = p.cx + ex*cos - ey*sin;
      const py = cy   + ex*sin + ey*cos;

      // glow halo
      const rc = ctx.createRadialGradient(px, py, 0, px, py, p.r*12);
      const col = p.color === 'accent' ? accentColor : starColor;
      rc.addColorStop(0, col + '0.55)');
      rc.addColorStop(0.3, col + '0.18)');
      rc.addColorStop(1, col + '0)');
      ctx.fillStyle = rc;
      ctx.beginPath();
      ctx.arc(px, py, p.r*12, 0, Math.PI*2);
      ctx.fill();

      // planet body
      ctx.fillStyle = col + (isLight ? '0.9)' : '1)');
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI*2);
      ctx.fill();

      // optional ring
      if (p.ring){
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(p.tilt + 0.4);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r*3.2, p.r*1.1, 0, 0, Math.PI*2);
        ctx.strokeStyle = col + '0.45)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('scroll', () => { targetScroll = window.scrollY * dpr; }, {passive:true});
  resize();
  requestAnimationFrame(draw);
})();

/* ── TWEAKS REMOVED ── design locked: blue accent, dark theme, 2% motion */
