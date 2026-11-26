// Light for a given position of the sun. Pure numbers, no rendering.
// Colours are 0..1 triplets. In the model +z is the way the window façade looks and
// +x is to its left when seen from the street (east, for a south-facing façade).
const STOPS=[
{height:-14,sun:[.5,.6,1],power:.16,top:[.02,.03,.08],horizon:[.05,.07,.14],ambient:.15,lamps:1,exposure:1.5},
{height:-6,sun:[.6,.64,.95],power:.13,top:[.08,.12,.27],horizon:[.36,.3,.36],ambient:.25,lamps:1,exposure:1.4},
{height:-1,sun:[1,.52,.32],power:.12,top:[.24,.33,.58],horizon:[.95,.6,.42],ambient:.42,lamps:.8,exposure:1.25},
{height:2,sun:[1,.58,.32],power:1.3,top:[.36,.46,.72],horizon:[1,.74,.52],ambient:.56,lamps:.4,exposure:1.15},
{height:8,sun:[1,.77,.54],power:2.5,top:[.42,.56,.84],horizon:[1,.86,.7],ambient:.72,lamps:.08,exposure:1.08},
{height:18,sun:[1,.9,.76],power:3.1,top:[.38,.58,.9],horizon:[.93,.93,.95],ambient:.9,lamps:0,exposure:1.02},
{height:40,sun:[1,.97,.9],power:3.6,top:[.33,.56,.92],horizon:[.88,.93,.99],ambient:1,lamps:0,exposure:1}
];
const MOON=[-.45,.62,.64].map(v=>v/Math.hypot(.45,.62,.64));
const lerp=(a,b,t)=>a+(b-a)*t,mix=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t)),DEGREES=180/Math.PI;
// Model-space direction of a compass bearing (radians) for a façade bearing in degrees.
export function compassToModel(bearing,facadeBearing){const relative=bearing-facadeBearing/DEGREES;return [-Math.sin(relative),Math.cos(relative)];}
// sun: {azimuth, elevation} in radians, azimuth clockwise from north.
export function daylightFor(sun,facadeBearing=180){
const height=Math.max(STOPS[0].height,Math.min(STOPS[STOPS.length-1].height,sun.elevation*DEGREES));let i=1;while(i<STOPS.length-1&&STOPS[i].height<height)i++;
const a=STOPS[i-1],b=STOPS[i],t=(height-a.height)/(b.height-a.height),s=t*t*(3-2*t),night=height<-1;
// After dark a faint moon stands in front of the windows; a rising sun never rakes below 2°.
const lift=Math.max(sun.elevation,.035),[x,z]=compassToModel(sun.azimuth,facadeBearing),flat=Math.cos(lift);
return {
night,sunHeight:sun.elevation*DEGREES,
sunDirection:night?MOON:[x*flat,Math.sin(lift),z*flat],
sunColor:mix(a.sun,b.sun,s),sunPower:lerp(a.power,b.power,s),
skyTop:mix(a.top,b.top,s),skyHorizon:mix(a.horizon,b.horizon,s),
ambient:lerp(a.ambient,b.ambient,s),lamps:lerp(a.lamps,b.lamps,s),exposure:lerp(a.exposure,b.exposure,s)
};
}
export function formatTime(minutes){const total=Math.round(minutes)%1440,h=Math.floor(total/60);return String(h).padStart(2,'0')+':'+String(total-h*60).padStart(2,'0');}
const POINTS=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
export function compassPoint(degrees){return POINTS[Math.round(((degrees%360)+360)%360/22.5)%16];}
