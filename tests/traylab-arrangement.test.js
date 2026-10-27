import assert from 'node:assert/strict';
import {calculateCompartment as check} from '../apps/traylab-southwire/nec.js';
import {requiresTrefoil,planArrangement,TREFOIL_HEIGHT,circuitPolicyIssues} from '../apps/traylab-southwire/arrangement.js';
import {compartmentsOf,layoutCables,migrateProject,validateProject,suggestWidth,projectCSV} from '../apps/traylab-southwire/project.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const single={id:'1c',spec:'TEST',stock:'TEST',odIn:1,size:'4/0',sizeKcmil:211.6,conductors:1,voltage:600,category:'power',trayRated:true,weightLbKft:1000};
const row=(overrides={})=>({id:'a',tag:'FDR-A',cable:single,qty:2,cablesPerRun:3,voltage:480,...overrides});
const calc=(options={})=>check({widthIn:12,depthIn:4,trayType:'ladder',industrialQualified:true,rungSpacingIn:9,spacing:'touching',trefoilSpacing:'2.15D',vfdSpacing:'touching',circuits:[row()],...options});
assert.equal(requiresTrefoil(single),true); // Inclusive 4/0 boundary.
assert.equal(requiresTrefoil({...single,size:'3/0',sizeKcmil:167.8}),false);
assert.equal(requiresTrefoil({...single,size:'1000',sizeKcmil:1000}),true);
assert.equal(requiresTrefoil({...single,sizeKcmil:350,category:'vfd'}),false);
assert.equal(requiresTrefoil(single,'ground'),false);
assert.equal(requiresTrefoil({size:'4/0 AWG'}),true);
assert.equal(requiresTrefoil({size:'350 kcmil'}),true);
let r=calc();
close(r.arrangementWidthIn,6.15);close(r.arrangementHeightIn,TREFOIL_HEIGHT);
assert.equal(r.count,6);close(r.sumOdIn,6);close(r.areaIn2,6*Math.PI/4);close(r.weightLbFt,6);
assert.equal(r.rule,'392.22(B)(1)(d)');assert.equal(r.status,'pass');assert.equal(r.ampacityStatus,'not-calculated');
assert.equal(r.thermal[0].rule,'392.80(A)(2)(d)');assert.equal(r.thermal[0].status,'geometry-only');
r=calc({trefoilSpacing:'1D'});close(r.arrangementWidthIn,5);assert.equal(r.thermal[0].status,'review');assert.match(r.thermal[0].message,/does not qualify/);
const settings={trefoilSpacing:'1D'};
let drawing=layoutCables([row()],12,4,r,settings);
assert.equal(drawing.groups.length,2);assert.equal(drawing.placed.length,6);assert.equal(drawing.omitted,0);
close(drawing.groups[1].x,3);close(drawing.gaps[0].width,1);
const abc=drawing.placed.slice(0,3).map(d=>({x:d.x+d.d/2,y:d.y+d.d/2}));
for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)close(Math.hypot(abc[i].x-abc[j].x,abc[i].y-abc[j].y),1);
// Geometry and NEC fill are independent: 2D wide is still three cable diameters for fill.
r=calc({widthIn:2.5,circuits:[row({qty:1})]});assert.equal(r.geometryStatus,'pass');assert.equal(r.fillStatus,'fail');close(r.used,3);
r=calc({widthIn:6.1});assert.equal(r.fillStatus,'pass');assert.equal(r.geometryStatus,'fail');assert.equal(r.status,'fail');
r=calc({depthIn:1.8});assert.equal(r.fillStatus,'pass');assert.equal(r.geometryStatus,'fail');
drawing=layoutCables([row()],12,1.8,r,{trefoilSpacing:'2.15D'});assert.equal(drawing.placed.length,0);assert.equal(drawing.omitted,6); // Never display partial phase groups.
r=calc({circuits:[row({qty:1})]});close(r.arrangementWidthIn,2);assert.equal(r.arrangement.trefoilGroups,1);
// Adjacent unequal diameters use the larger individual OD, not an envelope diameter.
const second=row({id:'b',tag:'FDR-B',qty:1,cable:{...single,odIn:2,sizeKcmil:350,size:'350'}});
r=calc({widthIn:24,circuits:[row({qty:1}),second]});close(r.arrangementWidthIn,4+2+2.15*2);
drawing=layoutCables([row({qty:1}),second],24,4,r,{trefoilSpacing:'2.15D'});close(drawing.gaps[0].width,4.3);assert.equal(drawing.placed.length,6);
// MV fill counts all individual cables, even in one isolated group.
r=calc({widthIn:3,circuits:[row({qty:1,cable:{...single,voltage:5000,category:'mv'},voltage:4160})]});
assert.equal(r.rule,'392.22(C)');close(r.used,3);close(r.arrangementWidthIn,2);assert.equal(r.thermal[0].rule,'392.80(B)(2)(3)');
// VFD exception remains one whole multiconductor cable per run at/above 4/0.
const vfd={...single,conductors:3,category:'vfd',size:'350',sizeKcmil:350,voltage:2000};
const vfdRows=[row({cable:vfd,cablesPerRun:1})];
r=calc({circuits:vfdRows});close(r.arrangementWidthIn,2);assert.equal(r.arrangement.trefoilGroups,0);assert.equal(r.count,2);assert.equal(r.status,'pass');
r=calc({circuits:vfdRows,vfdSpacing:'1D'});close(r.arrangementWidthIn,3);assert.match(r.thermal[0].message,/multiconductor/);
drawing=layoutCables(vfdRows,12,4,r,{vfdSpacing:'1D'});close(drawing.placed[1].x,2);assert.equal(drawing.groups.length,0);
r=calc({circuits:[row({qty:1}),row({id:'v',qty:1,cable:vfd,cablesPerRun:1})],vfdSpacing:'touching'});close(r.arrangementWidthIn,5.15);assert.equal(r.fillStatus,'review'); // Mixed fill stays explicitly unsupported.
assert.equal(calc({covered:true}).thermal[0].status,'review');
assert.equal(calc({trayType:'solid'}).thermal[0].status,'review');
// Import preserves incompatible legacy data, and the application flags it.
const legacy=row({cable:{...single,conductors:3},cablesPerRun:1});
r=calc({circuits:[legacy]});assert.equal(r.policyStatus,'fail');assert.equal(r.status,'fail');assert.match(r.notes[0],/Replace this multiconductor/);
assert.ok(circuitPolicyIssues(row({cablesPerRun:1})).length);
assert.ok(circuitPolicyIssues({...legacy,purpose:'ground'}).length); // A multipolar product is not a separate EGC.
const p={schemaVersion:1,complianceSchema:1,name:'Test',trayTag:'TEST',widthIn:12,depthIn:4,trayType:'ladder',industrialQualified:true,rungSpacingIn:9,units:'in',dividerThicknessIn:.125,dividers:[],reserve:20,compartments:[{id:'co',name:'A',spacing:'touching',trefoilSpacing:'2.15D',vfdSpacing:'touching'}],circuits:[{...row(),cableId:single.id,cableSnapshot:single,compartmentId:'co'}]};
let migrated=migrateProject(p);assert.deepEqual(migrated,p);validateProject(migrated);
const backup=JSON.parse(JSON.stringify(p));delete backup.compartments[0].trefoilSpacing;delete backup.compartments[0].vfdSpacing;backup.compartments[0].spacing='one-diameter';
migrated=migrateProject(backup);assert.equal(migrated.compartments[0].trefoilSpacing,'2.15D');assert.equal(migrated.compartments[0].vfdSpacing,'1D');assert.deepEqual(migrated.circuits,backup.circuits);
assert.throws(()=>validateProject({...p,compartments:[{...p.compartments[0],trefoilSpacing:'2D'}]}),/1D or 2.15D/);
const suggestion=suggestWidth(p,new Map());assert.equal(suggestion.project.widthIn,9);assert.ok(suggestion.checks[0].arrangementWidthIn<=9*.8);
const shallow={...p,depthIn:1.8};assert.equal(suggestWidth(shallow,new Map()),null);
const divided={...p,widthIn:16.125,dividers:[8.0625],compartments:[{...p.compartments[0],id:'one',trefoilSpacing:'1D'},{...p.compartments[0],id:'two',trefoilSpacing:'2.15D'}]};
const checks=compartmentsOf(divided).map(co=>calc({...co,circuits:[row()]}));close(checks[0].arrangementWidthIn,5);close(checks[1].arrangementWidthIn,6.15);
const csv=projectCSV(p,new Map());assert.match(csv,/Trefoil clear gap/);assert.match(csv,/2\.15D/);assert.match(csv,/Trefoil · 2\.15D clear gap/);
// Large quantities remain analytical; the SVG is capped without splitting a group.
r=calc({circuits:[row({qty:9999})]});assert.equal(r.count,29997);close(r.arrangementWidthIn,9999*2+9998*2.15);
drawing=layoutCables([row({qty:9999})],120,4,r,{trefoilSpacing:'2.15D'});assert.equal(drawing.placed.length%3,0);assert.equal(drawing.placed.length+drawing.omitted,29997);
console.log('Arrangement tests passed: 4/0 policy, trefoil geometry, VFD options, mixed diameters, NEC independence, depth, migration, dividers, reserve, exports and drawing integrity.');
