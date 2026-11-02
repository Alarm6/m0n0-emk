import * as THREE from './vendor/three.module.js';
import {RGBELoader} from './vendor/RGBELoader.js';
import {assemblyState, THREAD_PITCH} from './assembly.mjs';

const host = document.querySelector('#steel-scene');
try {
  const canvas = host.querySelector('canvas');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0xfafafa, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 60);
  camera.position.set(5.0, 3.4, 5.9);
  camera.lookAt(0, 1.27, 0);
  let progress = 0, target = 0, visible = true, dirty = true, frame = 0;
  let assetsReady = false, revealed = false;
  const loadingManager = new THREE.LoadingManager();
  loadingManager.onLoad = () => { assetsReady = true; dirty = true; };

  const studio = new THREE.Scene();
  studio.background = new THREE.Color('#22272c');
  function panel(w, h, x, y, z, rx, ry, intensity) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({color:new THREE.Color().setScalar(intensity), side:THREE.DoubleSide}));
    m.position.set(x,y,z); m.rotation.set(rx,ry,0); studio.add(m);
  }
  panel(3,9,-5,3,2,0,Math.PI/2,3);
  panel(1.4,8,5,2,0,0,-Math.PI/2,2);
  panel(8,3,0,7,0,Math.PI/2,0,3);
  panel(6,6,0,2,-7,0,0,.15);
  panel(1.2,6,2,2,7,0,Math.PI,1.3);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio,.02).texture;
  pmrem.dispose();
  new RGBELoader(loadingManager).load('./assets/studio.hdr', texture => {
    const generator = new THREE.PMREMGenerator(renderer);
    const old = scene.environment;
    scene.environment = generator.fromEquirectangular(texture).texture;
    generator.dispose(); texture.dispose(); old.dispose(); dirty = true;
  });

  const grainCanvas = document.createElement('canvas');
  grainCanvas.width = grainCanvas.height = 512;
  const ctx = grainCanvas.getContext('2d');
  const pixels = ctx.createImageData(512,512);
  let seed = 4271;
  function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  for (let y=0; y<512; y++) {
    const stripe=rnd()*14;
    for (let x=0; x<512; x++) {
      const k=(y*512+x)*4, v=130+rnd()*24+stripe;
      pixels.data[k]=pixels.data[k+1]=pixels.data[k+2]=v; pixels.data[k+3]=255;
    }
  }
  ctx.putImageData(pixels,0,0);
  const grain = new THREE.CanvasTexture(grainCanvas);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(4,4);
  const steel = new THREE.MeshPhysicalMaterial({color:0xb9c0c4,metalness:1,roughness:.34,bumpMap:grain,bumpScale:.009,envMapIntensity:1.25,anisotropy:.22});
  const cutSteel = new THREE.MeshPhysicalMaterial({color:0xc1c6ca,metalness:1,roughness:.25,bumpMap:grain,bumpScale:.004,envMapIntensity:1.25,anisotropy:.5});
  const fastenerSteel = new THREE.MeshPhysicalMaterial({color:0x929b9f,metalness:1,roughness:.29,bumpMap:grain,bumpScale:.005,envMapIntensity:1.3,anisotropy:.2});
  new THREE.TextureLoader(loadingManager).load('./assets/emk-steel-surface.jpg', texture => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(.8,.8);
    texture.anisotropy = Math.min(8,renderer.capabilities.getMaxAnisotropy());
    steel.map = texture; steel.color.set(0xffffff);
    const relief = texture.clone(); relief.colorSpace = THREE.NoColorSpace; relief.needsUpdate=true;
    steel.bumpMap=relief; steel.bumpScale=.018;
    const roughCanvas=document.createElement('canvas'); roughCanvas.width=roughCanvas.height=512;
    const c=roughCanvas.getContext('2d'); c.drawImage(texture.image,0,0,512,512);
    const d=c.getImageData(0,0,512,512);
    for(let i=0;i<d.data.length;i+=4){const v=135+(1-d.data[i]/255)*75;d.data[i]=d.data[i+1]=d.data[i+2]=v;}
    c.putImageData(d,0,0);
    const rough=new THREE.CanvasTexture(roughCanvas); rough.wrapS=rough.wrapT=THREE.RepeatWrapping; rough.repeat.set(.8,.8);
    steel.roughnessMap=rough; steel.roughness=.66; steel.needsUpdate=true; dirty=true;
  });

  const object = new THREE.Group(); scene.add(object);
  function mesh(geometry,material=steel,parent=object) {
    const m=new THREE.Mesh(geometry,material); m.castShadow=true; m.receiveShadow=true; parent.add(m); return m;
  }
  function extrude(shape,depth,bevel=.025) {
    return new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:5,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:48});
  }
  function rectangle(w,d) {
    const s=new THREE.Shape();s.moveTo(-w/2,-d/2);s.lineTo(w/2,-d/2);s.lineTo(w/2,d/2);s.lineTo(-w/2,d/2);s.closePath();return s;
  }
  function ringShape(outer,inner,hex=false) {
    const s=new THREE.Shape();
    if(hex) { for(let i=0;i<6;i++){const a=i*Math.PI/3;i?s.lineTo(Math.cos(a)*outer,Math.sin(a)*outer):s.moveTo(Math.cos(a)*outer,Math.sin(a)*outer);} s.closePath(); }
    else s.absarc(0,0,outer,0,Math.PI*2,false);
    const hole=new THREE.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);s.holes.push(hole);return s;
  }
  const boltPoints=[[-1.24,-.89],[1.24,-.89],[-1.24,.89],[1.24,.89]];
  const plateShape=rectangle(3.4,2.7);
  for(const [x,z] of boltPoints){const hole=new THREE.Path();hole.absarc(x,z,.167,0,Math.PI*2,true);plateShape.holes.push(hole);}
  const plate=mesh(extrude(plateShape,.21,.018),[steel,cutSteel]);plate.rotation.x=-Math.PI/2;plate.position.y=.1;
  const beamShape=new THREE.Shape();
  const pts=[[-.64,-.68],[.64,-.68],[.64,-.48],[.12,-.48],[.12,.48],[.64,.48],[.64,.68],[-.64,.68],[-.64,.48],[-.12,.48],[-.12,-.48],[-.64,-.48]];
  pts.forEach(([x,y],i)=>i?beamShape.lineTo(x,y):beamShape.moveTo(x,y));beamShape.closePath();
  const beam=mesh(extrude(beamShape,2.50,.026),[cutSteel,steel]);beam.rotation.x=-Math.PI/2;beam.position.y=.36;
  for(const x of [-.22,.22]) {
    const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(.65,0);shape.lineTo(0,.77);shape.closePath();
    const rib=mesh(extrude(shape,.085,.012));rib.position.set(x,.35,.57);rib.rotation.y=x<0?Math.PI/2:-Math.PI/2;
  }
  const weldMat=new THREE.MeshStandardMaterial({color:0x727a7e,metalness:1,roughness:.46,bumpMap:grain,bumpScale:.013});
  const beadGeometry=new THREE.SphereGeometry(.044,12,8);
  for(const z of [-.68,.68]) {
    for(let i=0;i<25;i++){const bead=mesh(beadGeometry,weldMat);bead.position.set(-.61+i*.051,.358,z);bead.scale.set(1,.64,.8);bead.rotation.y=i*.17;}
  }

  // Continuous helical V-profile: the thread is cut into the shaft, rather than drawn as a coil.
  function threadedCylinder(radius,height,pitch) {
    const radial=96, vertical=Math.ceil(height/pitch*22), vertices=[], uvs=[], indices=[];
    for(let y=0;y<=vertical;y++) {
      const h=y/vertical*height;
      for(let j=0;j<=radial;j++) {
        const angle=j/radial*Math.PI*2;
        const phase=((h/pitch-angle/(Math.PI*2))%1+1)%1;
        const profile=Math.min(1,Math.max(0,(.45-Math.abs(phase-.5))/.34));
        const r=radius-.022+.022*profile;
        vertices.push(Math.cos(angle)*r,h,Math.sin(angle)*r);uvs.push(j/radial,h/pitch);
        if(y<vertical&&j<radial){const a=y*(radial+1)+j,b=a+radial+1;indices.push(a,b,a+1,b,b+1,a+1);}
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  const threadGeometry=threadedCylinder(.147,.66,THREAD_PITCH);
  const washerGeometry=extrude(ringShape(.266,.159),.045,.009);
  const nutGeometry=extrude(ringShape(.274,.151,true),.23,.021);
  const nuts=[];
  for(const [x,z] of boltPoints) {
    const shaft=mesh(new THREE.CylinderGeometry(.124,.124,.76,48),fastenerSteel);shaft.position.set(x,.53,z);
    const thread=mesh(threadGeometry,fastenerSteel);thread.position.set(x,.25,z);
    const cap=mesh(new THREE.CylinderGeometry(.125,.144,.025,48),fastenerSteel);cap.position.set(x,.922,z);
    const washer=mesh(washerGeometry,cutSteel);washer.rotation.x=-Math.PI/2;washer.position.set(x,.343,z);
    const n=new THREE.Group();object.add(n);n.position.set(x,1.50,z);
    const material=fastenerSteel.clone();material.transparent=true;
    const body=mesh(nutGeometry,material,n);body.rotation.x=-Math.PI/2;
    const boreMaterial=cutSteel.clone();boreMaterial.transparent=true;
    const inside=[];for(let i=0;i<=160;i++){const y=i/160*.23,a=y/THREAD_PITCH*Math.PI*2;inside.push(new THREE.Vector3(Math.cos(a)*.15,y,Math.sin(a)*.15));}
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(inside),160,.007,4,false),boreMaterial,n);
    nuts.push({group:n,materials:[material,boreMaterial]});
  }

  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
  const sc=shadowCanvas.getContext('2d'),gradient=sc.createRadialGradient(64,64,10,64,64,64);gradient.addColorStop(0,'rgba(30,36,40,.25)');gradient.addColorStop(1,'rgba(30,36,40,0)');sc.fillStyle=gradient;sc.fillRect(0,0,128,128);
  const contact=new THREE.Mesh(new THREE.PlaneGeometry(5.3,4.5),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=-.105;scene.add(contact);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.ShadowMaterial({color:0x505963,opacity:.12}));floor.rotation.x=-Math.PI/2;floor.position.y=-.11;floor.receiveShadow=true;scene.add(floor);
  const key=new THREE.DirectionalLight(0xffffff,1.6);key.position.set(-4,7,5);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-5,right:5,top:6,bottom:-5});key.shadow.normalBias=.018;key.shadow.bias=-.0002;key.shadow.radius=6;scene.add(key);
  const rim=new THREE.DirectionalLight(0xe3edf5,1.4);rim.position.set(4,3,-3);scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff,0x8a9298,.35));
  let size={width:0,height:0};
  function resize() {
    size={width:host.clientWidth,height:host.clientHeight};renderer.setSize(size.width,size.height,false);
    camera.aspect=size.width/size.height;camera.fov=innerWidth<600?39:28;camera.updateProjectionMatrix();dirty=true;scroll();
  }
  function scroll() {
    const container=document.querySelector('.hero-scroll');
    const hero=container.querySelector('.hero');
    const start=container.getBoundingClientRect().top+scrollY;
    const distance=Math.max(1,container.offsetHeight-hero.offsetHeight);
    target=Math.min(1,Math.max(0,(scrollY-start)/distance));dirty=true;
  }
  new ResizeObserver(resize).observe(host);resize();
  addEventListener('scroll',scroll,{passive:true});
  addEventListener('resize',scroll,{passive:true});
  motion.addEventListener('change',()=>{dirty=true;});
  new IntersectionObserver(([e])=>{visible=e.isIntersecting;if(visible)dirty=true;}).observe(host);
  function draw() {
    frame=requestAnimationFrame(draw);
    if((!visible && revealed)||document.hidden)return;
    if(!dirty&&(motion.matches||Math.abs(progress-target)<.0001))return;
    progress=motion.matches?1:THREE.MathUtils.lerp(progress,target,.12);
    if(Math.abs(progress-target)<.0001&&!motion.matches)progress=target;
    const state=assemblyState(progress);
    object.rotation.set(.025+Math.sin(progress*Math.PI)*.06,-.44+progress*1.40,-.035+progress*.035);
    scene.environmentRotation.y=.3+progress*1.3;
    key.position.set(-4+progress*9,6-progress*1.5,5-progress*5);
    key.intensity=1.6+Math.sin(progress*Math.PI)*.8;rim.intensity=1.4+progress*.5;
    for(let i=0;i<nuts.length;i++) {
      const n=nuts[i],s=state.nuts[i];n.group.visible=s.opacity>.002;n.group.position.y=s.y;n.group.rotation.y=s.angle;
      for(const m of n.materials){m.opacity=s.opacity;m.depthWrite=s.opacity>.98;}
    }
    renderer.render(scene,camera);host.classList.add('ready');
    if (assetsReady && !revealed) {
      revealed = true;
      requestAnimationFrame(() => window.EMKLoader?.finish('ready'));
    }
    host.dataset.assemblyPhase=String(state.phase);host.dataset.scrollProgress=progress.toFixed(4);
    document.querySelector('#light-value').textContent=String(state.phase+1).padStart(2,'0');
    document.querySelector('#light-name').textContent=state.label;
    document.querySelector('.hero').style.setProperty('--assembly-progress',progress);
    dirty=!motion.matches&&Math.abs(progress-target)>.0001;
  }
  draw();
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(frame);host.classList.remove('ready');window.EMKLoader?.finish('fallback');});
} catch(error) {
  console.warn('3D preview unavailable, showing generated steel image.',error);
  host.classList.remove('ready');
  window.EMKLoader?.finish('fallback');
}





