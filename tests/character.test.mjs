import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {buildCharacter,setCharacterPose,CHARACTER_HEIGHT,CHARACTER_POSES} from '../dist/character-model.js';
import {isolateFurnitureMaterials,applyFurnitureColours} from '../dist/furniture-models.js';
import {validateDesign,designFingerprint} from '../dist/design-format.js';
const material=colour=>new THREE.MeshStandardMaterial({color:colour});
const materials={skin:material('#e3b196'),hair:material('#4a2c1b'),top:material('#efe6d6'),bottoms:material('#5d7896'),shoes:material('#f3f1ea'),sole:material('#d8c7a4'),eye:material('#2c1a11'),white:material('#f6f3ee'),lips:material('#b9676a')};
const person=buildCharacter(materials);
// Bounds of the pose that is actually shown.
function shown(part){const box=new THREE.Box3();person.updateWorldMatrix(true,true);person.traverse(mesh=>{if(!mesh.isMesh||(part&&mesh.userData.furniturePart!==part))return;for(let p=mesh;p;p=p.parent)if(!p.visible)return;box.expandByObject(mesh);});return box;}
assert.deepEqual(CHARACTER_POSES,['stand','sit']);assert.equal(person.userData.pose,'stand');assert.equal(person.children.filter(c=>c.visible).length,1,'one pose at a time');
const standing=shown();
assert.ok(Math.abs(standing.max.y-CHARACTER_HEIGHT)<.03,'about 1.65 m tall, got '+standing.max.y);assert.ok(Math.abs(standing.min.y)<.005,'stands on the floor');
assert.ok(standing.max.x-standing.min.x<.6&&standing.max.z-standing.min.z<.5,'slim footprint');
// Long brown hair: from the crown to well below the shoulders.
const hair=shown('hair');assert.ok(hair.max.y>1.64);assert.ok(hair.min.y<1.15,'hair reaches the middle of the back, got '+hair.min.y);assert.ok(hair.min.z<-.1,'and falls behind the shoulders');
const hairColour=new THREE.Color('#4a2c1b').getHSL({});assert.ok(hairColour.h<.1&&hairColour.l<.3,'brunette');
// She faces +z: the face is in front of the head centre and the feet point forward.
assert.ok(shown('shoes').max.z>.12);assert.ok(shown('shoes').max.y<.13);assert.ok(shown('skin').max.y>1.6);
const parts=isolateFurnitureMaterials(person);assert.deepEqual(Object.keys(parts).sort(),['bottoms','hair','shoes','skin','top']);
person.traverse(mesh=>{if(mesh.isMesh){assert.ok(mesh.castShadow&&mesh.receiveShadow);for(const value of mesh.geometry.attributes.position.array)assert.ok(Number.isFinite(value));}});
let triangles=0;person.children[0].traverse(mesh=>{if(mesh.isMesh)triangles+=(mesh.geometry.index?mesh.geometry.index.count:mesh.geometry.attributes.position.count)/3;});assert.ok(triangles<40000,'light enough for phones: '+triangles);
// Clothes and hair recolour independently and restore.
applyFurnitureColours(parts,{top:'#7b8d78',hair:'#2a1a12'});assert.equal(parts.top[0].material.color.getHexString(),'7b8d78');assert.equal(parts.hair[0].material.color.getHexString(),'2a1a12');assert.equal(parts.bottoms[0].material.color.getHexString(),'5d7896');
applyFurnitureColours(parts);assert.equal(parts.top[0].material.color.getHexString(),'efe6d6');
// Sitting lowers her onto a seat with her feet still on the floor.
setCharacterPose(person,'sit');const sitting=shown();assert.equal(person.userData.pose,'sit');assert.ok(sitting.max.y<1.45&&sitting.max.y>1.25,'seated height '+sitting.max.y);assert.ok(Math.abs(sitting.min.y)<.01);assert.ok(sitting.max.z>standing.max.z+.2,'knees forward');
setCharacterPose(person,'dance');assert.equal(person.userData.pose,'stand','unknown poses fall back to standing');
// The design format carries her colours and pose, and older designs still load.
const spec={surfaces:['floor'],finishes:['oak'],furnitureIds:['person']};
const design={format:'ivry-design',version:1,units:'metres',materials:{floor:{finish:'oak',tint:'#ffffff',roughness:.7,scale:1}},textures:{},furniture:[{id:'person',x:12.4,z:3.62,angle:.62}],ceilings:{box:2.9,main:4}};
assert.deepEqual(validateDesign(design,spec),design);
const styled={...design,furnitureColours:{person:{hair:'#2a1a12',top:'#7b8d78',bottoms:'#33415c',shoes:'#ffffff',skin:'#e3b196'}},figure:{pose:'sit'}};
assert.deepEqual(validateDesign(JSON.parse(JSON.stringify(styled)),spec),styled);assert.notEqual(designFingerprint(styled),designFingerprint({...styled,figure:{pose:'stand'}}));
assert.equal(designFingerprint(design),designFingerprint({...design,figure:undefined}),'designs without a pose keep their fingerprint');
for(const figure of [{pose:'fly'},{},'sit',null])assert.throws(()=>validateDesign({...design,figure},spec));
assert.throws(()=>validateDesign({...design,furnitureColours:{person:{eyes:'#000000'}}},spec));
console.log('PASS: 1.65 m figure with long brown hair, shown pose only, independent recolouring, sitting pose, saved colours and pose');
