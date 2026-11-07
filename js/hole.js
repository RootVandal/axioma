import * as THREE from 'three';
import { rng } from './lib.js';

export const WORDMARK = 'M0 150 L65 10 L130 150 M174 10 L304 150 M304 10 L174 150 M368 10 V150 M412 80 a70 70 0 1 0 140 0 a70 70 0 1 0 -140 0 M596 150 V10 L666 112 L736 10 V150 M780 150 L845 10 L910 150';

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
export function buildHole(n) {
  const R = rng(7), seed = new Float32Array(n * 4);
  for (let i = 0; i < n * 4; i += 4) {
    seed[i] = R(); seed[i + 1] = R() * 6.2832; seed[i + 2] = (R() + R() + R() - 1.5) / 1.5; seed[i + 3] = R();
  }
  const q = new THREE.InstancedBufferGeometry();
  q.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  q.setIndex([0, 1, 2, 0, 2, 3]);
  q.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  q.setAttribute('aWord', new THREE.InstancedBufferAttribute(wordPoints(n, 15), 3));
  q.instanceCount = n;
  const u = {
    uTime: { value: 0 }, uMorph: { value: 0 }, uLens: { value: 1 }, uFall: { value: 0 }, uAspect: { value: 1 }, uPx: { value: 1 },
    uGain: { value: 1 }, uCenter: { value: new THREE.Vector3() }, uTilt: { value: new THREE.Matrix4() }, uBlast: { value: 0 },
  };
  const m = new THREE.Mesh(q, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, uniforms: u, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute vec4 aSeed; attribute vec3 aWord;
      uniform float uTime,uMorph,uLens,uFall,uAspect,uPx,uBlast; uniform vec3 uCenter; uniform mat4 uTilt;
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

        float st=fract(aSeed.w*7.3)*.5;
        float mk=smoothstep(st,st+.5,uMorph);
        mk=mk*mk*(3.-2.*mk);
        vec3 word=uCenter+aWord;
        word.xy+=vec2(sin(uTime*.7+aSeed.y*9.),cos(uTime*.6+aSeed.w*9.))*.008;
        word+=normalize(vec3(sin(aSeed.y*7.),aSeed.z,cos(aSeed.y*3.)))*uBlast*(.25+1.9*aSeed.w*aSeed.w);
        vec3 p=mix(disc,word,mk);
        tang=mix(tang,vec3(.1,1.,0.),mk);

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
