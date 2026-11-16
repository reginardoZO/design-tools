import {calculate, newProject, changeLoadType, LOAD_TYPES, circuitVoltage, label, familyEntries, familyRatings, demand} from './engine.js';
import {SIZES, CONDUITS, MOTOR_FLC, MOTOR_FLC_1PH} from './data.js';
import {newMccLoad} from '../../shared/mcc-feeder.js';
import {GUIDE,SOURCES} from './guide.js';
import {loadProject} from './project.js';
import {impedanceKey} from './voltage-drop.js';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(v,n=1)=>Number.isFinite(v)?(Math.round((v+Number.EPSILON*Math.abs(v))*10**n)/10**n).toFixed(n):'—';
let catalog=[],p=newProject(),step=0,result;
const KEY='raceway-lab-nec2023-v3';
const LEGACY_KEY='raceway-lab-nec2023-v2';
const showNotice=s=>$('#notice').textContent=s;
function field(key,title,hint='',type='number',values=null){
 const control=values?`<select id="${key}" data-key="${key}">${values.map(v=>{const [value,text]=Array.isArray(v)?v:[v,v];return `<option value="${esc(value)}" ${String(p[key])===String(value)?'selected':''}>${esc(text)}</option>`;}).join('')}</select>`:`<input id="${key}" data-key="${key}" type="${type}" ${type==='number'?'step="any"':''} value="${esc(typeof p[key]==='number'&&!Number.isFinite(p[key])?'':p[key])}">`;
 return `<div class="field"><label for="${key}">${title}</label>${control}<small>${hint}</small></div>`;
}
const select=(key,title,values,hint='')=>field(key,title,hint,'text',values);
const check=(key,title)=>`<label class="check"><input type="checkbox" data-key="${key}" ${p[key]?'checked':''}><span>${title}</span></label>`;
const ref=s=>`<p class="ref">${s}</p>`;
const note=(s,warn=false)=>`<div class="callout ${warn?'warn':''}">${s}</div>`;
const fields=s=>`<div class="fields">${s}</div>`;
const mv=()=>circuitVoltage(p)>1000;
const fam=()=>familyEntries(catalog,p)[0];
function loadInputs(){
 const operation=()=>select('operation','Operation',[['','Select classification'],['continuous','Continuous'],['noncontinuous','Non-continuous']]);
 const power=()=>select('inputMode','Load input',p.loadType==='heater'?[['A','Electrical current - A'],['kW','Power - kW']]:[['A','Current - A'],['kW','Real power - kW'],['kVA','Apparent power - kVA']])+field('loadValue',`Rated / calculated load · ${p.inputMode}`)+(p.inputMode==='kW'?select('powerBasis','Power basis',[['electrical','Electrical input'],['thermal',p.loadType==='heater'?'Thermal output':'Useful output']])+field('powerFactor','Power factor','Above 0 through 1.')+(p.powerBasis==='thermal'?field('efficiency','Efficiency · %','Required only for output power.'):''):'');
 if(p.loadType==='mcc-feeder')return field('mccId','Feeder / MCC identification','','text')+field('frequency','System frequency · Hz','Motor table lookup is limited to 60 Hz. Use 50 Hz only with an applicable documented current basis.')+field('ocpd','Existing upstream protective-device rating · A (optional)','Separate from the conductor ampacity calculation; used as the 250.122 EGC basis.')+field('mccDescription','Engineering description (optional)','','text');
 if(p.loadType==='feeder')return select('feederUnit','Load portions',[['A','Current - A'],['kVA','Apparent power - kVA']])+field('continuous',`Continuous portion · ${p.feederUnit}`,'Expected for 3 hours or longer.')+field('noncontinuous',`Non-continuous portion · ${p.feederUnit}`)+neutralInputs()+check('continuousRatedAssembly','Complete applicable assembly is verified listed for 100% continuous operation');
 if(p.loadType==='lv-motor')return select('motorKind','Motor category',[['standard','Standard motor - NEC table FLC'],['low-speed','Low-speed motor - nameplate basis'],['high-torque','High-torque motor - nameplate basis'],['multispeed','Multispeed motor - nameplate basis']])+select('motorPowerUnit','Motor power unit',[['hp','HP'],['kW','kW']])+(p.motorPowerUnit==='hp'?select('motorHp','Motor rated power · HP',[['','Select horsepower'],...Object.keys(p.phases===1?MOTOR_FLC_1PH:MOTOR_FLC).map(hp=>[hp,`${hp} hp`])]):field('motorPower','Motor rated power · kW','Exact NEC table rating required after conversion at 0.746 kW/hp.'))+(p.motorKind==='standard'?`<div class="field"><label>NEC table full-load current</label><output>${fmt(demand(p).tableFLC,2)} A</output><small>${p.phases===3?'Table 430.250':'Table 430.248'}; 480 V system uses the 460 V column.</small></div>`+field('motorFLC','Motor nameplate current · A (optional)','Reference only; standard-motor conductor sizing uses NEC table FLC.'):field('motorFLC','Motor nameplate current · A','430.6(A)(1) special motor category; verify nameplate speed/type.'))+select('motorDuty','Motor duty rating',[['continuous','Continuous duty'],['other','Other duty - engineering review required']]);
 if(p.loadType==='mv-motor')return field('motorFLC','Motor rated current · A')+field('motorTrip','Motor overload protection trip setting · A','Effective overload trip current under 430.205(A), not instantaneous/short-circuit pickup.')+field('motorPower','Motor rated power · kW (optional)');
 if(['lv-vfd','mv-vfd'].includes(p.loadType))return field('driveInput','VFD rated input current · A','Input conductors only; 125% under 430.122(A) / 430.205(B).')+field('motorPower','Motor rated power · kW (optional)');
 if(p.loadType==='heater')return select('heaterCategory','Heater category',[['other','Other heater'],['process','Fixed industrial process heater'],['space','Fixed electric space heater']])+power()+(p.heaterCategory==='other'?operation():`<div class="field"><label>Operation</label><output>Continuous - mandatory</output><small>${p.heaterCategory==='process'?'425.4(B)':'424.3(B)'}. No 100% conductor exception applied.</small></div>`)+select('circuitKind','Circuit application',[['feeder','Feeder'],['branch','Branch circuit']]);
 if(p.loadType==='transformer')return field('transformerKva','Transformer rating · kVA')+field('primaryVoltage','Primary voltage · V')+field('secondaryVoltage','Secondary voltage · V')+select('transformerSide','Circuit being sized',[['primary','Primary'],['secondary','Secondary']])+select('transformerBasis','Load basis',[['full','Full transformer capacity'],['calculated','Specified calculated load']])+(p.transformerBasis==='full'?operation():power()+field('continuousPercent','Continuous portion · %','Remainder is non-continuous; no demand reduction assumed.'))+select('circuitKind','Circuit application',[['feeder','Feeder'],['branch','Branch circuit']]);
 return power()+operation()+select('circuitKind','Circuit application',[['feeder','Feeder'],['branch','Branch circuit']]);
}
const mccLabels={tag:'Equipment tag / description',type:'Equipment type',quantity:'Quantity',voltage:'Rated voltage · V',phases:'Phases',phasePair:'Line pair',horsepower:'Motor rating · HP',motorCategory:'Motor current basis',duty:'Duty classification',heaterCategory:'Heater category',ratingUnit:'Rating unit',rating:'Rated / calculated load',transformerBasis:'Transformer load basis',transformerSide:'Feeder winding',primaryVoltage:'Primary voltage · V',secondaryVoltage:'Secondary voltage · V',motorCurrent:'Nameplate current · A',motorJustification:'430.6(A)(1) justification',driveInputCurrent:'VFD rated input current · A',powerFactor:'Power factor',continuousPercent:'Continuous portion · %'};
function mccField(i,key,value,type='number'){
 const shown=typeof value==='number'&&!Number.isFinite(value)?'':value??'';
 const id=`mcc-${i}-${key}`;
 return `<div class="field"><label for="${id}">${mccLabels[key]}</label><input id="${id}" type="${type}" ${type==='number'?'step="any"':''} value="${esc(shown)}" data-mcc-index="${i}" data-mcc-field="${key}"></div>`;
}
function mccSelect(i,key,value,options){
 const id=`mcc-${i}-${key}`;
 return `<div class="field"><label for="${id}">${mccLabels[key]}</label><select id="${id}" data-mcc-index="${i}" data-mcc-field="${key}">${options.map(([v,label])=>`<option value="${esc(v)}" ${String(value)===String(v)?'selected':''}>${esc(label)}</option>`).join('')}</select></div>`;
}
function mccRatingEditor(load,i){
 if(load.type==='motor')return load.motorCategory==='standard'
  ?mccSelect(i,'horsepower',load.horsepower,[['','HP'],...Object.keys(load.phases===1?MOTOR_FLC_1PH:MOTOR_FLC).map(h=>[h,`${h} HP`])])+mccSelect(i,'motorCategory',load.motorCategory,[['standard','NEC table FLC'],['low-speed','Low-speed'],['high-torque','High-torque'],['multispeed','Multispeed']])
  :mccSelect(i,'motorCategory',load.motorCategory,[['standard','NEC table FLC'],['low-speed','Low-speed'],['high-torque','High-torque'],['multispeed','Multispeed']])+mccField(i,'motorCurrent',load.motorCurrent)+mccField(i,'motorJustification',load.motorJustification,'text');
 if(load.type==='vfd')return mccField(i,'driveInputCurrent',load.driveInputCurrent)+`<label class="check"><input type="checkbox" data-mcc-index="${i}" data-mcc-field="bypass" ${load.bypass?'checked':''}><span>VFD bypass arrangement</span></label>`;
 if(load.type==='transformer')return mccSelect(i,'transformerBasis',load.transformerBasis,[['rated','Rated kVA'],['calculated','Calculated load']])+mccField(i,'primaryVoltage',load.primaryVoltage)+mccField(i,'secondaryVoltage',load.secondaryVoltage)+mccSelect(i,'transformerSide',load.transformerSide,[['primary','Primary side'],['secondary','Secondary side']])+(load.transformerBasis==='calculated'?mccSelect(i,'ratingUnit',load.ratingUnit,[['A','A'],['kW','kW'],['kVA','kVA']]):'<div class="field"><label>Rating unit</label><output>kVA nameplate</output></div>')+mccField(i,'rating',load.rating)+(load.transformerBasis==='calculated'?mccField(i,'continuousPercent',load.continuousPercent):'')+(load.transformerBasis==='calculated'&&load.ratingUnit==='kW'?mccField(i,'powerFactor',load.powerFactor):'');
 return (load.type==='heater'?mccSelect(i,'heaterCategory',load.heaterCategory,[['other','Other heater'],['process','Fixed process'],['space','Fixed space']]):'')+mccSelect(i,'ratingUnit',load.ratingUnit,[['A','A'],['kW','kW'],['kVA','kVA']])+mccField(i,'rating',load.rating)+(load.ratingUnit==='kW'?mccField(i,'powerFactor',load.powerFactor):'');
}
function mccLoadManager(){
 const cards=(p.mccLoads||[]).map((load,i)=>{
  const calc=result.load.mcc?.loads?.find(x=>x.id===load.id);
  return `<section class="mcc-load" aria-label="Connected load ${i+1}"><div class="mcc-load-header"><h4>Load ${i+1}</h4><div class="mcc-load-actions"><button data-mcc-action="duplicate" data-mcc-index="${i}">Duplicate</button><button data-mcc-action="remove" data-mcc-index="${i}">Remove</button></div></div><div class="mcc-load-fields">${mccField(i,'tag',load.tag,'text')}${mccSelect(i,'type',load.type,[['motor','DOL motor'],['vfd','VFD input'],['heater','Heater'],['transformer','Transformer'],['general','General load']])}${mccField(i,'quantity',load.quantity)}${mccField(i,'voltage',load.voltage)}${mccSelect(i,'phases',load.phases,[[3,'Three-phase'],[1,'Single-phase']])}${p.phases===3&&load.phases===1?mccSelect(i,'phasePair',load.phasePair,[['AB','AB'],['BC','BC'],['CA','CA']]):''}${mccRatingEditor(load,i)}${load.type==='transformer'&&load.transformerBasis==='calculated'?'':mccSelect(i,'duty',load.duty,[['continuous','Continuous'],['noncontinuous','Noncontinuous']])}</div><div class="mcc-load-current"><strong>${fmt(calc?.current,2)} A / unit</strong><span>${esc(calc?.basis||'Complete the rating inputs to calculate current.')}</span></div></section>`;
 }).join('');
 return `<section class="mcc-manager" aria-label="Connected loads"><div class="mcc-manager-header"><div><h3>Connected loads</h3><p>Add equipment and enter its rating below.</p></div><button id="add-mcc-load" class="primary">+ Add Load</button></div><div class="mcc-load-list">${cards||'<p class="mcc-empty">No connected loads yet. Use Add Load to start the feeder schedule.</p>'}</div><p class="ref">Standard motor FLC uses 430.6(A)(1), Table 430.250 / 430.248. VFD input current is used under 430.122(D). Bypass and noncontinuous motor duty cases are blocked pending a separate Code evaluation.</p></section>`;
}
function neutralInputs(){
 if(p.phases!==3||mv())return '';
 return select('neutral','Neutral required',[['none','No'],['linear','Yes - imbalance only'],['nonlinear','Yes - nonlinear loads']])+(p.neutral!=='none'?field('neutralCurrent','Calculated maximum unbalanced neutral current · A','220.61: full-size neutral retained; no demand reduction. A conservative 125% check is applied. Include harmonic current where applicable.'):'');
}
function circuit(){return `<h2>Load Input</h2>${fields(field('name','Circuit name / tag','','text')+select('loadType','Load type',LOAD_TYPES)+(p.loadType==='transformer'?'':field('voltage',p.loadType==='mv-motor'?'Motor rated voltage · V':'System voltage · V','LV through 1000 V; MV above 1000 V through 15 kV.'))+select('phases','Phase configuration',[[3,'Three-phase'],[1,'Single-phase - two-wire']])+loadInputs())}${p.loadType==='mcc-feeder'?mccLoadManager():''}${loadTrace()}${result.issues.length?issueList():''}
 <h3>Circuit Arrangement</h3>${fields(field('sets','Parallel runs / conductors per phase','One complete equal-length set per raceway.')+field('circuits','Identical circuits per raceway','MV requires one circuit.')+(['heater','transformer','general'].includes(p.loadType)?neutralInputs():''))}${ref('210.19 · 215.2 · 430.6 / 430.22 / 430.122 / 430.205 · 424 / 425 · 450')}`;}
function familyOptions(){const seen=new Map();for(const c of catalog)if((c.voltage>1000)===mv()&&c.conductors===(p.construction==='single'?1:3)&&c.voltage>=circuitVoltage(p))seen.set(c.spec,`${c.sheet} · ${c.title}`);return [...seen];}
function catalogGround(c){return !c?'not determined':c.ground?`${c.ground.count} × ${label(c.ground.size)} Cu`:'none';}
function cableComposition(s){
 if(!s)return 'Not determined';
 const phases=p.phases===1?2:3;
 if(p.construction==='single')return `${phases} × 1/C ${label(s.size)} Cu`;
 const ground=!s.cable?'integral ground not determined (catalog cable unavailable)':s.cable.ground?`${catalogGround(s.cable)} integral ground (inside cable)`:'no integral ground in catalog';
 return `1 multicore cable: 3 × ${label(s.size)} Cu phases; ${ground}`;
}
function cableNote(){
 const c=result.selected?.cable;if(!c)return '';
 const b=result.selected.bend;
 return note(`Selected cable: <b>${esc(c.title)}</b><br>Catalog no. <b>${esc(c.catalogNumber)}</b> · ${label(c.size)} · overall OD <b>${fmt(c.odIn,2)} in</b>${c.coreOdIn?` · core OD ${fmt(c.coreOdIn,2)} in`:''}<br>Integral ground: ${c.ground?`${c.ground.count} × ${label(c.ground.size)} Cu`:'none'} · rated ${c.voltage} V · ${c.maxTemp}°C<br>Minimum bending radius: <b>${fmt(b?.radius,2)} in</b> = ${esc(b?.rule)} (${esc(b?.ref)})<br><small>${esc(c.source)}</small>`);
}
function cable(){const f=fam();const ratings=familyRatings(familyEntries(catalog,p))||{};return `<h2>Select the cable</h2><p class="lead">Okonite catalog constructions for aboveground raceway. Diameter, integral ground and bending radius come from the selected catalog row.</p>${fields(select('construction','Cable construction',p.phases===1?[['single','2 x single-conductor cables']]:[['single','3 × single-conductor cables'],['multi','1 × three-conductor power cable']])+select('family','Okonite catalog family',familyOptions(),'Okonite OSC 2024 product data sheets. Only families rated for the system voltage are listed.')+select('selection','Sizing mode',[['auto','Suggest smallest catalog size'],['manual','Verify a selected size']])+(p.selection==='manual'?select('size','Conductor size',SIZES.filter(s=>familyEntries(catalog,p).some(c=>c.size===s)).map(s=>[s,label(s)])) : ''))}
 <h3>Temperature basis</h3>${fields(select('insulation','Insulation rating · °C',mv()?(f?.maxTemp===105?[90,105]:[90]):[60,75,90],mv()?`Family rated ${f?.maxTemp??'—'}°C.`:'The Okonite LV families are rated 90°C.')+select('terminal','Equipment terminal basis',mv()?[['90','90°C · normal MV basis'],['105','105°C · specifically identified']]:[['auto','Auto · conservative 60/75°C'],['60','60°C'],['75','75°C · identified equipment'],['90','90°C · identified equipment']])+field('ambient','Ambient air temperature · °C','Use the hottest relevant installation segment; LV reference 30°C, MV reference 40°C.'))}
 ${check('wet','Raceway in a wet location / outdoors')}${check('wetRated','Cable insulation and fittings are identified for wet-location use')}
 ${mv()?`<h3>MV insulation level</h3>${fields(select('cableVoltage','Cable rating used for the ampacity column',Object.entries(ratings).map(([v,l])=>[v,`${v} V · ${l}% IL`]),'Dual-rated 5/8 kV cables have different insulation levels at each voltage.')+select('insulationLevel','Insulation level · %',[100,133,173],'Verify the system grounding / fault-clearing category; 173% is outside the automated catalog model.')+field('clearingMinutes','Maximum sustained ground fault · min','For insulation-level selection.'))}`:''}
 ${cableNote()}
 ${ref(mv()?'315.60(C)(7)/(9) · 315.10 · 110.40 · 300.34 / 305.5 · 330.24':'310.16 · 310.15(B)/(C) · 110.14(C) · 336.24')}`;}
function raceway(){const c=fam();return `<h2>Build the installation</h2><p class="lead">Select the raceway. The NEC fill limit follows the number of cables, and the conduit bend radius (Chapter 9 Table 2) is checked against the cable minimum bending radius.</p>${fields(select('conduitType','Raceway type',[['RMC','RMC · steel rigid'],['IMC','IMC · steel intermediate'],['EMT','EMT · steel tubing'],['PVC40','PVC · Schedule 40'],['PVC80','PVC · Schedule 80']])+select('conduitSize','Trade size',[['auto','Suggest smallest passing size'],...CONDUITS[p.conduitType].map(x=>[x.trade,x.trade+' in'])],'Catalog subset: EMT / IMC to 4 in; RMC / PVC to 6 in.')+(p.construction==='multi'?select('groundMode','Copper EGC',[['separate','Separate insulated wire EGC'],['integral','Integral grounding conductors of the cable']],'Integral: the catalog grounding conductors are compared with the 250.122 requirement.'):''))}
 <h3>Equipment Grounding & Protection</h3>${p.loadType==='mcc-feeder'?note('For MCC feeders, the upstream device entered in Feeder Information is used only as the EGC sizing basis. Feeder protection verification remains separate.','true'):fields(field('ocpd','Protective-device rating / setting for wire EGC · A','250.122: actual short-circuit/ground-fault device, not motor overload. Blank leaves EGC and fill pending.'))}${['feeder','heater','transformer','general'].includes(p.loadType)?check('verifyProtection','Also verify conventional conductor overcurrent protection (no next-size-up exception)'):''}
 ${p.loadType==='transformer'?check('verifyTransformerProtection','Verify LV transformer winding protection - Table 450.3(B)')+(p.verifyTransformerProtection?fields(field('primaryOcpd','Primary winding OCPD · A')+field('secondaryOcpd','Secondary winding OCPD · A (optional)','Blank selects primary-only winding protection. Independent from conductor/EGC protection.')):''):''}
 ${check('allPhases','All phases, neutral (if present) and EGC are together in each raceway')}${mv()?check('isolated','MV raceway is thermally isolated from other loaded raceways'):''}${check('hazardous','Hazardous / classified area (requires a separate method)')}${check('damage','Exposure to severe physical damage')}
 <h3>Roof & pulling geometry</h3>${check('rooftop','Exposed to direct sunlight above a rooftop')}${p.rooftop?fields(field('roofHeight','Clearance above roof · in','Measured to bottom of raceway.'))+(mv()?'':note(c?.xhhw2?'Selected family is XHHW-2: the 33°C rooftop adder exception applies.':'Selected family is not XHHW-2: the 33°C adder applies below 3/4 in clearance.')):''}
 ${fields(field('bends','Total bends between pull points · °','All bends in the pull section, not just one elbow. Maximum 360°.'))}
 ${note(`Fill limit: 53% for one cable, 31% for two, 40% for three or more (Chapter 9 Table 1). A separate EGC counts as one more item; one 3/C cable plus a separate EGC uses 31%.`)}`;}
function issueList(){return `<ul class="issues">${result.issues.map(x=>`<li class="${x.level}"><b>${x.level==='block'?'Resolve':'Review'}:</b> ${esc(x.message)}<small>${esc(x.ref)}</small></li>`).join('')}</ul>`;}
function circuitLabel(){return LOAD_TYPES.find(([id])=>id===p.loadType)?.[1]||p.loadType;}
function loadTrace(){const l=result.load;if(!l)return '';const m=l.mcc;return `<h3>Load-sizing basis</h3><p>${esc(l.basis)}</p><div class="equation">Circuit type = ${esc(circuitLabel())}<br>NEC reference = ${esc(l.reference)}<br>Nominal load / reference current = ${fmt(l.actual,2)} A<br>NEC minimum load-based requirement = ${fmt(l.required,2)} A<br>Required corrected/adjusted ampacity = ${fmt(l.thermal,2)} A${p.loadType==='mv-motor'?`<br>Motor overload trip setting = ${fmt(p.motorTrip,2)} A`:''}${p.loadType==='lv-motor'&&Number.isFinite(l.nameplateCurrent)?`<br>Separate motor nameplate current = ${fmt(l.nameplateCurrent,2)} A`:''}${p.loadType==='transformer'?`<br>Rated primary current = ${fmt(l.primaryCurrent,2)} A<br>Rated secondary current = ${fmt(l.secondaryCurrent,2)} A`:''}${m?.valid?`${m.mixedSinglePhase?`<br>Largest motor by conductor: ${Object.entries(m.largestMotorByPhase).map(([phase,current])=>`${phase} ${fmt(current,2)} A`).join(' · ')}; 25% extra applied separately.`:`<br>Largest motor: ${esc(m.largestMotorTag)} · ${fmt(m.largestMotorCurrent,2)} A; 125% contribution = ${fmt(m.largestMotorContribution,2)} A<br>Remaining motor current: ${fmt(m.remainingMotorCurrent,2)} A`}<br>Continuous nonmotor current: ${fmt(m.continuousNonmotorCurrent,2)} A; 125% contribution = ${fmt(m.continuousNonmotorContribution,2)} A<br>Noncontinuous nonmotor current: ${fmt(m.noncontinuousNonmotorCurrent,2)} A<br>Required feeder ampacity by conductor: ${Object.entries(m.currentsByPhase).map(([phase,current])=>`${phase} ${fmt(current,2)} A`).join(' · ')}<br>Upstream device rating: ${Number.isFinite(p.ocpd)?`${fmt(p.ocpd,2)} A (excluded from ampacity requirement; used for EGC basis)`:'not entered'}<br>${esc(m.protectionStatus)}</div><div class="tablewrap"><table><thead><tr><th>Tag</th><th>Load type</th><th>Qty</th><th>Current per unit</th><th>Calculated total</th><th>NEC basis</th></tr></thead><tbody>${m.loads.map(x=>`<tr><td>${esc(x.tag)}</td><td>${esc(x.type)}</td><td>${x.quantity}</td><td>${fmt(x.current,2)} A</td><td>${fmt(x.totalCurrent,2)} A</td><td>${esc(x.basis)}</td></tr>`).join('')}</tbody></table></div>`:''}</div>`;}
function arithmetic(){const s=result.selected;if(!s)return loadTrace();return `${loadTrace()}<h3>Cable ampacity and installation checks</h3><div class="equation">Base cable ampacity: Table ${s.ref}, ${label(s.size)} at ${p.insulation}°C = ${fmt(s.base,2)} A per set<br>Ambient = ${fmt(p.ambient)} + ${result.adder} = ${fmt(result.ambient)}°C → temperature correction ${result.factor}<br>${result.ccc} current-carrying conductors per raceway → adjustment ${result.adjust}<br>Corrected/adjusted check: ${fmt(s.corrected*p.sets,2)} A >= ${fmt(result.load.thermal,2)} A - ${s.thermalPass?'Pass':'Fail'}<br>Termination ceiling at ${s.terminal}°C = ${fmt(s.term,2)} A per set<br>Before-adjustment check (insulation / terminations): ${fmt(s.unadjusted*p.sets,2)} A >= ${fmt(result.load.required,2)} A - ${s.terminalPass?'Pass':'Fail'}<br>Minimum size by terminations / insulation = ${label(result.minTerminal)}<br>Minimum size by corrected ampacity = ${label(result.minThermal)}<br>${p.sets} equal sets → selected allowable ampacity = ${fmt(s.allowed,2)} A<br>Conventional OCPD = ${fmt(result.protection?.rating,2)} A; load-based minimum = ${fmt(result.protection?.required,2)} A (${result.protection?.checked?'checked':'not verified'})<br>Full-size neutral: ${p.neutral==='none'?'not required':`${label(s.size)}; conservative requirement ${fmt(s.neutralRequired,2)} A - ${s.neutralPass?'Pass':'Fail'}`}<br>Minimum family size meeting ampacity/protection = ${label(result.minAmp)}</div>
 <div class="equation">EGC protective-device basis = ${fmt(p.ocpd,2)} A (entered independently from motor FLC / overload trip)<br>EGC base = ${s.g?label(s.g.base):'—'} · phase area increase ratio = ${fmt(s.g?.ratio,3)}<br>Required copper EGC in each raceway = ${s.g?`${label(s.g.size)} (${fmt(s.g.required,2)} kcmil)`:'—'}${p.groundMode==='integral'?`<br>Integral grounds = ${s.cable?.ground?`${s.cable.ground.count} × ${label(s.cable.ground.size)} = ${fmt(s.groundKcmil,2)} kcmil`:'none'}`:''}<br>Cable ${esc(s.cable?.catalogNumber??'—')} · OD = ${fmt(s.cable?.odIn,3)} in · rated ${s.cable?.voltage??'—'} V<br>Fill items = ${s.conduit?.count??'—'} · occupied area = ${fmt(s.conduit?.used,4)} in²<br>Raceway internal area = ${fmt(s.conduit?.area,4)} in²<br>Fill = ${fmt(s.conduit?.percent,2)}% · NEC limit = ${s.conduit?.nec??'—'}%</div>
 <div class="equation">Bend total = ${p.bends}° / 360°<br>Cable minimum bending radius = ${esc(s.bend?.rule??'—')} = ${fmt(s.bend?.radius,2)} in (${esc(s.bend?.ref??'')})<br>Conduit ${esc(s.conduit?.trade??'—')} in bend radius (Chapter 9 Table 2, other bends) = ${s.conduit?.bendRadius??'—'} in<br>Phase-cable jam screening: D/d = ${fmt(s.conduit?.jamRatio,3)} · 1.05D/d = ${fmt(s.conduit?.jamCorrected,3)}${p.construction==='multi'?' (not applicable to one 3/C cable)':''}<br>Geometry screening is not a pulling-tension or sidewall-pressure calculation.</div>`;}
function verdict(x){return x.pass?'Pass':!x.ampPass?'Ampacity / protection':!x.cable?'Not in family':!x.cablePass||!x.voltageBandPass||!x.levelPass||!x.tempPass?'Cable rating':!Number.isFinite(p.ocpd)?'EGC / fill pending':!x.integralPass?'Integral EGC':!x.conduit?'Fill / bend radius':!x.conduit.fillPass?'Conduit fill':!x.conduit.bendPass?'Bend radius':'Review'}
function voltageDropInputs(){
 return note(`Selected circuit: <b>${cableComposition(result.selected)}</b><br>${p.sets} equal parallel set${p.sets>1?'s':''} · ${circuitVoltage(p)} V · ${p.phases===1?'single-phase two-wire':'three-phase'}. This check does not change the selected cable.`)+fields(
  field('vdLength','One-way route length','Source to load; do not double the distance.')+
  select('vdLengthUnit','Length unit',[['ft','Feet'],['m','Metres']])+
  field('vdPowerFactor','Operating power factor','Lagging PF, above 0 and at most 1; independent from conductor-sizing load factors.')+
  field('vdLimit','Maximum voltage drop · %','User-defined design limit; includes only this circuit segment.')+
  select('vdCurrentBasis','Operating current basis',[['load','Use circuit operating / reference current'],['manual','Enter operating current']])+
  (p.vdCurrentBasis==='manual'?field('vdCurrent','Operating line current · A','Total for one circuit, before sharing across parallel sets.'):note(`Circuit operating / reference current: <b>${fmt(result.load?.mcc?.operatingCurrent??result.load?.actual,2)} A</b>. No 125% conductor-sizing multiplier is applied.`))+
  select('vdMethod','Impedance basis',[['custom','Documented cable / installation R and X'],['reference','Reference · copper in PVC, 75°C, 60 Hz']])+
  field('frequency','System frequency · Hz','Reference data require 60 Hz; documented impedance must match this frequency.')+
  (p.vdMethod==='custom'?field('vdResistance','AC resistance R · ohms/1000 ft','Per phase conductor, not divided by parallel sets. At the documented operating temperature.')+
   field('vdReactance','Reactance X · ohms/1000 ft','Per phase conductor for the selected cable and raceway. Zero is permitted.')+
   field('vdSource','R/X source and conditions','Document conductor size, temperature, frequency and installation arrangement. Changing the cable or raceway requires new R/X entries.','text')
   :note('Reference data are shared with the Voltage Drop app. Valid only for LV single conductors in PVC at 75°C and 60 Hz. Metallic raceways, multicore and MV cables require documented R/X.',true))
 );
}
function voltageDropStep(){
 return `<h2>Voltage drop</h2><p class="lead">Optional steady-state check for the selected cable and parallel sets.</p>${check('vdEnabled','Calculate voltage drop and include it in the final report')}${p.vdEnabled?voltageDropInputs()+voltageDropResults():note('Not enabled. Voltage-drop inputs and results will be omitted from Results and Print calculation.')}`;
}
function voltageDropResults(){
 if(!p.vdEnabled)return '';
 const v=result.voltageDrop;
 if(!v?.valid)return `<section class="vd-results"><h3>Voltage drop · pending</h3>${note((v?.errors||['Complete the voltage-drop inputs.']).map(esc).join('<br>'),true)}</section>`;
 return `<section class="vd-results"><h3>Voltage drop</h3><div class="vd-metrics"><div><span>Voltage drop</span><strong>${fmt(v.drop,2)} V</strong></div><div><span>Drop / ${fmt(p.vdLimit,2)}% limit</span><strong>${fmt(v.percent,2)}%</strong><b>${v.pass?'Within limit':'Above limit'}</b></div><div><span>Estimated load voltage</span><strong>${fmt(v.receivingVoltage,2)} V</strong></div></div>
 <div class="equation">Selected phase conductor = ${label(result.selected.size)} Cu · ${p.sets} equal parallel set${p.sets>1?'s':''}<br>Operating current = ${fmt(v.current,2)} A (${p.vdCurrentBasis==='load'?'circuit operating / reference current':'entered operating current'})<br>One-way length = ${fmt(p.vdLength,2)} ${esc(p.vdLengthUnit)} = ${fmt(v.lengthFt,2)} ft<br>R = ${fmt(v.r,4)}; X = ${fmt(v.x,4)} ohms/1000 ft per conductor<br>PF = ${fmt(p.vdPowerFactor,3)} lagging<br>Z effective = R × PF + X × √(1 − PF²) = ${fmt(v.effectiveImpedance,5)} ohms/1000 ft<br>ΔV = ${p.phases===3?'√3':'2'} × ${fmt(v.current,2)} × ${fmt(v.effectiveImpedance,5)} × ${fmt(v.lengthFt,2)} / (1000 × ${p.sets}) = ${fmt(v.drop,2)} V<br>ΔV% = 100 × ΔV / ${circuitVoltage(p)} = ${fmt(v.percent,2)}%<br>Estimated load voltage = ${circuitVoltage(p)} − ${fmt(v.drop,2)} = ${fmt(v.receivingVoltage,2)} V</div>
 <p class="ref">Impedance basis: ${esc(v.basis)}</p>${v.warnings.map(w=>ref(esc(w))).join('')}</section>`;
}
function candidateTable(){return `<div class="tablewrap"><table><thead><tr><th>Size</th><th>Catalog no.</th><th>Allowed A</th><th>Conduit</th><th>Fill</th><th>Cable / conduit bend R</th><th>Numerical checks</th></tr></thead><tbody>${result.candidates.filter(x=>x.cable||p.selection==='manual').map(x=>`<tr class="${x.size===result.selected?.size?'selected':''}"><td>${label(x.size)}</td><td>${esc(x.cable?.catalogNumber??'—')}</td><td class="numeric">${fmt(x.allowed)}</td><td>${esc(x.conduit?.trade??'—')}</td><td class="numeric">${fmt(x.conduit?.percent)}%</td><td class="numeric">${fmt(x.bend?.radius)} / ${x.conduit?.bendRadius??'—'} in</td><td>${verdict(x)}</td></tr>`).join('')}</tbody></table></div>`;}
function results(){return `<h2>Results</h2><p class="lead">${esc(result.status)}. Numerical results cover the stated model.</p>${result.selected&&p.selection==='auto'?`<button id="use-size" class="primary">Use ${label(result.selected.size)} for detailed verification</button>`:''}${issueList()}${voltageDropResults()}${arithmetic()}<h3>Candidate comparison</h3>${candidateTable()}`;}
function guide(){return `<h2>How aboveground raceway sizing works</h2><p class="lead">Read the method in order, or search for a topic or NEC section. Code requirements, design choices and manufacturer checks are identified separately.</p><input class="guide-search" id="guide-search" aria-label="Search learning guide" placeholder="Search: ampacity, 315.60, grounding, bending…"><div id="guide-items">${GUIDE.map(([title,text,basis])=>`<details><summary>${title}</summary><p>${text}</p>${ref(basis)}</details>`).join('')}</div><h3>Reference sources</h3>${SOURCES.map(([name,url,desc])=>`<p><a href="${url}" target="_blank" rel="noopener">${name}</a><br><small>${desc}</small></p>`).join('')}<p class="ref">See <a href="SOURCES.md">data provenance and implementation notes</a>. Consult the adopted NEC text for the full conditions and exceptions.</p>`;}
function summary(){const s=result.selected;const klass=result.status==='Blocked'?'blocked':result.status==='Calculated'?'calculated':'review';return `<div class="plate"><span class="status ${klass}">${result.status}</span><p class="ref">${p.selection==='auto'?'SIZING PROPOSAL':'SELECTED CIRCUIT'} · ${mv()?'MV':'LV'}</p><div class="metric">${s?label(s.size):'—'}</div><div>${p.sets} set${p.sets>1?'s':''} · ${cableComposition(s)}</div><div class="ref">${esc(s?.cable?`Okonite ${s.cable.catalogNumber}`:'')}</div><hr><p class="ref">PER RACEWAY</p><div class="metric small">${s?.conduit?esc(s.conduit.trade)+' in':'—'} ${p.conduitType}</div><div>${p.circuits} circuit${p.circuits>1?'s':''} · EGC ${p.groundMode==='integral'?`${catalogGround(s?.cable)} integral`:s?.g?`${label(s.g.size)} Cu separate`:'pending (separate)'}</div></div><div class="mini"><dl><dt>Operating / required current</dt><dd>${fmt(result.load?.actual)} / ${fmt(result.load?.required)} A</dd><dt>Final allowable ampacity · all sets</dt><dd>${fmt(s?.allowed)} A</dd><dt>Conduit fill</dt><dd>${fmt(s?.conduit?.percent)}% / ${s?.conduit?.nec??'—'}%</dd><dt>Bend radius · cable / conduit</dt><dd>${fmt(s?.bend?.radius)} / ${s?.conduit?.bendRadius??'—'} in</dd></dl><div class="bar"><span style="width:${Math.min(100,s?.conduit?.percent||0)}%"></span></div><p class="ref">${result.issues.filter(x=>x.level==='block').length} blocking · ${result.issues.filter(x=>x.level==='review').length} review items</p></div><div class="mini"><b>Two independent checks</b><p class="ref">Ampacity controls conductor heat.<br>Fill and bend radius control the raceway.<br>Passing one does not establish the other.</p></div>`;}
function render(){result=calculate(p,catalog);$('#editor').innerHTML=[circuit,cable,raceway,voltageDropStep,results,guide][step]()+ (step<5?`<div class="next"><button id="previous" ${step===0?'disabled':''}>← Previous</button><button id="next" class="primary">${step===4?'Open learning guide':'Continue →'}</button></div>`:'');$('#summary').innerHTML=summary();$('.navnote').innerHTML=`${p.phases===1?'SINGLE-PHASE':'THREE-PHASE'} · ${p.frequency} Hz<br>Cu conductors<br>LV ≤1 kV · MV >1–15 kV`;document.querySelectorAll('[data-step]').forEach(x=>x.classList.toggle('active',Number(x.dataset.step)===step));}
function syncFamily(){
 const family=familyOptions();if(!family.some(([id])=>id===p.family))p.family=family[0]?.[0]||'';
 const entries=familyEntries(catalog,p);const c=entries[0];if(!c)return;
 const ratings=familyRatings(entries);
 if(!mv()||!ratings)p.cableVoltage=c.voltage;
 else if(!ratings[p.cableVoltage]||p.cableVoltage<circuitVoltage(p))p.cableVoltage=Number(Object.keys(ratings).find(v=>Number(v)>=circuitVoltage(p))||Object.keys(ratings)[0]);
 if(mv()&&p.insulation>c.maxTemp)p.insulation=c.maxTemp;
 if(!entries.some(x=>x.size===p.size))p.size=entries.find(x=>SIZES.indexOf(x.size)>=SIZES.indexOf(p.size))?.size||entries[0].size;
}
function go(n){step=n;render();window.scrollTo({top:0,behavior:'smooth'});}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.step!==undefined)go(Number(b.dataset.step));
 if(b.id==='next')go(Math.min(5,step+1)); if(b.id==='previous')go(Math.max(0,step-1));
 if(b.id==='add-mcc-load'){const item=newMccLoad('motor',`load-${Date.now()}-${Math.random().toString(36).slice(2,7)}`);item.voltage=p.voltage;item.horsepower=NaN;p.mccLoads=[...(p.mccLoads||[]),item];render();}
 if(b.dataset.mccAction){const index=Number(b.dataset.mccIndex);if(b.dataset.mccAction==='remove')p.mccLoads=p.mccLoads.filter((_,i)=>i!==index);if(b.dataset.mccAction==='duplicate'){const copy={...p.mccLoads[index],id:`load-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,tag:`${p.mccLoads[index].tag||'Load'} copy`};p.mccLoads=[...p.mccLoads.slice(0,index+1),copy,...p.mccLoads.slice(index+1)];}render();}
 if(b.id==='use-size'&&result.selected){p.size=result.selected.size;p.selection='manual';if(result.selected.conduit)p.conduitSize=result.selected.conduit.trade;render();showNotice('Selected size and conduit retained for detailed verification.');}
});
$('#editor').addEventListener('change',e=>{
 const t=e.target;
 if(t.dataset.mccField){const index=Number(t.dataset.mccIndex),key=t.dataset.mccField;let value=t.type==='checkbox'?t.checked:t.type==='number'?(t.value.trim()===''?NaN:Number(t.value)):t.value;if(key==='phases')value=Number(value);
  if(key==='type'){const old=p.mccLoads[index],next=newMccLoad(value,old.id);Object.assign(next,{tag:old.tag,quantity:old.quantity,voltage:old.voltage,phases:old.phases,phasePair:old.phasePair,duty:old.duty});if(value==='motor')next.horsepower=NaN;if(value==='vfd')next.driveInputCurrent=NaN;p.mccLoads=p.mccLoads.map((x,i)=>i===index?next:x);}
  else p.mccLoads=p.mccLoads.map((x,i)=>i===index?{...x,[key]:value}:x);
  render();return;
 }
 const key=t.dataset.key;if(!key)return;
 if(['vdResistance','vdReactance','vdSource'].includes(key)){
  const nextKey=impedanceKey(p,result.selected);
  if(p.vdImpedanceKey!==nextKey){p.vdResistance=NaN;p.vdReactance=NaN;p.vdSource='';}
  p.vdImpedanceKey=nextKey;
 }
 const oldMV=mv(),oldLoadType=p.loadType; p[key]=t.type==='checkbox'?t.checked:t.type==='number'?(t.value.trim()===''?NaN:Number(t.value)):t.value;
 if(['motorHp','motorVoltage'].includes(key))p[key]=t.value.trim()===''?NaN:Number(t.value);
 if(['insulation','insulationLevel','cableVoltage','phases'].includes(key))p[key]=Number(t.value);
 if(key==='loadType'&&oldLoadType!==p.loadType)p=changeLoadType(p,p.loadType);
 if(oldMV!==mv()){p.insulation=90;p.terminal=mv()?'90':'auto';p.neutral='none';p.circuits=1;}
 if(key==='phases'){p.neutral='none';if(p.phases===1){p.construction='single';p.groundMode='separate';}}
 if(['inputMode','powerBasis','transformerBasis','heaterCategory'].includes(key)){p.efficiency=NaN;p.operation='';}
 if(key==='motorPowerUnit'){p.motorHp=NaN;p.motorPower=NaN;}
 if(key==='motorKind')p.motorFLC=NaN;
 if(key==='feederUnit'){p.continuous=NaN;p.noncontinuous=NaN;}
 if(key==='neutral')p.neutralCurrent=NaN;
 if(key==='conduitType')p.conduitSize='auto';
 if(key==='construction'){p.neutral='none';p.groundMode='separate';}
 if(['family','construction','voltage','primaryVoltage','secondaryVoltage','transformerSide','loadType','phases'].includes(key))syncFamily();
 render();
});
$('#editor').addEventListener('input',e=>{if(e.target.id==='guide-search'){const q=e.target.value.toLowerCase();document.querySelectorAll('#guide-items details').forEach(x=>{x.hidden=!x.textContent.toLowerCase().includes(q);if(q)x.open=!x.hidden;});}});
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
$('#save').onclick=()=>{try{localStorage.setItem(KEY,JSON.stringify(p));showNotice('Saved on this browser. Export JSON to keep a transferable backup.');}catch{showNotice('Browser storage is unavailable. Use Export JSON instead.');}};
$('#export').onclick=()=>download('conduit-way-lab-project.json',JSON.stringify(p,null,2),'application/json');
$('#import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;const next=loadProject(JSON.parse(await file.text()));p=next;syncFamily();step=0;render();showNotice('Project imported. Recalculate and review the sizing basis before issue.');}catch{showNotice('Import failed: select a valid Conduit Way Lab version 2–7 JSON file. Current design retained.');}e.target.value='';};
// Reuse the editor step markup so the record shows the same labels, units and choices the engineer saw.
function inputRecord(){
 const t=document.createElement('template');
 return [['Circuit & load',circuit],['Cable & ampacity',cable],['Raceway & installation',raceway],...(p.vdEnabled?[['Voltage drop',voltageDropInputs]]:[])].map(([section,view])=>{
  t.innerHTML=view();
  const rows=[...t.content.querySelectorAll('.field, label.check')].map(el=>{
   if(el.querySelector('[data-mcc-field]'))return null;
   if(el.matches('label.check'))return [el.querySelector('span').textContent,el.querySelector('input').checked?'Yes':'No'];
   const control=el.querySelector('select, input');if(!control)return null;
   const title=el.querySelector('label').textContent;
   if(control.tagName==='SELECT'){const o=[...control.options].find(o=>o.selected)||control.options[0];return [title,o&&o.value!==''?o.textContent:'Not entered'];}
   return [title,control.getAttribute('value')?.trim()||'Not entered'];
  }).filter(Boolean);
  return `<tr><th colspan="2">${section}</th></tr>`+rows.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');
 }).join('');
}
const RACEWAY_NAMES={RMC:'RMC · rigid steel',IMC:'IMC · intermediate steel',EMT:'EMT · steel tubing',PVC40:'PVC Schedule 40',PVC80:'PVC Schedule 80'};
const passText=ok=>ok===undefined||ok===null?'<span class="pending">Pending</span>':ok?'<span class="ok">Pass</span>':'<span class="fail">Fail</span>';
function selectionTable(){
 const s=result.selected,c=s?.cable,g=s?.g,cd=s?.conduit;
 const cond=cableComposition(s);
 const rows=[[
  'Phase conductors',
  s?`${p.sets} set${p.sets>1?'s':''} of ${cond} per circuit`:cond,
  c?`Okonite ${esc(c.catalogNumber)} · ${esc(c.title)}<br>${c.voltage} V · ${c.maxTemp}°C insulation · OD ${fmt(c.odIn,2)} in<br>Allowable ampacity (all sets): <b>${fmt(s.allowed,2)} A</b> vs. required ${fmt(result.load?.required,2)} A`:'No catalog cable selected'
 ]];
 if(p.neutral!=='none'&&s)rows.push(['Neutral',`${p.sets} × 1/C ${label(s.size)} Cu (full size)`,`Required ${fmt(s.neutralRequired,2)} A · ${s.neutralPass?'Pass':'Fail'}`]);
 rows.push([
  'Equipment grounding conductor',
  p.groundMode==='integral'?`Integral cable grounds: ${catalogGround(c)} (inside cable)`:!g?'Separate EGC pending · enter protective-device rating':`1 × ${label(g.size)} Cu insulated per raceway (separate from cable)`,
  g?`Minimum per 250.122: ${label(g.size)} Cu (${fmt(g.required,2)} kcmil)<br>Device basis ${fmt(p.ocpd,0)} A${g.ratio>1?` · increased by phase-area ratio ${fmt(g.ratio,3)}`:''}`:'250.122 basis not available'
 ]);
 rows.push([
  'Raceway',
  cd?`${p.sets} × ${esc(cd.trade)} in ${esc(RACEWAY_NAMES[p.conduitType]||p.conduitType)}`:'Not determined',
  cd?`${p.circuits} circuit${p.circuits>1?'s':''} per raceway · ${cd.count} fill item${cd.count>1?'s':''}<br>Fill <b>${fmt(cd.percent,1)}%</b> of ${cd.nec}% limit · bend radius ${cd.bendRadius} in vs. cable minimum ${fmt(s.bend?.radius,2)} in`:'Fill and bend checks unavailable'
 ]);
 return `<table class="print-selection"><thead><tr><th>Item</th><th>Selected</th><th>Key data</th></tr></thead><tbody>${rows.map(([a,b,d])=>`<tr><th scope="row">${a}</th><td class="pick">${b}</td><td>${d}</td></tr>`).join('')}</tbody></table>`;
}
const MCC_TYPE_NAMES={motor:'DOL motor',vfd:'VFD input',heater:'Heater',transformer:'Transformer',general:'General load'};
function mccRatingText(l){
 if(l.type==='motor')return l.motorCategory==='standard'?`${Number.isFinite(Number(l.horsepower))&&l.horsepower!==''?esc(l.horsepower):'—'} HP · NEC table FLC`:`${fmt(l.motorCurrent,2)} A nameplate · ${esc(l.motorCategory)}`;
 if(l.type==='vfd')return `${fmt(l.driveInputCurrent,2)} A drive input${l.bypass?' · bypass':''}`;
 if(l.type==='transformer')return l.transformerBasis==='rated'?`${fmt(l.rating,1)} kVA rated · ${l.primaryVoltage}/${l.secondaryVoltage} V, ${l.transformerSide} side`:`${fmt(l.rating,1)} ${esc(l.ratingUnit)} calculated · ${fmt(l.continuousPercent,0)}% continuous`;
 return `${fmt(l.rating,2)} ${esc(l.ratingUnit)}${l.ratingUnit==='kW'?` · PF ${fmt(l.powerFactor,2)}`:''}`;
}
function mccInputTable(){
 if(p.loadType!=='mcc-feeder')return '';
 const loads=p.mccLoads||[];
 return `<h3>Connected loads</h3>${loads.length?`<table class="print-schedule"><thead><tr><th>Tag</th><th>Type</th><th>Qty</th><th>Voltage / phases</th><th>Rating</th><th>Duty</th></tr></thead><tbody>${loads.map((l,i)=>`<tr><td>${esc(l.tag||`Load ${i+1}`)}</td><td>${esc(MCC_TYPE_NAMES[l.type]||l.type)}</td><td>${esc(l.quantity)}</td><td>${esc(l.voltage)} V · ${l.phases===1?`1Ø ${esc(l.phasePair||'')}`:'3Ø'}</td><td>${mccRatingText(l)}</td><td>${l.type==='transformer'&&l.transformerBasis==='calculated'?'per %':esc(l.duty)}</td></tr>`).join('')}</tbody></table>`:'<p>No connected loads entered.</p>'}`;
}
function criteriaList(){
 const s=result.selected,l=result.load;
 const items=[
  ['Code basis','NFPA 70, National Electrical Code 2023 edition. Copper conductors, aboveground raceway, Okonite catalog cable data.'],
  ['Load / required ampacity',l?`${esc(l.basis)} (${esc(l.reference)})`:'Load not determined'],
  ['Conductor ampacity',s?`Table ${esc(s.ref)} at ${p.insulation}°C insulation rating; ambient ${fmt(result.ambient)}°C${result.adder?` (including ${result.adder}°C rooftop adder)`:''} → correction ${result.factor}; ${result.ccc} current-carrying conductors → adjustment ${result.adjust}.`:'Not determined'],
  ['Terminations',s?`Allowable ampacity limited to the ${s.terminal}°C terminal column (${mv()?'110.40':'110.14(C)'}).`:'—'],
  ['Parallel conductors',p.sets>1?`${p.sets} equal sets in separate raceways (310.10(G)).`:'Single set; no paralleling.'],
  ['Equipment grounding conductor','Table 250.122 based on the upstream protective device; increased proportionally to phase-conductor area under 250.122(B). Motor overload settings are not used.'],
  ['Raceway fill','NEC Chapter 9 Table 1 limits (53% / 31% / 40%) using catalog cable outside diameters and Chapter 9 Table 4 internal areas.'],
  ['Bending radius','Conduit bend radius (Chapter 9 Table 2) must be at least the cable minimum bending radius; total bends ≤ 360°. Pulling tension and sidewall pressure are not calculated.'],
  ['Selection rule',p.selection==='auto'?'Smallest catalog size passing all numerical checks; smallest passing trade size unless a size was specified.':'User-selected conductor size verified against all numerical checks.']
 ];
 if(p.vdEnabled)items.push(['Voltage drop','Steady-state lagging-PF approximation: ΔV = k × I × (R × PF + X × √(1 − PF²)) × L / (1000 × parallel sets), k = √3 (balanced three-phase) or 2 (single-phase two-wire). L is the one-way distance in ft; R and X are ohms/1000 ft per conductor. The entered percentage is a design limit, not a universal NEC compliance test.']);
 return `<table class="print-kv"><tbody>${items.map(([k,v])=>`<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>`;
}
function resultChecks(){
 const s=result.selected,l=result.load;if(!s)return '<p>No conductor could be evaluated. See outstanding items.</p>';
 const cd=s.conduit,g=s.g,rows=[
  ['Ampacity before adjustment (insulation / terminations)',`≥ ${fmt(l.required,2)} A`,`${fmt(s.unadjusted*p.sets,2)} A`,s.terminalPass],
  ['Corrected and adjusted ampacity',`≥ ${fmt(l.thermal,2)} A`,`${fmt(s.corrected*p.sets,2)} A`,s.thermalPass],
  ['Final allowable ampacity (all sets)',`≥ ${fmt(l.required,2)} A`,`${fmt(s.allowed,2)} A`,s.ampPass],
  ['Cable voltage rating',`≥ ${circuitVoltage(p)} V`,s.cable?`${s.cable.voltage} V`:'—',s.cable?s.cablePass&&s.voltageBandPass&&s.levelPass:false],
  ['Equipment grounding conductor',g?`${label(g.size)} (${fmt(g.required,2)} kcmil)`:'—',p.groundMode==='integral'?`${catalogGround(s.cable)} integral (${fmt(s.groundKcmil,2)} kcmil)`:g?`${label(g.size)} separate`:'—',g?s.integralPass:null],
  ['Raceway fill',cd?`≤ ${cd.nec}%`:'—',cd?`${fmt(cd.percent,1)}%`:'—',cd?cd.fillPass:null],
  ['Conduit bend radius',s.bend?`≥ ${fmt(s.bend.radius,2)} in`:'—',cd?`${cd.bendRadius} in`:'—',cd?cd.bendPass:null]
 ];
 if(p.neutral!=='none')rows.splice(3,0,['Full-size neutral',`≥ ${fmt(s.neutralRequired,2)} A`,`${fmt(s.allowed,2)} A`,s.neutralPass]);
 if(p.vdEnabled)rows.push(['Voltage drop',`≤ ${fmt(p.vdLimit,2)}%`,result.voltageDrop?.valid?`${fmt(result.voltageDrop.percent,2)}%`:'—',result.voltageDrop?.valid?result.voltageDrop.pass:null]);
 return `<table class="print-checks"><thead><tr><th>Check</th><th>Required</th><th>Provided</th><th>Result</th></tr></thead><tbody>${rows.map(([a,b,c,d])=>`<tr><td>${a}</td><td class="numeric">${b}</td><td class="numeric">${c}</td><td>${passText(d)}</td></tr>`).join('')}</tbody></table>`;
}
function printCalculation(){
 result=calculate(p,catalog);const inputRows=inputRecord();
 const space='<tr><td><div class="print-space"></div></td></tr>';
 const blocks=result.issues.filter(x=>x.level==='block').length,reviews=result.issues.filter(x=>x.level==='review').length;
 const klass=result.status==='Blocked'?'blocked':result.status==='Calculated'?'calculated':'review';
 $('#printout').innerHTML=`<table class="print-frame"><thead>${space}</thead><tfoot>${space}</tfoot><tbody><tr><td>
 <div class="print-title"><div><h1>Conduit Way Lab · NEC 2023</h1><p><b>${esc(p.name)}</b> · ${esc(circuitLabel())} · ${circuitVoltage(p)} V ${p.phases===1?'single-phase':'three-phase'} · ${new Date().toISOString().slice(0,10)}</p></div><span class="status ${klass}">${result.status==='Calculated'?'CALCULATED':'DRAFT · '+esc(result.status.toUpperCase())}</span></div>
 <h2>1. Selected cable, grounding conductor and raceway</h2>${selectionTable()}
 ${blocks||reviews?`<p class="print-flag">${[blocks?`${blocks} blocking item${blocks>1?'s':''}`:'',reviews?`${reviews} review item${reviews>1?'s':''}`:''].filter(Boolean).join(' and ')} open. See section 5 before issue.</p>`:''}
 <h2>2. Input data</h2><table class="input-record"><thead><tr><th>Input</th><th>Value</th></tr></thead><tbody>${inputRows}</tbody></table>${mccInputTable()}
 <h2>3. Calculation criteria</h2>${criteriaList()}
 <h2>4. Results</h2><h3>Summary of checks</h3>${resultChecks()}${voltageDropResults()}${arithmetic()}<h3>Candidate comparison</h3>${candidateTable()}
 <h2>5. Outstanding items</h2>${result.issues.length?issueList():'<p>None recorded.</p>'}
 <h2>6. References</h2>${SOURCES.map(([n,u,d])=>`<p class="ref"><b>${n}</b> · ${u}<br>${d}</p>`).join('')}<p class="ref">This calculation is limited to the implemented scope and does not certify the installation. See the app learning guide and SOURCES.md for all scope restrictions.</p>
 </td></tr></tbody></table>`;
 window.print();
}
$('#print').onclick=printCalculation;
$('#example-lv').onclick=()=>{p={...newProject(),continuous:100,noncontinuous:0,ocpd:150};syncFamily();step=0;render();showNotice('LV example: 100 A continuous feeder, 480 V, 40°C, 150 A OCPD, Okonite RHH/RHW-2.');};
$('#example-mv').onclick=()=>{p={...newProject(),name:'Example · 4.16 kV motor circuit',voltage:4160,loadType:'mv-motor',motorFLC:250,motorTrip:280,family:'2:4',cableVoltage:5000,insulationLevel:100,selection:'auto',terminal:'90',ambient:40,ocpd:400};syncFamily();step=4;render();showNotice('MV motor example: 250 A rated current, 280 A overload trip, independent 400 A EGC device basis.');};
try{const response=await fetch('./catalog.json');if(!response.ok)throw Error('catalog');catalog=await response.json();try{const raw=localStorage.getItem(KEY)||localStorage.getItem(LEGACY_KEY);if(raw){p=loadProject(JSON.parse(raw));showNotice('Saved project restored. Check the required ampacity and recalculate before use.');}}catch{showNotice('Starting a new project; saved browser data could not be read.');}syncFamily();render();}catch{showNotice('Cable catalog could not be loaded. Serve the application over HTTP and reload; calculations are unavailable.');}
