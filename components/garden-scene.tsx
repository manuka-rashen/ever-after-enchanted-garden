"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CubeCamera, MeshRefractionMaterial, Detailed, useTexture } from "@react-three/drei";
import { Bloom, DepthOfField, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import { createNoise3D } from "simplex-noise";
import gsap from "gsap";
import { assetUrl } from "@/lib/site";
import { type MotionState } from "@/lib/invitation";

type MotionRef = MutableRefObject<MotionState>;
type Quality = "high" | "low";
const clamp = THREE.MathUtils.clamp;
const smooth = (a:number,b:number,v:number)=>THREE.MathUtils.smoothstep(v,a,b);
function seeded(seed:number) { return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;}; }

function makePetal(kind:number,detail=12) {
  const geometry = new THREE.PlaneGeometry(1,1,Math.max(3,detail/2),detail);
  const pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++) {
    const u=pos.getX(i)*2,v=pos.getY(i)+.5;
    const width=kind===0?.19:kind===1?.27:kind===2?.5:.43;
    const shape=Math.pow(Math.sin(Math.PI*v),kind===1?.6:.4);
    const length=kind===0?.65:kind===1?1.08:kind===2?.7:.77;
    pos.setXYZ(i,u*shape*width,v*length,(Math.pow(v,2)*.24+u*u*.12)*(kind===2?1.8:1));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function makePetalMaterial(color:string,uniforms:{growth:{value:number};time:{value:number}}) {
  // Three.js exposes transmission, not a `translucency` switch. Add a soft
  // backlight term while keeping a separate shader-controlled growth fade.
  const mat=new THREE.MeshPhysicalMaterial({color,roughness:.68,metalness:0,side:THREE.DoubleSide,transmission:.3,thickness:.12,ior:1.35,attenuationColor:new THREE.Color(color),attenuationDistance:1.5,transparent:true,depthWrite:false});
  mat.onBeforeCompile=shader=>{
    shader.uniforms.uGrowth=uniforms.growth;shader.uniforms.uTime=uniforms.time;
    shader.vertexShader="uniform float uGrowth; uniform float uTime; attribute float aDelay; varying float vBloom;\n"+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>",`
      float bloom = smoothstep(aDelay, aDelay + 0.23, uGrowth);
      vBloom = bloom;
      vec3 transformed = position * mix(0.035, 1.0, bloom);
      float angle = mix(1.28, -0.24, bloom);
      float cy = cos(angle), sy = sin(angle);
      transformed.yz = mat2(cy,-sy,sy,cy) * transformed.yz;
      transformed.z += sin(uTime * .7 + aDelay * 31.0) * .017 * position.y * bloom;
    `);
    shader.fragmentShader="varying float vBloom;\n"+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\n diffuseColor.a *= smoothstep(0.0, 0.3, vBloom);");
    shader.fragmentShader=shader.fragmentShader.replace("#include <opaque_fragment>","outgoingLight += diffuseColor.rgb * 0.14 * pow(1.0 - abs(normal.z), 2.0);\n#include <opaque_fragment>");
  };
  mat.customProgramCacheKey=()=>"garden-petal-growth-v1";
  return mat;
}

function FlowerBatch({kind,motion,detail=12}:{kind:number;motion:MotionRef;detail?:number}) {
  const mesh=useRef<THREE.InstancedMesh>(null);
  const stems=useRef<THREE.InstancedMesh>(null), leaves=useRef<THREE.InstancedMesh>(null), centers=useRef<THREE.InstancedMesh>(null);
  const uniforms=useMemo(()=>({growth:{value:.26},time:{value:0}}),[]);
  const data=useMemo(()=>{
    const rng=seeded(621+kind),flowers=kind<2?22:12,petals=kind===0?12:kind===1?6:kind===2?22:7;
    const items:{matrix:THREE.Matrix4;delay:number}[]=[];
    const centers:{position:[number,number,number];scale:number}[]=[];
    const obj=new THREE.Object3D(),rot=new THREE.Quaternion(),q=new THREE.Quaternion();
    for(let i=0;i<flowers;i++) {
      const side=i%2===0?-1:1;
      const z=2.5-rng()*14;
      const x=side*(3.8+rng()*3.1+Math.sin(z*.5)*.6);
      const y=-2.6-rng()*1.5;
      const scale=.24+rng()*.3;
      centers.push({position:[x,y,z],scale});
      for(let j=0;j<petals;j++) {
        const layer=kind===2?Math.floor(j/7):0,angle=j/(kind===2?7:petals)*Math.PI*2+layer*.7;
        obj.position.set(x,y,z);
        rot.setFromEuler(new THREE.Euler(-.2+layer*.24,.15*side,angle));
        q.setFromAxisAngle(new THREE.Vector3(0,1,0),side*.15);rot.multiply(q);obj.quaternion.copy(rot);
        obj.scale.setScalar(scale*(1-layer*.16));obj.updateMatrix();
        items.push({matrix:obj.matrix.clone(),delay:Math.min(.7,(2.5-z)/19)*.75+kind*.035});
      }
    }
    return {items,centers};
  },[kind]);
  const geometry=useMemo(()=>{
    const geo=makePetal(kind,detail);
    geo.setAttribute("aDelay",new THREE.InstancedBufferAttribute(new Float32Array(data.items.map(i=>i.delay)),1));return geo;
  },[kind,detail,data]);
  const material=useMemo(()=>makePetalMaterial(["#f8f6eb","#edcbdc","#d8a7b1","#b088b7"][kind],uniforms),[kind,uniforms]);
  useEffect(()=>{
    if(!mesh.current)return;data.items.forEach((v,i)=>mesh.current!.setMatrixAt(i,v.matrix));mesh.current.instanceMatrix.needsUpdate=true;
    const obj=new THREE.Object3D();
    data.centers.forEach((flower,i)=>{
      obj.position.set(flower.position[0],flower.position[1]-.48,flower.position[2]);obj.rotation.set(0,0,0);obj.scale.set(1,1,1);obj.updateMatrix();stems.current?.setMatrixAt(i,obj.matrix);
      obj.position.set(flower.position[0]+.14,flower.position[1]-.3,flower.position[2]);obj.rotation.z=-.7;obj.scale.set(.27,.1,.045);obj.updateMatrix();leaves.current?.setMatrixAt(i,obj.matrix);
      obj.position.set(...flower.position);obj.rotation.set(0,0,0);obj.scale.setScalar(flower.scale*.13);obj.updateMatrix();centers.current?.setMatrixAt(i,obj.matrix);
    });
    for(const batch of [stems,leaves,centers])if(batch.current)batch.current.instanceMatrix.needsUpdate=true;
    return ()=>{geometry.dispose();material.dispose();};
  },[data,geometry,material]);
  useFrame((_,delta)=>{if(!motion.current.paused&&!motion.current.reduced){uniforms.time.value+=Math.min(delta,.05);uniforms.growth.value=.26+motion.current.progress*1.28;}else if(motion.current.reduced)uniforms.growth.value=1;});
  return <group><instancedMesh ref={mesh} args={[geometry,material,data.items.length]} frustumCulled={false}/>
    <instancedMesh ref={stems} args={[undefined,undefined,data.centers.length]} frustumCulled={false}><cylinderGeometry args={[.015,.023,.95,5]}/><meshStandardMaterial color="#435b4d" roughness={.8}/></instancedMesh>
    <instancedMesh ref={leaves} args={[undefined,undefined,data.centers.length]} frustumCulled={false}><sphereGeometry args={[1,6,4]}/><meshStandardMaterial color="#738678" roughness={.7}/></instancedMesh>
    {kind<2&&<instancedMesh ref={centers} args={[undefined,undefined,data.centers.length]} frustumCulled={false}><sphereGeometry args={[1,8,6]}/><meshStandardMaterial color="#d1a24a" emissive="#80601e" emissiveIntensity={.2}/></instancedMesh>}
  </group>;
}

function GardenBackdrop(){
  const texture=useTexture(assetUrl("garden.webp")),{scene,size}=useThree();
  useEffect(()=>{texture.colorSpace=THREE.SRGBColorSpace;const aspect=size.width/size.height,imageAspect=1.5;texture.repeat.set(Math.min(1,aspect/imageAspect),Math.min(1,imageAspect/aspect));texture.offset.set((1-texture.repeat.x)/2,(1-texture.repeat.y)/2);texture.updateMatrix();scene.background=texture;scene.backgroundIntensity=.32;return()=>{scene.background=null;};},[texture,scene,size]);
  return null;
}

function ButterflyFlock({motion}:{motion:MotionRef}) {
  const ref=useRef<THREE.InstancedMesh>(null),time=useRef(0);
  const noise=useMemo(()=>createNoise3D(seeded(72)),[]);
  const objects=useMemo(()=>{const rng=seeded(45);return Array.from({length:26},(_,i)=>({phase:rng()*10,speed:4+rng()*3,x:(rng()-.5)*13,y:(rng()-.5)*5,z:(rng()-.5)*12,scale:.065+rng()*.05,side:i%2?1:-1}));},[]);
  const uniform=useMemo(()=>({value:0}),[]);
  const geometry=useMemo(()=>{
    const wings=[-1,1].map(side=>{const wing=new THREE.Shape();wing.moveTo(0,0);wing.bezierCurveTo(side*.3,.85,side*1.15,.9,side*.92,.3);wing.bezierCurveTo(side*.87,.08,side*.62,-.05,side*.45,-.03);wing.bezierCurveTo(side*.96,-.18,side*.64,-.83,side*.28,-.57);wing.bezierCurveTo(side*.12,-.45,side*.08,-.16,0,0);return wing;});
    const geo=new THREE.ShapeGeometry(wings,10);
    const pos=geo.attributes.position,uv=geo.attributes.uv;for(let i=0;i<pos.count;i++)uv.setXY(i,(pos.getX(i)+1)/2,(pos.getY(i)+.85)/1.7);
    geo.setAttribute("aPhase",new THREE.InstancedBufferAttribute(new Float32Array(objects.map(v=>v.phase)),1));
    geo.setAttribute("aSpeed",new THREE.InstancedBufferAttribute(new Float32Array(objects.map(v=>v.speed)),1));return geo;
  },[objects]);
  const texture=useMemo(()=>{
    const pixels=new Uint8Array(128*64*4);
    for(let y=0;y<64;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4,u=Math.abs(x-64)/64,v=y/64;const vein=Math.pow(Math.abs(Math.sin(u*28+v*12)),16);pixels[i]=150+80*Math.sin(u*2);pixels[i+1]=145+70*v;pixels[i+2]=215+35*u;pixels[i+3]=Math.round((1-vein*.3)*255);}
    const tex=new THREE.DataTexture(pixels,128,64,THREE.RGBAFormat);tex.needsUpdate=true;tex.colorSpace=THREE.SRGBColorSpace;return tex;
  },[]);
  const material=useMemo(()=>{
    const mat=new THREE.MeshBasicMaterial({map:texture,color:"#c3ccef",side:THREE.DoubleSide,transparent:true,opacity:.8});
    mat.onBeforeCompile=s=>{s.uniforms.uTime=uniform;s.vertexShader="uniform float uTime; attribute float aPhase; attribute float aSpeed;\n"+s.vertexShader;s.vertexShader=s.vertexShader.replace("#include <begin_vertex>",`vec3 transformed = position; float flap=sin(uTime*aSpeed+aPhase)*1.05; transformed.x=position.x*cos(flap); transformed.z=abs(position.x)*sin(flap);`);};
    mat.customProgramCacheKey=()=>"butterfly-hinge-v1";return mat;
  },[uniform,texture]);
  const dummy=useMemo(()=>new THREE.Object3D(),[]);
  useFrame((_,delta)=>{
    if(!ref.current)return;const stopped=motion.current.paused||motion.current.reduced;if(!stopped)time.current+=Math.min(delta,.05);const t=time.current;uniform.value=t;
    objects.forEach((v,i)=>{const n=noise(v.phase,t*.1,0),cross=i<3?Math.sin(t*.14+v.phase)*4:0;dummy.position.set(v.x+noise(v.phase,t*.12,1)*1.5+cross,v.y+n*.9, v.z+noise(v.phase,t*.09,2));dummy.rotation.set(.3*Math.sin(t+v.phase),Math.sin(t*.4+v.phase)*.7,Math.sin(t*.7+v.phase)*.35);dummy.scale.setScalar(v.scale);dummy.updateMatrix();ref.current!.setMatrixAt(i,dummy.matrix);});ref.current.instanceMatrix.needsUpdate=true;
  });
  useEffect(()=>()=>{geometry.dispose();material.dispose();texture.dispose();},[geometry,material,texture]);
  return <instancedMesh args={[geometry,material,26]} ref={ref} frustumCulled={false}/>;
}

function FairyDust({motion,burst=false}:{motion:MotionRef;burst?:boolean}) {
  const ref=useRef<THREE.Points>(null),t=useRef(0);
  const geometry=useMemo(()=>{const rng=seeded(burst?10:9),count=burst?150:230,g=new THREE.BufferGeometry(),pos=new Float32Array(count*3);for(let i=0;i<count;i++){pos[i*3]=(rng()-.5)*(burst?3:22);pos[i*3+1]=(rng()-.5)*(burst?3:11);pos[i*3+2]=(rng()-.5)*(burst?3:17);}g.setAttribute("position",new THREE.BufferAttribute(pos,3));return g;},[burst]);
  const mat=useMemo(()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uTime:{value:0},uBurst:{value:0},uIsBurst:{value:burst?1:0}},vertexShader:`uniform float uTime;uniform float uBurst;uniform float uIsBurst;varying float vFade;void main(){vec3 p=position;p.x+=sin(uTime*.27+position.y*4.)*.16;p.y+=sin(uTime*.34+position.x*3.)*.22;if(uIsBurst>.5)p*=mix(.1,2.8,uBurst);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(32./-mv.z,1.5,8.);vFade=.45+.5*sin(uTime+position.x*5.);if(uIsBurst>.5)vFade*=sin(uBurst*3.14159);}`,fragmentShader:`varying float vFade;void main(){float d=length(gl_PointCoord-.5);float glow=smoothstep(.5,.0,d);gl_FragColor=vec4(vec3(1.,.86,.56)*1.7,glow*vFade);}`}),[burst]);
  useFrame((_,delta)=>{if(!motion.current.paused&&!motion.current.reduced){t.current+=Math.min(delta,.05);if(burst)mat.uniforms.uBurst.value=clamp((motion.current.ring-.38)/.35,0,1);}mat.uniforms.uTime.value=t.current;if(burst&&motion.current.reduced)mat.uniforms.uBurst.value=0;});
  useEffect(()=>()=>{geometry.dispose();mat.dispose();},[geometry,mat]);
  return <points ref={ref} geometry={geometry} material={mat} frustumCulled={false}/>;
}

function FogLayers({motion}:{motion:MotionRef}) {
  const uniforms=useMemo(()=>({uTime:{value:0}}),[]);
  useFrame((_,delta)=>{if(!motion.current.paused&&!motion.current.reduced)uniforms.uTime.value+=Math.min(delta,.05);});
  return <group>{[-5,-9,-14].map((z,i)=><mesh key={z} position={[0,-1,z]}><planeGeometry args={[26,12]}/><shaderMaterial transparent depthWrite={false} uniforms={uniforms} vertexShader="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}" fragmentShader={`uniform float uTime;varying vec2 vUv;void main(){float n=sin(vUv.x*11.+uTime*.09+${i}.0)*sin(vUv.y*8.+uTime*.04);float f=smoothstep(.55,0.,abs(vUv.y-.3));gl_FragColor=vec4(.22,.16,.37,(.02+n*.014)*f);}`}/></mesh>)}</group>;
}

function pageTexture(page:number) {
  const c=document.createElement("canvas");c.width=768;c.height=1024;const ctx=c.getContext("2d")!;
  ctx.fillStyle="#efe4ca";ctx.fillRect(0,0,768,1024);
  const gradient=ctx.createLinearGradient(0,0,768,0);gradient.addColorStop(0,"#b5a385");gradient.addColorStop(.12,"#efe4ca");gradient.addColorStop(1,"#fff4dc");ctx.fillStyle=gradient;ctx.fillRect(0,0,768,1024);
  ctx.strokeStyle="#b99d68";ctx.lineWidth=2;ctx.strokeRect(40,40,688,944);
  ctx.textAlign="center";ctx.fillStyle="#74603f";ctx.font="24px Georgia";ctx.fillText("KAVINDU & METHMI",384,145);
  ctx.font="italic 62px Georgia";ctx.fillStyle="#5b442e";const titles=["Once upon","Rooted in","And so,"];const subtitles=["a time…","heritage.","forever begins."];ctx.fillText(titles[page],384,360);ctx.fillText(subtitles[page],384,438);
  ctx.font="28px Georgia";ctx.fillStyle="#786347";const lines=page===0?["Two journeys, one story.","A love to last a lifetime."]:page===1?["With the blessings", "of our families."]:["28 November 2027","Shangri-La, Colombo"];
  lines.forEach((line,i)=>ctx.fillText(line,384,570+i*49));
  ctx.fillStyle="#b99d68";ctx.fillRect(320,735,128,1);ctx.font="25px Georgia";ctx.fillText("✦",384,805);ctx.font="20px Georgia";ctx.fillText(`— ${page+1} —`,384,925);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}

function Storybook({motion,quality}:{motion:MotionRef;quality:Quality}) {
  const group=useRef<THREE.Group>(null),cover=useRef<THREE.Group>(null),leaf=useRef<THREE.Group>(null),page=useRef(0),turn=useRef({value:0}),tick=useRef(0);
  const {camera,viewport,size}=useThree();
  const portrait=useTexture(assetUrl("couple-illustration.webp"));
  const textures=useMemo(()=>[0,1,2].map(pageTexture),[]);
  const [pageIndex,setPageIndex]=useState(0);
  useEffect(()=>{portrait.colorSpace=THREE.SRGBColorSpace;return ()=>textures.forEach(t=>t.dispose());},[portrait,textures]);
  useFrame((_,delta)=>{
    if(!group.current)return;const p=motion.current.book;
    const el=document.querySelector(".story-portrait");if(!el)return;const rect=el.getBoundingClientRect();
    const visible=rect.bottom>0&&rect.top<size.height;group.current.visible=visible;if(!visible)return;
    if(!motion.current.paused&&!motion.current.reduced)tick.current+=Math.min(delta,.05);
    const view=viewport.getCurrentViewport(camera,new THREE.Vector3(0,0,0));
    group.current.position.set(((rect.left+rect.width/2)/size.width-.5)*view.width,(.5-(rect.top+Math.min(rect.height,530)/2)/size.height)*view.height,0);
    const desired=(rect.width/size.width)*view.width;group.current.scale.setScalar(desired/4.65);
    group.current.rotation.set(-.13,Math.sin(tick.current*.3)*.04-.07,.015);
    if(cover.current){const opening=motion.current.reduced||motion.current.paused?1:smooth(.06,.32,p);cover.current.rotation.y=-Math.PI*opening;cover.current.position.z=THREE.MathUtils.lerp(.15,-.18,opening);}
    if(leaf.current){leaf.current.rotation.y=-Math.PI*turn.current.value;leaf.current.visible=turn.current.value>.001&&turn.current.value<.999;}
    if(motion.current.paused||motion.current.reduced){gsap.killTweensOf(turn.current);turn.current.value=1;}
    if(page.current!==motion.current.page){page.current=motion.current.page;setPageIndex(page.current);turn.current.value=0;gsap.to(turn.current,{value:1,duration:motion.current.reduced||motion.current.paused?.01:1.35,ease:"power2.inOut"});}
  });
  useEffect(()=>()=>gsap.killTweensOf(turn.current),[]);
  return <group ref={group}>
    <mesh position={[0,-2.15,-.2]}><cylinderGeometry args={[1.65,1.82,.3,quality==="high"?48:20]}/><meshPhysicalMaterial color="#625d72" metalness={.6} roughness={.18}/></mesh>
    <mesh position={[0,-2.75,-.2]}><cylinderGeometry args={[.54,.8,1,quality==="high"?32:12]}/><meshStandardMaterial color="#302d40" metalness={.3} roughness={.35}/></mesh>
    <group position={[0,0,.15]} rotation={[.05,0,0]}>
      <mesh position={[0,0,-.14]}><boxGeometry args={[4.65,3.55,.16]}/><meshStandardMaterial color="#372643" roughness={.6} metalness={.2}/></mesh>
      <mesh position={[0,0,-.045]}><boxGeometry args={[4.4,3.36,.16]}/><meshStandardMaterial color="#e2d1ab" roughness={.85}/></mesh>
      <mesh position={[-1.12,0,.055]}><planeGeometry args={[2.17,3.3]}/><meshStandardMaterial map={portrait} roughness={.82}/></mesh>
      <mesh position={[1.12,0,.06]}><planeGeometry args={[2.17,3.3]}/><meshStandardMaterial map={textures[pageIndex]} roughness={.82}/></mesh>
      <mesh position={[0,0,.1]}><cylinderGeometry args={[.055,.055,3.36,10]}/><meshStandardMaterial color="#c8ad75" roughness={.5}/></mesh>
      <group ref={leaf} position={[0,0,.08]}><mesh position={[1.1,0,0]}><planeGeometry args={[2.2,3.3,20,2]}/><meshStandardMaterial map={textures[(pageIndex+2)%3]} side={THREE.DoubleSide} roughness={.8}/></mesh></group>
      <group ref={cover} position={[0,0,.15]}>
        <mesh position={[1.16,0,0]}><boxGeometry args={[2.33,3.55,.095]}/><meshStandardMaterial color="#392143" metalness={.24} roughness={.5}/></mesh>
        <mesh position={[1.16,0,.052]}><planeGeometry args={[2.13,3.35]}/><meshStandardMaterial color="#8d7850" metalness={.8} roughness={.25}/></mesh>
        <mesh position={[1.16,0,.056]}><planeGeometry args={[2.08,3.30]}/><meshStandardMaterial color="#31213d" roughness={.6}/></mesh>
        <mesh position={[1.16,0,.08]} rotation={[0,0,Math.PI/4]}><ringGeometry args={[.32,.345,4]}/><meshStandardMaterial color="#f3e5ab" metalness={.8} roughness={.2}/></mesh>
      </group>
    </group>
    <pointLight position={[0,0,2]} color="#ffe0a0" intensity={4} distance={7}/>
  </group>;
}

function Diamond({texture,quality}:{texture:THREE.Texture;quality:Quality}) {
  return <mesh position={[0,.99,0]} rotation={[0,0,Math.PI/4]} scale={[.29,.24,.29]}><octahedronGeometry args={[1,0]}/>{quality==="high"?<MeshRefractionMaterial envMap={texture} ior={2.42} bounces={2} aberrationStrength={.025} fresnel={.85} color="#fff9ed" fastChroma/>:<meshPhysicalMaterial color="#fff8ee" metalness={.15} roughness={.025} transmission={.95} thickness={.5} ior={2.42} dispersion={.3} envMap={texture}/>}</mesh>;
}

function Rings({motion,quality}:{motion:MotionRef;quality:Quality}) {
  const group=useRef<THREE.Group>(null),left=useRef<THREE.Group>(null),right=useRef<THREE.Group>(null),flare=useRef<THREE.Mesh>(null),time=useRef(0);
  const {camera,viewport,size}=useThree();
  useFrame((_,delta)=>{
    if(!group.current||!left.current||!right.current)return;
    const el=document.querySelector("#union");if(!el)return;const rect=el.getBoundingClientRect();group.current.visible=rect.bottom>0&&rect.top<size.height;if(!group.current.visible)return;
    const view=viewport.getCurrentViewport(camera,new THREE.Vector3(0,0,0));
    group.current.position.set(0,(.5-(rect.top+rect.height*.52)/size.height)*view.height,0);
    group.current.scale.setScalar(Math.min(1.18,view.width/4.2));
    const p=motion.current.reduced||motion.current.paused?1:smooth(.12,.46,motion.current.ring);if(!motion.current.paused&&!motion.current.reduced)time.current+=Math.min(delta,.05);const t=time.current;
    left.current.position.set(THREE.MathUtils.lerp(-3.4,-.48,p),Math.sin(t*.7)*.045,0);
    right.current.position.set(THREE.MathUtils.lerp(3.4,.46,p),.08+Math.sin(t*.7+1)*.055,.1);
    left.current.rotation.set(.22,THREE.MathUtils.lerp(-1.1,.48,p)+Math.sin(t*.2)*.035,-.34);
    right.current.rotation.set(-.23,THREE.MathUtils.lerp(1.1,-.44,p)+Math.sin(t*.2)*.035,.35);
    if(flare.current){const shine=motion.current.paused||motion.current.reduced?0:Math.sin(clamp((motion.current.ring-.4)/.2,0,1)*Math.PI);flare.current.scale.setScalar(.3+shine*1.7);(flare.current.material as THREE.ShaderMaterial).uniforms.uStrength.value=shine;}
  });
  return <group ref={group}>
    <CubeCamera resolution={quality==="high"?128:64} frames={1} near={.1} far={30}>{texture=><group>
      <group ref={left}><Detailed distances={[0,10]} hysteresis={.12}>{[96,32].map(detail=><mesh key={detail}><torusGeometry args={[.89,.135,quality==="high"?16:8,detail]}/><meshPhysicalMaterial color="#efd18b" metalness={1} roughness={.1} envMap={texture} envMapIntensity={2.8}/></mesh>)}</Detailed><mesh position={[0,0,.112]}><torusGeometry args={[.89,.026,8,64]}/><meshStandardMaterial color="#ae873c" metalness={1} roughness={.19} envMap={texture}/></mesh></group>
      <group ref={right}><Detailed distances={[0,10]} hysteresis={.12}>{[96,32].map(detail=><mesh key={detail}><torusGeometry args={[.83,.079,quality==="high"?14:7,detail]}/><meshPhysicalMaterial color="#edce88" metalness={1} roughness={.1} envMap={texture} envMapIntensity={2.8}/></mesh>)}</Detailed><Diamond texture={texture} quality={quality}/>{[-1,1].map(x=><mesh key={x} position={[x*.14,.94,.06]} rotation={[0,0,x*.3]}><cylinderGeometry args={[.022,.022,.25,6]}/><meshStandardMaterial color="#f4d98f" metalness={1} roughness={.1} envMap={texture}/></mesh>)}</group>
    </group>}</CubeCamera>
    <FairyDust motion={motion} burst/>
    <mesh ref={flare} position={[0,.22,.6]}><planeGeometry args={[2,2]}/><shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} uniforms={{uStrength:{value:0}}} vertexShader="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}" fragmentShader="uniform float uStrength;varying vec2 vUv;void main(){vec2 p=vUv-.5;float a=exp(-length(p)*16.);float b=exp(-abs(p.x)*170.)*exp(-abs(p.y)*12.);float c=exp(-abs(p.y)*200.)*exp(-abs(p.x)*9.);gl_FragColor=vec4(1.,.9,.65,(a+b+c)*uStrength);}"/></mesh>
    <pointLight color="#ffdaa0" position={[-2,2,3]} intensity={14} distance={9}/><pointLight color="#b8bdff" position={[2,0,2]} intensity={8} distance={8}/>
  </group>;
}

function GardenEffects({motion,quality}:{motion:MotionRef;quality:Quality}) {
  const [macro,setMacro]=useState(false);
  useFrame(()=>{const active=motion.current.ring>.12&&motion.current.ring<.85;if(active!==macro)setMacro(active);});
  return quality==="high"&&macro?<EffectComposer multisampling={2} enableNormalPass={false}><Bloom luminanceThreshold={1.1} intensity={.4} mipmapBlur/><DepthOfField focusDistance={.13} focalLength={.07} bokehScale={1.3} height={360}/></EffectComposer>:<EffectComposer multisampling={0} enableNormalPass={false}><Bloom luminanceThreshold={1.1} intensity={quality==="high"?.3:.16} mipmapBlur/></EffectComposer>;
}

function SceneWorld({motion,quality,onSlow}:{motion:MotionRef;quality:Quality;onSlow:()=>void}) {
  const {camera,gl}=useThree();const frames=useRef({time:0,count:0,checked:false}),spot=useRef<THREE.PointLight>(null),pointer=useRef({x:0,y:0});
  useEffect(()=>{
    document.documentElement.classList.add("webgl-ready");
    const move=(event:PointerEvent)=>{pointer.current.x=(event.clientX/window.innerWidth-.5)*.22;pointer.current.y=(event.clientY/window.innerHeight-.5)*.14;};
    window.addEventListener("pointermove",move,{passive:true});
    const lost=()=>document.documentElement.classList.remove("webgl-ready");gl.domElement.addEventListener("webglcontextlost",lost);
    return ()=>{document.documentElement.classList.remove("webgl-ready");window.removeEventListener("pointermove",move);gl.domElement.removeEventListener("webglcontextlost",lost);};
  },[gl]);
  useFrame((_,delta)=>{
    const m=motion.current;const animate=!m.reduced&&!m.paused;
    const targetX=animate?pointer.current.x+m.tiltX:0,targetY=animate?-pointer.current.y+m.tiltY:0;
    camera.position.x=THREE.MathUtils.damp(camera.position.x,targetX,3,delta);camera.position.y=THREE.MathUtils.damp(camera.position.y,targetY,3,delta);
    camera.position.z=THREE.MathUtils.damp(camera.position.z,8-(animate?Math.sin(Math.min(m.progress/.22,1)*Math.PI)*.65:0),2,delta);camera.lookAt(0,0,0);
    if(spot.current){spot.current.position.x=3+(animate?m.tiltX*2:0);spot.current.position.y=4+(animate?m.tiltY*2:0);}
    if(quality==="high"&&delta>0&&!document.hidden){frames.current.time+=Math.min(delta,1);frames.current.count++;if(frames.current.time>5){if(frames.current.count/frames.current.time<32)onSlow();frames.current={time:0,count:0,checked:false};}}
  });
  return <><GardenBackdrop/><ambientLight intensity={.55}/><hemisphereLight args={["#ccd3ff","#34362c",1.5]}/><pointLight ref={spot} position={[3,4,5]} color="#ffedc0" intensity={48} distance={22}/><pointLight position={[-5,1,1]} color="#ceadf5" intensity={18} distance={18}/><FogLayers motion={motion}/><FlowerBatch kind={0} motion={motion} detail={quality==="high"?10:6}/><FlowerBatch kind={1} motion={motion} detail={quality==="high"?12:6}/><Detailed distances={[0,quality==="high"?7.7:0]} hysteresis={.02}><group><FlowerBatch kind={2} motion={motion} detail={16}/><FlowerBatch kind={3} motion={motion} detail={14}/></group><group><FlowerBatch kind={2} motion={motion} detail={4}/><FlowerBatch kind={3} motion={motion} detail={4}/></group></Detailed><ButterflyFlock motion={motion}/><FairyDust motion={motion}/><Storybook motion={motion} quality={quality}/><Rings motion={motion} quality={quality}/><GardenEffects motion={motion} quality={quality}/></>;
}

export default function GardenScene({motion}:{motion:MotionRef}) {
  const [quality,setQuality]=useState<Quality>(()=>window.innerWidth<760||(navigator.hardwareConcurrency||4)<6?"low":"high");
  const [hidden,setHidden]=useState(document.hidden);
  useEffect(()=>{const change=()=>setHidden(document.hidden);document.addEventListener("visibilitychange",change);return ()=>document.removeEventListener("visibilitychange",change);},[]);
  return <Canvas camera={{position:[0,0,8],fov:45,near:.1,far:60}} dpr={quality==="high"?[1,1.65]:[1,1]} gl={{alpha:true,antialias:quality==="high",powerPreference:"high-performance",stencil:false}} frameloop={hidden?"never":"always"} onCreated={({gl})=>{gl.setClearColor(0x000000,0);gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.08;}} fallback={<span/>}><SceneWorld motion={motion} quality={quality} onSlow={()=>setQuality("low")}/></Canvas>;
}


