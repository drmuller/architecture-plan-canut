// The apartment's timber casements, read from a photograph of the rooms during the
// works. Glazing starts about 0.90 m above the floor and ends about 2.90 m up. Each
// window has two opening leaves with a grid of small panes at the top, a tall pane and
// a shorter one below; the wide windows add a fixed side light at each end.
// The kitchen window has the same design but starts higher, above the worktop.
export const WINDOW_SILL=.9;
export const WINDOW_HEAD=2.9;
export const KITCHEN_SILL=1.1;
const FRAME=.06,STILE=.075,MULLION=.05,RAIL=.04,BAR=.028;
// Members of one window, in metres from the opening's left edge and from its bottom.
// posts are vertical ({x, width, from, to}); rails are horizontal ({y, height, from, to}).
export function casementBars(width,height){
const wide=width>=1.5,side=wide?width/6:0,grid=height*.28,lower=height*.28,middle=width/2;
const posts=[{x:FRAME/2,width:FRAME,from:0,to:height},{x:width-FRAME/2,width:FRAME,from:0,to:height},{x:middle,width:STILE,from:0,to:height}];
if(wide)posts.push({x:side,width:MULLION,from:0,to:height},{x:width-side,width:MULLION,from:0,to:height});
// Each leaf's upper panes are split once more; the side lights are a single column.
for(const x of [(side+middle)/2,(middle+width-side)/2])posts.push({x,width:BAR,from:height-grid,to:height});
const rails=[{y:FRAME/2,height:FRAME,from:0,to:width},{y:height-FRAME/2,height:FRAME,from:0,to:width},{y:lower,height:RAIL,from:0,to:width},{y:height-grid,height:BAR,from:0,to:width},{y:height-grid/2,height:BAR,from:0,to:width}];
return {wide,posts,rails,handle:{x:middle,y:height*.44}};
}
