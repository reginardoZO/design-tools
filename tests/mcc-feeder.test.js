import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateMccFeeder, newMccLoad} from '../shared/mcc-feeder.js';
import {computeLoad, computeSizing} from '../apps/nec-cable-tray/src/engine.js';
import {calculate, demand, newProject} from '../apps/raceway-lab/engine.js';
import {loadProject} from '../apps/raceway-lab/project.js';

const near=(actual,expected,tol=1e-8)=>assert.ok(Math.abs(actual-expected)<=tol,`${actual} != ${expected}`);
const motor=(tag,hp,quantity=1)=>({...newMccLoad('motor',tag),tag,horsepower:hp,quantity,voltage:480,phases:3});
const amps=(tag,type,current,duty='continuous',quantity=1)=>({...newMccLoad(type,tag),tag,type,driveInputCurrent:current,ratingUnit:'A',rating:current,quantity,voltage:480,phases:3,duty});
const tableLookup=(hp)=>({small:30,medium:65,large:100,'50':65}[hp]??null);
const catalog=JSON.parse(readFileSync(new URL('../apps/raceway-lab/catalog.json',import.meta.url)));

test('four identical 50 HP motors apply 125% to only one motor',()=>{
 const m=computeLoad({type:'mcc',voltage:'480',phases:3,frequency:60,mccLoads:[motor('M-1','50',4)]}).mcc;
 assert.equal(m.valid,true);near(m.totalConnectedCurrent,260);near(m.required,276.25);near(m.largestMotorContribution,81.25);
});

test('both app sizing engines receive the 276.25 A MCC feeder requirement',()=>{
 const mccLoads=[motor('M-1','50',4)];
 const trayLoad=computeLoad({type:'mcc',voltage:'480',phases:3,frequency:60,mccLoads});
 const tray=computeSizing({
  designI:trayLoad.design,ambient:30,insTemp:90,termTemp:75,vClass:'lv',
  construction:'multi',arrangement:'touching',covered:false,ccc:3,maxSets:4,
  maxSize:'1000',ambMethod:'table',vd:{on:false},
 });
 near(trayLoad.design,276.25);assert.ok(tray.recommended.row.allowed>=276.25);
 const raceway=calculate({...newProject(),loadType:'mcc-feeder',voltage:480,phases:3,frequency:60,mccLoads,ocpd:400,family:'2:8/133'},catalog);
 near(raceway.load.required,276.25);assert.ok(raceway.selected.ampPass);
 assert.ok(raceway.issues.some(issue=>issue.code==='mcc-protection-unverified'));
});

test('optional Raceway voltage drop uses MCC operating current and rejects mixed-phase approximation',()=>{
 const p={...newProject(),loadType:'mcc-feeder',mccLoads:[motor('M-1','50',4)],ocpd:400,
  conduitType:'PVC40',vdEnabled:true,vdMethod:'reference',vdLength:400};
 const r=calculate(p,catalog);
 near(r.load.required,276.25);near(r.voltageDrop.current,260);
 assert.equal(r.voltageDrop.valid,true);
 const single={...amps('AB','general',20),phases:1,phasePair:'AB'};
 const mixed=calculate({...p,mccLoads:[...p.mccLoads,single]},catalog);
 assert.equal(mixed.voltageDrop.valid,false);
 assert.ok(mixed.voltageDrop.errors.some(e=>e.includes('phase-by-phase')));
});

test('motors, continuous load, and noncontinuous load use the 430.24 feeder formula',()=>{
 const loads=[motor('M1','50'),motor('M2','50'),amps('H1','general',30,'continuous'),amps('L1','general',20,'noncontinuous')];
 const {mcc}=computeLoad({type:'mcc',voltage:'480',phases:3,frequency:60,mccLoads:loads});
 near(mcc.required,203.75);near(mcc.continuousNonmotorContribution,37.5);near(mcc.noncontinuousNonmotorCurrent,20);
});

test('VFD input current and DOL motor current share one largest-motor factor',()=>{
 const loads=[{...amps('VFD-1','vfd',80),driveInputCurrent:80},motor('M-1','50')];
 const result=calculateMccFeeder({voltage:480,phases:3,frequency:60,loads,lookupMotorFLC:()=>50});
 near(result.required,150);assert.equal(result.largestMotorTag,'VFD-1');
});

test('different motor sizes boost only the largest individual motor contribution',()=>{
 const result=calculateMccFeeder({voltage:480,phases:3,frequency:60,loads:[motor('small','small'),motor('medium','medium'),motor('large','large')],lookupMotorFLC:tableLookup});
 near(result.required,220);near(result.remainingMotorCurrent,95);
});

test('30 kW three-phase heater computes current and continuous contribution',()=>{
 const heater={...newMccLoad('heater','H-1'),type:'heater',tag:'H-1',rating:30,ratingUnit:'kW',powerFactor:1,voltage:480,phases:3,duty:'continuous'};
 const result=calculateMccFeeder({voltage:480,phases:3,frequency:60,loads:[heater]});
 near(result.loads[0].current,30000/(Math.sqrt(3)*480));near(result.required,45.1054897804,1e-7);
});

test('transformer ratings are not automatically treated as continuous',()=>{
 const rated={...newMccLoad('transformer','T-1'),type:'transformer',rating:75,ratingUnit:'kVA',voltage:480,phases:3,duty:'noncontinuous',primaryVoltage:480,secondaryVoltage:208,transformerSide:'primary'};
 const result=calculateMccFeeder({voltage:480,phases:3,frequency:60,loads:[rated]});
 near(result.required,75000/(Math.sqrt(3)*480));
 const calculated={...rated,transformerBasis:'calculated',rating:40,ratingUnit:'kVA',continuousPercent:50};
 const mixed=calculateMccFeeder({voltage:480,phases:3,frequency:60,loads:[calculated]});
 near(mixed.required,(40000/(Math.sqrt(3)*480))*1.125);
});

test('feeder protection rating does not replace calculated conductor ampacity',()=>{
 const loads=[motor('M-1','50',4)];
 const load=demand({...newProject(),loadType:'mcc-feeder',voltage:480,phases:3,frequency:60,mccLoads:loads,ocpd:400});
 near(load.required,276.25);assert.match(load.protectionStatus,/not certified/i);
});

test('quantity, mixed phase allocation, and invalid voltage are handled explicitly',()=>{
 const single={...amps('L-1','general',12),phases:1,phasePair:'AB',quantity:2};
 const result=calculateMccFeeder({voltage:480,phases:3,loads:[single]});
 assert.equal(result.valid,true);near(result.required,30);assert.ok(result.warnings.some(x=>/summed conservatively/.test(x)));
 const invalid=calculateMccFeeder({voltage:480,phases:3,loads:[{...single,voltage:240}]});
 assert.equal(invalid.valid,false);assert.match(invalid.errors.join(' '),/voltage must match/);
});

test('unsupported bypass and noncontinuous motor duty block conductor recommendations',()=>{
 const bypass={...amps('V-1','vfd',80),bypass:true};
 assert.equal(calculateMccFeeder({voltage:480,phases:3,loads:[bypass]}).valid,false);
 const duty={...motor('M-1','50'),duty:'other'};
 assert.equal(calculateMccFeeder({voltage:480,phases:3,loads:[duty]}).valid,false);
});

test('raceway project v5 migration remains backward compatible and v7 preserves MCC loads',()=>{
 const old={...newProject(),version:5};for(const key of ['mccId','mccDescription','frequency','mccLoads'])delete old[key];
 const migrated=loadProject(JSON.parse(JSON.stringify(old)));assert.equal(migrated.version,7);assert.deepEqual(migrated.mccLoads,[]);
 const current={...newProject(),loadType:'mcc-feeder',mccId:'MCC-1',frequency:60,mccLoads:[motor('M-1','50')]};
 const restored=loadProject(JSON.parse(JSON.stringify(current)));
 assert.equal(restored.mccId,'MCC-1');assert.equal(restored.mccLoads[0].tag,'M-1');
 assert.throws(()=>loadProject({...current,mccLoads:[null]}));
});
