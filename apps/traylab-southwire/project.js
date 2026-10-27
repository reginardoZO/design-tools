import {calculateCompartment} from './nec.js';
import {conductorSize} from './format.js';
import {arrangementSettings, arrangementLabel, planArrangement, drawArrangement} from './arrangement.js';

export function projectCable(row,map=new Map()) {
  const cable=row.cableSnapshot||row.cable||map.get(row.cableId);
  if(!cable)return cable;
  return typeof row.markedVoltage==='number'&&Number.isFinite(row.markedVoltage)&&row.markedVoltage>0?{...cable,voltage:row.markedVoltage}:cable;
}

// All project dimensions are stored and displayed in inches.
export function compartmentsOf(p) {
  let start = 0;
  return p.compartments.map((c, i) => {
    const end = i < p.dividers.length ? p.dividers[i] - p.dividerThicknessIn / 2 : p.widthIn;
    const section = {...c, startIn:start, widthIn:end-start};
    start = i < p.dividers.length ? p.dividers[i] + p.dividerThicknessIn / 2 : p.widthIn;
    return section;
  });
}

export function validateProject(p, catalogById = new Map()) {
  const fail = message => { throw new Error(message); };
  const finite = (n,min,max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  if (!p || p.schemaVersion !== 1) fail('Unrecognized project format (version 1 expected).');
  if (!finite(p.widthIn,.5,120) || !finite(p.depthIn,.25,24)) fail('Width must be 0.5–120 in. Depth must be 0.25–24 in.');
  if (!finite(p.dividerThicknessIn,0,1)) fail('Divider thickness must be between 0 and 1 in.');
  if (!finite(p.reserve ?? 0,0,75)) fail('Design reserve must be between 0% and 75%.');
  if (!['ladder','ventilated','solid'].includes(p.trayType) || p.units !== 'in') fail('Invalid tray type or units. Dimensions must use inches.');
  for(const key of ['covered','solidBarriers','barrierAdequacyConfirmed','industrialQualified'])if(p[key]!=null&&typeof p[key]!=='boolean')fail(`${key} must be a true/false value.`);
  for(const [key,min,max] of [['rungSpacingIn',0,48],['coverLengthIn',0,120000],['ambientF',-58,194]])if(p[key]!=null&&!finite(p[key],min,max))fail(`Invalid ${key}.`);
  if(p.coverType!=null&&!['solid-unventilated','ventilated','unknown'].includes(p.coverType))fail('Invalid cover type.');
  if(p.location!=null&&!['ordinary','hazardous','prohibited','unknown'].includes(p.location))fail('Invalid installation location.');
  if (!Array.isArray(p.dividers) || !Array.isArray(p.compartments) || p.dividers.length > 11 || p.compartments.length !== p.dividers.length + 1) fail('Use 1 to 12 compartments separated by dividers.');
  if (p.dividers.some((d,i) => !finite(d,0,p.widthIn) || (i && d <= p.dividers[i-1]))) fail('Divider positions must be increasing and inside the tray.');
  const ids = new Set(p.compartments.map(c=>c.id));
  if (ids.size !== p.compartments.length || p.compartments.some(c=>typeof c.id !== 'string' || !c.id || typeof c.name !== 'string' || !c.name.trim() || !['touching','one-diameter'].includes(c.spacing))) fail('Invalid compartment ID, name, or arrangement.');
  if (p.compartments.some(c=>c.trefoilSpacing!=null&&!['1D','2.15D'].includes(c.trefoilSpacing))) fail('Trefoil clearance must be 1D or 2.15D.');
  if (p.compartments.some(c=>c.vfdSpacing!=null&&!['touching','1D'].includes(c.vfdSpacing))) fail('VFD clearance must be touching or 1D.');
  if(p.compartments.some(c=>c.controlOnly!=null&&typeof c.controlOnly!=='boolean'))fail('Control-only declarations must be true/false values.');
  if (compartmentsOf(p).some(c=>c.widthIn < .25 - 1e-8)) fail('Each compartment must have at least 0.25 in of clear width.');
  if (!Array.isArray(p.circuits) || p.circuits.length > 2000) fail('Invalid circuit list (maximum 2,000 rows).');
  const circuitIds = new Set();
  for (const c of p.circuits) {
    if (typeof c.id !== 'string' || !c.id || circuitIds.has(c.id)) fail('Each circuit row must have a unique ID.');
    circuitIds.add(c.id);
    if (!ids.has(c.compartmentId)) fail('A circuit is assigned to a compartment that does not exist.');
    if (typeof c.tag !== 'string' || !c.tag.trim() || c.tag.length > 80) fail('Enter a circuit tag (up to 80 characters).');
    if (!Number.isInteger(c.qty) || !finite(c.qty,1,9999) || !Number.isInteger(c.cablesPerRun) || !finite(c.cablesPerRun,1,20)) fail('Runs must be an integer from 1 to 9,999. Cables per run must be an integer from 1 to 20.');
    if (!finite(c.voltage,0,69000)) fail('Operating voltage must be between 0 and 69,000 V.');
    if(c.markedVoltage!=null&&!finite(c.markedVoltage,0,69000))fail('Invalid verified cable marking voltage.');
    if(c.markedTempC!=null&&![60,75,90,105,125,150,200,250].includes(c.markedTempC))fail('Invalid verified cable insulation temperature.');
    if(c.purpose!=null&&!['power','ground'].includes(c.purpose))fail('Invalid circuit purpose.');
    if(c.circuitClass!=null&&!['power','class1','class2-3','fire-alarm','communications','special'].includes(c.circuitClass))fail('Invalid circuit classification.');
    if(c.basis!=null){
      if(typeof c.basis!=='object'||Array.isArray(c.basis))fail('Invalid external sizing basis.');
      for(const key of ['reference','designer','method','fingerprint','reviewedAt'])if(c.basis[key]!=null&&(typeof c.basis[key]!=='string'||c.basis[key].length>1000))fail('Invalid sizing basis text.');
      for(const key of ['conditionsConfirmed','mvTableConditions'])if(c.basis[key]!=null&&typeof c.basis[key]!=='boolean')fail('Sizing confirmation must be true/false.');
      for(const key of ['currentCarrying','insulatedCount'])if(c.basis[key]!=null&&(!Number.isInteger(c.basis[key])||!finite(c.basis[key],1,1000)))fail('Conductor counts must be integers from 1 to 1,000.');
      if(c.basis.conductorTempC!=null&&![60,75,90,105].includes(c.basis.conductorTempC))fail('Invalid conductor temperature column.');
    }
    const cable = c.cableSnapshot || catalogById.get(c.cableId);
    if (!cable || !finite(cable.odIn,.001,24) || !Number.isInteger(cable.conductors) || cable.conductors < 1) fail(`Missing or invalid cable data: ${c.tag}.`);
  }
  if (typeof p.name !== 'string' || !p.name.trim() || typeof p.trayTag !== 'string' || !p.trayTag.trim()) fail('Enter the project name and tray tag.');
  if(p.installationReview!=null){const r=p.installationReview;if(typeof r!=='object'||Array.isArray(r))fail('Invalid installation review.');for(const key of ['reviewer','reference','fingerprint','reviewedAt','ruleset'])if(r[key]!=null&&(typeof r[key]!=='string'||r[key].length>1000))fail('Invalid review text.');if(r.confirmations!=null&&(typeof r.confirmations!=='object'||Object.values(r.confirmations).some(v=>typeof v!=='boolean')))fail('Review confirmations must be true/false.');}
  return p;
}

// Migrate only the former built-in labels; preserve names entered by the user.
// Legacy projects already stored dimensions in inches, even in metric display mode.
export function migrateProject(input) {
  const p = structuredClone(input);
  if (!p || p.schemaVersion !== 1) return p;
  if(p.complianceSchema!==1){p.complianceSchema=1;p.industrialQualified=false;p.barrierAdequacyConfirmed=false;delete p.installationReview;}
  if (p.units === 'mm') p.units = 'in';
  const defaultNames = new Map([
    ['Novo dimensionamento', 'New tray design'],
    ['Exemplo · Estudo de leito 480 / 120 V', 'Example · 480 / 120 V cable tray study']
  ]);
  p.name = defaultNames.get(p.name) || p.name;
  for (const c of Array.isArray(p.compartments) ? p.compartments : []) {
    Object.assign(c,arrangementSettings(c));
    if (c.name === '480 V · Força') c.name = '480 V · Power';
    if (/^Compartimento [A-L]$/.test(c.name)) c.name = c.name.replace('Compartimento ', 'Compartment ');
  }
  return p;
}

export function resizeProject(p, width) {
  const old = compartmentsOf(p);
  const available = width - p.dividers.length * p.dividerThicknessIn;
  const oldAvailable = p.widthIn - p.dividers.length * p.dividerThicknessIn;
  let start = 0;
  const dividers = old.slice(0,-1).map(c => {
    start += c.widthIn / oldAvailable * available;
    const position = start + p.dividerThicknessIn / 2;
    start += p.dividerThicknessIn;
    return position;
  });
  return {...p, widthIn:width, dividers};
}

export function suggestWidth(p, catalogById) {
  if (!p.circuits.length) return null;
  for (const width of [6,9,12,18,24,30,36,42,48,54,60,72,84,96,108,120]) {
    const proposal = resizeProject(p,width);
    if (compartmentsOf(proposal).some(c=>c.widthIn<.25)) continue;
    const checks = compartmentsOf(proposal).map(co=>calculateCompartment({
      ...proposal, ...arrangementSettings(co), widthIn:co.widthIn, controlOnly:co.controlOnly,
      circuits:p.circuits.filter(c=>c.compartmentId===co.id).map(c=>({...c,cable:projectCable(c,catalogById)}))
    }));
    const ceiling = 1 - (p.reserve || 0) / 100;
    if (checks.every(r => r.status==='empty' || (r.status==='pass' && r.ratio <= ceiling + 1e-9 &&
      (r.arrangementWidthIn == null || r.arrangementWidthIn <= r.widthIn*ceiling + 1e-9)))) return {project:proposal, checks};
  }
  return null;
}

// A schematic packing, not a thermal model. Large cables occupy their own lane.
export function layoutCables(circuits, width, depth, result, settings) {
  const options=typeof settings==='string'?{spacing:settings}:settings;
  const plan=planArrangement(circuits,options,result.singleLayerRequired);
  return drawArrangement(plan,width,depth,result);
}

export function projectCSV(p, catalogById, record=null) {
  const header=['Circuit','Compartment','SPEC','Stock','Conductors','Conductor size','OD (in)','Runs','Cables/run','Total cables','Operating voltage (V)','Catalog family rating (V)','Cable weight (lb/ft)','Southwire source','Arrangement','Trefoil clear gap','VFD clear gap','Issue status','Verified cable marking (V)','Circuit classification','External installation method','Calculation document / revision','Basis engineer','Design ambient (F)','Ruleset','Verified insulation rating (C)','Selected table column (C)','Current-carrying conductors per cable','Insulated conductors per cable','Covered tray','Cover type','Continuous cover length (in)','Installation reviewer','Installation review document','Issued at'];
  const rows=p.circuits.map(c=>{
    const b=c.cableSnapshot||catalogById.get(c.cableId);
    const co=p.compartments.find(s=>s.id===c.compartmentId),settings=arrangementSettings(co);
    return [c.tag,co?.name,b.spec,b.stock,b.conductors,conductorSize(b),b.odIn,c.qty,c.cablesPerRun,c.qty*c.cablesPerRun,c.voltage,b.voltage,b.weightLbKft==null?'':+(b.weightLbKft/1000*c.qty*c.cablesPerRun).toFixed(5),b.sourceUrl,arrangementLabel({...c,cable:b},co),settings.trefoilSpacing,settings.vfdSpacing,record?.status||'DRAFT — NOT FOR CONSTRUCTION',c.markedVoltage,c.circuitClass,c.basis?.method,c.basis?.reference,c.basis?.designer,p.ambientF,record?.ruleset||'',c.markedTempC,c.basis?.conductorTempC,c.basis?.currentCarrying,c.basis?.insulatedCount,p.covered===true?'Yes':'No',p.covered?p.coverType:'',p.covered?p.coverLengthIn:'',record?.reviewer,record?.reference,record?.issuedAt];
  });
  return '\uFEFF'+[header,...rows].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
}
