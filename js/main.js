import * as THREE from 'three';
import { clamp, lerp, sstep, track } from './lib.js';
import { Post } from './post.js';
import { buildTorus, buildAttractor, buildStars } from './lines.js';
import { buildShip, buildEnv } from './ship.js';
import { buildHole } from './hole.js';
import { buildMoon, buildPlanet, buildDebris } from './worlds.js';
import { buildHelix, buildDyson, buildGalaxy } from './cosmos.js';
import { starSurface, buildStar, buildWarp, buildBlast, buildDust } from './star.js';
import { Sound } from './sound.js';
import { t, onLang, applyLang, toggleLang } from './i18n.js';

const canvas = document.getElementById('gl');
const params = new URLSearchParams(location.search);
const mobile = innerWidth < 760 || /Mobi|Android/i.test(navigator.userAgent);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------- timeline, in hundredths of a viewport of scroll ------- */
const SHOTS = [
  { id: 'hero', a: 0, b: 90 },
  { id: 'ship', a: 90, b: 210 },
  { id: 'scale', a: 210, b: 320 },
  { id: 'hole', a: 320, b: 420 },
  { id: 'end', a: 420, b: 540 },
];
const END = 540, CUT = 30, BOOT_LEN = 1.9;
const LIGHT = { order: .973, origin: .976, world: .943 };   // background as shown on screen
const WAIT = { id: 'wait' }, WARP = { id: 'warp' }, NOVA = { id: 'nova' };
// finale clock, in seconds from the moment the camera crosses the horizon
const JUMP = 2.7, BOOM = JUMP + 2.5, DONE = BOOM + 3.7, TRIGGER = 414, REST = 520;
const SITE = {
  hero: new THREE.Vector3(0, 0, 0), order: new THREE.Vector3(600, 0, 0), ship: new THREE.Vector3(1200, 0, 0),
  hole: new THREE.Vector3(1800, 0, 0), world: new THREE.Vector3(2400, 0, 0), moon: new THREE.Vector3(3000, 0, 0),
  origin: new THREE.Vector3(3600, 0, 0), energy: new THREE.Vector3(4200, 0, 0), scale: new THREE.Vector3(4800, 0, 0), nova: new THREE.Vector3(5400, 0, 0),
};

const BOOT = [
  ['AXIOMA OS  v6.0.1', 0],
  ['(C) 2187 AXIOMA DEEP FIELD PROGRAMME', 0],
  ['', 0],
  ['MEM  1048576 PB ............................ OK', 1],
  ['SENSOR ARRAY ............................... OK', 1],
  ['TOKAMAK CORE ............................... 41.7 MK', 1],
  ['', 0],
  ['> load axioms --all', 2],
  ['  [01] structure .... accepted     [05] attention .... accepted', 1],
  ['  [02] engineering .. accepted     [06] visibility ... accepted', 1],
  ['  [03] identity ..... accepted     [07] adaptive ..... accepted', 1],
  ['  [04] conversion ... accepted     [08] support ...... accepted', 1],
  ['', 0],
  ['> build website', 2],
  ['  ready.', 3],
];

function boot() {
  try { if (top !== self) top.location.replace(location.href); } catch { /* a foreign frame: stay put */ }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
    if (!renderer.capabilities.isWebGL2) throw 0;
  } catch { document.documentElement.classList.add('nogl'); return; }
  // software renderers and phones get lighter bakes and fewer particles
  const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
  const memo = (k, v) => { try { if (v !== undefined) sessionStorage.setItem(k, v); return sessionStorage.getItem(k); } catch { return null; } };
  const soft = /swiftshader|llvmpipe|software|basic render/i.test(gpu) || memo('axioma-lite') === '1';
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    memo('axioma-lite', '1');
    if (memo('axioma-reloaded') !== '1') { memo('axioma-reloaded', '1'); location.reload(); }
  });
  const low = mobile || soft;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0, 0, 0);
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 3400);
  const post = new Post(renderer, { samples: low ? 0 : 4 });

  /* ------- terminal drawn to a texture, so it passes through the CRT shader ------- */
  const tc = document.createElement('canvas'); tc.width = 1280; tc.height = 800;
  const tx = tc.getContext('2d');
  const crt = new THREE.CanvasTexture(tc); post.c.tCRT.value = crt; post.c.uCRT.value = reduced ? 0 : 1;
  const mono = '"JetBrains Mono", Consolas, "Courier New", monospace';
  const drawTerm = t => {
    tx.fillStyle = '#000'; tx.fillRect(0, 0, 1280, 800);
    tx.font = `26px ${mono}`; tx.textBaseline = 'top';
    tx.shadowColor = '#7dffb0'; tx.shadowBlur = 10; tx.fillStyle = '#c9ffe0';
    const left = 96, lh = 37;
    let tt = t * 125, y = 74;
    for (const [line, kind] of BOOT) {
      if (tt <= 0) break;
      const n = kind === 2 ? Math.min(line.length, Math.floor(tt)) : line.length;
      tx.fillText(line.slice(0, n), left, y);
      tt -= kind === 2 ? line.length + 10 : kind === 3 ? 26 : kind === 1 ? 6 : 2;
      y += lh;
    }
    if (Math.floor(t * 4) % 2 === 0) tx.fillRect(left, y + 4, 15, 28);
    crt.needsUpdate = true;
  };

  let scale = params.get('q') ? +params.get('q') : Math.min(devicePixelRatio || 1, soft ? .7 : mobile ? 1.3 : 1.5);
  let hole = null, stars = null, galaxy = null, dustU = null;
  const size = () => {
    const w = Math.max(2, Math.round(innerWidth * scale)), h = Math.max(2, Math.round(innerHeight * scale));
    renderer.setPixelRatio(1); renderer.setSize(w, h, false); post.setSize(w, h);
    if (hole) hole.mesh.userData.u.uAspect.value = innerWidth / Math.max(innerHeight, 1);
    if (stars) stars.userData.u.uPx.value = Math.max(1, h / 720) * 1.5;
    if (galaxy) galaxy.userData.u.uPx.value = h / 720;
    if (dustU) dustU.uPx.value = Math.max(1, h / 720);
  };
  size();

  /* ------- the first scene exists at once; the rest are built behind it ------- */
  const q = soft ? .25 : mobile ? .5 : 1;
  const world = {};
  const group = id => { const g = new THREE.Group(); g.position.copy(SITE[id] || SITE.hero); g.visible = false; scene.add(g); world[id] = g; return g; };

  stars = buildStars(mobile ? 2400 : 5200); scene.add(stars); size();
  const torus = buildTorus(Math.round(1500 * q), mobile ? 150 : 220);
  torus.rotation.set(-.62, .34, 0);
  group('hero').add(torus);
  const torusU = torus.userData.u;

  let att, ship, sun, holeU, helix, helixU, dyson, planet, planetU, moon, moonU, corona, warp, warpU, star, blast, blastU, dust;
  const jobs = {
    order() {
      att = buildAttractor(Math.round(1500 * q), 240);
      att.scale.setScalar(.2); att.rotation.y = .55;
      group('order').add(att);
    },
    ship() {
      scene.environment = buildEnv(renderer);
      ship = buildShip(q);
      ship.group.rotation.set(.1, 0, .05);
      group('ship').add(ship.group);
      sun = new THREE.DirectionalLight(0xfff4e6, 3.4);
      sun.visible = false; sun.castShadow = true; sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
      Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 140 });
      sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
      sun.position.copy(SITE.ship).add(new THREE.Vector3(-26, 40, 42)); sun.target.position.copy(SITE.ship);
      scene.add(sun, sun.target);
    },
    origin() {
      helix = buildHelix(mobile ? .6 : 1);
      helix.rotation.set(.1, .3, -.62);
      group('origin').add(helix);
      helixU = helix.userData.u;
    },
    async energy() {
      dyson = buildDyson(soft ? 2400 : mobile ? 4200 : 9000, await surface());
      dyson.group.rotation.x = .2;
      group('energy').add(dyson.group);
    },
    hole() {
      hole = buildHole(soft ? 50000 : mobile ? 120000 : 300000);
      holeU = hole.mesh.userData.u;
      holeU.uCenter.value.copy(SITE.hole);
      holeU.uAspect.value = camera.aspect;
      holeU.uTilt.value.makeRotationFromEuler(new THREE.Euler(.09, 0, -.2));
      hole.shadow.scale.setScalar(1.28);
      hole.ring.scale.setScalar(6.25);
      group('hole').add(hole.shadow, hole.ring);
      hole.mesh.visible = false; scene.add(hole.mesh);
    },
    scale() {
      galaxy = buildGalaxy(soft ? 50000 : mobile ? 110000 : 280000);
      group('scale').add(galaxy);
      size();
    },
    async world() {
      planet = await buildPlanet(renderer, soft ? 768 : mobile ? 1536 : 2048, mobile ? 230 : 460, mobile ? 115 : 230);
      group('world').add(planet, buildDebris(mobile ? 160 : 420));
      planetU = planet.userData.u;
      const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(-5, 6, 7); world.world.add(key);
    },
    async moon() {
      moon = await buildMoon(renderer, soft ? 1024 : mobile ? 2048 : 4096);
      moon.scale.setScalar(10);
      group('moon').add(moon);
      moonU = moon.userData.u;
      corona = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { uI: { value: 0 }, uA: { value: 0 }, uB: { value: 0 } },
        vertexShader: `varying vec2 vU; void main(){ vU=uv*2.-1.; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: /* glsl */`uniform float uI,uA,uB; varying vec2 vU;
          void main(){ float r=length(vU), a=atan(vU.y,vU.x); float R=.5;
            float d=r-R; float ga=cos(a-uA);
            float rim=exp(-abs(d)*140.)*pow(max(ga,0.),3.)*2.6*step(0.,d+.002)+exp(-max(d,0.)*16.)*step(0.,d)*.3*(.4+.6*max(ga,0.));
            float bead=exp(-length(vU-vec2(cos(uA),sin(uA))*R)*60.)*uB*24.;
            float flare=uB*exp(-abs((vU-vec2(cos(uA),sin(uA))*R).y)*150.)*exp(-abs((vU-vec2(cos(uA),sin(uA))*R).x)*2.6)*1.6;
            gl_FragColor=vec4(vec3(1.,.96,.9)*(rim*uI+bead+flare),1.); }`,
      }));
      corona.scale.setScalar(44); corona.renderOrder = 4;
      world.moon.add(corona);
    },
  };
  const surface = () => starSurface(renderer, soft ? 1024 : mobile ? 1536 : 2048);
  jobs.nova = async () => {
    warp = buildWarp(); warpU = warp.userData.u;
    group('warp').add(warp);
    star = buildStar(6, await surface());
    blast = buildBlast(); blastU = blast.userData.u;
    dust = buildDust(soft ? 60000 : mobile ? 130000 : 320000); dustU = dust.userData.u;
    group('nova').add(star.group, blast, dust);
    size();
  };
  for (const k of ['order', 'origin', 'energy', 'world', 'moon']) delete jobs[k];   // scenes the short cut leaves out
  const ready = { hero: true };
  const queue = Object.keys(jobs);
  const needOf = id => (id === 'end' ? 'nova' : id);
  /** Compiles a scene's real shader variants off-screen. Lights must be on here, or the programs
   *  would not match and the browser would stall recompiling them the moment the scene appears. */
  async function prepare(id) {
    const g = world[id], lit = id === 'ship' ? sun : null;
    g.visible = true; if (lit) lit.visible = true;
    const jobsDone = [renderer.compileAsync(g, camera, scene)];
    if (id === 'hole') { hole.mesh.visible = true; jobsDone.push(renderer.compileAsync(hole.mesh, camera, scene)); hole.mesh.visible = false; }
    g.visible = false; if (lit) lit.visible = false;
    try { await Promise.all(jobsDone); } catch { /* falls back to compiling on first draw */ }
  }
  async function buildAll() {
    while (queue.length) {
      // whatever the visitor is closest to comes first
      const here = y;
      queue.sort((p, r) => {
        const cost = id => { const d = (id === 'nova' ? 420 : SHOTS.find(k => k.id === id).a) - here; return d < -40 ? 4000 - d : Math.abs(d); };
        return cost(p) - cost(r);
      });
      const id = queue.shift();
      await jobs[id]();
      await prepare(id);
      ready[id] = true;
      await new Promise(r => setTimeout(r, 30));
    }
  }

  /* ------- camera ------- */
  const S = SITE;
  const rel = (o, list) => list.map(k => [k[0], k[1] + o.x, k[2] + o.y, k[3] + o.z, k[4] + o.x, k[5] + o.y, k[6] + o.z, k[7]]);
  const CAM = {
    wait: [[0, 0, 0, 15, 0, 0, 0, 30], [1, 0, 0, 15, 0, 0, 0, 30]],
    hero: rel(S.hero, [[0, 0, 0, 15.5, 0, 0, 0, 30], [.55, .6, -.4, 12, 0, 0, 0, 30], [1, -2.6, .9, 2.4, -3.2, 1.4, -3, 62]]),
    order: rel(S.order, [[0, 3, 2, 30, 0, -.6, 0, 30], [.5, -6, -1, 26, 3.4, .2, 0, 30], [1, -2, 3, 17, 2.6, .6, 0, 28]]),
    ship: rel(S.ship, [
      [0, 30, 15, 58, 0, -.5, 0, 28], [.22, 12, 9, 40, -2, 0, 0, 26],
      [.42, -26, 12, 25, -14, 1, 0, 28], [.62, -6, 13, 15, 0, 6, 0, 32],
      [.82, 26, 7, 12, 16, 1, 0, 32], [1, 42, 4, 40, 8, 0, 0, 24],
    ]),
    origin: rel(S.origin, [[0, 9, 2, 25, 0, 0, 0, 30], [.5, -7, 1, 18, -1, 2, 0, 30], [1, -3, 5, 13, -2, 6, 0, 32]]),
    energy: rel(S.energy, [[0, -9, 3, 46, -8, 0, 0, 25], [.36, 2, 5, 46, -7, 0, 0, 25], [.58, 15, 7, 46, 0, 0, 0, 25], [1, 3, 8, 34, 0, 0, 0, 30]]),
    hole: rel(S.hole, [[0, 0, 3.4, 40, 0, .7, 0, 24], [.5, 3.5, 1.9, 27, 0, .6, 0, 26], [.8, 1.4, .9, 13, 0, .2, 0, 38], [.95, .3, .3, 4.4, 0, 0, 0, 62], [1, 0, 0, 1.6, 0, 0, 0, 74]]),
    scale: rel(S.scale, [[0, 14, .5, 13, 0, 1, 0, 56], [.42, 16, 11, 34, 0, 0, 0, 44], [1, 0, 56, 26, 0, -1, 0, 34]]),
    world: rel(S.world, [[0, 0, .6, 16, -1.7, 0, 0, 30], [.45, 2.2, 5.5, 18.5, 0, 0, 0, 30], [1, -6, 7.5, 13, 0, 0, 0, 38]]),
    moon: rel(S.moon, [[0, 0, 0, 62, -13, 0, 0, 26], [.42, 0, 0, 52, -10, 0, 0, 24], [.66, 0, 0, 47, 0, 0, 0, 24], [1, 0, 0, 44, 0, 0, 0, 25]]),
    warp: [[0, 0, 0, 10, 0, 0, 0, 40], [1, 0, 0, 10, 0, 0, 0, 40]],
    nova: rel(S.nova, [[0, 0, 0, 31, 0, 0, 0, 26], [1, 0, 0, 31, 0, -2.4, 0, 26]]),
    end: rel(S.nova, [[0, 0, 0, 31, 0, -2.4, 0, 26], [1, 0, 0, 31, 0, -2.4, 0, 26]]),
  };

  /* ------- DOM ------- */
  const beats = [...document.querySelectorAll('[data-in]:not(.tag3d)')].map(el => ({ el, a: +el.dataset.in, b: +el.dataset.out, f: +(el.dataset.fade || 16), v: -1 }));
  const $ = id => document.getElementById(id);
  const HERE = new THREE.Vector3(10.6, .1, 9.1);
  const labels = [...document.querySelectorAll('.tag3d')].map(el => ({ el, a: +el.dataset.in, b: +el.dataset.out, shot: el.dataset.shot || 'ship', anchor: el.dataset.anchor }));
  const scrollBox = $('scroll');
  const vh = () => scrollBox.offsetHeight / ((END + 100) / 100) || innerHeight;   // #scroll is (END + 100)vh tall
  document.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' }); });
  $('lang').addEventListener('click', toggleLang);
  const sound = new Sound();
  const snd = $('sound');
  const showSound = () => { snd.setAttribute('aria-pressed', sound.on); snd.querySelector('span').textContent = t(sound.on ? 'musicOn' : 'music'); };
  let touched = false;
  snd.addEventListener('click', () => { touched = true; sound.toggle(); showSound(); });
  // browsers only allow audio after a gesture, so the score starts on the first one
  const firstGesture = e => {
    removeEventListener('pointerup', firstGesture); removeEventListener('keydown', firstGesture);
    if (touched || e.target.closest?.('#sound, #lang')) return;
    sound.start(); showSound();
  };
  addEventListener('pointerup', firstGesture); addEventListener('keydown', firstGesture);

  let accepted = 0, acceptT = 0, firstName = '';
  const showAfter = () => { $('after').textContent = t('after').replace('{name}', firstName); };
  const form = $('apply'), status = $('apply-status');
  const rules = {
    name: v => (v.trim().length >= 2 ? '' : t('errName')),
    phone: v => (/^[+]?[0-9 ()-]{7,20}$/.test(v.trim()) && v.replace(/[^0-9]/g, '').length >= 7 ? '' : t('errPhone')),
    email: v => (/^[^@ ]+@[^@ ]+[.][^@ ]{2,}$/.test(v.trim()) ? '' : t('errEmail')),
  };
  const check = i => {
    const msg = rules[i.name](i.value), f = i.closest('.field');
    f.classList.toggle('bad', !!msg); f.querySelector('.err').textContent = msg;
    i.setAttribute('aria-invalid', !!msg);
    return !msg;
  };
  for (const i of form.querySelectorAll('input[required]')) {
    i.addEventListener('blur', () => { if (i.value) check(i); });
    i.addEventListener('input', () => { if (i.closest('.field').classList.contains('bad')) check(i); });
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const inputs = [...form.querySelectorAll('input[required]')];
    const bad = inputs.filter(i => !check(i));
    if (bad.length) { bad[0].focus(); return; }
    const data = Object.fromEntries(inputs.map(i => [i.name, i.value.trim()]));
    const trap = form.elements.botcheck.checked;     // hidden from people, ticked only by bots
    const key = form.dataset.key, btn = form.querySelector('button');
    if (key && !trap) {
      btn.disabled = true; status.textContent = '';
      try {
        const r = await fetch('https://api.web3forms.com/submit', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ access_key: key, subject: `Website request: ${data.name.replace(/[^\p{L}\p{N} .'-]/gu, '').slice(0, 60)}`, from_name: 'Axioma', ...data, message: form.elements.message.value.trim() || '—' }),
        });
        if (!r.ok || !(await r.json()).success) throw 0;
      } catch {
        btn.disabled = false; status.textContent = t('errSend'); return;
      }
    }
    accepted = 1; acceptT = T;
    firstName = data.name.split(' ')[0];
    showAfter();
    document.body.classList.add('accepted');
    sound.resolve();
  });

  let mx = 0, my = 0, mxs = 0, mys = 0;
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1; }, { passive: true });

  // The buffers follow the real window, checked every frame. This also rescues a page opened before
  // it had any size. A phone's address bar and keyboard change the height a little: those are ignored,
  // because rebuilding the buffers mid-scroll would stutter.
  let nextFit = 0;
  const fit = now => {
    const w = Math.round(innerWidth * scale), h = Math.round(innerHeight * scale), r = post.c.uRes.value;
    if (!w || !h || now < nextFit) return;
    if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
    if (r.x !== w || Math.abs(r.y - h) > r.y * .25 || (!mobile && r.y !== h)) { nextFit = now + 150; size(); }
  };

  /* ------- run ------- */
  if (location.hash === '#request') scrollTo(0, REST * vh() / 100);   // the services pages link straight to the form
  const skip = reduced || scrollY > 40 || params.has('skip');
  let bootT = skip ? 99 : 0;
  if (skip) { post.c.uCRT.value = 0; document.documentElement.classList.add('live'); }
  document.documentElement.classList.add('ready');

  let y = scrollY / vh() * 100, last = performance.now(), T = 0, slowRun = 0, frames = 0, cur_ = null, cardI = -1, cutSeen = -1;
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), tmp = new THREE.Vector3(), sunW = new THREE.Vector3(), qInv = new THREE.Quaternion(), tq = new THREE.Quaternion();
  const card = $('card'), nudge = $('nudge');
  $('go-form').addEventListener('click', e => { e.preventDefault(); y = REST; scrollTo(0, REST * vh() / 100); });
  let cine = scrollY / vh() * 100 > TRIGGER ? 'done' : 'idle', cineT = 0, lockY = 0, warpPhase = 0, doneT = 0, lastShotEnd = false;
  const stop = e => { e.preventDefault(); };
  const stopKeys = e => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(e.key)) e.preventDefault(); };
  const lock = on => {
    const f = on ? addEventListener : removeEventListener, o = { passive: false };
    f('wheel', stop, o); f('touchmove', stop, o); f('keydown', stopKeys);
  };
  let lastY = y, idleAt = performance.now(), nudged = false;
  onLang(() => { showSound(); showAfter(); cardI = -1; });
  applyLang();

  function setShot(s) {
    cur_ = s;
    for (const k of Object.keys(world)) world[k].visible = k === s.id || (k === 'nova' && s.id === 'end');
    if (hole) hole.mesh.visible = s.id === 'hole';
    const light = s.id in LIGHT;
    const bg = light ? Math.pow(LIGHT[s.id], 2.2) : 0;
    scene.background.setRGB(bg, bg, bg);
    stars.visible = !light && s !== WARP;
    post.c.uLight.value = light ? 1 : 0;
    post.c.uBloom.value = light ? 0 : s.id === 'ship' ? .05 : s.id === 'moon' ? .1 : s.id === 'hole' ? .14 : s.id === 'energy' ? .2 : s.id === 'scale' ? .2 : s.id === 'warp' ? .16 : s.id === 'nova' ? .12 : .22;
    post.c.uVig.value = light ? .1 : .55;
    post.c.uCA.value = light ? .002 : (s.id === 'end' || s.id === 'hole' || s.id === 'scale' || s.id === 'warp') ? 0 : .005;
    post.c.uAperture.value = s.id === 'ship' ? .34 : 0;
    scene.environmentIntensity = s.id === 'ship' ? 1 : .5;
    if (sun) sun.visible = s.id === 'ship';
    renderer.shadowMap.needsUpdate = s.id === 'ship';
    document.body.dataset.tone = light ? 'light' : 'dark';
    document.body.dataset.shot = s.id;
    if (s !== WAIT && s !== WARP && s !== NOVA) sound.scene(s.id);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const real = (now - last) / 1000, dt = clamp(real, .001, .05); last = now; T += dt;

    frames++;
    fit(now);
    camera.aspect = innerWidth / Math.max(innerHeight, 1);
    if (!params.get('q')) {
      slowRun = real > .03 && real < .2 ? slowRun + 1 : Math.max(0, slowRun - 2);
      if (!queue.length && frames > 80 && slowRun > 50 && scale > .6) { scale = Math.max(.6, scale * .84); size(); frames = 0; slowRun = 0; }
    }

    const yT = scrollY / vh() * 100;
    y += (yT - y) * (1 - Math.exp(-dt * 7));
    if (Math.abs(yT - y) > 500) y = yT;
    mxs += (mx - mxs) * (1 - Math.exp(-dt * 3)); mys += (my - mys) * (1 - Math.exp(-dt * 3));

    /* boot terminal: powers down into a line, as old monitors did */
    let shut = 0, fill = 0;
    if (bootT < 9) {
      if (scrollY > 80 && bootT < BOOT_LEN) bootT = BOOT_LEN;
      bootT += clamp(real, .001, 1);   // wall clock, so background building never slows the opening
      if (bootT < BOOT_LEN + .2) drawTerm(bootT);
      const a = sstep(BOOT_LEN, BOOT_LEN + .55, bootT), o = sstep(BOOT_LEN + .7, BOOT_LEN + 1.5, bootT);
      if (!reduced) shut = a * (1 - o);
      if (bootT >= BOOT_LEN + .6) { post.c.uCRT.value = 0; document.documentElement.classList.add('live'); }
      if (bootT > BOOT_LEN + 1.6) bootT = 99;
    }

    /* the finale takes over from scrolling once the camera crosses the horizon */
    if (cine === 'idle' && y >= TRIGGER) {
      if (reduced || yT > TRIGGER + 90) cine = 'done';
      else if (ready.nova) { cine = 'play'; cineT = 0; lockY = TRIGGER * vh() / 100; lock(true); sound.finale(JUMP, BOOM); }
    }
    if (cine === 'done' && y < 360) cine = 'idle';
    if (cine === 'play') {
      cineT += clamp(real, .001, .25);
      scrollTo(0, lockY); y = TRIGGER;
      if (cineT >= DONE) { cine = 'done'; lock(false); y = REST; scrollTo(0, REST * vh() / 100); }
    }

    const pY = clamp(y, 0, END - .01);
    const found = SHOTS.find(k => pY >= k.a && pY < k.b) || SHOTS[SHOTS.length - 1];
    const scripted = cine === 'play' ? (cineT < JUMP ? WARP : NOVA) : null;
    const s = scripted || (ready[needOf(found.id)] ? found : WAIT);
    if (s !== cur_) setShot(s);
    const u = clamp((pY - found.a) / (found.b - found.a));

    /* chapter cuts: panels in the next scene's colour close, hold on a line, then part */
    let cardV = 0, cardAt = -1;
    for (let i = 1; i < SHOTS.length; i++) {
      const at = SHOTS[i].a, p = (pY - (at - CUT / 2)) / CUT;
      if (p <= 0 || p >= 1 || (SHOTS[i].id === 'end' && !reduced)) continue;
      shut = Math.max(shut, sstep(0, .4, p) * (1 - sstep(.6, 1, p)));
      fill = LIGHT[SHOTS[i].id] || 0;
      cardV = sstep(.26, .42, p) * (1 - sstep(.58, .74, p)); cardAt = i;
      if (p > .4 && i !== cutSeen) { cutSeen = i; sound.swell(); }
    }
    if (s === WAIT) { shut = 1; fill = 0; cardV = 1; cardAt = 0; }
    post.c.uFill.value.setRGB(fill, fill, fill);
    const ln = fill > .5 ? .08 : .92;
    post.c.uLine.value.setRGB(ln, ln, ln);
    post.c.uShut.value = shut;
    if (s.id === 'end') post.c.uBloom.value = mobile ? .08 : .2;
    if (cardAt !== cardI && cardAt >= 0) {
      cardI = cardAt;
      card.firstElementChild.textContent = t(cardAt ? SHOTS[cardAt].id + 'K' : 'loading');
    }
    card.style.opacity = cardV.toFixed(3);
    card.style.color = fill > .5 ? '#0a0c10' : '#f2f4f7';

    const novaU = s === NOVA ? sstep(BOOM + .6, DONE - .6, cineT) : 0;
    const c = track(CAM[s.id], s === NOVA ? novaU : u);
    v0.set(c[0], c[1], c[2]); v1.set(c[3], c[4], c[5]);
    if (camera.aspect < .9 && (s.id === 'world' || s.id === 'order' || s.id === 'origin' || s.id === 'energy' || s.id === 'moon')) v1.x = SITE[s.id].x;
    const wordFit = s === NOVA ? lerp(1.6, 2.75, sstep(BOOM, BOOM + 1.2, cineT)) : 2.75;
    if (camera.aspect < .9) v0.sub(v1).multiplyScalar(s.id === 'moon' ? 1.5 : s.id === 'end' || s.id === 'nova' ? wordFit : 1.45).add(v1);
    if (camera.aspect < .9 && (s.id === 'end' || s.id === 'nova')) { const k = 10.5 * (s === NOVA ? novaU : 1); v0.y -= k; v1.y -= k; }
    camera.position.copy(v0);
    const dist = v0.distanceTo(v1);
    camera.position.x += mxs * dist * .012; camera.position.y -= mys * dist * .008;
    if (s === NOVA) {                    // the hard stop recoils, the blast shakes
      const a = cineT - JUMP, b = cineT - BOOM;
      camera.position.z += 3.2 * Math.exp(-Math.max(a, 0) * 7) * Math.cos(a * 16);
      const q = b > 0 ? Math.exp(-b * 2.4) * .34 : 0;
      camera.position.x += Math.sin(T * 47) * q; camera.position.y += Math.cos(T * 53) * q;
    }
    camera.lookAt(v1); camera.fov = c[6];
    camera.updateProjectionMatrix();
    stars.position.copy(camera.position);

    /* per scene */
    stars.userData.u.uTime.value = T;
    post.c.uTime.value = T % 1000;
    post.c.uBlur.value = 0;
    post.c.uExposure.value = 1;
    stars.userData.u.uAmt.value = 1;

    if (s.id === 'hero') {
      torusU.uTime.value = T; torusU.uOpen.value = sstep(.55, 1, u);
      torus.rotation.z = T * .05 + u * 1.2; torus.rotation.x = -.62 + u * .3;
    }
    if (s.id === 'order') {
      att.userData.u.uDraw.value = 1.06 * sstep(.02, .72, u) + .02;
      att.rotation.y = .55 + u * 1.3 + T * .018;
      att.rotation.x = -.08 + u * .12;
    }
    if (s.id === 'ship') {
      ship.hab.rotation.x = T * .07;
      ship.plasma.material.color.setRGB(5 + Math.sin(T * 9) * .3, 8 + Math.sin(T * 7) * .4, 15);
      const bl = Math.sin(T * 3.2) > .7 ? 1 : .001;
      ship.beacons.forEach((b, i) => { b.scale.setScalar(i % 2 ? bl : (Math.sin(T * 3.2 + 2) > .7 ? 1 : .001)); });
      post.c.uFocus.value = camera.position.distanceTo(v1);
      if (frames % 3 === 0) renderer.shadowMap.needsUpdate = true;
    }
    if (s.id === 'origin') {
      helixU.uTime.value = T; helixU.uZip.value = lerp(34, 12, sstep(.28, .9, u));
      helix.rotation.y = .3 + u * 2.4 + T * .04;
    }
    if (s.id === 'energy') {
      dyson.u.uTime.value = T;
      const b = sstep(.08, .88, u);
      dyson.u.uBuild.value = b;
      dyson.group.rotation.y = T * .022;
      dyson.group.updateMatrixWorld();
      dyson.star.update(T, camera);
      dyson.star.cu.uI.value = 1 - sstep(.5, .92, b);
      dyson.sheet.material.uniforms.uI.value = sstep(.6, 1, b);
    }
    if (s === WARP) {
      const k = cineT, sp = sstep(0, .55, k) * (1 - sstep(JUMP - .1, JUMP, k));
      warpPhase += real * (.22 + sp * 1.5);
      warpU.uPhase.value = warpPhase; warpU.uSpeed.value = sp; warpU.uAspect.value = camera.aspect; warpU.uFade.value = sstep(0, .25, k);
    }
    if (s === NOVA || s.id === 'end') {
      const k = s === NOVA ? cineT - JUMP : 99, b = s === NOVA ? cineT - BOOM : 99;
      const squeeze = sstep(1.9, 2.5, k);
      star.group.visible = b < 0;
      if (b < 0) {
        const pulse = 1 + .05 * Math.sin(k * 3.2) * sstep(1.2, 1.9, k);
        star.group.scale.setScalar(Math.max(.02, (1 + .3 * Math.exp(-k * 7)) * pulse * (1 - squeeze * squeeze * squeeze * .985)));
        star.u.uHeat.value = sstep(1.5, 2.45, k);
        star.u.uGain.value = 1 + squeeze * 1.2;
        star.cu.uPull.value = squeeze;
        star.update(T, camera);
      }
      blast.quaternion.copy(camera.quaternion);
      blastU.uT.value = s === NOVA ? Math.max(b, 0) : Math.min(5.5 + (T - doneT) * .08, 9);
      blastU.uI.value = b >= 0 ? lerp(1, .3, sstep(1.4, 3.4, b)) : 0;
      dust.visible = b >= 0;
      dustU.uAge.value = s === NOVA ? Math.max(b, 0) : 6;
      dustU.uTime.value = T;
      dustU.uBlast.value = accepted ? sstep(0, 1.7, T - acceptT) * (1 - sstep(3, 7.5, T - acceptT)) : 0;
      dustU.uGain.value = (mobile ? .62 : 1) * (1 - dustU.uBlast.value * .45);
      // one slow swell of light, never a strobe
      post.c.uExposure.value = 1 + (b >= 0 && s === NOVA ? .45 * sstep(0, .2, b) * Math.exp(-b * 1.2) : 0) + squeeze * .2 * (b < 0 ? 1 : 0);
      stars.userData.u.uAmt.value = b < 0 ? 1 - squeeze * .7 : .3 + .7 * clamp(s === NOVA ? b / 3 : 1);
    }
    if (s.id === 'end') { if (lastShotEnd !== true) { doneT = T; lastShotEnd = true; } } else lastShotEnd = false;
    if (s.id === 'hole') {
      const fall = sstep(.6, 1, u);
      holeU.uTime.value = T + u * 30;
      holeU.uFall.value = fall;
      hole.ringU.uI.value = 1 - sstep(.86, .96, u);
      hole.ring.quaternion.copy(camera.quaternion);
      holeU.uGain.value = (mobile ? 1.5 : 1) * (1 - sstep(.9, .985, u));
    }
    if (s.id === 'scale') {
      galaxy.rotation.y = -.5 - u * .5 - T * .006;
      galaxy.userData.u.uGain.value = lerp(.5, 1, sstep(.1, .5, u));
    }
    if (s.id === 'world') {
      planetU.uTime.value = T; planetU.uMorph.value = sstep(.1, .78, u);
      planet.rotation.y = T * .05 + u * .5;
      world.world.children[1].rotation.y = -T * .02;
    }
    if (s.id === 'moon') {
      // the sun swings behind the disc: half moon, crescent, then a diamond ring
      const a = lerp(.95, 3.02, sstep(.02, .84, u));
      sunW.set(-Math.sin(a), .14, Math.cos(a)).normalize();
      moonU.uI.value = 1;
      moon.rotation.y = 2.3 + u * .22;
      moon.rotation.x = .12;
      moonU.uSun.value.copy(sunW).applyQuaternion(qInv.copy(moon.quaternion).invert());
      const ring = sstep(.62, .9, u);
      corona.material.uniforms.uI.value = ring;
      corona.material.uniforms.uA.value = 2.72;
      corona.material.uniforms.uB.value = sstep(.82, .95, u) * .7;
      corona.quaternion.copy(camera.quaternion);
      stars.userData.u.uAmt.value = .5 + ring * .7;
    }

    /* HUD */
    const bootV = bootT > 9 ? 1 : sstep(BOOT_LEN + .6, BOOT_LEN + 1.3, bootT);
    for (const b of beats) {
      const up = sstep(b.a, b.a + b.f, pY), out = 1 - sstep(b.b - b.f, b.b, pY);
      const v = Math.round(up * out * bootV * (s === WAIT || cine === 'play' ? 0 : 1) * 200) / 200;
      if (v === b.v) continue;
      b.v = v;
      b.el.style.opacity = v;
      b.el.style.visibility = v > .004 ? 'visible' : 'hidden';
      b.el.style.pointerEvents = v > .6 ? 'auto' : 'none';
      b.el.style.transform = `translate3d(0,${(1 - up) * 20 - (1 - out) * 20}px,0)`;
    }
    // first slide: always invite the scroll. Later: only after five quiet seconds
    if (Math.abs(yT - lastY) > .5) { lastY = yT; idleAt = now; }
    const want = bootV >= 1 && s !== WAIT && cine !== 'play' && shut < .02 && pY < 405 && (pY < 30 || now - idleAt > 5000);
    if (want !== nudged) { nudged = want; nudge.classList.toggle('show', want); }
    for (const l of labels) {
      const v = s.id === l.shot && pY > l.a && pY < l.b;
      if (!v) { if (l.on !== 0) { l.el.style.opacity = 0; l.on = 0; } continue; }
      const here = l.anchor === 'here';
      tmp.copy(here ? HERE : ship.anchors[l.anchor]).applyMatrix4((here ? galaxy : ship.group).matrixWorld).project(camera);
      const px = (tmp.x * .5 + .5) * innerWidth, py = (-tmp.y * .5 + .5) * innerHeight;
      if (tmp.z > 1) continue;
      l.on = 1; l.el.style.opacity = 1;
      l.el.style.transform = `translate3d(${px | 0}px,${py | 0}px,0)`;
    }

    post.render(scene, camera);
  }

  if (params.has('debug')) window.__ax = { ready, finale() { return { cine, cineT }; }, jump(v) { y = v; scrollTo(0, v * vh() / 100); }, get state() { return { shot: cur_?.id, scale, programs: renderer.info.programs.length }; } };
  drawTerm(0);
  requestAnimationFrame(frame);
  setTimeout(buildAll, 60);
}

boot();
