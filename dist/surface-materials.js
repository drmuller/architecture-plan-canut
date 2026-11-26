import * as THREE from './vendor/three.module.js';
// Tile dimensions are metres. Mapping uses world positions, never stretched mesh UVs.
export const TILE_SIZE=.05;
export const GROUT_SIZE=.002;
export function configureTiles(material,axis){
material.onBeforeCompile=shader=>{
shader.vertexShader='varying vec3 vTileWorld;\n'+shader.vertexShader;
shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvTileWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
shader.fragmentShader='varying vec3 vTileWorld;\nfloat tileMask=1.0;\n'+shader.fragmentShader;
const coordinates=axis==='floor'?'vTileWorld.xz':axis==='z'?'vTileWorld.zy':'vTileWorld.xy';
shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
vec2 tileUV=${coordinates}/${TILE_SIZE+GROUT_SIZE};
vec2 edge=min(fract(tileUV),1.0-fract(tileUV));
vec2 aa=max(fwidth(tileUV),vec2(0.0001));
vec2 interior=smoothstep(vec2(${GROUT_SIZE/(2*(TILE_SIZE+GROUT_SIZE))})-aa*0.5,vec2(${GROUT_SIZE/(2*(TILE_SIZE+GROUT_SIZE))})+aa*0.5,edge);
tileMask=interior.x*interior.y;
// Each glazed tile is fired a slightly different shade.
vec2 tileCell=floor(tileUV);
float tileShade=fract(sin(dot(tileCell,vec2(12.9898,78.233)))*43758.5453);
diffuseColor.rgb*=0.955+0.07*tileShade;
diffuseColor.rgb=mix(vec3(0.58,0.57,0.53),diffuseColor.rgb,tileMask);`);
// Glazed faces stay glossy while the grout lines are matt.
shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(0.95,roughnessFactor*0.55,tileMask);');
};
material.customProgramCacheKey=()=>`ivry-tiles-5cm-${axis}`;
}

// Box projection gives every surface the same texture density in metres, whatever the
// size of its mesh. 'world' suits fixed architecture (it survives wall cutaways);
// 'local' keeps the grain attached to furniture as it is moved and rotated.
// The grain option names the axis that the texture's vertical (V) direction follows.
const PROJECTIONS={
y:['bpP.xz','bpP.zy','bpP.xy'],
x:['bpP.zx','bpP.zy','bpP.yx'],
z:['bpP.xz','bpP.yz','bpP.xy']
};
export function boxProject(material,{space='world',grain='y'}={}){
const [top,sideX,sideZ]=PROJECTIONS[grain]||PROJECTIONS.y;
material.userData.boxProject={space,grain};
material.onBeforeCompile=shader=>{
shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`
vec3 bpP=${space==='world'?'(modelMatrix*vec4(position,1.0)).xyz':'position'};
vec3 bpN=abs(${space==='world'?'normalize(mat3(modelMatrix)*normal)':'normal'});
vec2 boxUv=bpN.y>0.5?${top}:(bpN.x>bpN.z?${sideX}:${sideZ});
`+THREE.ShaderChunk.uv_vertex.replace(/\b(?!USE_)[A-Z_]+_UV\b/g,'boxUv'));
};
material.customProgramCacheKey=()=>`ivry-box-${space}-${grain}`;
return material;
}
// Material.clone() drops shader hooks; restore the projection on the copy.
export function cloneProjected(material){const copy=material.clone();if(material.userData.boxProject)boxProject(copy,material.userData.boxProject);return copy;}
