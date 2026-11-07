import * as THREE from 'three';
import { merge, rng, lerp } from './lib.js';

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

export function buildShip(detail = 1) {
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
export function buildEnv(renderer) {
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
