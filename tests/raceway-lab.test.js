import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {calculate,defaults,correction,adjustment,fill,grounding,demand,area,cableBend,familyRatings,familyEntries} from '../apps/raceway-lab/engine.js';
import {MV_1C,MV_3C,CONDUIT_BEND,SIZES} from '../apps/raceway-lab/data.js';
import {loadProject} from '../apps/raceway-lab/project.js';
const cat=JSON.parse(readFileSync(new URL('../apps/raceway-lab/catalog.json',import.meta.url)));
const run=changes=>calculate({...defaults(),...changes},cat);
const has=(r,c)=>r.issues.some(x=>x.code===c);
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const mv={voltage:4160,loadType:'mv-motor',motorFLC:250,motorTrip:280,breakerRating:400,family:'2:4',cableVoltage:5000,insulationLevel:100,selection:'auto',terminal:'90',ambient:45,ocpd:400};

test('catalog: Okonite copper families for aboveground raceway only',()=>{
 const specs=[...new Set(cat.map(c=>c.spec))].sort();
 assert.deepEqual(specs,['2:11/100','2:11/133','2:19','2:20/100','2:20/133','2:21','2:22','2:24','2:3','2:4','2:8/100','2:8/133','3:1','4:1','4:2/3x12','4:2/3x14','4:2/4x12','4:2/4x14','4:5']);
 for(const c of cat){
  assert.ok(SIZES.includes(c.size),c.id);assert.ok(c.odIn>0,c.id);assert.ok([1,3].includes(c.conductors),c.id);
  assert.ok(/^\d{3}-\d{2}-\d{4}$/.test(c.catalogNumber),c.id);
  if(c.voltage>1000)assert.ok(c.ratings&&Object.keys(c.ratings).length,c.id);
  if(c.coreOdIn)assert.ok(c.coreOdIn<c.odIn,c.id);
 }
 assert.equal(new Set(cat.map(c=>c.id)).size,cat.length);
});
test('catalog spot checks against Okonite OSC 2024 sheets',()=>{
 const find=(spec,size,ground)=>cat.find(c=>c.spec===spec&&c.size===size&&(ground===undefined||!!c.ground===ground));
 assert.equal(find('2:8/133','4/0').odIn,1.21);assert.equal(find('2:8/133','4/0').catalogNumber,'115-23-3236');
 assert.equal(find('3:1','1/0').odIn,.56);
 assert.deepEqual(find('2:24','500').ground,{count:1,size:'1'});
 assert.deepEqual(find('2:21','8').ground,{count:3,size:'12'});
 assert.equal(find('4:5','1/0',true).catalogNumber,'112-10-3894');assert.equal(find('4:5','1/0',false).catalogNumber,'112-10-3892');
 assert.deepEqual(familyRatings(familyEntries(cat,{family:'2:22',construction:'multi'})),{5000:133,8000:100});
 assert.deepEqual(find('2:22','8').ratings,{5000:133});
 assert.equal(find('2:21','2').maxTemp,90);
 assert.equal(find('4:2/4x12','8',true).catalogNumber,'571-31-3657');assert.equal(find('4:2/4x12','8',true).odIn,.99);assert.deepEqual(find('4:2/4x12','8',true).ground,{count:1,size:'10'});
 assert.equal(find('4:2/3x14','2').catalogNumber,'571-31-3203');assert.equal(find('4:2/3x14','2').odIn,1.17);
 assert.equal(cat.filter(c=>c.sheet==='4:2').length,25);assert.ok(cat.filter(c=>c.sheet==='4:2').every(c=>c.conductors===3&&c.armor==='clx'&&c.xhhw2&&c.page===64));
});
test('4:2 composite power + control: control set selects the row, integral ground only where published',()=>{
 const p={construction:'multi',continuous:40,ocpd:60};
 const sep=run({...p,family:'4:2/3x14'});assert.equal(sep.status,'Calculated');assert.equal(sep.selected.size,'6');assert.equal(sep.selected.cable.catalogNumber,'571-31-3686');
 assert.equal(sep.ccc,3);near(sep.selected.bend.radius,7*.95);assert.equal(sep.selected.bend.ref,'330.24(B)');
 const int=run({...p,family:'4:2/4x12',groundMode:'integral'});assert.equal(int.status,'Calculated');assert.equal(int.selected.cable.catalogNumber,'571-31-3667');assert.ok(!has(int,'ground'));
 const none=run({...p,family:'4:2/3x14',groundMode:'integral'});assert.ok(has(none,'ground'));assert.equal(none.status,'Blocked');
});
test('project JSON round trip preserves blank inputs and migrates legacy MV motors as incomplete',()=>{
 const restored=loadProject(JSON.parse(JSON.stringify({...defaults(),motorTrip:NaN})));
 assert.ok(Number.isNaN(restored.motorTrip));
 const legacy={...defaults(),version:2,loadType:'motor',voltage:4160,current:250,motorHp:2000,motorVoltage:460};
 for(const key of ['continuousRatedAssembly','motorFLC','motorTrip','breakerRating','motorDuty','driveInput'])delete legacy[key];
 const migrated=loadProject(JSON.parse(JSON.stringify(legacy)));
 assert.equal(migrated.loadType,'mv-motor');assert.equal(migrated.motorFLC,250);assert.ok(Number.isNaN(migrated.motorTrip));
 assert.ok(has(run(migrated),'motor-trip'));
 const legacyLV={...legacy,loadType:'motor',voltage:480,motorHp:75,motorVoltage:460};
 const migratedLV=loadProject(JSON.parse(JSON.stringify(legacyLV)));
 assert.equal(migratedLV.loadType,'lv-motor');assert.equal(migratedLV.motorFLC,96);assert.equal(demand(migratedLV).required,120);
 const legacyVFD={...legacy,loadType:'vfd',voltage:4160,current:300};
 assert.equal(loadProject(JSON.parse(JSON.stringify(legacyVFD))).driveInput,300);
 for(const raw of [{version:1},{...defaults(),conduitType:'invalid'},{...defaults(),conduitSize:'100'},{...defaults(),wet:'yes'},{...defaults(),loadType:'custom'}])assert.throws(()=>loadProject(raw));
 assert.equal(loadProject(JSON.parse(JSON.stringify(defaults()))).voltage,480);
});
test('removed inputs are not part of the project',()=>{
 for(const k of ['designCurrent','loadSource','fillTarget','bendRadius','manufacturerBend','coreOd','length','pf','vdLimit','vdMode','resistance','reactance','faultKA','withstandKA','customCable','phaseOd','integralGround','review','terminalConfirmed','corrosion'])assert.ok(!(k in defaults()),k);
});
test('LV 100 A continuous example: Okonite 3:1, NEC fill, bend radius and EGC',()=>{
 const r=run({});const s=r.selected;
 assert.equal(s.size,'1/0');assert.equal(s.cable.catalogNumber,'112-24-2351');assert.equal(r.load.design,125);assert.equal(s.term,150);near(s.corrected,154.7);assert.equal(s.g.size,'6');
 // 1-1/2 in RMC passes 40% fill but sits in the 2.8–3.2 jam band, so auto selects 2 in.
 assert.equal(s.conduits.find(c=>c.trade==='1-1/2').fillPass,true);assert.equal(s.conduits.find(c=>c.trade==='1-1/2').jam,true);
 assert.equal(s.conduit.trade,'2');assert.equal(s.conduit.nec,40);near(s.conduit.used,3*area(.56)+.0507);
 near(s.bend.radius,4*.56);assert.equal(s.conduit.bendRadius,12);
 assert.equal(r.status,'Calculated');
});
test('manual conduit in the jam band is flagged for review',()=>{const r=run({conduitSize:'1-1/2'});assert.ok(has(r,'jamming'));assert.equal(r.status,'Review required');});
test('continuous feeder applies separate pre-adjustment and post-adjustment tests',()=>{
 const r=run({ocpd:125,selection:'manual',size:'1',ambient:45});assert.equal(r.load.thermal,125);near(r.selected.corrected,126.15);assert.equal(r.selected.ampPass,true);
});
test('LV ambient factors use exact band endpoints',()=>{assert.equal(correction(false,40,90),.91);assert.equal(correction(false,40.01,90),.87);assert.equal(correction(false,60,60),null);assert.equal(correction(false,85.01,90),null);});
test('MV correction uses 40 C base and no LV factors',()=>{assert.equal(correction(true,40,90),1);assert.equal(correction(true,45,90),.95);assert.equal(correction(true,45,105),.96);});
test('CCC adjustment boundary values',()=>{assert.deepEqual([3,4,6,7,9,10,20,21,30,31,40,41].map(adjustment),[1,.8,.8,.7,.7,.5,.5,.45,.45,.4,.4,.35]);});
test('neutral physical area and CCC counting are independent',()=>{const a=run({neutral:'linear'}),b=run({neutral:'nonlinear'});assert.equal(a.ccc,3);assert.equal(b.ccc,4);assert.equal(a.selected.conduit.count,5);assert.equal(b.adjust,.8);});
test('two identical LV circuits count all six loaded phase conductors',()=>{const r=run({circuits:2});assert.equal(r.ccc,6);assert.equal(r.adjust,.8);assert.equal(r.selected.conduit.count,7);});
test('1 / 2 / 3 physical items use the NEC 53 / 31 / 40 percent limit',()=>{
 for(const [n,limit] of [[1,53],[2,31],[3,40]])assert.equal(fill([{count:n,area:.1}],{area:1}).nec,limit);
 assert.equal(fill([{count:1,area:.54}],{area:1}).pass,false);
 assert.equal(fill([{count:2,area:.16}],{area:1}).pass,false);
 assert.equal(fill([{count:3,area:.13}],{area:1}).pass,true);
});
test('3/C plus separate EGC uses 31%; integral EGC keeps one 53% item',()=>{
 const p={...mv,loadType:'vfd-input',driveInput:200,construction:'multi',family:'2:19',cableVoltage:8000,size:'350'};
 const r=run(p);assert.equal(r.selected.conduit.nec,31);
 const q=run({...p,groundMode:'integral'});assert.equal(q.selected.conduit.nec,53);assert.equal(q.selected.conduit.count,1);
});
test('integral EGC comes from the catalog construction',()=>{
 const sep=run({construction:'multi',family:'4:5'}),int=run({construction:'multi',family:'4:5',groundMode:'integral'});
 assert.equal(sep.selected.cable.ground,null);assert.deepEqual(int.selected.cable.ground,{count:1,size:'6'});assert.ok(!has(int,'ground'));
 near(int.selected.groundKcmil,26.24);
});
test('sectioned integral grounds are summed and undersized grounds fail',()=>{
 const p={voltage:2400,loadType:'vfd-input',driveInput:32,construction:'multi',family:'2:21',cableVoltage:2400,terminal:'90',selection:'manual',size:'8',groundMode:'integral'};
 const ok=run({...p,ocpd:100});near(ok.selected.groundKcmil,3*6.53);assert.ok(!has(ok,'ground'));
 const bad=run({...p,ocpd:400});assert.ok(has(bad,'ground'));assert.equal(bad.status,'Blocked');
});
test('MV 4.16 kV motor uses the overload trip setting, not FLC or breaker rating',()=>{
 const r=run(mv);assert.equal(r.load.required,280);assert.equal(r.load.design,280);assert.equal(r.load.reference,'430.205(A)');assert.equal(r.selected.ref,'315.60(C)(7)');assert.ok(r.selected.allowed>=280);assert.equal(r.selected.ampPass,true);
 assert.notEqual(r.load.required,312.5);assert.notEqual(r.load.required,mv.breakerRating);
 assert.match(r.load.basis,/No automatic 125% multiplier/);
});
test('MV feeder and VFD apply 125%',()=>{
 assert.ok(has(run({voltage:4160,loadType:'feeder'}),'mv-feeder-scope'));
 assert.equal(demand({...defaults(),voltage:4160,loadType:'vfd-input',driveInput:300}).required,375);
});
test('MV105 correction and 90C terminal ceiling are separate',()=>{const r=run({...mv,insulation:105,ambient:30});assert.equal(r.selected.base,305);assert.equal(r.selected.term,280);assert.equal(r.selected.allowed,280);});
test('MV-90 family blocks the 105 C insulation basis',()=>{const r=run({voltage:2400,loadType:'vfd-input',driveInput:80,construction:'multi',family:'2:21',cableVoltage:2400,terminal:'90',insulation:105,ocpd:200});assert.ok(has(r,'insulation-rating'));assert.equal(r.status,'Blocked');});
test('15 kV rated cable on 4.16 kV uses higher cable voltage column',()=>{const r=run({...mv,family:'2:8/133',cableVoltage:15000,insulationLevel:133});assert.equal(r.selected.base,295);assert.ok(!has(r,'voltage-band'));});
test('incorrect MV cable voltage column is blocked',()=>{const r=run({...mv,family:'2:8/133',cableVoltage:5000});assert.ok(has(r,'voltage-band'));assert.equal(r.status,'Blocked');});
test('catalog MV insulation level and dual voltage ratings are enforced',()=>{
 assert.ok(!has(run({...mv,cableVoltage:5000,insulationLevel:133}),'cable-insulation-level'));
 assert.ok(has(run({...mv,voltage:6900,cableVoltage:8000,insulationLevel:133}),'cable-insulation-level'));
 assert.ok(has(run({...mv,family:'2:8/100',cableVoltage:15000,insulationLevel:133}),'cable-insulation-level'));
});
test('independent manufacturer tabulation spot checks',()=>{assert.deepEqual(MV_1C['350'],[385,430,395,440]);assert.deepEqual(MV_3C['350'],[350,390,385,430]);assert.equal(MV_1C['8'][2],null);assert.deepEqual(MV_3C['1000'],[590,660,650,725]);});
test('MV grouped raceways and multiple circuits fail closed',()=>{assert.ok(has(run({...mv,isolated:false}),'isolation'));assert.ok(has(run({...mv,circuits:2}),'isolation'));});
test('cable minimum bending radius is derived from the construction',()=>{
 const one=cat.find(c=>c.spec==='2:8/133'&&c.size==='4/0');near(cableBend(one).radius,12*1.21);
 const three=cat.find(c=>c.spec==='2:20/133'&&c.size==='4/0');near(cableBend(three).radius,Math.max(7*2.48,12*2.24/(1+2/Math.sqrt(3))));
 const clx=cat.find(c=>c.spec==='2:21'&&c.size==='2');near(cableBend(clx).radius,7*1.45);assert.equal(cableBend(clx).ref,'330.24(B)');
 for(const [od,k] of [[.56,4],[1.18,5],[2.14,6]])near(cableBend({odIn:od,voltage:1000,conductors:3,shielded:false}).radius,k*od);
});
test('conduit Table 2 bend radius must cover the cable bending radius',()=>{
 assert.deepEqual([CONDUIT_BEND['1/2'],CONDUIT_BEND['2'],CONDUIT_BEND['4'],CONDUIT_BEND['6']],[4,12,24,36]);
 const r=run({...mv,family:'2:8/133',cableVoltage:15000,insulationLevel:133});const s=r.selected;
 assert.ok(s.conduit.bendRadius>=s.bend.radius);
 for(const c of s.conduits)assert.equal(c.bendPass,c.bendRadius>=s.bend.radius-1e-9);
 const small=run({...mv,family:'2:8/133',cableVoltage:15000,insulationLevel:133,conduitSize:'2'});assert.ok(has(small,'radius'));assert.equal(small.status,'Blocked');
});
test('parallel power conductors below 1/0 are not accepted',()=>{const r=run({sets:2,selection:'manual',size:'4'});assert.equal(r.selected.parallelOK,false);assert.equal(r.status,'Blocked');});
test('parallel sets retain full-circuit EGC in each raceway',()=>{const b=run({selection:'manual',size:'4/0',sets:2});assert.equal(b.selected.g.base,'6');assert.equal(b.selected.contents.find(x=>x.kind==='EGC').count,1);});
test('EGC proportional increase uses circular-mil area',()=>{const g=grounding(200,'350','3/0',false);near(g.ratio,350/167.8);assert.equal(g.size,'2');});
test('MV nonintegral EGC is at least #6 Cu',()=>{assert.equal(grounding(20,'1/0','1/0',true).size,'6');assert.equal(grounding(20,'1/0','1/0',true,true).size,'12');});
test('rooftop 3/4 in, 33 C adder; XHHW-2 exception comes from the family',()=>{
 assert.equal(run({rooftop:true,roofHeight:.74}).adder,33);
 assert.equal(run({rooftop:true,roofHeight:.75}).adder,0);
 assert.equal(run({rooftop:true,roofHeight:.74,construction:'multi',family:'4:5'}).adder,0);
});
test('auto terminal defaults are conservative for small equipment',()=>{const r=run({continuous:30,ocpd:40,terminal:'auto',selection:'manual',size:'8'});assert.equal(r.selected.terminal,60);assert.equal(r.selected.term,40);});
test('LV motor uses 125% of applicable Table FLC',()=>{const d=demand({...defaults(),loadType:'lv-motor',motorFLC:100});assert.equal(d.actual,100);assert.equal(d.required,125);assert.equal(d.reference,'430.6(A)(1), 430.22, Table 430.250');});
test('LV motor uses a compatible voltage and required FLC',()=>{assert.ok(has(run({loadType:'lv-motor',voltage:4160}),'circuit-voltage'));assert.ok(has(run({loadType:'lv-motor',motorFLC:NaN}),'motor-flc'));});
test('MV motor cannot size without the overload protection trip setting',()=>{const r=run({...mv,motorTrip:NaN});assert.equal(r.status,'Blocked');assert.equal(r.selected,undefined);assert.ok(has(r,'motor-trip'));});
test('MV motor EGC uses the independent protective device input, not overload trip current',()=>{const a=run({...mv,motorTrip:280,ocpd:100}),b=run({...mv,motorTrip:350,ocpd:100});assert.equal(a.selected.g.size,b.selected.g.size);assert.equal(demand({...defaults(),...mv,motorTrip:350}).required,350);});
test('VFD input uses 125% of equipment rated input current at LV and MV',()=>{assert.equal(demand({...defaults(),loadType:'vfd-input',driveInput:120}).required,150);assert.equal(demand({...defaults(),voltage:4160,loadType:'vfd-input',driveInput:300}).required,375);});
test('feeder OCPD below continuous load requirement is blocked',()=>assert.ok(has(run({ocpd:100}),'ocpd-load')));
test('size missing from the family is not treated as a pass',()=>{const r=run({...mv,family:'2:3',selection:'manual',size:'2'});assert.ok(has(r,'cable'));assert.equal(r.status,'Blocked');});
test('more than 360 degrees is rejected; 360 is permitted',()=>{assert.ok(has(run({bends:361}),'bends'));assert.ok(!has(run({bends:360}),'bends'));});
test('wet-only criteria, phase grouping, damage and classified areas fail closed',()=>{for(const [p,c] of [[{wetRated:false},'wet'],[{allPhases:false},'phase-group'],[{hazardous:true},'hazard'],[{damage:true,conduitType:'EMT'},'damage']])assert.ok(has(run(p),c));});
test('MV insulation level category clearing time limits',()=>{assert.ok(has(run({...mv,insulationLevel:100,clearingMinutes:2}),'insulation-level'));assert.ok(has(run({...mv,insulationLevel:133,clearingMinutes:61}),'insulation-level'));});
test('1001–2000 V is classified as MV, while unsupported MV feeder rules fail closed',()=>{assert.ok(has(run({voltage:1500,loadType:'feeder'}),'mv-feeder-scope'));assert.ok(has(run({voltage:1500,loadType:'lv-motor'}),'circuit-voltage'));});
test('qualifying 100%-rated assembly changes only continuous-load sizing basis',()=>{const standard=demand({...defaults(),continuous:100,noncontinuous:50});const listed=demand({...defaults(),continuous:100,noncontinuous:50,continuousRatedAssembly:true});assert.equal(standard.required,175);assert.equal(listed.required,150);});
test('general continuous and mixed load formulas',()=>{assert.equal(demand({...defaults(),continuous:100,noncontinuous:0}).required,125);assert.equal(demand({...defaults(),continuous:100,noncontinuous:50}).required,175);});
test('invalid numbers and unsupported choices cannot yield a pass',()=>{for(const p of [{voltage:NaN},{sets:1.5},{sets:0},{driveInput:Infinity,loadType:'vfd-input'},{continuous:-1},{conduitType:'unknown'},{voltage:16000},{size:'unknown'},{groundMode:'none'},{loadType:'custom'},{family:'unknown'}])assert.equal(run(p).status,'Blocked',JSON.stringify(p));});
test('hub registration, static build and local assets resolve',()=>{
 const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');assert.equal(read('index.html').match(/href="apps\/raceway-lab\/index.html"/g)?.length,1);assert.match(read('scripts/build.mjs'),/'raceway-lab'/);
 const page=new URL('../apps/raceway-lab/index.html',import.meta.url);
 for(const [,href] of read('apps/raceway-lab/index.html').matchAll(/(?:src|href)="([^"]+)"/g))assert.ok(existsSync(new URL(href,page)),href);
});
