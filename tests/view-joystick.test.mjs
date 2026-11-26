import assert from 'node:assert/strict';
import {stickVector,orbitOffset,compassDirections} from '../dist/view-joystick.js';
import {daylightAt,formatHour,FACADES,DEFAULT_HOUR} from '../dist/daylight.js';
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
const south=compassDirections(FACADES.south);assert.deepEqual(south.S,[-0,0,1]);assert.deepEqual(south.E,[1,0,0]);assert.deepEqual(south.top,[0,1,0]);
for(const facade of Object.keys(FACADES)){const c=compassDirections(FACADES[facade]);assert.ok(near(c.N[0],-c.S[0])&&near(c.N[2],-c.S[2])&&near(c.E[0],-c.W[0])&&near(c.E[2],-c.W[2]));assert.ok(near(c.N[0]*c.E[0]+c.N[2]*c.E[2],0));
// East is always 90° clockwise from north when seen from above (x right, z towards the viewer).
assert.ok(near(c.N[0]*c.E[2]-c.N[2]*c.E[0],1));
// The window façade (+z) faces the chosen compass point.
const letter=facade[0].toUpperCase();assert.ok(near(c[letter][0],0,1e-9)&&near(c[letter][2],1),facade+' façade');}
// Daylight: the sun crosses from east to west over the façade side and lamps come on at dusk.
for(const hour of [7,9.5,13,DEFAULT_HOUR,19,21,22.5]){const light=daylightAt(hour);assert.ok(near(Math.hypot(...light.sunDirection),1,1e-9));assert.ok(light.sunDirection[1]>0);assert.ok(light.lamps>=0&&light.lamps<=1);for(const colour of [light.sunColor,light.skyTop,light.skyHorizon])for(const channel of colour)assert.ok(channel>=0&&channel<=1);}
assert.ok(daylightAt(8).sunDirection[0]>.5,'morning sun in the east');assert.ok(daylightAt(13).sunDirection[2]>.5&&Math.abs(daylightAt(13).sunDirection[0])<1e-9,'midday sun over the south façade');assert.ok(daylightAt(19).sunDirection[0]<-.5,'evening sun in the west');
assert.ok(daylightAt(13).sunDirection[1]>daylightAt(18).sunDirection[1]);
assert.equal(daylightAt(13).lamps,0);assert.equal(daylightAt(22).lamps,1);assert.ok(daylightAt(13).sunPower>daylightAt(21).sunPower*5);
assert.ok(daylightAt(13,'east').sunDirection[0]<-.5,'with an east façade the midday sun is to the right of the windows');assert.ok(daylightAt(8,'east').sunDirection[2]>.5,'and the morning sun shines straight in');
assert.deepEqual(daylightAt(3),daylightAt(7));assert.deepEqual(daylightAt(30),daylightAt(22.5));
assert.equal(formatHour(15.5),'15:30');assert.equal(formatHour(7),'07:00');assert.equal(formatHour(21.75),'21:45');
console.log('PASS: joystick dead zone and limits, orbit steps, compass orientation, sun path and evening lamps');
