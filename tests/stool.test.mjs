import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {furnitureBuilder,isolateFurnitureMaterials,applyFurnitureColours} from '../dist/furniture-models.js';
import {validateDesign} from '../dist/design-format.js';
const material=()=>new THREE.MeshStandardMaterial({color:'#b6b1a4'});
const builder=furnitureBuilder(Object.fromEntries(['wood','cloth','linen','blanket','metal','seam'].map(k=>[k,material()])));
const stool=builder.stool(),size=new THREE.Box3().setFromObject(stool).getSize(new THREE.Vector3());
// Product sheet: H 88, leg footprint 48 x 51 cm.
assert.ok(Math.abs(size.y-.88)<.01,'height '+size.y);assert.ok(Math.abs(size.x-.48)<.01,'width '+size.x);assert.ok(Math.abs(size.z-.51)<.015,'depth '+size.z);
const parts=isolateFurnitureMaterials(stool);assert.deepEqual(Object.keys(parts).sort(),['backrest','frame','upholstery']);
applyFurnitureColours(parts,{frame:'#222222'});assert.equal(parts.frame[0].material.color.getHexString(),'222222');assert.equal(parts.upholstery[0].material.color.getHexString(),'a8583a');
const spec={surfaces:['floor'],finishes:['oak'],furnitureIds:['chair','stool-0'],furnitureDefaults:{chair:{x:1,z:1,angle:0},'stool-0':{x:12.3,z:2.8,angle:Math.PI}}};
const old={format:'ivry-design',version:1,units:'metres',materials:{floor:{finish:'oak',tint:'#ffffff',roughness:.7,scale:1}},textures:{},furniture:[{id:'chair',x:2,z:2,angle:0}],ceilings:{box:2.9,main:4}};
assert.deepEqual(validateDesign(old,spec).furniture,[{id:'chair',x:2,z:2,angle:0},{id:'stool-0',x:12.3,z:2.8,angle:Math.PI}]);
assert.throws(()=>validateDesign(old,{...spec,furnitureDefaults:undefined}));
assert.deepEqual(validateDesign({...old,furnitureColours:{'stool-0':{frame:'#7f977c',backrest:'#b8893a'}}},spec).furnitureColours,{'stool-0':{frame:'#7f977c',backrest:'#b8893a'}});
console.log('PASS: counter stool matches product dimensions, has frame/seat/backrest colours, older designs gain stools at defaults');
