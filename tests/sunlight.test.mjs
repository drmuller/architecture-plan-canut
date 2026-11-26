import assert from 'node:assert/strict';
import {sunPosition,sunTimes,toInstant,localTime,civilOffset,isDate} from '../dist/solar.js';
import {daylightFor,compassToModel,formatTime,compassPoint} from '../dist/daylight.js';
import {compassDirections} from '../dist/view-joystick.js';
import {SITE} from '../dist/building-intro.js';
const DEG=180/Math.PI,near=(a,b,eps)=>Math.abs(a-b)<=eps,{latitude,longitude}=SITE;
const at=(date,time)=>{const [h,m]=time.split(':').map(Number),sun=sunPosition(toInstant(date,h*60+m),latitude,longitude);return {height:sun.elevation*DEG,bearing:sun.azimuth*DEG,sun};};
// The site is Lyon; coordinates are deliberately no finer than the neighbourhood.
assert.ok(near(latitude,45.77,.03)&&near(longitude,4.84,.03));assert.equal(String(latitude).split('.')[1].length<=2,true);
// Noon heights through the year: 90° - latitude ± the tilt of the Earth.
assert.ok(near(at('2026-06-21','13:44').height,90-latitude+23.44,.15));assert.ok(near(at('2026-12-21','12:40').height,90-latitude-23.44,.15));assert.ok(near(at('2026-03-20','12:48').height,90-latitude,.3));
for(const date of ['2026-06-21','2026-12-21','2026-03-20'])assert.ok(near(at(date,formatTime(sunTimes(date,latitude,longitude).noon)).bearing,180,1.2),'the sun is due south at solar noon');
// Sunrise and sunset in local time, against published almanac values for Lyon (± 3 min).
const minutes=text=>{const [h,m]=text.split(':').map(Number);return h*60+m;};
for(const [date,rise,set] of [['2026-06-21','05:51','21:34'],['2026-12-21','08:19','16:59'],['2026-03-20','06:45','18:53'],['2026-11-26','07:55','17:00']]){const t=sunTimes(date,latitude,longitude);assert.ok(near(t.sunrise,minutes(rise),3),date+' sunrise '+formatTime(t.sunrise));assert.ok(near(t.sunset,minutes(set),3),date+' sunset '+formatTime(t.sunset));assert.ok(t.sunrise<t.noon&&t.noon<t.sunset);}
// It rises in the north-east in summer and the south-east in winter.
assert.ok(at('2026-06-21','06:00').bearing<60);assert.ok(at('2026-12-21','08:30').bearing>120);assert.ok(at('2026-06-21','21:20').bearing>300);
assert.ok(at('2026-11-26','07:27').height<0,'still dark before sunrise');assert.ok(at('2026-06-21','02:00').height<-15);
// Civil time: UTC+1 in winter, UTC+2 between the last Sundays of March and October.
assert.equal(civilOffset(Date.UTC(2026,0,15)),1);assert.equal(civilOffset(Date.UTC(2026,6,15)),2);
assert.equal(civilOffset(Date.UTC(2026,2,29,0,59)),1);assert.equal(civilOffset(Date.UTC(2026,2,29,1,0)),2);assert.equal(civilOffset(Date.UTC(2026,9,25,0,59)),2);assert.equal(civilOffset(Date.UTC(2026,9,25,1,0)),1);
assert.equal(toInstant('2026-11-26',447),Date.UTC(2026,10,26,6,27));assert.equal(toInstant('2026-06-21',600),Date.UTC(2026,5,21,8,0));
assert.deepEqual(localTime(Date.UTC(2026,10,26,6,27)),{date:'2026-11-26',minutes:447});assert.deepEqual(localTime(Date.UTC(2026,5,30,22,30)),{date:'2026-07-01',minutes:30});
for(const [date,m] of [['2026-01-01',0],['2026-07-14',1439],['2028-02-29',720]])assert.deepEqual(localTime(toInstant(date,m)),{date,minutes:m});
assert.ok(isDate('2028-02-29'));for(const bad of ['2026-02-30','2026-13-01','26-1-1','today',null,20260101])assert.equal(isDate(bad),false);
// Model axes: +z is where the window façade looks, +x is to its left seen from outside.
const close=(v,x,z)=>assert.ok(near(v[0],x,1e-9)&&near(v[1],z,1e-9),String(v));
close(compassToModel(Math.PI,180),0,1);close(compassToModel(Math.PI/2,180),1,0);close(compassToModel(3*Math.PI/2,180),-1,0);close(compassToModel(0,180),0,-1);
close(compassToModel(Math.PI/2,90),0,1);close(compassToModel(172/DEG,172),0,1);
// The camera ball's compass agrees with the sun for the building's own bearing.
const ball=compassDirections(Math.PI-SITE.facadeBearing/DEG);for(const [name,bearing] of [['N',0],['E',90],['S',180],['W',270]]){const [x,z]=compassToModel(bearing/DEG,SITE.facadeBearing);assert.ok(near(ball[name][0],x,1e-9)&&near(ball[name][2],z,1e-9),name);}
// The façade looks a little east of south, so it has the sun from mid-morning.
assert.ok(SITE.facadeBearing>150&&SITE.facadeBearing<195);
const morning=daylightFor(at('2026-06-21','10:30').sun,SITE.facadeBearing),noon=daylightFor(at('2026-06-21','13:44').sun,SITE.facadeBearing),dusk=daylightFor(at('2026-06-21','21:50').sun,SITE.facadeBearing),night=daylightFor(at('2026-12-21','23:00').sun,SITE.facadeBearing),winter=daylightFor(at('2026-12-21','12:40').sun,SITE.facadeBearing);
for(const light of [morning,noon,dusk,night,winter]){assert.ok(near(Math.hypot(...light.sunDirection),1,1e-9));assert.ok(light.sunDirection[1]>0,'light always comes from above');assert.ok(light.lamps>=0&&light.lamps<=1);for(const colour of [light.sunColor,light.skyTop,light.skyHorizon])for(const channel of colour)assert.ok(channel>=0&&channel<=1);}
assert.ok(morning.sunDirection[0]>.3&&morning.sunDirection[2]>0,'June morning sun comes from the east side and in front');assert.ok(noon.sunDirection[2]>.3&&Math.abs(noon.sunDirection[0])<.2);
assert.ok(noon.sunDirection[1]>winter.sunDirection[1]+.4,'high in summer, low in winter');assert.ok(winter.sunDirection[2]>.85,'the low winter sun shines deep into the rooms');
assert.equal(noon.lamps,0);assert.equal(night.lamps,1);assert.equal(night.night,true);assert.equal(noon.night,false);assert.ok(dusk.lamps>.5);
assert.ok(noon.sunPower>night.sunPower*10);assert.ok(night.exposure>noon.exposure);assert.ok(noon.skyTop[2]>night.skyTop[2]*5);assert.ok(near(noon.sunHeight,67.66,.2));
assert.equal(formatTime(930),'15:30');assert.equal(formatTime(7),'00:07');assert.equal(formatTime(1439.6),'00:00');
assert.equal(compassPoint(0),'N');assert.equal(compassPoint(172),'S');assert.equal(compassPoint(112),'ESE');assert.equal(compassPoint(-90),'W');assert.equal(compassPoint(359),'N');
console.log('PASS: solar position for Lyon through the year, civil time, façade bearing, daylight from dawn to night');
