import * as THREE from 'three';
import { NOISE_GLSL, rng } from './lib.js';
import { FST } from './post.js';
import { bake } from './worlds.js';
import { wordPoints } from './hole.js';

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
export function starSurface(renderer, size) {
  shared ||= bake(renderer, size, size / 2, surfaceBake, 16, false);
  return shared;
}

export function buildStar(radius, tex) {
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
export function buildWarp() {
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
export function buildBlast() {
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
export function buildDust(n) {
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
