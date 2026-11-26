import * as THREE from 'three';
import {RoomEnvironment} from './vendor/addons/RoomEnvironment.js';
import {EffectComposer} from './vendor/addons/EffectComposer.js';
import {Pass} from './vendor/addons/Pass.js';
import {GTAOPass} from './vendor/addons/GTAOPass.js';
import {OutputPass} from './vendor/addons/OutputPass.js';
import {createSky} from './textures.js?v=f9cd2a6d7d2a';

// Closed solids live on this layer too; their inner faces are painted as the section fill.
export const CAP_LAYER=1;
const SOLID_TYPES=new Set(['BoxGeometry','CylinderGeometry','SphereGeometry','LatheGeometry','CapsuleGeometry','ExtrudeGeometry']);
export function tagSolids(root){root.traverse(object=>{if(!object.isMesh||object.userData.noCap)return;const material=Array.isArray(object.material)?object.material[0]:object.material;if((object.userData.solid||SOLID_TYPES.has(object.geometry.type))&&!material.transparent)object.layers.enable(CAP_LAYER);});}

class ScenePass extends Pass{
constructor(draw){super();this.draw=draw;this.needsSwap=false;}
render(renderer,writeBuffer,readBuffer){this.draw(this.renderToScreen?null:readBuffer);}
}

export function createPipeline({renderer,scene,overlay,section}){
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
// The cut is a per-material plane so that shadows are cut with it: what is hidden casts nothing.
renderer.localClippingEnabled=true;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;

// Soft studio reflections for every material, in place of a flat ambient term.
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.03).texture;pmrem.dispose();
const sky=createSky(),flatBackground=new THREE.Color('#e9ebe4');scene.background=sky.texture;

const hemisphere=new THREE.HemisphereLight(0xffffff,0xb7b1a2,.6);scene.add(hemisphere);
const sun=new THREE.DirectionalLight(0xfff4e2,3.2),centre=new THREE.Vector3(7,1.5,4.3);
sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-12.5,right:12.5,top:12.5,bottom:-12.5,near:.5,far:110});sun.shadow.bias=-.0005;sun.shadow.normalBias=.022;
scene.add(sun,sun.target);sun.target.position.copy(centre);
const ground=new THREE.Mesh(new THREE.CircleGeometry(120,48),new THREE.ShadowMaterial({opacity:.2}));ground.rotation.x=-Math.PI/2;ground.position.y=-.26;ground.receiveShadow=true;ground.userData.noAO=true;ground.raycast=()=>{};scene.add(ground);

const cutPlanes=[section.plane],capMaterial=new THREE.MeshBasicMaterial({color:0x2c312d,side:THREE.BackSide,clippingPlanes:cutPlanes,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4});
let camera=null;
function setClipping(active){const planes=active?cutPlanes:null;scene.traverse(object=>{if(!object.material)return;for(const material of Array.isArray(object.material)?object.material:[object.material]){material.clippingPlanes=planes;material.clipShadows=true;}});if(gtao)gtao.normalMaterial.clippingPlanes=planes;renderer.shadowMap.needsUpdate=true;}
function draw(target){
renderer.setRenderTarget(target);renderer.autoClear=true;
scene.background=camera.isOrthographicCamera?flatBackground:sky.texture;
renderer.render(scene,camera);
renderer.autoClear=false;
if(section.active){
// Second sweep: inner faces of cut solids, seen through the opening, become the poché.
const mask=camera.layers.mask,background=scene.background;camera.layers.set(CAP_LAYER);scene.background=null;scene.overrideMaterial=capMaterial;
renderer.render(scene,camera);
scene.overrideMaterial=null;scene.background=background;camera.layers.mask=mask;
}
// Helpers and handles are drawn last and are never cut.
renderer.render(overlay,camera);
renderer.autoClear=true;
}

const size=new THREE.Vector2(2,2);let pixelRatio=1,quality='high',composer=null,gtao=null;
function buildComposer(){
const target=new THREE.WebGLRenderTarget(2,2,{type:THREE.HalfFloatType,samples:4});
composer=new EffectComposer(renderer,target);composer.addPass(new ScenePass(draw));
gtao=new GTAOPass(scene,camera,2,2,undefined,{radius:.4,distanceExponent:1,thickness:1,scale:1.05,samples:24,screenSpaceRadius:false},{lumaPhi:5,depthPhi:2,normalPhi:3,radius:14,radiusExponent:1.3,rings:3,samples:24});
gtao.blendIntensity=.85;
// Glass and helpers must not darken what lies behind them.
const hide=gtao.overrideVisibility.bind(gtao);
gtao.overrideVisibility=()=>{hide();scene.traverse(object=>{if(!object.isMesh)return;const material=Array.isArray(object.material)?object.material[0]:object.material;if(object.userData.noAO||material.transparent)object.visible=false;});};
gtao.normalMaterial.clippingPlanes=section.active?cutPlanes:null;composer.addPass(gtao);composer.addPass(new OutputPass());
applySize();
}
function applySize(){
renderer.setPixelRatio(pixelRatio);renderer.setSize(size.x,size.y);
if(!composer)return;composer.setPixelRatio(pixelRatio);composer.setSize(size.x,size.y);
// Occlusion is low-frequency; computing it at CSS resolution keeps dense screens fast.
gtao.setSize(Math.max(2,Math.round(size.x*Math.min(pixelRatio,1.25))),Math.max(2,Math.round(size.y*Math.min(pixelRatio,1.25))));
}
function setSize(width,height,ratio){size.set(Math.max(2,width),Math.max(2,height));pixelRatio=ratio;applySize();}
function setQuality(next){quality=next;const map=next==='high'?4096:2048;if(sun.shadow.mapSize.x!==map){sun.shadow.mapSize.set(map,map);sun.shadow.map?.dispose();sun.shadow.map=null;renderer.shadowMap.needsUpdate=true;}}
function render(activeCamera,{ao=true,shadows=false,reach=.4}={}){
camera=activeCamera;if(shadows)renderer.shadowMap.needsUpdate=true;
if(quality!=='high'){draw(null);return;}
if(!composer)buildComposer();
// Contact shadows reach further when the model is seen from far away.
gtao.camera=camera;gtao.enabled=ao&&camera.isPerspectiveCamera;gtao.updateGtaoMaterial({radius:reach});
composer.render();
}
const sunDirection=new THREE.Vector3(0,1,0),white=[1,1,1],mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
// Haze for wide views; its density is zero unless a caller raises it.
scene.fog=new THREE.FogExp2(0xffffff,0);
// The shadow map normally hugs the apartment. Wide views spread it over the block.
let scope=12.5;
function placeSun(){sun.position.copy(centre).addScaledVector(sunDirection,scope*2+10);}
function setScope(half=12.5){if(Math.abs(half-scope)<.01)return;scope=half;const frustum=sun.shadow.camera;frustum.left=frustum.bottom=-half;frustum.right=frustum.top=half;frustum.far=half*4+60;frustum.updateProjectionMatrix();sun.shadow.normalBias=.022*Math.max(1,half/16);placeSun();renderer.shadowMap.needsUpdate=true;}
function setDaylight(light){
sunDirection.set(...light.sunDirection).normalize();placeSun();
sun.color.setRGB(...light.sunColor);sun.intensity=light.sunPower;
hemisphere.color.setRGB(...mix(light.skyTop,white,.5));hemisphere.groundColor.setRGB(...mix(light.skyHorizon,[.72,.69,.62],.7));hemisphere.intensity=.5*light.ambient;
scene.environmentIntensity=.55*light.ambient;
// The studio floor keeps a warm neutral tone and only dims with the daylight.
const groundTone=mix(light.skyHorizon,[.88,.87,.83],.8).map(v=>v*(.1+.9*light.ambient));
sky.update(light.skyTop,light.skyHorizon,groundTone);flatBackground.setRGB(...groundTone,THREE.SRGBColorSpace);scene.fog.color.setRGB(...mix(light.skyHorizon,groundTone,.4),THREE.SRGBColorSpace);
ground.material.opacity=.08+.16*Math.min(1,light.sunPower/3);
renderer.toneMappingExposure=light.exposure;renderer.shadowMap.needsUpdate=true;
}
return {render,setSize,setQuality,setDaylight,setClipping,setScope,sun,ground,get quality(){return quality;}};
}
