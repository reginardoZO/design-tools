import {LV, MV_1C, MV_3C, KCMIL, SIZES, EGC, GROUND_AREA, LV_CORRECTION, MV_CORRECTION, CONDUITS, CONDUIT_BEND, GROUND_KCMIL, MOTOR_FLC, MOTOR_VOLTAGES} from './data.js';
export const label = s => `${s} ${Number(s)>=250?'kcmil':'AWG'}`;
export const area = d => Math.PI*d*d/4;
export const cableRatings = c => c?.ratings||null;
export const defaults = () => ({version:4, name:'PlantSERV · Power circuit', voltage:480, loadType:'feeder', continuous:100, noncontinuous:0, continuousRatedAssembly:false, motorFLC:NaN, motorHp:1, motorVoltage:460, motorTrip:NaN, breakerRating:NaN, motorDuty:'continuous', driveInput:NaN, sets:1, circuits:1, neutral:'none', construction:'single', family:'3:1', selection:'auto', size:'1/0', insulation:90, terminal:'75', ambient:40, rooftop:false, roofHeight:1, wet:true, wetRated:true, cableVoltage:1000, conduitType:'RMC', conduitSize:'auto', isolated:true, allPhases:true, hazardous:false, damage:false, bends:180, ocpd:150, groundMode:'separate', insulationLevel:133, clearingMinutes:1});
export function motorTableFLC(horsepower, voltage){
 const column=[...MOTOR_VOLTAGES,2300].indexOf(Number(voltage));
 return column<0?null:MOTOR_FLC[String(horsepower)]?.[column]??null;
}
export const familyEntries = (catalog,p) => catalog.filter(c=>c.spec===p.family&&c.conductors===(p.construction==='single'?1:3));
// Union of the voltage / insulation-level ratings published for a family.
export function familyRatings(entries){
 const out={};
 for(const c of entries)for(const [v,l] of Object.entries(c.ratings||{}))out[v]=Math.max(out[v]||0,l);
 return Object.keys(out).length?out:null;
}
export function correction(mv,temp,rating){
 const cols=mv?[90,105]:[60,75,90]; const idx=cols.indexOf(rating);
 return idx<0 ? null : (mv?MV_CORRECTION:LV_CORRECTION).find(r=>temp<=r[0])?.[idx+1]??null;
}
export function adjustment(ccc){return ccc<=3?1:ccc<=6?.8:ccc<=9?.7:ccc<=20?.5:ccc<=30?.45:ccc<=40?.4:.35;}
export function demand(p){
 const mv=p.voltage>1000;
 if(p.loadType==='feeder'){
  if(mv)return {actual:p.continuous+p.noncontinuous,design:NaN,required:NaN,thermal:NaN,multiplier:'Not implemented',reference:'Article 235',basis:'A verified medium-voltage general feeder sizing basis is not implemented; no conductor recommendation is issued.'};
  const multiplier=p.continuousRatedAssembly?1:1.25;
  const required=multiplier*p.continuous+p.noncontinuous;
  return {actual:p.continuous+p.noncontinuous,design:required,required,thermal:required,multiplier:p.continuousRatedAssembly?'100% qualifying listed assembly':'125% continuous load',reference:'210.19(A)(1) / 215.2(A)(1)',basis:p.continuousRatedAssembly?'The qualifying assembly is identified for 100% continuous operation; continuous-load conductor sizing uses 100% only when the complete applicable assembly is listed for that operation.':'General feeder / branch circuit: 125% of continuous current + 100% of noncontinuous current.'};
 }
 if(p.loadType==='lv-motor'){
    const actual=motorTableFLC(p.motorHp,p.motorVoltage);
    const required=1.25*actual;
    return {actual,design:required,required,thermal:required,multiplier:'125% of applicable motor FLC',reference:'430.6(A)(1), 430.22, Table 430.250',basis:`Table 430.250 gives ${actual??'no listed value'} A for a ${p.motorHp} hp, ${p.motorVoltage} V motor; minimum conductor ampacity is 125% of that FLC under NEC 430.22.`};
 }
 if(p.loadType==='mv-motor'){
  const required=p.motorTrip;
  return {actual:Number.isFinite(p.motorFLC)?p.motorFLC:required,design:required,required,thermal:required,multiplier:'Not applicable — overload trip setting governs',reference:'430.205(A)',basis:'According to NEC 430.205(A), the required conductor ampacity is based on the motor overload protection trip setting. No automatic 125% multiplier has been applied to the motor full-load current.'};
 }
 const required=1.25*p.driveInput;
 return {actual:p.driveInput,design:required,required,thermal:required,multiplier:'125% of equipment rated input current',reference:mv?'430.205(B)':'430.122(A)',basis:`VFD input circuit: 125% of power conversion equipment rated input current under NEC ${mv?'430.205(B)':'430.122(A)'}. VFD output circuits are outside this model.`};
}
// NEC Chapter 9 Table 1: 1 item 53%, 2 items 31%, more than 2 items 40%.
export function fill(contents,conduit){
 const count=contents.reduce((n,x)=>n+x.count,0); const used=contents.reduce((n,x)=>n+x.count*x.area,0);
 const nec=count===1?53:count===2?31:40;
 return {count,used,nec,limit:nec,percent:100*used/conduit.area,allowed:conduit.area*nec/100,pass:used<=conduit.area*nec/100+1e-10};
}
export function grounding(ocpd,phase,minPhase,mv,integral=false){
 const base=EGC.find(([a])=>ocpd<=a)?.[1]; if(!base)return null;
 const ratio=Math.max(1,KCMIL[phase]/KCMIL[minPhase]);
 let required=KCMIL[base]*ratio;
 if(mv&&!integral)required=Math.max(required,KCMIL['6']);
 else if(!mv)required=Math.min(required,KCMIL[phase]);
 const size=SIZES.find(s=>KCMIL[s]>=required-1e-8);
 return size?{size,base,ratio,required,area:GROUND_AREA[size]}:null;
}
// Minimum cable bending radius derived from the catalog construction.
export function cableBend(c){
 if(!c)return null; const od=c.odIn;
 // Diameter of one of three equal round shielded cores inside the assembled core: core / (1 + 2/√3).
 const single=c.coreOdIn?c.coreOdIn/(1+2/Math.sqrt(3)):0;
 if(c.voltage>2000&&c.shielded){
  if(c.conductors===1)return {radius:12*od,rule:'12 × overall OD (shielded 1/C)',ref:'300.34 / 305.5'};
  const r=Math.max(12*single,7*od);
  return {radius:r,rule:`max(12 × individual shielded core ${single.toFixed(2)} in, 7 × overall OD)`,ref:c.armor==='clx'?'330.24(C) / 305.5':'300.34 / 305.5'};
 }
 if(c.armor==='clx')return {radius:7*od,rule:'7 × overall OD (corrugated metallic sheath)',ref:'330.24(B)'};
 const k=od<=1?4:od<=2?5:6;
 return {radius:k*od,rule:`${k} × overall OD (nonshielded, nonarmored; OD ${od<=1?'≤ 1.0':od<=2?'1.0–2.0':'> 2.0'} in)`,ref:c.conductors===3?'336.24':'ICEA S-95-658 / NEMA WC 70 (manufacturer guidance)'};
}
function issue(code,message,ref,level='block'){return {code,message,ref,level};}
const numKeys=['voltage','sets','circuits','insulation','ambient','roofHeight','cableVoltage','bends','ocpd','insulationLevel','clearingMinutes'];
export function validate(p){
 const out=[]; const add=(...x)=>out.push(issue(...x));
 for(const k of numKeys)if(typeof p[k]!=='number'||!Number.isFinite(p[k]))add('input',`${k}: enter a finite number.`,'Input validation');
 if(out.length)return out;
 const enums={loadType:['feeder','lv-motor','mv-motor','vfd-input'],motorDuty:['continuous','other'],neutral:['none','linear','nonlinear'],construction:['single','multi'],selection:['auto','manual'],terminal:['auto','60','75','90','105'],conduitType:Object.keys(CONDUITS),groundMode:['separate','integral']};
 for(const [k,values] of Object.entries(enums))if(!values.includes(p[k]))add('input',`${k}: unsupported choice.`,'Scope');
 if(typeof p.continuousRatedAssembly!=='boolean')add('input','The 100%-continuous assembly confirmation must be true or false.','Input validation');
 if(p.voltage<=0||p.voltage>15000)add('voltage','Use a system voltage above 0 V through 15 kV.','Articles 310 / 315');
 const mv=p.voltage>1000;
 if((p.loadType==='lv-motor'&&mv)||(p.loadType==='mv-motor'&&!mv))add('circuit-voltage','Choose the motor circuit type that matches the system voltage: LV is 1000 V or less; MV is greater than 1000 V.','430.22 / 430.205(A)');
 if(mv&&p.loadType==='feeder')add('mv-feeder-scope','A verified medium-voltage general feeder sizing basis is not implemented. No conductor recommendation can be issued.','Article 235');
 if(p.loadType==='feeder'){
  for(const k of ['continuous','noncontinuous'])if(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<0)add('input',`${k}: enter a finite nonnegative load current.`,'Input validation');
 }
 if(p.loadType==='lv-motor'){
    if(!Number.isFinite(Number(p.motorHp))||!Number.isFinite(motorTableFLC(p.motorHp,p.motorVoltage))||motorTableFLC(p.motorHp,p.motorVoltage)<=0)add('motor-flc','Select a motor horsepower and rated voltage with a listed Table 430.250 full-load current.','430.6(A)(1), 430.22, Table 430.250');
  if(p.motorDuty!=='continuous')add('motor-duty','This calculator covers continuous-duty motors only; apply the applicable alternative conductor-sizing rule for other duty ratings.','430.22(E)');
 }
 if(p.loadType==='mv-motor'){
  if(typeof p.motorTrip!=='number'||!Number.isFinite(p.motorTrip)||p.motorTrip<=0)add('motor-trip','Motor overload protection trip setting is required for medium-voltage motor conductor sizing under NEC 430.205(A). Enter the effective overload trip current in amperes.','430.205(A)');
  if(p.motorDuty!=='continuous')add('motor-duty','This calculator covers continuous-duty motors only; verify the applicable requirements for other duty ratings.','430.205(A)');
 }
 if(p.loadType==='vfd-input'&&(typeof p.driveInput!=='number'||!Number.isFinite(p.driveInput)||p.driveInput<=0))add('drive-input','Enter the power conversion equipment rated input current.','430.122(A) / 430.205(B)');
 for(const k of ['motorFLC','motorTrip','breakerRating','driveInput'])if(typeof p[k]!=='number'||(!Number.isFinite(p[k])&&!Number.isNaN(p[k]))||(Number.isFinite(p[k])&&p[k]<0))add('input',`${k}: enter a nonnegative value or leave it blank if optional.`,'Input validation');
 if(Number.isFinite(p.motorTrip)&&p.motorTrip<=0)add('motor-trip','Motor overload protection trip setting must be greater than zero.','430.205(A)');
 if(Number.isFinite(p.motorFLC)&&p.motorFLC<=0)add('motor-flc','Motor full-load current must be greater than zero when provided.','430.6(A)(1), 430.22');
 if(Number.isFinite(p.breakerRating)&&p.breakerRating<=0)add('breaker-rating','Circuit breaker rating must be greater than zero when provided.','Reference only');
 if(Number.isFinite(p.driveInput)&&p.driveInput<=0)add('drive-input','VFD rated input current must be greater than zero.','430.122(A) / 430.205(B)');
 for(const k of ['sets','circuits'])if(!Number.isInteger(p[k])||p[k]<1||p[k]>10)add('input',`${k}: use a whole number from 1 to 10.`,'Scope');
 if(p.ambient< -40||p.ambient>100)add('temperature','Ambient must be between −40 and 100°C. Verify cable low-temperature installation rating separately.','310.15(B) / 315.60(D)(4)');
 for(const k of ['roofHeight','bends','clearingMinutes'])if(p[k]<0)add('input',`${k}: negative values are not permitted.`,'Input validation');
 if(p.ocpd<=0||p.ocpd>6000||p.cableVoltage<=0)add('input','Check protection (1–6000 A) and cable voltage rating.','Input validation');
 if(!SIZES.includes(p.size))add('input','Unsupported conductor size.','Scope');
 if(![...(mv?[90,105]:[60,75,90])].includes(p.insulation))add('temperature','Select a supported insulation rating for this voltage class.','310.4 / 315.10(A)');
 if(mv&&!['90','105'].includes(p.terminal))add('terminal','MV calculation requires a 90°C or specifically identified 105°C termination basis.','110.40');
 if(!mv&&p.terminal==='105')add('terminal','105°C LV termination tables are outside this tool.','110.14(C)');
 if(mv&&(p.circuits!==1||!p.isolated))add('isolation','MV tabulated sizing requires one three-phase circuit per isolated conduit. Closely grouped conduits require an engineered thermal study.','315.60(B), (C)(7)/(9), (E)');
 if(mv&&p.neutral!=='none')add('neutral','MV table configuration is three phase conductors, without a loaded neutral.','315.60(C)(7)/(9)');
 if(p.construction==='multi'&&p.neutral!=='none')add('neutral','The multicore model is a 3/C power cable. Use single conductors for a full-size neutral.','Scope');
 if(p.groundMode==='integral'&&p.construction!=='multi')add('ground','An integral EGC requires a multiconductor cable. Cable shields are not credited as EGCs.','250.122 / 250.190');
 if(!p.allPhases)add('phase-group','Keep A, B, C and the associated neutral/EGC together in each raceway. Phase-segregated ferrous raceways are blocked.','300.3(B), 300.20 / 305.6');
 if(p.hazardous)add('hazard','Classified locations require a separate wiring-method, sealing and equipment review; this tool covers ordinary locations.','Articles 500–516');
 if(p.damage&&['EMT','PVC40'].includes(p.conduitType))add('damage','This selected method is not accepted here for severe physical damage. Select a suitable listed method and verify its use conditions.','358.12 / 352.10–12');
 if(p.wet&&!p.wetRated)add('wet','Raceway interiors in wet locations above grade are wet locations. Select conductors and fittings listed for wet use.','300.9 / 305.8');
 if(p.bends>360)add('bends','More than 360° between pull points: add a pull point or revise the route.','342.26 / 344.26 / 352.26 / 358.26');
 if(p.voltage>p.cableVoltage)add('rating','Cable voltage rating is below system voltage.','110.3(B) / 315.10');
 if(mv&&![100,133,173].includes(p.insulationLevel))add('insulation-level','Unsupported MV insulation level.','315.10(C)');
 if(mv&&((p.insulationLevel===100&&p.clearingMinutes>1)||(p.insulationLevel===133&&p.clearingMinutes>60)))add('insulation-level','Ground-fault clearing duration exceeds the selected insulation-level category.','315.10(C)');
 if(mv&&p.insulationLevel===173)add('insulation-level','173% insulation applications require an engineered cable and system review outside this catalog workflow.','315.10(C)');
 return out;
}
function baseAmps(p,size){
 const mv=p.voltage>1000;
 const terminal=p.terminal==='auto'?((p.ocpd<=100&&KCMIL[size]<=KCMIL['1'])?60:75):Number(p.terminal);
 if(mv){const row=(p.construction==='single'?MV_1C:MV_3C)[size];const offset=p.cableVoltage<=5000?0:2;
  return {base:row?.[offset+(p.insulation===105?1:0)],term:row?.[offset+(terminal===105?1:0)],terminal,ref:`315.60(C)(${p.construction==='single'?7:9})`};}
 return {base:LV[size]?.[[60,75,90].indexOf(p.insulation)],term:LV[size]?.[[60,75,90].indexOf(terminal)],terminal,ref:'310.16'};
}
function pickCable(entries,size,p){
 const rows=entries.filter(c=>c.size===size); if(!rows.length)return null;
 const wanted=rows.filter(c=>!!c.ground===(p.groundMode==='integral'));
 return (wanted.length?wanted:rows).sort((a,b)=>b.odIn-a.odIn)[0];
}
export function integralGround(c){return c?.ground?c.ground.count*(GROUND_KCMIL[c.ground.size]||0):0;}
export function calculate(p,catalog=[]){
 const load=demand(p);const issues=validate(p); if(issues.some(i=>i.level==='block'))return {status:'Blocked',issues,candidates:[],load};
 const mv=p.voltage>1000;
 const entries=familyEntries(catalog,p); const fam=entries[0];
 if(!fam)return {status:'Blocked',issues:[...issues,issue('family','Select an Okonite catalog family for this voltage class and construction.','Cable catalog')],candidates:[]};
 if(p.insulation>fam.maxTemp)issues.push(issue('insulation-rating',`${fam.title} is rated ${fam.maxTemp}°C; select ${fam.maxTemp}°C insulation basis.`,'310.4 / 315.10(A)'));
 if(!mv&&p.loadType==='feeder'&&p.ocpd<load.required)issues.push(issue('ocpd-load','Feeder OCPD is below the required continuous + noncontinuous load sizing basis. Verify the complete listed assembly and applicable protection requirements.','215.3'));
 if(!(load.actual>0)||!(load.required>0))return {status:'Blocked',issues:[...issues,issue('load','Enter a positive load and a valid required conductor ampacity.','Load inputs')],candidates:[],load};
 const xhhw2=!!fam.xhhw2;
 const adder=!mv&&p.rooftop&&p.roofHeight<.75&&!xhhw2?33:0;
 const ambient=p.ambient+adder;
 const factor=correction(mv,ambient,p.insulation);
 if(!factor)return {status:'Blocked',issues:[...issues,issue('temperature','No permitted correction factor at the entered ambient / insulation rating.','310.15(B)(1)(1) / 315.60(D)(4)')],candidates:[]};
 const ccc=(3+(p.neutral==='nonlinear'?1:0))*p.circuits;
 const adjust=mv?1:adjustment(ccc);
 const ampOptions=SIZES.map(size=>{
  const b=baseAmps(p,size); const corrected=b.base*factor*adjust;
  const parallelOK=p.sets===1||KCMIL[size]>=KCMIL['1/0'];
  const thermalPass=corrected*p.sets>=load.required-1e-9;
  const terminalPass=b.term*p.sets>=load.required-1e-9;
  // Conservative no-next-size-up protection rule; do not apply to motor/VFD or MV.
  const protectionPass=mv||p.loadType!=='feeder'||Math.min(corrected,b.term)*p.sets>=p.ocpd;
  const smallPass=mv||p.loadType!=='feeder'||!{'14':15,'12':20,'10':30}[size]||p.ocpd<=({'14':15,'12':20,'10':30}[size]);
  return {size,...b,corrected,allowed:Math.min(corrected,b.term)*p.sets,thermalPass,terminalPass,parallelOK,protectionPass,ampPass:parallelOK&&thermalPass&&terminalPass&&protectionPass&&smallPass&&!!b.base&&!!b.term};
 });
 // 250.122(B) baseline: smallest size with sufficient ampacity that the selected family actually offers.
 const minAmp=(ampOptions.find(x=>x.ampPass&&entries.some(c=>c.size===x.size))||ampOptions.find(x=>x.ampPass))?.size;
 if(!minAmp)return {status:'Blocked',issues:[...issues,issue('ampacity','No supported size meets load, termination and protection checks. Consider more equal parallel sets in separate conduits.','310.16 / 315.60; 110.14(C) / 110.40')],candidates:[],load,fam};
 const integral=p.groundMode==='integral';
 const options=ampOptions.filter(x=>p.selection==='auto'||x.size===p.size).map(a=>{
  const cable=pickCable(entries,a.size,p);
  const g=grounding(p.ocpd,a.size,minAmp,mv,integral);
  const od=cable?.odIn;
  const bend=cableBend(cable);
  const contents=od&&g?[{kind:'phase',count:p.circuits*(p.construction==='single'?3:1),area:area(od),diameter:od}]:[];
  if(p.neutral!=='none'&&od)contents.push({kind:'neutral',count:p.circuits,area:area(od),diameter:od});
  if(!integral&&g)contents.push({kind:'EGC',count:1,area:g.area,diameter:Math.sqrt(4*g.area/Math.PI)});
  const conduits=od&&g?CONDUITS[p.conduitType].map(c=>{
   const f=fill(contents,c); const bendRadius=CONDUIT_BEND[c.trade];
   const jamRatio=c.id/od, jamCorrected=1.05*jamRatio;
   const jam=p.construction==='single'&&jamCorrected>=2.8&&jamCorrected<=3.2;
   const bendPass=bendRadius>=bend.radius-1e-9;
   return {...c,...f,fillPass:f.pass,bendRadius,bendPass,jamRatio,jamCorrected,jam,pass:f.pass&&bendPass};
  }):[];
  const conduit=p.conduitSize==='auto'?(conduits.find(c=>c.pass&&!c.jam)||conduits.find(c=>c.pass)):conduits.find(c=>c.trade===p.conduitSize);
  const groundKcmil=integralGround(cable);
  const integralPass=!integral||(!!g&&groundKcmil>=g.required-1e-6);
  const cablePass=!!od&&cable.voltage>=p.voltage;
  // Use cable RATED voltage for MV columns (e.g. 15 kV cable on a 4.16 kV system).
  const voltageBandPass=!mv||!!cableRatings(cable)?.[p.cableVoltage];
  const levelPass=!mv||(cableRatings(cable)?.[p.cableVoltage]>=p.insulationLevel);
  const tempPass=!cable||p.insulation<=cable.maxTemp;
  return {...a,cable,g,bend,groundKcmil,contents,conduit,conduits,integralPass,cablePass,voltageBandPass,levelPass,tempPass,pass:a.ampPass&&cablePass&&voltageBandPass&&levelPass&&tempPass&&integralPass&&!!conduit?.pass};
 });
 const chosen=p.selection==='auto'?options.find(x=>x.pass):options[0];
 const selected=chosen||options.find(x=>x.ampPass&&x.cablePass)||options[0];
 if(!chosen)issues.push(issue('sizing','No candidate satisfies all numerical checks. Review the candidate table; missing catalog sizes are never treated as a pass.','Sizing results'));
 if(selected){
  if(!selected.ampPass)issues.push(issue('ampacity','Selected conductor does not meet ampacity, terminal, protection or parallel-size checks.','310.16 / 315.60; 110.14(C) / 110.40; 310.10(G)'));
  if(!selected.cable)issues.push(issue('cable',`${label(selected.size)} is not available in the selected Okonite family.`,'Okonite catalog'));
  else if(!selected.cablePass)issues.push(issue('cable','Cable voltage rating is below the system voltage.','110.3(B)'));
  if(selected.cable&&!selected.voltageBandPass)issues.push(issue('voltage-band','MV cable rated voltage does not match the selected ampacity voltage band.','315.60(C)(7)/(9)'));
  if(selected.cable&&selected.voltageBandPass&&!selected.levelPass)issues.push(issue('cable-insulation-level','Selected catalog cable insulation level at this voltage rating is below the specified requirement.','315.10(C)'));
  if(selected.cable&&!selected.integralPass)issues.push(issue('ground',selected.cable.ground?`Integral grounding conductors (${selected.cable.ground.count} × ${label(selected.cable.ground.size)} = ${selected.groundKcmil.toFixed(2)} kcmil) are smaller than the required ${selected.g?.required.toFixed(2)} kcmil copper EGC.`:'The selected cable has no integral grounding conductor. Use a separate EGC.','250.122'));
  const c=selected.conduit;
  if(selected.cable&&selected.g){
   if(!c)issues.push(issue('fill',`No ${p.conduitType} trade size meets both the NEC fill limit and the cable bending radius.`,'Chapter 9, Tables 1 and 2'));
   else{
    if(!c.fillPass)issues.push(issue('fill',`${c.trade} in ${p.conduitType} exceeds the NEC ${c.nec}% fill limit.`,'Chapter 9, Table 1'));
    if(!c.bendPass)issues.push(issue('radius',`${c.trade} in conduit bend radius ${c.bendRadius} in (Chapter 9 Table 2) is below the cable minimum bending radius ${selected.bend.radius.toFixed(2)} in.`,`Chapter 9 Table 2; ${selected.bend.ref}`));
    if(c.jam)issues.push(issue('jamming','The phase-cable jam screening ratio is in 2.8–3.2. Select a different conduit size or document an engineered pulling method.','Manufacturer installation guidance','review'));
   }
  }
 }
 const status=issues.some(i=>i.level==='block')?'Blocked':issues.some(i=>i.level==='review')?'Review required':'Calculated';
 return {status,issues,load,mv,fam,xhhw2,ambient,adder,factor,ccc,adjust,minAmp,selected,candidates:options};
}
