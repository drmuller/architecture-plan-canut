// Sun, sky and lamp settings for an hour of the day. Pure numbers, no rendering.
// Colours are linear-ish 0..1 triplets; angles are radians; +x is east when the
// window façade (+z) faces south.
const KEYS=[
{hour:7,sun:[1,.66,.42],power:1.5,top:[.50,.62,.84],horizon:[1,.84,.72],ambient:.62,lamps:.35,exposure:1.12},
{hour:9,sun:[1,.90,.76],power:3.1,top:[.40,.60,.90],horizon:[.92,.94,.98],ambient:.88,lamps:0,exposure:1.02},
{hour:13,sun:[1,.97,.90],power:3.6,top:[.34,.57,.92],horizon:[.88,.93,.99],ambient:1,lamps:0,exposure:1},
{hour:17,sun:[1,.91,.76],power:3.3,top:[.38,.58,.90],horizon:[.96,.92,.90],ambient:.9,lamps:0,exposure:1.02},
{hour:19.5,sun:[1,.62,.34],power:2.4,top:[.42,.50,.76],horizon:[1,.72,.50],ambient:.6,lamps:.55,exposure:1.12},
{hour:21,sun:[.95,.45,.32],power:.3,top:[.14,.19,.38],horizon:[.72,.46,.42],ambient:.30,lamps:1,exposure:1.3},
{hour:22.5,sun:[.55,.65,1],power:.18,top:[.03,.05,.12],horizon:[.09,.12,.22],ambient:.15,lamps:1,exposure:1.5}
];
export const DAY_START=KEYS[0].hour;
export const DAY_END=KEYS[KEYS.length-1].hour;
export const DEFAULT_HOUR=15.5;
export const FACADES={south:0,west:-Math.PI/2,north:Math.PI,east:Math.PI/2};
const lerp=(a,b,t)=>a+(b-a)*t,mix=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t));
export function daylightAt(hour,facade='south'){
const h=Math.max(DAY_START,Math.min(DAY_END,hour));let i=1;while(i<KEYS.length-1&&KEYS[i].hour<h)i++;
const a=KEYS[i-1],b=KEYS[i],t=(h-a.hour)/(b.hour-a.hour),s=t*t*(3-2*t);
// The sun rises in the east at 6 h, culminates at 13 h and sets in the west at 20 h.
const day=Math.max(0,Math.min(1,(h-6)/14)),elevation=Math.max(.11,Math.sin(day*Math.PI)*1.0),azimuth=day*Math.PI+(FACADES[facade]??0);
const flat=Math.cos(elevation);
return {
hour:h,
sunDirection:[Math.cos(azimuth)*flat,Math.sin(elevation),Math.sin(azimuth)*flat],
sunColor:mix(a.sun,b.sun,s),sunPower:lerp(a.power,b.power,s),
skyTop:mix(a.top,b.top,s),skyHorizon:mix(a.horizon,b.horizon,s),
ambient:lerp(a.ambient,b.ambient,s),lamps:lerp(a.lamps,b.lamps,s),exposure:lerp(a.exposure,b.exposure,s)
};
}
export function formatHour(hour){const h=Math.floor(hour),m=Math.round((hour-h)*60);return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');}
