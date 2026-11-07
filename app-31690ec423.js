import * as THREE from 'three';

// --- lib.js


const asset = p => (window.__ASSETS && window.__ASSETS[p]) || p;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

const texLoader = new THREE.TextureLoader();
function tex(path, { srgb = false, repeat = false, aniso = 8, flip = true } = {}) {
  return new Promise((res, rej) => texLoader.load(asset(path), t => {
    t.flipY = flip;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    res(t);
  }, undefined, rej));
}

/** Compact mesh container written by tools/prep_assets.py */
async function loadMesh(path) {
  const buf = await (await fetch(asset(path))).arrayBuffer();
  const [nv, ni] = new Uint32Array(buf, 0, 2);
  const ib = new THREE.InterleavedBuffer(new Float32Array(buf, 8, nv * 8), 8);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.InterleavedBufferAttribute(ib, 3, 0));
  g.setAttribute('normal', new THREE.InterleavedBufferAttribute(ib, 3, 3));
  g.setAttribute('uv', new THREE.InterleavedBufferAttribute(ib, 2, 6));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(buf, 8 + nv * 32, ni), 1));
  return g;
}

/** Concatenates indexed geometries that share position/normal/uv. */
function merge(list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), I = new Uint32Array(ni);
  let v = 0, i = 0;
  for (const g of list) {
    P.set(g.attributes.position.array, v * 3);
    N.set(g.attributes.normal.array, v * 3);
    U.set(g.attributes.uv.array, v * 2);
    const idx = g.index.array;
    for (let k = 0; k < idx.length; k++) I[i + k] = idx[k] + v;
    v += g.attributes.position.count; i += idx.length;
  }
  const o = new THREE.BufferGeometry();
  o.setAttribute('position', new THREE.BufferAttribute(P, 3));
  o.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  o.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  o.setIndex(new THREE.BufferAttribute(I, 1));
  return o;
}

/** Catmull-Rom through keyframes [u, ...values] */
function track(keys, u) {
  const n = keys.length;
  if (u <= keys[0][0]) return keys[0].slice(1);
  if (u >= keys[n - 1][0]) return keys[n - 1].slice(1);
  let i = 0;
  while (i < n - 2 && u > keys[i + 1][0]) i++;
  const a = keys[Math.max(i - 1, 0)], b = keys[i], c = keys[i + 1], d = keys[Math.min(i + 2, n - 1)];
  const t = (u - b[0]) / (c[0] - b[0]), t2 = t * t, t3 = t2 * t;
  const out = [];
  for (let k = 1; k < b.length; k++)
    out.push(.5 * (2 * b[k] + (c[k] - a[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2 + (3 * b[k] - a[k] - 3 * c[k] + d[k]) * t3));
  return out;
}

const NOISE_GLSL = /* glsl */`
float hash12(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x),mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<6;i++){ s+=a*vnoise(p); p=m*p+7.1; a*=.5; } return s; }
`;

/** Shared low-frequency sway so bark, leaves and fruit move together. */
const SWAY_GLSL = /* glsl */`
uniform float uTime; uniform float uWind;
vec3 sway(vec3 wp, float reach){
  float t=uTime*.9; float k=reach*reach;
  vec3 d=vec3(sin(t+wp.x*.35+wp.y*.2)+.5*sin(t*2.3+wp.z*.6), .3*sin(t*1.7+wp.x), cos(t*.8+wp.z*.4)+.5*sin(t*1.9+wp.y*.7));
  return d*k*.045*uWind;
}
`;


// --- i18n.js
/** Every word on the page, in both languages. */
const DICT = {
  en: {
    title: 'Axioma — websites people remember', desc: 'Axioma designs and builds websites people remember. Send your request and get a site made for your business.',
    backToStart: 'Axioma, back to start', music: 'Music', musicOn: 'Music on', language: 'Switch language', nudge: 'Scroll', loading: 'Loading',
    heroSub: 'We build websites people remember.',
    orderK: 'Structure', orderH: 'From a chaos of ideas to a clear structure.', orderT: 'You bring the task. We shape it into a site: pages, meaning and a clear path from the first screen to the request.',
    shipK: 'Engineering', shipH: 'Your website is a machine.', shipT: 'Every part does a job: pages that load fast, clean code and steady work on any device.',
    originK: 'Identity', originH: 'Every business has its own DNA.', originT: 'No templates. The design grows out of your brand, so nobody else will have a site like yours.',
    energyK: 'Conversion', energyH: 'Visitors are energy.', energyT: 'Ads bring people in, and the site turns them into requests. Every block gathers attention the way these panels gather starlight.',
    holeK: 'Attention', holeH: 'A site people can’t pull away from.', holeT: 'Gravity works online too. A strong first screen draws the visitor in and keeps them to the end.',
    scaleK: 'Visibility', scaleH: 'Over a billion websites. Yours gets noticed.', scaleT: 'Search optimisation, speed and a memorable look set you apart from everyone else in your niche.',
    worldK: 'Adaptive', worldH: 'One site, any shape.', worldT: 'It reshapes itself for a phone, a tablet or a desktop. The form changes, the quality stays.',
    moonK: 'Support', moonH: 'We stay after launch.', moonT: 'Silence after launch\nmeans everything just works.',
    endK: 'Axioma',
    formH: 'Your website request', name: 'Name', phone: 'Phone', email: 'Email', wish: 'Wishes for your site (optional)', send: 'Send request',
    errName: 'Enter your name', errPhone: 'Enter a valid phone number', errEmail: 'Enter a valid email', errSend: 'Something went wrong. Please try again.',
    after: 'Request sent. We’ll be in touch, {name}.', foot: 'Every scene and every note is generated in real time',
    tagA: 'Speed', tagAs: 'Pages load without the wait', tagB: 'Adaptive', tagBs: 'Phone, tablet, desktop', tagC: 'SEO', tagCs: 'Search brings clients to you', tagH: 'Your website', tagHs: 'One in a billion',
    noJs: 'This site needs JavaScript and WebGL2.', noGl: 'This browser can’t run WebGL2, which Axioma needs. Try a different browser.',
  },
  ru: {
    title: 'Axioma — сайты, которые запоминают', desc: 'Axioma проектирует и создаёт запоминающиеся сайты. Отправьте запрос и получите сайт, сделанный под ваш бизнес.',
    backToStart: 'Axioma, в начало', music: 'Музыка', musicOn: 'Музыка вкл', language: 'Сменить язык', nudge: 'Листайте', loading: 'Загрузка',
    heroSub: 'Мы создаём сайты, которые запоминают.',
    orderK: 'Структура', orderH: 'Из хаоса идей — чёткая структура.', orderT: 'Вы приносите задачу, мы превращаем её в сайт: страницы, смыслы и понятный путь от первого экрана до заявки.',
    shipK: 'Разработка', shipH: 'Ваш сайт — это машина.', shipT: 'Каждая деталь работает на результат: быстрая загрузка, чистый код и стабильная работа на любом устройстве.',
    originK: 'Айдентика', originH: 'У каждого бизнеса своя ДНК.', originT: 'Никаких шаблонов. Дизайн вырастает из вашего бренда, поэтому такого сайта не будет больше ни у кого.',
    energyK: 'Конверсия', energyH: 'Посетители — это энергия.', energyT: 'Реклама приводит людей, а сайт превращает их в заявки. Каждый блок собирает внимание, как эти панели собирают свет звезды.',
    holeK: 'Внимание', holeH: 'Сайт, от которого не оторваться.', holeT: 'Гравитация работает и в интернете. Сильный первый экран притягивает посетителя и удерживает его до конца.',
    scaleK: 'Заметность', scaleH: 'Больше миллиарда сайтов. Заметят ваш.', scaleT: 'Поисковое продвижение, скорость и запоминающийся образ выделяют вас среди всех в вашей нише.',
    worldK: 'Адаптивность', worldH: 'Один сайт, любая форма.', worldT: 'Он подстраивается под телефон, планшет и компьютер. Форма меняется, качество остаётся.',
    moonK: 'Поддержка', moonH: 'Мы остаёмся и после запуска.', moonT: 'Тишина после запуска\nзначит, что всё работает.',
    endK: 'Axioma',
    formH: 'Ваш запрос на создание сайта', name: 'Имя', phone: 'Телефон', email: 'Почта', wish: 'Пожелания к сайту (необязательно)', send: 'Отправить запрос',
    errName: 'Введите имя', errPhone: 'Введите корректный номер', errEmail: 'Введите корректную почту', errSend: 'Что-то пошло не так. Попробуйте ещё раз.',
    after: 'Запрос отправлен. Мы свяжемся с вами, {name}.', foot: 'Каждая сцена и каждая нота создаются в реальном времени',
    tagA: 'Скорость', tagAs: 'Страницы без ожидания', tagB: 'Адаптив', tagBs: 'Телефон, планшет, компьютер', tagC: 'SEO', tagCs: 'Клиенты находят вас в поиске', tagH: 'Ваш сайт', tagHs: 'Один на миллиард',
    noJs: 'Для этого сайта нужны JavaScript и WebGL2.', noGl: 'Этот браузер не поддерживает WebGL2. Попробуйте другой браузер.',
  },
};

const stored = () => { try { return localStorage.getItem('axioma-lang'); } catch { return null; } };
let lang = stored() || (/^(ru|uk|be|kk)/i.test(navigator.language || '') ? 'ru' : 'en');
const listeners = [];

const t = k => DICT[lang][k] ?? k;
const onLang = fn => listeners.push(fn);

function applyLang() {
  const root = document.documentElement;
  root.lang = lang;
  document.title = t('title');
  document.querySelector('meta[name=description]').content = t('desc');
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
  for (const el of document.querySelectorAll('[data-t-label]')) el.setAttribute('aria-label', t(el.dataset.tLabel));
  for (const b of document.querySelectorAll('#lang b')) b.classList.toggle('on', b.dataset.l === lang);
  listeners.forEach(fn => fn());
}

function toggleLang() {
  lang = lang === 'en' ? 'ru' : 'en';
  try { localStorage.setItem('axioma-lang', lang); } catch { /* private mode: the choice lasts for this visit */ }
  applyLang();
}


// --- post.js



const FST = new THREE.BufferGeometry();
FST.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
FST.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));

const VS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;

const down = /* glsl */`
precision highp float; varying vec2 vUv; uniform sampler2D t; uniform vec2 px;
void main(){
  vec3 c=texture2D(t,vUv).rgb*4.;
  c+=texture2D(t,vUv+px*vec2(-1,-1)).rgb+texture2D(t,vUv+px*vec2(1,-1)).rgb+texture2D(t,vUv+px*vec2(-1,1)).rgb+texture2D(t,vUv+px*vec2(1,1)).rgb;
  gl_FragColor=vec4(clamp(c/8.,vec3(0.),vec3(24.)),1.);
}`;
const up = /* glsl */`
precision highp float; varying vec2 vUv; uniform sampler2D t; uniform sampler2D tBase; uniform vec2 px;
void main(){
  vec3 c=texture2D(t,vUv+vec2(-2,0)*px).rgb+texture2D(t,vUv+vec2(2,0)*px).rgb+texture2D(t,vUv+vec2(0,-2)*px).rgb+texture2D(t,vUv+vec2(0,2)*px).rgb;
  c+=2.*(texture2D(t,vUv+vec2(-1,1)*px).rgb+texture2D(t,vUv+vec2(1,1)*px).rgb+texture2D(t,vUv+vec2(-1,-1)*px).rgb+texture2D(t,vUv+vec2(1,-1)*px).rgb);
  gl_FragColor=vec4(mix(texture2D(tBase,vUv).rgb,c/12.,.7),1.);
}`;

const comp = /* glsl */`
precision highp float; varying vec2 vUv;
uniform sampler2D tC,tD,t1,t2,t3,t4,tCRT;
uniform vec2 uRes; uniform float uTime,uBlur,uFocus,uAperture,uNear,uFar,uExposure,uBloom,uLight;
uniform float uShut,uCRT,uVig,uCA; uniform vec3 uFill,uLine;
${NOISE_GLSL}
vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
float linDepth(float z){ float n=z*2.-1.; return 2.*uNear*uFar/(uFar+uNear-n*(uFar-uNear)); }
vec2 barrel(vec2 uv,float k){ vec2 c=uv*2.-1.; c*=1.+dot(c,c)*k; return c*.5+.5; }

vec3 scene(vec2 uv){
  vec2 cc=uv-.5; float r2=dot(cc,cc);
  float ca=uCA*(.35+r2*2.2);
  vec3 s=vec3(texture2D(tC,uv-cc*ca).r,texture2D(tC,uv).g,texture2D(tC,uv+cc*ca).b);
  float z=texture2D(tD,uv).r; float d=linDepth(z);
  float coc=0.;
  if(z<.99999){ float q=(d-uFocus)/d; coc=q<0.?min(-q*uAperture*1.9,1.):min(q*uAperture,.5); }
  coc=clamp(coc+uBlur,0.,1.);
  vec3 b1=texture2D(t1,uv).rgb,b2=texture2D(t2,uv).rgb,b3=texture2D(t3,uv).rgb,b4=texture2D(t4,uv).rgb;
  float l=coc*4.;
  vec3 c=mix(s,b1,clamp(l,0.,1.)); c=mix(c,b2,clamp(l-1.,0.,1.)); c=mix(c,b3,clamp(l-2.,0.,1.)); c=mix(c,b4,clamp(l-3.,0.,1.));
  c+=(b2*.42+b3*.33+b4*.25)*uBloom;
  return c;
}

void main(){
  vec2 uv=vUv;
  vec3 c=scene(uv)*uExposure;
  float r2=dot(vUv-.5,vUv-.5);
  if(uLight<.5) c=aces(c); else c=clamp(c,0.,1.);
  c=mix(c,c*c*(3.-2.*c),.16*(1.-uLight));
  c*=1.-uVig*smoothstep(.1,.85,r2*2.);
  c=pow(max(c,vec3(0.)),vec3(1./2.2));

  // cathode ray terminal, used by the boot sequence
  if(uCRT>.001){
    vec2 q=barrel(vUv,.075);
    vec3 crt=vec3(0.);
    if(q.x>0.&&q.x<1.&&q.y>0.&&q.y<1.){
      vec3 t=texture2D(tCRT,q+vec2(sin(q.y*90.+uTime*3.)*.00045,0.)).rgb;
      vec3 g=texture2D(tCRT,q+vec2(.0035,0.)).rgb*.4+texture2D(tCRT,q-vec2(.0035,0.)).rgb*.4;
      crt=(t+g*.55)*vec3(.72,1.,.8);
      crt+=vec3(.012,.034,.024);
      float sl=.72+.28*sin(q.y*uRes.y*1.05);
      crt*=sl;
      crt*=1.+.08*sin(q.y*7.-uTime*2.6);
      vec2 e=q*(1.-q); crt*=pow(clamp(e.x*e.y*26.,0.,1.),.42);
    }
    c=mix(c,crt,uCRT);
  }
  // shutter: the frame closes into a hairline, then opens on the next scene
  if(uShut>.0005){
    float px=1./uRes.y, h=(1.-uShut)*.5, d=abs(vUv.y-.5);
    float m=smoothstep(h-px*.8,h+px*.8,d);
    c=mix(c,uFill,m);
    float L=exp(-pow((d-h)/(px*.85),2.))*smoothstep(0.,.06,uShut);
    c=mix(c,uLine,L*.9);
  }
  float g=hash12(gl_FragCoord.xy+fract(uTime)*417.)-.5;
  c+=g*(uLight>.5?.012:.026);
  gl_FragColor=vec4(c,1.);
}`;

class Post {
  constructor(renderer, { samples }) {
    this.r = renderer; this.samples = samples;
    this.scene = new THREE.Scene(); this.cam = new THREE.Camera();
    this.quad = new THREE.Mesh(FST, null); this.quad.frustumCulled = false; this.scene.add(this.quad);
    const ms = (fs, u) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false });
    this.mDown = ms(down, { t: { value: null }, px: { value: new THREE.Vector2() } });
    this.mUp = ms(up, { t: { value: null }, tBase: { value: null }, px: { value: new THREE.Vector2() } });
    this.c = {
      tC: { value: null }, tD: { value: null }, t1: { value: null }, t2: { value: null }, t3: { value: null }, t4: { value: null }, tCRT: { value: null },
      uRes: { value: new THREE.Vector2() }, uTime: { value: 0 }, uBlur: { value: 0 }, uFocus: { value: 6 }, uAperture: { value: 0 },
      uNear: { value: .1 }, uFar: { value: 3000 }, uExposure: { value: 1 }, uBloom: { value: .3 }, uLight: { value: 0 },
      uShut: { value: 0 }, uFill: { value: new THREE.Color(0, 0, 0) }, uLine: { value: new THREE.Color(1, 1, 1) }, uCRT: { value: 0 }, uVig: { value: .5 }, uCA: { value: .006 },
    };
    this.mComp = ms(comp, this.c);
    this.setSize(2, 2);
  }

  setSize(w, h) {
    this.dispose();
    const P = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.main = new THREE.WebGLRenderTarget(w, h, { ...P, depthBuffer: true, samples: this.samples, depthTexture: new THREE.DepthTexture(w, h, THREE.UnsignedIntType) });
    this.main.depthTexture.minFilter = this.main.depthTexture.magFilter = THREE.NearestFilter;
    this.downs = []; this.ups = [];
    let a = w, b = h;
    for (let i = 0; i < 5; i++) {
      a = Math.max(2, a >> 1); b = Math.max(2, b >> 1);
      this.downs.push(new THREE.WebGLRenderTarget(a, b, P));
      if (i < 4) this.ups.push(new THREE.WebGLRenderTarget(a, b, P));
    }
    this.c.uRes.value.set(w, h);
  }

  dispose() {
    for (const t of [this.main, ...(this.downs || []), ...(this.ups || [])]) if (t) { t.depthTexture?.dispose(); t.dispose(); }
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.scene, this.cam);
  }

  render(scene, camera) {
    const r = this.r;
    r.setRenderTarget(this.main); r.clear(); r.render(scene, camera);
    let src = this.main.texture;
    for (const d of this.downs) {
      this.mDown.uniforms.t.value = src;
      this.mDown.uniforms.px.value.set(1 / d.width, 1 / d.height);
      this.pass(this.mDown, d); src = d.texture;
    }
    for (let i = this.ups.length - 1; i >= 0; i--) {
      this.mUp.uniforms.t.value = src;
      this.mUp.uniforms.tBase.value = this.downs[i].texture;
      this.mUp.uniforms.px.value.set(.5 / this.ups[i].width, .5 / this.ups[i].height);
      this.pass(this.mUp, this.ups[i]); src = this.ups[i].texture;
    }
    const c = this.c;
    c.tC.value = this.main.texture; c.tD.value = this.main.depthTexture;
    c.t1.value = this.ups[0].texture; c.t2.value = this.ups[1].texture; c.t3.value = this.ups[2].texture; c.t4.value = this.ups[3].texture;
    c.uNear.value = camera.near; c.uFar.value = camera.far;
    this.pass(this.mComp, null);
  }
}


// --- lines.js



const FILM = /* glsl */`
vec3 film(float t){ return .5+.5*cos(6.28318*(vec3(1.,.92,.85)*t+vec3(.02,.36,.66))); }
`;

/** Thousands of hair-thin lines wound around a torus; shape and colour live in the shader. */
function buildTorus(lines, segs) {
  const n = lines * segs * 2;
  const A = new Float32Array(n * 2);
  let i = 0;
  for (let l = 0; l < lines; l++) for (let s = 0; s < segs; s++) {
    const u0 = s / segs, u1 = (s + 1) / segs, k = l / lines;
    A[i++] = u0; A[i++] = k; A[i++] = u1; A[i++] = k;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aUV', new THREE.BufferAttribute(A, 2));
  const u = { uTime: { value: 0 }, uOpen: { value: 0 }, uGain: { value: 1 } };
  const m = new THREE.LineSegments(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: u,
    vertexShader: /* glsl */`
      attribute vec2 aUV; uniform float uTime,uOpen; varying vec3 vC; varying float vA;
      ${FILM}
      void main(){
        float u=aUV.x*6.2831853, k=aUV.y;
        float wind=3.; // the bundle turns on itself as it goes around
        float ph=k*6.2831853+u*wind+uTime*.09;
        float R=3.+.12*sin(u*3.+uTime*.3), r=1.32+.1*sin(u*5.-uTime*.4+k*6.28)+.05*sin(ph*3.);
        r*=1.+uOpen*(.35+.3*sin(k*50.+uTime));
        vec3 c=vec3(cos(u),sin(u),0.);
        vec3 n=normalize(c*cos(ph)+vec3(0,0,1)*sin(ph));
        vec3 p=c*R+n*r;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        vec3 N=normalize(normalMatrix*n), V=normalize(-mv.xyz);
        float f=dot(N,V);
        float pulse=pow(fract(aUV.x*5.-uTime*.11+fract(k*37.3)),12.);
        vC=film(f*.9+aUV.x*1.6+k*.5+uTime*.015)*(.52+1.9*pulse)+vec3(.9,.95,1.)*pow(1.-abs(f),5.)*.55;
        vA=(.17+.55*pow(1.-abs(f),2.))*(f>0.?1.:.3);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `uniform float uGain; varying vec3 vC; varying float vA; void main(){ gl_FragColor=vec4(vC*vA*uGain,vA); }`,
  }));
  m.frustumCulled = false;
  m.userData.u = u;
  return m;
}

/** Lorenz system: many short runs, so the butterfly reads as a woven surface of lines. */
function buildAttractor(runs, steps) {
  const R = rng(3), n = runs * steps * 2;
  const P = new Float32Array(n * 3), D = new Float32Array(n * 2);
  const s = 10, r = 28, b = 8 / 3, dt = .0052;
  let i = 0, j = 0;
  let x = 1, y = 1, z = 25;
  for (let k = 0; k < 4000; k++) { const dx = s * (y - x), dy = x * (r - z) - y, dz = x * y - b * z; x += dx * dt; y += dy * dt; z += dz * dt; }
  for (let a = 0; a < runs; a++) {
    for (let k = 0; k < 60 + R() * 90; k++) { const dx = s * (y - x), dy = x * (r - z) - y, dz = x * y - b * z; x += dx * dt; y += dy * dt; z += dz * dt; }
    let px = x + (R() - .5) * .9, py = y + (R() - .5) * .9, pz = z + (R() - .5) * .9;
    for (let k = 0; k < steps; k++) {
      const dx = s * (py - px), dy = px * (r - pz) - py, dz = px * py - b * pz;
      const qx = px + dx * dt, qy = py + dy * dt, qz = pz + dz * dt;
      P[i++] = px; P[i++] = pz - 25; P[i++] = py; P[i++] = qx; P[i++] = qz - 25; P[i++] = qy;
      const t = k / steps, sp = Math.min(1, Math.hypot(dx, dy, dz) / 190);
      D[j++] = (a + R()) / runs; D[j++] = sp; D[j++] = (a + R()) / runs; D[j++] = sp;
      px = qx; py = qy; pz = qz;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('aD', new THREE.BufferAttribute(D, 2));
  const u = { uDraw: { value: 1 }, uTime: { value: 0 } };
  const m = new THREE.LineSegments(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: u,
    vertexShader: /* glsl */`
      attribute vec2 aD; uniform float uDraw,uTime; varying vec3 vC; varying float vA;
      ${FILM}
      void main(){
        vec4 mv=modelViewMatrix*vec4(position,1.);
        vec3 f=film(aD.y*1.25+position.y*.012+position.x*.016+.1);
        vC=mix(f*.86,vec3(.03,.04,.07),.25+.5*(1.-aD.y));
        vA=(1.-smoothstep(uDraw-.05,uDraw,aD.x))*(.1+.5*aD.y);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ if(vA<.004) discard; gl_FragColor=vec4(vC,vA); }`,
  }));
  m.frustumCulled = false;
  m.userData.u = u;
  return m;
}

function buildStars(n, seed = 1) {
  const R = rng(seed), P = new Float32Array(n * 3), C = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const z = R() * 2 - 1, a = R() * 6.2832, s = Math.sqrt(1 - z * z);
    P[i * 3] = s * Math.cos(a) * 1500; P[i * 3 + 1] = z * 1500; P[i * 3 + 2] = s * Math.sin(a) * 1500;
    C[i * 2] = Math.pow(R(), 9) * 3 + .7; C[i * 2 + 1] = R();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('aS', new THREE.BufferAttribute(C, 2));
  const u = { uTime: { value: 0 }, uPx: { value: 1 }, uAmt: { value: 1 } };
  const m = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: u,
    vertexShader: `attribute vec2 aS; uniform float uTime,uPx; varying vec3 vC;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=aS.x*uPx; float t=.75+.25*sin(uTime*(.4+aS.y*2.)+aS.y*50.);
        vC=mix(vec3(.8,.87,1.),vec3(1.,.88,.74),aS.y)*t*(.3+aS.x*.55); }`,
    fragmentShader: `uniform float uAmt; varying vec3 vC; void main(){ float r=length(gl_PointCoord-.5)*2.; gl_FragColor=vec4(vC*smoothstep(1.,.1,r)*uAmt,1.); }`,
  }));
  m.frustumCulled = false; m.renderOrder = -5;
  m.userData.u = u;
  return m;
}


// --- ship.js



/** Canvas-made surface detail: hull plating, crumpled foil, solar cells. */
function canvasTex(size, draw, repeat = [1, 1], srgb = false) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function plating(x, s) {
  const R = rng(8);
  x.fillStyle = '#808080'; x.fillRect(0, 0, s, s);
  const split = (a, b, w, h, d) => {
    if (d > 0 && (w > s / 16 || R() < .5)) {
      if (w > h) { const k = w * (.3 + R() * .4); split(a, b, k, h, d - 1); split(a + k, b, w - k, h, d - 1); }
      else { const k = h * (.3 + R() * .4); split(a, b, w, k, d - 1); split(a, b + k, w, h - k, d - 1); }
      return;
    }
    const v = 118 + R() * 26 | 0;
    x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(a, b, w, h);
    x.strokeStyle = '#141414'; x.lineWidth = 2.4; x.strokeRect(a + .5, b + .5, w, h);
    if (w > 40 && h > 40) {
      x.fillStyle = '#3a3a3a';
      for (const [p, q] of [[a + 7, b + 7], [a + w - 7, b + 7], [a + 7, b + h - 7], [a + w - 7, b + h - 7]]) { x.beginPath(); x.arc(p, q, 1.8, 0, 7); x.fill(); }
    }
  };
  split(0, 0, s, s, 7);
}

function foil(x, s) {
  const R = rng(4);
  x.fillStyle = '#7a7a7a'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    const a = R() * s, b = R() * s, l = 10 + R() * 70, an = R() * 6.28, v = 90 + R() * 80 | 0;
    x.fillStyle = `rgba(${v},${v},${v},.5)`;
    x.beginPath(); x.moveTo(a, b); x.lineTo(a + Math.cos(an) * l, b + Math.sin(an) * l); x.lineTo(a + Math.cos(an + 1) * l * .7, b + Math.sin(an + 1) * l * .7); x.fill();
  }
}

function solar(x, s) {
  x.fillStyle = '#04081a'; x.fillRect(0, 0, s, s);
  const n = 8, c = s / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const g = x.createLinearGradient(i * c, j * c, (i + 1) * c, (j + 1) * c);
    g.addColorStop(0, '#0a1b44'); g.addColorStop(1, '#16307a');
    x.fillStyle = g; x.fillRect(i * c + 2, j * c + 2, c - 4, c - 4);
    x.strokeStyle = 'rgba(190,210,255,.28)'; x.lineWidth = 1;
    for (let k = 1; k < 6; k++) { x.beginPath(); x.moveTo(i * c + 2, j * c + k * c / 6); x.lineTo(i * c + c - 2, j * c + k * c / 6); x.stroke(); }
  }
}

const Y2X = new THREE.Matrix4().makeRotationZ(-Math.PI / 2);
const seg = (r0, x0, r1, x1, sides = 72) => {
  const g = new THREE.LatheGeometry([new THREE.Vector2(r0, x0), new THREE.Vector2(r1, x1)], sides);
  g.applyMatrix4(Y2X);
  return g;
};
const hull = (pts, sides) => pts.slice(1).map((p, i) => seg(pts[i][0], pts[i][1], p[0], p[1], sides));
const box = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
const put = (g, m) => { g.applyMatrix4(m); return g; };

function strutMatrix(a, b, r) {
  const d = new THREE.Vector3().subVectors(b, a), l = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return new THREE.Matrix4().compose(a.clone().addScaledVector(d, .5), q, new THREE.Vector3(r, l, r));
}

function buildShip(detail = 1) {
  const R = rng(61), group = new THREE.Group();
  const plate = canvasTex(1024, plating, [1, 3]);
  const plate2 = canvasTex(1024, plating, [3, 1]);
  const crumple = canvasTex(1024, foil, [3, 2]);
  const cells = canvasTex(1024, solar, [6, 1], true);

  const M = {
    chrome: new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 1, roughness: .2, bumpMap: plate, bumpScale: 1.1, side: THREE.DoubleSide }),
    steel: new THREE.MeshStandardMaterial({ color: 0xa6abb3, metalness: 1, roughness: .34 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x16181d, metalness: .75, roughness: .42, bumpMap: plate2, bumpScale: .7 }),
    white: new THREE.MeshStandardMaterial({ color: 0xa9aaa8, metalness: .05, roughness: .46, bumpMap: plate2, bumpScale: .8 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe0a93d, metalness: 1, roughness: .28, bumpMap: crumple, bumpScale: 1.6 }),
    solar: new THREE.MeshStandardMaterial({ map: cells, metalness: .85, roughness: .22 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0a0d12, metalness: 1, roughness: .05 }),
  };
  const P = { chrome: [], steel: [], dark: [], white: [], gold: [] };

  // ---- spine, stern to bow
  const profile = [[.001, -6], [2.2, -6], [2.45, -5.75], [2.45, -2.2], [2.8, -2], [2.8, -1.1], [2.45, -.9], [2.45, 3], [3.0, 3.2], [3.0, 4.1], [2.2, 4.6], [2.2, 8.2], [1.65, 9], [1.2, 9.1], [1.2, 11.6], [.92, 11.8], [.92, 13.2], [.001, 13.4]];
  P.chrome.push(...hull(profile));
  const rOf = x => { for (let i = 1; i < profile.length; i++) if (x <= profile[i][1]) { const a = profile[i - 1], b = profile[i], t = (x - a[1]) / Math.max(b[1] - a[1], 1e-4); return lerp(a[0], b[0], t); } return .9; };

  for (const x of [-5.4, -3.6, -2.6, .1, 1.3, 2.4, 5.2, 6.4, 7.6, 10.2, 12.4]) {
    const r = rOf(x) + .03;
    P.dark.push(...hull([[r - .02, x - .09], [r + .05, x - .07], [r + .05, x + .07], [r - .02, x + .09]]));
  }

  // service pipes along the hull, with clamps
  const pipes = [];
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * 6.283 + .12, x0 = -5.6 + R() * 2, x1 = 7.5 - R() * 3;
    const r0 = 2.45 + .11;
    pipes.push(strutMatrix(new THREE.Vector3(x0, Math.cos(a) * r0, Math.sin(a) * r0), new THREE.Vector3(Math.min(x1, 2.8), Math.cos(a) * r0, Math.sin(a) * r0), .045 + R() * .03));
  }

  // ---- reactor: tokamak ring with field coils and a plasma core
  const rx = -15.4, RT = 5.1;
  const ring = new THREE.TorusGeometry(RT, 1.05, 32, 128); ring.rotateY(Math.PI / 2); ring.translate(rx, 0, 0);
  P.chrome.push(ring);
  const coils = [];
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * 6.283;
    coils.push(new THREE.Matrix4().compose(new THREE.Vector3(rx, Math.cos(a) * RT, Math.sin(a) * RT), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -a), new THREE.Vector3(1, 1, 1)));
  }
  const coilG = new THREE.TorusGeometry(1.32, .17, 12, 48); coilG.rotateX(Math.PI / 2);
  const coilMesh = new THREE.InstancedMesh(coilG, M.gold, coils.length); coils.forEach((m, i) => coilMesh.setMatrixAt(i, m));
  const plasma = new THREE.Mesh(new THREE.TorusGeometry(RT, .2, 12, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 9, 16) }));
  plasma.rotation.y = Math.PI / 2; plasma.position.x = rx;
  const gap = new THREE.TorusGeometry(RT, 1.09, 8, 128, 6.283); gap.rotateY(Math.PI / 2); gap.translate(rx, 0, 0);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * 6.283 + .785;
    P.steel.push(put(new THREE.CylinderGeometry(.3, .3, 1, 16), strutMatrix(new THREE.Vector3(rx, 0, 0), new THREE.Vector3(rx, Math.cos(a) * (RT - .8), Math.sin(a) * (RT - .8)), 1)));
  }
  P.dark.push(...hull([[1.5, rx - 1.2], [1.5, rx + 1.2]]));

  // ---- engines
  const ex = -22.2;
  for (const [y, z] of [[0, 0], [2.7, 0], [-1.35, 2.34], [-1.35, -2.34]]) {
    const pts = []; for (let i = 0; i <= 18; i++) { const t = i / 18; pts.push(new THREE.Vector2(.46 + 1.08 * Math.pow(t, 1.7), -t * 3.1)); }
    const b = new THREE.LatheGeometry(pts, 48); b.applyMatrix4(Y2X); b.translate(ex + 3.1 - 3.1, y, z); b.scale(1, 1, 1);
    const b2 = b.clone(); b2.translate(1.0, 0, 0);
    P.chrome.push(b2);
    P.steel.push(put(new THREE.CylinderGeometry(.5, .75, 1.3, 24), new THREE.Matrix4().makeRotationZ(-Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(ex + 1.5, y, z))));
  }
  const glow = new THREE.Group();
  for (const [y, z] of [[0, 0], [2.7, 0], [-1.35, 2.34], [-1.35, -2.34]]) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(1.42, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(.8, 1.9, 5), side: THREE.DoubleSide }));
    d.rotation.y = Math.PI / 2; d.position.set(ex - 1.3, y, z); glow.add(d);
  }

  // ---- truss joining reactor to hull
  const struts = [];
  const T0 = -14.6, T1 = -5.9, sq = 1.62, bays = 9;
  const node = (x, i) => { const a = .785 + i * 1.5708; return new THREE.Vector3(x, Math.cos(a) * sq, Math.sin(a) * sq); };
  for (let b = 0; b < bays; b++) {
    const a = T0 + (T1 - T0) * b / bays, c = T0 + (T1 - T0) * (b + 1) / bays;
    for (let i = 0; i < 4; i++) {
      struts.push(strutMatrix(node(a, i), node(c, i), .075));
      struts.push(strutMatrix(node(a, i), node(a, i + 1), .05));
      struts.push(strutMatrix(node(b % 2 ? a : c, i), node(b % 2 ? c : a, i + 1), .04));
    }
  }
  P.dark.push(...hull([[.5, T0], [.5, T1]], 24));

  // ---- tanks and radiators on the truss
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * 6.283 + .4, x = -11.6 + (i % 2) * 3.8, r = 2.95;
    const t = new THREE.CapsuleGeometry(.88, 1.7, 10, 32); t.rotateZ(Math.PI / 2); t.translate(x, Math.cos(a) * r, Math.sin(a) * r);
    t.deleteAttribute('tangent'); P.gold.push(t);
    P.steel.push(put(new THREE.CylinderGeometry(1, 1, 1, 8), strutMatrix(new THREE.Vector3(x, Math.cos(a) * 1.5, Math.sin(a) * 1.5), new THREE.Vector3(x, Math.cos(a) * r, Math.sin(a) * r), .07)));
  }
  const ribs = [];
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
    const x = -13.7 + i * 1.7, w = 1.4, L = 6.6;
    P.white.push(box(w, .05, L, x, 0, s * (3.2 + L / 2)));
    for (let k = 0; k < 15; k++) ribs.push(new THREE.Matrix4().compose(new THREE.Vector3(x - w / 2 + (k + .5) * w / 15, .04, s * (3.2 + L / 2)), new THREE.Quaternion(), new THREE.Vector3(.022, .07, L * .96)));
    struts.push(strutMatrix(new THREE.Vector3(x, 0, s * 1.2), new THREE.Vector3(x, 0, s * 3.3), .06));
  }

  // ---- rotating habitat
  const hab = new THREE.Group(); hab.position.x = .35;
  const HR = 8.9;
  const habParts = { chrome: [], white: [], dark: [] };
  const hr = new THREE.TorusGeometry(HR, 1.02, 28, 180); hr.rotateY(Math.PI / 2); habParts.white.push(hr);
  for (let i = 0; i < 3; i++) { const b = new THREE.TorusGeometry(HR, .1, 8, 180); b.rotateY(Math.PI / 2); b.translate(-.72 + i * .72, 0, 0); b.scale(1, 1.113, 1.113); habParts.chrome.push(b); }
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * 6.283;
    habParts.chrome.push(put(new THREE.CylinderGeometry(1, 1, 1, 24), strutMatrix(new THREE.Vector3(0, Math.cos(a) * 2.6, Math.sin(a) * 2.6), new THREE.Vector3(0, Math.cos(a) * (HR - .8), Math.sin(a) * (HR - .8)), .34)));
    for (const k of [-1, 1]) habParts.dark.push(put(new THREE.CylinderGeometry(1, 1, 1, 10), strutMatrix(new THREE.Vector3(k * .55, Math.cos(a + k * .05) * 2.8, Math.sin(a + k * .05) * 2.8), new THREE.Vector3(k * .55, Math.cos(a + k * .05) * (HR - .9), Math.sin(a + k * .05) * (HR - .9)), .05)));
  }
  for (const k of Object.keys(habParts)) { const m = new THREE.Mesh(merge(habParts[k]), M[k]); m.castShadow = m.receiveShadow = true; hab.add(m); }
  const wn = 220, win = new THREE.InstancedMesh(new THREE.BoxGeometry(.2, .1, .16), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4, 2.4) }), wn), W = new THREE.Matrix4();
  for (let i = 0; i < wn; i++) {
    const a = i / wn * 6.283, sd = i % 2 ? 1 : -1, off = .86 * sd;
    W.compose(new THREE.Vector3(off, Math.cos(a) * HR, Math.sin(a) * HR), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -a), new THREE.Vector3(1, 1, R() < .2 ? 0 : 1));
    win.setMatrixAt(i, W);
  }
  hab.add(win);

  // ---- solar wings
  const wings = new THREE.Group();
  for (const s of [-1, 1]) {
    const L = 15, w = 2.5;
    wings.add(new THREE.Mesh(box(w, .05, L, 6.4, 0, s * (3.5 + L / 2)), M.solar));
    for (let i = 0; i < 2; i++) struts.push(strutMatrix(new THREE.Vector3(6.4 + (i ? .9 : -.9), 0, s * 2.1), new THREE.Vector3(6.4 + (i ? 1.25 : -1.25), 0, s * (3.5 + L)), .03));
    struts.push(strutMatrix(new THREE.Vector3(6.4, 0, s * 2), new THREE.Vector3(6.4, 0, s * (3.6 + L)), .075));
    for (let i = 0; i < 9; i++) { const z = s * (3.5 + i * L / 8); struts.push(strutMatrix(new THREE.Vector3(5.1, .05, z), new THREE.Vector3(7.7, .05, z), .022)); }
  }
  wings.children.forEach(m => { m.castShadow = true; m.receiveShadow = true; });

  // ---- bow: antenna dish, feed and sensor mast
  const dishPts = []; for (let i = 0; i <= 26; i++) { const t = i / 26, r = t * 3.9; dishPts.push(new THREE.Vector2(r, r * r * .085)); }
  const dish = new THREE.LatheGeometry(dishPts, 96); dish.applyMatrix4(Y2X); dish.translate(15.5, 0, 0);
  P.chrome.push(dish);
  P.dark.push(...hull([[.5, 13.2], [.34, 15.6]]));
  for (let i = 0; i < 3; i++) { const a = i / 3 * 6.283; struts.push(strutMatrix(new THREE.Vector3(15.5 + 1.3, Math.cos(a) * 3.8, Math.sin(a) * 3.8), new THREE.Vector3(19.4, 0, 0), .05)); }
  P.steel.push(...hull([[.12, 19], [.34, 19.3], [.34, 19.8], [.001, 19.9]], 24));
  const mast = strutMatrix(new THREE.Vector3(9.4, 1.2, 0), new THREE.Vector3(12, 5, .4), .08); struts.push(mast);
  P.dark.push(box(.9, .5, .6, 12, 5.1, .4)); P.steel.push(put(new THREE.SphereGeometry(.5, 24, 16), new THREE.Matrix4().makeTranslation(12.6, 5.15, .4)));

  // ---- greebles: thousands of little instruments on the hull
  const gN = Math.round(5200 * detail), g1 = [], g2 = [];
  for (let i = 0; i < gN; i++) {
    const x = -5.7 + R() * 18.6, a = R() * 6.283, r = rOf(x), big = Math.pow(R(), 3.2);
    const s = new THREE.Vector3(.06 + big * .62, .05 + R() * R() * .32, .06 + R() * .35 * (.2 + big));
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, Math.cos(a) * (r + s.y / 2), Math.sin(a) * (r + s.y / 2)), q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.round(R()) * 1.5708)), s);
    (R() < .62 ? g1 : g2).push(m);
  }

  // ---- assemble
  for (const k of Object.keys(P)) if (P[k].length) { const m = new THREE.Mesh(merge(P[k].map(g => { const u = g.toNonIndexed ? g : g; return u; })), M[k]); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; group.add(m); }
  const inst = (geo, mat, list) => { const m = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((t, i) => m.setMatrixAt(i, t)); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; group.add(m); return m; };
  inst(new THREE.CylinderGeometry(1, 1, 1, 6), M.steel, struts);
  inst(new THREE.CylinderGeometry(1, 1, 1, 8), M.dark, pipes);
  inst(new THREE.BoxGeometry(1, 1, 1), M.dark, ribs);
  inst(new THREE.BoxGeometry(1, 1, 1), M.steel, g1);
  inst(new THREE.BoxGeometry(1, 1, 1), M.dark, g2);
  group.add(coilMesh, plasma, hab, wings, glow);
  coilMesh.castShadow = true;

  // nav lights
  const beacons = [];
  for (const [x, y, z, c] of [[-15.4, 6.6, 0, [12, .6, .4]], [19.9, 0, 0, [.6, 12, 2]], [6.4, 0, 18.5, [12, .6, .4]], [6.4, 0, -18.5, [.6, 12, 2]]]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(...c) }));
    m.position.set(x, y, z); group.add(m); beacons.push(m);
  }
  return {
    group, hab, plasma, beacons,
    anchors: {
      reactor: new THREE.Vector3(-15.4, 6.2, 0), habitat: new THREE.Vector3(.35, 9.9, 0), dish: new THREE.Vector3(18.6, 3.2, 0), wing: new THREE.Vector3(6.4, 0, 14),
    },
  };
}

/** Studio for chrome: black void, a few long softboxes. */
function buildEnv(renderer) {
  const s = new THREE.Scene(); s.background = new THREE.Color(0, 0, 0);
  const add = (w, h, x, y, z, i, c = [1, 1, 1]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0] * i, c[1] * i, c[2] * i), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
  };
  add(70, 12, 10, 44, 18, 16);
  add(26, 70, -56, 8, 10, 9, [.82, .9, 1]);
  add(90, 4, 0, -40, 20, 7, [1, .9, .8]);
  add(16, 16, 40, 12, 40, 26);
  add(50, 5, 0, 4, -60, 13, [.75, .85, 1]);
  add(6, 60, 44, -6, -20, 11);
  for (let i = 0; i < 26; i++) { const a = i * 2.4, z = Math.sin(i * 1.7) * 50; add(2.4, 2.4, Math.cos(a) * 70, Math.sin(i) * 42, z, 7); }
  const p = new THREE.PMREMGenerator(renderer);
  const t = p.fromScene(s, .012, .1, 200).texture;
  p.dispose();
  return t;
}


// --- hole.js



const WORDMARK = 'M0 150 L65 10 L130 150 M174 10 L304 150 M304 10 L174 150 M368 10 V150 M412 80 a70 70 0 1 0 140 0 a70 70 0 1 0 -140 0 M596 150 V10 L666 112 L736 10 V150 M780 150 L845 10 L910 150';

/** Random points inside the wordmark, in world units centred on the origin. */
function wordPoints(n, width) {
  const W = 1860, H = 340, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.setTransform(2, 0, 0, 2, 20, 10);
  x.lineWidth = 13; x.strokeStyle = '#fff'; x.lineJoin = 'miter'; x.miterLimit = 6; x.lineCap = 'butt';
  x.stroke(new Path2D(WORDMARK));
  const d = x.getImageData(0, 0, W, H).data, on = [];
  for (let j = 0; j < H; j += 1) for (let i = 0; i < W; i += 1) if (d[(j * W + i) * 4] > 128) on.push(i, j);
  const R = rng(19), P = new Float32Array(n * 3), s = width / W, cnt = on.length / 2;
  for (let i = 0; i < n; i++) {
    const k = Math.floor(R() * cnt) * 2;
    P[i * 3] = (on[k] + R() - W / 2) * s; P[i * 3 + 1] = (H / 2 - on[k + 1] - R()) * s; P[i * 3 + 2] = (R() - .5) * .04;
  }
  return P;
}

/**
 * Accretion disc made of streaks. Light bending is computed per particle in the
 * image plane, so the far side of the disc arcs over the shadow without ray marching.
 */
function buildHole(n) {
  const R = rng(7), seed = new Float32Array(n * 4);
  for (let i = 0; i < n * 4; i += 4) {
    seed[i] = R(); seed[i + 1] = R() * 6.2832; seed[i + 2] = (R() + R() + R() - 1.5) / 1.5; seed[i + 3] = R();
  }
  const q = new THREE.InstancedBufferGeometry();
  q.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  q.setIndex([0, 1, 2, 0, 2, 3]);
  q.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  q.instanceCount = n;
  const u = {
    uTime: { value: 0 }, uLens: { value: 1 }, uFall: { value: 0 }, uAspect: { value: 1 }, uPx: { value: 1 },
    uGain: { value: 1 }, uCenter: { value: new THREE.Vector3() }, uTilt: { value: new THREE.Matrix4() },
  };
  const m = new THREE.Mesh(q, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, uniforms: u, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute vec4 aSeed;
      uniform float uTime,uLens,uFall,uAspect,uPx; uniform vec3 uCenter; uniform mat4 uTilt;
      varying vec3 vC; varying vec2 vQ; varying float vA;
      void main(){
        float rn=pow(aSeed.x,1.75);
        float r=2.5+rn*12.5;
        r*=1.-uFall*.45*(1.-rn);
        float om=2.3*pow(r,-1.5);
        float a=aSeed.y+uTime*om*2.3;
        float hh=aSeed.z*(.012+.022*r)*(1.+.8*sin(a*2.+r));
        vec3 disc=vec3(cos(a)*r,hh,sin(a)*r);
        vec3 tang=vec3(-sin(a),0.,cos(a));
        disc=(uTilt*vec4(disc,1.)).xyz+uCenter; tang=(uTilt*vec4(tang,0.)).xyz;

        const float mk=0.;
        vec3 p=disc;

        vec4 v=viewMatrix*vec4(p,1.);
        vec4 cv=viewMatrix*vec4(uCenter,1.);
        float lens=uLens*(1.-mk);
        bool second=fract(aSeed.w*113.)<.2;
        float sec=0.;
        if(lens>.001){
          float Ds=-v.z, Dl=-cv.z;
          if(Ds>Dl+.01){
            vec2 c=cv.xy/Dl; vec2 th=v.xy/Ds-c; float b=length(th)+1e-5;
            float re2=lens*22.*(Ds-Dl)/(Ds*Dl*max(Dl,.1));
            re2=min(re2,.09);
            float t=.5*(b+sqrt(b*b+4.*re2));
            if(second){ t=.5*(b-sqrt(b*b+4.*re2)); sec=1.; }
            v.xy=(c+th/b*t)*Ds;
          } else if(second){ sec=2.; }
        }
        vec3 vt=normalize((viewMatrix*vec4(tang,0.)).xyz);
        vec4 ca=projectionMatrix*v;
        vec4 cb=projectionMatrix*vec4(v.xyz+vt*.06,1.);
        vec2 sa=ca.xy/ca.w, sb=cb.xy/cb.w;
        vec2 dir=(sb-sa)*vec2(uAspect,1.); float dl=length(dir)+1e-5; dir/=dl;
        vec2 nrm=vec2(-dir.y,dir.x);
        float speed=clamp(om*1.4,.05,1.);
        float len=(1.-mk)*(.022+.07*speed*(.4+aSeed.w))+.0009*mk;
        float wid=mix(.0008+.0006*fract(aSeed.w*31.),.0012,mk);
        vec2 off=(dir*position.x*len+nrm*position.y*wid);
        off.x/=uAspect;
        gl_Position=ca; gl_Position.xy+=off*ca.w;

        vQ=position.xy;
        float dop=dot(normalize(tang),normalize(-v.xyz*mat3(viewMatrix)+vec3(0.)));
        float dd=1.+clamp(-vt.x*.72,-.68,.9);
        float inner=exp(-rn*5.);
        vec3 col=mix(vec3(.82,.88,1.),vec3(1.,.93,.82),smoothstep(0.,.5,rn));
        col=mix(col,vec3(1.,.72,.42),smoothstep(.45,1.,rn)*.6);
        float rings=.42+.58*smoothstep(.25,.75,sin(r*5.3+sin(r*1.7)*2.)*.5+.5);
        float b=(.24+1.25*inner)*dd*dd*(.25+fract(aSeed.w*57.)*.9)*pow(1.-rn,1.7)*rings;
        vA=mix(b,1.6+1.6*fract(aSeed.w*19.),mk);
        if(sec>1.5) vA=0.;
        if(sec>.5&&sec<1.5) vA*=.5;
        vC=mix(col,vec3(.92,.96,1.),mk);
      }`,
    fragmentShader: /* glsl */`
      uniform float uGain; varying vec3 vC; varying vec2 vQ; varying float vA;
      void main(){ if(vA<=0.) discard; float e=(1.-vQ.x*vQ.x)*(1.-vQ.y*vQ.y); gl_FragColor=vec4(vC*vA*e*uGain,1.); }`,
  }));
  m.frustumCulled = false;
  m.userData.u = u;

  const shadow = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  // the photon ring hugging the shadow, screen-facing
  const ringU = { uI: { value: 1 } };
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: ringU,
    vertexShader: `varying vec2 vU; void main(){ vU=uv*2.-1.; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: /* glsl */`uniform float uI; varying vec2 vU;
      void main(){ float r=length(vU), a=atan(vU.y,vU.x);
        float R=.3; float w=exp(-pow((r-R)/.0036,2.))*1.9+exp(-pow((r-R)/.02,2.))*.1;
        float dop=1.+.72*cos(a-3.14);
        gl_FragColor=vec4(vec3(1.,.93,.82)*w*dop*uI,1.); }`,
  }));
  ring.renderOrder = 4;
  return { mesh: m, shadow, ring, ringU };
}


// --- worlds.js




const NOISE3 = /* glsl */`
float h31(vec3 p){ p=fract(p*vec3(.1031,.1030,.0973)); p+=dot(p,p.yxz+33.33); return fract((p.x+p.y)*p.z); }
vec3 h33(vec3 p){ p=fract(p*vec3(.1031,.1030,.0973)); p+=dot(p,p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
float n3(vec3 x){ vec3 i=floor(x),f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm3(vec3 p,int o){ float a=.5,s=0.; for(int i=0;i<o;i++){ s+=a*n3(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s; }
vec3 dirOf(vec2 uv){ float ph=(uv.x-.5)*6.2831853,th=(uv.y-.5)*3.14159265; return vec3(cos(th)*cos(ph),sin(th),cos(th)*sin(ph)); }
`;

/** Bakes a procedural surface into a float texture, one strip per task, so scrolling never stalls. */
async function bake(renderer, w, h, fs, strips, mips = true) {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType, minFilter: mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter, magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping, depthBuffer: false, generateMipmaps: mips,
  });
  rt.texture.anisotropy = 4;
  const mat = new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
    fragmentShader: `precision highp float; varying vec2 vUv; ${NOISE3}\n${fs}`, depthTest: false, depthWrite: false,
  });
  const q = new THREE.Mesh(FST, mat); q.frustumCulled = false;
  const s = new THREE.Scene(); s.add(q);
  const cam = new THREE.Camera();
  rt.scissorTest = true;
  for (let i = 0; i < strips; i++) {
    const y = Math.floor(i / strips * h), y2 = Math.floor((i + 1) / strips * h);
    rt.scissor.set(0, y, w, y2 - y);
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(rt);
    if (mips) rt.texture.generateMipmaps = i === strips - 1;   // mips once, after the last strip
    renderer.render(s, cam);
    renderer.setRenderTarget(null);
    renderer.autoClear = ac;
    await new Promise(r => setTimeout(r, 4));
  }
  rt.scissorTest = false;
  rt.scissor.set(0, 0, w, h);
  mat.dispose();
  return rt.texture;
}

/* ---------------- the moon ---------------- */
const moonBake = /* glsl */`
void octave(vec3 p,float f,float seed,float amp,inout float h,inout float e){
  vec3 q=p*f, b=floor(q-.5);
  for(int i=0;i<8;i++){
    vec3 o=vec3(float(i&1),float((i>>1)&1),float((i>>2)&1));
    vec3 c=b+o; vec3 r=h33(c+seed);
    if(r.z<.2) continue;
    vec3 ctr=c+.5+(r-.5)*.8;
    float rad=.16+.34*r.x*r.x;
    float d=length(q-ctr)/rad;
    if(d>2.2) continue;
    float depth=amp*rad;
    float bowl=-(1.-smoothstep(.0,1.,d*d))*depth*1.25;
    float rim=exp(-pow((d-1.)*3.6,2.))*depth*.55;
    float out_=exp(-max(d-1.,0.)*3.)*depth*.1*step(1.,d);
    h=mix(h,h*.28,(1.-smoothstep(.75,1.05,d)));
    h+=bowl+rim+out_;
    e+=exp(-max(d-1.,0.)*2.2)*step(.8,r.y)*smoothstep(.0,.3,1.-amp*.1)*.3*step(.95,d);
  }
}
void main(){
  vec3 p=dirOf(vUv);
  float h=(fbm3(p*3.,6)-.5)*.1;
  float mare=smoothstep(.52,.36,fbm3(p*1.15+vec3(3.1,1.2,7.),5));
  float e=0.;
  float amp=.11;
  float f=2.6;
  for(int i=0;i<8;i++){
    float a=amp*(i<3?mix(1.,.3,mare):1.);
    octave(p,f,float(i)*17.3,a,h,e);
    f*=1.92; amp*=.66;
  }
  h+=(fbm3(p*48.,5)-.5)*.012;
  float alb=mix(.62,.2,mare);
  alb*=.82+.36*fbm3(p*7.+4.,5);
  alb+=clamp(e,0.,.3)*.5;
  gl_FragColor=vec4(h,alb,mare,1.);
}`;

async function buildMoon(renderer, size) {
  const t = await bake(renderer, size, size / 2, moonBake, size > 2048 ? 48 : 24);
  const u = {
    tH: { value: t }, uSun: { value: new THREE.Vector3(1, .1, .2).normalize() }, uI: { value: 1 }, uTex: { value: new THREE.Vector2(size, size / 2) },
    uTime: { value: 0 },
  };
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 110), new THREE.ShaderMaterial({
    uniforms: u, glslVersion: THREE.GLSL3,
    vertexShader: `out vec3 vP; out vec3 vW; void main(){ vP=position; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      precision highp float; in vec3 vP; in vec3 vW; out vec4 frag; uniform sampler2D tH; uniform vec3 uSun; uniform vec2 uTex; uniform float uI;
      ${NOISE3}
      void main(){
        vec3 p=normalize(vP);
        float ph=atan(p.z,p.x); vec2 uv=vec2(ph/6.2831853+.5,asin(clamp(p.y,-1.,1.))/3.14159265+.5);
        // derivatives chosen by hand so the longitude seam stays invisible
        vec2 dx=dFdx(uv), dy=dFdy(uv);
        if(abs(dx.x)>.4) dx.x=0.; if(abs(dy.x)>.4) dy.x=0.;
        vec2 e=1.4/uTex;
        vec4 c=textureGrad(tH,uv,dx,dy);
        float hE=textureGrad(tH,uv+vec2(e.x,0.),dx,dy).r, hN=textureGrad(tH,uv+vec2(0.,e.y),dx,dy).r;
        float lat=max(cos(asin(p.y)),.06);
        vec3 east=normalize(vec3(-p.z,0.,p.x)), north=normalize(cross(p,east));
        float k=13.;
        vec3 n=normalize(p-east*(hE-c.r)/(e.x*6.2831*lat)*.052*k/6.-north*(hN-c.r)/(e.y*3.14159)*.052*k/6.);
        // fine regolith for close passes
        float fine=fbm3(p*190.,3)-.5;
        n=normalize(n+vec3(fine)*.1*(east+north));
        float nl=dot(n,uSun);
        // lunar soil scatters light almost flat, with a hard terminator
        float l=max(nl,0.); l=pow(l,.72)*(1.+.25*(1.-l));
        float geo=smoothstep(-.02,.09,dot(p,uSun));
        vec3 alb=vec3(c.g)*vec3(1.,.985,.955);
        vec3 col=alb*l*geo*1.55*uI;
        frag=vec4(col,1.);
      }`,
  }));
  m.frustumCulled = false;
  m.userData.u = u;
  return m;
}

/* ---------------- the planet that unwinds ---------------- */
const planetBake = /* glsl */`
void main(){
  vec3 p=dirOf(vUv);
  vec3 w=vec3(fbm3(p*2.+1.,5),fbm3(p*2.+7.,5),fbm3(p*2.+13.,5))-.5;
  float e=fbm3(p*1.6+w*1.9+3.,8)*1.25-.12;
  float sea=.52;
  float land=smoothstep(sea,sea+.008,e);
  float hgt=max(e-sea,0.);
  float lat=abs(p.y)+(fbm3(p*5.,4)-.5)*.2;
  float dry=smoothstep(.34,.1,abs(lat-.28))*smoothstep(.45,.75,fbm3(p*3.+9.,5));
  vec3 g=mix(vec3(.05,.19,.07),vec3(.2,.27,.09),smoothstep(0.,.1,hgt));
  g=mix(g,vec3(.6,.47,.26),dry);
  g=mix(g,vec3(.33,.27,.22),smoothstep(.12,.21,hgt));
  g=mix(g,vec3(.9,.92,.95),smoothstep(.21,.27,hgt));
  float depth=clamp((sea-e)*7.,0.,1.);
  vec3 o=mix(vec3(.03,.3,.42),vec3(.006,.05,.2),smoothstep(0.,.55,depth));
  o=mix(vec3(.07,.5,.54),o,smoothstep(0.,.09,depth));
  vec3 c=mix(o,g,land);
  float ice=smoothstep(.76,.86,lat);
  c=mix(c,vec3(.92,.95,1.),ice);
  float cl=fbm3(p*vec3(2.6,4.6,2.6)+w*1.7+21.,7);
  float clouds=smoothstep(.5,.72,cl+.05*sin(p.y*12.));
#ifdef DATA
  gl_FragColor=vec4(hgt,land,clouds,1.);
#else
  gl_FragColor=vec4(c,1.);
#endif
}`;

async function buildPlanet(renderer, size, segU = 460, segV = 230) {
  const t = await bake(renderer, size, size / 2, planetBake, 16);
  const d = await bake(renderer, size, size / 2, `#define DATA
` + planetBake, 16);
  const g = new THREE.PlaneGeometry(1, 1, segU, segV);
  const u = {
    tP: { value: t }, tD: { value: d }, uMorph: { value: 0 }, uTime: { value: 0 }, uSun: { value: new THREE.Vector3(-.5, .6, .7).normalize() },
    uStudio: { value: 1 },
  };
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
    uniforms: u, side: THREE.DoubleSide, glslVersion: THREE.GLSL3,
    vertexShader: /* glsl */`
      uniform float uMorph,uTime; out vec2 vT; out vec3 vN,vW,vDu,vDv;
      const float TAU=6.2831853;
      vec3 sph(vec2 q){ float lon=q.x*TAU,lat=(q.y-.5)*3.14159265; return 3.2*vec3(cos(lat)*cos(lon),sin(lat),cos(lat)*sin(lon)); }
      vec3 band(vec2 q){
        float th=q.x*TAU; float w=(q.y-.5)*2.;
        float tw=th*2.+uTime*.12;                     // one full twist closes the band on itself
        vec3 er=vec3(cos(th),0.,sin(th)), ey=vec3(0,1,0);
        vec3 a=er*sin(tw)+ey*cos(tw), n=er*cos(tw)-ey*sin(tw);
        vec3 c=er*(4.25+.36*sin(th*3.+uTime*.2))+ey*.42*sin(th*2.-uTime*.15);
        return c+a*w*1.34+n*(1.-w*w)*.3;
      }
      vec3 P(vec2 q){
        float s=smoothstep(.0,1.,clamp(uMorph*1.7-abs(fract(q.x+.08)-.5)*1.4,0.,1.));
        return mix(sph(q),band(q),s);
      }
      void main(){
        vec2 q=vec2(uv.x,uv.y); float e=.002;
        vec3 p=P(q);
        vDu=P(q+vec2(e,0.))-p; vDv=P(q+vec2(0.,e))-p;
        vDu=mat3(modelMatrix)*vDu; vDv=mat3(modelMatrix)*vDv;
        vN=normalize(cross(vDv,vDu));
        vec4 w=modelMatrix*vec4(p,1.); vW=w.xyz; vT=q;
        gl_Position=projectionMatrix*viewMatrix*w;
      }`,
    fragmentShader: /* glsl */`
      precision highp float; in vec2 vT; in vec3 vN,vW,vDu,vDv; out vec4 frag;
      uniform sampler2D tP,tD; uniform vec3 uSun; uniform float uTime,uMorph,uStudio;
      ${NOISE3}
      vec2 map(vec2 q){ return vec2(.5-q.x,q.y); }
      void main(){
        vec2 q=vT;
        vec3 V=normalize(cameraPosition-vW);
        vec3 N=normalize(vN); float front=dot(N,V);
        vec3 alb=texture(tP,map(q)).rgb; vec3 dat=texture(tD,map(q)).rgb;
        float land=dat.g, cl=dat.b;
        if(front<0.) { N=-N; }
        if(gl_FrontFacing){
          // the underside of the crust: obsidian veined with heat
          float c=fbm3(vec3(q*vec2(44.,11.),uTime*.03),5);
          float v=pow(1.-abs(c-.5)*2.,14.);
          vec3 base=vec3(.012,.012,.016);
          float d=max(dot(N,uSun),0.);
          vec3 col=base*(.4+d*3.)+vec3(3.6,.86,.18)*v*.5;
          float sp=pow(max(dot(reflect(-uSun,N),V),0.),60.);
          frag=vec4(col+vec3(.9)*sp,1.); return;
        }
        float e=.0016;
        float hE=texture(tD,map(q+vec2(e,0.))).r-dat.r, hN=texture(tD,map(q+vec2(0.,e))).r-dat.r;
        vec3 n=normalize(N-normalize(vDu)*hE*7.*land-normalize(vDv)*hN*7.*land);
        float nl=max(dot(n,uSun),0.);
        float shadow=texture(tD,map(q+vec2(.006,-.004))).b;
        vec3 sky=vec3(.72,.82,1.);
        vec3 c=alb*(sky*.3+vec3(1.,.96,.9)*nl*1.55*(1.-shadow*.35));
        float fr=pow(1.-max(dot(n,V),0.),5.);
        vec3 h=normalize(uSun+V);
        float wet=1.-land;
        c+=vec3(1.,.97,.92)*pow(max(dot(n,h),0.),180.)*wet*3.;
        c+=sky*fr*(.12+wet*.26);
        vec3 cld=vec3(.97,.98,1.)*(.46+nl*.62);
        c=mix(c,cld,cl*.82);
        // thin atmosphere at the limb
        c=mix(c,vec3(.5,.7,1.)*.92,pow(1.-max(dot(N,V),0.),3.6)*.42);
        frag=vec4(c,1.);
      }`,
  }));
  m.frustumCulled = false;
  m.userData.u = u;
  return m;
}

function buildDebris(n) {
  const R = rng(13), g = new THREE.IcosahedronGeometry(1, 0);
  const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: .55, metalness: .2, flatShading: true }), n);
  const T = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    const a = R() * 6.283, r = 4.6 + R() * 3.4, s = .012 + Math.pow(R(), 4) * .11;
    E.set(R() * 6, R() * 6, R() * 6); Q.setFromEuler(E);
    T.compose(new THREE.Vector3(Math.cos(a) * r, (R() - .5) * 3.2, Math.sin(a) * r), Q, new THREE.Vector3(s, s * (.6 + R()), s));
    m.setMatrixAt(i, T);
  }
  m.frustumCulled = false;
  return m;
}


// --- star.js






/* ---------------- photosphere: convection cells, spots and bright faculae, baked once ---------------- */
const surfaceBake = /* glsl */`
vec2 cells(vec3 q){
  vec3 b=floor(q-.5); float f1=9.,f2=9.;
  for(int i=0;i<8;i++){
    vec3 o=vec3(float(i&1),float((i>>1)&1),float((i>>2)&1));
    vec3 c=b+o, r=vec3(h31(c),h31(c+7.1),h31(c+13.7));
    float d=length(q-(c+.5+(r-.5)*.9));
    if(d<f1){ f2=f1; f1=d; } else if(d<f2) f2=d;
  }
  return vec2(f1,f2);
}
void main(){
  vec3 p=dirOf(vUv);
  vec3 w=vec3(fbm3(p*6.+1.,4),fbm3(p*6.+5.,4),fbm3(p*6.+9.,4))-.5;
  vec2 a=cells(p*46.+w*5.), b=cells(p*104.+w*7.);
  float ga=smoothstep(.0,.42,a.y-a.x), gb=smoothstep(.0,.42,b.y-b.x);
  float gran=ga*.68+gb*.32;
  float sup=fbm3(p*9.+w*2.,5);                 // supergranulation
  float lat=abs(p.y);
  float belt=smoothstep(.1,.2,lat)*(1.-smoothstep(.42,.56,lat));
  float sm=fbm3(p*11.+w*2.4+21.,6);
  float spot=smoothstep(.665,.695,sm)*belt;
  float umbra=smoothstep(.69,.72,sm)*belt;
  float fac=smoothstep(.55,.66,sm)*(1.-spot)*belt;
  gl_FragColor=vec4(gran*(.72+.56*sup),spot,umbra,fac);
}`;

let shared = null;
function starSurface(renderer, size) {
  shared ||= bake(renderer, size, size / 2, surfaceBake, 16, false);
  return shared;
}

function buildStar(radius, tex) {
  const u = { tS: { value: tex }, uTime: { value: 0 }, uHeat: { value: 0 }, uGain: { value: 1 }, uTexel: { value: 1 / tex.image.width } };
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), new THREE.ShaderMaterial({
    uniforms: u, glslVersion: THREE.GLSL3,
    vertexShader: `out vec3 vP,vN,vW; void main(){ vP=normalize(position); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=mat3(modelMatrix)*normal; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      precision highp float; in vec3 vP,vN,vW; out vec4 frag; uniform sampler2D tS; uniform float uTime,uHeat,uGain;
      vec4 at(vec3 p,float t,float sw){
        float rot=t*(.0052-.0022*p.y*p.y);               // the equator turns faster than the poles
        float ph=atan(p.z,p.x)/6.2831853+.5+rot;
        vec2 uv=vec2(ph,asin(clamp(p.y,-1.,1.))/3.14159265+.5);
        return textureGrad(tS,uv+vec2(sin(uv.y*40.+t*.2+sw)*.0012,sin(ph*60.-t*.17+sw)*.0009),vec2(.0012,0.),vec2(0.,.0024));
      }
      void main(){
        vec3 p=normalize(vP), V=normalize(cameraPosition-vW), N=normalize(vN);
        float mu=clamp(dot(N,V),0.,1.);
        // cells boil: two offset states of the surface crossfade forever
        float c=fract(uTime*.07), w=abs(c*2.-1.);
        vec4 a=at(p,uTime,0.), b=at(p+vec3(.003,0.,-.002),uTime,3.1);
        vec4 s=mix(a,b,w);
        float limb=.16+.84*pow(mu,.72);
        float heat=s.r*(1.-s.g*.72)*(1.-s.b*.85)+s.a*(.1+.5*(1.-mu));
        vec3 cool=vec3(.36,.045,.004), warm=vec3(1.05,.26,.024), hot=vec3(1.75,.82,.2);
        vec3 col=mix(cool,warm,smoothstep(.12,.58,heat));
        col=mix(col,hot,smoothstep(.52,1.,heat));
        col*=limb;
        col=mix(col,vec3(.95,.22,.03)*limb,pow(1.-mu,3.)*.7);
        col=mix(col,vec3(3.,3.6,5.2)*(.4+heat),uHeat);
        frag=vec4(col*uGain,1.);
      }`,
  }));

  const cu = { uTime: u.uTime, uI: { value: 1 }, uPull: { value: 0 } };
  const size = radius * 5;
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: cu, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vU; void main(){ vU=(uv*2.-1.)*2.5; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: /* glsl */`
      precision highp float; varying vec2 vU; uniform float uTime,uI,uPull;
      ${NOISE_GLSL}
      void main(){
        float r=length(vU), a=atan(vU.y,vU.x), e=r-1.;
        if(e<-.03) discard;
        e=max(e,0.);
        vec2 d=vec2(cos(a),sin(a));
        float t=uTime;
        float s1=fbm(d*2.6+vec2(e*1.1-t*.035,t*.012));
        float s2=fbm(d*7.+vec2(e*2.6-t*.07,-t*.02));
        float stream=pow(s1,2.1)*2.4+pow(s2,3.)*1.5;
        float body=exp(-e*2.9)*(.012+stream*.3)+exp(-e*11.)*.13;
        // chromosphere: the thin rose rim
        float chrom=exp(-e*60.)*.9;
        // prominences: ropes of plasma lifting off the limb, only in active regions
        float act=smoothstep(.5,.66,fbm(vec2(a*1.3,t*.01)+4.));
        float w=vnoise(vec2(a*7.+sin(e*5.+t*.1)*.2,e*6.-t*.2));
        float rope=pow(1.-abs(w*2.-1.),22.)*exp(-e*9.)*act*smoothstep(.0,.03,e);
        vec3 c=vec3(1.,.42,.12)*body+vec3(1.1,.2,.1)*chrom+vec3(1.8,.36,.1)*rope*.55;
        float fade=1.-smoothstep(1.2,1.5,r);
        gl_FragColor=vec4(c*fade*uI*(1.-uPull*.8),1.);
      }`,
  }));
  corona.renderOrder = 1;
  const group = new THREE.Group(); group.add(corona, mesh);
  const q = new THREE.Quaternion();
  return {
    group, mesh, corona, u, cu,
    update(T, camera) {
      u.uTime.value = T;
      group.getWorldQuaternion(q).invert();
      corona.quaternion.copy(q).multiply(camera.quaternion);
    },
  };
}

/* ---------------- the jump: streaks computed per pixel, so they stay fine at any size ---------------- */
function buildWarp() {
  const u = { uPhase: { value: 0 }, uSpeed: { value: 0 }, uAspect: { value: 1 }, uFade: { value: 1 }, uLayers: { value: 6 } };
  const m = new THREE.Mesh(FST, new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, uniforms: u,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
    fragmentShader: /* glsl */`
      precision highp float; varying vec2 vUv; uniform float uPhase,uSpeed,uAspect,uFade;
      ${NOISE_GLSL}
      void main(){
        vec2 p=(vUv-.5)*vec2(uAspect,1.);
        float r=length(p), a=atan(p.y,p.x)/6.2831853+.5;
        vec3 c=vec3(0.);
        for(int i=0;i<6;i++){
          float k=float(i), n=70.+k*58.;
          float x=a*n, id=floor(x), f=fract(x)-.5;
          id=mod(id,n);
          float h=hash12(vec2(id,k+1.));
          float z=fract(h*19.+uPhase*(.55+h*.8));
          float head=.012+1.9*z*z*z;
          float len=(.004+.72*uSpeed*(.25+z))*(.25+head);
          float tail=smoothstep(head-len,head,r)*(1.-smoothstep(head,head+.006+.03*z,r));
          float thin=exp(-f*f*(70.+k*34.)/max(r*2.2,.14));
          vec3 tint=mix(vec3(.5,.68,1.5),vec3(1.5,1.3,1.1),hash12(vec2(id,k+9.)));
          tint=mix(tint,vec3(.72,.42,1.4),smoothstep(.75,1.,h));
          c+=tint*tail*thin*(z*1.25+.06)*step(.42,h);
        }
        float mist=fbm(vec2(a*14.+r*2.,r*3.-uPhase*.5));
        c+=vec3(.1,.2,.62)*pow(mist,2.4)*exp(-r*1.6)*uSpeed*1.5;
        c+=vec3(.7,.82,1.5)*exp(-r*r*210.)*(.4+uSpeed*.9);
        gl_FragColor=vec4(c*uFade,1.);
      }`,
  }));
  m.frustumCulled = false;
  m.userData.u = u;
  return m;
}

/* ---------------- the supernova: shock front, filaments and the remnant left behind ---------------- */
function buildBlast() {
  const u = { uT: { value: 0 }, uI: { value: 0 }, uTime: { value: 0 } };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: u, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vQ; void main(){ vQ=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: /* glsl */`
      precision highp float; varying vec2 vQ; uniform float uT,uI,uTime;
      ${NOISE_GLSL}
      void main(){
        float t=uT, r=length(vQ), a=atan(vQ.y,vQ.x);
        vec2 d=vec2(cos(a),sin(a));
        float R=46.*(1.-exp(-t*.82));
        float warp=fbm(d*2.4+t*.05)*R*.34;
        float e=r-(R*.82+warp);
        // shock front
        float front=exp(-e*e/(.5+R*.05))*exp(-t*.75)*1.25;
        vec3 c=mix(vec3(1.2,1.4,2.),vec3(1.5,.62,.3),clamp(t*.4,0.,1.))*front;
        // filaments of ejecta
        vec2 q=vQ*.05;
        vec2 w=vec2(fbm(q*.8+3.+t*.02),fbm(q*.8+9.-t*.02));
        float f=fbm(q*1.4+w*2.6);
        float rope=pow(1.-abs(f*2.-1.),4.);
        float inside=(1.-smoothstep(R*.55+warp,R*.95+warp,r))*smoothstep(R*.04,R*.3,r);
        float neb=(.28*f+rope*.9)*inside;
        float k=clamp(r/max(R,1.),0.,1.);
        vec3 tint=mix(vec3(1.4,.5,.12),vec3(1.05,.16,.5),smoothstep(.15,.6,k+f*.3-.15));
        tint=mix(tint,vec3(.1,.55,.9),smoothstep(.55,1.,k+w.x*.4-.1));
        c+=tint*neb*(.1+.62*exp(-t*.5));
        // the core dies away
        c+=vec3(1.5,1.3,1.1)*exp(-r*r*.05/(1.+t*3.))*2.6*exp(-t*2.4);
        gl_FragColor=vec4(c*uI,1.);
      }`,
  }));
  m.frustumCulled = false; m.renderOrder = 3;
  m.userData.u = u;
  return m;
}

/* ---------------- stardust: thrown outward by the blast, then drawn into the name ---------------- */
function buildDust(n) {
  const R = rng(91), seed = new Float32Array(n * 4), dir = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const z = R() * 2 - 1, a = R() * 6.2832, s = Math.sqrt(1 - z * z);
    dir[i * 3] = s * Math.cos(a); dir[i * 3 + 1] = z * .72; dir[i * 3 + 2] = s * Math.sin(a) * .5;
    seed[i * 4] = R(); seed[i * 4 + 1] = R(); seed[i * 4 + 2] = R(); seed[i * 4 + 3] = R();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(wordPoints(n, 15), 3));
  g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const u = { uAge: { value: 0 }, uPx: { value: 1 }, uGain: { value: 1 }, uBlast: { value: 0 }, uTime: { value: 0 } };
  const m = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: u,
    vertexShader: /* glsl */`
      attribute vec3 aDir; attribute vec4 aSeed; uniform float uAge,uPx,uBlast,uTime; varying vec3 vC; varying float vA;
      void main(){
        float t=uAge, s=aSeed.x;
        float out_=(1.-exp(-t*1.75))*(5.+21.*s*s+6.*aSeed.y);
        vec3 ex=aDir*out_;
        float sw=t*.34*(1.-s*.6);
        ex.xy=mat2(cos(sw),-sin(sw),sin(sw),cos(sw))*ex.xy;
        ex+=vec3(sin(t*.8+aSeed.y*40.),cos(t*.7+aSeed.z*40.),sin(t*.6+aSeed.w*40.))*.34*min(t,2.);
        float st=.95+aSeed.z*1.25;
        float c=smoothstep(st,st+1.15,t); c=c*c*(3.-2.*c);
        vec3 word=position+vec3(sin(uTime*.7+aSeed.y*9.),cos(uTime*.6+aSeed.w*9.),0.)*.008;
        word+=normalize(aDir+.001)*uBlast*(.25+1.9*s*s);
        vec3 p=mix(ex,word,c);
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=max(1.,uPx*mix(1.9+aSeed.w*2.2,1.5,c));
        vec3 hot=mix(vec3(1.5,1.6,2.),vec3(1.5,.82,.34),clamp(t*.9,0.,1.));
        hot=mix(hot,vec3(.8,.3,.42),clamp((t-.9)*.5,0.,1.)*(.4+.6*aSeed.y));
        vC=mix(hot,vec3(.96,.98,1.04),c);
        vA=mix((.05+.16*aSeed.w)*exp(-t*.3),.95,c)*smoothstep(.0,.12,t);
      }`,
    fragmentShader: /* glsl */`
      uniform float uGain; varying vec3 vC; varying float vA;
      void main(){ float r=length(gl_PointCoord-.5)*2.; float a=exp(-r*r*2.6)*(1.-smoothstep(.85,1.,r)); gl_FragColor=vec4(vC*a*vA*uGain,1.); }`,
  }));
  m.frustumCulled = false;
  m.userData.u = u;
  return m;
}


// --- cosmos.js




/* ---------------- a glass double helix that unzips ---------------- */
class Strand extends THREE.Curve {
  constructor(turns, H, R, ph) { super(); Object.assign(this, { turns, H, R, ph }); }
  getPoint(t, out = new THREE.Vector3()) {
    const a = t * this.turns * 6.28318 + this.ph;
    return out.set(Math.cos(a) * this.R, (t - .5) * this.H, Math.sin(a) * this.R);
  }
}

function buildHelix(q = 1) {
  const turns = 4, H = 25, R = 1.8, PH = 2.25, parts = [];
  const side = (g, s) => {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, s, 0);
    return g;
  };
  const A = new Strand(turns, H, R, 0), B = new Strand(turns, H, R, PH);
  parts.push(side(new THREE.TubeGeometry(A, Math.round(520 * q), .25, 14, false), 1));
  parts.push(side(new THREE.TubeGeometry(B, Math.round(520 * q), .25, 14, false), -1));
  const n = turns * 11;
  for (let i = 1; i < n; i++) {
    const t = i / n, a = A.getPoint(t), b = B.getPoint(t), m = a.clone().lerp(b, .5);
    for (const [p, s] of [[a, 1], [b, -1]]) {
      const d = new THREE.Vector3().subVectors(m, p), l = d.length() - .05;
      const c = new THREE.CylinderGeometry(.095, .095, l, 12);
      c.applyMatrix4(new THREE.Matrix4().compose(p.clone().addScaledVector(d.clone().normalize(), l / 2),
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()), new THREE.Vector3(1, 1, 1)));
      parts.push(side(c, s));
      const e = new THREE.SphereGeometry(.2, 16, 12); e.translate(m.x - d.x * .06, m.y - d.y * .06, m.z - d.z * .06);
      parts.push(side(e, s));
    }
  }
  const g = merge(parts);
  const u = { uZip: { value: 16 }, uTime: { value: 0 } };
  const vs = /* glsl */`
    uniform float uZip,uTime; varying vec3 vN,vV,vP;
    void main(){
      float s=uv.x; vec3 p=position; vec3 n=normal;
      // past the replication fork the strands peel apart
      float o=smoothstep(uZip-.5,uZip-11.,-p.y+0.);
      o=1.-smoothstep(uZip-11.,uZip,p.y+12.5);
      vec3 d=normalize(vec3(.92,0.,.38));
      p+=d*s*o*o*3.3+vec3(0.,0.,sin(p.y*.5+uTime*.4)*.28*o);
      vec4 mv=modelViewMatrix*vec4(p,1.);
      vN=normalMatrix*n; vV=-mv.xyz; vP=position;
      gl_Position=projectionMatrix*mv;
    }`;
  const fs = /* glsl */`
    varying vec3 vN,vV,vP;
    vec3 film(float t){ return .5+.5*cos(6.28318*(vec3(1.,.92,.85)*t+vec3(.02,.36,.66))); }
    void main(){
      vec3 N=normalize(vN),V=normalize(vV); if(!gl_FrontFacing) N=-N;
      float nv=abs(dot(N,V)), f=pow(1.-nv,2.1);
      vec3 R=reflect(-V,N);
      float win=smoothstep(.62,.68,R.y)*(1.-smoothstep(.8,.84,R.y))+smoothstep(.9,.95,R.x)*.7;
      vec3 tint=mix(vec3(.62,.74,.9),film(f*.8+vP.y*.035+.55),.42);
      vec3 ink=vec3(.02,.05,.12);
      vec3 col=mix(tint,ink,smoothstep(.1,.86,f));
      float a=.2+.78*f;
      col=mix(col,vec3(1.),win); a=max(a,win*.92);
      gl_FragColor=vec4(col,a*(gl_FrontFacing?1.:.5));
    }`;
  const mk = side_ => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: side_, uniforms: u, vertexShader: vs, fragmentShader: fs });
  const back = new THREE.Mesh(g, mk(THREE.BackSide)), front = new THREE.Mesh(g, mk(THREE.FrontSide));
  back.frustumCulled = front.frustumCulled = false; back.renderOrder = 1; front.renderOrder = 2;
  const group = new THREE.Group(); group.add(back, front);
  group.userData.u = u;
  return group;
}

/* ---------------- a star being enclosed by a swarm of panels ---------------- */
function buildDyson(n, starTex) {
  const R = rng(31), dirs = [], seed = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i + .5) / n * 2, s = Math.sqrt(1 - y * y), a = i * ga;
    if (Math.abs(y) < .05) continue;                    // the shell keeps an equatorial slit
    dirs.push(Math.cos(a) * s, y, Math.sin(a) * s);
    seed.push(Math.pow(Math.abs(y), .7) * .6 + R() * .4, R());
  }
  const count = dirs.length / 3, RS = 8.6, S = Math.sqrt(4 * Math.PI * RS * RS / n) * .6;
  const hex = new THREE.CircleGeometry(1, 6);
  const g = new THREE.InstancedBufferGeometry();
  g.index = hex.index; g.attributes.position = hex.attributes.position; g.attributes.uv = hex.attributes.uv;
  g.setAttribute('aDir', new THREE.InstancedBufferAttribute(new Float32Array(dirs), 3));
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(seed), 2));
  g.instanceCount = count;
  const u = { uBuild: { value: 0 }, uTime: { value: 0 }, uR: { value: RS }, uS: { value: S } };
  const panels = new THREE.Mesh(g, new THREE.ShaderMaterial({
    side: THREE.DoubleSide, uniforms: u,
    vertexShader: /* glsl */`
      attribute vec3 aDir; attribute vec2 aSeed; uniform float uBuild,uTime,uR,uS;
      varying vec3 vN,vW,vL; varying float vK;
      void main(){
        float st=aSeed.x*.68; float k=smoothstep(st,st+.32,uBuild); k=k*k*(3.-2.*k);
        float ang=aSeed.y*6.2832+uTime*(.06+.1*(1.-aSeed.x));
        float rr=11.+8.*aSeed.x;
        float tl=(aSeed.y-.5)*.9;
        vec3 o=vec3(cos(ang)*rr,(aSeed.x-.5)*.9+sin(ang)*rr*tl*.28,sin(ang)*rr);
        vec3 c=mix(o,aDir*uR,k);
        vec3 n=normalize(mix(normalize(o+vec3(0.,1.5*sin(aSeed.y*40.),0.)),aDir,k));
        vec3 t=normalize(cross(n,vec3(.31,.9,.17))), b=cross(n,t);
        vec3 p=c+(t*position.x+b*position.y)*uS*mix(.55,1.,k);
        vec4 w=modelMatrix*vec4(p,1.);
        vW=w.xyz; vN=mat3(modelMatrix)*n; vL=position; vK=k;
        gl_Position=projectionMatrix*viewMatrix*w;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vN,vW,vL; varying float vK; uniform float uTime;
      void main(){
        vec3 V=normalize(cameraPosition-vW), N=normalize(vN);
        float out_=dot(N,V);
        if(out_<0.){ // inner face, seen across the star's light
          gl_FragColor=vec4(vec3(2.2,.8,.16)*(.5+.5*smoothstep(.2,.95,length(vL.xy))),1.); return;
        }
        vec3 L=normalize(vec3(-.6,.5,.62)), H=normalize(L+V);
        float d=max(dot(N,L),0.);
        float sp=pow(max(dot(N,H),0.),70.);
        float r=length(vL.xy);
        vec3 base=mix(vec3(.05,.04,.03),vec3(.42,.29,.1),step(.72,r));
        vec3 col=base*(.12+d*1.5)+vec3(1.,.86,.62)*sp*.9;
        col+=vec3(1.5,.6,.13)*smoothstep(.9,1.,r)*vK*.8;
        float fr=pow(1.-out_,4.);
        col+=vec3(1.2,.55,.18)*fr*.4;
        gl_FragColor=vec4(col,1.);
      }`,
  }));
  panels.frustumCulled = false;

  const star = buildStar(5.7, starTex);

  const glowMat = (fs, uniforms = {}) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms,
    vertexShader: `varying vec2 vU; void main(){ vU=uv*2.-1.; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`, fragmentShader: fs,
  });
  // the sheet of light that escapes through the slit
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(76, 76), glowMat(`varying vec2 vU; uniform float uI;
    void main(){ float r=length(vU)*38.; float a=smoothstep(8.2,8.7,r)*exp(-(r-8.6)*.14)*(1.-smoothstep(30.,38.,r));
      gl_FragColor=vec4(vec3(1.,.66,.3)*a*.15*uI,1.); }`, { uI: { value: 0 } }));
  sheet.rotation.x = -Math.PI / 2;

  const group = new THREE.Group(); group.add(star.group, panels, sheet);
  return { group, panels, star, sheet, u };
}

/* ---------------- a spiral galaxy ---------------- */
function buildGalaxy(n) {
  const R = rng(55), P = new Float32Array(n * 3), C = new Float32Array(n * 3), S = new Float32Array(n * 2);
  const gauss = () => (R() + R() + R() + R() - 2) / 2;
  const arms = 4, K = 2.75;
  const col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    let x, y, z, size = .7 + Math.pow(R(), 7) * 5, r;
    const b = R();
    if (b < .17) {                                       // old warm bulge
      r = Math.pow(R(), 1.9) * 5.2;
      const a = R() * 6.2832, c = R() * 2 - 1, s = Math.sqrt(1 - c * c);
      x = r * s * Math.cos(a); y = r * c * .52; z = r * s * Math.sin(a);
      col.setRGB(1.25, .86 + R() * .1, .56);
    } else {
      r = 2.4 + Math.pow(R(), 1.35) * 23;
      const arm = Math.floor(R() * arms);
      const inArm = R() < .8;
      const sp = inArm ? gauss() * (.3 + .012 * r) : (R() - .5) * 6.28;
      const a = arm / arms * 6.2832 + Math.log(r) * K + sp;
      x = Math.cos(a) * r + gauss() * .35; z = Math.sin(a) * r + gauss() * .35;
      y = gauss() * (.24 + .3 * Math.exp(-r / 8));
      const t = Math.abs(sp) * 2.4;
      if (inArm && R() < .018) { col.setRGB(1.9, .46, .66); size *= 2.4; }   // star forming knots
      else if (inArm && t < .55) col.setRGB(.62 + R() * .3, .78 + R() * .15, 1.3);
      else col.setRGB(.95, .88, .84);
      if (!inArm) size *= .6;
    }
    P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
    C[i * 3] = col.r; C[i * 3 + 1] = col.g; C[i * 3 + 2] = col.b;
    S[i * 2] = size; S[i * 2 + 1] = r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.setAttribute('aS', new THREE.BufferAttribute(S, 2));
  const u = { uPx: { value: 1 }, uGain: { value: 1 } };
  const m = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: u, vertexColors: true,
    vertexShader: /* glsl */`
      attribute vec2 aS; uniform float uPx; varying vec3 vC; varying float vF;
      void main(){
        vec4 mv=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*mv;
        float s=aS.x*uPx*26./max(-mv.z,.4);
        gl_PointSize=clamp(s,1.,14.);
        vF=clamp(s/gl_PointSize,0.,1.);
        vC=color*smoothstep(.2,1.4,-mv.z);
      }`,
    fragmentShader: /* glsl */`
      uniform float uGain; varying vec3 vC; varying float vF;
      void main(){ float r=length(gl_PointCoord-.5)*2.; float a=exp(-r*r*4.2)*(1.-smoothstep(.8,1.,r)); gl_FragColor=vec4(vC*a*vF*.5*uGain,1.); }`,
  }));
  m.frustumCulled = false;
  m.userData.u = u;
  return m;
}


// --- sound.js
/**
 * Original score, synthesised live: slow pads, a sub, a glass arpeggio and a soft pulse.
 * Harmony and density follow the chapter on screen. D Dorian, 58 bpm.
 */
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const BEAT = 60 / 58, CHORD = BEAT * 8;

const C = {
  Dm9: [38, 57, 60, 64, 65, 69], Bb: [34, 53, 57, 62, 65, 72], F: [41, 57, 60, 64, 67, 72], C69: [36, 55, 62, 64, 67, 69],
  Gm9: [43, 58, 62, 65, 69, 70], Asus: [33, 57, 62, 64, 67, 71], Eb: [39, 55, 58, 62, 65, 70],
  void: [26, 50, 57, 63], thin: [38, 62, 69], open: [38, 57, 62, 66, 69, 76], Am9: [45, 60, 64, 67, 71, 74],
};
const SCORE = {
  hero: { prog: ['Dm9', 'Bb', 'F', 'Asus'], arp: .35, pulse: 0, cut: 900, verb: .55 },
  order: { prog: ['Gm9', 'Dm9', 'Bb', 'C69'], arp: .8, pulse: 0, cut: 1500, verb: .5 },
  ship: { prog: ['Dm9', 'F', 'C69', 'Asus'], arp: .4, pulse: .7, cut: 1200, verb: .45 },
  origin: { prog: ['F', 'Am9', 'Bb', 'C69'], arp: 1, pulse: 0, cut: 1900, verb: .6 },
  energy: { prog: ['Dm9', 'Eb', 'Dm9', 'Bb'], arp: .25, pulse: 1, cut: 1500, verb: .5 },
  hole: { prog: ['void', 'void', 'Eb', 'void'], arp: 0, pulse: .25, cut: 420, verb: .8 },
  scale: { prog: ['Bb', 'F', 'Gm9', 'Dm9'], arp: .5, pulse: 0, cut: 1300, verb: .85 },
  world: { prog: ['F', 'C69', 'Gm9', 'Bb'], arp: .85, pulse: .3, cut: 1800, verb: .55 },
  moon: { prog: ['thin', 'thin', 'void', 'thin'], arp: .1, pulse: 0, cut: 520, verb: .95 },
  end: { prog: ['Bb', 'F', 'Asus', 'open'], arp: .4, pulse: 0, cut: 1600, verb: .8 },
};

/** The audio graph and its notes. Works on a live or an offline context. */
class Score {
  constructor(c) {
    this.c = c; this.scene = SCORE.hero; this.i = 0; this.seed = 1;
    const out = this.out = c.createGain(); out.gain.value = .8;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = .02; comp.release.value = .3;
    out.connect(comp); comp.connect(c.destination);

    this.dry = c.createGain(); this.dry.gain.value = .75; this.dry.connect(out);
    this.fx = c.createGain(); this.fx.gain.value = .9; this.fx.connect(comp);   // effects ride above the ducked score
    this.wet = c.createGain(); this.wet.gain.value = .55;
    const conv = c.createConvolver(); conv.buffer = this.impulse(5.5); conv.connect(this.wet); this.wet.connect(out);
    this.verb = conv;

    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 900; this.lp.Q.value = .3;
    this.lp.connect(this.dry); this.lp.connect(conv);
    const wob = c.createOscillator(), wg = c.createGain(); wob.frequency.value = .043; wg.gain.value = 170;
    wob.connect(wg); wg.connect(this.lp.frequency); wob.start();

    this.delay = c.createDelay(2); this.delay.delayTime.value = BEAT * .75;
    const fb = c.createGain(); fb.gain.value = .42;
    this.echo = c.createGain(); this.echo.gain.value = .5;
    this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(this.dry); this.delay.connect(conv);
    this.echo.connect(this.delay); this.echo.connect(conv); this.echo.connect(this.dry);
  }

  impulse(sec) {
    const c = this.c, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let l = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n, w = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.8);
        l += (w - l) * (.5 - .42 * t);          // the tail darkens as it decays
        d[i] = l;
      }
    }
    return b;
  }

  rand() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }

  pad(notes, t, dur) {
    const c = this.c;
    notes.forEach((m, k) => {
      const f = mtof(m), g = c.createGain(), low = k === 0;
      const peak = low ? .17 : .05;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 2.6);
      g.gain.setValueAtTime(peak, t + dur - .5);
      g.gain.linearRampToValueAtTime(0, t + dur + 3.4);
      g.connect(low ? this.dry : this.lp);
      const voices = low ? [['sine', 0]] : [['sawtooth', -6], ['sawtooth', 6], ['triangle', 0]];
      for (const [type, cents] of voices) {
        const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = cents;
        o.connect(g); o.start(t); o.stop(t + dur + 3.6);
      }
    });
  }

  /** Two-operator FM bell: reads as glass over the pads. */
  bell(m, t, vol) {
    const c = this.c, f = mtof(m), o = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    o.frequency.value = f; mod.frequency.value = f * 3.01;
    mg.gain.setValueAtTime(f * 1.5, t); mg.gain.exponentialRampToValueAtTime(1, t + .9);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0002, t + 2.3);
    mod.connect(mg); mg.connect(o.frequency); o.connect(g); g.connect(this.echo);
    o.start(t); mod.start(t); o.stop(t + 2.4); mod.stop(t + 2.4);
  }

  thump(m, t, vol) {
    const c = this.c, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = mtof(m);
    lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(520, t); lp.frequency.exponentialRampToValueAtTime(110, t + .28);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0003, t + .36);
    o.connect(lp); lp.connect(g); g.connect(this.dry); o.start(t); o.stop(t + .4);
  }

  /** Queues one chord of music starting at t. */
  chord(t) {
    const s = this.scene, name = s.prog[this.i % s.prog.length], notes = C[name];
    this.i++;
    const c = this.c;
    this.lp.frequency.setTargetAtTime(s.cut, t, 2);
    this.wet.gain.setTargetAtTime(s.verb, t, 2);
    this.pad(notes, t, CHORD);
    const up = notes.slice(1), steps = 16, dt = CHORD / steps;
    for (let i = 0; i < steps; i++) {
      const at = t + i * dt;
      if (this.rand() < s.arp * (i % 4 === 0 ? .95 : i % 2 === 0 ? .5 : .24)) {
        const n = up[Math.floor(this.rand() * up.length)] + 12 * (this.rand() < .42 ? 2 : 1);
        this.bell(n, at + (this.rand() - .5) * .018, .05 + this.rand() * .05);
      }
      if (s.pulse && i % 2 === 0) this.thump(notes[0] + 12, at, .12 * s.pulse * (i % 8 === 0 ? 1.15 : .75));
    }
  }

  /** A soft breath of air between chapters. */
  swell(t) {
    const c = this.c, n = c.createBufferSource(), b = c.createBuffer(1, c.sampleRate * 2.6, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = b;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = .8;
    f.frequency.setValueAtTime(240, t); f.frequency.exponentialRampToValueAtTime(1800, t + 1.3); f.frequency.exponentialRampToValueAtTime(320, t + 2.6);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + 1.2); g.gain.linearRampToValueAtTime(0, t + 2.6);
    n.connect(f); f.connect(g); g.connect(this.verb); g.connect(this.dry); n.start(t);
  }
}

/** Filtered noise with a frequency sweep, the base of every effect in the finale. */
function sweep(c, dest, t, dur, f0, f1, g0, gPeak, peakAt, q = .7, type = 'bandpass') {
  const n = c.createBufferSource(), b = c.createBuffer(1, Math.ceil(c.sampleRate * Math.min(dur + .1, 3)), c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  n.buffer = b; n.loop = true;
  const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(g0, t);
  g.gain.linearRampToValueAtTime(gPeak, t + peakAt); g.gain.exponentialRampToValueAtTime(.0004, t + dur);
  n.connect(f); f.connect(g); g.connect(dest); n.start(t); n.stop(t + dur + .05);
  return g;
}
function drop(c, dest, t, dur, f0, f1, vol) {
  const o = c.createOscillator(), g = c.createGain();
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0004, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + .05);
}

class Sound {
  constructor() { this.on = false; this.name = 'hero'; }

  toggle() { this.on ? this.stop() : this.start(); return this.on; }

  start() {
    this.on = true;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { this.on = false; return; }
      this.ctx = new AC();
      this.score = new Score(this.ctx);
      this.score.scene = SCORE[this.name];
      this.score.out.gain.value = 0;
      this.next = this.ctx.currentTime + .1;
    }
    this.ctx.resume();
    this.score.out.gain.setTargetAtTime(.8, this.ctx.currentTime, 1.4);
    if (this.next < this.ctx.currentTime) this.next = this.ctx.currentTime + .1;
    this.timer ||= setInterval(() => this.pump(), 400);
    this.pump();
  }

  pump() {
    while (this.next < this.ctx.currentTime + 1.2) { this.score.chord(this.next); this.next += CHORD; }
  }

  stop() {
    this.on = false;
    if (!this.ctx) return;
    this.score.out.gain.setTargetAtTime(0, this.ctx.currentTime, .35);
    clearInterval(this.timer); this.timer = null;
    setTimeout(() => { if (!this.on) this.ctx.suspend(); }, 1600);
  }

  scene(name) {
    if (!SCORE[name]) return;
    this.name = name;
    if (this.score) { this.score.scene = SCORE[name]; this.score.i = 0; }
  }

  swell() { if (this.on) this.score.swell(this.ctx.currentTime); }

  /** Ducks the score, then plays the jump, the stop, the collapse and the blast at the given offsets. */
  finale(stopAt, boomAt) {
    if (!this.on) return;
    const c = this.ctx, t = c.currentTime, s = this.score, end = boomAt + 5;
    const o = s.out.gain; o.cancelScheduledValues(t); o.setTargetAtTime(.1, t, .15); o.setTargetAtTime(.8, t + end, 1.2);
    sweep(c, s.fx, t, stopAt, 180, 3200, .02, .42, stopAt * .9, 1.1);
    const w = c.createOscillator(), wg = c.createGain(); w.type = 'sawtooth';
    w.frequency.setValueAtTime(34, t); w.frequency.exponentialRampToValueAtTime(120, t + stopAt);
    wg.gain.setValueAtTime(0, t); wg.gain.linearRampToValueAtTime(.14, t + stopAt * .8); wg.gain.linearRampToValueAtTime(0, t + stopAt + .02);
    w.connect(wg); wg.connect(s.fx); w.start(t); w.stop(t + stopAt + .05);
    drop(c, s.fx, t + stopAt, .8, 96, 30, .9);
    sweep(c, s.fx, t + boomAt - .62, .66, 300, 5200, .001, .34, .6, .6, 'highpass');
    drop(c, s.fx, t + boomAt, 4.2, 68, 19, 1.1);
    sweep(c, s.fx, t + boomAt, 4.6, 4200, 90, .85, .85, .02, .4, 'lowpass');
    sweep(c, s.verb, t + boomAt, 3, 2600, 200, .34, .34, .02, .5, 'lowpass');
  }

  /** Final chord on acceptance: the piece resolves to D major. */
  resolve() {
    if (!this.on) return;
    const s = this.score; s.pad(C.open, this.ctx.currentTime + .05, CHORD);
    [62, 69, 74, 78, 81, 86].forEach((m, i) => s.bell(m, this.ctx.currentTime + .1 + i * .19, .09));
  }
}

/** Renders the score faster than real time so its levels can be measured. */
async function measure(names, chords = 3) {
  const res = {};
  for (const n of names) {
    const sr = 44100, len = Math.ceil((chords * CHORD + 5) * sr);
    const o = new OfflineAudioContext(2, len, sr), s = new Score(o);
    s.scene = SCORE[n];
    for (let i = 0; i < chords; i++) s.chord(.05 + i * CHORD);
    const b = await o.startRendering(), d = b.getChannelData(0);
    let peak = 0, sum = 0;
    for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; }
    res[n] = { peak: +peak.toFixed(3), rmsDb: +(10 * Math.log10(sum / d.length + 1e-12)).toFixed(1) };
  }
  return res;
}


// --- main.js












const canvas = document.getElementById('gl');
const params = new URLSearchParams(location.search);
const mobile = innerWidth < 760 || /Mobi|Android/i.test(navigator.userAgent);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------- timeline, in hundredths of a viewport of scroll ------- */
const SHOTS = [
  { id: 'hero', a: 0, b: 160 },
  { id: 'order', a: 160, b: 420 },
  { id: 'ship', a: 420, b: 760 },
  { id: 'origin', a: 760, b: 1000 },
  { id: 'energy', a: 1000, b: 1260 },
  { id: 'scale', a: 1260, b: 1510 },
  { id: 'world', a: 1510, b: 1770 },
  { id: 'moon', a: 1770, b: 2020 },
  { id: 'hole', a: 2020, b: 2290 },
  { id: 'end', a: 2290, b: 2600 },
];
const END = 2600, CUT = 46, BOOT_LEN = 1.9;
const LIGHT = { order: .973, origin: .976, world: .943 };   // background as shown on screen
const WAIT = { id: 'wait' }, WARP = { id: 'warp' }, NOVA = { id: 'nova' };
// finale clock, in seconds from the moment the camera crosses the horizon
const JUMP = 2.7, BOOM = JUMP + 2.5, DONE = BOOM + 3.7, TRIGGER = 2284, REST = 2580;
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
        const cost = id => { const d = (id === 'nova' ? 2290 : SHOTS.find(k => k.id === id).a) - here; return d < -40 ? 4000 - d : Math.abs(d); };
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
  const vh = () => scrollBox.offsetHeight / 27 || innerHeight;
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
  const skip = reduced || scrollY > 40 || params.has('skip');
  let bootT = skip ? 99 : 0;
  if (skip) { post.c.uCRT.value = 0; document.documentElement.classList.add('live'); }
  document.documentElement.classList.add('ready');

  let y = scrollY / vh() * 100, last = performance.now(), T = 0, slowRun = 0, frames = 0, cur_ = null, cardI = -1, cutSeen = -1;
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), tmp = new THREE.Vector3(), sunW = new THREE.Vector3(), qInv = new THREE.Quaternion(), tq = new THREE.Quaternion();
  const card = $('card'), nudge = $('nudge');
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
    if (cine === 'done' && y < 2200) cine = 'idle';
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
    const want = bootV >= 1 && s !== WAIT && cine !== 'play' && shut < .02 && pY < 2270 && (pY < 30 || now - idleAt > 5000);
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

