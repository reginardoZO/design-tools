// NEC 2023 installation-method screening. No ampacity/current is calculated.
// Unverified and unsupported conditions block report issue, not draft recovery.
import {calculateCompartment,isMC,isMV,sizeToKcmil} from './nec.js';
import {arrangementSettings,isTrefoil,circuitPolicyIssues} from './arrangement.js';
import {compartmentsOf,projectCable,validateProject} from './project.js';

export const RULESET_VERSION='2023.2026-10-26.1';
export const METHODS=Object.freeze([
  {id:'lv-messenger',label:'LV trefoil — Table 310.20 (messenger)',rule:'392.80(A)(2)(d)',band:'lv',kind:'single',spaced:'trefoil',basis:'Table 310.20: messenger-supported conductors; 40°C (104°F) base ambient; 75°C or 90°C conductor columns. Apply the appropriate temperature correction and terminal limits. This is not unadjusted individual free-air Table 310.17.'},
  {id:'lv-single-reduced',label:'LV singles / trefoil — reduced Table 310.17',rule:'392.80(A)(2)(a)/(b)',band:'lv',kind:'single',basis:'Table 310.17, with the tray percentage below and temperature correction from its 30°C (86°F) base. The 310.15(C)(1) conductor-count adjustment does not apply to tray single conductors.'},
  {id:'lv-single-spaced',label:'LV individual singles, 1D — Table 310.17',rule:'392.80(A)(2)(c)',band:'lv',kind:'single',spaced:'individual',basis:'Table 310.17, 30°C (86°F) base ambient, with temperature correction. Every individual conductor must have maintained 1D clear spacing in one uncovered layer. Touching trefoils do not qualify.'},
  {id:'lv-multi',label:'LV multiconductor / VFD — Table 310.16',rule:'392.80(A)(1)(a)/(b)',band:'lv',kind:'multi',basis:'Table 310.16, 30°C (86°F) base ambient. Apply temperature correction and 310.15(C)(1) when a cable has more than three current-carrying conductors; count conductors within that cable, not all conductors in the tray.'},
  {id:'lv-multi-spaced',label:'LV multiconductor / VFD, 1D — engineering method',rule:'392.80(A)(1)(c) / 310.14(B)',band:'lv',kind:'multi',spaced:'individual',basis:'Documented engineering determination for multiconductor cables in free air under 310.14(B), with ambient correction and no more than three insulated conductors. Annex B, Table B.2(3), is informational. Table 310.17 is not a multiconductor cable table.'},
  {id:'mv-grouped',label:'MV trefoil — Tables 315.60(C)(1)/(2)',rule:'392.80(B)(2)(3)',band:'mv',kind:'single',spaced:'trefoil',basis:'Tables 315.60(C)(1)/(2), grouped MV conductors. Verify the actual table voltage, construction, temperature, shielding and spacing assumptions in the external calculation.'},
  {id:'mv-single-reduced',label:'MV singles / trefoil — reduced C(3)/(4)',rule:'392.80(B)(2)(1)',band:'mv',kind:'single',basis:'Tables 315.60(C)(3)/(4), with the tray percentage below. Verify all table-specific temperature, voltage and cable-construction assumptions.'},
  {id:'mv-single-spaced',label:'MV individual singles, 1D — C(3)/(4)',rule:'392.80(B)(2)(2)',band:'mv',kind:'single',spaced:'individual',basis:'Tables 315.60(C)(3)/(4), individual conductors in one uncovered layer with maintained 1D clear spacing. Verify table-specific conditions and temperature corrections.'},
  {id:'mv-multi',label:'MV multiconductor / VFD — C(9)/(10)',rule:'392.80(B)(1)',band:'mv',kind:'multi',basis:'Tables 315.60(C)(9)/(10), including the applicable cover limitation. Verify voltage, shielding, conductor construction and temperature assumptions.'},
  {id:'mv-multi-spaced',label:'MV multiconductor / VFD, 1D — C(5)/(6)',rule:'392.80(B)(1)(2)',band:'mv',kind:'multi',spaced:'individual',basis:'Tables 315.60(C)(5)/(6), one uncovered layer with maintained 1D clear spacing between complete cable jackets. Verify all table assumptions and temperature corrections.'}
]);
export const CIRCUIT_CLASSES=Object.freeze([
  ['power','Power / lighting'],['class1','Class 1 control / signal'],
  ['class2-3','Class 2 / Class 3 (outside supported scope)'],
  ['fire-alarm','Fire alarm (outside supported scope)'],
  ['communications','Communications / optical fiber (outside supported scope)'],
  ['special','PV, emergency, intrinsically safe or other special system (outside supported scope)']
]);
export const REVIEW_CHECKS=Object.freeze([
  {id:'code',rule:'90.4 / adopted code',text:'The responsible engineer checked the final adopted NEC 2023 text, local amendments and project requirements for this installation.'},
  {id:'listing',rule:'110.3(B) / 392.10',text:'Cable markings, listing, actual OD, voltage, temperature rating and permitted cable type were verified against current manufacturer documents.'},
  {id:'environment',rule:'392.10 / 392.12 / 392.18',text:'The route is accessible, outside hoistways and severe-damage locations, and suitable for moisture, corrosion, sunlight, firestopping and the environment.'},
  {id:'mechanical',rule:'392.18 / 392.30',text:'Support span, tray/fitting load ratings, cable weight, bend radius, pulling, vertical support and fastening were checked externally.'},
  {id:'grouping',rule:'392.20(C)/(D) / 392.22(B)',text:'Circuit conductors, parallel sets, neutral requirements, even distribution, short-circuit securing and maintained clear gaps were checked; all installed cables are modeled.'},
  {id:'grounding',rule:'392.60 / Article 250',text:'Grounding and bonding, EGC sizing, joints and transitions were verified; if the tray is an EGC, its eligibility and metal area were verified.'},
  {id:'separation',rule:'392.20 / applicable circuit articles',text:'Circuit classification, voltage segregation, barriers, EMC and all system-specific separation rules were checked along the entire route.'},
  {id:'sizing',rule:'392.80 / 110.14(C) / 110.40',text:'External circuit sizing matches every declared installation method, worst route segment, ambient correction, adjustment factor, terminal limit and protection requirement.'}
]);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const cableOf=(r,map)=>projectCable(r,map)||{};
const textPresent=s=>typeof s==='string'&&s.trim().length>=3;
export function coverState(p){
  if(p.covered!==true)return 'uncovered';
  if(p.coverType==='solid-unventilated'&&finite(p.coverLengthIn)&&p.coverLengthIn>72)return 'solid-long';
  return 'unsupported';
}
// Deterministic revision identity, not a signature or tamper-proof approval.
function digest(value){let h=2166136261;for(const c of JSON.stringify(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
export function installationFingerprint(p,map){return digest({v:RULESET_VERSION,
  dimensions:[p.widthIn,p.depthIn,p.trayType,p.dividerThicknessIn,p.dividers],
  conditions:[p.covered,p.coverType,p.coverLengthIn,p.ambientF,p.industrialQualified,p.rungSpacingIn,p.solidBarriers,p.barrierAdequacyConfirmed,p.location],
  compartments:p.compartments.map(c=>[c.id,c.controlOnly,arrangementSettings(c)]),
  circuits:p.circuits.map(r=>[r.id,r.compartmentId,r.qty,r.cablesPerRun,r.voltage,r.markedTempC,r.purpose,r.circuitClass,cableOf(r,map)])});}
export function reviewFingerprint(p,map){return digest({installation:installationFingerprint(p,map),basis:p.circuits.map(r=>[r.id,r.basis])});}
export function stampBasis(p,row,map){row.basis={...row.basis,fingerprint:installationFingerprint(p,map),reviewedAt:new Date().toISOString()};}
export function stampReview(p,map){p.installationReview={...p.installationReview,fingerprint:reviewFingerprint(p,map),reviewedAt:new Date().toISOString(),ruleset:RULESET_VERSION};}

export function evaluateMethod(p,row,comp,map,currentFingerprint){
  const c=cableOf(row,map),b=row.basis||{},m=METHODS.find(x=>x.id===b.method),problems=[],advisories=[];
  const issue=(code,message,kind='conflict')=>problems.push({code,message,kind,rule:m?.rule||'392.80'});
  if(row.purpose==='ground')return {method:null,problems,advisories,required:'Separate EGC; no ampacity-method declaration.'};
  if(!m){issue('METHOD_MISSING','Select the installation method used in the external circuit calculation.','missing');return {method:null,problems,advisories,required:'External sizing basis not declared.'};}
  const mv=Number(c.voltage)>2000,settings=arrangementSettings(comp),trefoil=isTrefoil({...row,cable:c}),cover=coverState(p);
  const size=Number(c.sizeKcmil)||sizeToKcmil(c.size);
  if(!finite(row.markedTempC))issue('INSULATION_TEMPERATURE','Verify and enter the actual cable insulation temperature rating from its marking or manufacturer document.','missing');
  else if(b.conductorTempC>row.markedTempC)issue('TEMPERATURE_RATING','The selected conductor temperature column exceeds the verified cable insulation rating.');
  if(finite(p.ambientF)&&finite(b.conductorTempC)&&(p.ambientF-32)*5/9>=b.conductorTempC)issue('AMBIENT_COLUMN','The design ambient is at or above the selected conductor temperature. That column cannot establish positive thermal capacity.');
  const standardLV=[...Array.from({length:18},(_,i)=>sizeToKcmil(String(i+1))),105.6,133.1,167.8,211.6,250,300,350,400,500,600,700,750,800,900,1000,1250,1500,1750,2000];
  const matches=(values,n)=>values.some(v=>Math.abs(v-n)<=Math.max(.02,v*.001));
  if(!['Copper','Tinned Copper','Aluminum'].includes(c.material))issue('MATERIAL_UNSUPPORTED','Conductor material is outside the verified copper/aluminum table scope.','unsupported');
  if(m.band==='lv'&&m.id!=='lv-multi-spaced'){
    if(!matches(standardLV,size))issue('LV_TABLE_SIZE','No verified standard table entry exists for this conductor size.','unsupported');
    if(![60,75,90].includes(b.conductorTempC))issue('LV_TABLE_TEMPERATURE','The selected low-voltage table supports only its 60°C, 75°C and 90°C columns. High-temperature tables 310.18/310.19 are outside this workflow.','unsupported');
    if(size<4.1&&(b.conductorTempC!==90||c.material==='Aluminum'||row.circuitClass!=='class1'))issue('SMALL_TABLE_SCOPE','16/18 AWG entries require verified copper control-circuit applicability and the 90°C column; other small-conductor uses are outside this workflow.','unsupported');
    if(c.material==='Aluminum'&&size<6.5)issue('ALUMINUM_TABLE_SIZE','This workflow does not establish a Table 310.16/310.17 entry for aluminum smaller than 12 AWG.','unsupported');
  }
  if(m.band==='mv'){
    if(![90,105].includes(b.conductorTempC))issue('MV_TABLE_TEMPERATURE','Confirm the applicable 90°C or 105°C MV conductor column in the external calculation.','missing');
    if(!matches([105.6,133.1,167.8,211.6,250,350,500,750,1000],size))issue('MV_TABLE_SIZE','This release workflow supports only the verified MV subset: 1/0–4/0 AWG, 250, 350, 500, 750 and 1,000 kcmil. Other entries require a validated extension; this is not an NEC prohibition.','unsupported');
    if(b.mvTableConditions!==true)issue('MV_TABLE_CONDITIONS','Confirm the MV table-specific construction, shielding/bonding, voltage class, phase/conductor arrangement and 40°C (104°F) ambient correction basis.','missing');
  }
  if((m.band==='mv')!==mv)issue('METHOD_VOLTAGE','The selected ampacity method does not match the cable voltage-rating band (not the operating voltage).');
  if((m.kind==='single')!==(c.conductors===1))issue('METHOD_CONSTRUCTION','Single-conductor and multiconductor ampacity methods are not interchangeable.');
  if(m.spaced&&cover!=='uncovered')issue('UNCOVERED_REQUIRED','This spaced-cable route requires an uncovered tray. The selected cover condition does not establish eligibility.');
  if(cover==='unsupported')issue('COVER_UNSUPPORTED','Short, ventilated or unspecified covers need a thermal assessment outside this ruleset. This is an application scope limit, not a universal NEC prohibition.','unsupported');
  if(m.kind==='single'&&p.trayType==='solid')issue('SOLID_SINGLE_UNSUPPORTED','Single-conductor thermal/fill eligibility in solid-bottom trays is outside this validated workflow. A geometry pass cannot release it.','unsupported');
  if(m.spaced==='trefoil'&&(!trefoil||settings.trefoilSpacing!=='2.15D'))issue('TREFOIL_METHOD_GAP','The grouped method requires a touching trefoil and the 2.15D minimum-clearance preset. A 1D gap between groups does not qualify as 1D between individual conductors.');
  const gap=c.category==='vfd'?settings.vfdSpacing==='1D':settings.spacing==='one-diameter';
  if(m.spaced==='individual'&&(trefoil||!gap))issue('INDIVIDUAL_METHOD_GAP','This method requires a single layer with at least 1D clear spacing between individual complete cables. Touching cables or touching trefoils do not qualify.');
  if(m.id==='lv-messenger'){
    const standard=[105.6,133.1,167.8,211.6,250,300,350,400,500,600,700,750,800,900,1000];
    if(!standard.some(v=>Math.abs(v-size)<.11))issue('MESSENGER_SIZE','Table 310.20 has no supported entry for this size. This workflow accepts its listed 1/0 AWG–1,000 kcmil entries only.');
    if(![75,90].includes(b.conductorTempC))issue('MESSENGER_TEMPERATURE','Select the 75°C or 90°C conductor column used in Table 310.20, and verify cable and terminal limits.','missing');
  }
  if(m.kind==='multi'&&(!Number.isInteger(b.insulatedCount)||b.insulatedCount<c.conductors))issue('INSULATED_COUNT','Confirm the total insulated conductor count from the construction, including insulated grounds. Catalog phase counts may omit grounds.','missing');
  if(m.id==='lv-multi-spaced'&&b.insulatedCount>3)issue('MULTI_SPACED_CONDUCTORS','This workflow does not establish the 392.80(A)(1)(c) reference construction with more than three insulated conductors. Use the standard multiconductor route or a separately validated engineering workflow.','unsupported');
  if(m.kind==='multi'&&(!Number.isInteger(b.currentCarrying)||b.currentCarrying<1||b.currentCarrying>c.conductors))issue('CCC_MISSING','Enter the verified current-carrying conductor count per cable, including neutral treatment where applicable.','missing');
  if(mv&&(!isMC(c)&&!isMV(c)))issue('MV_TYPE_UNKNOWN','Above 2,000 V, Type MV or Type MC cable construction must be established.','missing');
  if(mv&&Number(c.voltage)>35000)issue('MV_RANGE_UNSUPPORTED','Cables above 35 kV are outside this application’s verified table scope.','unsupported');
  if(m.id==='lv-single-reduced'){
    if(size>500&&size<600)issue('REDUCED_SIZE_UNSUPPORTED','The specified size is between the explicit 1/0–500 and 600 kcmil-and-larger branches.','unsupported');
    advisories.push(`External tray limitation: ${size>=600?(cover==='solid-long'?'70%':'75%'):(cover==='solid-long'?'60%':'65%')} of Table 310.17 before applicable temperature and terminal limits.`);
  }
  if(m.id==='mv-single-reduced')advisories.push(`External tray limitation: ${cover==='solid-long'?'70%':'75%'} of Tables 315.60(C)(3)/(4), plus applicable temperature and table conditions.`);
  if(['lv-multi','mv-multi'].includes(m.id)&&cover==='solid-long')advisories.push('Solid unventilated cover longer than 72 in continuously: the external method must apply the 95% limitation.');
  if(m.id==='lv-multi'&&b.currentCarrying>3)advisories.push('More than three current-carrying conductors per cable: apply 310.15(C)(1) within each cable.');
  if(!textPresent(b.reference))issue('CALC_REFERENCE','Enter the external calculation document and revision.','missing');
  if(!textPresent(b.designer))issue('BASIS_DESIGNER','Identify the engineer who verified this external sizing basis.','missing');
  if(b.conditionsConfirmed!==true)issue('BASIS_CONFIRMATION','Confirm that the cited external calculation uses this exact installation, the table conditions, temperature corrections and applicable adjustments.','missing');
  if(b.fingerprint!==(currentFingerprint||installationFingerprint(p,map)))issue('BASIS_STALE','The installation changed or has not been confirmed. Recheck the external sizing and reconfirm this circuit basis.','missing');
  return {method:m,problems,advisories,required:m.basis};
}

export function assessProject(p,map=new Map()){
  try{validateProject(p,map);}catch(error){return {ruleset:RULESET_VERSION,status:'blocked',canIssue:false,issues:[{code:'INVALID_PROJECT',kind:'conflict',rule:'Input validation',message:error.message}],results:[],basis:[],reviewedAt:null};}
  const issues=[],basis=[],sections=compartmentsOf(p),fingerprint=reviewFingerprint(p,map);
  const add=(code,message,rule,kind='conflict',circuitId=null)=>issues.push({code,message,rule,kind,circuitId});
  const results=sections.map(comp=>{
    const circuits=p.circuits.filter(r=>r.compartmentId===comp.id).map(r=>({...r,cable:cableOf(r,map)}));
    const result=calculateCompartment({...p,...arrangementSettings(comp),widthIn:comp.widthIn,controlOnly:comp.controlOnly,circuits});
    if(!['pass','empty'].includes(result.status))add('LAYOUT_'+comp.id,`${comp.name}: ${result.notes.join(' ')}`,result.rule,result.status==='review'?'unsupported':'conflict');
    return {comp,circuits,result};
  });
  if(!p.circuits.length)add('EMPTY','Add at least one circuit before issuing an installation report.','Project scope','missing');
  if(typeof p.covered!=='boolean')add('COVER_DECLARATION','Explicitly declare whether the tray is covered. Missing information is not treated as an uncovered installation.','392.80','missing');
  if(p.location!=='ordinary')add('LOCATION',p.location==='prohibited'?'Hoistways and severe physical-damage locations are prohibited for cable tray.':'Declare an ordinary industrial location. Hazardous/classified and special installations are outside this ruleset.','392.12 / 392.10',p.location==='prohibited'?'conflict':'unsupported');
  if(!finite(p.ambientF)||p.ambientF< -58||p.ambientF>194)add('AMBIENT','Enter the design ambient temperature, from -58°F to 194°F, and verify the applicable correction externally.','392.80 / 310.15','missing');
  if(p.dividers.length&&(!p.solidBarriers||!p.barrierAdequacyConfirmed||p.dividerThicknessIn<=0))add('DIVIDERS','Separate compartment assessment requires positive-thickness solid fixed barriers with confirmed materials and continuity.','392.20 / 392.22','missing');
  const occupied=results.filter(x=>x.circuits.length);
  const fingerprintNow=installationFingerprint(p,map);
  for(const row of p.circuits){
    const c=cableOf(row,map),comp=sections.find(s=>s.id===row.compartmentId);
    if(row.purpose!=='ground'){
      const catalogCable=row.cableSnapshot||map.get(row.cableId)||{};
      if(/\bPV\b|photovoltaic/i.test([c.title,c.insulation,c.cableType].filter(Boolean).join(' ')))add('PV_PRODUCT_'+row.id,`${row.tag}: PV-marked catalog families require type-specific verification outside this release workflow, including any proposed use of a dual rating.`,'392.10 / Article 690','unsupported',row.id);
      if(!finite(row.markedVoltage)||row.markedVoltage<=0)add('MARKING_'+row.id,`${row.tag}: verify and enter the actual stock/cable-marking voltage. A family’s highest advertised rating is not proof for every stock.`,'110.3(B) / 392.20','missing',row.id);
      else if(row.markedVoltage>Number(catalogCable.voltage))add('MARKING_RANGE_'+row.id,`${row.tag}: the entered cable-marking rating exceeds the catalog evidence; update the manufacturer record before release.`,'110.3(B)','conflict',row.id);
      if(!['power','class1'].includes(row.circuitClass))add('CLASS_'+row.id,`${row.tag}: declare power/lighting or Class 1 control. Other circuit classes require rules outside this workflow.`,`392.10 / applicable circuit article`,'unsupported',row.id);
      if(comp.controlOnly&&row.circuitClass!=='class1')add('CONTROL_ONLY_'+row.id,`${row.tag}: a control-only compartment cannot contain a power/lighting or unclassified circuit.`,'392.22(A)(2)/(4)','conflict',row.id);
      if((c.conductors===1||isMV(c))&&p.industrialQualified!==true)add('INDUSTRIAL_'+row.id,`${row.tag}: confirm industrial maintenance and supervision by qualified persons.`,'392.10(B)','missing',row.id);
      if(c.conductors===1&&!isTrefoil({...row,cable:c})&&row.cablesPerRun!==3)add('SINGLE_GROUP_'+row.id,`${row.tag}: this workflow supports three-phase, three-wire phase sets of three singles. Other circuit/neutral configurations need a validated model.`,'392.20(C)/(D)','unsupported',row.id);
    }
    const evaluation=evaluateMethod(p,row,comp,map,fingerprintNow);basis.push({row,comp,...evaluation});
    for(const problem of evaluation.problems)add(problem.code+'_'+row.id,`${row.tag}: ${problem.message}`,problem.rule,problem.kind,row.id);
    if(evaluation.method?.spaced&&occupied.length>1)add('DIVIDED_THERMAL_'+row.id,`${row.tag}: spaced ampacity eligibility with other occupied divider compartments is not established by this model. A divider is not proof of thermal free-air clearance. Use a separate tray or a company-validated divided-tray method; this scope limit cannot be overridden by a checkbox.`,evaluation.method.rule,'unsupported',row.id);
  }
  const live=p.circuits.filter(r=>r.purpose!=='ground'),low=live.filter(r=>r.voltage<=1000),high=live.filter(r=>r.voltage>1000&&!isMC(cableOf(r,map)));
  if(low.length&&high.length){
    const mixed=high.some(h=>low.some(l=>l.compartmentId===h.compartmentId));
    if(mixed||!p.dividers.length||p.solidBarriers!==true||p.barrierAdequacyConfirmed!==true)add('VOLTAGE_BARRIER','Circuits above 1,000 V require the applicable Type MC exception or continuous compatible solid fixed separation from circuits at or below 1,000 V.','392.20(B)');
  }
  const review=p.installationReview||{};
  if(!textPresent(review.reviewer)||!textPresent(review.reference))add('REVIEW_ID','Record the responsible engineer and installation review document/revision.','Engineering review record','missing');
  for(const check of REVIEW_CHECKS)if(review.confirmations?.[check.id]!==true)add('REVIEW_'+check.id,check.text,check.rule,'missing');
  if(review.fingerprint!==fingerprint||review.ruleset!==RULESET_VERSION)add('REVIEW_STALE','Record the installation review after the final arrangement and all circuit basis records are complete. Any relevant edit invalidates the record.','Revision control','missing');
  return {ruleset:RULESET_VERSION,status:issues.length?'blocked':'ready',canIssue:issues.length===0,issues,results,basis,fingerprint: fingerprintNow,reviewedAt:review.reviewedAt||null};
}

export function issueRecord(p,map){
  const a=assessProject(p,map);
  if(!a.canIssue)throw new Error(`Report issue blocked: ${a.issues.length} unresolved item(s). ${a.issues[0].message}`);
  return {status:'Checks complete — engineering review recorded',ruleset:RULESET_VERSION,issuedAt:new Date().toISOString(),reviewer:p.installationReview.reviewer,reference:p.installationReview.reference,scope:'Implemented tray fill and installation-method checks; external circuit sizing is declared, not recalculated. Not NFPA certification.'};
}
