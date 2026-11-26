import assert from 'node:assert/strict';
import {stickVector,orbitOffset,compassDirections} from '../dist/view-joystick.js';
const near=(a,b,eps=1e-9)=>Math.abs(a-b)<eps;
// Thumbstick: dead centre, eased response, saturation at the rim.
assert.deepEqual(stickVector(0,0,46),{x:0,y:0,amount:0});assert.equal(stickVector(3,2,46).amount,0,'small slips near the centre do nothing');
const half=stickVector(23,0,46),full=stickVector(46,0,46),beyond=stickVector(400,0,46);
assert.ok(half.x>0&&half.x<.5,'gentle near the centre');assert.ok(near(full.x,1));assert.ok(near(beyond.x,1),'never faster than full tilt');assert.equal(half.y,0);
const diagonal=stickVector(-30,30,46);assert.ok(diagonal.x<0&&diagonal.y>0&&near(diagonal.x,-diagonal.y));
// Orbit: yaw turns about the vertical, pitch stays between the poles, distance is kept.
const start={x:0,y:10,z:10},turned=orbitOffset(start,Math.PI/2,0);
assert.ok(near(turned.x,10)&&near(turned.y,10)&&Math.abs(turned.z)<1e-9);
for(const pitch of [-10,10]){const o=orbitOffset(start,.3,pitch);assert.ok(near(Math.hypot(o.x,o.y,o.z),Math.hypot(0,10,10)));assert.ok(o.y>0,'stays above the floor');}
assert.ok(orbitOffset(start,0,-10).y>14.1,'reaches the top view');assert.ok(orbitOffset(start,0,10).y<.5,'stops near the horizon');
// Compass: four horizontal points and the top, turning with the plan's orientation.
const south=compassDirections(0);assert.deepEqual(south.S,[-0,0,1]);assert.deepEqual(south.E,[1,0,0]);assert.deepEqual(south.top,[0,1,0]);
for(const rotation of [0,.3,Math.PI/2,Math.PI,-1.2]){const c=compassDirections(rotation);assert.ok(near(c.N[0],-c.S[0])&&near(c.N[2],-c.S[2])&&near(c.E[0],-c.W[0])&&near(c.E[2],-c.W[2]));assert.ok(near(c.N[0]*c.E[0]+c.N[2]*c.E[2],0));
// East is always 90° clockwise from north when seen from above (x right, z towards the viewer).
assert.ok(near(c.N[0]*c.E[2]-c.N[2]*c.E[0],1));}
console.log('PASS: joystick dead zone and limits, orbit steps and compass orientation');
