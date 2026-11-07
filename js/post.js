import * as THREE from 'three';
import { NOISE_GLSL } from './lib.js';

export const FST = new THREE.BufferGeometry();
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

export class Post {
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
