import {LV, MV_1C, MV_3C, KCMIL, SIZES, EGC, GROUND_AREA, LV_CORRECTION, MV_CORRECTION, CONDUITS, ARTICLES, Z, MOTOR_FLC} from './data.js';
export const label = s => `${s} ${Number(s)>=250?'kcmil':'AWG'}`;
export const area = d => Math.PI*d*d/4;
export function cableRatings(c){return ({'46101':{5000:100},'46102':{5000:133,8000:100},'46203':{5000:133,8000:100},'46301':{15000:100},'46302':{15000:133},'46401':{15000:100}})[c?.spec]||null;}
export const defaults = () => ({version:1, name:'PlantSERV · Power circuit', voltage:480, loadType:'feeder', continuous:100, noncontinuous:0, motorHp:75, motorVoltage:460, motorCurrent:96, current:100, designCurrent:125, loadSource:'', sets:1, circuits:1, neutral:'none', construction:'single', family:'45002', selection:'auto', size:'1/0', insulation:90, terminal:'75', terminalConfirmed:false, ambient:40, rooftop:false, roofHeight:1, xhhw2:true, wet:true, wetRated:true, cableVoltage:1000, phaseOd:0.48, customCable:false, cableSource:'', conduitType:'RMC', conduitSize:'auto', fillTarget:40, isolated:true, allPhases:true, hazardous:false, damage:false, corrosion:false, bends:180, bendRadius:24, manufacturerBend:0, coreOd:0, length:200, pf:.85, vdLimit:3, vdMode:'table', resistance:.1, reactance:.05, impedanceSource:'', ocpd:150, groundMode:'separate', integralGround:'6', insulationLevel:133, clearingMinutes:1, faultKA:10, faultSeconds:.1, withstandKA:0, shieldWithstandKA:0, review:{}});
export function correction(mv,temp,rating){
 const cols=mv?[90,105]:[60,75,90]; const idx=cols.indexOf(rating);
 return idx<0 ? null : (mv?MV_CORRECTION:LV_CORRECTION).find(r=>temp<=r[0])?.[idx+1]??null;
}
export function adjustment(ccc){return ccc<=3?1:ccc<=6?.8:ccc<=9?.7:ccc<=20?.5:ccc<=30?.45:ccc<=40?.4:.35;}
export function demand(p){
 if(p.loadType==='feeder')return {actual:p.continuous+p.noncontinuous, design:1.25*p.continuous+p.noncontinuous, thermal:p.continuous+p.noncontinuous, basis:'215.2(A)(1): 125% continuous + 100% noncontinuous before correction; adjusted ampacity ≥ actual load.'};
 if(p.loadType==='motor'){
  const cols=[200,208,230,460,575,2300]; const current=MOTOR_FLC[String(p.motorHp)]?.[cols.indexOf(p.motorVoltage)];
  return {actual:current,design:1.25*current,thermal:1.25*current,basis:'430.6(A)(1), 430.22, Table 430.250: 125% of table FLC. One continuous-duty AC motor; overload and short-circuit protection are separate.'};
 }
 if(p.loadType==='vfd')return {actual:p.current,design:1.25*p.current,thermal:1.25*p.current,basis:'430.122(A): 125% of drive rated input current; drive input feeder only.'};
 return {actual:p.current,design:p.designCurrent,thermal:p.designCurrent,basis:'Engineer-entered minimum ampacity. Record the applicable load rule (Article 235 / 430 for MV); no blanket multiplier is assumed.'};
}
export function fill(contents,conduit,target=40){
 const count=contents.reduce((n,x)=>n+x.count,0); const used=contents.reduce((n,x)=>n+x.count*x.area,0);
 const nec=count===1?53:count===2?31:40; const limit=Math.min(nec,target);
 return {count,used,nec,limit,percent:100*used/conduit.area,allowed:conduit.area*limit/100,pass:used<=conduit.area*limit/100+1e-10};
}
export function grounding(ocpd,phase,minPhase,mv){
 const base=EGC.find(([a])=>ocpd<=a)?.[1]; if(!base)return null;
 const ratio=Math.max(1,KCMIL[phase]/KCMIL[minPhase]);
 let required=KCMIL[base]*ratio;
 if(mv)required=Math.max(required,KCMIL['6']);
 else required=Math.min(required,KCMIL[phase]);
 const size=SIZES.find(s=>KCMIL[s]>=required-1e-8);
 return size?{size,base,ratio,required,area:GROUND_AREA[size]}:null;
}
function issue(code,message,ref,level='block'){return {code,message,ref,level};}
const numKeys=['voltage','continuous','noncontinuous','motorHp','motorVoltage','current','designCurrent','sets','circuits','insulation','ambient','roofHeight','cableVoltage','phaseOd','fillTarget','bends','bendRadius','manufacturerBend','coreOd','length','pf','vdLimit','resistance','reactance','ocpd','clearingMinutes','faultKA','faultSeconds','withstandKA','shieldWithstandKA'];
export function validate(p){
 const out=[]; const add=(...x)=>out.push(issue(...x));
 for(const k of numKeys) {
  if(['resistance','reactance'].includes(k)&&p.vdMode==='table')continue;
  if(typeof p[k]!=='number'||!Number.isFinite(p[k]))add('input',`${k}: enter a finite number.`,'Input validation');
 }
 if(out.length)return out;
 if(p.vdMode==='custom'&&p.resistance<=0)add('impedance','Enter positive AC resistance for the selected conductor.','Engineering voltage-drop calculation');
 const enums={loadType:['feeder','motor','vfd','custom'],neutral:['none','linear','nonlinear'],construction:['single','multi'],selection:['auto','manual'],terminal:['auto','60','75','90','105'],conduitType:Object.keys(CONDUITS),groundMode:['separate','integral'],vdMode:['table','custom']};
 for(const [k,values] of Object.entries(enums))if(!values.includes(p[k]))add('input',`${k}: unsupported choice.`,'Scope');
 if(p.voltage<=0||p.voltage>15000||(p.voltage>1000&&p.voltage<=2000))add('voltage','Use LV ≤1000 V ac or MV >2000 V through 15 kV. The 1001–2000 V transition needs a separately verified basis.','Articles 310 / 315');
 for(const k of ['sets','circuits'])if(!Number.isInteger(p[k])||p[k]<1||p[k]>10)add('input',`${k}: use a whole number from 1 to 10.`,'Scope');
 if(p.ambient< -40||p.ambient>100)add('temperature','Ambient must be between −40 and 100°C. Verify cable low-temperature installation rating separately.','310.15(B) / 315.60(D)(4)');
 for(const k of ['continuous','noncontinuous','current','designCurrent','roofHeight','bends','manufacturerBend','coreOd','length','resistance','reactance','clearingMinutes','faultKA','faultSeconds','withstandKA','shieldWithstandKA'])if(p[k]<0)add('input',`${k}: negative values are not permitted.`,'Input validation');
 if(p.ocpd<=0||p.ocpd>6000||p.pf<=0||p.pf>1||p.vdLimit<=0||p.fillTarget<=0||p.fillTarget>53||p.bendRadius<=0||p.cableVoltage<=0||p.phaseOd<=0)add('input','Check protection (1–6000 A), power factor (0–1), positive diameters/radius, fill target (≤53%) and voltage-drop limit.','Input validation');
 if(!SIZES.includes(p.size)||!SIZES.includes(p.integralGround))add('input','Unsupported conductor size.','Scope');
 const mv=p.voltage>2000;
 if(![...(mv?[90,105]:[60,75,90])].includes(p.insulation))add('temperature','Select a supported insulation rating for this voltage class.','310.4 / 315.10(A)');
 if(mv&&!['90','105'].includes(p.terminal))add('terminal','MV calculation requires a 90°C or specifically identified 105°C termination basis.','110.40');
 if(!mv&&p.terminal==='105')add('terminal','105°C LV termination tables are outside this tool.','110.14(C)');
 if(!mv&&p.loadType==='motor'&&!({200:[200,208],208:[208],230:[220,230,240],460:[440,460,480],575:[550,575,600]}[p.motorVoltage]||[]).includes(p.voltage))add('motor-voltage','Motor table voltage does not match the system. For other systems enter an engineered load basis.','430.250');
 if(mv&&p.loadType!=='custom')add('load','For MV, enter the design current and its engineering basis. LV load rules are not automatically applied.','Articles 235 / 430');
 if(mv&&(p.circuits!==1||!p.isolated))add('isolation','MV tabulated sizing requires one three-phase circuit per isolated conduit. Closely grouped conduits require an engineered thermal study.','315.60(B), (C)(7)/(9), (E)');
 if(mv&&p.neutral!=='none')add('neutral','MV table configuration is three phase conductors, without a loaded neutral.','315.60(C)(7)/(9)');
 if(p.construction==='multi'&&p.neutral!=='none')add('neutral','The multicore model is a 3/C power cable. Use single conductors for a full-size neutral.','Scope');
 if(p.groundMode==='integral'&&p.construction!=='multi')add('ground','An integral EGC requires a multiconductor cable. Cable shields are not credited as EGCs.','250.122 / 250.190');
 if(!p.allPhases)add('phase-group','Keep A, B, C and the associated neutral/EGC together in each raceway. Phase-segregated ferrous raceways are blocked.','300.3(B), 300.20 / 305.6');
 if(p.hazardous)add('hazard','Classified locations require a separate wiring-method, sealing and equipment review; this tool covers ordinary locations.','Articles 500–516');
 if(p.damage&&['EMT','PVC40'].includes(p.conduitType))add('damage','This selected method is not accepted here for severe physical damage. Select a suitable listed method and verify its use conditions.','358.12 / 352.10–12');
 if(p.wet&&!p.wetRated)add('wet','Raceway interiors in wet locations above grade are wet locations. Select conductors and fittings listed for wet use.','300.9 / 305.8');
 if(p.bends>360)add('bends','More than 360° between pull points: add a pull point or revise the route.','342.26 / 344.26 / 352.26 / 358.26');
 if(p.customCable&&p.selection==='auto')add('custom','Custom cable dimensions apply to one size only. Select manual verification.','Construction data');
 if(p.voltage>p.cableVoltage)add('rating','Cable voltage rating is below system voltage.','110.3(B) / 315.10');
 if(p.loadType==='custom'&&!p.loadSource.trim())add('load-source','Enter the source of the required design current.','Article 235 / applicable load article','review');
 if(p.vdMode==='custom'&&!p.impedanceSource.trim())add('impedance-source','Record the source, conductor temperature and arrangement for R and X.','Engineering voltage-drop calculation','review');
 if(p.customCable&&!p.cableSource.trim())add('cable-source','Record the manufacturer/type and source for the cable OD and voltage rating.','Chapter 9 Notes (5)/(9)','review');
 if(mv&&![100,133,173].includes(p.insulationLevel))add('insulation-level','Unsupported MV insulation level.','315.10(C)');
 if(mv&&((p.insulationLevel===100&&p.clearingMinutes>1)||(p.insulationLevel===133&&p.clearingMinutes>60)))add('insulation-level','Ground-fault clearing duration exceeds the selected insulation-level category.','315.10(C)');
 if(mv&&p.insulationLevel===173)add('insulation-level','173% insulation applications require an engineered cable and system review outside this catalog workflow.','315.10(C)');
 return out;
}
function baseAmps(p,size){
 const mv=p.voltage>2000;
 const terminal=p.terminal==='auto'?((p.ocpd<=100&&KCMIL[size]<=KCMIL['1'])?60:75):Number(p.terminal);
 if(mv){const row=(p.construction==='single'?MV_1C:MV_3C)[size];const offset=p.cableVoltage<=5000?0:2;
  return {base:row?.[offset+(p.insulation===105?1:0)],term:row?.[offset+(terminal===105?1:0)],terminal,ref:`315.60(C)(${p.construction==='single'?7:9})`};}
 return {base:LV[size]?.[[60,75,90].indexOf(p.insulation)],term:LV[size]?.[[60,75,90].indexOf(terminal)],terminal,ref:'310.16'};
}
function impedance(p,size){
 if(p.vdMode==='custom')return [p.resistance,p.reactance];
 if(p.voltage>600||p.construction!=='single')return null;
 const z=Z[size];if(!z)return null; const steel=['RMC','IMC','EMT'].includes(p.conduitType);
 return steel?[z[1],z[3]]:[z[0],z[2]];
}
export function calculate(p,catalog=[]){
 const issues=validate(p); if(issues.some(i=>i.level==='block'))return {status:'Blocked',issues,candidates:[]};
 const mv=p.voltage>2000; const load=demand(p);
 if(!mv&&p.loadType==='feeder'&&p.ocpd<load.design)issues.push(issue('ocpd-load','Feeder OCPD is below 125% continuous + noncontinuous load. The 100%-rated exception is not implemented.','215.3'));
 if(!mv&&p.loadType==='custom'&&p.ocpd<load.actual)issues.push(issue('ocpd-load','OCPD rating is below the entered operating current.','Article 240'));
 if(!(load.actual>0)||!(load.design>=load.actual)||!(load.thermal>0))return {status:'Blocked',issues:[...issues,issue('load','Enter a positive load and a required ampacity not below operating current.','Load inputs')],candidates:[]};
 const adder=!mv&&p.rooftop&&p.roofHeight<.75&&!p.xhhw2?33:0;
 const ambient=p.ambient+adder;
 const factor=correction(mv,ambient,p.insulation);
 if(!factor)return {status:'Blocked',issues:[...issues,issue('temperature','No permitted correction factor at the entered ambient / insulation rating.','310.15(B)(1)(1) / 315.60(D)(4)')],candidates:[]};
 const ccc=(3+(p.neutral==='nonlinear'?1:0))*p.circuits;
 const adjust=mv?1:adjustment(ccc);
 const ampOptions=SIZES.map(size=>{
  const b=baseAmps(p,size); const corrected=b.base*factor*adjust;
  const parallelOK=p.sets===1||KCMIL[size]>=KCMIL['1/0'];
  const thermalPass=corrected*p.sets>=load.thermal-1e-9;
  const terminalPass=b.term*p.sets>=load.design-1e-9;
  // Conservative no-next-size-up protection rule; do not apply to motor/VFD or MV.
  const protectionPass=mv||['motor','vfd'].includes(p.loadType)||Math.min(corrected,b.term)*p.sets>=p.ocpd;
  const smallPass=mv||['motor','vfd'].includes(p.loadType)||!{'14':15,'12':20,'10':30}[size]||p.ocpd<=({'14':15,'12':20,'10':30}[size]);
  return {size,...b,corrected,allowed:Math.min(corrected,b.term)*p.sets,thermalPass,terminalPass,parallelOK,protectionPass,ampPass:parallelOK&&thermalPass&&terminalPass&&protectionPass&&smallPass&&!!b.base&&!!b.term};
 });
 const minAmp=ampOptions.find(x=>x.ampPass)?.size;
 if(!minAmp)return {status:'Blocked',issues:[...issues,issue('ampacity','No supported size meets load, termination and protection checks. Consider more equal parallel sets in separate conduits or revise the engineering basis.','310.16 / 315.60; 110.14(C) / 110.40')],candidates:[],load};
 const options=ampOptions.filter(x=>p.selection==='auto'||x.size===p.size).map(a=>{
  const cable=p.customCable?{odIn:p.phaseOd,voltage:p.cableVoltage,sourceUrl:p.cableSource,title:'Custom construction'}:catalog.filter(c=>c.spec===p.family&&c.size===a.size&&c.conductors===(p.construction==='single'?1:3)).sort((a,b)=>b.odIn-a.odIn)[0];
  const g=grounding(p.ocpd,a.size,minAmp,mv);
  const z=impedance(p,a.size);
  const drop=z?Math.sqrt(3)*load.actual*p.length/1000*(z[0]*p.pf+z[1]*Math.sqrt(1-p.pf*p.pf))/p.sets:null;
  const vd=drop===null?null:100*drop/p.voltage;
  const od=cable?.odIn;
  const contents=od&&g?[{kind:'phase',count:p.circuits*(p.construction==='single'?3:1),area:area(od),diameter:od}]:[];
  if(p.neutral!=='none'&&od)contents.push({kind:'neutral',count:p.circuits,area:area(od),diameter:od});
  if(p.groundMode==='separate'&&g)contents.push({kind:'EGC',count:1,area:g.area,diameter:Math.sqrt(4*g.area/Math.PI)});
  const conduits=od&&g?CONDUITS[p.conduitType].map(c=>({...c,...fill(contents,c,p.fillTarget)})):[];
  const conduit=p.conduitSize==='auto'?conduits.find(c=>c.pass):conduits.find(c=>c.trade===p.conduitSize);
  const integralPass=p.groundMode!=='integral'||KCMIL[p.integralGround]>=KCMIL[g?.size];
  const cablePass=!!od&&cable.voltage>=p.voltage;
  // Use cable RATED voltage for MV columns (e.g. 15 kV cable on a 4.16 kV system).
  const voltageBandPass=!mv||p.customCable||!!cableRatings(cable)?.[p.cableVoltage];
  const levelPass=!mv||p.customCable||(cableRatings(cable)?.[p.cableVoltage]>=p.insulationLevel);
  return {...a,cable,g,z,drop,vd,contents,conduit,conduits,integralPass,cablePass,voltageBandPass,levelPass,pass:a.ampPass&&cablePass&&voltageBandPass&&levelPass&&integralPass&&!!conduit?.pass&&vd!==null&&vd<=p.vdLimit};
 });
 const chosen=p.selection==='auto'?options.find(x=>x.pass):options[0];
 const selected=chosen||options.find(x=>x.ampPass&&x.cablePass)||options[0];
 if(!chosen)issues.push(issue('sizing','No candidate satisfies all numerical checks. Review the candidate table; missing impedance, geometry or catalog sizes are never treated as a pass.','Sizing results'));
 if(selected){
  if(!selected.ampPass)issues.push(issue('ampacity','Selected conductor does not meet ampacity, terminal, protection or parallel-size checks.','310.16 / 315.60; 110.14(C) / 110.40; 310.10(G)'));
  if(!selected.cablePass)issues.push(issue('cable','Cable construction/diameter is missing or its voltage rating is insufficient.','110.3(B); Chapter 9'));
  if(!selected.voltageBandPass)issues.push(issue('voltage-band','MV cable rated voltage does not match the selected ampacity voltage band.','315.60(C)(7)/(9)'));
  if(!selected.levelPass)issues.push(issue('cable-insulation-level','Selected catalog cable insulation level at this voltage rating is below the specified requirement.','315.10(C)'));
  if(!selected.integralPass)issues.push(issue('ground','Integral grounding conductor is smaller than the calculated copper EGC requirement.','250.122 / 250.190'));
  if(!selected.conduit?.pass)issues.push(issue('fill','No selected conduit meets the NEC limit and design fill target.','Chapter 9, Table 1'));
  if(selected.vd===null)issues.push(issue('impedance','Enter verified R and X for MV or multicore cables, or choose a size covered by Table 9 for LV single conductors.','Engineering voltage-drop calculation'));
  else if(selected.vd>p.vdLimit)issues.push(issue('voltage-drop','Voltage drop exceeds your project limit.','Project criterion; 210.19 / 215.2 informational notes'));
  const od=selected.cable?.odIn||0;
  const codeBend=mv?(p.construction==='single'?12*od:Math.max(7*od,12*p.coreOd)):0;
  const requiredBend=Math.max(codeBend,p.manufacturerBend);
  if(p.bendRadius<requiredBend)issues.push(issue('radius',`Bend radius ${p.bendRadius} in is below required ${requiredBend.toFixed(2)} in. Use the cable inside bend radius, not the conduit trade size.`,'305.5 / manufacturer'));
  if(mv&&p.construction==='multi'&&!(p.coreOd>0))issues.push(issue('core-od','Enter the individual shielded-core OD for the 3/C MV bending-radius check.','305.5','review'));
  selected.requiredBend=requiredBend;
  selected.jamRatio=od&&selected.conduit?selected.conduit.id/od:null;
  selected.jamCorrected=selected.jamRatio?1.05*selected.jamRatio:null;
  if(p.construction==='single'&&selected.jamCorrected>=2.8&&selected.jamCorrected<=3.2)issues.push(issue('jamming','The phase-cable jam screening ratio is in 2.8–3.2. Increase the conduit or document an engineered pulling method. EGC/neutral do not remove this risk.','Southwire installation guidance',p.review?.pulling?'note':'review'));
 }
 if(p.terminal!=='auto'&&!p.terminalConfirmed)issues.push(issue('terminal-review','Confirm the equipment terminal temperature marking used in this calculation.','110.14(C) / 110.40','review'));
 if(mv&&p.rooftop&&!p.review?.installation)issues.push(issue('solar','MV solar exposure needs a documented effective ambient / thermal assessment. The LV rooftop adder is not automatically applied to MV.','315.60(B)/(E)','review'));
 if(p.corrosion&&!p.review?.installation)issues.push(issue('corrosion','Confirm material, coating and fittings for the corrosive environment.','300.6; applicable raceway article','review'));
 if(p.sets>1&&!p.review?.installation)issues.push(issue('parallel-review','Verify equal lengths, conductor construction and terminations; each raceway contains one complete ABC set and a full-size EGC.','310.10(G); 250.122(F)','review'));
 if(p.vdMode==='custom'&&p.selection==='auto')issues.push(issue('rx-sizing','Custom R and X apply to one cable size. Use manual verification so changing size cannot reuse the same impedance silently.','Engineering input'));
 if(mv){
  const duty=p.faultKA*Math.sqrt(p.faultSeconds);
  if(!(p.withstandKA>0&&p.shieldWithstandKA>0&&p.faultKA>0&&p.faultSeconds>0&&p.faultSeconds<=5))issues.push(issue('fault-data','Enter positive fault current, clearing time (up to 5 s), and manufacturer 1-second conductor/shield withstand ratings. Confirm I√t scaling is applicable.','110.10; 250.190(C); manufacturer','review'));
  else if(duty>p.withstandKA||duty>p.shieldWithstandKA)issues.push(issue('fault-duty','Entered I√t fault duty exceeds the conductor or shield 1-second rating.','110.10; manufacturer'));
 }
 const checks=[['installation','Wiring method, wet rating, corrosion, supports and expansion'],['pulling','Pull tension, sidewall pressure, bend radius and pull boxes'],['protection','OCPD/relay coordination, fault duty and equipment ratings'],['catalog','Manufacturer cable geometry, insulation rating and grounding construction']];
 for(const [id,title] of checks)if(!p.review?.[id])issues.push(issue(`review-${id}`,title+' still needs project review.','Installation review','review'));
 const status=issues.some(i=>i.level==='block')?'Blocked':issues.some(i=>i.level==='review')?'Review required':'Calculated';
 return {status,issues,load,mv,ambient,adder,factor,ccc,adjust,minAmp,selected,candidates:options};
}
