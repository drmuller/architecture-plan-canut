import * as THREE from './vendor/three.module.js';
import {boxProject,cloneProjected} from './surface-materials.js?v=f9cd2a6d7d2a';

// The apartment in its building: a corner block on the slopes of the Croix-Rousse,
// second floor, long façade to the south and one window round the corner to the east.
// Position is rounded to the neighbourhood; it only steers the sun.
export const SITE={latitude:45.78,longitude:4.84,facadeBearing:172,storey:4.3,level:2,levels:5,depth:23.1};
const STOREY=SITE.storey,STREET=-(SITE.level*STOREY+.254);

// ---------- Timeline (pure): fly in, point out the apartment, pull the building apart.
export const INTRO_SECONDS=10.4;
const ease=t=>t<=0?0:t>=1?1:t*t*(3-2*t),span=(t,from,to)=>ease((t-from)/(to-from));
export function introStage(seconds){const t=Math.max(0,Math.min(INTRO_SECONDS,seconds));return {
approach:span(t,0,3.4),// from the neighbourhood down to the building
glow:span(t,2.9,3.8)*(1-span(t,5,5.7)),// the apartment's windows light up
split:span(t,5,6.5),// floors separate like an exploded drawing
sink:span(t,5,8.2),// the neighbourhood folds away
clear:span(t,6.9,8.6),// everything but the apartment leaves
settle:span(t,8.6,INTRO_SECONDS),// the camera eases into the usual overview
done:seconds>=INTRO_SECONDS};}
export function introCaption(seconds){return seconds<3?'A corner building on the slopes of the Croix-Rousse':seconds<5.2?'Second floor · five tall windows on the street, one round the corner':seconds<8.6?'Lifting the building away…':'The apartment';}
// Camera path as orbit coordinates around a moving target, splined through key poses.
export function introCamera(seconds,overview,fit=1){
const offset=overview.position.map((v,i)=>v-overview.target[i]),radius=Math.hypot(...offset),theta=Math.atan2(offset[0],offset[2]),phi=Math.acos(offset[1]/radius);
const keys=[[0,14,-5,-6,235*fit,theta-1.25,.84],[3.4,7.5,-1.5,1,82*fit,theta-.12,1],[5,7.2,-.5,2.5,68*fit,theta-.02,1.02],[6.9,7,0,3.6,52*fit,theta,.98],[8.6,...overview.target,radius*1.22,theta,phi],[INTRO_SECONDS,...overview.target,radius,theta,phi]];
const t=Math.max(0,Math.min(INTRO_SECONDS,seconds));let i=0;while(i<keys.length-2&&keys[i+1][0]<t)i++;
const a=keys[i],b=keys[i+1],before=keys[i-1],after=keys[i+2],h=b[0]-a[0],u=(t-a[0])/h,u2=u*u,u3=u2*u;
// Cubic Hermite with Catmull-Rom tangents; the path starts and ends at rest.
const value=k=>{const ma=before?(b[k]-before[k])/(b[0]-before[0]):0,mb=after?(after[k]-a[k])/(after[0]-a[0]):0;return (2*u3-3*u2+1)*a[k]+(u3-2*u2+u)*h*ma+(-2*u3+3*u2)*b[k]+(u3-u2)*h*mb;};
const target=[value(1),value(2),value(3)],r=value(4),angle=value(5),polar=value(6);
return {target,position:[target[0]+r*Math.sin(polar)*Math.sin(angle),target[1]+r*Math.cos(polar),target[2]+r*Math.sin(polar)*Math.cos(angle)]};
}

// ---------- Drawing façades. One canvas pixel is about 2 cm.
const PPM=48,WALL='#f1efe5';
const makeRandom=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
function canvasPair(width,height){const make=()=>{const c=document.createElement('canvas');c.width=Math.max(2,Math.round(width*PPM));c.height=Math.max(2,Math.round(height*PPM));return c;};const day=make(),night=make(),lit=night.getContext('2d');lit.fillStyle='#000';lit.fillRect(0,0,night.width,night.height);return {day,night,paint:day.getContext('2d'),lit};}
function finish(pair){const map=new THREE.CanvasTexture(pair.day),glow=new THREE.CanvasTexture(pair.night);map.colorSpace=glow.colorSpace=THREE.SRGBColorSpace;map.anisotropy=glow.anisotropy=8;return {map,glow};}
// A tall Lyon window: white frame, six panes and, for French windows, an iron rail.
function paintWindow(pair,x,base,width,height,{random,blind=false,rail=true}={}){
const {paint,lit,day}=pair,px=x*PPM,w=width*PPM,h=height*PPM,py=day.height-(base+height)*PPM;
paint.fillStyle='rgba(60,58,50,.28)';paint.fillRect(px-3,py-3,w+6,h+5);
if(blind){paint.fillStyle='#e2ded2';paint.fillRect(px,py,w,h);paint.strokeStyle='rgba(90,88,80,.35)';paint.lineWidth=1;for(let y=py+5;y<py+h;y+=5){paint.beginPath();paint.moveTo(px+2,y);paint.lineTo(px+w-2,y);paint.stroke();}paint.fillStyle='rgba(90,88,80,.4)';paint.fillRect(px+w/2-.5,py,1,h);return;}
const glass=paint.createLinearGradient(0,py,0,py+h);glass.addColorStop(0,'#9fb0b8');glass.addColorStop(.55,'#6f838f');glass.addColorStop(1,'#56666f');paint.fillStyle=glass;paint.fillRect(px,py,w,h);
// Some panes are curtained.
if(random&&random()>.55){paint.fillStyle='rgba(244,240,230,.55)';paint.fillRect(px,py,random()>.5?w:w/2,h);}
paint.strokeStyle='#f6f4ee';paint.lineWidth=3;paint.strokeRect(px+1.5,py+1.5,w-3,h-3);paint.lineWidth=2;paint.beginPath();paint.moveTo(px+w/2,py);paint.lineTo(px+w/2,py+h);for(const f of [.28,.64]){paint.moveTo(px,py+h*f);paint.lineTo(px+w,py+h*f);}paint.stroke();
paint.fillStyle='#dedacd';paint.fillRect(px-4,py+h,w+8,3);
if(rail){paint.strokeStyle='#2f3332';paint.lineWidth=1.4;const top=day.height-(base+1)*PPM;paint.beginPath();paint.moveTo(px,top);paint.lineTo(px+w,top);for(let bx=px+2;bx<px+w;bx+=5){paint.moveTo(bx,top);paint.lineTo(bx,py+h);}paint.stroke();}
if(random&&random()>.62){lit.fillStyle=random()>.3?'#ffd9a2':'#ffe9c8';lit.fillRect(px+2,py+2,w-4,h-4);}
}
function paintWall(pair,tone=WALL){const {paint,day}=pair;paint.fillStyle=tone;paint.fillRect(0,0,day.width,day.height);
// A string course marks each floor.
paint.fillStyle='rgba(120,116,104,.22)';paint.fillRect(0,day.height-3,day.width,3);paint.fillStyle='rgba(255,255,255,.35)';paint.fillRect(0,0,day.width,2);}
function paintStreetLevel(pair,length,random){const {paint,day}=pair,H=day.height;paint.fillStyle='#e6e2d6';paint.fillRect(0,0,day.width,H);paint.fillStyle='#cfc9ba';paint.fillRect(0,H-.9*PPM,day.width,.9*PPM);
const opening=(x,w,h,colour)=>{paint.fillStyle='rgba(60,58,50,.3)';paint.fillRect(x*PPM-3,H-h*PPM-3,w*PPM+6,h*PPM+3);paint.fillStyle=colour;paint.fillRect(x*PPM,H-h*PPM,w*PPM,h*PPM);};
opening(1,1.25,2.9,'#7a5236');// street door
for(let x=3.1;x+1.3<length*.5;x+=2.7){opening(x,1.25,2.1,'#7f8f98');paint.strokeStyle='#3a3d3c';paint.lineWidth=1;for(let bx=x*PPM+3;bx<(x+1.25)*PPM;bx+=5){paint.beginPath();paint.moveTo(bx,H-2.1*PPM);paint.lineTo(bx,H-.02*PPM);paint.stroke();}}
// Shuttered workshops with a little graffiti towards the corner.
for(let x=length*.5+.4;x+2.6<length;x+=3.2){opening(x,2.5,2.9,'#a9aaa6');paint.strokeStyle='rgba(70,72,70,.5)';paint.lineWidth=1;for(let y=H-2.85*PPM;y<H;y+=4){paint.beginPath();paint.moveTo(x*PPM,y);paint.lineTo((x+2.5)*PPM,y);paint.stroke();}
paint.lineWidth=3;paint.lineCap='round';for(let i=0;i<5;i++){paint.strokeStyle=['#d9573b','#3f8fb0','#e2b23c','#5c9a5a','#2d2f33'][Math.floor(random()*5)];paint.beginPath();const sx=(x+.2+random()*2)*PPM,sy=H-(.5+random()*1.6)*PPM;paint.moveTo(sx,sy);paint.bezierCurveTo(sx+18,sy-22,sx+30,sy+16,sx+46,sy-8);paint.stroke();}}}

// Hipped tile roof over a rectangle, ridge along its longer side.
function hipRoof(x0,x1,z0,z1,rise){
const along=z1-z0>x1-x0,half=(along?x1-x0:z1-z0)/2,cx=(x0+x1)/2,cz=(z0+z1)/2,r1=along?[cx,rise,z0+half]:[x0+half,rise,cz],r2=along?[cx,rise,z1-half]:[x1-half,rise,cz];
const a=[x0,0,z0],b=[x1,0,z0],c=[x1,0,z1],d=[x0,0,z1],faces=along?[[b,a,r1],[c,b,r1,r2],[d,c,r2],[a,d,r2,r1]]:[[a,d,r1],[b,a,r1,r2],[c,b,r2],[d,c,r2,r1]],points=[],uvs=[];
const push=(...corners)=>{for(const p of corners){points.push(...p);uvs.push(p[0]/3,p[2]/3);}};
for(const face of faces){push(face[0],face[1],face[2]);if(face[3])push(face[0],face[2],face[3]);}push(a,b,c,a,c,d);
const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();return geometry;
}

export function createBuildingIntro({south,east}){
const group=new THREE.Group(),hero=new THREE.Group(),town=new THREE.Group(),land=new THREE.Group();group.name='Building and neighbourhood';group.add(land,town,hero);
const random=makeRandom(20261126),cast=mesh=>{mesh.castShadow=mesh.receiveShadow=true;return mesh;},heroMaterials=[],glowing=[];
const standard=options=>new THREE.MeshStandardMaterial({roughness:.92,...options});
const heroMaterial=options=>{const m=standard(options);heroMaterials.push(m);return m;};
const lit=(material,glow)=>{material.emissiveMap=glow;material.emissive=new THREE.Color('#ffffff');material.emissiveIntensity=0;glowing.push(material);return material;};

// ----- The building. Its plan follows the apartment: square to the street, the side
// street running slightly off the perpendicular.
const edge=z=>14.26-.3*z/8.673,S=8.888,N=S-SITE.depth,W=-.215,eastLength=Math.hypot(edge(N)-edge(S),SITE.depth),eastAngle=Math.atan2(SITE.depth,edge(N)-edge(S));
const outline=points=>{const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();return shape;};
const slab=(points,height,material)=>{const mesh=cast(new THREE.Mesh(new THREE.ExtrudeGeometry(outline(points),{depth:height,bevelEnabled:false}),material));mesh.rotation.x=-Math.PI/2;return mesh;};
const render=heroMaterial({color:'#e9e6da'}),facadeOffset={polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2};
const frontWidth=edge(S)-W,eastWindows=[];for(let s=1.66;s<SITE.depth-.8;s+=2.95)eastWindows.push({at:s-east.width/2+(Math.abs(s-(east.at+east.width/2))<.2?0:.2),width:Math.abs(s-(east.at+east.width/2))<.2?east.width:1.3,sill:east.sill,height:east.height,blind:s<east.at-1});
function facades(streetLevel){const front=canvasPair(frontWidth,STOREY),side=canvasPair(eastLength,STOREY);
if(streetLevel){paintStreetLevel(front,frontWidth,random);paintStreetLevel(side,eastLength,random);}
else{paintWall(front);paintWall(side);for(const w of south)paintWindow(front,w.at-W,.254+w.sill,w.width,w.height,{random});for(const w of eastWindows)paintWindow(side,w.at,.254+w.sill,w.width,w.height,{random,blind:w.blind,rail:false});}
const f=finish(front),e=finish(side);return {front:lit(heroMaterial({map:f.map,...facadeOffset}),f.glow),side:lit(heroMaterial({map:e.map,...facadeOffset}),e.glow)};}
const typical=facades(false),street=facades(true),footprint=[[W,S],[edge(S),S],[edge(N),N],[W,N]];
const sidePlane=(material,from,to)=>{const plane=new THREE.Mesh(new THREE.PlaneGeometry(to-from,STOREY),material),uv=plane.geometry.attributes.uv,mid=(from+to)/2,z=S-mid;for(let i=0;i<uv.count;i++)uv.setX(i,(uv.getX(i)*(to-from)+from)/eastLength);plane.position.set(edge(z)+.05,STOREY/2,z);plane.rotation.y=eastAngle;plane.receiveShadow=true;return plane;};
const storeys=[];
for(let level=0;level<SITE.levels;level++){const module=new THREE.Group(),skin=level?typical:street;module.position.y=STREET+level*STOREY;module.userData.level=level;hero.add(module);storeys.push(module);
if(level===SITE.level){
// The apartment itself stands in for its part of this floor; only the rest is modelled.
module.add(slab([[W,N],[edge(N),N],[edge(-.215),-.215],[7.29,-.215],[7.29,3.56],[2.5,3.56],[2.5,3.15],[W,3.15]],STOREY,render),sidePlane(skin.side,S+.3,eastLength));continue;}
module.add(slab(footprint,STOREY,render),sidePlane(skin.side,0,eastLength));
const front=new THREE.Mesh(new THREE.PlaneGeometry(frontWidth,STOREY),skin.front);front.position.set((W+edge(S))/2,STOREY/2,S+.05);front.receiveShadow=true;module.add(front);}
// Blind bays near the corner continue the rhythm of the side façade across the apartment.
const blindPair=canvasPair(1.3,east.height);paintWall(blindPair);paintWindow(blindPair,0,0,1.3,east.height,{blind:true,rail:false});
const blindMaterial=heroMaterial({map:finish(blindPair).map,...facadeOffset}),decals=new THREE.Group();hero.add(decals);
for(const w of eastWindows.filter(w=>w.blind)){const z=S-(w.at+w.width/2),decal=new THREE.Mesh(new THREE.PlaneGeometry(1.3,east.height),blindMaterial);decal.position.set(edge(z)+.03,east.sill+east.height/2,z);decal.rotation.y=eastAngle;decals.add(decal);}
// Roof: terracotta hips, a cornice, the glazed roof-light over the street and chimneys.
const tilePaint=canvasPair(4,4);tilePaint.paint.fillStyle='#b9603b';tilePaint.paint.fillRect(0,0,192,192);for(let i=0;i<900;i++){tilePaint.paint.fillStyle=random()>.5?'rgba(255,190,140,.16)':'rgba(110,40,20,.16)';tilePaint.paint.fillRect(random()*192,random()*192,2+random()*5,2+random()*4);}
const tileMap=finish(tilePaint).map;tileMap.wrapS=tileMap.wrapT=THREE.RepeatWrapping;
const tiles=heroMaterial({map:tileMap,roughness:.95}),roofTop=new THREE.Group();roofTop.position.y=STREET+SITE.levels*STOREY;hero.add(roofTop);
roofTop.add(cast(new THREE.Mesh(hipRoof(W-.45,edge(N)+.45,N-.45,S+.45,3.2),tiles)));
const cornice=cast(new THREE.Mesh(new THREE.BoxGeometry(edge(N)-W+.5,.28,SITE.depth+.5),heroMaterial({color:'#f4f2ea'})));cornice.position.set((W+edge(N))/2,-.14,(N+S)/2);roofTop.add(cornice);
const skylight=new THREE.Mesh(new THREE.BoxGeometry(3.6,.16,2.3),heroMaterial({color:'#b9cbd3',roughness:.12,metalness:.35}));skylight.position.set(6.9,1.62,5.4);skylight.rotation.x=.385;roofTop.add(skylight);
const stack=heroMaterial({color:'#e7e1d2'});for(const [x,z] of [[3.2,-1],[11.4,-3.2],[10.8,-9.5],[3.6,-11]]){const chimney=cast(new THREE.Mesh(new THREE.BoxGeometry(.55,2.4,1.1),stack));chimney.position.set(x,2.4,z);roofTop.add(chimney);}
// Markers that pick the apartment out on the façades.
const marker=new THREE.MeshBasicMaterial({color:'#ffb347',transparent:true,opacity:0,toneMapped:false,depthWrite:false}),wash=new THREE.MeshBasicMaterial({color:'#ffd27a',transparent:true,opacity:0,toneMapped:false,depthWrite:false,blending:THREE.AdditiveBlending}),highlight=new THREE.Group();highlight.visible=false;hero.add(highlight);
const frame=(width,height,place)=>{const g=new THREE.Group(),t=.2;for(const [w,h,x,y] of [[width+t,t,0,height/2],[width+t,t,0,-height/2],[t,height,-width/2,0],[t,height,width/2,0]]){const bar=new THREE.Mesh(new THREE.BoxGeometry(w,h,.08),marker);bar.position.set(x,y,0);g.add(bar);}place(g);highlight.add(g);};
frame(frontWidth-.3,4.15,g=>g.position.set((W+edge(S))/2,1.98,S+.12));
frame(S-.3,4.15,g=>{const z=S/2;g.position.set(edge(z)+.12,1.98,z);g.rotation.y=eastAngle;});
for(const w of south){const pane=new THREE.Mesh(new THREE.PlaneGeometry(w.width,w.height),wash);pane.position.set(w.at+w.width/2,w.sill+w.height/2,S+.09);highlight.add(pane);}
{const z=S-(east.at+east.width/2),pane=new THREE.Mesh(new THREE.PlaneGeometry(east.width,east.height),wash);pane.position.set(edge(z)+.09,east.sill+east.height/2,z);pane.rotation.y=eastAngle;highlight.add(pane);}

// ----- The neighbourhood: terraces of old canut buildings, two towers and the Rhône.
const bayPair=canvasPair(2.7,STOREY);paintWall(bayPair,'#ffffff');paintWindow(bayPair,.75,.42,1.2,3,{rail:true});const bay=finish(bayPair);
const litBay=canvasPair(2.7*4,STOREY*3);for(let i=0;i<12;i++)if(random()>.7){litBay.lit.fillStyle='#ffd9a2';litBay.lit.fillRect((i%4*2.7+.8)*PPM,litBay.day.height-(Math.floor(i/4)*STOREY+3.35)*PPM,1.1*PPM,2.85*PPM);}
const bayGlow=finish(litBay).glow;for(const [texture,rx,ry] of [[bay.map,2.7,STOREY],[bayGlow,10.8,STOREY*3]]){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1/rx,1/ry);}
const terrace=lit(boxProject(standard({map:bay.map}),{space:'local'}),bayGlow);
const towerPair=canvasPair(3,2.8);towerPair.paint.fillStyle='#f4f4f0';towerPair.paint.fillRect(0,0,144,135);towerPair.paint.fillStyle='#7c8a92';towerPair.paint.fillRect(18,38,44,52);towerPair.paint.fillRect(86,38,40,52);towerPair.paint.fillStyle='#deded8';towerPair.paint.fillRect(0,100,144,6);
const towerMap=finish(towerPair).map;towerMap.wrapS=towerMap.wrapT=THREE.RepeatWrapping;towerMap.repeat.set(1/3,1/2.8);const tower=boxProject(standard({map:towerMap,roughness:.8}),{space:'local'});
const tones=['#f3efe5','#ebe4d2','#f0dcd2','#eedfb4','#e3dfd6','#f6f3ea'].map(colour=>{const m=cloneProjected(terrace);m.color.set(colour);m.emissive=terrace.emissive;glowing.push(m);return m;});
const townTiles=standard({map:tileMap,roughness:.95}),flat=standard({color:'#a9a8a2'}),pieces=[];
// One building: walls, roof and a delay that makes the town fold away outwards.
function block(x0,x1,z0,z1,height,{material=tones[Math.floor(random()*tones.length)],roof='hip',extras=null}={}){
const piece=new THREE.Group(),w=x1-x0,d=z1-z0,body=cast(new THREE.Mesh(new THREE.BoxGeometry(w,height,d),material));body.geometry.translate(0,height/2,0);piece.position.set((x0+x1)/2,STREET,(z0+z1)/2);piece.add(body);
if(roof==='hip'){const top=cast(new THREE.Mesh(hipRoof(-w/2-.4,w/2+.4,-d/2-.4,d/2+.4,Math.min(w,d)*.21),townTiles));top.position.y=height;piece.add(top);}
else{const cap=cast(new THREE.Mesh(new THREE.BoxGeometry(w+.3,.5,d+.3),flat));cap.position.y=height+.25;piece.add(cap);}
if(extras)extras(piece,w,d,height);piece.userData.delay=Math.min(.55,Math.hypot(piece.position.x-7,piece.position.z-3)/260);town.add(piece);pieces.push(piece);return piece;
}
// Along the street to the west, the modern infill behind, and the block opposite.
block(-13.4,W-.02,-3.6,S,21.5,{material:tones[1]});block(-27.5,-13.4,-4.2,S,20.6,{material:tones[0]});block(-43,-27.5,-4.2,S,21.5,{material:tones[4]});
const planted=standard({color:'#587f4c',roughness:1});
block(-1.5,edge(N)+.3,N-17,N-.05,16.2,{material:standard({color:'#dfe0dc',roughness:.7}),roof:'flat',extras:(piece,w,d,h)=>{for(const [x,z,sx,sz] of [[-3,2,6,4],[4,-3,5,3.5],[-1,-5.5,8,1.6]]){const bed=cast(new THREE.Mesh(new THREE.BoxGeometry(sx,1.1,sz),planted));bed.position.set(x,h+1,z);piece.add(bed);}}});
block(-1.5,15.6,N-36,N-19,20.4);
for(const [x0,x1,h] of [[-41,-24,19.5],[-24,-8,21.5],[-8,9.5,18.6]])block(x0,x1,S+9.2,S+21.5,h);
// The two white towers across the side street.
const chimneys=(piece,w,d,h)=>{for(let i=0;i<5;i++){const c=cast(new THREE.Mesh(new THREE.BoxGeometry(1.2,2.4,1.2),flat));c.position.set(-w/2+2+i*(w-4)/4,h+1.7,(i%2?.25:-.25)*d);piece.add(c);}};
block(33,52,-13,19,52,{material:tower,roof:'flat',extras:chimneys});block(74,96,-104,-44,46.4,{material:tower,roof:'flat',extras:chimneys});
// Streets of terraces filling the slopes, with gaps where cross streets run.
const reserved=[[-46,58,-52,32],[26,110,-112,24]],clear=(x0,x1,z0,z1)=>!reserved.some(([a,b,c,d])=>x0<b&&x1>a&&z0<d&&z1>c);
for(const [z0,z1,from,to] of [[-66,-54,-190,14],[-104,-92,-190,40],[-142,-130,-190,60],[-180,-168,-170,70],[-4.2,S,-190,-47],[S+9.2,S+21.5,-190,-45],[44,56,-190,22],[72,84,-190,40],[100,112,-190,58],[128,140,-180,70],[156,168,-160,80],[40,52,64,118],[70,82,74,126],[-150,-138,100,126]]){
let x=from;while(x<to-9){const width=9+random()*7,height=14.5+Math.round(random()*2)*STOREY*.5+random()*3,lane=((x+width/2+52)%64+64)%64,street=lane<5||lane>59;if(!street&&random()>.07&&clear(x,x+width,z0,z1))block(x,x+width-.05,z0+random()*1.2,z1,height);x+=width;}}
// Trees on the slope down to the river and in the courtyards.
const crowns=[];const grove=(cx,cz,rx,rz,count)=>{for(let i=0;i<count;i++){const a=random()*Math.PI*2,r=Math.sqrt(random());crowns.push([cx+Math.cos(a)*r*rx,cz+Math.sin(a)*r*rz,3.2+random()*3.4]);}};
grove(98,10,22,60,46);grove(126,-70,16,70,30);grove(30,44,10,9,9);grove(-20,-28,9,7,7);grove(140,90,18,50,22);grove(20,-52,6,5,5);
const trees=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),standard({color:'#ffffff',roughness:1,flatShading:true}),crowns.length),placement=new THREE.Object3D(),leaf=new THREE.Color();
crowns.forEach(([x,z,size],i)=>{placement.position.set(x,size*.75,z);placement.scale.set(size,size*(.8+random()*.5),size);placement.rotation.y=random()*6;placement.updateMatrix();trees.setMatrixAt(i,placement.matrix);trees.setColorAt(i,leaf.setHSL(.27+random()*.07,.34+random()*.14,.24+random()*.1,THREE.SRGBColorSpace));});
trees.castShadow=trees.receiveShadow=true;const wood=new THREE.Group();wood.position.y=STREET;wood.add(trees);wood.userData.delay=.3;town.add(wood);pieces.push(wood);
// Parked cars give the street its scale.
const cars=new THREE.Group();cars.position.y=STREET;cars.userData.delay=.05;town.add(cars);pieces.push(cars);
for(const [x,z,turn] of [[-30,10.6,0],[-22,10.6,0],[-9,10.7,0],[2,16.3,0],[-16,16.3,0],[-36,16.3,0],[17.4,-4,1],[17.4,-12,1],[17.5,-27,1],[22.3,-18,1],[22.3,-36,1],[28,24,.7]]){const car=cast(new THREE.Mesh(new THREE.BoxGeometry(4.2,1.35,1.8),standard({color:['#d9d9d6','#2f3438','#a8322c','#3c5f86','#f1f1ee','#787d80'][Math.floor(random()*6)],roughness:.35,metalness:.3})));car.position.set(x,.72,z);car.rotation.y=turn*Math.PI/2;cars.add(car);}

// ----- The ground: pavements, the two streets, a building site and the river.
const fading=[],ground=options=>{const m=standard({transparent:false,...options});fading.push(m);return m;},flatOn=(mesh,y)=>{mesh.rotation.x=-Math.PI/2;mesh.position.y=STREET+y;mesh.receiveShadow=true;land.add(mesh);return mesh;};
flatOn(new THREE.Mesh(new THREE.CircleGeometry(900,64),ground({color:'#bdb9ae'})),-.02);
const asphalt=ground({color:'#87888a'}),strip=(x,z,length,width,turn=0,material=asphalt,y=.02)=>{const road=flatOn(new THREE.Mesh(new THREE.PlaneGeometry(length,width),material),y);road.position.x=x;road.position.z=z;road.rotation.z=turn;return road;};
strip(-82,S+4.6,216,6.2);strip(19.8,-45,6.2,116,0);strip(19.8,S+4.6,13,12);strip(52,43,96,6.4,-.86);strip(-52,0,6,420);strip(-116,0,6,420);for(const z of [-48,-86,-124,-162,38,64,92,120,148])strip(-60,z,260,5.4);
const paint=ground({color:'#f2f1ec'});for(let i=0;i<6;i++){strip(14.2+i*.0,S+2.2+i*.95,3.4,.5,0,paint,.04);strip(17.2+i*.95,S+9.4,.5,3.2,0,paint,.04);}
strip(52,-34,54,46,0,ground({color:'#cdc3a9'}),.03);
flatOn(new THREE.Mesh(new THREE.PlaneGeometry(92,1400),ground({color:'#46a79f',roughness:.16,metalness:.25})),.05).position.x=212;
for(let z=-420;z<420;z+=17+random()*8)block(268,268+10+random()*6,z,z+15,16+random()*7);

// Everything is driven from one stage object; see introStage().
const up=(module,level,stage)=>{module.position.y=STREET+level*STOREY+(level-SITE.level)*(5.4*stage.split+44*stage.clear*stage.clear);};
function apply(stage,seconds=0,night=0){
const fade=1-ease(stage.clear*1.15);
storeys.forEach((module,level)=>{if(level===SITE.level){module.position.z=-(7*stage.split+46*stage.clear*stage.clear);module.position.y=STREET+level*STOREY;}else up(module,level,stage);module.visible=fade>0;});
roofTop.position.y=STREET+SITE.levels*STOREY+(SITE.levels-SITE.level)*(5.4*stage.split+44*stage.clear*stage.clear);roofTop.visible=fade>0;
// Opaque programs ignore opacity, so switching to a fade needs a recompile.
const blend=(material,opacity)=>{if(material.transparent!==opacity<1){material.transparent=opacity<1;material.needsUpdate=true;}material.opacity=opacity;material.depthWrite=opacity>.35;};
for(const material of heroMaterials)blend(material,fade);
decals.visible=stage.split<.98&&fade>0;blend(blindMaterial,Math.min(fade,1-stage.split));
const glow=stage.glow*(.72+.28*Math.sin(seconds*5.2));highlight.visible=glow>.01;marker.opacity=glow;wash.opacity=glow*.5;
for(const piece of pieces){const gone=ease((stage.sink*1.55-piece.userData.delay)/.6);piece.scale.y=Math.max(.0001,1-gone);piece.visible=gone<.96;}
const earth=1-span(stage.clear,.15,.95);land.visible=earth>0;for(const material of fading)blend(material,earth);
for(const material of glowing)material.emissiveIntensity=night*1.1;
}
function dispose(){group.traverse(object=>{object.geometry?.dispose();for(const material of object.material?[].concat(object.material):[]){material.map?.dispose();material.emissiveMap?.dispose();material.dispose();}});}
apply(introStage(0));
// How far the apartment's own ceilings rise with the floors above, and when they go.
const ceilingLift=stage=>2.7*stage.split+44*stage.clear*stage.clear;
return {group,apply,dispose,ceilingLift,street:STREET};
}
