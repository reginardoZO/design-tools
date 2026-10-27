import assert from 'node:assert/strict';
import { calculateNECFill as calc, sizeToKcmil, tabulatedArea } from '../apps/traylab-southwire/nec.js';

const cable = (overrides = {}) => ({odIn: 0.5, sizeKcmil: 10.38, size:'10 AWG', conductors:3, voltage:600, category:'power', trayRated:true, weightLbKft:200, ...overrides});
const circuit = (c, qty = 1, other = {}) => ({id:'F-101', qty, cablesPerRun:1, voltage:480, cable:c, ...other});
const base = {widthIn:12, depthIn:4, trayType:'ladder', industrialQualified:true,rungSpacingIn:9, circuits:[]};
const check = (input) => calc({...base, ...input});
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

// Real design: two 350 kcmil multiconductor cables in a 4 in compartment.
const big = cable({odIn:1.898, sizeKcmil:350, size:'350 kcmil'});
let result = check({widthIn:4, circuits:[circuit(big,2)]});
assert.equal(result.status,'pass'); close(result.ratio,0.949);
assert.equal(result.rule,'392.22(A)(1)(a)');
assert.equal(result.spacingEligible,false); close(result.spacingWidthIn,5.694);
result = check({widthIn:4, spacing:'one-diameter', circuits:[circuit(big,2)]});
assert.equal(result.status,'fail'); assert.equal(result.fillStatus,'pass');
result = check({widthIn:6, spacing:'one-diameter', circuits:[circuit(big,2)]});
assert.equal(result.status,'pass');

// The area allowance is not 40% of an arbitrary tray depth.
const smallRows = [circuit(cable(),50)];
result = check({circuits:smallRows});
close(result.allowed,14); close(result.used,50*Math.PI*.25/4);
assert.equal(check({depthIn:8,circuits:smallRows}).allowed,14);
assert.equal(check({widthIn:8,circuits:smallRows}).status,'fail');

// Mixed sizes use only small cable area against the remaining tabulated area.
result = check({widthIn:24,circuits:[circuit(big,2),circuit(cable(),50)]});
close(result.allowed,28-1.2*3.796); close(result.used,50*Math.PI*.25/4);
assert.equal(result.rule,'392.22(A)(1)(c)');
assert.equal(check({widthIn:4,trayType:'solid',circuits:[circuit(big,2)]}).status,'fail');

// Control-only rule needs an explicit declaration; depth is capped at 6 in.
result = check({widthIn:8,depthIn:8,controlOnly:true,circuits:smallRows});
close(result.allowed,24); assert.equal(result.rule,'392.22(A)(2)');
close(check({widthIn:8,depthIn:8,controlOnly:true,trayType:'solid',circuits:smallRows}).allowed,19.2);

// Non-table clear width must not be silently rounded up after adding a divider.
result = check({widthIn:7.9,circuits:smallRows});
assert.equal(result.tableWidthIn,6); assert.equal(result.allowed,7); assert.equal(result.conservativeTable,true);
assert.equal(tabulatedArea(1.9),null);

// Single-conductor runs count all physical phase cables and use the right table.
const single = cable({conductors:1,sizeKcmil:350,size:'350 kcmil',odIn:1});
result = check({circuits:[circuit(single,2,{cablesPerRun:3})]});
assert.equal(result.count,6); close(result.allowed,13); close(result.weightLbFt,1.2);
assert.equal(result.rule,'392.22(B)(1)(b)');
const oneO = cable({conductors:1,sizeKcmil:105.6,odIn:.7});
result = check({circuits:[circuit(single,2),circuit(oneO)]});
assert.equal(result.rule,'392.22(B)(1)(d)'); close(result.used,2.7);
assert.equal(check({rungSpacingIn:12,circuits:[circuit(oneO)]}).status,'fail');
const huge = cable({conductors:1,sizeKcmil:1000,odIn:1.5});
result = check({circuits:[circuit(single,2),circuit(huge)]});
close(result.allowed,13-1.1*1.5); assert.equal(result.rule,'392.22(B)(1)(c)');
assert.equal(check({trayType:'solid',circuits:[circuit(single)]}).status,'review');

// MV fill is based on individual diameters. Grouping does not shrink NEC width.
const mv = cable({conductors:1,sizeKcmil:350,odIn:1.2,voltage:5000,category:'mv',cableType:'MV'});
result = check({widthIn:4,circuits:[circuit(mv,1,{cablesPerRun:3,voltage:4160})]});
close(result.used,3.6); assert.equal(result.rule,'392.22(C)');
assert.equal(result.status,'pass');
assert.equal(check({circuits:[circuit(mv,1,{voltage:4160}),circuit(cable())]}).status,'fail');
// A 2 kV VFD cable operated at 480 V does not trigger the >1000 V separation rule.
assert.equal(check({circuits:[circuit(cable({voltage:2000,category:'vfd'})),circuit(cable())]}).status,'pass');

// Unsupported or incomplete cases never produce a green result.
assert.equal(check({circuits:[circuit(single),circuit(cable())]}).status,'review');
assert.equal(check({circuits:[circuit(cable({trayRated:null}))]}).status,'review');
assert.equal(check({circuits:[circuit(cable({trayRated:false}))]}).status,'fail');
assert.equal(check({circuits:[circuit(cable({voltage:300}))]}).status,'fail');
assert.equal(check({circuits:[circuit(cable(),0)]}).status,'fail');
assert.equal(check({widthIn:-1}).status,'fail');
assert.equal(check({}).status,'empty');
assert.equal(sizeToKcmil('4/0 AWG'),211.6);
assert.equal(sizeToKcmil('350 kcmil'),350);
assert.equal(sizeToKcmil('70 mm²'),null);
// A bare EGC accompanying an MV circuit is not a <=1000 V operating circuit.
const egc = cable({conductors:1,sizeKcmil:66.36,size:'2',odIn:.292,voltage:0,trayRated:null});
result = check({circuits:[circuit(mv,1,{cablesPerRun:3,voltage:4160}),circuit(egc,1,{purpose:'ground',voltage:0})]});
assert.equal(result.status,'review');
assert.ok(!result.notes.some(n=>n.includes('share a compartment')));
assert.equal(result.count,4);
console.log('NEC tests passed: fill thresholds, dividers, spacing, control-only, singles, MV, and invalid inputs.');
