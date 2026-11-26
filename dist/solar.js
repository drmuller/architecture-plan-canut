// Where the sun is for a place and a moment. Pure arithmetic: no clock, no time-zone
// database. Angles are radians; azimuth is measured clockwise from north.
const RAD=Math.PI/180,DAY=86400000,HOUR=3600000;
// Low-precision solar coordinates (about 0.01°), from the Astronomical Almanac.
export function sunPosition(instant,latitude,longitude){
const d=instant/DAY-10957.5,g=(357.529+.98560028*d)*RAD,L=(280.459+.98564736*d+1.915*Math.sin(g)+.02*Math.sin(2*g))*RAD,tilt=(23.439-.00000036*d)*RAD;
const rightAscension=Math.atan2(Math.cos(tilt)*Math.sin(L),Math.cos(L)),declination=Math.asin(Math.sin(tilt)*Math.sin(L));
const hourAngle=((18.697374558+24.06570982441908*d)*15+longitude)*RAD-rightAscension,lat=latitude*RAD;
const elevation=Math.asin(Math.sin(lat)*Math.sin(declination)+Math.cos(lat)*Math.cos(declination)*Math.cos(hourAngle));
const azimuth=Math.atan2(-Math.sin(hourAngle),Math.tan(declination)*Math.cos(lat)-Math.sin(lat)*Math.cos(hourAngle));
return {elevation,azimuth:(azimuth+2*Math.PI)%(2*Math.PI)};
}
// Central European civil time: UTC+1, or UTC+2 from the last Sunday of March to the
// last Sunday of October (both changes at 01:00 UTC).
function lastSunday(year,month){const last=new Date(Date.UTC(year,month+1,0));return last.getUTCDate()-last.getUTCDay();}
export function civilOffset(instant){const year=new Date(instant).getUTCFullYear();return instant>=Date.UTC(year,2,lastSunday(year,2),1)&&instant<Date.UTC(year,9,lastSunday(year,9),1)?2:1;}
// A local calendar date ('YYYY-MM-DD') and minutes after midnight, as an instant.
export function toInstant(date,minutes){const [year,month,day]=date.split('-').map(Number),naive=Date.UTC(year,month-1,day)+minutes*60000;return naive-civilOffset(naive-HOUR)*HOUR;}
// The local date and time of an instant, wherever the viewer's own clock is set.
export function localTime(instant){const local=new Date(instant+civilOffset(instant)*HOUR);return {date:local.toISOString().slice(0,10),minutes:local.getUTCHours()*60+local.getUTCMinutes()};}
export function isDate(text){return typeof text==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(text)&&!Number.isNaN(Date.UTC(...text.split('-').map((n,i)=>Number(n)-(i===1?1:0))))&&localTime(toInstant(text,720)).date===text;}
// Sunrise, solar noon and sunset of a local date, in minutes after local midnight.
// Rise and set are null when the sun stays up or down all day.
export function sunTimes(date,latitude,longitude){
const horizon=-.833*RAD,height=minutes=>sunPosition(toInstant(date,minutes),latitude,longitude).elevation;
let sunrise=null,sunset=null,noon=0,highest=-Infinity,previous=height(0);
for(let minutes=4;minutes<=1440;minutes+=4){const now=height(minutes);if(now>highest){highest=now;noon=minutes;}
if(previous<horizon&&now>=horizon&&sunrise===null)sunrise=minutes-4+4*(horizon-previous)/(now-previous);
if(previous>=horizon&&now<horizon)sunset=minutes-4+4*(horizon-previous)/(now-previous);previous=now;}
return {sunrise,noon,sunset};
}
