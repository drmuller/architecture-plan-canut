import assert from 'node:assert/strict';
import {introStage,introCamera,introCaption,INTRO_SECONDS,SITE} from '../dist/building-intro.js';
const near=(a,b,eps=1e-6)=>Math.abs(a-b)<=eps,overview={position:[19,16,21],target:[7,0,4.2]},distance=p=>Math.hypot(...p.position.map((v,i)=>v-p.target[i]));
// The apartment is on the second of five levels (ground floor = 0).
assert.equal(SITE.level,2);assert.equal(SITE.levels,5);assert.ok(SITE.level*SITE.storey>8&&SITE.level*SITE.storey<9.5,'second floor is about 8.6 m above the street');
// Stages run in order: approach, highlight, split, clear, settle.
const start=introStage(0),end=introStage(INTRO_SECONDS);
assert.deepEqual({...start,done:undefined},{approach:0,glow:0,split:0,sink:0,clear:0,settle:0,done:undefined});assert.equal(start.done,false);
assert.equal(end.done,true);for(const key of ['approach','split','sink','clear','settle'])assert.equal(end[key],1,key);assert.equal(end.glow,0,'markers are gone at the end');
assert.deepEqual(introStage(-5),{...start});assert.deepEqual({...introStage(99),done:true},end);
let previous=start,glowPeak=0;
for(let t=0;t<=INTRO_SECONDS;t+=.05){const s=introStage(t);for(const key of ['approach','split','sink','clear','settle']){assert.ok(s[key]>=previous[key]-1e-9,key+' never runs backwards');assert.ok(s[key]>=0&&s[key]<=1);}
assert.ok(s.split>=s.clear,'floors separate before they leave');assert.ok(s.approach>=s.split,'the camera arrives before anything moves');assert.ok(s.clear>=s.settle);if(s.glow>0)assert.equal(s.clear,0,'the apartment is pointed out while the building is whole');glowPeak=Math.max(glowPeak,s.glow);previous=s;}
assert.ok(glowPeak>.95);assert.ok(introStage(4.4).glow>.9&&introStage(4.4).split===0);
// The camera starts far out over the neighbourhood and ends exactly on the usual overview.
const first=introCamera(0,overview),last=introCamera(INTRO_SECONDS,overview);
assert.ok(distance(first)>200);assert.ok(first.position[1]>100,'an aerial view');
for(let i=0;i<3;i++){assert.ok(near(last.position[i],overview.position[i],1e-9));assert.ok(near(last.target[i],overview.target[i],1e-9));}
assert.deepEqual(introCamera(50,overview),last);assert.deepEqual(introCamera(-1,overview),first);
// It only ever closes in, smoothly, and never dips under the street.
let was=first,step=0;
for(let t=.05;t<=INTRO_SECONDS;t+=.05){const pose=introCamera(t,overview);assert.ok(distance(pose)<=distance(was)+.6,'closing in at '+t.toFixed(2));assert.ok(pose.position[1]>pose.target[1]+5);for(const v of [...pose.position,...pose.target])assert.ok(Number.isFinite(v));step=Math.max(step,Math.hypot(...pose.position.map((v,i)=>v-was.position[i])));was=pose;}
assert.ok(step<9,'no jump between frames: '+step.toFixed(2));
// On a narrow screen the whole path is pulled back with the overview.
const narrow={position:overview.position.map((v,i)=>overview.target[i]+(v-overview.target[i])*2.5),target:overview.target};
assert.ok(distance(introCamera(4,narrow,2.5))>distance(introCamera(4,overview))*2);assert.ok(near(distance(introCamera(INTRO_SECONDS,narrow,2.5)),distance(narrow),1e-9));
assert.match(introCaption(0),/Croix-Rousse/);assert.match(introCaption(4),/Second floor/);assert.match(introCaption(INTRO_SECONDS),/apartment/i);
console.log('PASS: intro stages in order, apartment highlighted on the whole building, smooth camera from the neighbourhood to the overview');
