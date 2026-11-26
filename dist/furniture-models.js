import * as THREE from './vendor/three.module.js';
import {boxProject,cloneProjected} from './surface-materials.js?v=e68a6e50cd69';

// Dimensions are metres. Bevels stay within the specified furniture envelope.
export function softBoxGeometry(w,h,d,r=.03){
 const radius=Math.min(r,w/2,h/2,d/2),geo=new THREE.BoxGeometry(w,h,d,10,10,10),p=geo.attributes.position,n=geo.attributes.normal,core=new THREE.Vector3(w/2-radius,h/2-radius,d/2-radius),v=new THREE.Vector3(),q=new THREE.Vector3(),normal=new THREE.Vector3();
 const edgeSamples=half=>[-half,-half+radius*.1,-half+radius*.3,-half+radius*.6,-half+radius,0,half-radius,half-radius*.6,half-radius*.3,half-radius*.1,half];
 const samples=[w,h,d].map(size=>edgeSamples(size/2));
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);for(let axis=0;axis<3;axis++){const size=[w,h,d][axis],index=Math.round((v.getComponent(axis)/size+.5)*10);v.setComponent(axis,samples[axis][index]);}q.copy(v).clamp(core.clone().negate(),core);normal.copy(v).sub(q).normalize();v.copy(normal).multiplyScalar(radius).add(q);p.setXYZ(i,v.x,v.y,v.z);n.setXYZ(i,normal.x,normal.y,normal.z);}return geo;
}
export function createFurnitureMaterials(){
 let seed=981;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 function texture(size,paint,repeat,srgb=false){const c=document.createElement('canvas');c.width=c.height=size;paint(c.getContext('2d'),size);const map=new THREE.CanvasTexture(c);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(repeat,repeat);map.anisotropy=8;if(srgb)map.colorSpace=THREE.SRGBColorSpace;return map;}
 // Grey-scale grain multiplies the piece's own colour, so recolouring keeps the figure.
 const grain=texture(512,(ctx,size)=>{ctx.fillStyle='#ececec';ctx.fillRect(0,0,size,size);for(let i=0;i<12;i++){ctx.fillStyle=`rgba(${i%2?255:120},${i%2?255:120},${i%2?255:120},${.05+random()*.08})`;ctx.fillRect(random()*size,0,20+random()*50,size);}for(let i=0;i<900;i++){const x=random()*size,v=random()>.3?70:255;ctx.strokeStyle=`rgba(${v},${v},${v},${.04+random()*.15})`;ctx.lineWidth=.4+random()*1.1;ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+4,size*.3,x-5,size*.66,x,size);ctx.stroke();}},1/.55,true);
 const grainRelief=texture(256,(ctx,size)=>{ctx.fillStyle='#808080';ctx.fillRect(0,0,size,size);for(let i=0;i<340;i++){const v=random()>.5?230:25;ctx.fillStyle=`rgba(${v},${v},${v},${.05+random()*.14})`;ctx.fillRect(random()*size,0,.5+random()*1.2,size);}},1/.3);
 const weave=texture(128,(ctx,size)=>{ctx.fillStyle='#808080';ctx.fillRect(0,0,size,size);for(let y=0;y<size;y+=4)for(let x=0;x<size;x+=4){const over=((x+y)/4)%2;ctx.fillStyle=over?'#c9c9c9':'#484848';ctx.fillRect(x,y,over?4:2,over?2:4);if(random()>.86){ctx.fillStyle='rgba(255,255,255,.35)';ctx.fillRect(x,y,3,1);}}},1/.085);
 const pile=texture(256,(ctx,size)=>{ctx.fillStyle='#f0f0f0';ctx.fillRect(0,0,size,size);for(let i=0;i<5200;i++){const v=random()>.5?255:150;ctx.fillStyle=`rgba(${v},${v},${v},${.08+random()*.2})`;ctx.fillRect(random()*size,random()*size,1+random()*2,1+random()*2);}ctx.strokeStyle='rgba(95,95,95,.55)';ctx.lineWidth=3;for(let i=-size;i<size*2;i+=64){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+size/2,size/2);ctx.lineTo(i,size);ctx.stroke();}},1/.9,true);
 const pileRelief=texture(128,(ctx,size)=>{ctx.fillStyle='#808080';ctx.fillRect(0,0,size,size);for(let i=0;i<2600;i++){const v=random()>.5?255:0;ctx.fillStyle=`rgba(${v},${v},${v},${.12+random()*.3})`;ctx.fillRect(random()*size,random()*size,1.5,1.5);}},1/.12);
 const local=(material,grainAxis='z')=>boxProject(material,{space:'local',grain:grainAxis});
 return {
 wood:local(new THREE.MeshStandardMaterial({color:'#bb956a',map:grain,bumpMap:grainRelief,bumpScale:.35,roughness:.5})),
 cloth:local(new THREE.MeshStandardMaterial({color:'#b6b1a4',bumpMap:weave,bumpScale:1.1,roughness:.95})),
 linen:local(new THREE.MeshStandardMaterial({color:'#eee9df',bumpMap:weave,bumpScale:.6,roughness:.96})),
 blanket:local(new THREE.MeshStandardMaterial({color:'#829383',bumpMap:weave,bumpScale:1.5,roughness:.98})),
 rug:local(new THREE.MeshStandardMaterial({color:'#d8cfbd',map:pile,bumpMap:pileRelief,bumpScale:1.6,roughness:1})),
 metal:new THREE.MeshStandardMaterial({color:'#30332e',roughness:.36,metalness:.65}),
 brass:new THREE.MeshStandardMaterial({color:'#b89a5e',roughness:.32,metalness:.9}),
 ceramic:new THREE.MeshStandardMaterial({color:'#e9e4d8',roughness:.35}),
 terracotta:new THREE.MeshStandardMaterial({color:'#b9785a',roughness:.85}),
 soil:new THREE.MeshStandardMaterial({color:'#3a2e25',roughness:1}),
 leaf:new THREE.MeshStandardMaterial({color:'#4c7a45',roughness:.55,side:THREE.DoubleSide}),
 paper:new THREE.MeshStandardMaterial({color:'#f2ead8',roughness:.9,side:THREE.DoubleSide}),
 glow:new THREE.MeshStandardMaterial({color:'#fff3d6',emissive:'#ffd9a0',emissiveIntensity:0,roughness:.6}),
 seam:new THREE.MeshStandardMaterial({color:'#898477',roughness:1})};
}
export function furnitureBuilder(materials){
 const mesh=(parent,geometry,material,position,part)=>{const m=new THREE.Mesh(geometry,material);m.position.set(...position);m.castShadow=m.receiveShadow=true;if(part)m.userData.furniturePart=part;parent.add(m);return m;};
 const soft=(g,x,y,z,w,h,d,mat,part,r=.025)=>mesh(g,softBoxGeometry(w,h,d,r),mat,[x,y+h/2,z],part);
 const rod=(g,a,b,r1=.022,r2=.018,mat=materials.wood,part='wood')=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),m=mesh(g,new THREE.CylinderGeometry(r2,r1,start.distanceTo(end),16),mat,start.clone().add(end).multiplyScalar(.5).toArray(),part);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());return m;};
 function sofa(width){const g=new THREE.Group(),arm=.12,inner=width-arm*2,count=width<1?1:width<1.9?2:3;
 for(const x of [-width/2+.14,width/2-.14])for(const z of [-.28,.28])rod(g,[x,.02,z],[x,.20,z],.022,.018);
 soft(g,0,.17,0,width,.19,.83,materials.cloth,'upholstery',.045);
 soft(g,0,.33,-.33,width,.48,.17,materials.cloth,'upholstery',.055);
 for(const x of [-width/2+arm/2,width/2-arm/2])soft(g,x,.30,.01,arm,.36,.80,materials.cloth,'upholstery',.055);
 for(let i=0;i<count;i++){const x=-inner/2+(i+.5)*inner/count;soft(g,x,.355,.065,inner/count-.014,.16,.60,materials.cloth,'upholstery',.06);const back=soft(g,x,.49,-.225,inner/count-.02,.29,.13,materials.cloth,'upholstery',.045);back.rotation.x=-.10;
 // Fine piping gives each seat a defined upholstered edge.
 soft(g,x,.397,.365,inner/count-.075,.006,.006,materials.cloth,'upholstery',.003);}
 if(width>1.9){for(const side of [-1,1]){const pillow=soft(g,side*(width/2-.29),.51,-.04,.28,.29,.12,materials.blanket,'bedding',.055);pillow.rotation.z=side*.18;pillow.rotation.x=-.15;}}
 return g;
 }
 function chair(){const g=new THREE.Group();for(const x of [-.17,.17])for(const z of [-.155,.155])rod(g,[x*1.12,.015,z*1.1],[x,.43,z],.018,.024);
 soft(g,0,.40,0,.46,.045,.45,materials.wood,'wood',.025);soft(g,0,.442,.01,.405,.055,.38,materials.cloth,'upholstery',.025);
 for(const x of [-.19,.19])rod(g,[x,.43,-.175],[x,.82,-.215],.018,.015);
 const back=soft(g,0,.65,-.20,.45,.17,.055,materials.wood,'wood',.026);back.rotation.x=-.12;
 for(const x of [-.17,.17])rod(g,[x,.20,-.15],[x,.20,.15],.009,.009);return g;
 }
 function bed(w,d){const g=new THREE.Group();for(const x of [-w/2+.1,w/2-.1])for(const z of [-d/2+.12,d/2-.12])rod(g,[x,.02,z],[x,.20,z],.027,.025);
 soft(g,0,.16,0,w,.22,d,materials.wood,'wood',.025);soft(g,0,.38,0,w-.03,.24,d-.03,materials.linen,'bedding',.07);
 soft(g,0,.20,-d/2,w+.04,.78,.07,materials.wood,'wood',.025);
 soft(g,0,.62,.18,w-.04,.10,d-.52,materials.linen,'bedding',.065);
 const count=w>1.2?2:1;for(let i=0;i<count;i++){const pillow=soft(g,(i-(count-1)/2)*w/count,.64,-d/2+.32,w/count-.14,.13,.43,materials.linen,'bedding',.06);pillow.rotation.y=(i%2?.025:-.025);}
 soft(g,0,.725,d/2-.36,w-.08,.025,.56,materials.blanket,'upholstery',.012);
 for(let i=0;i<8;i++)soft(g,0,.748,d/2-.60+i*.06,w-.11,.003,.008,materials.blanket,'upholstery',.001);return g;
 }
 function table(w,d,h){const g=new THREE.Group();soft(g,0,h,0,w,.05,d,materials.wood,'wood',.024);soft(g,0,h-.10,0,w-.15,.10,d-.15,materials.wood,'wood',.02);
 for(const x of [-w/2+.10,w/2-.10])for(const z of [-d/2+.12,d/2-.12])rod(g,[x*1.03,.01,z*1.02],[x,h,z],.024,.041);return g;
 }
 function coffee(){const g=new THREE.Group();mesh(g,new THREE.CylinderGeometry(.40,.395,.035,64),materials.wood,[0,.4475,0],'wood');mesh(g,new THREE.CylinderGeometry(.38,.39,.012,64),materials.wood,[0,.424,0],'wood');for(let i=0;i<3;i++){const a=i*Math.PI*2/3;rod(g,[Math.sin(a)*.28,.01,Math.cos(a)*.28],[Math.sin(a)*.18,.42,Math.cos(a)*.18],.019,.032);}return g;}
 function wardrobe(w,d){const g=new THREE.Group();soft(g,0,.08,0,w,2.6,d,materials.wood,'wood',.012);const count=Math.max(2,Math.round(w/.5));for(let i=0;i<count;i++){const x=-w/2+(i+.5)*w/count;soft(g,x,.10,d/2+.007,w/count-.007,2.56,.018,materials.wood,'wood',.006);rod(g,[x+w/count/2-.055,1.05,d/2+.035],[x+w/count/2-.055,1.23,d/2+.035],.006,.006,materials.metal,null);}soft(g,0,.01,0,w-.09,.075,d-.06,materials.metal,null,.01);return g;}
 // Counter stool after the supplied product sheet: 88 cm tall, 67 cm seat, 3 cm cushion,
 // 20 x 40 cm backrest, 48 x 51 cm leg footprint and footrest ring at 19.5 cm.
 function stool(){const g=new THREE.Group(),frame=materials.metal.clone(),seat=cloneProjected(materials.cloth),velvet=cloneProjected(materials.cloth),glide=materials.metal.clone();
 frame.color.set('#7f977c');frame.metalness=.25;frame.roughness=.55;seat.color.set('#a8583a');velvet.color.set('#b8893a');velvet.roughness=.72;velvet.bumpScale=.3;glide.color.set('#1d1f1c');glide.metalness=0;glide.roughness=.8;
 const tube=(a,b)=>rod(g,a,b,.009,.009,frame,'frame'),joint=p=>mesh(g,new THREE.SphereGeometry(.009,12,8),frame,p,'frame');
 const top=[[-.19,.615,-.165],[.19,.615,-.165],[-.19,.615,.175],[.19,.615,.175]],foot=[[-.23,.012,-.245],[.23,.012,-.245],[-.23,.012,.245],[.23,.012,.245]];
 const at=(i,y)=>{const t=(y-foot[i][1])/(top[i][1]-foot[i][1]);return foot[i].map((v,k)=>k===1?y:v+(top[i][k]-v)*t);};
 for(let i=0;i<4;i++){tube(foot[i],top[i]);mesh(g,new THREE.CylinderGeometry(.011,.012,.012,12),glide,[foot[i][0],.006,foot[i][2]],null);}
 // Seat frame and footrest ring.
 for(const [a,b] of [[0,1],[2,3],[0,2],[1,3]]){tube(top[a],top[b]);tube(at(a,.195),at(b,.195));}
 for(const p of top)joint(p);
 soft(g,0,.615,.005,.42,.013,.40,frame,'frame',.006);
 soft(g,0,.628,.005,.435,.042,.41,seat,'upholstery',.02);
 // Rear posts loop forward into armrests and back down to the seat rail.
 for(const x of [-.212,.212]){const post=[x,.615,-.175],high=[x,.80,-.215],front=[x,.80,.025],down=[x,.628,.075];tube(post,high);tube(high,front);tube(front,down);for(const p of [high,front,down])joint(p);}
 const back=soft(g,0,.68,-.225,.40,.20,.045,velvet,'backrest',.018);back.rotation.x=-.06;
 return g;
 }
 // Flat-woven rug; thin enough to walk over.
 function rug(w,d){const g=new THREE.Group();soft(g,0,0,0,w,.014,d,materials.rug||materials.cloth,'upholstery',.006);return g;}
 // Tall leafy plant in a ceramic pot: arching stems, each ending in one broad leaf.
 function plant(height=1.5){const g=new THREE.Group(),pot=materials.terracotta||materials.wood,leafMaterial=materials.leaf||materials.blanket;let seed=311;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 mesh(g,new THREE.CylinderGeometry(.19,.14,.34,28),pot,[0,.17,0],'frame');mesh(g,new THREE.CylinderGeometry(.2,.2,.03,28),pot,[0,.345,0],'frame');mesh(g,new THREE.CylinderGeometry(.175,.175,.02,24),materials.soil||materials.metal,[0,.345,0],null);
 const outline=new THREE.Shape();outline.moveTo(0,0);outline.bezierCurveTo(.1,.05,.115,.27,0,.44);outline.bezierCurveTo(-.115,.27,-.1,.05,0,0);const leafGeometry=new THREE.ShapeGeometry(outline,10);
 // Fold each leaf slightly along its midrib.
 const lp=leafGeometry.attributes.position;for(let i=0;i<lp.count;i++)lp.setZ(i,Math.abs(lp.getX(i))*.42-Math.pow(lp.getY(i),2)*.25);leafGeometry.computeVertexNormals();
 const count=9;for(let i=0;i<count;i++){const angle=i/count*Math.PI*2+random()*.5,reach=.1+random()*.2,top=height*(.48+random()*.4),start=new THREE.Vector3(Math.cos(angle)*.05,.34,Math.sin(angle)*.05),end=new THREE.Vector3(Math.cos(angle)*reach,top,Math.sin(angle)*reach),curve=new THREE.QuadraticBezierCurve3(start,new THREE.Vector3(Math.cos(angle)*.04,top*.72,Math.sin(angle)*.04),end);
 const stem=mesh(g,new THREE.TubeGeometry(curve,10,.008,6),leafMaterial,[0,0,0],null);stem.userData.noCap=true;
 const leaf=mesh(g,leafGeometry,leafMaterial,end.toArray(),null),direction=curve.getTangent(1).lerp(new THREE.Vector3(Math.cos(angle),-.15,Math.sin(angle)),.55).normalize();leaf.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);leaf.rotateY(random()*.8-.4);leaf.scale.setScalar(.78+random()*.5);}
 return g;}
 // Arc floor lamp with a linen drum shade. The bulb glows when lamps are switched on.
 function floorLamp(){const g=new THREE.Group(),brass=materials.brass||materials.metal;
 mesh(g,new THREE.CylinderGeometry(.15,.16,.025,32),brass,[0,.0125,0],'frame');rod(g,[0,.02,0],[0,1.5,0],.011,.011,brass,'frame');
 const shade=mesh(g,new THREE.CylinderGeometry(.15,.19,.26,32,1,true),materials.paper||materials.linen,[0,1.55,0],'upholstery');shade.userData.noCap=true;
 const bulb=mesh(g,new THREE.SphereGeometry(.045,16,12),materials.glow||materials.linen,[0,1.52,0],null);bulb.castShadow=false;bulb.userData.bulb=true;
 const light=new THREE.PointLight('#ffe0b8',0,7,1.6);light.position.set(0,1.5,0);g.add(light);g.userData.lamp=light;return g;}
 // Ceiling pendant hung on a cord of the given length; origin at the ceiling.
 function pendant(drop,radius=.17){const g=new THREE.Group();
 rod(g,[0,0,0],[0,-drop+.12,0],.004,.004,materials.metal,null);mesh(g,new THREE.CylinderGeometry(.03,.03,.02,16),materials.metal,[0,-.01,0],null);
 const dome=mesh(g,new THREE.SphereGeometry(radius,28,14,0,Math.PI*2,0,Math.PI*.5),materials.metal,[0,-drop,0],null);dome.userData.noCap=true;dome.material=materials.shade||materials.metal;
 const bulb=mesh(g,new THREE.SphereGeometry(radius*.3,16,12),materials.glow||materials.linen,[0,-drop+radius*.2,0],null);bulb.castShadow=false;bulb.userData.bulb=true;return g;}
 // Small table-top accents.
 function vase(height=.26){const g=new THREE.Group(),profile=[[0,0],[.055,0],[.075,.06],[.06,.16],[.032,.21],[.04,height],[.03,height]].map(([x,y])=>new THREE.Vector2(x,y));mesh(g,new THREE.LatheGeometry(profile,24),materials.ceramic||materials.linen,[0,0,0],null);
 for(let i=0;i<5;i++){const a=i*1.3,tip=new THREE.Vector3(Math.cos(a)*.12,height+.3+i*.03,Math.sin(a)*.12);rod(g,[0,height-.02,0],tip.toArray(),.003,.002,materials.leaf||materials.metal,null);const bud=mesh(g,new THREE.SphereGeometry(.022,10,8),materials.leaf||materials.blanket,tip.toArray(),null);bud.scale.set(1,1.5,1);}return g;}
 function books(){const g=new THREE.Group();[['#8a9a86',.24,.17,.028],['#c9b79a',.22,.16,.022],['#55646b',.19,.14,.03]].reduce((y,[colour,w,d,h],i)=>{const cover=materials.seam.clone();cover.color.set(colour);const book=soft(g,(i-1)*.012,y,0,w,h,d,cover,null,.004);book.rotation.y=(i-1)*.22;return y+h;},0);return g;}
 function bowl(){const g=new THREE.Group(),profile=[[0,0],[.07,0],[.15,.07],[.16,.085],[.145,.085],[.065,.02],[0,.02]].map(([x,y])=>new THREE.Vector2(x,y));mesh(g,new THREE.LatheGeometry(profile,28),materials.ceramic||materials.linen,[0,0,0],null);
 const fruit=materials.seam.clone();fruit.color.set('#d99a3f');fruit.roughness=.6;for(const [x,z] of [[-.05,.01],[.045,.03],[0,-.05]])mesh(g,new THREE.SphereGeometry(.04,14,10),fruit,[x,.06,z],null);return g;}
 return {sofa,chair,bed,table,coffee,wardrobe,stool,rug,plant,floorLamp,pendant,vase,books,bowl};
}
// Each editable part gets private material instances; adjacent chairs never share tint.
export function isolateFurnitureMaterials(object){const clones=new Map(),parts={};object.traverse(mesh=>{const part=mesh.userData.furniturePart;if(!mesh.isMesh||!part)return;const key=part+':'+mesh.material.uuid;if(!clones.has(key)){const m=cloneProjected(mesh.material);clones.set(key,m);(parts[part]??=[]).push({material:m,original:m.color.clone()});}mesh.material=clones.get(key);});return parts;}
export function applyFurnitureColours(parts,colours={}){for(const [part,entries] of Object.entries(parts))for(const {material,original} of entries){material.color.copy(original);if(colours[part])material.color.set(colours[part]);}}
