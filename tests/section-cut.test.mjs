import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {uprightDirection,cutRange,cutOutline,createSectionCut,dragToTravel} from '../dist/section-cut.js';
const near=(a,b,eps=1e-9)=>Math.abs(a-b)<eps;
// Orientation comes from the camera: upright cuts follow its heading, steep views give a plan cut.
const oblique=uprightDirection(new THREE.Vector3(-12,-16,-16.8));
assert.equal(oblique.y,0);assert.ok(near(oblique.length(),1));assert.ok(near(Math.atan2(oblique.z,oblique.x),Math.atan2(-16.8,-12)),'heading is kept');
assert.deepEqual(uprightDirection(new THREE.Vector3(.05,-1,.02)).toArray(),[0,-1,0]);
assert.deepEqual(uprightDirection(new THREE.Vector3(.99,-.3,.08)).toArray(),[1,0,0],'headings within a few degrees of the walls snap square');
assert.notDeepEqual(uprightDirection(new THREE.Vector3(.9,0,.3)).toArray(),[1,0,0]);
const bounds=new THREE.Box3(new THREE.Vector3(0,0,0),new THREE.Vector3(14,4,9));
assert.deepEqual(cutRange(new THREE.Vector3(1,0,0),bounds),{min:0,max:14});assert.deepEqual(cutRange(new THREE.Vector3(0,0,-1),bounds),{min:-9,max:0});
const cut=createSectionCut(bounds);assert.equal(cut.active,false);assert.deepEqual(cut.outline(),[]);
// Created facing the camera…
const camera=new THREE.Vector3(0,-.4,-1).normalize();cut.create(camera,new THREE.Vector3(7,0,7.5));
assert.equal(cut.active,true);assert.deepEqual(cut.normal.toArray(),[0,0,-1]);assert.ok(near(cut.offset,-7.5));assert.ok(near(cut.depth,1.5));assert.ok(near(cut.length,9));
// …what lies between the camera and the plane is removed, the rest is kept.
assert.ok(cut.plane.distanceToPoint(new THREE.Vector3(5,1,8.5))<0);assert.ok(cut.plane.distanceToPoint(new THREE.Vector3(5,1,3))>0);
// It then only slides along that direction, whatever the camera does afterwards.
camera.set(1,0,0);cut.move(2);assert.deepEqual(cut.normal.toArray(),[0,0,-1]);assert.ok(near(cut.depth,3.5));
cut.move(-1);assert.ok(near(cut.depth,2.5));
cut.move(100);assert.ok(near(cut.depth,9-.05),'stops just inside the far face');cut.move(-100);assert.ok(near(cut.depth,.05),'stops just inside the near face');
// A fresh cut never starts deeper than about a third of the model.
cut.create(new THREE.Vector3(0,0,-1),new THREE.Vector3(7,0,1));assert.ok(cut.depth<=9*.36+1e-9);
// The outline lies on the plane, inside the model.
cut.setOffset(-4);const outline=cut.outline();assert.equal(outline.length,4);for(const p of outline){assert.ok(near(p.z,4));assert.ok(bounds.containsPoint(p));}
assert.ok(near(cut.centre().x,7)&&near(cut.centre().y,2)&&near(cut.centre().z,4));
assert.equal(cutOutline(new THREE.Vector3(1,1,1).normalize(),15/Math.sqrt(3),new THREE.Box3(new THREE.Vector3(0,0,0),new THREE.Vector3(10,10,10))).length,6,'an oblique plane through the middle of a cube crosses six edges');
// Flipping shows the other side of the same plane.
const kept=new THREE.Vector3(5,1,2);assert.ok(cut.plane.distanceToPoint(kept)>0);cut.flip();assert.ok(cut.plane.distanceToPoint(kept)<0);assert.ok(near(cut.centre().z,4));cut.flip();
// Exact camera tilt, and back to upright, pivot about the same point of the model.
const tilted=createSectionCut(bounds);tilted.create(new THREE.Vector3(-1,-1,0).normalize(),new THREE.Vector3(10,0,4.5));assert.deepEqual(tilted.normal.toArray(),[-1,0,0]);
const through=tilted.centre();tilted.setUpright(false);assert.ok(near(tilted.normal.y,-Math.SQRT1_2));assert.ok(Math.abs(tilted.plane.distanceToPoint(through))<1e-9);
tilted.setUpright(true);assert.deepEqual(tilted.normal.toArray(),[-1,0,0]);
// Plan cuts start at a useful height and move down when pushed forward.
const plan=createSectionCut(bounds);plan.create(new THREE.Vector3(0,-1,0),new THREE.Vector3(7,0,4));assert.equal(plan.horizontal,true);assert.ok(near(plan.offset,-1.2));
assert.ok(plan.plane.distanceToPoint(new THREE.Vector3(1,2,1))<0&&plan.plane.distanceToPoint(new THREE.Vector3(1,1,1))>0);plan.move(.5);assert.ok(plan.plane.distanceToPoint(new THREE.Vector3(1,1,1))<0);
// Removing switches it off; creating again starts afresh.
cut.remove();assert.equal(cut.active,false);assert.deepEqual(cut.outline(),[]);
// Drags follow the normal's direction on screen; a plane facing the viewer uses vertical drags.
assert.ok(near(dragToTravel(50,0,{x:100,y:0},80),.5));assert.ok(near(dragToTravel(0,-30,{x:0,y:-60},80),.5));assert.ok(near(dragToTravel(0,50,{x:100,y:0},80),0));
assert.ok(near(dragToTravel(0,-40,{x:2,y:1},80),.5));
console.log('PASS: camera-derived orientation, forward/backward travel within the model, outline, flip, upright toggle, plan cuts and handle drags');
