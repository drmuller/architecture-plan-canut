import {createFurnitureMaterials,furnitureBuilder,isolateFurnitureMaterials,applyFurnitureColours} from './furniture-models.js?v=ca158c85565f';
import {buildCharacter,createCharacterMaterials,setCharacterPose} from './character-model.js?v=ca158c85565f';
import {nextSurfaceSelection,rememberColour,selectionGeometry} from './surface-editor.js?v=ca158c85565f';
import {configureTiles,boxProject} from './surface-materials.js?v=ca158c85565f';
import {casementBars,WINDOW_SILL,WINDOW_HEAD,KITCHEN_SILL} from './window-pattern.js?v=ca158c85565f';
import {finishMap,reliefMap,RELIEF_DEPTH,PLANK_TILE} from './textures.js?v=ca158c85565f';
import {createPipeline,tagSolids} from './render-pipeline.js?v=ca158c85565f';
import {daylightFor,formatTime,compassPoint} from './daylight.js?v=ca158c85565f';
import {sunPosition,sunTimes,toInstant,localTime,isDate} from './solar.js?v=ca158c85565f';
import {createBuildingIntro,introStage,introCamera,introCaption,INTRO_SECONDS,SITE} from './building-intro.js?v=ca158c85565f';
import {createSectionCut,dragToTravel} from './section-cut.js?v=ca158c85565f';
import {createViewJoystick,orbitOffset,compassDirections} from './view-joystick.js?v=ca158c85565f';
import {createWalkthrough,buildWalkPoints} from './walkthrough.js?v=ca158c85565f';
import {DESIGN_FORMAT,MAX_DESIGN_BYTES,validateDesign,designFingerprint,resolveDesignTexture} from './design-format.js?v=ca158c85565f';
import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
const $=id=>document.getElementById(id), wrap=$('canvas-wrap'),query=new URLSearchParams(location.search);
const scene=new THREE.Scene(),overlay=new THREE.Scene();
const perspective=new THREE.PerspectiveCamera(40,1,.04,180);const orthographic=new THREE.OrthographicCamera(-10,10,6.7,-6.7,.04,180);let camera=perspective;
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});wrap.append(renderer.domElement);
let walkthrough=null,walkReturnView='overview';
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=.35;controls.maxDistance=60;controls.maxPolarAngle=Math.PI*.49;controls.zoomSpeed=.8;controls.panSpeed=.7;
// Zoom toward the pointer and pan across the floor rather than up into the sky.
controls.zoomToCursor=true;controls.screenSpacePanning=false;
const touchFirst=matchMedia('(pointer:coarse)').matches;
// Rendering is on demand: anything that changes the picture calls invalidate().
let renderFrames=3,shadowsDirty=true;
function invalidate(shadows=true){renderFrames=Math.max(renderFrames,2);if(shadows)shadowsDirty=true;}
const catalog=[{id:'paint',name:'Custom colour',desc:'Your chosen colour',color:'#ffffff',kind:'plain'},{id:'inox',name:'Brushed stainless steel',desc:'Inox · brushed metal with a 5 mm worktop edge',color:'#bec5c8',kind:'metal'},{id:'oak',name:'Natural oak',desc:'Warm, lightly grained timber',color:'#c7a776',kind:'wood'},{id:'walnut',name:'Smoked walnut',desc:'Deep brown, open timber grain',color:'#796047',kind:'wood'},{id:'honey',name:'Honey oak',desc:'Golden timber with a warm character',color:'#b68a50',kind:'wood'},{id:'chalk',name:'Chalk white',desc:'Soft, matt mineral white',color:'#f1efe5',kind:'plain'},{id:'sage',name:'Muted sage',desc:'Quiet, earthy green',color:'#929e83',kind:'plain'},{id:'clay',name:'Clay',desc:'Warm terracotta plaster',color:'#b77d63',kind:'plain'},{id:'stone',name:'Limestone',desc:'Fine, softly mottled mineral texture',color:'#ccc8b5',kind:'stone'},{id:'charcoal',name:'Charcoal',desc:'Dark, understated stone',color:'#485654',kind:'stone'},{id:'blue',name:'Beam blue',desc:'Blue-grey, inspired by the 3D reference',color:'#7d9da5',kind:'plain'}];
const defaults={mainbeam:{finish:'walnut',tint:'#ffffff',roughness:.9,scale:1},countertop:{finish:'inox',tint:'#ffffff',roughness:.25,scale:1},floor:{finish:'oak',tint:'#ffffff',roughness:.75,scale:1},walls:{finish:'chalk',tint:'#ffffff',roughness:.9,scale:1},joinery:{finish:'oak',tint:'#ffffff',roughness:.75,scale:1},beams:{finish:'walnut',tint:'#ffffff',roughness:.9,scale:1},stone:{finish:'stone',tint:'#ffffff',roughness:.8,scale:1},ceiling:{finish:'chalk',tint:'#ffffff',roughness:1,scale:1}};
const surfaceMeta={},surfaceParents={},surfaceAliases={};let savedFinishes={};
const furnitureParts=new Map();let furnitureColours={};
let state=structuredClone(defaults);try{const saved=savedFinishes=JSON.parse(localStorage.getItem('ivry-finishes-v1'));if(saved)for(const k in defaults)if(saved[k]&&catalog.some(f=>f.id===saved[k].finish))state[k]={...defaults[k],...saved[k]};}catch{}
let recentColours=[];try{const saved=JSON.parse(localStorage.getItem('ivry-recent-colours-v1'));if(Array.isArray(saved))recentColours=saved.filter(c=>/^#[0-9a-f]{6}$/i.test(c)).slice(0,12);}catch{}
const selectedSurfaces=new Set(),surfaceOverlays=[];
const mats={},customTextures={};const basic=(color,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness});
let seed=1234;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
// How each surface is textured: laid planks on the floor, veneer on joinery, sawn timber
// overhead. Floors use their own metre-scaled UVs; everything else is box-projected so
// grain and plaster keep one density across split and cut-away walls.
const surfaceStyle={floor:{variant:'planks',ownUV:true},stone:{ownUV:true},joinery:{variant:'veneer'},'kitchen-cladding':{variant:'veneer'},beams:{variant:'timber',grain:'x'},mainbeam:{variant:'timber',grain:'z'},countertop:{grain:'x'}};
function ownTexture(material,slot,shared,repeat){
if(material.userData[slot]){material.userData[slot].dispose();material.userData[slot]=null;}
if(!shared)return null;const copy=shared.clone();copy.repeat.set(repeat,repeat);copy.needsUpdate=true;material.userData[slot]=copy;return copy;
}
function applyMaterial(key){
const s=state[key],f=catalog.find(f=>f.id===s.finish),style=surfaceStyle[key]||{},tiled=surfaceMeta[key]?.tile;
if(!mats[key]){mats[key]=basic('#ffffff');mats[key].userData.surfaceKey=key;if(!tiled&&!style.ownUV)boxProject(mats[key],{space:'world',grain:style.grain||'y'});}
const m=mats[key];invalidate();
if(tiled){m.map=null;m.color.set(f.color).multiply(new THREE.Color(s.tint));m.roughness=Number(s.roughness);m.metalness=0;configureTiles(m,surfaceMeta[key].axis);m.needsUpdate=true;return;}
const custom=customTextures[key],wood=f.kind==='wood',variant=wood?style.variant||'veneer':null,tileSize=variant==='planks'?PLANK_TILE:1;
if(custom){custom.repeat.set(s.scale,s.scale);ownTexture(m,'ownMap',null);m.map=custom;m.color.set(s.tint);}
else{m.map=ownTexture(m,'ownMap',finishMap(f,variant),s.scale/tileSize);m.color.set(m.map?'#ffffff':f.color).multiply(new THREE.Color(s.tint));}
// Surface relief: plank joints, open grain, honed stone or fine plaster.
const reliefKind=custom||f.kind==='metal'?null:wood?variant:f.kind==='stone'?'stone':'plaster';
m.bumpMap=ownTexture(m,'ownRelief',reliefKind&&reliefMap(reliefKind),reliefKind==='plaster'?1.4:s.scale/tileSize);m.bumpScale=reliefKind?RELIEF_DEPTH[reliefKind]:1;
m.roughness=Number(s.roughness);m.metalness=f.kind==='metal'&&!custom?1:0;m.envMapIntensity=m.metalness?1.25:1;m.needsUpdate=true;if(key==='joinery')syncFurnitureWood();}
function syncFurnitureWood(){const base=catalog.find(f=>f.id===state.joinery.finish),colour=new THREE.Color(base.color).multiply(new THREE.Color(state.joinery.tint));for(const [id,parts] of furnitureParts){for(const entry of parts.wood||[])entry.original.copy(colour);applyFurnitureColours(parts,furnitureColours[id]);}}
function addSurface(key,label,{tile=false,axis='x',parent=null,group='Individual wall faces'}={}){
surfaceMeta[key]={label,tile,axis,group,parent};if(parent)surfaceParents[key]=parent;
defaults[key]=structuredClone(tile?{finish:'chalk',tint:'#ffffff',roughness:.65,scale:1}:defaults[parent||'walls']);
const saved=savedFinishes?.[key];state[key]=structuredClone(saved&&catalog.some(f=>f.id===saved.finish)?{...defaults[key],...saved}:state[parent]||defaults[key]);
applyMaterial(key);mats[key].userData.surfaceKey=key;return mats[key];
}
for(const room of ['sdb','sde'])for(const face of ['north','east','south','west','floor'])addSurface(`${room}-${face}`,`${room==='sdb'?'Bathroom · SDB':'Shower room · SDE'} · ${face==='floor'?'floor':face+' wall'}`,{tile:true,axis:face==='floor'?'floor':['east','west'].includes(face)?'z':'x',group:room==='sdb'?'Bathroom · 5 × 5 cm tiles':'Shower room · 5 × 5 cm tiles'});
Object.keys(state).forEach(applyMaterial);
// Fixed fittings: lacquer and sanitaryware, brushed metal, water and window glass.
const white=new THREE.MeshStandardMaterial({color:'#efece4',roughness:.5}),dark=new THREE.MeshStandardMaterial({color:'#3a423e',roughness:.45}),metal=new THREE.MeshStandardMaterial({color:'#b3b9b7',roughness:.26,metalness:.92}),water=new THREE.MeshStandardMaterial({color:'#cfe0de',roughness:.06,metalness:.15}),tile=basic('#e3ded1',.55);
const glass=new THREE.MeshStandardMaterial({color:'#e3f0ef',transparent:true,opacity:.13,roughness:.03,envMapIntensity:1.8,depthWrite:false});
let architecture=new THREE.Group(),furn=new THREE.Group(),roof=new THREE.Group(),boxRoof=new THREE.Group(),joists=new THREE.Group(),beam=new THREE.Group(),zones=new THREE.Group(),dims=new THREE.Group(),lamps=new THREE.Group(),lampGlow=new THREE.Group();scene.add(architecture,furn,roof,boxRoof,joists,beam,zones,dims,lamps,lampGlow);const walls=[],roomLabels=[],dimensionLabels=[],lampLights=[];let mainH=4,boxH=2.9;
function box(parent,x,y,z,w,h,d,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y+h/2,z);m.castShadow=!mat.transparent;m.receiveShadow=true;parent.add(m);return m;}
function cyl(parent,x,y,z,r,h,mat){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,40),mat);m.position.set(x,y+h/2,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
// Movable objects keep every component together and rotate about their centre.
const movableObjects=[];
const furnitureMaterials=createFurnitureMaterials(),detailedFurniture=furnitureBuilder(furnitureMaterials);
function placeFurniture(group,parent,x,z,rotation=0){group.position.set(x,0,z);group.rotation.y=rotation;parent.add(group);return group;}
function registerFurniture(object,id,label){
object.userData.furniture={id,label,original:{x:object.position.x,z:object.position.z,angle:object.rotation.y}};
furnitureParts.set(id,isolateFurnitureMaterials(object));syncFurnitureWood();movableObjects.push(object);return object;
}
function groupFurniture(start,id,label,x,z){
const pieces=furn.children.slice(start),group=new THREE.Group();group.position.set(x,0,z);furn.add(group);
for(const piece of pieces){piece.position.x-=x;piece.position.z-=z;group.add(piece);}
return registerFurniture(group,id,label);
}
const anchors=[[151,0],[417,2.93],[424,3],[666,5.72],[673,5.79],[924,8.55],[931,8.62],[1386,13.745],[1413,14.045]];
function X(p){for(let i=1;i<anchors.length;i++)if(p<=anchors[i][0]){const [a,b]=anchors[i-1],[c,d]=anchors[i];return b+(p-a)/(c-a)*(d-b)}return 14.045+(p-1413)/89.7}const Z=p=>(p-271)/89.7;
const footprint=[[0,Z(563)],[X(228),Z(563)],[X(228),Z(600)],[X(286),Z(600)],[X(286),Z(563)],[X(383),Z(563)],[X(383),Z(600)],[X(827),Z(600)],[X(827),0],[14.045,0],[13.745,Z(1049)],[0,Z(1049)]];
function polygon(parent,points,y,mat){const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),mat);mesh.rotation.x=-Math.PI/2;mesh.position.y=y;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
// A solid floor slab closes the model underneath and shows as poché in section cuts.
function slab(parent,points,top,thickness,mat){const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false}),mat);mesh.rotation.x=-Math.PI/2;mesh.position.y=top-thickness;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
polygon(architecture,footprint,0,mats.floor);slab(architecture,footprint,-.004,.25,basic('#b5b3a8',.95));
polygon(architecture,[[X(1134),0],[14.045,0],[13.93,Z(571)],[X(1134),Z(571)]],.014,mats.stone);
polygon(architecture,[[0,Z(563)],[X(228),Z(563)],[X(228),Z(600)],[X(286),Z(600)],[X(286),Z(563)],[X(383),Z(563)],[X(383),Z(600)],[X(566),Z(600)],[X(566),Z(710)],[0,Z(710)]],.018,mats['sde-floor']);
polygon(architecture,[[X(936),.08],[X(1130),.08],[X(1130),Z(435)],[X(936),Z(435)]],.018,mats['sdb-floor']);
polygon(architecture,[[X(828),0],[X(930),0],[X(930),Z(435)],[X(828),Z(435)]],.018,tile);
// Trim each wall solid from its original bottom; never scale the wall group.
// Lintels disappear below their fixed underside, leaving doors open to the cut.
function applyWallCut(w,ceilingHeight,cutHeight){
for(const part of w.parts){
const delta=ceilingHeight-w.h;
const bottom=part.bottom+(part.topAnchored?delta:0);
const top=part.top+(part.followsCeiling?delta:0);
const visibleHeight=Math.max(0,Math.min(top,cutHeight)-bottom);
part.mesh.visible=visibleHeight>0.00001;
part.mesh.scale.y=visibleHeight/part.height;
part.mesh.position.y=bottom+visibleHeight/2;
}
}
// A wall is built from several boxes. Where two of them meet, the end face of one lies
// inside the wall; the sun treats it as lit and it can flicker through as a bright
// hairline. So neighbouring pieces overlap by a millimetre, their buried end faces are
// not drawn, and the sides of each opening are lined separately from sill to head.
const SEAL=.001,buriedFace=new THREE.MeshBasicMaterial({visible:false});
function buryEnds(mesh,start,end){if(!(start||end))return mesh;const faces=Array.isArray(mesh.material)?[...mesh.material]:Array(6).fill(mesh.material);if(end)faces[0]=buriedFace;if(start)faces[1]=buriedFace;mesh.material=faces;return mesh;}
function wall(a,b,thick=.07,h=mainH,openings=[],out=null,material=mats.walls,lowBox=false,skirting=true,joined=[false,false]){const g=new THREE.Group();architecture.add(g);const len=Math.hypot(b[0]-a[0],b[1]-a[1]);g.position.set(a[0],0,a[1]);g.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);const room=out&&Math.sin(g.rotation.y)*out[0]+Math.cos(g.rotation.y)*out[1]>0?-1:1;const cuts=[0,len,...openings.flatMap(o=>[o.at,o.at+o.width])].sort((a,b)=>a-b);for(let i=0;i<cuts.length-1;i++){const s=Math.max(0,cuts[i]),e=Math.min(len,cuts[i+1]);if(e-s<.001)continue;const o=openings.find(o=>(s+e)/2>o.at&&(s+e)/2<o.at+o.width);if(!o)buryEnds(box(g,(s+e)/2,0,0,e-s+SEAL,h,thick,material),s>0||joined[0],e<len||joined[1]);else{if(o.sill)buryEnds(box(g,(s+e)/2,0,0,e-s+SEAL,o.sill,thick,material),s>0,e<len);const top=(o.sill||0)+o.height;if(h>top)buryEnds(box(g,(s+e)/2,top,0,e-s+SEAL,h-top,thick,material),s>0,e<len);const lining=Array.isArray(material)?material[0]:material;for(const [x,turn] of [[s,1],[e,-1]]){if(x<=.001||x>=len-.001)continue;const jamb=new THREE.Mesh(new THREE.PlaneGeometry(thick,o.height),lining);jamb.position.set(x,(o.sill||0)+o.height/2,0);jamb.rotation.y=turn*Math.PI/2;jamb.castShadow=jamb.receiveShadow=true;g.add(jamb);}if(o.window){const y=o.sill,bars=casementBars(e-s,o.height);box(g,(s+e)/2,y,0,e-s,o.height,.02,glass);for(const p of bars.posts)box(g,s+p.x,y+p.from,0,p.width,p.to-p.from,.07,white);for(const r of bars.rails)box(g,s+(r.from+r.to)/2,y+r.y-r.height/2,0,r.to-r.from,r.height,.066,white);box(g,(s+e)/2,y-.045,0,e-s+.08,.045,thick+.09,white);box(g,s+bars.handle.x,y+.07,room*.044,.012,o.height-.14,.012,dark);box(g,s+bars.handle.x,y+bars.handle.y,room*.058,.028,.1,.028,dark)}}}
// Skirting stops at door jambs instead of bridging the opening.
if(skirting)for(let i=0;i<cuts.length-1;i++){
const s=Math.max(0,cuts[i]),e=Math.min(len,cuts[i+1]);if(e-s<.001)continue;
const opening=openings.find(o=>(s+e)/2>o.at&&(s+e)/2<o.at+o.width);
// A board on each room side (not one block through the wall, which would hide the cut face).
if(!opening||opening.sill)for(const side of out?[room]:[-1,1])box(g,(s+e)/2,0,side*(thick/2+.002),e-s,.095,.012,white);
}
const parts=g.children.map(mesh=>{const height=mesh.geometry.parameters.height,bottom=mesh.position.y-height/2,top=bottom+height;return{mesh,height,bottom,top,followsCeiling:Math.abs(top-h)<.00001};});
walls.push({g,a,b,out,h,lowBox,parts,cutHeight:h});return g;}
function roomAt(x,z){
if(z>=Z(710)){if(x<X(420.5))return 'Bedroom 1';if(x<X(669.5))return 'Bedroom 2';if(x<X(927.5))return 'Office';return 'Living room';}
if(x<X(566)&&z>=Z(563))return 'Shower room';
if(x>=X(930)&&x<=X(1130)&&z<Z(435))return 'Bathroom';
if(x>=X(827)&&x<X(930)&&z<Z(435))return 'WC';
if(x>X(1130))return 'Kitchen';if(x>X(930)&&z<Z(600))return 'Entry';return 'Hall';
}
const wallLabelCounts={};
function w(ax,az,bx,bz,t=.07,h=mainH,o=[],out=null,mat=mats.walls,lb=false){
if(mat!==mats.walls)return wall([X(ax),Z(az)],[X(bx),Z(bz)],t,h,o,out,mat,lb);
// Split long partitions at room boundaries so neighbouring rooms stay independent.
const a=[X(ax),Z(az)],b=[X(bx),Z(bz)],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len;
const cuts=[0,1];const boundaries=az===bz?[420.5,566,669.5,827,930,1130].map(X):ax===bx?[435,576,600,710].map(Z):[];
for(const v of boundaries){const q=az===bz?(v-a[0])/dx:(v-a[1])/dz;if(q>.001&&q<.999&&!o.some(open=>q*len>open.at+.001&&q*len<open.at+open.width-.001))cuts.push(q);}
cuts.sort((a,b)=>a-b);let result;
for(let i=0;i<cuts.length-1;i++){
const from=cuts[i],to=cuts[i+1],start=[a[0]+dx*from,a[1]+dz*from],end=[a[0]+dx*to,a[1]+dz*to],mid=[(start[0]+end[0])/2,(start[1]+end[1])/2];
const faces=[1,-1].map(side=>{const outside=out&&(nx*side*out[0]+nz*side*out[1]>.5);const room=outside?'Exterior':roomAt(mid[0]+nx*side*(t/2+.12),mid[1]+nz*side*(t/2+.12));const direction=Math.abs(nx)>.5?(nx*side>0?'west':'east'):(nz*side>0?'north':'south');const label=room+' · '+direction+' wall';const count=wallLabelCounts[label]=(wallLabelCounts[label]||0)+1;const key=`wall-${ax}-${az}-${bx}-${bz}-${i}-${side>0?'a':'b'}`;if(!outside&&['Bathroom','Shower room'].includes(room))surfaceAliases[key]=(room==='Bathroom'?'sdb-':'sde-')+direction;return addSurface(key,label+(count>1?' · section '+count:''),{parent:'walls',group:outside?'Exterior wall faces':'Individual wall faces'});});
const openings=o.filter(open=>open.at<to*len&&open.at+open.width>from*len).map(open=>({...open,at:open.at-from*len}));
result=wall(start,end,t,h,openings,out,[faces[0],faces[0],faces[0],faces[0],faces[0],faces[1]],lb,true,[i>0,i<cuts.length-2]);
}
return result;
}
// Exterior: real window gaps, thick masonry and a slightly tapered east wall.
w(151,563,151,1049,.43,4,[],[-1,0]);for(const [ax,az,bx,bz]of[[151,563,228,563],[228,563,228,600],[228,600,286,600],[286,600,286,563],[286,563,383,563],[383,563,383,600],[383,600,827,600]])w(ax,az,bx,bz,.20,4,[],[0,-1]);w(827,600,827,271,.38,4,[{at:Z(600)-Z(550),width:1.0,height:2.5}],[-1,0]);w(827,271,1413,271,.43,4,[],[0,-1]);
// Windows follow a photograph of the rooms: glazing from about 0.90 m to 2.90 m, and the
// kitchen window, of the same design, starting above the worktop.
const kitchenWindow={at:.48,width:1.7,sill:KITCHEN_SILL,height:WINDOW_HEAD-KITCHEN_SILL,window:true};
w(1413,271,1386,1049,.43,4,[kitchenWindow],[1,0]);
const facadeWindows=[[172,327],[466,575],[676,786],[930,1080],[1178,1332]].map(([a,b])=>({at:X(a),width:X(b)-X(a),sill:WINDOW_SILL,height:WINDOW_HEAD-WINDOW_SILL,window:true}));w(151,1049,1386,1049,.43,4,facadeWindows,[0,1]);
// Bedroom partitions, corridor doors and the red entry / bathroom box.
w(420.5,710,420.5,1049,.07);w(669.5,710,669.5,1049,.07);w(927.5,710,927.5,1049,.07);
w(151,710,927.5,710,.07,4,[{at:X(335),width:X(416)-X(335),height:2.2},{at:X(572),width:X(661)-X(572),height:2.2},{at:X(682),width:X(751)-X(682),height:2.2}]);
w(566,600,566,710,.07,4,[{at:Z(628)-Z(600),width:.84,height:2.2}]);
w(930,271,930,576,.07,boxH,[{at:Z(458),width:1.04,height:2.5}],null,mats.walls,true);
w(827,435,930,435,.07,boxH,[{at:.035,width:X(913)-X(830),height:2.1}],null,mats.walls,true);
w(936,435,1130,435,.07,boxH,[{at:X(987)-X(936),width:X(1064)-X(987),height:2.1}],null,mats.walls,true);
// White partitions step inward below the bath; the 62 cm cupboard sits outside.
w(1130,271,1130,435,.07,boxH,[],null,mats.walls,true);
// Thin wood cladding only on the kitchen face; the bathroom keeps its plaster wall.
// Align the finished face with the adjacent 62 cm cupboard fronts.
const claddingInner=X(1130)+.035,claddingOuter=X(1076)+.035+.62;
addSurface('kitchen-cladding','Kitchen · wood-clad wall',{parent:'joinery'});
const kitchenCladding=wall([(claddingInner+claddingOuter)/2,Z(271)],[(claddingInner+claddingOuter)/2,Z(435)+.035],claddingOuter-claddingInner,boxH,[],null,mats['kitchen-cladding'],true,false);
kitchenCladding.name='Kitchen-facing wood wall cladding';
w(1076,435,1076,576,.07,boxH,[],null,mats.walls,true);
w(936,576,1076,576,.07,boxH,[],null,mats.walls,true);
// Thin tiled linings on the bathroom side only; plaster and wooden joinery remain behind.
// Their world-space grid stays metric through every cutaway and height adjustment.
function tileWall(room,face,a,b,h,openings=[],low=false,out=null){return wall(a,b,.004,h,openings,out,mats[`${room}-${face}`],low,false);}
const skin=.011;
tileWall('sdb','north',[X(936),.215+skin],[X(1130),.215+skin],boxH,[],true,[0,-1]);
tileWall('sdb','south',[X(936),Z(435)-.035-skin],[X(1130),Z(435)-.035-skin],boxH,[{at:X(987)-X(936),width:X(1064)-X(987),height:2.1}],true);
tileWall('sdb','west',[X(930)+.035+skin,.215],[X(930)+.035+skin,Z(435)],boxH,[],true);
tileWall('sdb','east',[X(1130)-.035-skin,.215],[X(1130)-.035-skin,Z(435)],boxH,[],true);
addSurface('sdb-laundry-return','Bathroom · SDB · ML cupboard return',{tile:true,axis:'x',group:'Bathroom · 5 × 5 cm tiles'});
tileWall('sdb','laundry-return',[X(936),Z(358)+.025+skin],[X(997),Z(358)+.025+skin],boxH,[],true);
// The shower room follows the stepped outline of the old masonry.
for(const [ax,az,bx,bz] of [[151,563,228,563],[228,563,228,600],[228,600,286,600],[286,600,286,563],[286,563,383,563],[383,563,383,600],[383,600,566,600]]){
const a=[X(ax),Z(az)],b=[X(bx),Z(bz)],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),offset=.10+skin;
let face='north';if(az!==bz){face='recess-'+ax;addSurface('sde-'+face,'Shower room · SDE · recess return '+({228:'1',286:'2',383:'3'}[ax]),{tile:true,axis:'z',group:'Shower room · 5 × 5 cm tiles'});}
tileWall('sde',face,[a[0]-dz/length*offset,a[1]+dx/length*offset],[b[0]-dz/length*offset,b[1]+dx/length*offset],4,[],false,[0,-1]);
}
tileWall('sde','west',[.215+skin,Z(563)],[.215+skin,Z(710)],4,[],false,[-1,0]);
tileWall('sde','south',[0,Z(710)-.035-skin],[X(566),Z(710)-.035-skin],4,[{at:X(335),width:X(416)-X(335),height:2.2}]);
tileWall('sde','east',[X(566)-.035-skin,Z(600)],[X(566)-.035-skin,Z(710)],4,[{at:Z(628)-Z(600),width:.84,height:2.2}]);
function makeCeilings(){for(const g of [roof,boxRoof,joists,beam,zones,dims,lamps,lampGlow]){while(g.children.length){const m=g.children.pop();m.traverse(o=>o.geometry?.dispose());m.parent=null;}}for(const l of dimensionLabels)l.el.remove();dimensionLabels.length=0;lampLights.length=0;
const mainShape=[[8.62,0],[14.045,0],[13.745,Z(1049)],[8.62,Z(1049)]];
// Boards over the joists, and plain plaster ceilings over the bedrooms, hall and shower room.
slab(roof,mainShape,mainH+.045,.045,mats.beams);
slab(roof,[[0,Z(563)],[X(228),Z(563)],[X(228),Z(600)],[X(286),Z(600)],[X(286),Z(563)],[X(383),Z(563)],[X(383),Z(600)],[X(827),Z(600)],[X(827),0],[8.62,0],[8.62,Z(1049)],[0,Z(1049)]],mainH+.06,.06,mats.ceiling);
box(boxRoof,(X(930)+X(1134))/2,boxH,(Z(271)+Z(600))/2,X(1134)-X(930),.10,Z(600),mats.ceiling);
for(let z=.17;z<Z(1049);z+=.32){const right=14.045-.3*z/Z(1049);box(joists,(8.62+right)/2,mainH-.16,z,right-8.62,.16,.10,mats.beams)}
box(beam,X(1148),mainH-.4,Z(1049)/2,.30,.4,Z(1049),mats.mainbeam);
// Pendants hang from the boards; each cluster shares one warm light, lit in the evening.
// The lights sit in their own group so they stay on when the ceiling is hidden from above.
const hang=(x,z,height,ceiling,radius)=>{const p=detailedFurniture.pendant(ceiling-height,radius);p.position.set(x,ceiling,z);lamps.add(p);};
const glowAt=(x,y,z,power,reach=7)=>{const light=new THREE.PointLight('#ffe0b8',0,reach,1.7);light.position.set(x,y,z);light.userData.power=power;light.visible=false;lampGlow.add(light);lampLights.push(light);};
for(const dz of [-.72,0,.72])hang(12.63,Z(793)+dz,1.62,mainH,.15);glowAt(12.63,1.5,Z(793),4.5);
for(const dx of [-.45,.45])hang(12.9+dx,Z(460)+.08,1.72,mainH,.12);glowAt(12.9,1.6,Z(460)+.08,3);
for(const [x,z] of [[1.47,7],[4.3,7],[7.15,7]]){hang(x,z,2.45,mainH,.2);glowAt(x,2.3,z,3.6);}
glowAt(5.2,3.3,4.3,3.2);glowAt(9.75,boxH-.25,2.1,3,6);glowAt(3.1,3.2,4.4,2.2,5);
for(const g of [roof,boxRoof,joists,beam,lamps])tagSolids(g);
const red=new THREE.MeshBasicMaterial({color:'#d68473',transparent:true,opacity:.22,side:THREE.DoubleSide,depthWrite:false});const blue=new THREE.MeshBasicMaterial({color:'#668fab',transparent:true,opacity:.13,side:THREE.DoubleSide,depthWrite:false});polygon(zones,mainShape,.042,blue);polygon(zones,[[8.62,0],[X(1134),0],[X(1134),Z(600)],[8.62,Z(600)]],.052,red);zones.visible=$('zone-colors').checked;
const dimLine=(a,b,text)=>{const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a),new THREE.Vector3(...b)]);dims.add(new THREE.Line(geo,new THREE.LineBasicMaterial({color:'#58755d'})));for(const p of [a,b])box(dims,p[0],p[1]-.04,p[2],.035,.08,.16,mats.walls);label(text,'',new THREE.Vector3((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2),true)};
for(const [a,b,txt]of[[0,2.93,'2.93 m'],[3,5.72,'2.72 m'],[5.79,8.55,'2.76 m'],[8.62,13.745,'5.125 m']])dimLine([a,.08,9.25],[b,.08,9.25],txt);
dimLine([14.65,0,3],[14.65,mainH,3],mainH.toFixed(2)+' m');dimLine([10.65,0,3.9],[10.65,boxH,3.9],boxH.toFixed(2)+' m');dims.visible=$('dimensions').checked;
}const labelRooms={'Chambre 1':'bedroom-1','Chambre 2':'bedroom-2','Bureau':'office','Séjour':'living','Cuisine':'kitchen','Entrée + SDB':'entry','Salle d’eau':'shower'};
function label(name,area,pos,isDim=false){const el=document.createElement(labelRooms[name]?'button':'div');el.className='room-label'+(isDim?' dim':'');el.textContent=name;if(area){const s=document.createElement('span');s.textContent=area;el.append(s)}if(labelRooms[name]){el.dataset.room=labelRooms[name];el.title='Fly to this room';}$('labels').append(el);(isDim?dimensionLabels:roomLabels).push({el,pos});}
makeCeilings();
// Built-in joinery: continuous kitchen, tall box face, shelving and peninsula.
for(let i=0;i<5;i++){const x=X(1135)+.3135+i*.627;box(furn,x,.10,.37,.612,.78,.62,mats.joinery);box(furn,x,1.55,.25,.612,.65,.42,white);box(furn,x,.50,.697,.48,.012,.01,dark)}
const worktopThickness=.005;
box(furn,X(1135)+3.135/2,.88,.37,3.135,worktopThickness,.66,mats.countertop);
box(furn,12.9,.12,Z(460),1.77,.77,.84,mats.joinery);// Island worktop: 3 cm lip on the kitchen side, 20 cm overhang over the stools.
box(furn,12.9,.89,Z(460)+(.20-.03)/2,1.82,worktopThickness,.84+.03+.20,mats.countertop);
box(furn,11.76,.885,.36,.62,.015,.43,metal);box(furn,11.76,.897,.36,.52,.01,.34,dark);cyl(furn,11.76,.90,.16,.018,.24,metal);box(furn,11.76,1.12,.23,.035,.035,.16,metal);box(furn,13.0,.885,.36,.58,.018,.49,dark);for(const dx of[-.16,.16])for(const dz of[-.13,.13])cyl(furn,13+dx,.904,.36+dz,.09,.008,metal);
// Built-in furniture is separate from the plaster partitions, with its own
// carcass, doors and shelves, fitted flush to the walls and box ceiling.
const boxFurn=new THREE.Group();boxFurn.name='Entry cupboard and living-room bookcase';furn.add(boxFurn);
const cabinetH=2.9,cabinetRearFace=X(1076)+.035,cabinetBack=cabinetRearFace+.0125,cabinetFront=cabinetRearFace+.62-.011;
function furnitureSection(name,a,b){const g=new THREE.Group();g.name=name;boxFurn.add(g);return {g,a,b};}
function finishFurnitureSection(section){const parts=section.g.children.map(mesh=>{const height=mesh.geometry.parameters.height,bottom=mesh.position.y-height/2,top=bottom+height;const followsCeiling=Math.abs(top-cabinetH)<.00001;return{mesh,height,bottom,top,followsCeiling,topAnchored:followsCeiling&&height<.05};});walls.push({...section,out:null,h:cabinetH,lowBox:true,isFurniture:true,parts,cutHeight:cabinetH});}
const cupboardStart=Z(435)+.035,cupboardEnd=Z(600),cupboardDepth=cupboardEnd-cupboardStart;
const tallCupboard=furnitureSection('62 cm deep kitchen-side cupboard',[cabinetFront,cupboardStart],[cabinetFront,cupboardEnd]);
box(tallCupboard.g,cabinetBack,0,(cupboardStart+cupboardEnd)/2,.025,cabinetH,cupboardDepth,mats.joinery);
for(const z of [cupboardStart+.0125,cupboardEnd-.0125])box(tallCupboard.g,cabinetRearFace+.31,0,z,.62,cabinetH,.025,mats.joinery);
for(const y of [0,cabinetH-.025])box(tallCupboard.g,cabinetRearFace+.31,y,(cupboardStart+cupboardEnd)/2,.62,.025,cupboardDepth,mats.joinery);
for(let i=0;i<3;i++){const z=cupboardStart+(i+.5)*cupboardDepth/3;box(tallCupboard.g,cabinetFront,0,z,.022,cabinetH,cupboardDepth/3-.008,mats.joinery);box(tallCupboard.g,cabinetFront+.025,1.05,z+cupboardDepth/6-.05,.025,.20,.012,dark);}
finishFurnitureSection(tallCupboard);
const shelfLeft=X(930)-.035,shelfRight=cabinetRearFace,shelfX=(shelfLeft+shelfRight)/2,shelfW=shelfRight-shelfLeft,shelfBack=Z(576)+.035,shelfFront=Z(600),shelfDepth=shelfFront-shelfBack;
const bookcase=furnitureSection('Living-room bookcase',[shelfLeft,shelfFront],[shelfRight,shelfFront]);
box(bookcase.g,shelfX,0,shelfBack+.01,shelfW,cabinetH,.02,mats.joinery);
for(const x of [shelfLeft+.0125,shelfX,shelfRight-.0125])box(bookcase.g,x,0,(shelfBack+shelfFront)/2,.025,cabinetH,shelfDepth,mats.joinery);
for(const y of [.0,.75,1.21,1.67,2.13,cabinetH-.025])box(bookcase.g,shelfX,y,(shelfBack+shelfFront)/2,shelfW,.025,shelfDepth,mats.joinery);
box(bookcase.g,shelfX,0,shelfFront-.0125,shelfW,.73,.025,mats.joinery);
for(let i=0;i<9;i++)box(bookcase.g,shelfLeft+.08+i*.065,.775,shelfFront-.09,.045,.23+rand()*.08,.15,basic(['#a59c83','#8b9c88','#bba88d'][i%3]));
finishFurnitureSection(bookcase);
function wardrobe(x,z,w,id,label,d=.6){registerFurniture(placeFurniture(detailedFurniture.wardrobe(w,d),furn,x,z),id,label);}
wardrobe(1,Z(740),2,'wardrobe-1','Bedroom 1 · wardrobe');wardrobe(3.8,Z(740),1.57,'wardrobe-2','Bedroom 2 · wardrobe');wardrobe(7.55,Z(740),1.85,'wardrobe-office','Office · wardrobe');
function bed(x,z,w,d,rot,id,label){registerFurniture(placeFurniture(detailedFurniture.bed(w,d),furn,x,z,rot),id,label);}
bed(1.14,Z(912),1.6,2,Math.PI/2,'bed-1','Bedroom 1 · bed');bed(5.08,Z(952),.9,2,0,'bed-2','Bedroom 2 · bed');
function sofa(parent,x,z,width=2.3,rot=0){return placeFurniture(detailedFurniture.sofa(width),parent,x,z,rot);}
registerFurniture(sofa(furn,9.05,Z(892),2.35,Math.PI/2),'sofa-living','Living room · sofa');registerFurniture(sofa(furn,8.1,Z(900),1.65,-Math.PI/2),'sofa-office','Office · sofa');
function chair(x,z,rot,id,label){return registerFurniture(placeFurniture(detailedFurniture.chair(),furn,x,z,rot),id,label);}
registerFurniture(placeFurniture(detailedFurniture.table(1,2.4,.74),furn,12.63,Z(793)),'dining-table','Dining table');
for(const [i,z]of[Z(722),Z(795),Z(868)].entries()){chair(11.88,z,Math.PI/2,'chair-west-'+i,'Dining chair · west '+(i+1));chair(13.38,z,-Math.PI/2,'chair-east-'+i,'Dining chair · east '+(i+1))}chair(12.63,Z(793)-1.49,0,'chair-north','Dining chair · kitchen end');chair(12.63,Z(793)+1.49,Math.PI,'chair-south','Dining chair · window end');
registerFurniture(placeFurniture(detailedFurniture.coffee(),furn,10.07,Z(875)),'coffee-table','Coffee table');
registerFurniture(sofa(furn,10.85,Z(746),.82,Math.atan2(10.07-10.85,Z(875)-Z(746))),'armchair-north','Armchair · kitchen side');registerFurniture(sofa(furn,10.85,Z(968),.82,Math.atan2(10.07-10.85,Z(875)-Z(968))),'armchair-south','Armchair · window side');
registerFurniture(placeFurniture(detailedFurniture.table(1.15,.60,.73),furn,6.45,Z(1023)),'desk','Office · desk');chair(6.45,Z(982),0,'desk-chair','Office · desk chair');
// Three counter stools on the living-room side of the kitchen peninsula.
for(const [i,dx] of [-.58,0,.58].entries())registerFurniture(placeFurniture(detailedFurniture.stool(),furn,12.9+dx,Z(460)+.70,Math.PI),'stool-'+i,'Kitchen · counter stool '+(i+1));
// Soft furnishings, plants and a reading lamp. They are registered after the original
// pieces, so older saved layouts keep their order and gain these at their default places.
registerFurniture(placeFurniture(detailedFurniture.rug(2.6,3.3),furn,10,Z(876)),'rug-living','Living room · rug');
registerFurniture(placeFurniture(detailedFurniture.rug(1.5,2.2),furn,2.75,Z(912)),'rug-bedroom','Bedroom 1 · rug');
registerFurniture(placeFurniture(detailedFurniture.plant(1.55),furn,13.4,Z(1017)),'plant-living','Living room · plant');
registerFurniture(placeFurniture(detailedFurniture.plant(1.2),furn,8.15,Z(1012)),'plant-office','Office · plant');
const readingLamp=registerFurniture(placeFurniture(detailedFurniture.floorLamp(),furn,8.98,Z(760)),'lamp-living','Living room · floor lamp');
// Table-top accents travel with the furniture they sit on.
const accent=(id,item,x,y,z)=>{item.position.set(x,y,z);movableObjects.find(o=>o.userData.furniture.id===id).add(item);};
accent('dining-table',detailedFurniture.vase(),0,.79,-.45);accent('coffee-table',detailedFurniture.books(),-.08,.465,.06);
const fruitBowl=detailedFurniture.bowl();fruitBowl.position.set(13.35,.895,Z(460)-.12);furn.add(fruitBowl);
// A person gives the rooms their scale: a young woman, 1.65 m, with long brown hair.
const person=registerFurniture(placeFurniture(buildCharacter(createCharacterMaterials()),furn,12.4,3.62,.62),'person','Person · 1.65 m');
// Bathroom fittings traced from the plan: ML cupboard NW, basin SW, bath east.
// Fixed plumbing keeps existing saved movable-furniture layouts compatible.
const bathroom=new THREE.Group();bathroom.name='SDB · fixed fittings';furn.add(bathroom);
const wc=new THREE.Group();wc.name='WC · fixed fittings';furn.add(wc);
const tubX=X(1097),tubZ=Z(363);
box(bathroom,tubX,0,tubZ,.70,.55,1.60,white);
box(bathroom,tubX,.55,tubZ,.57,.012,1.43,water);
cyl(bathroom,tubX,.57,Z(300),.018,.17,metal);box(bathroom,tubX,.72,Z(305),.035,.025,.14,metal);
// The circular symbol below ML is a washbasin, not a second WC.
const basinX=X(958),basinZ=Z(396);
box(bathroom,basinX,.12,basinZ,.45,.68,.80,mats.joinery);
box(bathroom,basinX,.80,basinZ,.46,.045,.81,white);
cyl(bathroom,basinX,.845,basinZ,.20,.055,white);
cyl(bathroom,basinX,.899,basinZ,.155,.003,water);
cyl(bathroom,X(941),.845,basinZ,.014,.17,metal);
box(bathroom,X(946),1.0,basinZ,.14,.025,.025,metal);
box(bathroom,X(934),1.1,basinZ,.015,.85,.65,metal);
// ML: 60 cm front-loader facing east into the bathroom aisle.
const washer=new THREE.Group();washer.name='ML · washing machine';bathroom.add(washer);
box(washer,X(966),.02,Z(324),.60,.83,.60,white);
box(washer,X(994),.71,Z(324),.025,.10,.55,metal);
const drum=cyl(washer,X(996),.29,Z(324),.21,.025,dark);
drum.rotation.z=Math.PI/2;drum.position.y=.44;
const drumGlass=cyl(washer,X(998),.29,Z(324),.16,.027,glass);
drumGlass.rotation.z=Math.PI/2;drumGlass.position.y=.44;
// Tall panels trim with the walls, without squashing the door or appliance.
w(936,286,1082,286,.035,boxH,[],null,mats.joinery,true);
w(936,358,997,358,.05,boxH,[],null,mats.walls,true);
const laundryDoor=w(999,290,999,354,.025,boxH,[],null,mats.joinery,true);
laundryDoor.name='ML · full-height wooden door';
const laundryDoorWall=walls[walls.length-1];
const laundryHandle=box(laundryDoor,Z(354)-Z(290)-.06,1.02,-.035,.018,.18,.025,metal);
laundryDoorWall.parts.push({mesh:laundryHandle,height:.18,bottom:1.02,top:1.20,followsCeiling:false});
// Separate WC: toilet against the rear service cupboard, hand basin by entry.
w(830,304,927,304,.04,4,[],null,mats.walls);
box(wc,X(873),.32,Z(313),.37,.43,.15,white);
const toilet=cyl(wc,X(873),.12,Z(336),.19,.29,white);toilet.scale.z=1.42;
const seat=cyl(wc,X(873),.41,Z(336),.20,.035,white);seat.scale.z=1.43;
const bowl=cyl(wc,X(873),.447,Z(336),.135,.003,water);bowl.scale.z=1.45;
box(wc,X(919),.72,Z(417),.22,.10,.34,white);
cyl(wc,X(919),.82,Z(417),.08,.005,water);
cyl(wc,X(925),.82,Z(417),.012,.12,metal);
box(furn,.50,.02,Z(642),.95,.08,.98,white);box(furn,.99,.10,Z(642),.015,2,.98,glass);box(furn,1.8,0,Z(625),1.1,.8,.50,mats.joinery);box(furn,1.8,.8,Z(625),1.1,.05,.52,white);cyl(furn,1.8,.85,Z(625),.22,.06,white);
// Radiators follow the long exterior walls.
for(const [x,z,len,rot]of[[.95,Z(1043),1.5,0],[8,Z(1043),1.15,0],[9.4,Z(1043),1.35,0],[13.75,Z(960),.8,Math.PI/2]]){const g=new THREE.Group();furn.add(g);g.position.set(x,0,z);g.rotation.y=rot;for(let i=0;i<len/.075;i++)box(g,-len/2+i*.075,.14,0,.05,.55,.13,white)}
label('Chambre 1','11.23 m²',new THREE.Vector3(1.47,.2,7.8));label('Chambre 2','9.67 m²',new THREE.Vector3(4.25,.2,7.8));label('Bureau','10.58 m²',new THREE.Vector3(7.15,.2,7.7));label('Séjour','26.49 m² · H 4.00 m',new THREE.Vector3(11.05,.2,6.3));label('Cuisine','12.84 m² · H 4.00 m',new THREE.Vector3(12.15,.2,2.8));label('Entrée + SDB','H 2.90 m',new THREE.Vector3(9.6,2.99,1.6));label('Salle d’eau','6.43 m²',new THREE.Vector3(3.1,.2,4.35));

tagSolids(architecture);tagSolids(furn);

// One section cut, and the renderer that draws it with filled cut faces.
const modelBounds=new THREE.Box3(new THREE.Vector3(-.22,-.26,-.22),new THREE.Vector3(14.27,4.7,8.9));
const section=createSectionCut(modelBounds);
const pipeline=createPipeline({renderer,scene,overlay,section});
// Local viewing preferences: the moment shown (live, or a chosen date and time in Lyon),
// the bearing of the window façade and the rendering quality.
const view={live:true,...localTime(Date.now()),bearing:SITE.facadeBearing,quality:touchFirst?'standard':'high'};
try{const saved=JSON.parse(localStorage.getItem('ivry-view-v2'));if(saved){if(saved.live===false&&isDate(saved.date)&&Number.isFinite(saved.minutes)){view.live=false;view.date=saved.date;view.minutes=Math.max(0,Math.min(1439,Math.round(saved.minutes)));}if(Number.isFinite(saved.bearing))view.bearing=((saved.bearing%360)+360)%360;if(['high','standard'].includes(saved.quality))view.quality=saved.quality;}}catch{}
if(['high','standard'].includes(query.get('quality')))view.quality=query.get('quality');
// ?date=2026-06-21&time=15:30 (or the older ?hour=15.5) pins the moment, e.g. in a shared link.
const pinnedTime=/^(\d{1,2}):(\d{2})$/.exec(query.get('time')||''),pinnedHour=Number(query.get('hour'));
if(isDate(query.get('date'))){view.live=false;view.date=query.get('date');}
if(pinnedTime){view.live=false;view.minutes=Math.min(1439,Number(pinnedTime[1])*60+Number(pinnedTime[2]));}else if(query.get('hour')&&Number.isFinite(pinnedHour)){view.live=false;view.minutes=Math.max(0,Math.min(1439,Math.round(pinnedHour*60)));}
function saveView(){try{localStorage.setItem('ivry-view-v2',JSON.stringify(view));}catch{}}
let joystick=null,daylight=null;
// The sun stands where it really is over the building at that moment.
function applyDaylight(){
if(view.live)Object.assign(view,localTime(Date.now()));
const sun=sunPosition(toInstant(view.date,view.minutes),SITE.latitude,SITE.longitude),light=daylight=daylightFor(sun,view.bearing);pipeline.setDaylight(light);
const lit=light.lamps>.02;for(const lamp of [...lampLights,readingLamp.userData.lamp]){lamp.visible=lit;lamp.intensity=(lamp.userData.power||2.6)*light.lamps;}
furnitureMaterials.glow.emissiveIntensity=light.lamps*3.4;
const times=sunTimes(view.date,SITE.latitude,SITE.longitude),clock=formatTime(view.minutes),polar=times.sunrise===null||times.sunset===null;
const moments={morning:polar?540:times.sunrise+90,midday:times.noon,golden:polar?1140:times.sunset-70,evening:polar?1290:Math.min(1439,times.sunset+50)};
$('day-hour').value=view.minutes/60;$('day-hour-value').value=clock;$('day-date').value=view.date;$('light-label').textContent=view.live?'Now · '+clock:clock;$('day-now').classList.toggle('active',view.live);
document.querySelectorAll('#day-presets [data-moment]').forEach(b=>{b.dataset.minutes=Math.round(moments[b.dataset.moment]);b.classList.toggle('active',!view.live&&Math.abs(moments[b.dataset.moment]-view.minutes)<8);});
document.querySelectorAll('#day-seasons [data-day]').forEach(b=>b.classList.toggle('active',view.date.slice(5)===b.dataset.day));
$('sun-info').textContent=(polar?'':'Sunrise '+formatTime(times.sunrise)+' · sunset '+formatTime(times.sunset)+' · ')+(light.sunHeight>0?'sun '+Math.round(light.sunHeight)+'° high in the '+compassPoint(sun.azimuth*180/Math.PI):'sun below the horizon');
$('facade-bearing').value=view.bearing;$('facade-bearing-value').value=Math.round(view.bearing)+'° · '+compassPoint(view.bearing);
joystick?.setRotation(Math.PI-view.bearing*Math.PI/180);invalidate();
}
setInterval(()=>{if(view.live&&!document.hidden)applyDaylight();},60000);document.addEventListener('visibilitychange',()=>{if(view.live&&!document.hidden)applyDaylight();});

let activeView='overview',transition=null,spin=null;// Room shortcuts orbit each room from the south-east, like the overview, but close up.
const rooms=[['kitchen','Kitchen',12.4,2.0,6.5],['living','Living room',11.0,7.0,8.5],['dining','Dining table',12.6,5.8,6],['entry','Entry & bathroom',9.3,1.9,6],['bedroom-1','Bedroom 1',1.5,7.4,7],['bedroom-2','Bedroom 2',4.25,7.5,6.5],['office','Office',7.15,7.5,6.5],['shower','Shower room',3.1,4.35,5]],roomDirection=new THREE.Vector3(12,16,16.8).normalize();
const presets={...Object.fromEntries(rooms.map(([id,,x,z,d])=>['room-'+id,{p:new THREE.Vector3(x,.8,z).addScaledVector(roomDirection,d).toArray(),t:[x,.8,z]}])),bathroom:{p:[7.0,7.8,5.2],t:[9.45,.6,1.15]},overview:{p:[19,16,21],t:[7,0,4.2]},living:{p:[20,12,17],t:[11.1,1,4.3]},inside:{p:[11.15,1.65,8.1],t:[11.4,1.8,.7]},plan:{p:[7,24,4.34],t:[7,0,4.3]}};
for(const [id,name] of rooms){const item=document.createElement('button');item.className='menu-item';item.dataset.view='room-'+id;const text=document.createElement('span');text.textContent=name;item.append(text);$('room-list').append(item);}
const viewFit=()=>{const rect=wrap.getBoundingClientRect();return Math.max(1,1.25/(rect.width/Math.max(1,rect.height)));};
// A preset's camera position and target, pulled back on narrow screens so the model fits.
function presetPose(name){const source=presets[name],fit=name==='inside'||name==='plan'?1:viewFit();return {p:source.p.map((v,i)=>source.t[i]+(v-source.t[i])*fit),t:[...source.t]};}
function markView(name){document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));const item=document.querySelector(`.menu-item[data-view="${name}"] span`);$('views-label').textContent=name==='walkthrough'?'Walking':name==='inside'?'Inside':item?item.textContent:'Views';}
let inspectRestore=null;
function setView(name,instant=false){if(walkthrough?.active)walkthrough.exit(false);if(inspectRestore&&name!=='bathroom'){const [wallMode,ceilingMode]=inspectRestore;inspectRestore=null;choose('wall-mode',wallMode);choose('ceiling-mode',ceilingMode);}const previous=camera;camera=name==='plan'?orthographic:perspective;if(camera!==previous){camera.position.copy(previous.position);controls.object=camera;}activeView=name;spin=null;$('viewport').classList.toggle('interior',name==='inside');if(camera.isPerspectiveCamera)camera.fov=name==='inside'?62:40;camera.zoom=1;camera.updateProjectionMatrix();const p=presetPose(name);markView(name);if(instant){camera.position.fromArray(p.p);controls.target.fromArray(p.t);controls.update()}else transition={from:camera.position.clone(),to:new THREE.Vector3(...p.p),ft:controls.target.clone(),tt:new THREE.Vector3(...p.t),start:performance.now()};invalidate(false);}
setView('overview',true);controls.addEventListener('start',()=>{transition=null;spin=null;});
document.addEventListener('click',event=>{const item=event.target.closest('[data-view]');if(item){setView(item.dataset.view);closeMenus();}const label=event.target.closest('.room-label[data-room]');if(label)setView('room-'+label.dataset.room);});
// Keep the orbit centre over the apartment so panning can never lose the model.
const orbitBounds=new THREE.Box3(new THREE.Vector3(-1,0,-1),new THREE.Vector3(15.5,3,11));
function keepTargetInside(){const shift=controls.target.clone().clamp(orbitBounds.min,orbitBounds.max).sub(controls.target);if(shift.lengthSq()){controls.target.add(shift);camera.position.add(shift);}}

// Picking. Hidden, ghosted, see-through and cut-away geometry never counts as a hit.
let selectedFurniture=null,furnitureDrag=null,rotationGesture=false,hoveredFurniture=null;
const layoutHistory=[],pickRay=new THREE.Raycaster(),pointerNDC=new THREE.Vector2(),floorPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
function rayFromPointer(event){const rect=renderer.domElement.getBoundingClientRect();pointerNDC.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);pickRay.setFromCamera(pointerNDC,camera);}
function effectivelyVisible(object){for(let p=object;p;p=p.parent)if(!p.visible)return false;return true;}
function solidHit(hit){const material=Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex??0]:hit.object.material;return effectivelyVisible(hit.object)&&!(material.transparent&&material.opacity<.5)&&!(section.active&&section.plane.distanceToPoint(hit.point)<0);}
function pickFurniture(event){if(!furn.visible)return null;scene.updateMatrixWorld(true);rayFromPointer(event);const hit=pickRay.intersectObjects(movableObjects,true).find(solidHit);if(!hit)return null;const blocker=pickRay.intersectObjects([architecture,roof,boxRoof,joists,beam],true).find(solidHit);if(blocker&&blocker.distance<hit.distance-.025)return null;let root=hit.object;while(root&&!root.userData.furniture)root=root.parent;return root?{object:root,point:hit.point}:null;}
function surfaceAt(event){scene.updateMatrixWorld(true);rayFromPointer(event);const hit=pickRay.intersectObjects([architecture,furn,roof,boxRoof,joists,beam],true).find(solidHit);if(!hit)return null;const material=Array.isArray(hit.object.material)?hit.object.material[hit.face.materialIndex]:hit.object.material,picked=material?.userData.surfaceKey,key=surfaceAliases[picked]||picked;return key?{key,point:hit.point.clone()}:null;}
// Double-click/double-tap flies the orbit centre to that point and moves closer.
function focusAt(event){if(walkthrough?.active)return;scene.updateMatrixWorld(true);rayFromPointer(event);const hit=pickRay.intersectObjects([architecture,furn],true).find(solidHit);const point=hit?hit.point.clone():pickRay.ray.intersectPlane(floorPlane,new THREE.Vector3());if(!point)return;flyTo(point);}
function flyTo(point,closer=.55,nearest=3.5){point.clamp(orbitBounds.min,orbitBounds.max);point.y=Math.min(point.y,1.2);const offset=camera.position.clone().sub(controls.target);if(camera.isPerspectiveCamera){const distance=offset.length();offset.setLength(Math.min(distance,Math.max(distance*closer,nearest)));}else{camera.zoom=Math.min(8,camera.zoom*1.5);camera.updateProjectionMatrix();}spin=null;transition={from:camera.position.clone(),to:point.clone().add(offset),ft:controls.target.clone(),tt:point,start:performance.now()};invalidate(false);}

// Keyboard orbit: WASD/arrows move across the floor, Q/E turn. Selected furniture keeps the arrows.
window.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)||document.activeElement.closest?.('.joystick')||selectedFurniture||walkthrough?.active||e.metaKey||e.ctrlKey||e.altKey)return;const key=e.key.toLowerCase(),pan={arrowup:[0,1],w:[0,1],arrowdown:[0,-1],s:[0,-1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]}[key];
if(pan){e.preventDefault();transition=null;spin=null;const forward=controls.target.clone().sub(camera.position);forward.y=0;if(forward.lengthSq()<1e-6)forward.set(0,0,-1);forward.normalize();const right=new THREE.Vector3().crossVectors(forward,camera.up).normalize(),step=camera.isPerspectiveCamera?Math.max(.25,camera.position.distanceTo(controls.target)*.06):1.5/camera.zoom,move=forward.multiplyScalar(pan[1]*step).addScaledVector(right,pan[0]*step);controls.target.add(move);camera.position.add(move);}
else if(key==='q'||key==='e'){e.preventDefault();transition=null;spin=null;const offset=camera.position.clone().sub(controls.target).applyAxisAngle(camera.up,(key==='q'?-1:1)*Math.PI/12);camera.position.copy(controls.target).add(offset);}});
function segmentCross(a,b,c,d){const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;}
// Walls ease to their cutaway height and ceilings come and go with the camera height.
// Returns true while something is still changing so the frame loop keeps drawing.
function updateCutaway(){let changed=false,mode=walkthrough?.active?'full':$('wall-mode').value;if(section.active&&mode==='auto')mode='full';
// During the introduction the apartment stays closed until the building has been lifted away.
const staged=intro?.stage,snap=staged&&staged.approach<.3;if(staged)mode=staged.clear<.6?'full':'auto';
const elevated=camera.position.y>mainH+.2;const cam2=[camera.position.x,camera.position.z],tar2=[controls.target.x,controls.target.z];
for(const w of walls){let scale=1;const h=w.lowBox?boxH:w.h+(mainH-4);if(mode==='off')scale=w.isFurniture?1:.001;else if(mode==='low')scale=.035;else if(mode==='auto'){const mx=(w.a[0]+w.b[0])/2,mz=(w.a[1]+w.b[1])/2;const front=w.out&&((camera.position.x-mx)*w.out[0]+(camera.position.z-mz)*w.out[1]>.3);const obstruct=segmentCross(cam2,tar2,w.a,w.b)&&camera.position.y<h+2;if(elevated&&!w.out&&!w.lowBox)scale=.29;if((front&&elevated)||obstruct)scale=.035;if(activeView==='plan'&&elevated)scale=.035;}
const target=scale*h;if(w.cutHeight!==target||w.shownHeight!==h){w.cutHeight+=(target-w.cutHeight)*.18;if(snap||Math.abs(target-w.cutHeight)<.003)w.cutHeight=target;w.shownHeight=h;applyWallCut(w,h,w.cutHeight);changed=true;}
const visible=w.isFurniture||mode!=='off';if(w.g.visible!==visible){w.g.visible=visible;changed=true;}}
const cm=staged?(staged.clear<.7?'full':'auto'):walkthrough?.active?'full':$('ceiling-mode').value,y=camera.position.y,underBox=camera.position.x>8.62&&camera.position.x<X(1134)&&camera.position.z<Z(600);
const showRoof=cm==='full'||(cm==='auto'&&y<mainH-.12),showJoists=cm==='full'||cm==='structure'||(cm==='auto'&&y<mainH),showBeam=cm!=='off'&&activeView!=='plan';
let showBox=cm==='full'||(cm==='auto'&&(y>boxH+.25||underBox));if(cm==='structure'||(activeView==='plan'&&cm==='auto'))showBox=false;
for(const [group,show] of [[roof,showRoof],[boxRoof,showBox],[joists,showJoists],[beam,showBeam],[lamps,showJoists&&cm!=='off']])if(group.visible!==show){group.visible=show;changed=true;}
return changed;
}
function showLabels(){const r=wrap.getBoundingClientRect(),walking=walkthrough?.active;for(const a of [...roomLabels,...dimensionLabels]){const isDim=dimensionLabels.includes(a);const show=!intro&&(isDim?$('dimensions').checked:($('room-labels').checked&&!walking&&camera.position.y>4.5))&&!(section.active&&section.plane.distanceToPoint(a.pos)<0);const p=a.pos.clone().project(camera);a.el.style.display=show&&p.z<1&&p.z>-1?'block':'none';a.el.style.left=(p.x*.5+.5)*r.width+'px';a.el.style.top=(-p.y*.5+.5)*r.height+'px';}}
function resize(){const r=wrap.getBoundingClientRect();if(r.width<2||r.height<2)return;perspective.aspect=r.width/r.height;perspective.updateProjectionMatrix();const planHalfHeight=Math.max(6.7,8/(r.width/r.height));orthographic.left=-planHalfHeight*r.width/r.height;orthographic.right=planHalfHeight*r.width/r.height;orthographic.top=planHalfHeight;orthographic.bottom=-planHalfHeight;orthographic.updateProjectionMatrix();pipeline.setSize(r.width,r.height,Math.min(devicePixelRatio,view.quality==='high'?2:1.5));invalidate(false);}
new ResizeObserver(resize).observe(wrap);pipeline.setQuality(view.quality);resize();

// The loop runs every frame but only draws when the picture can have changed: camera
// motion, easing walls, edits, or the settle pass that restores full quality.
const cameraState=new Float64Array(9);let lastFrame=performance.now(),lastDrawn=0,lastChange=0,settled=false,occlusionWhileMoving=true,slowFrames=0;
function cameraMoved(){const c=camera,next=[c.position.x,c.position.y,c.position.z,c.quaternion.x,c.quaternion.y,c.quaternion.z,c.quaternion.w,c.zoom,c.fov||0];let moved=false;for(let i=0;i<9;i++){if(Math.abs(next[i]-cameraState[i])>1e-6)moved=true;cameraState[i]=next[i];}return moved;}
function drawNow(full=true){showLabels();updateHandles();const distance=walkthrough?.active?4:camera.position.distanceTo(controls.target);pipeline.render(camera,{ao:full||occlusionWhileMoving,shadows:shadowsDirty,reach:THREE.MathUtils.clamp(distance*.035,.26,.75)});shadowsDirty=false;lastDrawn=performance.now();}
function frame(t){requestAnimationFrame(frame);const dt=Math.min(.1,(t-lastFrame)/1000);lastFrame=t;
if(transition){let p=Math.min((t-transition.start)/850,1);p=1-Math.pow(1-p,3);camera.position.lerpVectors(transition.from,transition.to,p);controls.target.lerpVectors(transition.ft,transition.tt,p);if(p>=1)transition=null}
if(spin){let p=Math.min((t-spin.start)/520,1);p=p*p*(3-2*p);const next=new THREE.Vector3().setFromSphericalCoords(spin.radius,spin.phi0+(spin.phi1-spin.phi0)*p,spin.theta0+(spin.theta1-spin.theta0)*p);camera.position.copy(controls.target).add(next);if(p>=1)spin=null;}
if(intro)stepIntro(t);
const steering=joystick.update(dt,camera.quaternion);
if(walkthrough?.active)walkthrough.update(t);else if(!intro){controls.update();keepTargetInside();}
const easing=updateCutaway();if(easing)shadowsDirty=true;
if(cameraMoved()||easing||steering||renderFrames>0||transition||spin||furnitureDrag||intro){
if(renderFrames>0)renderFrames--;
// Sustained slow frames: first skip occlusion while moving, then fall back to fast rendering.
if(t-lastChange<120){slowFrames=dt>.05?slowFrames+1:Math.max(0,slowFrames-1);if(slowFrames>20&&occlusionWhileMoving){occlusionWhileMoving=false;slowFrames=0;}else if(slowFrames>90&&view.quality==='high'&&!query.get('quality')){slowFrames=0;setQuality('standard');toast('Switched to fast rendering to keep things smooth');}}
drawNow(false);lastChange=t;settled=false;
}else if(!settled&&t-lastChange>160){drawNow(true);settled=true;}
else if(t-lastDrawn>1000)drawNow(true);
}
function toast(msg){$('toast').textContent=msg;$('toast').style.opacity=1;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').style.opacity=0,2800)}
function persist(){queueDesignSave();try{localStorage.setItem('ivry-finishes-v1',JSON.stringify(state))}catch{toast('Browser storage unavailable; finishes remain for this visit.')}}
for(const type of ['pointerdown','pointerup','keydown','keyup','input','change','click'])document.addEventListener(type,()=>invalidate(),{capture:true,passive:true});

// ---------- Surfaces: click a wall or floor, then choose its finish.
const overlayMaterial=new THREE.MeshBasicMaterial({color:0x13a6d5,transparent:true,opacity:.32,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,toneMapped:false});
let surfaceAnchor=null,focusedSurface=null;
function updateSurfaceSelection(){
for(const mesh of surfaceOverlays){mesh.removeFromParent();mesh.geometry.dispose();}surfaceOverlays.length=0;
const meshes=[];architecture.traverse(mesh=>{if(mesh.isMesh)meshes.push(mesh);});
for(const mesh of meshes){const geometry=selectionGeometry(mesh,selectedSurfaces);if(!geometry)continue;const overlayMesh=new THREE.Mesh(geometry,[overlayMaterial]);overlayMesh.userData.selectionOverlay=true;overlayMesh.userData.noAO=true;overlayMesh.raycast=()=>{};overlayMesh.renderOrder=20;mesh.add(overlayMesh);surfaceOverlays.push(overlayMesh);}
$('surface-selection').hidden=!selectedSurfaces.size;$('selection-count').textContent=selectedSurfaces.size+' surface'+(selectedSurfaces.size===1?'':'s')+' selected';
$('selection-list').textContent=[...selectedSurfaces].map(key=>surfaceMeta[key].label).join(' · ');
if(selectedSurfaces.size)focusedSurface=null;else if(!focusedSurface)surfaceAnchor=null;if(section.active)pipeline.setClipping(true);syncSurfaceBar();updateHint();invalidate(false);
}
function selectSurface(key,additive=false){const next=nextSurfaceSelection(selectedSurfaces,key,additive);selectedSurfaces.clear();for(const id of next)selectedSurfaces.add(id);if(selectedSurfaces.size)$('surface').value=[...selectedSurfaces].at(-1);else $('surface').value=key;updateSurfaceSelection();surfaceUI();}
function clearSurfaceSelection(){if(!selectedSurfaces.size&&!focusedSurface)return;selectedSurfaces.clear();focusedSurface=null;updateSurfaceSelection();}
// The floor, joinery, worktops and ceilings are single finishes: clicking one opens it.
function focusSurface(key){selectedSurfaces.clear();focusedSurface=key;$('surface').value=key;updateSurfaceSelection();surfaceUI();}
function surfaceTargets(){return selectedSurfaces.size?[...selectedSurfaces]:[$('surface').value];}
function currentColour(){const key=$('surface').value,s=state[key];return s.tint==='#ffffff'?catalog.find(f=>f.id===s.finish).color:s.tint;}
function saveRecentColour(colour){recentColours=rememberColour(recentColours,colour);try{localStorage.setItem('ivry-recent-colours-v1',JSON.stringify(recentColours));}catch{}renderRecentColours();}
function swatchButton(colour,label,apply){const b=document.createElement('button');b.className='recent-colour';b.style.setProperty('--colour',colour);b.title=label;b.setAttribute('aria-label',label);b.onclick=apply;return b;}
function renderRecentColours(){
$('recent-colours').replaceChildren();$('furniture-recent-colours').replaceChildren();$('recent-empty').hidden=recentColours.length>0;
recentColours.forEach((colour,index)=>{$('recent-colours').append(swatchButton(colour,(index===0?'Last used · ':'Apply saved colour ')+colour,()=>{applyColour(colour);saveRecentColour(colour);persist();}));$('furniture-recent-colours').append(swatchButton(colour,'Apply furniture colour '+colour,()=>setFurnitureColour(colour)));});
syncSurfaceBar();
}
function applyColour(colour){for(const key of surfaceTargets()){state[key].finish='paint';state[key].tint=colour;delete customTextures[key];applyMaterial(key);}persist();surfaceUI();}
$('save-colour').onclick=()=>{saveRecentColour(currentColour());persist();toast('Colour saved to your reusable palette');};
$('clear-surfaces').onclick=()=>{clearSurfaceSelection();surfaceUI();};
const surfaceGroups={};
for(const [key,meta] of Object.entries(surfaceMeta)){if(surfaceAliases[key])continue;let group=surfaceGroups[meta.group];if(!group){group=document.createElement('optgroup');group.label=meta.group;surfaceGroups[meta.group]=group;$('surface').append(group);}const option=document.createElement('option');option.value=key;option.textContent=meta.label;group.append(option);}
// One-tap chips for the surfaces that are not single wall faces.
for(const [key,name] of [['floor','Floor'],['joinery','Joinery'],['beams','Joists'],['mainbeam','Main beam'],['countertop','Worktops'],['stone','Kitchen floor'],['ceiling','Ceilings']]){const chip=document.createElement('button');chip.textContent=name;chip.dataset.surface=key;chip.onclick=()=>{clearSurfaceSelection();$('surface').value=key;surfaceUI();};$('surface-chips').append(chip);}
function surfaceUI(){const key=$('surface').value,s=state[key],f=catalog.find(f=>f.id===s.finish);$('material-name').textContent=customTextures[key]?'Your uploaded texture':f.name;$('material-description').textContent=surfaceMeta[key]?.tile?'5 × 5 cm tiles · 2 mm grout · '+(selectedSurfaces.size>1?'applies to selected surfaces':'this surface only'):customTextures[key]?'Included when you save or export the design':f.desc;$('material-preview').style.background=s.tint==='#ffffff'?f.color:s.tint;$('tint').value=surfaceMeta[key]&&s.tint==='#ffffff'?f.color:s.tint;$('roughness').value=s.roughness;$('roughness-value').value=Math.round(s.roughness*100)+'%';$('texture-scale').value=s.scale;$('scale-value').value=s.scale+'×';$('remove-texture').hidden=!customTextures[key];$('swatches').innerHTML='';
document.querySelectorAll('#surface-chips button').forEach(chip=>chip.classList.toggle('active',!selectedSurfaces.size&&chip.dataset.surface===key));
const tiled=surfaceTargets().some(key=>surfaceMeta[key]?.tile)||selectedSurfaces.size>1;$('texture').closest('.upload-box').hidden=tiled;$('texture-scale').hidden=tiled;document.querySelector('label[for="texture-scale"]').hidden=tiled;const relevant=tiled?catalog.filter(f=>f.id!=='paint'&&(f.kind==='plain'||f.kind==='stone')):key==='floor'||key==='joinery'||key==='beams'||key==='mainbeam'||surfaceMeta[key]?.parent==='joinery'?catalog.filter(f=>f.kind==='wood'||['chalk','sage','blue'].includes(f.id)):catalog.filter(f=>f.id!=='paint'&&f.kind!=='wood');for(const f of relevant){const b=document.createElement('button');b.className='swatch'+(s.finish===f.id?' active':'');b.setAttribute('aria-label',f.name);b.setAttribute('aria-pressed',String(s.finish===f.id));const i=document.createElement('i');i.style.background=f.kind==='wood'?`repeating-linear-gradient(93deg,transparent 0px,${f.color} 2px,transparent 5px,${f.color} 8px),linear-gradient(15deg,${f.color},${f.color}bb)`:f.color;b.append(i,document.createTextNode(f.name));b.onclick=()=>{for(const target of surfaceTargets()){state[target].finish=f.id;state[target].tint='#ffffff';if(f.kind==='metal')state[target].roughness=.25;delete customTextures[target];applyMaterial(target);}saveRecentColour(f.color);persist();surfaceUI()};$('swatches').append(b)}
syncSurfaceBar();}
$('surface').onchange=()=>{const key=$('surface').value;if(surfaceMeta[key])selectSurface(key);else{clearSurfaceSelection();$('surface').value=key;surfaceUI();}};for(const [id,field]of[['tint','tint'],['roughness','roughness'],['texture-scale','scale']])$(id).oninput=()=>{
if(field==='tint'){applyColour($(id).value);return;}
for(const key of surfaceTargets()){state[key][field]=Number($(id).value);applyMaterial(key);}persist();surfaceUI();
};
$('tint').onchange=()=>{saveRecentColour($('tint').value);persist();};
$('texture').onchange=async()=>{const file=$('texture').files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('Choose a JPG, PNG or WebP image.');return}const key=$('surface').value;try{const img=await createImageBitmap(file,{resizeWidth:1024,resizeQuality:'high'});const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;customTextures[key]=tex;state[key].tint='#ffffff';applyMaterial(key);surfaceUI();queueDesignSave();toast('Texture applied · included in design saves and exports')}catch{toast('This image could not be loaded. Try another file.')}};
$('remove-texture').onclick=()=>{const k=$('surface').value;delete customTextures[k];$('texture').value='';applyMaterial(k);surfaceUI();queueDesignSave()};
$('reset').onclick=()=>{if(!confirm('Reset every wall, floor and furniture colour to the original palette? Furniture positions are kept.'))return;state=structuredClone(defaults);furnitureColours={};for(const parts of furnitureParts.values())applyFurnitureColours(parts);for(const key in state){delete customTextures[key];applyMaterial(key)}persist();surfaceUI();furnitureColourUI();toast('Original material palette restored')};
// Quick colours float beside the selected surfaces.
const quickColours=['#f1efe5','#929e83','#b77d63','#7d9da5','#485654'];
function syncSurfaceBar(){const bar=$('surface-bar');bar.hidden=!(selectedSurfaces.size||focusedSurface)||!!selectedFurniture;if(bar.hidden)return;const keys=[...selectedSurfaces];$('surface-bar-name').textContent=keys.length>1?keys.length+' surfaces':keys.length?surfaceMeta[keys[0]].label:$('surface').selectedOptions[0]?.textContent||'Surface';
$('surface-bar-colours').replaceChildren(...[...new Set([...recentColours.slice(0,3),...quickColours])].slice(0,6).map(colour=>swatchButton(colour,'Paint the selection '+colour,()=>{applyColour(colour);saveRecentColour(colour);})));$('surface-bar-tint').value=$('tint').value;}
$('surface-bar-tint').oninput=()=>applyColour($('surface-bar-tint').value);$('surface-bar-tint').onchange=()=>{saveRecentColour($('surface-bar-tint').value);persist();};
$('surface-bar-edit').onclick=()=>showPanel('materials',true);$('surface-bar-close').onclick=()=>{clearSurfaceSelection();surfaceUI();};

// ---------- Display, light and space controls.
function choose(id,value){const element=$(id);element.value=value;element.dispatchEvent(new Event('change',{bubbles:true}));}
$('furniture').onchange=()=>{furn.visible=$('furniture').checked;if(!furn.visible)selectFurniture(null);};$('person-visible').onchange=()=>{person.visible=$('person-visible').checked;if(!person.visible&&selectedFurniture===person)selectFurniture(null);};$('dimensions').onchange=()=>dims.visible=$('dimensions').checked;$('zone-colors').onchange=()=>zones.visible=$('zone-colors').checked;$('laundry-open').onchange=()=>{const open=$('laundry-open').checked;laundryDoor.rotation.y=open?0:-Math.PI/2;const length=Z(354)-Z(290);laundryDoorWall.b=[X(999)+(open?length:0),Z(290)+(open?0:length)];};$('inspect-bathroom').onclick=()=>{inspectRestore??=[$('wall-mode').value,$('ceiling-mode').value];choose('ceiling-mode','off');choose('wall-mode','low');setView('bathroom');};$('wall-mode').onchange=()=>{$('status').textContent={auto:'Near walls lower as you orbit.',full:'Every wall at full height.',low:'All walls lowered to the skirting.',off:'Walls hidden.'}[$('wall-mode').value]};
function heights(){queueDesignSave();boxH=Number($('box-height').value);mainH=Number($('main-height').value);document.querySelector('.height-card>div').innerHTML='<b>'+boxH.toFixed(2)+' m</b><i>→</i><b>'+mainH.toFixed(2)+' m</b>';$('box-height-value').value=boxH.toFixed(2)+' m';$('main-height-value').value=mainH.toFixed(2)+' m';makeCeilings();applyDaylight();for(const l of roomLabels){if(l.el.firstChild.textContent==='Entrée + SDB'){l.pos.y=boxH+.09;l.el.querySelector('span').textContent='H '+boxH.toFixed(2)+' m'}else if(['Séjour','Cuisine'].includes(l.el.firstChild.textContent))l.el.querySelector('span').textContent=l.el.firstChild.textContent==='Séjour'?'26.49 m² · H '+mainH.toFixed(2)+' m':'12.84 m² · H '+mainH.toFixed(2)+' m'}}$('box-height').oninput=heights;$('main-height').oninput=heights;$('restore-height').onclick=()=>{$('box-height').value=2.9;$('main-height').value=4;heights()};
// Choosing a time or date leaves "now"; the Now chip goes back to following the clock.
function showMoment(minutes,date=view.date){view.live=false;view.date=date;view.minutes=Math.max(0,Math.min(1439,Math.round(minutes)));applyDaylight();saveView();}
$('day-hour').oninput=()=>showMoment(Number($('day-hour').value)*60);
$('day-date').onchange=()=>{if(isDate($('day-date').value))showMoment(view.minutes,$('day-date').value);else applyDaylight();};
$('day-now').onclick=()=>{view.live=true;applyDaylight();saveView();};
document.querySelectorAll('#day-presets [data-moment]').forEach(b=>b.onclick=()=>showMoment(Number(b.dataset.minutes)));
document.querySelectorAll('#day-seasons [data-day]').forEach(b=>b.onclick=()=>showMoment(view.minutes,view.date.slice(0,5)+b.dataset.day));
$('facade-bearing').oninput=()=>{view.bearing=Number($('facade-bearing').value);applyDaylight();saveView();};
function setQuality(quality){view.quality=quality;$('quality').value=quality;$('quality').syncSegmented?.();$('quality-note').textContent=quality==='high'?'Soft contact shadows and fine sunlight.':'Lighter on phones and older computers.';occlusionWhileMoving=true;slowFrames=0;pipeline.setQuality(quality);resize();saveView();invalidate();}
$('quality').value=view.quality;$('quality').onchange=()=>setQuality($('quality').value);
function zoom(f){if(walkthrough?.active){walkthrough.zoom(f);return;}transition=null;spin=null;if(camera.isOrthographicCamera){camera.zoom=Math.max(.4,Math.min(8,camera.zoom/f));camera.updateProjectionMatrix();return}const d=camera.position.clone().sub(controls.target);d.multiplyScalar(f);d.clampLength(.35,60);camera.position.copy(controls.target).add(d);controls.update()}$('zoom-in').onclick=()=>zoom(.83);$('zoom-out').onclick=()=>zoom(1.2);$('home').onclick=()=>setView('overview');$('export').onclick=()=>{drawNow(true);const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');a.download='ivry-apartment-view.png';a.click();toast('View saved as PNG')};$('enlarge-plan').onclick=()=>$('plan-dialog').showModal();$('close-plan').onclick=()=>$('plan-dialog').close();
window.addEventListener('keydown',e=>{if(/INPUT|SELECT/.test(document.activeElement.tagName))return;if(e.key==='Home')setView('overview');if(e.key==='+')zoom(.9);if(e.key==='-')zoom(1.1)});
// Read-only model metadata is useful when inspecting the saved reconstruction.
window.ivryModel={units:'metres',bedroomWidths:[2.93,2.72,2.76],livingWidth:5.125,roomAreaSum:91.5,mainBeam:{width:.30,depth:.40,source:'inferred section; plan-aligned position'},get heights(){return{box:boxH,main:mainH}},get camera(){return camera.position.toArray()},get materials(){return structuredClone(state)},get furniture(){return movableObjects.map(o=>({id:o.userData.furniture.id,name:o.userData.furniture.label,x:o.position.x,z:o.position.z,angle:THREE.MathUtils.radToDeg(o.rotation.y)}))},get wallCount(){return walls.length},get moment(){return {live:view.live,date:view.date,minutes:view.minutes,bearing:view.bearing,sunHeight:daylight.sunHeight,lamps:daylight.lamps}},get intro(){return intro?(performance.now()-intro.start)/1000:null},introAt(seconds,hold=false){if(!intro)startIntro();intro.start=performance.now()-seconds*1000;intro.hold=hold?seconds:null;invalidate();},get section(){return section.active?{normal:section.normal.toArray(),offset:section.offset,depth:section.depth,length:section.length,upright:section.upright}:null},get quality(){return view.quality},lookFrom(position,target){if(walkthrough?.active)walkthrough.exit(false);transition=null;spin=null;camera.position.fromArray(position);controls.target.fromArray(target);controls.update();invalidate(false);}};

// ---------- Furniture: click to select, drag the selected piece, turn it with the handle.
const normalizedAngle=r=>((THREE.MathUtils.radToDeg(r)%360)+360)%360;
function layoutSnapshot(){return movableObjects.map(o=>({id:o.userData.furniture.id,x:o.position.x,z:o.position.z,angle:o.rotation.y}));}
function restoreSnapshot(snapshot){for(const item of snapshot){const object=movableObjects.find(o=>o.userData.furniture.id===item.id);if(object&&[item.x,item.z,item.angle].every(Number.isFinite)&&item.x>=-2&&item.x<=16&&item.z>=-2&&item.z<=11){object.position.set(item.x,0,item.z);object.rotation.y=item.angle;}}invalidate();}
try{const saved=JSON.parse(localStorage.getItem('ivry-layout-v1'));if(Array.isArray(saved))restoreSnapshot(saved);}catch{}
function saveLayout(){queueDesignSave();invalidate();try{localStorage.setItem('ivry-layout-v1',JSON.stringify(layoutSnapshot()));$('layout-save-status').textContent='Layout saved locally in this browser';}catch{$('layout-save-status').textContent='Browser storage unavailable · layout kept for this visit';}}
function setUndo(available){$('undo-layout').disabled=$('undo-top').disabled=!available;}
function rememberLayout(snapshot=layoutSnapshot()){layoutHistory.push(snapshot);if(layoutHistory.length>30)layoutHistory.shift();setUndo(true);}
function syncObjectFields(){if(!selectedFurniture)return;const o=selectedFurniture;$('object-x').value=o.position.x.toFixed(2);$('object-z').value=o.position.z.toFixed(2);const deg=normalizedAngle(o.rotation.y);$('object-angle').value=Math.round(deg);$('object-angle-value').value=Math.round(deg)+'°';}
const furniturePartLabels={wood:'Wood & frame',upholstery:'Upholstery / fabric',bedding:'Bedding / scatter cushions',frame:'Frame / pot',backrest:'Backrest',hair:'Hair',top:'Jumper',bottoms:'Jeans',shoes:'Shoes',skin:'Skin'};
function furnitureColourUI(rebuild=false){if(!selectedFurniture)return;const id=selectedFurniture.userData.furniture.id,parts=furnitureParts.get(id),menu=$('furniture-part'),names=Object.keys(parts);$('furniture-finishes').hidden=!names.length;if(!names.length)return;if(rebuild||!parts[menu.value]){menu.replaceChildren();for(const key of names){const option=document.createElement('option');option.value=key;option.textContent=furniturePartLabels[key]||key;menu.append(option);}menu.value=parts.upholstery?'upholstery':parts.top?'top':names[0];}
const part=menu.value;$('furniture-colour').value=furnitureColours[id]?.[part]||'#'+parts[part][0].original.getHexString();$('furniture-colour-value').textContent=$('furniture-colour').value;$('furniture-colour-reset').disabled=!furnitureColours[id];}
function setFurnitureColour(colour,remember=true){if(!selectedFurniture)return;const id=selectedFurniture.userData.furniture.id,part=$('furniture-part').value;if(!part)return;(furnitureColours[id]??={})[part]=colour;applyFurnitureColours(furnitureParts.get(id),furnitureColours[id]);if(remember)saveRecentColour(colour);furnitureColourUI();queueDesignSave();invalidate();}
$('furniture-part').onchange=()=>furnitureColourUI();$('furniture-colour').oninput=()=>setFurnitureColour($('furniture-colour').value,false);$('furniture-colour').onchange=()=>{saveRecentColour($('furniture-colour').value);queueDesignSave();};
$('furniture-colour-save').onclick=()=>{saveRecentColour($('furniture-colour').value);queueDesignSave();toast('Furniture colour added to saved colours');};
$('furniture-colour-reset').onclick=()=>{if(!selectedFurniture)return;const id=selectedFurniture.userData.furniture.id;delete furnitureColours[id];applyFurnitureColours(furnitureParts.get(id));furnitureColourUI();queueDesignSave();invalidate();};
for(const colour of ['#b6b1a4','#7b8d78','#bd8065','#587d8b','#bb956a','#424b48'])$('furniture-swatches').append(swatchButton(colour,'Furniture swatch '+colour,()=>setFurnitureColour(colour)));
// The person can stand or sit; the pose travels with the design.
function setPose(pose,save=true){setCharacterPose(person,pose);person.userData.bounds=null;$('person-pose').value=person.userData.pose;$('person-pose').syncSegmented?.();$('bar-pose-label').textContent=person.userData.pose==='sit'?'Stand':'Sit';if(save)queueDesignSave();invalidate();}
$('person-pose').onchange=()=>setPose($('person-pose').value);$('bar-pose').onclick=()=>setPose(person.userData.pose==='sit'?'stand':'sit');
function selectFurniture(object){if(object===selectedFurniture)return;selectedFurniture=object;if(object)clearSurfaceSelection();$('object-controls').hidden=!object;
document.querySelectorAll('#object-list button').forEach(row=>row.classList.toggle('active',row.dataset.id===object?.userData.furniture.id));
if(object){$('object-name').textContent=object.userData.furniture.label;$('pose-row').hidden=$('bar-pose').hidden=object!==person;syncObjectFields();furnitureColourUI(true);showPanel('layout',false);document.querySelector('#object-list button.active')?.scrollIntoView({block:'nearest'});}
syncSelectionBar();syncSurfaceBar();updateHint();invalidate(false);}
function syncSelectionBar(){$('selection-bar').hidden=!selectedFurniture;if(selectedFurniture)$('selection-bar-name').textContent=selectedFurniture.userData.furniture.label;}
// Browsable furniture list, grouped by room.
const listGroups=new Map();
const groupOf=id=>id==='person'?'People':/^(wardrobe-1|bed-1|rug-bedroom)/.test(id)?'Bedroom 1':/^(wardrobe-2|bed-2)/.test(id)?'Bedroom 2':/office|desk/.test(id)?'Office':/^stool/.test(id)?'Kitchen':/^(chair|dining)/.test(id)?'Dining area':'Living room';
for(const title of ['People','Living room','Dining area','Kitchen','Bedroom 1','Bedroom 2','Office']){const heading=document.createElement('h4');heading.textContent=title;const box=document.createElement('div');box.className='object-group';box.append(heading);listGroups.set(title,box);}
for(const object of movableObjects){const {id,label}=object.userData.furniture,row=document.createElement('button');row.dataset.id=id;row.dataset.search=label.toLowerCase();row.textContent=label;row.onclick=()=>{selectFurniture(object);if(!walkthrough?.active)flyTo(object.position.clone(),.8,5);};listGroups.get(groupOf(id)).append(row);}
$('object-list').append(...listGroups.values());
$('object-search').oninput=()=>{const text=$('object-search').value.trim().toLowerCase();for(const box of listGroups.values()){let any=false;for(const row of box.querySelectorAll('button')){row.hidden=!!text&&!row.dataset.search.includes(text);any=any||!row.hidden;}box.hidden=!any;}};
$('deselect-object').onclick=()=>selectFurniture(null);
$('bar-rotate-left').onclick=()=>rotateSelected(-15);$('bar-rotate-right').onclick=()=>rotateSelected(15);$('bar-close').onclick=()=>selectFurniture(null);$('bar-reset').onclick=()=>$('reset-object').click();
$('bar-edit').onclick=()=>showPanel('layout',true);
function moveSelected(dx,dz){if(!selectedFurniture)return;rememberLayout();selectedFurniture.position.x=THREE.MathUtils.clamp(selectedFurniture.position.x+dx,-2,16);selectedFurniture.position.z=THREE.MathUtils.clamp(selectedFurniture.position.z+dz,-2,11);syncObjectFields();saveLayout();}
function rotateSelected(degrees){if(!selectedFurniture)return;rememberLayout();selectedFurniture.rotation.y=THREE.MathUtils.degToRad((normalizedAngle(selectedFurniture.rotation.y)+degrees+360)%360);syncObjectFields();saveLayout();}
for(const [id,axis,min,max]of[['object-x','x',-2,16],['object-z','z',-2,11]])$(id).onchange=()=>{if(!selectedFurniture)return;const value=Number($(id).value);if($(id).value.trim()===''||!Number.isFinite(value)){syncObjectFields();return}rememberLayout();selectedFurniture.position[axis]=THREE.MathUtils.clamp(value,min,max);syncObjectFields();saveLayout();};
$('object-angle').oninput=()=>{if(!selectedFurniture)return;if(!rotationGesture){rememberLayout();rotationGesture=true;}selectedFurniture.rotation.y=THREE.MathUtils.degToRad(Number($('object-angle').value));syncObjectFields();saveLayout();};$('object-angle').onchange=()=>rotationGesture=false;
$('rotate-left').onclick=()=>rotateSelected(-15);$('rotate-right').onclick=()=>rotateSelected(15);$('flip-object').onclick=()=>rotateSelected(180);
document.querySelectorAll('[data-nudge]').forEach(button=>button.onclick=()=>{const [dx,dz]=button.dataset.nudge.split(',').map(Number);moveSelected(dx*.1,dz*.1);});
$('reset-object').onclick=()=>{if(!selectedFurniture)return;rememberLayout();const {x,z,angle}=selectedFurniture.userData.furniture.original;selectedFurniture.position.set(x,0,z);selectedFurniture.rotation.y=angle;syncObjectFields();saveLayout();};
$('reset-layout').onclick=()=>{rememberLayout();for(const object of movableObjects){const {x,z,angle}=object.userData.furniture.original;object.position.set(x,0,z);object.rotation.y=angle;}syncObjectFields();saveLayout();toast('Original furniture layout restored');};
$('undo-layout').onclick=()=>{const previous=layoutHistory.pop();if(previous){restoreSnapshot(previous);syncObjectFields();saveLayout();}setUndo(layoutHistory.length>0);};$('undo-top').onclick=()=>$('undo-layout').click();

// Selection gizmo: an oriented frame around the piece, drawn over everything.
function localBounds(object){
if(object.userData.bounds)return object.userData.bounds;
const box=new THREE.Box3(),inverse=new THREE.Matrix4(),relative=new THREE.Matrix4(),corner=new THREE.Vector3();object.updateWorldMatrix(true,true);inverse.copy(object.matrixWorld).invert();
object.traverse(mesh=>{if(!mesh.isMesh)return;for(let p=mesh;p&&p!==object;p=p.parent)if(!p.visible)return;const g=mesh.geometry;if(!g.boundingBox)g.computeBoundingBox();relative.multiplyMatrices(inverse,mesh.matrixWorld);
for(const x of [g.boundingBox.min.x,g.boundingBox.max.x])for(const y of [g.boundingBox.min.y,g.boundingBox.max.y])for(const z of [g.boundingBox.min.z,g.boundingBox.max.z])box.expandByPoint(corner.set(x,y,z).applyMatrix4(relative));});
return object.userData.bounds=box;
}
function makeFrame(colour,strong){const material=opacity=>new THREE.LineBasicMaterial({color:colour,transparent:true,opacity,depthTest:false,toneMapped:false}),group=new THREE.Group();
const base=new THREE.LineLoop(new THREE.BufferGeometry(),material(strong?1:.75)),cage=new THREE.LineSegments(new THREE.BufferGeometry(),material(strong?.38:.2));
const fill=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:colour,transparent:true,opacity:strong?.14:.07,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));fill.rotation.x=-Math.PI/2;
group.add(fill,cage,base);group.renderOrder=90;group.visible=false;overlay.add(group);
group.fit=object=>{const b=localBounds(object),pad=.05,x0=b.min.x-pad,x1=b.max.x+pad,z0=b.min.z-pad,z1=b.max.z+pad,y1=Math.max(.05,b.max.y+.02),y0=.012;
base.geometry.setFromPoints([[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(([x,z])=>new THREE.Vector3(x,y0,z)));
const points=[];for(const [x,z] of [[x0,z0],[x1,z0],[x1,z1],[x0,z1]])points.push(new THREE.Vector3(x,y0,z),new THREE.Vector3(x,y1,z));const top=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];top.forEach(([x,z],i)=>{const [nx,nz]=top[(i+1)%4];points.push(new THREE.Vector3(x,y1,z),new THREE.Vector3(nx,y1,nz));});cage.geometry.setFromPoints(points);
fill.scale.set(x1-x0,z1-z0,1);fill.position.set((x0+x1)/2,y0,(z0+z1)/2);group.position.copy(object.position);group.rotation.y=object.rotation.y;group.visible=true;};
return group;}
const selectionFrame=makeFrame(0x2f7df6,true),hoverFrame=makeFrame(0x2f7df6,false);
const cutOutlineLine=new THREE.LineLoop(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xe2603f,transparent:true,opacity:.9,depthTest:false,toneMapped:false})),cutFill=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0xe2603f,transparent:true,opacity:.07,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));cutOutlineLine.visible=cutFill.visible=false;cutOutlineLine.frustumCulled=cutFill.frustumCulled=false;overlay.add(cutFill,cutOutlineLine);
let cutEngaged=false;
// Screen position of a world point, in viewport pixels; null when behind the camera.
const projected=new THREE.Vector3();
function toScreen(point){const rect=wrap.getBoundingClientRect();projected.copy(point).project(camera);if(projected.z>1||projected.z<-1)return null;return {x:(projected.x*.5+.5)*rect.width,y:(-projected.y*.5+.5)*rect.height,width:rect.width,height:rect.height};}
function placeBar(bar,anchor,lift){if(bar.hidden)return;const compact=matchMedia('(max-width:850px)').matches,screen=!compact&&anchor&&toScreen(anchor);bar.classList.toggle('docked',!screen);if(!screen){bar.style.left=bar.style.top='';return;}
const width=bar.offsetWidth,height=bar.offsetHeight;let x=screen.x-width/2,y=screen.y-lift-height;if(y<64)y=Math.min(screen.height-height-70,screen.y+28);bar.style.left=Math.max(12,Math.min(screen.width-width-150,x))+'px';bar.style.top=Math.max(64,Math.min(screen.height-height-16,y))+'px';}
function updateHandles(){
const object=selectedFurniture&&furn.visible&&effectivelyVisible(selectedFurniture)?selectedFurniture:null,handle=$('rotate-handle');
if(object){selectionFrame.fit(object);const b=localBounds(object),reach=b.max.z+.34,spot=toScreen(new THREE.Vector3(object.position.x+Math.sin(object.rotation.y)*reach,.02,object.position.z+Math.cos(object.rotation.y)*reach));handle.hidden=!spot||!!walkthrough?.active||(furnitureDrag&&!furnitureDrag.turning);if(spot){handle.style.left=spot.x+'px';handle.style.top=spot.y+'px';}
placeBar($('selection-bar'),new THREE.Vector3(object.position.x,b.max.y,object.position.z),26);}
else{selectionFrame.visible=false;handle.hidden=true;}
$('selection-bar').classList.toggle('dragging',!!furnitureDrag);
if(hoveredFurniture&&hoveredFurniture!==selectedFurniture&&furn.visible)hoverFrame.fit(hoveredFurniture);else hoverFrame.visible=false;
placeBar($('surface-bar'),surfaceAnchor,34);
const grip=$('cut-handle');cutOutlineLine.visible=section.active;cutFill.visible=section.active&&cutEngaged;
if(section.active){const centre=section.centre(),spot=toScreen(centre);grip.hidden=!spot;if(spot){grip.style.left=Math.max(30,Math.min(spot.width-30,spot.x))+'px';grip.style.top=Math.max(84,Math.min(spot.height-110,spot.y))+'px';}}else grip.hidden=true;
}

// ---------- Pointer: a still click selects, dragging the selected piece moves it,
// pressing and holding any piece grabs it, and everything else orbits the camera.
const editorCanvas=renderer.domElement,HOLD_TO_GRAB=360;let press=null,lastTap=null,hoverStamp=0;
function beginFurnitureDrag(event,hit,late=false){
transition=null;spin=null;controls.enabled=false;selectFurniture(hit.object);
furnitureDrag={pointerId:event.pointerId,object:hit.object,startX:event.clientX,startY:event.clientY,plane:new THREE.Plane(new THREE.Vector3(0,1,0),-hit.point.y),point:hit.point.clone(),origin:hit.object.position.clone(),before:layoutSnapshot(),moved:late,late,turning:false};
if(!late)editorCanvas.setPointerCapture(event.pointerId);editorCanvas.style.cursor='grabbing';invalidate(false);
}
function tapSelect(event,additive){
const hit=additive?null:pickFurniture(event);if(hit){selectFurniture(hit.object);return;}
const surface=surfaceAt(event);
if(surface){selectFurniture(null);surfaceAnchor=surface.point;if(surfaceMeta[surface.key])selectSurface(surface.key,additive);else focusSurface(surface.key);showPanel('materials',false);return;}
if(!additive){selectFurniture(null);clearSurfaceSelection();surfaceUI();}
}
editorCanvas.addEventListener('pointerdown',event=>{
if(walkthrough?.active||event.button!==0||!event.isPrimary||furnitureDrag){press=null;return;}
press={id:event.pointerId,x:event.clientX,y:event.clientY,time:performance.now(),stamp:event.timeStamp,moved:0,shift:event.shiftKey,timer:0};
if(event.shiftKey)return;
const hit=pickFurniture(event);
if(hit&&hit.object===selectedFurniture){event.preventDefault();event.stopImmediatePropagation();beginFurnitureDrag(event,hit);return;}
// Holding still on a piece arms a grab; the drag itself starts with the next movement.
if(hit)press.timer=setTimeout(()=>{if(press&&press.moved<8&&!furnitureDrag){press.armed=hit;press.restore=selectedFurniture;navigator.vibrate?.(12);selectFurniture(hit.object);}},HOLD_TO_GRAB);
},true);
editorCanvas.addEventListener('pointermove',event=>{
if(furnitureDrag&&event.pointerId===furnitureDrag.pointerId&&!furnitureDrag.turning){
const drag=furnitureDrag;if(!drag.late){event.preventDefault();event.stopImmediatePropagation();}if(!drag.moved&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<4)return;
rayFromPointer(event);const point=pickRay.ray.intersectPlane(drag.plane,new THREE.Vector3());if(!point)return;
let x=drag.origin.x+point.x-drag.point.x,z=drag.origin.z+point.z-drag.point.z;if($('object-snap').checked){x=Math.round(x/.05)*.05;z=Math.round(z/.05)*.05;}
drag.object.position.set(THREE.MathUtils.clamp(x,-2,16),0,THREE.MathUtils.clamp(z,-2,11));drag.moved=true;drag.travelled=true;syncObjectFields();invalidate();return;}
if(press&&event.pointerId===press.id){press.moved=Math.max(press.moved,Math.hypot(event.clientX-press.x,event.clientY-press.y));if(press.moved>8)clearTimeout(press.timer);
if(press.armed&&press.moved>3){
// Input that was really a quick drag (the page was busy and the timer won the race) stays an orbit.
if(event.timeStamp-press.stamp<HOLD_TO_GRAB-40){selectFurniture(press.restore);press.armed=null;}
else{beginFurnitureDrag({pointerId:press.id,clientX:press.x,clientY:press.y},press.armed,true);press.armed=null;press.grabbed=true;}}}
else if(!event.buttons&&event.pointerType==='mouse'&&!walkthrough?.active){const now=performance.now();if(now-hoverStamp<60)return;hoverStamp=now;const object=pickFurniture(event)?.object||null;editorCanvas.style.cursor=object?(object===selectedFurniture?'grab':'pointer'):'';if(object!==hoveredFurniture){hoveredFurniture=object;invalidate(false);}}
},true);
function finishFurnitureDrag(event,cancel=false){if(!furnitureDrag||event.pointerId!==furnitureDrag.pointerId||furnitureDrag.turning)return false;const drag=furnitureDrag;if(!drag.late)event.stopImmediatePropagation();furnitureDrag=null;if(cancel)restoreSnapshot(drag.before);else if(drag.travelled){rememberLayout(drag.before);saveLayout();}controls.enabled=true;editorCanvas.style.cursor='';if(!drag.late&&editorCanvas.hasPointerCapture(event.pointerId))editorCanvas.releasePointerCapture(event.pointerId);syncObjectFields();invalidate();return true;}
editorCanvas.addEventListener('pointerup',event=>{
const dragged=finishFurnitureDrag(event),start=press;press=null;clearTimeout(start?.timer);
if(!start||event.pointerId!==start.id||start.grabbed||start.armed||walkthrough?.active||start.moved>6||Math.hypot(event.clientX-start.x,event.clientY-start.y)>6||performance.now()-start.time>450)return;
const now=performance.now();
if(lastTap&&now-lastTap.t<380&&Math.hypot(event.clientX-lastTap.x,event.clientY-lastTap.y)<30){lastTap=null;focusAt(event);return;}lastTap={t:now,x:event.clientX,y:event.clientY};
if(!dragged||event.type==='pointerup')tapSelect(event,start.shift);
},true);
for(const type of ['pointercancel','lostpointercapture'])editorCanvas.addEventListener(type,event=>{clearTimeout(press?.timer);if(furnitureDrag&&!furnitureDrag.late)finishFurnitureDrag(event,type==='pointercancel');},true);
editorCanvas.addEventListener('pointerleave',()=>{if(hoveredFurniture){hoveredFurniture=null;invalidate(false);}});
// Turning handle: the piece faces wherever the handle is dragged around it.
const rotateHandle=$('rotate-handle');
rotateHandle.addEventListener('pointerdown',event=>{if(!selectedFurniture||event.button!==0)return;event.preventDefault();rotateHandle.setPointerCapture(event.pointerId);furnitureDrag={pointerId:event.pointerId,object:selectedFurniture,before:layoutSnapshot(),turning:true,travelled:false};rotateHandle.classList.add('active');});
rotateHandle.addEventListener('pointermove',event=>{const drag=furnitureDrag;if(!drag?.turning||event.pointerId!==drag.pointerId)return;rayFromPointer(event);const point=pickRay.ray.intersectPlane(floorPlane,new THREE.Vector3());if(!point)return;const dx=point.x-drag.object.position.x,dz=point.z-drag.object.position.z;if(Math.hypot(dx,dz)<.08)return;let angle=Math.atan2(dx,dz);if(!event.shiftKey){const step=THREE.MathUtils.degToRad($('object-snap').checked?5:1);angle=Math.round(angle/step)*step;}drag.object.rotation.y=angle;drag.travelled=true;syncObjectFields();invalidate();});
for(const type of ['pointerup','pointercancel'])rotateHandle.addEventListener(type,event=>{const drag=furnitureDrag;if(!drag?.turning||event.pointerId!==drag.pointerId)return;furnitureDrag=null;rotateHandle.classList.remove('active');if(type==='pointercancel')restoreSnapshot(drag.before);else if(drag.travelled){rememberLayout(drag.before);saveLayout();}syncObjectFields();invalidate();});
window.addEventListener('keydown',event=>{if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)||!selectedFurniture||furnitureDrag)return;if(walkthrough?.active){if(event.key==='Escape'){event.preventDefault();selectFurniture(null);}return;}const step=event.shiftKey?.01:.1;if(event.key==='Escape'){selectFurniture(null);return}const moves={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};if(moves[event.key]){event.preventDefault();moveSelected(...moves[event.key]);}else if(event.key.toLowerCase()==='r'){event.preventDefault();rotateSelected(event.shiftKey?-15:15);}else if((event.metaKey||event.ctrlKey)&&event.key==='z'){event.preventDefault();$('undo-layout').click();}});
window.addEventListener('keydown',e=>{if(e.key!=='Escape'||e.defaultPrevented)return;if(closeMenus())return;if((selectedSurfaces.size||focusedSurface)&&!selectedFurniture){e.preventDefault();clearSurfaceSelection();surfaceUI();}});

// ---------- Section cut: created facing the camera, then it only slides along that direction.
function refreshCut(){
pipeline.setClipping(section.active);
$('cut-bar').hidden=!section.active;$('cut-toggle').setAttribute('aria-pressed',String(section.active));$('cut-upright').setAttribute('aria-pressed',String(section.upright));
if(section.active){const outline=section.outline(),fan=[];for(let i=1;i<outline.length-1;i++)fan.push(outline[0],outline[i],outline[i+1]);
// The outline has three to six corners, so its buffers are rebuilt rather than refilled.
cutOutlineLine.geometry.dispose();cutOutlineLine.geometry=new THREE.BufferGeometry().setFromPoints(outline);cutFill.geometry.dispose();cutFill.geometry=new THREE.BufferGeometry().setFromPoints(fan);
$('cut-slider').max=section.length.toFixed(2);$('cut-slider').value=section.depth.toFixed(2);$('cut-readout').value=section.horizontal?'at '+Math.abs(section.offset).toFixed(2)+' m high':section.depth.toFixed(2)+' m in';}
updateHint();invalidate();
}
function createCut(){const direction=camera.getWorldDirection(new THREE.Vector3()),focus=walkthrough?.active?camera.position.clone().addScaledVector(direction,2):controls.target.clone();section.create(direction,focus,section.upright);refreshCut();toast(section.horizontal?'Plan cut added · slide it up or down':'Cut added facing your view · slide it forward or backward');}
$('cut-toggle').onclick=()=>{if(section.active){section.remove();refreshCut();toast('Cut removed');}else createCut();};
$('cut-remove').onclick=()=>{section.remove();refreshCut();toast('Cut removed');};$('cut-reaim').onclick=createCut;$('cut-flip').onclick=()=>{section.flip();refreshCut();};
$('cut-upright').onclick=()=>{section.setUpright(!section.upright);refreshCut();toast(section.upright?'Cut stands upright':'Cut matches the exact camera tilt');};
$('cut-slider').oninput=()=>{section.setOffset(section.range.min+Number($('cut-slider').value));refreshCut();};
function nudgeCut(metres){if(!section.active)return;section.move(metres);refreshCut();}
// Holding a step button keeps the cut moving.
for(const [id,step] of [['cut-back',-.1],['cut-forward',.1]]){const button=$(id);let repeat=0;const stop=()=>clearInterval(repeat);button.addEventListener('pointerdown',()=>{nudgeCut(step);stop();repeat=setInterval(()=>nudgeCut(step/2),70);});for(const type of ['pointerup','pointerleave','pointercancel'])button.addEventListener(type,stop);button.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();nudgeCut(step);}});}
for(const element of [$('cut-bar'),$('cut-handle')]){element.addEventListener('wheel',event=>{event.preventDefault();nudgeCut(-event.deltaY*.002);},{passive:false});element.addEventListener('pointerenter',()=>{cutEngaged=true;invalidate(false);});element.addEventListener('pointerleave',()=>{if(!cutDrag){cutEngaged=false;invalidate(false);}});}
let cutDrag=null;const cutHandle=$('cut-handle');
cutHandle.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();cutHandle.setPointerCapture(event.pointerId);cutDrag={id:event.pointerId,x:event.clientX,y:event.clientY};cutEngaged=true;cutHandle.classList.add('active');});
cutHandle.addEventListener('pointermove',event=>{if(!cutDrag||event.pointerId!==cutDrag.id)return;const centre=section.centre(),a=toScreen(centre),b=a&&toScreen(centre.clone().add(section.normal)),c=a&&toScreen(centre.clone().add(camera.up.clone().applyQuaternion(camera.quaternion)));if(!a||!b)return;
const scale=c?Math.hypot(c.x-a.x,c.y-a.y):60;section.move(dragToTravel(event.clientX-cutDrag.x,event.clientY-cutDrag.y,{x:b.x-a.x,y:b.y-a.y},scale));cutDrag.x=event.clientX;cutDrag.y=event.clientY;refreshCut();});
for(const type of ['pointerup','pointercancel'])cutHandle.addEventListener(type,event=>{if(cutDrag?.id!==event.pointerId)return;cutDrag=null;cutEngaged=false;cutHandle.classList.remove('active');invalidate(false);});
window.addEventListener('keydown',e=>{if(!section.active||/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;if(e.key==='['||e.key===']'){e.preventDefault();nudgeCut((e.key===']'?1:-1)*(e.shiftKey?.01:.1));}});

// ---------- Complete local recovery and portable design export/import.
let designReady=false,applyingDesign=false,designSaveTimer=null,designEpoch=0,previousImportedDesign=null;
const designSpec={surfaces:Object.keys(defaults),surfaceDefaults:Object.fromEntries(Object.keys(surfaceMeta).map(key=>[key,defaults[key]])),surfaceParents,finishes:catalog.map(f=>f.id),furnitureIds:movableObjects.map(o=>o.userData.furniture.id),furnitureDefaults:Object.fromEntries(movableObjects.map(o=>[o.userData.furniture.id,{...o.userData.furniture.original}]))};
const designStorage=new Promise((resolve,reject)=>{try{const request=indexedDB.open('ivry-designs',1);request.onupgradeneeded=()=>request.result.createObjectStore('designs');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Close older editor tabs and try saving again.'));}catch(error){reject(error)}});
designStorage.catch(()=>{});
async function designStore(mode,key,value){const db=await designStorage;return new Promise((resolve,reject)=>{const tx=db.transaction('designs',mode),store=tx.objectStore('designs');let result;const req=mode==='readwrite'?store.put(value,key):store.get(key);req.onsuccess=()=>result=req.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Save was interrupted'));});}
function captureDesign(){const textures={},sources=new Map();for(const [key,texture]of Object.entries(customTextures)){if(!texture.userData.exportData)texture.userData.exportData=texture.image.toDataURL('image/webp',.86);const data=texture.userData.exportData;textures[key]=sources.has(data)?'@'+sources.get(data):data;if(!sources.has(data))sources.set(data,key);}return validateDesign({format:DESIGN_FORMAT,version:1,units:'metres',materials:structuredClone(state),recentColours:[...recentColours],furnitureColours:structuredClone(furnitureColours),textures,furniture:layoutSnapshot(),ceilings:{box:boxH,main:mainH},...(person.userData.pose==='stand'?{}:{figure:{pose:person.userData.pose}})},designSpec);}
function queueDesignSave(){if(applyingDesign)return;designEpoch++;if(!designReady)return;window.ivrySharing?.changed();clearTimeout(designSaveTimer);$('design-status').textContent='Saving a recovery copy on this device…';designSaveTimer=setTimeout(()=>saveCompleteDesign(false),650);}
async function saveCompleteDesign(notify=true){clearTimeout(designSaveTimer);try{await designStore('readwrite','current',{design:captureDesign(),savedAt:new Date().toISOString(),sharedBase:window.ivrySharing?.base()||null});$('design-status').textContent='Saved on this device at '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'. Export a file for a portable backup.';if(notify)toast('Complete design saved on this device');return true;}catch(error){$('design-status').textContent='Local save failed: '+error.message+'. Export a design file to keep your changes.';if(notify)toast('Could not save locally. Please export the design.');return false;}}
function decodeDesignTexture(data){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{if(image.width>4096||image.height>4096){reject(new Error('An imported texture is larger than 4096 pixels.'));return}const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;texture.userData.exportData=data;resolve(texture)};image.onerror=()=>reject(new Error('An imported texture could not be decoded.'));image.src=data;});}
async function applyCompleteDesign(input,{markChanged=true}={}){
const design=validateDesign(input,designSpec),startEpoch=designEpoch,decoded=new Map();const entries=await Promise.all(Object.keys(design.textures).map(async key=>{const data=resolveDesignTexture(design.textures,key);if(!decoded.has(data))decoded.set(data,decodeDesignTexture(data));const source=await decoded.get(data);return[key,source.clone()];}));for(const promise of decoded.values())(await promise).dispose();
if(designEpoch!==startEpoch){entries.forEach(([,texture])=>texture.dispose());throw new Error('The design changed while loading. Try again.');}
applyingDesign=true;
try{furnitureColours=structuredClone(design.furnitureColours||{});for(const [id,parts] of furnitureParts)applyFurnitureColours(parts,furnitureColours[id]);state=structuredClone(design.materials);recentColours=design.recentColours||recentColours;for(const m of Object.values(state))if(m.tint!=='#ffffff'&&!recentColours.includes(m.tint))recentColours=[...recentColours,m.tint].slice(0,12);renderRecentColours();for(const key of Object.keys(customTextures))delete customTextures[key];for(const [key,texture]of entries){texture.needsUpdate=true;customTextures[key]=texture;}Object.keys(state).forEach(applyMaterial);restoreSnapshot(design.furniture);setPose(design.figure?.pose||'stand',false);$('box-height').value=design.ceilings.box;$('main-height').value=design.ceilings.main;heights();surfaceUI();syncObjectFields();furnitureColourUI();layoutHistory.length=0;setUndo(false);try{localStorage.setItem('ivry-recent-colours-v1',JSON.stringify(recentColours));localStorage.setItem('ivry-finishes-v1',JSON.stringify(state));localStorage.setItem('ivry-layout-v1',JSON.stringify(layoutSnapshot()));}catch{}}
finally{applyingDesign=false;}
invalidate();if(markChanged)queueDesignSave();
}
function downloadDesign(){try{const file={...captureDesign(),exportedAt:new Date().toISOString()};const blob=new Blob([JSON.stringify(file,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ivry-design-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('design-status').textContent='Design file exported with furniture, finishes, textures and ceiling heights.';}catch(error){$('design-status').textContent='Export failed: '+error.message;}}
$('save-share').onclick=()=>$('save-dialog').showModal();$('close-save').onclick=()=>$('save-dialog').close();$('save-local').onclick=()=>saveCompleteDesign();$('export-design').onclick=downloadDesign;$('import-design').onclick=()=>$('design-file').click();
const undoImport=document.createElement('button');undoImport.className='wide';undoImport.textContent='Undo design import';undoImport.hidden=true;$('design-status').before(undoImport);undoImport.onclick=async()=>{if(!previousImportedDesign)return;try{await applyCompleteDesign(previousImportedDesign);previousImportedDesign=null;undoImport.hidden=true;await saveCompleteDesign(false);toast('Previous design restored');}catch(error){$('design-status').textContent=error.message;}};
$('design-file').onchange=async()=>{const file=$('design-file').files[0];if(!file)return;try{if(file.size>MAX_DESIGN_BYTES)throw new Error('Choose a design file smaller than 8 MB.');const design=validateDesign(JSON.parse(await file.text()),designSpec),before=captureDesign();await applyCompleteDesign(design);previousImportedDesign=before;undoImport.hidden=false;await saveCompleteDesign(false);$('design-status').textContent='Design imported. Use Save shared design to publish it to everyone.';toast('Complete design imported');}catch(error){$('design-status').textContent='Import failed: '+error.message;}finally{$('design-file').value='';}};
window.addEventListener('beforeunload',()=>{if(designReady&&!applyingDesign)saveCompleteDesign(false);});
window.ivryDesign={capture:captureDesign,apply:applyCompleteDesign,saveLocal:saveCompleteDesign,validate:input=>validateDesign(input,designSpec),fingerprint:designFingerprint,get epoch(){return designEpoch},get busy(){return !!furnitureDrag||applyingDesign}};
const recoveryEpoch=designEpoch;
const designRecovery=designStore('readonly','current').then(async saved=>{if(saved?.design&&designEpoch===recoveryEpoch&&!furnitureDrag){await applyCompleteDesign(saved.design,{markChanged:false});$('design-status').textContent='Complete design recovered from this device.';return{hasDraft:true,base:saved.sharedBase||null};}return{hasDraft:false,base:null};}).catch(error=>{$('design-status').textContent='Local recovery unavailable: '+error.message+'. Export files can still be used.';return{hasDraft:false,base:null};}).finally(()=>{designReady=true;});
window.ivryDesign.ready=designRecovery;window.dispatchEvent(new Event('ivry-design-ready'));

// ---------- Walkthrough is a local viewing mode; it never changes the shared design.
walkthrough=createWalkthrough({camera:perspective,canvas:renderer.domElement,viewport:$('viewport'),architecture,furniture:furn,notify:toast,
onSceneClick:(event,additive)=>tapSelect(event,additive),
points:buildWalkPoints([
{id:'living',label:'Living room',x:10.8,z:6.45},{id:'dining',label:'Dining area',x:11.25,z:6.6},
{id:'kitchen',label:'Kitchen aisle',x:11.55,z:2.9},{id:'worktop',label:'Kitchen worktop',x:12,z:1.18},
{id:'entry',label:'Entry',x:9.8,z:2.6},{id:'front-door',label:'Entrance hall',x:8.05,z:2.8},
{id:'bathroom',label:'Bathroom',x:9.65,z:1.4},{id:'wc',label:'WC',x:8.0,z:1.45},
{id:'hall-east',label:'Hall · living end',x:8.0,z:4.25},{id:'hall-west',label:'Hall · bedrooms',x:5.0,z:4.35},
{id:'bedroom-1',label:'Bedroom 1',x:2.5,z:5.95},{id:'bedroom-2',label:'Bedroom 2',x:4.0,z:6.3},
{id:'office',label:'Office',x:7.0,z:6.2},{id:'shower',label:'Shower room',x:3.6,z:4.35}],[
{id:'living-kitchen',destination:'kitchen',path:[[10.8,6.45],[11.25,6.6],[11.25,5.7],[11.55,4.25],[11.55,2.9]]},
{id:'dining',destination:'dining',path:[[11.25,6.6],[11.25,8.1],[12.6,8.1]]},
{id:'worktop',destination:'worktop',path:[[11.55,2.9],[11.55,1.18],[12,1.18],[13.4,1.18]]},
{id:'hall',destination:'hall-east',path:[[11.55,4.25],[8.05,4.25],[5,4.35]]},
{id:'entrance',destination:'front-door',path:[[8.05,4.25],[8.05,2.8],[8.05,2.1]]},
{id:'wc-path',destination:'wc',path:[[8.05,2.1],[8,1.45]]},
{id:'entry-path',destination:'entry',path:[[8.05,2.8],[9.25,2.8],[9.8,2.6]]},
{id:'bath-path',destination:'bathroom',path:[[9.8,2.6],[9.65,2.1],[9.65,1.4]]},
{id:'shower',destination:'shower',path:[[5,4.35],[3.6,4.35],[1.3,4.35]]},
{id:'bedroom-1',destination:'bedroom-1',path:[[2.5,4.35],[2.5,5.95],[2.5,7.9]]},
{id:'bedroom-2',destination:'bedroom-2',path:[[5,4.35],[5.1,4.9],[5.1,5.8],[4,5.8],[4,7.5]]},
{id:'office',destination:'office',path:[[6.2,4.31],[6.2,5.8],[7,6.2],[7.2,7.3]]}
]),
onEnter:()=>{walkReturnView=presets[activeView]?activeView:'overview';transition=null;spin=null;camera=perspective;controls.object=camera;controls.enabled=false;activeView='walkthrough';hoveredFurniture=null;$('viewport').classList.add('interior');$('walk-start').setAttribute('aria-pressed','true');markView('walkthrough');updateHint();invalidate(false);},
onExit:restore=>{controls.target.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(3));controls.enabled=true;$('walk-start').setAttribute('aria-pressed','false');updateHint();if(restore)setView(walkReturnView);invalidate(false);}
});
$('walk-start').onclick=()=>walkthrough.active?walkthrough.exit():walkthrough.start();

// ---------- Camera joystick: a ball to steer the view, with a compass on it.
joystick=createViewJoystick({mount:$('joystick-mount'),
onStart:()=>{transition=null;spin=null;},
onStick:(x,y,dt)=>{if(walkthrough?.active){walkthrough.turn(-x*1.5*dt,y*1.1*dt);}else{const next=orbitOffset(camera.position.clone().sub(controls.target),-x*1.55*dt,-y*1.1*dt,.02,controls.maxPolarAngle);camera.position.copy(controls.target).add(next);camera.lookAt(controls.target);}invalidate(false);},
onSnap:name=>{const direction=compassDirections(FACADES[view.facade])[name];
if(walkthrough?.active){if(name!=='top')walkthrough.look(Math.atan2(direction[0],-direction[2]),0);return;}
const current=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));let theta=current.theta,phi=current.phi;
if(name==='top')phi=.02;else{theta=Math.atan2(direction[0],direction[2]);if(phi<.5)phi=1.05;}
const turn=Math.atan2(Math.sin(theta-current.theta),Math.cos(theta-current.theta));transition=null;spin={radius:current.radius,theta0:current.theta,theta1:current.theta+turn,phi0:current.phi,phi1:phi,start:performance.now()};invalidate(false);}
});

// ---------- Introduction: the neighbourhood, the building, then only the apartment.
let building=null,intro=null;
const introPose=seconds=>{const overview=presetPose('overview');return introCamera(seconds,{position:overview.p,target:overview.t},viewFit());};
function startIntro(){
if(intro)return;if(walkthrough?.active)walkthrough.exit(false);if(section.active){section.remove();refreshCut();}selectFurniture(null);clearSurfaceSelection();closeMenus();setView('overview',true);
if(!building){building=createBuildingIntro({south:facadeWindows.map(w=>({at:w.at,width:w.width,sill:w.sill,height:w.height})),east:{at:Z(1049)+.215-kitchenWindow.at-kitchenWindow.width,width:kitchenWindow.width,sill:kitchenWindow.sill,height:kitchenWindow.height}});scene.add(building.group);}
building.group.visible=true;controls.enabled=false;transition=null;spin=null;perspective.near=1;perspective.far=1600;perspective.updateProjectionMatrix();pipeline.ground.visible=false;
document.body.classList.add('intro-playing');$('intro').hidden=false;intro={start:performance.now(),stage:introStage(0)};stepIntro(intro.start);
}
function stepIntro(now){
const seconds=intro.hold??(now-intro.start)/1000,stage=intro.stage=introStage(seconds),pose=introPose(seconds);
camera.position.fromArray(pose.position);controls.target.fromArray(pose.target);camera.lookAt(controls.target);
building.apply(stage,seconds,daylight.lamps);const lift=building.ceilingLift(stage);for(const g of [roof,joists,lamps])g.position.y=lift;
// Haze softens the far streets; the shadow map tightens as the town folds away.
scene.fog.density=.0021/viewFit()*(1-stage.approach*.75)*(1-stage.sink);pipeline.setScope(12.5+105*(1-stage.clear));pipeline.ground.visible=stage.clear>.92;
$('intro-caption').textContent=introCaption(seconds);
// Shadows stand still while only the camera travels; they follow once the building opens.
if(stage.split>0||!intro.shadowed){shadowsDirty=true;intro.shadowed=true;}
if(stage.done)endIntro();
}
function endIntro(){
if(!intro)return;intro=null;building.apply(introStage(INTRO_SECONDS));building.group.visible=false;for(const g of [roof,joists,lamps])g.position.y=0;
scene.fog.density=0;pipeline.setScope(12.5);pipeline.ground.visible=true;perspective.near=.04;perspective.far=180;perspective.updateProjectionMatrix();
controls.enabled=true;document.body.classList.remove('intro-playing');$('intro').hidden=true;setView('overview',true);try{sessionStorage.setItem('ivry-intro','seen');}catch{}invalidate();
}
$('intro-skip').onclick=endIntro;$('intro-replay').onclick=()=>{closeMenus();startIntro();};
window.addEventListener('keydown',e=>{if(intro&&e.key==='Escape'){e.preventDefault();endIntro();}});

// ---------- Shell: menus, segmented choices, side panel and contextual tips.
function closeMenus(){let closed=false;document.querySelectorAll('.menu').forEach(menu=>{if(!menu.hidden){menu.hidden=true;closed=true;}});document.querySelectorAll('[data-menu]').forEach(b=>b.setAttribute('aria-expanded','false'));return closed;}
document.querySelectorAll('[data-menu]').forEach(button=>{const menu=$(button.dataset.menu);button.onclick=()=>{const open=menu.hidden;closeMenus();if(open){menu.hidden=false;button.setAttribute('aria-expanded','true');}};});
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.menu-anchor'))closeMenus();},true);
document.querySelectorAll('select[data-segmented]').forEach(select=>{const group=document.createElement('div');group.className='segmented';group.setAttribute('role','radiogroup');group.setAttribute('aria-label',document.querySelector(`label[for="${select.id}"]`)?.textContent||select.id);
for(const option of select.options){const b=document.createElement('button');b.type='button';b.textContent=option.textContent;b.dataset.value=option.value;b.setAttribute('role','radio');b.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));};group.append(b);}
select.hidden=true;select.after(group);select.syncSegmented=()=>{for(const b of group.children)b.setAttribute('aria-checked',String(b.dataset.value===select.value));};select.addEventListener('change',select.syncSegmented);select.syncSegmented();});
const inspector=$('inspector'),compactLayout=matchMedia('(max-width:850px)');
function showPanel(name,open=true){document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===name);b.setAttribute('aria-selected',String(b.dataset.tab===name));});document.querySelectorAll('.tab-panel').forEach(p=>p.hidden=p.id!==name);if(open){inspector.classList.add('open');document.body.classList.remove('panel-hidden');$('panel-toggle').setAttribute('aria-pressed','true');}}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{const same=b.classList.contains('active');if(compactLayout.matches&&same&&inspector.classList.contains('open')){inspector.classList.remove('open');return;}showPanel(b.dataset.tab,true);});
$('sheet-handle').onclick=()=>inspector.classList.toggle('open');
$('panel-toggle').onclick=()=>{const hidden=document.body.classList.toggle('panel-hidden');$('panel-toggle').setAttribute('aria-pressed',String(!hidden));};
let hintsOff=false;try{hintsOff=localStorage.getItem('ivry-hints-off')==='1';}catch{}
function updateHint(){const text=walkthrough?.active?'Drag to look around · Click a floor dot to move · The ball turns your head':selectedFurniture?(touchFirst?'Drag the piece to move it · Drag the round handle to turn it':'Drag the piece to move it · Round handle turns it · Arrow keys nudge · Esc deselects'):selectedSurfaces.size?'Pick a colour for the selection · Shift-click adds more surfaces':focusedSurface?'Pick a finish in the panel, or a quick colour beside your click':section.active?'Drag the orange handle or the slider to move the cut · [ and ] step 10 cm':touchFirst?'Drag to orbit · Pinch to zoom · Tap anything to select it · Hold a piece to grab it':'Drag to orbit · Scroll to zoom · Right-drag to pan · Click anything to select it';$('hint').textContent=text;$('hint-chip').hidden=hintsOff;}
$('hint-close').onclick=()=>{hintsOff=true;try{localStorage.setItem('ivry-hints-off','1');}catch{}updateHint();};

surfaceUI();renderRecentColours();choose('wall-mode',$('wall-mode').value);setPose('stand',false);setQuality(view.quality);applyDaylight();refreshCut();updateHint();showPanel('materials',false);
// The introduction plays once per browser tab; ?intro=1 forces it and ?intro=0 skips it.
let introSeen=false;try{introSeen=sessionStorage.getItem('ivry-intro')==='seen';}catch{}
if(query.get('intro')==='1'||(query.get('intro')!=='0'&&!introSeen&&!matchMedia('(prefers-reduced-motion: reduce)').matches))startIntro();
requestAnimationFrame(frame);$('loading').hidden=true;
