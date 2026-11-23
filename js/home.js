// Home page: starfield, light effects, mobile menu and the request form. No tracking, nothing stored.
try { if (top !== self) top.location.replace(location.href); } catch { /* a foreign frame: stay put */ }
if (location.pathname === '/' && new URLSearchParams(location.search).get('lang') === 'en') location.replace('/en/' + location.hash);
document.documentElement.classList.replace('nojs', 'js');

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;

/* ------- starfield: twinkling stars in three depths, drifting with the scroll, and an occasional shooting star ------- */
function starfield() {
  const cv = document.getElementById('stars'), cx = cv.getContext('2d');
  let w = 0, h = 0, dpr = 1, stars = [], shoot = null, nextShoot = 2500;
  const tints = ['255,255,255', '255,255,255', '255,244,224', '220,228,255'];
  const make = () => {
    dpr = Math.min(devicePixelRatio || 1, 2); w = innerWidth; h = innerHeight;
    cv.width = w * dpr; cv.height = h * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(340, Math.round(w * h / 5200));
    stars = Array.from({ length: n }, () => {
      const z = Math.random();
      return { x: Math.random() * w, y: Math.random() * h, z, r: .3 + z * z * 1.2, a: .2 + z * .55,
               tw: Math.random() * 6.28, sp: .6 + Math.random() * 1.8, c: tints[Math.random() * 4 | 0] };
    });
  };
  make(); addEventListener('resize', make);
  let last = performance.now(), sy = scrollY;
  const frame = now => {
    const dt = Math.min(now - last, 50); last = now;
    sy += (scrollY - sy) * .12;
    cx.clearRect(0, 0, w, h);
    for (const s of stars) {
      const y = ((s.y - sy * (.04 + s.z * .16)) % h + h) % h;
      const a = reduced ? s.a : s.a * (.65 + .35 * Math.sin(now / 1000 * s.sp + s.tw));
      cx.fillStyle = `rgba(${s.c},${a})`;
      cx.beginPath(); cx.arc(s.x, y, s.r, 0, 6.283); cx.fill();
      if (s.r > 1.5) { cx.fillStyle = `rgba(${s.c},${a * .12})`; cx.beginPath(); cx.arc(s.x, y, s.r * 4, 0, 6.283); cx.fill(); }
    }
    if (!reduced) {
      nextShoot -= dt;
      if (!shoot && nextShoot < 0) {
        shoot = { x: Math.random() * w * .8 + w * .2, y: Math.random() * h * .4, t: 0, len: 120 + Math.random() * 120 };
        nextShoot = 9000 + Math.random() * 9000;
      }
      if (shoot) {
        shoot.t += dt / 900;
        const p = shoot.t, x = shoot.x - p * 520, y = shoot.y + p * 260, fade = Math.sin(Math.min(p, 1) * Math.PI);
        const g = cx.createLinearGradient(x, y, x + shoot.len, y - shoot.len / 2);
        g.addColorStop(0, `rgba(255,255,255,${.7 * fade})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        cx.strokeStyle = g; cx.lineWidth = 1.6; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + shoot.len, y - shoot.len / 2); cx.stroke();
        if (p >= 1) shoot = null;
      }
    }
    if (!document.hidden && !reduced) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  if (!reduced) document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); requestAnimationFrame(frame); } });
}

document.addEventListener('DOMContentLoaded', () => {
  starfield();

  /* ------- blocks rise into view ------- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
  }), { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach((el, i, all) => {
    const sib = [...el.parentElement.children].filter(x => x.classList.contains('reveal'));
    el.style.transitionDelay = `${Math.min(sib.indexOf(el), 5) * 80}ms`;
    io.observe(el);
  });

  /* ------- light that follows the cursor; the hero cards lean towards it ------- */
  if (fine && !reduced) {
    const glow = document.querySelector('.glow'), fan = document.querySelector('.fan-in');
    let gx = innerWidth / 2, gy = innerHeight / 2, tx = gx, ty = gy, on = false;
    addEventListener('pointermove', e => {
      tx = e.clientX; ty = e.clientY;
      if (!on) { on = true; glow.classList.add('on'); }
      const card = e.target.closest('.work, .card');
      if (card) { const r = card.getBoundingClientRect(); card.style.setProperty('--x', `${e.clientX - r.left}px`); card.style.setProperty('--y', `${e.clientY - r.top}px`); }
      if (fan) {
        const r = fan.getBoundingClientRect(), dx = (e.clientX - r.left - r.width / 2) / innerWidth, dy = (e.clientY - r.top - r.height / 2) / innerHeight;
        fan.style.transform = `rotateY(${dx * 14}deg) rotateX(${-dy * 10}deg)`;
      }
    }, { passive: true });
    document.addEventListener('pointerleave', () => { on = false; glow.classList.remove('on'); });
    const move = () => {
      gx += (tx - gx) * .12; gy += (ty - gy) * .12;
      glow.style.transform = `translate3d(${gx}px,${gy}px,0)`;
      requestAnimationFrame(move);
    };
    requestAnimationFrame(move);
  }

  /* ------- mobile menu ------- */
  const burger = document.querySelector('.burger'), nav = document.getElementById('nav');
  const setMenu = open => { nav.classList.toggle('open', open); burger.setAttribute('aria-expanded', open); };
  burger.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  /* ------- request form ------- */
  const form = document.getElementById('apply'), status = document.getElementById('apply-status');
  const t = JSON.parse(form.dataset.msgs);
  const rules = {
    name: v => (v.trim().length >= 2 ? '' : t.errName),
    phone: v => (/^[+]?[0-9 ()-]{7,20}$/.test(v.trim()) && v.replace(/[^0-9]/g, '').length >= 7 ? '' : t.errPhone),
    email: v => (/^[^@\s]+@[^@\s]+[.][^@\s]{2,}$/.test(v.trim()) ? '' : t.errEmail),
    consent: (v, i) => (i.checked ? '' : t.errConsent),
  };
  const inputs = [...form.querySelectorAll('input[required]')];
  const check = i => {
    const msg = rules[i.name](i.value, i), f = i.closest('.field');
    f.classList.toggle('bad', !!msg); f.querySelector('.err').textContent = msg;
    i.setAttribute('aria-invalid', !!msg);
    return !msg;
  };
  for (const i of inputs) {
    i.addEventListener('blur', () => { if (i.type !== 'checkbox' && i.value) check(i); });
    i.addEventListener(i.type === 'checkbox' ? 'change' : 'input', () => { if (i.closest('.field').classList.contains('bad')) check(i); });
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const bad = inputs.filter(i => !check(i));
    if (bad.length) { bad[0].focus(); return; }
    const data = Object.fromEntries(inputs.filter(i => i.name !== 'consent').map(i => [i.name, i.value.trim()]));
    const btn = form.querySelector('button[type="submit"]');
    status.className = 'status'; status.textContent = '';
    if (!form.elements.botcheck.checked) {          // hidden from people, ticked only by bots
      btn.disabled = true; btn.textContent = t.sending;
      try {
        const r = await fetch('https://api.web3forms.com/submit', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            access_key: form.dataset.key, subject: `Website request: ${data.name.replace(/[^\p{L}\p{N} .'-]/gu, '').slice(0, 60)}`,
            from_name: 'Axioma', ...data, message: form.elements.message.value.trim() || '—', consent: 'yes',
          }),
        });
        if (!r.ok || !(await r.json()).success) throw new Error('send');
      } catch {
        btn.disabled = false; btn.textContent = t.send;
        status.className = 'status fail'; status.textContent = t.errSend; return;
      }
    }
    form.reset(); btn.disabled = false; btn.textContent = t.send;
    status.className = 'status ok'; status.textContent = t.ok;
  });
});
