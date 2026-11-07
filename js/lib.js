import * as THREE from 'three';

export const asset = p => (window.__ASSETS && window.__ASSETS[p]) || p;

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

const texLoader = new THREE.TextureLoader();
export function tex(path, { srgb = false, repeat = false, aniso = 8, flip = true } = {}) {
  return new Promise((res, rej) => texLoader.load(asset(path), t => {
    t.flipY = flip;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    res(t);
  }, undefined, rej));
}

/** Compact mesh container written by tools/prep_assets.py */
export async function loadMesh(path) {
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
export function merge(list) {
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
export function track(keys, u) {
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

export const NOISE_GLSL = /* glsl */`
float hash12(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x),mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<6;i++){ s+=a*vnoise(p); p=m*p+7.1; a*=.5; } return s; }
`;

/** Shared low-frequency sway so bark, leaves and fruit move together. */
export const SWAY_GLSL = /* glsl */`
uniform float uTime; uniform float uWind;
vec3 sway(vec3 wp, float reach){
  float t=uTime*.9; float k=reach*reach;
  vec3 d=vec3(sin(t+wp.x*.35+wp.y*.2)+.5*sin(t*2.3+wp.z*.6), .3*sin(t*1.7+wp.x), cos(t*.8+wp.z*.4)+.5*sin(t*1.9+wp.y*.7));
  return d*k*.045*uWind;
}
`;
