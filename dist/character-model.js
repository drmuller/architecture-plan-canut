import * as THREE from './vendor/three.module.js';
import {softBoxGeometry} from './furniture-models.js?v=e68a6e50cd69';

// A young woman with long brown hair, 1.65 m tall, as a scale figure. Dimensions are
// metres; she faces +z and stands on y = 0. Everything is built from lofted rings so the
// body stays smooth, closed (it can be section-cut) and light enough for phones.
export const CHARACTER_HEIGHT=1.655;
export const CHARACTER_POSES=['stand','sit'];
const HIP=.845,HEAD_CENTRE=new THREE.Vector3(0,1.585,-.004);

// Closed skin through rings of points. Rings are ordered along the body part; the seam
// is doubled for clean texture wrapping and its normals are welded afterwards.
function skin(rings){
const count=rings[0].length,positions=[],uvs=[],indices=[],centre=ring=>ring.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).divideScalar(count);
let travelled=0,previous=null;const row=count+1;
rings.forEach(ring=>{const c=centre(ring);if(previous)travelled+=c.distanceTo(previous);previous=c;for(let j=0;j<=count;j++){const p=ring[j%count];positions.push(p.x,p.y,p.z);uvs.push(j/count,travelled);}});
const first=centre(rings[0]),last=centre(rings[rings.length-1]),a=positions.length/3,b=a+1;
positions.push(first.x,first.y,first.z,last.x,last.y,last.z);uvs.push(.5,0,.5,travelled);
for(let i=0;i<rings.length-1;i++)for(let j=0;j<count;j++){const A=i*row+j,B=A+1,C=A+row,D=C+1;indices.push(A,C,D,A,D,B);}
for(let j=0;j<count;j++){indices.push(a,j,j+1);const top=(rings.length-1)*row;indices.push(b,top+j+1,top+j);}
const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
const normal=geometry.attributes.normal,n=new THREE.Vector3(),m=new THREE.Vector3();
for(let i=0;i<rings.length;i++){n.fromBufferAttribute(normal,i*row).add(m.fromBufferAttribute(normal,i*row+count)).normalize();normal.setXYZ(i*row,n.x,n.y,n.z);normal.setXYZ(i*row+count,n.x,n.y,n.z);}
return geometry;
}
// Elliptical rings stacked along y: [y, halfWidth, halfDepth, zOffset=0, xOffset=0].
function loft(sections,segments=22){
return skin([...sections].sort((p,q)=>p[0]-q[0]).map(([y,rx,rz,z=0,x=0])=>Array.from({length:segments},(_,j)=>{const a=-Math.PI/2+j/segments*Math.PI*2;return new THREE.Vector3(x+Math.cos(a)*rx,y,z+Math.sin(a)*rz);})));
}
// A flat lock of hair swept along a path; it lies against the head and shoulders.
function lock(points,width,thickness,segments=18,sides=8){
const curve=new THREE.CatmullRomCurve3(points,false,'centripetal'),rings=[],side=new THREE.Vector3(1,0,0),out=new THREE.Vector3(),tangent=new THREE.Vector3();
for(let i=0;i<=segments;i++){const t=i/segments,p=curve.getPoint(t);curve.getTangent(t,tangent);
out.set(p.x-HEAD_CENTRE.x,Math.max(0,p.y-HEAD_CENTRE.y),p.z-HEAD_CENTRE.z);if(out.lengthSq()<1e-8)out.set(0,1,0);out.normalize();
const s=new THREE.Vector3().crossVectors(tangent,out);if(s.lengthSq()<1e-6)s.copy(side);s.normalize();side.copy(s);const n=new THREE.Vector3().crossVectors(s,tangent).normalize();
const tip=t<.58?1:1-Math.pow((t-.58)/.42,1.7)*.9,w=width*Math.min(1,.55+t*3)*tip/2,h=thickness*Math.min(1,.5+t*3)*(.35+.65*tip)/2;
rings.push(Array.from({length:sides},(_,k)=>{const a=k/sides*Math.PI*2;return p.clone().addScaledVector(s,Math.cos(a)*w).addScaledVector(n,Math.sin(a)*h);}));}
return skin(rings);
}
function merge(geometries){
const positions=[],normals=[],uvs=[],indices=[];let offset=0;
for(const g of geometries){positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);uvs.push(...g.attributes.uv.array);for(const i of g.index.array)indices.push(i+offset);offset+=g.attributes.position.count;g.dispose();}
const merged=new THREE.BufferGeometry();merged.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));merged.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));merged.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));merged.setIndex(indices);return merged;
}

// Head profile: [y, halfWidth, halfDepth, zOffset]. The chin leads, the crown trails.
const HEAD=[[1.437,.016,.02,.044],[1.452,.036,.044,.03],[1.476,.054,.066,.018],[1.508,.0655,.081,.012],[1.548,.0715,.0895,.008],[1.59,.0735,.0925,.004],[1.624,.066,.084,0],[1.646,.044,.058,0],[1.657,.014,.018,0]];
function faceZ(x,y){let i=1;while(i<HEAD.length-1&&HEAD[i][0]<y)i++;const a=HEAD[i-1],b=HEAD[i],t=Math.max(0,Math.min(1,(y-a[0])/(b[0]-a[0]))),rx=a[1]+(b[1]-a[1])*t,rz=a[2]+(b[2]-a[2])*t,z=a[3]+(b[3]-a[3])*t;return z+rz*Math.sqrt(Math.max(0,1-(x/rx)**2));}

function hairGeometry(){
const parts=[];
// Scalp: a tilted cap a few millimetres proud of the skull, rising to the hairline.
const cap=new THREE.SphereGeometry(1,28,16,0,Math.PI*2,0,1.78);cap.scale(.0805,.0745,.1005);cap.rotateX(-.44);cap.translate(0,1.592,-.006);parts.push(cap);
// A soft mass behind the neck stops light showing between the locks.
parts.push(loft([[1.06,.07,.016,-.126],[1.14,.108,.026,-.122],[1.3,.112,.03,-.117],[1.42,.094,.034,-.098],[1.52,.082,.04,-.078],[1.6,.06,.03,-.07]],16));
let seed=42;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const angles=[];for(let a=-94;a<=94.1;a+=13.4)angles.push(a);angles.push(-109,109,-123,123);
for(const degrees of angles){const phi=THREE.MathUtils.degToRad(degrees),sx=Math.sin(phi),cz=-Math.cos(phi),front=Math.abs(degrees)>100,shoulder=Math.abs(degrees)>58&&!front,wave=(random()-.5)*.014,length=random()*.13;
const path=[new THREE.Vector3(sx*.012,1.6655,-.006+cz*.012),new THREE.Vector3(sx*.058,1.647,-.006+cz*.07),new THREE.Vector3(sx*.0865,1.59,-.006+cz*.104),new THREE.Vector3(sx*.093,1.5,-.008+cz*.1)];
if(front)path.push(new THREE.Vector3(Math.sign(sx)*.088,1.43,.052),new THREE.Vector3(Math.sign(sx)*.098,1.34,.097),new THREE.Vector3(Math.sign(sx)*(.092+wave),1.26,.118),new THREE.Vector3(Math.sign(sx)*(.083+wave),1.17+length,.121));
else if(shoulder)path.push(new THREE.Vector3(sx*.112,1.425,-.07+cz*.02),new THREE.Vector3(sx*.132,1.35,-.094),new THREE.Vector3(sx*(.128+wave),1.24,-.108),new THREE.Vector3(sx*(.118+wave),1.1+length,-.112));
else path.push(new THREE.Vector3(sx*.1,1.42,-.112),new THREE.Vector3(sx*.112,1.33,-.124),new THREE.Vector3(sx*.118+wave,1.2,-.126),new THREE.Vector3(sx*.112+wave,1.03+length,-.124));
parts.push(lock(path,front?.046:.056,front?.017:.02));}
// Two short sweeps from the centre parting soften the hairline over the forehead.
for(const side of [-1,1])parts.push(lock([new THREE.Vector3(side*.004,1.664,.02),new THREE.Vector3(side*.03,1.652,.07),new THREE.Vector3(side*.058,1.622,.079),new THREE.Vector3(side*.077,1.575,.05),new THREE.Vector3(side*.084,1.52,.03)],.05,.014,14));
return merge(parts);
}

export function createCharacterMaterials(){
const canvas=(size,paint)=>{const c=document.createElement('canvas');c.width=c.height=size;paint(c.getContext('2d'),size);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return t;};
let seed=7;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const strands=tone=>canvas(256,(ctx,size)=>{ctx.fillStyle=tone?'#e8e8e8':'#808080';ctx.fillRect(0,0,size,size);for(let i=0;i<420;i++){const v=tone?(random()>.5?255:90):(random()>.5?255:0);ctx.fillStyle=`rgba(${v},${v},${v},${tone?.10+random()*.22:.10+random()*.3})`;ctx.fillRect(random()*size,0,.6+random()*2.2,size);}});
const hairTone=strands(true);hairTone.colorSpace=THREE.SRGBColorSpace;hairTone.repeat.set(3,1);const hairRelief=strands(false);hairRelief.repeat.set(3,1);
const knit=canvas(64,(ctx,size)=>{ctx.fillStyle='#808080';ctx.fillRect(0,0,size,size);ctx.lineWidth=2.4;ctx.lineCap='round';for(let x=0;x<size;x+=8)for(let y=-4;y<size+4;y+=6){ctx.strokeStyle='#d8d8d8';ctx.beginPath();ctx.moveTo(x+1,y);ctx.lineTo(x+4,y+4);ctx.lineTo(x+7,y);ctx.stroke();ctx.strokeStyle='#3c3c3c';ctx.beginPath();ctx.moveTo(x,y+3);ctx.lineTo(x,y+5);ctx.stroke();}});knit.repeat.set(14,110);
const denim=canvas(64,(ctx,size)=>{ctx.fillStyle='#d9d9d9';ctx.fillRect(0,0,size,size);ctx.lineWidth=1.1;for(let i=-size;i<size*2;i+=3){ctx.strokeStyle=`rgba(255,255,255,${.25+random()*.3})`;ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+size,size);ctx.stroke();ctx.strokeStyle=`rgba(60,60,60,${.10+random()*.16})`;ctx.beginPath();ctx.moveTo(i+1.5,0);ctx.lineTo(i+1.5+size,size);ctx.stroke();}});denim.colorSpace=THREE.SRGBColorSpace;denim.repeat.set(16,60);
return {
skin:new THREE.MeshStandardMaterial({color:'#e3b196',roughness:.58}),
hair:new THREE.MeshStandardMaterial({color:'#4a2c1b',map:hairTone,bumpMap:hairRelief,bumpScale:.9,roughness:.38}),
top:new THREE.MeshStandardMaterial({color:'#efe6d6',bumpMap:knit,bumpScale:.6,roughness:.96}),
bottoms:new THREE.MeshStandardMaterial({color:'#5d7896',map:denim,roughness:.86}),
shoes:new THREE.MeshStandardMaterial({color:'#f3f1ea',roughness:.55}),
sole:new THREE.MeshStandardMaterial({color:'#d8c7a4',roughness:.8}),
eye:new THREE.MeshStandardMaterial({color:'#2c1a11',roughness:.18}),
white:new THREE.MeshStandardMaterial({color:'#f6f3ee',roughness:.3}),
lips:new THREE.MeshStandardMaterial({color:'#b9676a',roughness:.45})
};
}

const POSE={
stand:{hip:HIP,lean:0,legs:[{thigh:[0,.035],shin:0},{thigh:[-.12,.035],shin:.2}],arms:[{upper:[.03,.1],fore:-.2},{upper:[-.07,.11],fore:-.34}],head:[.02,.16]},
sit:{hip:.56,lean:-.03,legs:[{thigh:[-1.27,.05],shin:1.27},{thigh:[-1.27,.05],shin:1.27}],arms:[{upper:[-.42,.1],fore:-.95},{upper:[-.42,.1],fore:-.95}],head:[.04,-.1]}
};
function figure(materials,pose){
const P=POSE[pose],root=new THREE.Group();root.name=pose;
const add=(parent,geometry,material,part)=>{const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.solid=true;if(part)mesh.userData.furniturePart=part;parent.add(mesh);return mesh;};
const ball=(parent,r,material,part,x=0,y=0,z=0,scale=[1,1,1])=>{const mesh=add(parent,new THREE.SphereGeometry(r,18,14),material,part);mesh.position.set(x,y,z);mesh.scale.set(...scale);return mesh;};
const hips=new THREE.Group();hips.position.y=P.hip;root.add(hips);
// Everything above is authored at standing height, then hung from the hips.
const body=new THREE.Group();body.position.y=-HIP;body.rotation.x=P.lean;hips.add(body);
add(body,loft([[.775,.058,.052,-.002],[.8,.148,.098,-.006],[.86,.176,.113,-.011],[.93,.164,.105,-.008],[1,.136,.093,-.002],[1.04,.124,.087]]),materials.bottoms,'bottoms');
add(body,loft([[.945,.166,.12,-.007],[.955,.171,.123,-.007],[.99,.16,.114,-.005],[1.05,.136,.101],[1.12,.137,.105,.002],[1.2,.147,.116,.009],[1.26,.151,.113,.006],[1.32,.146,.099],[1.365,.134,.087,-.002],[1.395,.09,.068,-.002],[1.418,.056,.054,.002]],26),materials.top,'top');
add(body,loft([[1.4,.043,.043,.004],[1.44,.039,.04,.008],[1.48,.04,.042,.012]],16),materials.skin,'skin');
// Head: skull, features and hair turn together.
const head=new THREE.Group();head.position.set(0,1.44,.008);head.rotation.set(P.head[0],P.head[1],0,'YXZ');body.add(head);const skull=new THREE.Group();skull.position.set(0,-1.44,-.008);head.add(skull);
add(skull,loft(HEAD,26),materials.skin,'skin');
for(const side of [-1,1]){
const x=side*.0305,y=1.549,z=faceZ(x,y);
ball(skull,.0108,materials.white,null,x,y,z-.0046,[1.22,.86,.55]);ball(skull,.0068,materials.eye,null,x,y-.0004,z-.0009,[1,1,.5]);ball(skull,.0018,materials.white,null,x+.002,y+.0026,z+.0025);
// Upper lash line and brow.
const lash=add(skull,new THREE.CapsuleGeometry(.0014,.019,4,8),materials.eye);lash.position.set(x+side*.001,y+.0092,z-.0012);lash.rotation.set(0,side*.28,Math.PI/2);
const brow=add(skull,new THREE.CapsuleGeometry(.0022,.025,4,8),materials.hair,'hair');brow.position.set(side*.0325,1.5815,faceZ(side*.0325,1.5815)+.0003);brow.rotation.set(0,side*.3,Math.PI/2+side*.05);
ball(skull,.014,materials.skin,'skin',side*.0735,1.535,-.004,[.45,1,.7]);
}
ball(skull,.009,materials.skin,'skin',0,1.514,faceZ(0,1.514)-.0005,[.75,1.15,.85]);
ball(skull,.011,materials.lips,null,0,1.4775,faceZ(0,1.4775)-.0038,[1,.32,.5]);
const smile=add(skull,new THREE.TorusGeometry(.019,.0026,6,14,Math.PI*.42),materials.lips);smile.position.set(0,1.5,faceZ(.012,1.481)+.0006);smile.rotation.z=-Math.PI/2-Math.PI*.21;smile.userData.solid=false;
add(skull,hairGeometry(),materials.hair,'hair').userData.solid=false;
for(const [index,side] of [-1,1].entries()){
const arm=P.arms[index],shoulder=new THREE.Group();shoulder.position.set(side*.156,1.34,-.006);shoulder.rotation.set(arm.upper[0],0,side*arm.upper[1]);body.add(shoulder);
add(shoulder,loft([[-.275,.036,.037],[-.14,.04,.042],[-.05,.044,.046],[0,.045,.047],[.028,.037,.039],[.044,.02,.021]],16),materials.top,'top');
const elbow=new THREE.Group();elbow.position.y=-.275;elbow.rotation.x=arm.fore;shoulder.add(elbow);
ball(elbow,.0365,materials.top,'top');add(elbow,loft([[-.245,.0275,.0285],[-.2,.029,.03],[-.08,.034,.035],[0,.036,.037]],16),materials.top,'top');
const hand=new THREE.Group();hand.position.y=-.245;hand.rotation.set(-.12,0,side*-.06);elbow.add(hand);
add(hand,loft([[-.166,.006,.012,.004],[-.15,.0085,.021,.004],[-.112,.0115,.031,.003],[-.07,.013,.037],[-.03,.0135,.035],[0,.0155,.022]],14),materials.skin,'skin');
const thumb=add(hand,new THREE.CapsuleGeometry(.0085,.04,4,8),materials.skin,'skin');thumb.position.set(side*-.004,-.062,.036);thumb.rotation.x=.5;
}
for(const [index,side] of [-1,1].entries()){
const leg=P.legs[index],hip=new THREE.Group();hip.position.set(side*.088,0,-.004);hip.rotation.set(leg.thigh[0],0,side*leg.thigh[1]);hips.add(hip);
add(hip,loft([[-.405,.052,.054],[-.2,.068,.073],[-.06,.083,.087],[.01,.084,.088]],18),materials.bottoms,'bottoms');
const knee=new THREE.Group();knee.position.y=-.405;knee.rotation.x=leg.shin;hip.add(knee);
ball(knee,.0535,materials.bottoms,'bottoms');add(knee,loft([[-.372,.0365,.0385],[-.25,.04,.043,-.003],[-.1,.05,.054,-.006],[0,.052,.054]],18),materials.bottoms,'bottoms');
add(knee,loft([[-.4,.027,.03],[-.36,.029,.032]],12),materials.skin,'skin');
// Shoes stay flat on the floor whatever the knee does.
const foot=new THREE.Group();foot.position.y=-.44;foot.quaternion.copy(hip.quaternion).multiply(knee.quaternion).invert().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),side*.14));knee.add(foot);
const upper=add(foot,softBoxGeometry(.092,.064,.25,.03),materials.shoes,'shoes');upper.position.set(0,.05,.048);
const toe=add(foot,softBoxGeometry(.09,.05,.1,.024),materials.shoes,'shoes');toe.position.set(0,.04,.128);
const sole=add(foot,softBoxGeometry(.098,.026,.262,.011),materials.sole);sole.position.set(0,.013,.05);
const collar=add(foot,new THREE.CylinderGeometry(.036,.04,.03,16),materials.shoes,'shoes');collar.position.set(0,.085,-.012);
}
return root;
}
// Both poses share materials; only one is shown at a time.
export function buildCharacter(materials,pose='stand'){
const character=new THREE.Group();character.name='Person';
for(const name of CHARACTER_POSES)character.add(figure(materials,name));
return setCharacterPose(character,pose);
}
export function setCharacterPose(character,pose){
const next=CHARACTER_POSES.includes(pose)?pose:'stand';character.userData.pose=next;for(const child of character.children)child.visible=child.name===next;return character;
}
