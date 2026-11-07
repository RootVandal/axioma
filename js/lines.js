import * as THREE from 'three';
import { rng } from './lib.js';

const FILM = /* glsl */`
vec3 film(float t){ return .5+.5*cos(6.28318*(vec3(1.,.92,.85)*t+vec3(.02,.36,.66))); }
`;

/** Thousands of hair-thin lines wound around a torus; shape and colour live in the shader. */
export function buildTorus(lines, segs) {
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
export function buildAttractor(runs, steps) {
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

export function buildStars(n, seed = 1) {
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
