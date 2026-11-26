import * as THREE from './vendor/three.module.js';
// A small ball that works as a thumbstick for the camera and doubles as a compass.
// Push it and the view keeps turning that way; let go and it springs back. The
// markers on the ball follow the real camera, and tapping one brings that side to the front.

// Stick position (pixels from the centre) to a -1..1 command with a dead zone.
export function stickVector(dx,dy,radius,deadzone=.14){
const length=Math.hypot(dx,dy),amount=Math.min(1,length/radius);
if(!length||amount<=deadzone)return {x:0,y:0,amount:0};
const eased=Math.pow((amount-deadzone)/(1-deadzone),1.5);
return {x:dx/length*eased,y:dy/length*eased,amount:eased};
}
// Turn an orbit offset (camera minus target) by yaw and pitch, keeping it off the poles.
export function orbitOffset(offset,yaw,pitch,minPolar=.02,maxPolar=Math.PI*.49){
const radius=Math.hypot(offset.x,offset.y,offset.z)||1;
const theta=Math.atan2(offset.x,offset.z)+yaw,phi=Math.max(minPolar,Math.min(maxPolar,Math.acos(Math.max(-1,Math.min(1,offset.y/radius)))+pitch));
return {x:radius*Math.sin(phi)*Math.sin(theta),y:radius*Math.cos(phi),z:radius*Math.sin(phi)*Math.cos(theta)};
}
// World directions of the compass points for a given rotation of the plan (radians).
export function compassDirections(rotation=0){const c=Math.cos(rotation),s=Math.sin(rotation);
return {E:[c,0,s],W:[-c,0,-s],S:[-s,0,c],N:[s,0,-c],top:[0,1,0]};}

export function createViewJoystick({mount,onStick,onSnap,onStart=()=>{},onEnd=()=>{}}){
const SIZE=116,CENTRE=SIZE/2,BALL=40,TRAVEL=11,REACH=46;
const root=document.createElement('div');root.className='joystick';root.tabIndex=0;root.setAttribute('role','application');root.setAttribute('aria-label','Camera joystick. Drag to orbit, or use the arrow keys. Tap a compass point to look from that side.');root.title='Drag to orbit · Tap N, E, S, W or ▲ to snap the view';
const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');root.append(canvas);mount.append(root);
const ctx=canvas.getContext('2d');let ratio=0;
const stick={x:0,y:0,px:0,py:0,active:false,pointer:null,startX:0,startY:0,travelled:0};
let markers=[],rotation=0,lastQuaternion=new THREE.Quaternion(),dirty=true;
const inverse=new THREE.Quaternion(),v=new THREE.Vector3();
function project(direction){v.set(...direction).applyQuaternion(inverse);return {x:v.x,y:-v.y,depth:v.z};}
function draw(quaternion){
if(quaternion){if(!dirty&&quaternion.equals(lastQuaternion))return;lastQuaternion.copy(quaternion);}
dirty=false;inverse.copy(lastQuaternion).invert();
const next=Math.min(devicePixelRatio||1,3);if(next!==ratio){ratio=next;canvas.width=canvas.height=SIZE*ratio;canvas.style.width=canvas.style.height=SIZE+'px';}
ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,SIZE,SIZE);
const style=getComputedStyle(root),ink=style.getPropertyValue('--joy-ink').trim()||'#2f3a33',accent=style.getPropertyValue('--joy-accent').trim()||'#3f6b4c',north=style.getPropertyValue('--joy-north').trim()||'#d9573b';
// Base ring with four travel chevrons.
ctx.beginPath();ctx.arc(CENTRE,CENTRE,CENTRE-3,0,7);ctx.fillStyle='rgba(255,255,255,.78)';ctx.fill();ctx.lineWidth=1;ctx.strokeStyle='rgba(47,58,51,.16)';ctx.stroke();
ctx.strokeStyle=stick.active?accent:'rgba(47,58,51,.42)';ctx.lineWidth=1.6;ctx.lineCap='round';ctx.lineJoin='round';
for(let i=0;i<4;i++){const a=i*Math.PI/2,r=CENTRE-9,x=CENTRE+Math.cos(a)*r,y=CENTRE+Math.sin(a)*r,tx=-Math.sin(a),ty=Math.cos(a);ctx.beginPath();ctx.moveTo(x-Math.cos(a)*3+tx*4,y-Math.sin(a)*3+ty*4);ctx.lineTo(x,y);ctx.lineTo(x-Math.cos(a)*3-tx*4,y-Math.sin(a)*3-ty*4);ctx.stroke();}
const bx=CENTRE+stick.px,by=CENTRE+stick.py;
// The ball's shadow stays behind as it is pushed, so displacement reads as tilt.
const shade=ctx.createRadialGradient(bx-BALL*.36,by-BALL*.42,BALL*.08,bx,by,BALL);shade.addColorStop(0,'#ffffff');shade.addColorStop(.55,'#eef1ea');shade.addColorStop(1,'#c9d1c4');
ctx.save();ctx.shadowColor='rgba(31,46,27,.30)';ctx.shadowBlur=12;ctx.shadowOffsetX=-stick.px*.5;ctx.shadowOffsetY=5-stick.py*.5;ctx.beginPath();ctx.arc(bx,by,BALL,0,7);ctx.fillStyle=shade;ctx.fill();ctx.restore();ctx.beginPath();ctx.arc(bx,by,BALL,0,7);ctx.strokeStyle='rgba(47,58,51,.22)';ctx.lineWidth=1;ctx.stroke();
// Equator and one meridian turn with the model.
ctx.save();ctx.beginPath();ctx.arc(bx,by,BALL-.5,0,7);ctx.clip();
const ring=(point,alpha)=>{for(const front of [false,true]){ctx.beginPath();let pen=false;for(let i=0;i<=72;i++){const p=project(point(i/72*Math.PI*2));if((p.depth>=0)!==front){pen=false;continue;}const x=bx+p.x*BALL,y=by+p.y*BALL;pen?ctx.lineTo(x,y):ctx.moveTo(x,y);pen=true;}ctx.strokeStyle=`rgba(47,58,51,${front?alpha:alpha*.3})`;ctx.lineWidth=front?1.2:1;ctx.stroke();}};
const c=Math.cos(rotation),s=Math.sin(rotation);
ring(a=>[Math.cos(a),0,Math.sin(a)],.5);ring(a=>[Math.cos(a)*s,Math.sin(a),-Math.cos(a)*c],.26);ring(a=>[Math.cos(a)*c,Math.sin(a),Math.cos(a)*s],.26);
ctx.restore();
const directions=compassDirections(rotation);
markers=Object.entries(directions).map(([name,direction])=>{const p=project(direction);return {name,x:bx+p.x*BALL*.8,y:by+p.y*BALL*.8,depth:p.depth};}).sort((a,b)=>a.depth-b.depth);
ctx.textAlign='center';ctx.textBaseline='middle';
for(const marker of markers){const front=marker.depth>-.08,r=front?9.5:6;ctx.globalAlpha=front?1:.38;ctx.beginPath();ctx.arc(marker.x,marker.y,r,0,7);ctx.fillStyle=marker.name==='N'?north:marker.name==='top'?accent:'#ffffff';ctx.fill();ctx.strokeStyle='rgba(47,58,51,.3)';ctx.lineWidth=1;ctx.stroke();
if(front){ctx.fillStyle=marker.name==='N'||marker.name==='top'?'#ffffff':ink;ctx.font='700 10px system-ui,sans-serif';ctx.fillText(marker.name==='top'?'▲':marker.name,marker.x,marker.y+.5);}}
ctx.globalAlpha=1;
}
function release(){if(!stick.active)return;stick.active=false;stick.x=stick.y=0;if(stick.pointer!==null&&root.hasPointerCapture(stick.pointer))root.releasePointerCapture(stick.pointer);stick.pointer=null;root.classList.remove('active');onEnd();}
function place(event){const rect=root.getBoundingClientRect(),dx=event.clientX-rect.left-CENTRE,dy=event.clientY-rect.top-CENTRE,command=stickVector(dx,dy,REACH);stick.x=command.x;stick.y=command.y;const length=Math.hypot(dx,dy)||1,shift=Math.min(TRAVEL,length/REACH*TRAVEL);stick.px=dx/length*shift;stick.py=dy/length*shift;dirty=true;}
root.addEventListener('pointerdown',event=>{if(event.button!==0||stick.active)return;event.preventDefault();stick.active=true;stick.pointer=event.pointerId;stick.startX=event.clientX;stick.startY=event.clientY;stick.travelled=0;root.setPointerCapture(event.pointerId);root.classList.add('active');
// A press away from the centre steers at once; a press on the ball waits for a drag.
const rect=root.getBoundingClientRect();if(Math.hypot(event.clientX-rect.left-CENTRE,event.clientY-rect.top-CENTRE)>BALL)place(event);onStart();});
root.addEventListener('pointermove',event=>{if(!stick.active||event.pointerId!==stick.pointer)return;stick.travelled=Math.max(stick.travelled,Math.hypot(event.clientX-stick.startX,event.clientY-stick.startY));if(stick.travelled>4)place(event);});
root.addEventListener('pointerup',event=>{if(event.pointerId!==stick.pointer)return;const tap=stick.travelled<=4,rect=root.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;release();
if(tap){const hit=markers.filter(m=>m.depth>-.08&&Math.hypot(m.x-x,m.y-y)<13).pop();if(hit)onSnap(hit.name);}});
for(const type of ['pointercancel','lostpointercapture'])root.addEventListener(type,event=>{if(event.pointerId===stick.pointer)release();});
window.addEventListener('blur',release);
const keys={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
root.addEventListener('keydown',event=>{const key=keys[event.key];if(!key)return;event.preventDefault();event.stopPropagation();onStick(key[0],key[1],.12);});
return {
element:root,
get active(){return stick.active;},
setRotation(value){rotation=value;dirty=true;},
// Call every frame: applies the held stick, eases the ball home and repaints when needed.
update(dt,quaternion){
if(stick.active&&(stick.x||stick.y))onStick(stick.x,stick.y,dt);
if(!stick.active&&(stick.px||stick.py)){const k=Math.exp(-dt*16);stick.px*=k;stick.py*=k;if(Math.hypot(stick.px,stick.py)<.2)stick.px=stick.py=0;dirty=true;}
draw(quaternion);return stick.active||dirty;
}
};
}
