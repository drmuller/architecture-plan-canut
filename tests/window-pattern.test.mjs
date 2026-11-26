import assert from 'node:assert/strict';
import fs from 'node:fs';
import {casementBars,WINDOW_SILL,WINDOW_HEAD,KITCHEN_SILL} from '../dist/window-pattern.js';
const near=(a,b,eps=1e-9)=>Math.abs(a-b)<=eps,height=WINDOW_HEAD-WINDOW_SILL;
// Sizes read from the site photograph: a panelled apron below, glazing about two metres tall.
assert.ok(WINDOW_SILL>.8&&WINDOW_SILL<1,'glazing starts at apron height, not at the floor');assert.ok(WINDOW_HEAD>2.75&&WINDOW_HEAD<3.05);assert.ok(height>1.9&&height<2.15);
assert.ok(KITCHEN_SILL>WINDOW_SILL+.1,'the kitchen window starts higher');assert.ok(KITCHEN_SILL>.885+.1,'and clears the 88.5 cm worktop');
const fullHeight=(bars,x)=>bars.posts.some(p=>near(p.x,x)&&p.from===0&&p.to===bars.rails[1].y+bars.rails[1].height/2);
// Wide windows: side light, leaf, leaf, side light in the proportion 1 : 2 : 2 : 1.
const wide=casementBars(1.7,height);assert.equal(wide.wide,true);
for(const x of [1.7/6,1.7/2,1.7*5/6])assert.ok(fullHeight(wide,x),'full-height division at '+x);
assert.equal(wide.posts.filter(p=>p.from===0).length,5,'two jambs, two mullions and the meeting stiles');
// Narrow windows: two leaves only.
const narrow=casementBars(1.2,height);assert.equal(narrow.wide,false);assert.equal(narrow.posts.filter(p=>p.from===0).length,3);assert.ok(fullHeight(narrow,.6));
for(const [bars,width] of [[wide,1.7],[narrow,1.2]]){
// Rows from the top: two of small panes, a tall pane, a shorter one.
const levels=bars.rails.map(r=>r.y).sort((a,b)=>a-b);assert.equal(levels.length,5);
const [bottom,low,grid,half,top]=levels,rows=[top-half,half-grid,grid-low,low-bottom];
assert.ok(near(rows[0],rows[1],.04),'two equal rows of small panes');assert.ok(rows[2]>rows[3]*1.3,'the tall pane is the biggest');assert.ok(rows[3]>rows[0]*1.5,'the lower pane is taller than a small one');
assert.ok(near((top-grid)/height,.28,.03));assert.ok(near(low/height,.28,.03));
// Each leaf's small panes are split in two; the bars stop at the grid.
const short=bars.posts.filter(p=>p.from>0);assert.equal(short.length,2);for(const p of short){assert.ok(near(p.from,height*.72));assert.equal(p.to,height);}
assert.ok(near(short[0].x+short[1].x,width),'mirrored about the centre');
const leaf=bars.wide?[width/6,width/2]:[0,width/2];assert.ok(near(short[0].x,(leaf[0]+leaf[1])/2),'centred on the leaf');
// Everything stays inside the opening, and the handle sits on the meeting stiles.
for(const p of bars.posts){assert.ok(p.x-p.width/2>=-1e-9&&p.x+p.width/2<=width+1e-9);assert.ok(p.from>=0&&p.to<=height&&p.width>0&&p.width<.1);}
for(const r of bars.rails){assert.ok(r.y-r.height/2>=-1e-9&&r.y+r.height/2<=height+1e-9);assert.equal(r.from,0);assert.equal(r.to,width);}
assert.equal(bars.handle.x,width/2);assert.ok(bars.handle.y>height*.3&&bars.handle.y<height*.6);
}
// The kitchen window is the same design, scaled to its shorter height.
const kitchen=casementBars(1.7,WINDOW_HEAD-KITCHEN_SILL),ratio=(WINDOW_HEAD-KITCHEN_SILL)/height;assert.equal(kitchen.wide,true);
const fractions=bars=>bars.rails.map(r=>r.y).sort((a,b)=>a-b).slice(2,4),a=fractions(kitchen),b=fractions(wide);assert.ok(near(a[0]/b[0],ratio,.01)&&near(a[1]/b[1],ratio,.01));
// The model uses these sizes for every façade window and for the kitchen.
const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
assert.match(app,/sill:WINDOW_SILL,height:WINDOW_HEAD-WINDOW_SILL,window:true/);assert.match(app,/sill:KITCHEN_SILL,height:WINDOW_HEAD-KITCHEN_SILL,window:true/);assert.match(app,/casementBars\(e-s,o\.height\)/);
console.log('PASS: window sizes from the photograph, four-light and two-leaf patterns, small upper panes, higher kitchen window');
