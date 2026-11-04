import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {calculate,defaults,correction,adjustment,fill,grounding,demand,area} from '../apps/raceway-lab/engine.js';
import {MV_1C,MV_3C,CONDUITS,LV,Z} from '../apps/raceway-lab/data.js';
import {loadProject} from '../apps/raceway-lab/project.js';
const cat=JSON.parse(readFileSync(new URL('../apps/raceway-lab/catalog.json',import.meta.url)));
const run=changes=>calculate({...defaults(),...changes},cat);
const has=(r,c)=>r.issues.some(x=>x.code===c);
test('project JSON round trip preserves blank inputs and clears confirmations',()=>{
 const restored=loadProject(JSON.parse(JSON.stringify({...defaults(),resistance:NaN,review:{protection:true}})));
 assert.ok(Number.isNaN(restored.resistance));assert.deepEqual(restored.review,{});
 assert.equal(calculate({...restored,vdMode:'custom'}).status,'Blocked');
});
test('switching back to Table 9 ignores blank unused R/X; custom mode requires positive R',()=>{
 assert.notEqual(run({resistance:NaN,reactance:NaN,vdMode:'table'}).status,'Blocked');
 assert.equal(run({resistance:0,vdMode:'custom',selection:'manual'}).status,'Blocked');
});
test('malformed project imports reject invalid types, missing inputs and unknown choices',()=>{
 for(const raw of [{version:1},{...defaults(),conduitType:'invalid'},{...defaults(),conduitSize:'100'},{...defaults(),wet:'yes'},{...defaults(),version:2}])assert.throws(()=>loadProject(raw));
 assert.equal(loadProject(JSON.parse(JSON.stringify(defaults()))).voltage,480);
});
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const mv={voltage:4160,loadType:'custom',current:200,designCurrent:250,loadSource:'Motor study',family:'46101',cableVoltage:5000,insulationLevel:100,selection:'manual',size:'4/0',terminal:'90',ambient:45,ocpd:300,vdMode:'custom',resistance:.08,reactance:.05,impedanceSource:'Verified example',bendRadius:24};
test('LV 100 A continuous example: load, ampacity, grounding and voltage drop worked independently',()=>{
 const r=run({});const s=r.selected;assert.equal(s.size,'1/0');assert.equal(r.load.design,125);assert.equal(s.term,150);near(s.corrected,154.7);assert.equal(s.g.size,'6');assert.equal(s.conduit.trade,'2');near(s.vd,Math.sqrt(3)*100*.2*(.12*.85+.055*Math.sqrt(1-.85**2))/480*100);
 assert.equal(r.status,'Review required');
});
test('continuous feeder applies separate pre-adjustment and post-adjustment tests',()=>{
 const r=run({ocpd:125,selection:'manual',size:'1',ambient:45});assert.equal(r.load.thermal,100);near(r.selected.corrected,126.15);assert.equal(r.selected.ampPass,true);
});
test('LV ambient factors use exact band endpoints',()=>{assert.equal(correction(false,40,90),.91);assert.equal(correction(false,40.01,90),.87);assert.equal(correction(false,60,60),null);assert.equal(correction(false,85.01,90),null);});
test('MV correction uses 40 C base and no LV factors',()=>{assert.equal(correction(true,40,90),1);assert.equal(correction(true,45,90),.95);assert.equal(correction(true,45,105),.96);});
test('CCC adjustment boundary values',()=>{assert.deepEqual([3,4,6,7,9,10,20,21,30,31,40,41].map(adjustment),[1,.8,.8,.7,.7,.5,.5,.45,.45,.4,.4,.35]);});
test('neutral physical area and CCC counting are independent',()=>{const a=run({neutral:'linear'}),b=run({neutral:'nonlinear'});assert.equal(a.ccc,3);assert.equal(b.ccc,4);assert.equal(a.selected.conduit.count,5);assert.equal(b.adjust,.8);});
test('two identical LV circuits count all six loaded phase conductors',()=>{const r=run({circuits:2});assert.equal(r.ccc,6);assert.equal(r.adjust,.8);assert.equal(r.selected.conduit.count,7);});
test('EGC contributes to area but not CCC',()=>{const r=run({});assert.equal(r.ccc,3);assert.equal(r.selected.conduit.count,4);assert.ok(r.selected.conduit.used>3*area(r.selected.cable.odIn));});
test('1 / 2 / 3 physical cable objects use 53 / 31 / 40 percent',()=>{
 for(const [n,limit] of [[1,53],[2,31],[3,40]])assert.equal(fill([{count:n,area:.1}],{area:1},53).nec,limit);
 assert.equal(fill([{count:1,area:.54}],{area:1},53).pass,false);
 assert.equal(fill([{count:2,area:.16}],{area:1},53).pass,false);
});
test('3/C plus separate EGC uses 31%; integral EGC stays inside one cable item',()=>{
 const p={...mv,construction:'multi',family:'46203',cableVoltage:8000,size:'350',coreOd:1.1};
 const r=run(p);assert.equal(r.selected.conduit.nec,31);
 const q=run({...p,groundMode:'integral',integralGround:'4',fillTarget:53});assert.equal(q.selected.conduit.nec,53);
});
test('LV 3/C has catalog geometry and still needs actual impedance',()=>{const r=run({construction:'multi',family:'45252'});assert.ok(r.selected.cable);assert.equal(r.selected.conduit.nec,31);assert.ok(has(r,'impedance'));});
test('fill reserves never relax the code limit',()=>{assert.equal(fill([{count:3,area:.1}],{area:1},53).limit,40);assert.equal(fill([{count:3,area:.1}],{area:1},20).pass,false);});
test('MV 4.16kV 4/0 5kV cable: 280 × .95 = 266 A, 90 C terminal',()=>{const r=run(mv);assert.equal(r.selected.ref,'315.60(C)(7)');assert.equal(r.selected.base,280);near(r.selected.corrected,266);assert.equal(r.selected.g.size,'4');assert.equal(r.selected.ampPass,true);});
test('MV105 correction and 90C terminal ceiling are separate',()=>{const r=run({...mv,insulation:105,ambient:30});assert.equal(r.selected.base,305);assert.equal(r.selected.term,280);assert.equal(r.selected.allowed,280);});
test('15kV rated cable on 4.16kV uses higher cable voltage column',()=>{const r=run({...mv,family:'46302',cableVoltage:15000});assert.equal(r.selected.base,295);assert.ok(!has(r,'voltage-band'));});
test('incorrect MV cable voltage column is blocked',()=>{const r=run({...mv,family:'46302',cableVoltage:5000});assert.ok(has(r,'voltage-band'));assert.equal(r.status,'Blocked');});
test('independent manufacturer tabulation spot checks',()=>{assert.deepEqual(MV_1C['350'],[385,430,395,440]);assert.deepEqual(MV_3C['350'],[350,390,385,430]);assert.equal(MV_1C['8'][2],null);assert.deepEqual(MV_3C['1000'],[590,660,650,725]);});
test('MV grouped raceways and multiple circuits fail closed',()=>{assert.ok(has(run({...mv,isolated:false}),'isolation'));assert.ok(has(run({...mv,circuits:2}),'isolation'));});
test('MV automatic sizing retains an ampacity proposal but does not invent voltage drop',()=>{const r=run({...mv,selection:'auto',vdMode:'table'});assert.ok(r.selected);assert.equal(r.selected.vd,null);assert.ok(has(r,'impedance'));assert.equal(r.status,'Blocked');});
test('parallel power conductors below 1/0 are not accepted',()=>{const r=run({sets:2,selection:'manual',size:'4'});assert.equal(r.selected.parallelOK,false);assert.equal(r.status,'Blocked');});
test('parallel sets divide current for VD and retain full-circuit EGC',()=>{const a=run({selection:'manual',size:'4/0'}),b=run({selection:'manual',size:'4/0',sets:2});near(b.selected.vd,a.selected.vd/2);assert.equal(b.selected.g.base,'6');assert.equal(b.selected.contents.find(x=>x.kind==='EGC').count,1);});
test('EGC proportional increase uses circular-mil area',()=>{const g=grounding(200,'350','3/0',false);near(g.ratio,350/167.8);assert.equal(g.size,'2');});
test('MV nonintegral EGC is at least #6 Cu',()=>assert.equal(grounding(20,'1/0','1/0',true).size,'6'));
test('undersized integral EGC fails',()=>{const r=run({...mv,construction:'multi',family:'46203',cableVoltage:8000,size:'350',groundMode:'integral',integralGround:'14',coreOd:1});assert.ok(has(r,'ground'));});
test('rooftop boundary is 3/4 in, 33 C, with XHHW-2 exception',()=>{
 assert.equal(run({rooftop:true,roofHeight:.74,xhhw2:false}).adder,33);
 assert.equal(run({rooftop:true,roofHeight:.75,xhhw2:false}).adder,0);
 assert.equal(run({rooftop:true,roofHeight:.74,xhhw2:true}).adder,0);
});
test('auto terminal defaults are conservative for small equipment',()=>{const r=run({continuous:30,ocpd:40,terminal:'auto',selection:'manual',size:'8'});assert.equal(r.selected.terminal,60);assert.equal(r.selected.term,40);});
test('motor 75hp 460V FLC is 96 A and requirement 120 A',()=>{const d=demand({...defaults(),loadType:'motor'});assert.equal(d.actual,96);assert.equal(d.design,120);assert.equal(d.thermal,120);});
test('incompatible motor voltage is blocked',()=>assert.ok(has(run({loadType:'motor',motorVoltage:230}),'motor-voltage')));
test('VFD input uses 125% of input rated current',()=>assert.equal(demand({...defaults(),loadType:'vfd',current:120}).design,150));
test('feeder OCPD below continuous load requirement is blocked',()=>assert.ok(has(run({ocpd:100}),'ocpd-load')));
test('custom impedance cannot be reused across autosized conductors',()=>assert.ok(has(run({vdMode:'custom',selection:'auto'}),'rx-sizing')));
test('steel and PVC voltage-drop columns differ',()=>{const a=run({selection:'manual',size:'350',conduitType:'RMC'}),b=run({selection:'manual',size:'350',conduitType:'PVC40'});assert.ok(a.selected.vd>b.selected.vd);assert.deepEqual(a.selected.z,[.039,.050]);});
test('MV code bend radius overrides smaller manufacturer input',()=>{const r=run({...mv,bendRadius:1,manufacturerBend:2});assert.ok(has(r,'radius'));near(r.selected.requiredBend,12*r.selected.cable.odIn);});
test('more than 360 degrees is rejected; 360 is permitted',()=>{assert.ok(has(run({bends:361}),'bends'));assert.ok(!has(run({bends:360}),'bends'));});
test('jamming warning remains even with a fourth EGC',()=>{const r=run({...mv,customCable:true,phaseOd:1.05,cableSource:'test',conduitSize:'3'});assert.equal(r.selected.contents.length,2);assert.ok(has(r,'jamming'));});
test('wet-only criteria, phase grouping, damage and classified areas fail closed',()=>{for(const [p,c] of [[{wetRated:false},'wet'],[{allPhases:false},'phase-group'],[{hazardous:true},'hazard'],[{damage:true,conduitType:'EMT'},'damage']])assert.ok(has(run(p),c));});
test('MV insulation level category clearing time limits',()=>{assert.ok(has(run({...mv,insulationLevel:100,clearingMinutes:2}),'insulation-level'));assert.ok(has(run({...mv,insulationLevel:133,clearingMinutes:61}),'insulation-level'));});
test('short circuit thermal screening does not accept deficient shield capacity',()=>{const r=run({...mv,faultKA:10,faultSeconds:1,withstandKA:20,shieldWithstandKA:5});assert.ok(has(r,'fault-duty'));});
test('invalid numbers and unsupported choices cannot yield a pass',()=>{for(const p of [{voltage:NaN},{sets:1.5},{sets:0},{pf:0},{current:Infinity},{length:-10},{fillTarget:54},{conduitType:'unknown'},{voltage:16000},{voltage:1500},{size:'unknown'},{groundMode:'none'},{continuous:-1}])assert.equal(run(p).status,'Blocked',JSON.stringify(p));});
test('all recorded LV checks can reach Calculated',()=>{const r=run({terminalConfirmed:true,review:{installation:true,pulling:true,protection:true,catalog:true}});assert.equal(r.status,'Calculated');});
test('hub registration, static build and local assets resolve',()=>{
 const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');assert.equal(read('index.html').match(/href="apps\/raceway-lab\/index.html"/g)?.length,1);assert.match(read('scripts/build.mjs'),/'raceway-lab'/);
 const page=new URL('../apps/raceway-lab/index.html',import.meta.url);
 for(const [,href] of read('apps/raceway-lab/index.html').matchAll(/(?:src|href)="([^"]+)"/g))assert.ok(existsSync(new URL(href,page)),href);
});

test('catalog MV insulation level and dual voltage ratings are enforced',()=>{assert.ok(has(run({...mv,insulationLevel:133}),'cable-insulation-level')); const r=run({...mv,family:'46102',cableVoltage:5000,insulationLevel:133});assert.ok(!has(r,'cable-insulation-level'));assert.ok(has(run({...mv,family:'46102',cableVoltage:8000,insulationLevel:133}),'cable-insulation-level'));});
