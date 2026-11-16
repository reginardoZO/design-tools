import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {computeSizing, computeLoad, egcSizing, KCMIL} from '../apps/nec-cable-tray/src/engine.js';
import {buildReportHtml} from '../apps/nec-cable-tray/src/report.js';
import {calculate, newProject} from '../apps/raceway-lab/engine.js';
import {newMccLoad} from '../shared/mcc-feeder.js';
import {blankTray, cableSnapshot, evaluateTray, suggestSize} from '../apps/traylab-southwire/project.js';
import {drawLayout, planLayout} from '../apps/traylab-southwire/arrangement.js';
import {CABLES, calcVD, powerParallelAllowed} from '../shared/voltage-drop.js';
import {layoutItems} from '../apps/cable-tray-sizing/src/engine.js';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
const cfg={designI:170,ambient:40,insTemp:90,termTemp:75,vClass:'mv5',construction:'multi',arrangement:'touching',covered:false,ccc:3,maxSets:1,maxSize:'1000',vd:{on:false}};
const row=(result,size)=>result.rows.find(r=>r.size===size);
const catalog=JSON.parse(readFileSync(new URL('../apps/traylab-southwire/catalog.json',import.meta.url)));
const okonite=JSON.parse(readFileSync(new URL('../apps/raceway-lab/catalog.json',import.meta.url)));

test('F01: spaced LV multicore uses the 40°C multicore reference, including hot-ambient sizing',()=>{
 const r=computeSizing({...cfg,designI:140,ambient:65,vClass:'lv',arrangement:'spaced1'});
 assert.match(r.method.baseTableName,/multiconductor/);
 assert.equal(r.method.tableBaseAmbient,40);
 near(row(r,'1/0').base,186); // Annex B, Cu 90°C, 40°C ambient, not the 260 A single.
 near(r.kAmb,.71); // sqrt((90-65)/(90-40)), table band rounding.
 near(row(r,'1/0').allowed,132.06);
 assert.equal(r.recommended.row.size,'2/0');near(r.recommended.row.allowed,152.65);
});

test('F01: reference requiring at most 3 CCC cannot recommend a cable for 4 CCC',()=>{
 for(const ccc of [0,4,NaN]){
  const r=computeSizing({...cfg,vClass:'lv',arrangement:'spaced1',ccc});
  assert.equal(r.recommended,null);assert.equal(r.rows.length,0);
  assert.ok(r.method.notes.some(n=>n.includes('no recommendation')));
 }
 assert.equal(computeSizing({...cfg,vClass:'lv',arrangement:'spaced1',ccc:3,insulatedConductors:4}).recommended,null);
});

test('60°C insulation cannot borrow the 75°C trefoil ampacity column',()=>{
 assert.equal(computeSizing({...cfg,vClass:'lv',construction:'single',arrangement:'trefoil215',insTemp:60}).recommended,null);
});

test('F02: ordinary 5kV 3/C tray uses C(9), uncovered 165 A and covered 156.75 A',()=>{
 const r=computeSizing(cfg),covered=computeSizing({...cfg,covered:true});
 assert.match(r.method.baseTableName,/315\.60\(C\)\(9\)/);
 near(row(r,'1/0').base,165);near(row(r,'1/0').tf,1);near(row(r,'1/0').allowed,165);
 assert.equal(r.recommended.row.size,'2/0');
 near(row(covered,'1/0').tf,.95);near(row(covered,'1/0').allowed,156.75);
});

test('F02: 15kV MV-105 keeps the separate C(9) 90°C termination limit',()=>{
 const r=computeSizing({...cfg,vClass:'mv15',insTemp:105});
 near(row(r,'4/0').base,320);near(row(r,'4/0').termAmp,290);near(row(r,'4/0').allowed,290);
});

test('F02: maintained 1D spacing remains C(5); a solid cover reverts to C(9)',()=>{
 const spaced=computeSizing({...cfg,arrangement:'spaced1'});
 near(row(spaced,'1/0').allowed,185);
 assert.match(spaced.method.baseTableName,/315\.60\(C\)\(5\)/);
 const covered=computeSizing({...cfg,arrangement:'spaced1',covered:true});
 near(row(covered,'1/0').allowed,156.75);
});

test('F03: every MV single-conductor candidate is at least 1/0 in all arrangements',()=>{
 for(const vClass of ['mv5','mv15']) for(const arrangement of ['touching','spaced1','trefoil215']) for(const covered of [true,false]){
  const r=computeSizing({...cfg,designI:80,construction:'single',vClass,arrangement,covered});
  assert.ok(r.rows.length>0);assert.ok(r.rows.every(x=>KCMIL[x.size]>=105.6));
  assert.equal(r.recommended.row.size,'1/0');
 }
});

test('F04: a separate tray EGC has the #4 floor; integral and table-only grounds retain their own basis',()=>{
 const separate=egcSizing(100,'1/0','1/0',{installation:'separate-tray'});
 assert.equal(separate.tableSize,'8');assert.equal(separate.finalSize,'4');assert.equal(separate.floorApplied,true);
 assert.equal(egcSizing(100,'1/0','1/0',{installation:'integral'}).finalSize,'8');
 assert.equal(egcSizing(100,'1/0','1/0').finalSize,'8');
 assert.equal(egcSizing(20,'12','12',{installation:'separate-tray'}).finalSize,'4');
});

test('F04: the nonintegral MV raceway floor is #6; a tray still requires #4',()=>{
 assert.equal(egcSizing(100,'1/0','1/0',{installation:'separate-raceway',mediumVoltage:true}).finalSize,'6');
 assert.equal(egcSizing(100,'1/0','1/0',{installation:'separate-tray',mediumVoltage:true}).finalSize,'4');
 assert.equal(egcSizing(100,'1/0','1/0',{installation:'separate-raceway'}).finalSize,'8');
 assert.ok(egcSizing(100,'1/0','1/0',{installation:'invalid'}).error);
});

test('F05: MV DOL motor requires its effective overload trip, without multiplying FLC',()=>{
 const p={type:'motor',motorMode:'manual',customA:100,voltage:4160,phases:3,vClass:'mv5'};
 assert.equal(computeLoad(p).design,0);
 const r=computeLoad({...p,motorTrip:110});
 near(r.fla,100);near(r.design,110);assert.equal(r.mvMotor,true);assert.match(r.basis,/430\.205/);
 assert.equal(computeLoad({...p,motorTrip:110,vClass:'lv'}).design,0);
 near(computeLoad({...p,motorTrip:110,vClass:'mv15'}).design,110); // higher-rated cable on a 4.16kV circuit.
 assert.equal(computeLoad({...p,motorTrip:110,phases:1}).design,0);
 const lv=computeLoad({type:'motor',motorMode:'table',motorV:460,phases:3,hp:'50',motorTrip:110,vClass:'lv'});
 near(lv.design,81.25);assert.equal(lv.mvMotor,false);
});

const motor=pair=>({...newMccLoad('motor',pair),voltage:240,phases:1,phasePair:pair,horsepower:1});
const other=pair=>({...newMccLoad('general',pair),voltage:240,phases:1,phasePair:pair,ratingUnit:'A',rating:70.5,duty:'noncontinuous'});

test('F06: permuting equal motors cannot change phase demand or the selected MCC conductor',()=>{
 const results=[['AB','BC'],['BC','AB']].map(order=>calculate({...newProject(),loadType:'mcc-feeder',voltage:240,ambient:30,terminal:'75',ocpd:200,mccLoads:[...order.map(motor),other('CA'),other('BC')]},okonite));
 for(const r of results){near(r.load.required,151);assert.equal(r.selected.size,'2/0');near(r.load.mcc.currentsByPhase.C,151);near(r.load.mcc.largestMotorByPhase.C,8);}
 assert.deepEqual(results[0].load.mcc.currentsByPhase,results[1].load.mcc.currentsByPhase);
});

const small=catalog.find(c=>c.spec==='45252'&&c.size==='8');
const large=catalog.find(c=>c.spec==='45252'&&c.size==='4/0');
let seq=0;
const tray=(widthIn,depthIn)=>({...blankTray(()=>`co-${seq++}`),widthIn,depthIn});
const add=(t,id,cable,qty)=>({id,compartmentId:t.compartments[0].id,cable:cableSnapshot(cable),qty});

test('F07: real 4/0 cables occupy a reserved lane with no smaller cable above them',()=>{
 const t=tray(12,4);t.cables=[add(t,'big',large,3),add(t,'small',small,12)];
 const e=evaluateTray(t),r=e.results[0];assert.equal(e.ok,true);
 near(r.plan.linearWidthIn,3*1.507);
 const drawing=drawLayout(r.plan,12,4);
 assert.equal(drawing.omitted,0);
 for(const c of drawing.placed.filter(c=>c.id==='big'))near(c.y,0);
 for(const c of drawing.placed.filter(c=>c.id==='small'))assert.ok(c.x>=3*1.507-1e-9);
});

test('F07: even random-fill MV multicore is forced to one physical layer',()=>{
 const p=planLayout([{id:'mv',cable:{odIn:1,conductors:3,voltage:5000,size:'2'},qty:4}],{multiLayout:'stacked'});
 near(p.linearWidthIn,4);assert.equal(p.stacked.length,0);
});

test('F08: the real 114.3% mixed-area tray is rejected, and a larger verified size can be suggested',()=>{
 const single=catalog.find(c=>c.id==='sw-45002-5111');
 const t=tray(6,6);t.compartments[0].singleLayout='flat';
 t.cables=[add(t,'one',single,1),add(t,'many',small,24)];
 const e=evaluateTray(t),r=e.results[0];
 assert.equal(r.fit.fits,true);assert.equal(r.fill.rule,'392.80(A)(3)');
 near(r.fill.ratio,1.1430632395132247);assert.equal(r.status,'over');assert.equal(e.ok,false);
 const suggested=suggestSize(t);assert.ok(suggested);assert.equal(suggested.evaluation.ok,true);assert.ok(suggested.tray.widthIn>6);
});

test('F08: unsupported width-based mixes and solid-bottom singles never get green or a size recommendation',()=>{
 for(const type of ['width-mix','solid','voltage-mix']){
  const t=tray(12,4);t.compartments[0].singleLayout='flat';
  const single={conductors:1,voltage:type==='voltage-mix'?5000:600,odIn:.5,size:'1/0'};
  t.cables=[add(t,'one',single,1)];
  if(type==='solid')t.trayType='solid';else t.cables.push(add(t,'multi',small,1));
  const r=evaluateTray(t);
  assert.equal(r.results[0].status,'review');assert.equal(r.verified,false);assert.equal(r.ok,false);assert.equal(suggestSize(t),null);
 }
});

test('F09: 2×#14 can have low mathematical drop but is excluded from ordinary-power recommendations',()=>{
 const params={material:'cu',phases:3,current:30,lengthFt:100,pf:1,n:2,voltage:480};
 const result=calcVD(CABLES[0],params);
 near(result.pct,1.6779242198323496);assert.equal(result.parallelOK,false);assert.equal(result.ampOk,false);
 const suggestion=CABLES.find(c=>{const r=calcVD(c,params);return r?.pct<3&&r.ampOk;});
 assert.equal(suggestion.size,'1/0 AWG');
 assert.equal(powerParallelAllowed('1/0 AWG',2),true);
 for(const n of [0,-1,1.5,NaN,Infinity])assert.equal(powerParallelAllowed('1/0 AWG',n),false);
});

test('MV motor and EGC installation criteria are present in the generated calculation report',()=>{
 const inputs={...cfg,loadType:'motor',motorMode:'manual',customA:100,voltage:4160,motorTrip:110,phases:3,egcLinked:true,egcInstallation:'separate-tray',ocpd:100};
 const load=computeLoad({...inputs,type:'motor'}),result=computeSizing({...cfg,designI:load.design});
 const rec=result.recommended,egc=egcSizing(100,rec.row.size,rec.ampRow.size,{installation:'separate-tray',mediumVoltage:true});
 const html=buildReportHtml({inputs,load,result,rec,egc,warnings:[],vd:{on:false}});
 assert.match(html,/430\.205\(A\)/);assert.match(html,/110/);assert.match(html,/392\.10\(B\)\(1\)\(c\)/);
 assert.doesNotMatch(html,/rated at least <b>125 % of the motor/);
});

test('G01: one 1in trefoil is 1.866in tall and fits a 2in depth',()=>{
 const r=layoutItems([{type:'Single',load:'Power',od:1,weight:1}],{trefoilSpacing:true,vfdSpacing:true,powerBundled:false});
 near(r.maxDepthIn,1+Math.sqrt(3)/2);assert.ok(r.maxDepthIn<2);
});
