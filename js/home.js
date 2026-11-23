// Home page: mobile menu and the request form. No tracking, nothing stored.
try { if (top !== self) top.location.replace(location.href); } catch { /* a foreign frame: stay put */ }
if (location.pathname === '/' && new URLSearchParams(location.search).get('lang') === 'en') location.replace('/en/' + location.hash);

document.addEventListener('DOMContentLoaded', () => {
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
