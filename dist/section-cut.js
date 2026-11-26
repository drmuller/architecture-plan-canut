import * as THREE from './vendor/three.module.js';
// A section cut is one clipping plane. Its orientation is taken from the camera once,
// when the cut is created; afterwards it only slides forward or backward along that
// direction until it is removed.

// "Upright" cuts stand vertically (or lie flat when the camera looks steeply down),
// which is how sections and plans are drawn. Walls are axis-aligned, so headings
// within a few degrees of them snap square.
export function uprightDirection(direction,snapDegrees=8){
const d=direction.clone().normalize();
if(Math.abs(d.y)>.866)return new THREE.Vector3(0,Math.sign(d.y),0);
let angle=Math.atan2(d.z,d.x);const quarter=Math.PI/2,nearest=Math.round(angle/quarter)*quarter;
if(Math.abs(angle-nearest)<=THREE.MathUtils.degToRad(snapDegrees))angle=nearest;
const clean=v=>Math.abs(v)<1e-12?0:v;
return new THREE.Vector3(clean(Math.cos(angle)),0,clean(Math.sin(angle)));
}
// Distances along the normal at which the plane enters and leaves the model.
export function cutRange(normal,bounds){let min=Infinity,max=-Infinity;const p=new THREE.Vector3();
for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const d=normal.dot(p.set(x,y,z));min=Math.min(min,d);max=Math.max(max,d);}
return {min,max};}
// Outline of the plane inside the model's bounding box, ordered around its centre.
export function cutOutline(normal,offset,bounds){
const {min,max}=bounds,corners=[];for(const x of [min.x,max.x])for(const y of [min.y,max.y])for(const z of [min.z,max.z])corners.push(new THREE.Vector3(x,y,z));
const edges=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]],points=[];
for(const [a,b] of edges){const da=normal.dot(corners[a])-offset,db=normal.dot(corners[b])-offset;if(da===db)continue;const t=da/(da-db);if(t>=0&&t<=1){const point=corners[a].clone().lerp(corners[b],t);if(!points.some(q=>q.distanceToSquared(point)<1e-10))points.push(point);}}
if(points.length<3)return [];
const centre=points.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).divideScalar(points.length);
const u=new THREE.Vector3().crossVectors(normal,Math.abs(normal.y)>.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0)).normalize(),v=new THREE.Vector3().crossVectors(normal,u);
const angle=p=>Math.atan2(p.clone().sub(centre).dot(v),p.clone().sub(centre).dot(u));
return points.sort((a,b)=>angle(a)-angle(b));
}

export function createSectionCut(bounds,{margin=.05,planHeight=1.2}={}){
const plane=new THREE.Plane(new THREE.Vector3(0,0,-1),0),created=new THREE.Vector3(0,0,-1),normal=new THREE.Vector3(0,0,-1);
const cut={active:false,upright:true,offset:0,range:{min:0,max:0},plane,normal,
get horizontal(){return Math.abs(normal.y)>.99;},
// Depth into the model from the face nearest the original viewpoint.
get depth(){return cut.offset-cut.range.min;},get length(){return cut.range.max-cut.range.min;},
create(direction,focus,upright=cut.upright){created.copy(direction).normalize();cut.upright=upright;cut.active=true;orient();
// Begin at what the camera is looking at, but never more than about a third of the way in.
let start=cut.horizontal?(normal.y<0?-planHeight:planHeight):Math.min(normal.dot(focus),cut.range.min+cut.length*.36);
// Start inside the model so something is visibly cut straight away.
const inset=Math.min(.6,cut.length*.2);start=THREE.MathUtils.clamp(start,cut.range.min+inset,cut.range.max-inset);
return cut.setOffset(start);},
setUpright(upright){if(!cut.active){cut.upright=upright;return cut;}
// Keep the cut passing through the same point of the model while it re-orients.
const through=cut.centre();cut.upright=upright;orient();return cut.setOffset(normal.dot(through));},
setOffset(value){cut.offset=THREE.MathUtils.clamp(value,cut.range.min+margin,cut.range.max-margin);plane.normal.copy(normal);plane.constant=-cut.offset;return cut;},
move(delta){return cut.setOffset(cut.offset+delta);},
flip(){created.negate();const offset=-cut.offset;orient();return cut.setOffset(offset);},
remove(){cut.active=false;return cut;},
outline(){return cut.active?cutOutline(normal,cut.offset,bounds):[];},
centre(){const points=cutOutline(normal,cut.offset,bounds);return points.length?points.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).divideScalar(points.length):normal.clone().multiplyScalar(cut.offset);}
};
function orient(){normal.copy(cut.upright?uprightDirection(created):created);cut.range=cutRange(normal,bounds);}
return cut;
}
// Metres of plane travel for a pointer drag, using where the normal points on screen.
// When the plane faces the viewer squarely the normal has no screen direction, so a
// vertical drag is used instead: up pushes the cut away.
export function dragToTravel(dx,dy,screenNormal,pixelsPerMetre){
const length=Math.hypot(screenNormal.x,screenNormal.y);
if(length<12)return -dy/Math.max(20,pixelsPerMetre);
return (dx*screenNormal.x+dy*screenNormal.y)/(length*length);
}
