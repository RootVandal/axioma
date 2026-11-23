import * as THREE from 'three';
import { merge, rng } from './lib.js';
import { buildStar } from './star.js';

/* ---------------- a glass double helix that unzips ---------------- */
class Strand extends THREE.Curve {
  constructor(turns, H, R, ph) { super(); Object.assign(this, { turns, H, R, ph }); }
  getPoint(t, out = new THREE.Vector3()) {
    const a = t * this.turns * 6.28318 + this.ph;
    return out.set(Math.cos(a) * this.R, (t - .5) * this.H, Math.sin(a) * this.R);
  }
}

export function buildHelix(q = 1) {
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
export function buildDyson(n, starTex) {
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
export function buildGalaxy(n) {
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
