import * as THREE from 'three';
import { FST } from './post.js';
import { rng } from './lib.js';

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

export async function buildMoon(renderer, size) {
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

export async function buildPlanet(renderer, size, segU = 460, segV = 230) {
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

export function buildDebris(n) {
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
