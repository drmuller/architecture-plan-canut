import * as THREE from './vendor/three.module.js';
// Procedural finishes drawn once into canvases. Every map tiles seamlessly and covers a
// known size in metres, so box-projected surfaces show true-to-scale planks and grain.
const makeRandom=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
function makeCanvas(size){const c=document.createElement('canvas');c.width=c.height=size;return c;}
function toTexture(canvas,srgb=true){const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
// Display-space channels straight from the hex code (THREE.Color would linearise them).
function rgb(hex){const n=parseInt(hex.slice(1),16);return [(n>>16)&255,(n>>8)&255,n&255];}
function shade([r,g,b],lightness=1,warmth=0,alpha=1){const f=v=>Math.max(0,Math.min(255,Math.round(v)));return `rgba(${f(r*lightness+warmth*10)},${f(g*lightness+warmth*3)},${f(b*lightness-warmth*8)},${alpha})`;}
// A wavy vertical line that closes on itself at the top and bottom edges.
function streak(ctx,size,x,amplitude,waves,phase,from=0,to=size){
for(const offset of x<amplitude+4?[0,size]:x>size-amplitude-4?[0,-size]:[0]){
ctx.beginPath();for(let i=0;i<=24;i++){const y=from+(to-from)*i/24,px=x+offset+Math.sin(y/size*Math.PI*2*waves+phase)*amplitude;i?ctx.lineTo(px,y):ctx.moveTo(px,y);}ctx.stroke();}
}
function blotches(ctx,size,random,count,radius,colours){
for(let i=0;i<count;i++){const x=random()*size,y=random()*size,r=radius*(.5+random());
for(const dx of [-size,0,size])for(const dy of [-size,0,size]){if(x+dx<-r||x+dx>size+r||y+dy<-r||y+dy>size+r)continue;const g=ctx.createRadialGradient(x+dx,y+dy,0,x+dx,y+dy,r);const colour=colours[i%colours.length];g.addColorStop(0,colour);g.addColorStop(1,colour.replace(/[\d.]+\)$/,'0)'));ctx.fillStyle=g;ctx.fillRect(x+dx-r,y+dy-r,r*2,r*2);}}
}

// Strip parquet: 12.5 cm boards of random lengths, laid along the texture's V axis.
export const PLANK_TILE=2;// metres covered by one repeat
const PLANK_COLUMNS=16;
function plankLayout(size){const random=makeRandom(8123),columns=[];
for(let i=0;i<PLANK_COLUMNS;i++){const boards=[];let y=random()*size*.6;const start=y;while(y<start+size-size*.2){const length=size*(.3+random()*.45);boards.push({y,length:Math.min(length,start+size-y)});y+=length;}if(start+size-y>0)boards.push({y,length:start+size-y});columns.push(boards.map(b=>({...b,tone:.9+random()*.2,warmth:random()*2-1,seed:Math.floor(random()*1e6)})));}
return columns;}
function eachBoard(size,draw){const width=size/PLANK_COLUMNS;plankLayout(size).forEach((boards,i)=>{for(const board of boards)for(const wrap of [0,-size]){const y=board.y+wrap;if(y+board.length<0||y>size)continue;draw(i*width,y,width,board.length,board);}});}
export function woodPlanks(colour){const size=1024,canvas=makeCanvas(size),ctx=canvas.getContext('2d'),base=rgb(colour);
eachBoard(size,(x,y,w,h,board)=>{ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.fillStyle=shade(base,board.tone,board.warmth);ctx.fillRect(x,y,w,h);
const random=makeRandom(board.seed);
// Broad cathedral figure, then fine pores.
for(let i=0;i<5;i++){ctx.strokeStyle=shade(base,.72+random()*.2,0,.10+random()*.10);ctx.lineWidth=2+random()*5;streak(ctx,size,x+random()*w,2+random()*5,1+Math.floor(random()*2),random()*6,y,y+h);}
for(let i=0;i<26;i++){ctx.strokeStyle=random()>.25?shade(base,.6,0,.05+random()*.12):shade(base,1.25,0,.05+random()*.08);ctx.lineWidth=.4+random()*.9;streak(ctx,size,x+random()*w,.6+random()*2,1+Math.floor(random()*3),random()*6,y,y+h);}
if(random()>.72){const kx=x+w*(.25+random()*.5),ky=y+h*(.15+random()*.7),g=ctx.createRadialGradient(kx,ky,0,kx,ky,5+random()*5);g.addColorStop(0,shade(base,.42,0,.75));g.addColorStop(1,shade(base,.6,0,0));ctx.fillStyle=g;ctx.fillRect(kx-12,ky-12,24,24);}
ctx.restore();
ctx.fillStyle=shade(base,.38,0,.55);ctx.fillRect(x,y,1,h);ctx.fillRect(x,y,w,1);ctx.fillStyle=shade(base,1.25,0,.10);ctx.fillRect(x+1,y,1,h);});
return toTexture(canvas);}
function plankRelief(){const size=1024,canvas=makeCanvas(size),ctx=canvas.getContext('2d');ctx.fillStyle='#868686';ctx.fillRect(0,0,size,size);
eachBoard(size,(x,y,w,h,board)=>{const level=Math.round(126+(board.tone-1)*60);ctx.fillStyle=`rgb(${level},${level},${level})`;ctx.fillRect(x,y,w,h);const random=makeRandom(board.seed+7);ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();for(let i=0;i<14;i++){ctx.strokeStyle=`rgba(40,40,40,${.05+random()*.10})`;ctx.lineWidth=.6+random();streak(ctx,size,x+random()*w,.6+random()*2,1+Math.floor(random()*3),random()*6,y,y+h);}ctx.restore();
// Micro-bevelled edges read as dark grooves.
ctx.fillStyle='rgba(10,10,10,.85)';ctx.fillRect(x,y,1.5,h);ctx.fillRect(x,y,w,1.5);ctx.fillStyle='rgba(40,40,40,.4)';ctx.fillRect(x+1.5,y,1.5,h);ctx.fillRect(x+w-1.5,y,1.5,h);});
return toTexture(canvas,false);}

// Continuous veneer for joinery, or rougher sawn timber for the roof structure.
export function woodGrain(colour,rough=false){const size=512,canvas=makeCanvas(size),ctx=canvas.getContext('2d'),base=rgb(colour),random=makeRandom(rough?4411:1267);
ctx.fillStyle=colour;ctx.fillRect(0,0,size,size);
for(let i=0;i<14;i++){ctx.strokeStyle=shade(base,i%2?1.12:.84,random()-.5,.10+random()*.10);ctx.lineWidth=14+random()*30;streak(ctx,size,random()*size,3+random()*6,1,random()*6);}
for(let i=0;i<(rough?520:380);i++){const dark=random()>.3;ctx.strokeStyle=dark?shade(base,rough?.45:.58,0,.05+random()*(rough?.22:.13)):shade(base,1.3,0,.04+random()*.08);ctx.lineWidth=.4+random()*(rough?1.6:.9);streak(ctx,size,random()*size,.8+random()*3,1+Math.floor(random()*2),random()*6);}
if(rough)for(let i=0;i<14;i++){ctx.strokeStyle=shade(base,.3,0,.35+random()*.3);ctx.lineWidth=.8+random()*1.4;const y=random()*size,length=30+random()*120;streak(ctx,size,random()*size,1.2,1,random()*6,y,Math.min(size,y+length));}
return toTexture(canvas);}
function grainRelief(rough){const size=512,canvas=makeCanvas(size),ctx=canvas.getContext('2d'),random=makeRandom(rough?991:377);ctx.fillStyle='#808080';ctx.fillRect(0,0,size,size);
for(let i=0;i<(rough?520:300);i++){const v=random()>.5?235:20;ctx.strokeStyle=`rgba(${v},${v},${v},${.04+random()*(rough?.22:.10)})`;ctx.lineWidth=.5+random()*(rough?2:1);streak(ctx,size,random()*size,.8+random()*3,1+Math.floor(random()*2),random()*6);}
return toTexture(canvas,false);}

// Honed stone: soft clouds with a fine speckle.
export function stoneMap(colour){const size=512,canvas=makeCanvas(size),ctx=canvas.getContext('2d'),base=rgb(colour),random=makeRandom(5521);ctx.fillStyle=colour;ctx.fillRect(0,0,size,size);
blotches(ctx,size,random,26,90,[shade(base,1.12,0,.16),shade(base,.86,0,.14),shade(base,1.04,.6,.12)]);
for(let i=0;i<5200;i++){ctx.fillStyle=random()>.5?shade(base,1.3,0,.10+random()*.12):shade(base,.6,0,.08+random()*.12);const s=.6+random()*1.8;ctx.fillRect(random()*size,random()*size,s,s);}
return toTexture(canvas);}
export function metalMap(colour){const size=512,canvas=makeCanvas(size),ctx=canvas.getContext('2d'),random=makeRandom(77);ctx.fillStyle=colour;ctx.fillRect(0,0,size,size);
for(let i=0;i<1700;i++){ctx.fillStyle=i%2?`rgba(255,255,255,${.02+random()*.05})`:`rgba(30,38,46,${.02+random()*.05})`;ctx.fillRect(random()*size,0,.4+random()*.8,size);}
return toTexture(canvas);}
function speckleRelief(seed,count,maxSize,strength){const size=512,canvas=makeCanvas(size),ctx=canvas.getContext('2d'),random=makeRandom(seed);ctx.fillStyle='#808080';ctx.fillRect(0,0,size,size);
blotches(ctx,size,random,40,60,['rgba(160,160,160,.20)','rgba(96,96,96,.20)']);
for(let i=0;i<count;i++){const v=random()>.5?255:0,s=.8+random()*maxSize;ctx.fillStyle=`rgba(${v},${v},${v},${strength*(.4+random()*.6)})`;ctx.beginPath();ctx.arc(random()*size,random()*size,s,0,7);ctx.fill();}
return toTexture(canvas,false);}

const maps=new Map(),reliefs=new Map();
// Colour map for a catalogue finish on a given kind of surface. Plain paint needs none.
export function finishMap(finish,variant){
if(finish.kind==='plain')return null;
const kind=finish.kind==='wood'?(variant==='planks'?'planks':variant==='timber'?'timber':'veneer'):finish.kind,key=kind+finish.color;
if(!maps.has(key))maps.set(key,kind==='planks'?woodPlanks(finish.color):kind==='timber'?woodGrain(finish.color,true):kind==='veneer'?woodGrain(finish.color):kind==='stone'?stoneMap(finish.color):metalMap(finish.color));
return maps.get(key);
}
// Shared relief (bump) maps; one upload serves every surface of that kind.
export function reliefMap(kind){
if(!reliefs.has(kind))reliefs.set(kind,kind==='planks'?plankRelief():kind==='timber'?grainRelief(true):kind==='veneer'?grainRelief(false):kind==='stone'?speckleRelief(31,2600,1.6,.16):kind==='plaster'?speckleRelief(912,5200,1.3,.10):null);
return reliefs.get(kind);
}
export const RELIEF_DEPTH={planks:.6,timber:1.2,veneer:.3,stone:.12,plaster:.07};
// A soft gradient sky with a hazy horizon and a matching ground, as an equirectangular map.
export function createSky(){const canvas=document.createElement('canvas');canvas.width=32;canvas.height=512;const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;
const css=c=>`rgb(${c.map(v=>Math.round(Math.max(0,Math.min(1,v))*255)).join(',')})`;
function update(top,horizon,ground){const g=ctx.createLinearGradient(0,0,0,512);g.addColorStop(0,css(top));g.addColorStop(.34,css(top.map((v,i)=>v+(horizon[i]-v)*.35)));g.addColorStop(.492,css(horizon));g.addColorStop(.508,css(ground));g.addColorStop(1,css(ground));ctx.fillStyle=g;ctx.fillRect(0,0,32,512);
// The renderer caches its cube conversion per texture; disposing makes it re-read the canvas.
texture.dispose();texture.needsUpdate=true;}
return {texture,update};}
