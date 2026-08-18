"use strict";
/* ============================ DATA ============================ */
const FT = 0.3048;
const T = {
 C1:[["Surrounded by taller structures/trees within 3H",0.25],
     ["Surrounded by structures of equal or lesser height within 3H",0.5],
     ["Isolated structure (nothing within 3H)",1],
     ["Isolated structure on a hilltop",2]],
 C2:[["Metal structure — Metal roof",0.5],["Metal structure — Nonmetallic roof",1],["Metal structure — Combustible roof",2],
     ["Nonmetallic structure — Metal roof",1],["Nonmetallic structure — Nonmetallic roof",1],["Nonmetallic structure — Combustible roof",2.5],
     ["Combustible structure — Metal roof",2],["Combustible structure — Nonmetallic roof",2.5],["Combustible structure — Combustible roof",3]],
 C3:[["Low value and noncombustible",0.5],["Standard value and noncombustible",1],
     ["High value, moderate combustibility",2],["Exceptional value, flammable liquids, computer or electronics",3],
     ["Exceptional value, irreplaceable cultural items",4]],
 C4:[["Unoccupied",0.5],["Normally occupied",1],["Difficult to evacuate or risk of panic",3]],
 C5:[["Continuity of services NOT required, no environmental impact",1],
     ["Continuity of services required, no environmental impact",5],
     ["Consequences to the environment",10]],
 PB:[["No LPS",1],["Class IV LPS",0.2],["Class III LPS",0.1],["Class II LPS",0.05],["Class I LPS",0.02],
     ["Class I + continuous metal framework as natural down-conductor",0.01],
     ["Metal roof + full rooftop protection + natural framework",0.001]],
 PTA:[["No protection measures",1],["Warning notices",0.1],["Insulation of exposed down-conductors",0.01],
      ["Effective soil equipotentialization",0.01],["Physical restrictions / framework as down-conductor",0]],
 PTU:[["No protection measures",1],["Warning notices",0.1],["Electrical insulation",0.01],["Physical restrictions",0]],
 SPD:[["No SPD system",1],["SPDs LPL III–IV",0.05],["SPDs LPL II",0.02],["SPDs LPL I",0.01],["SPDs better than LPL I",0.005]],
 CLDI:[["Unshielded line (or shield not bonded)",[1,1]],
       ["Shielded, shield bonded to equipment bonding bar",[1,0.3]],
       ["Shielded + bonded, low shield resistance",[1,0.1]],
       ["Lightning-protective cable / grounded metal conduit",[0,0]]],
 PLDrows:[["Unshielded (or shield not bonded)",[1,1,1,1,1]],
       ["Shielded, bonded: 5<Rs≤20 Ω/km",[1,1,0.95,0.9,0.8]],
       ["Shielded, bonded: 1<Rs≤5 Ω/km",[0.9,0.8,0.6,0.3,0.1]],
       ["Shielded, bonded: Rs≤1 Ω/km",[0.6,0.4,0.2,0.04,0.02]]],
 PLIrows:[["Power line",[1,0.6,0.3,0.16,0.1]],["Telecommunication line",[1,0.5,0.2,0.08,0.04]]],
 KS3:[["Unshielded — no routing precaution",1],["Unshielded — avoids large loops (<10 m²)",0.2],
      ["Unshielded — avoids loops (<0.5 m²)",0.01],["Shielded, shields bonded both ends",0.0001]],
 rt:[["Agricultural soil, concrete",1e-2],["Marble, ceramic",1e-3],["Gravel, carpets",1e-4],["Asphalt, linoleum, wood",1e-5]],
 rp:[["No provisions",1],["Manual provisions (extinguishers, hydrants, alarms)",0.5],["Automatic provisions (extinguishing/alarm)",0.2]],
 rf:[["Explosion — Zones 0, 20, solid explosive",1],["Explosion — Zones 1, 21",0.1],["Explosion — Zones 2, 22",0.001],
     ["Fire — high (>800 MJ/m²)",0.1],["Fire — ordinary (400–800 MJ/m²)",0.01],["Fire — low (<400 MJ/m²)",0.001],["None",0]],
 hz:[["No special hazard",1],["Low panic (≤2 floors, <100 persons)",2],["Average panic (100–1000 persons)",5],
     ["Difficult evacuation (hospitals, immobile persons)",5],["High panic (>1000 persons)",10],
     ["Danger to surroundings/environment",20],["Contamination of environment",50]],
 LF1:[["Hospital, hotel, school, residential",0.1],["Public entertainment, church, museum",0.05],["Industrial, commercial",0.02],["Others",0.01]],
 LO1:[["Structure with risk of explosion",0.1],["Hospital — ICU / operating block",0.01],["Hospital — other parts",0.001],["Other structures",0]],
 CI:[["Overhead (aerial)",1],["Buried",0.5],["Buried within meshed ground termination",0.01]],
 CE:[["Rural",1],["Suburban",0.5],["Urban",0.1],["Urban with buildings >20 m",0.01]],
 CT:[["LV power / telecom / data (no transformer)",1],["HV line with HV/LV transformer",0.2]],
};
const UWCOLS=[1,1.5,2.5,4,6];
const RT1=1e-5, RT2=1e-3, RT3=1e-3, LT=0.01;
/* State-average CG flash density estimates (fl/km²/yr) — from published NLDN annual state data */
const NG_STATE={AL:3.4,AK:0.02,AZ:1.2,AR:3.1,CA:0.1,CO:1.0,CT:0.7,DE:1.1,DC:1.2,FL:5.9,GA:3.0,HI:0.1,
 ID:0.3,IL:2.2,IN:2.2,IA:2.0,KS:2.5,KY:2.6,LA:4.5,ME:0.3,MD:1.2,MA:0.6,MI:1.0,MN:1.2,MS:4.3,MO:2.7,
 MT:0.4,NE:2.0,NV:0.2,NH:0.4,NJ:0.9,NM:1.0,NY:0.7,NC:2.3,ND:1.0,OH:1.8,OK:3.2,OR:0.1,PA:1.2,RI:0.6,
 SC:2.8,SD:1.5,TN:3.0,TX:2.9,UT:0.4,VT:0.4,VA:1.7,WA:0.05,WV:1.6,WI:1.3,WY:0.6};
const ST_ABBR={"Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO",
"Connecticut":"CT","Delaware":"DE","District of Columbia":"DC","Florida":"FL","Georgia":"GA","Hawaii":"HI",
"Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA",
"Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS",
"Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ",
"New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK",
"Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",
"Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA",
"West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY"};

/* ============================ UI SETUP ============================ */
function fillSelect(id, table, defIdx=0, valuesAreArrays=false){
  const sel=document.getElementById(id);
  table.forEach((row,i)=>{
    const o=document.createElement("option");
    o.textContent=row[0]+(valuesAreArrays?"":"  ("+row[1]+")");
    o.value=i; if(i===defIdx)o.selected=true; sel.appendChild(o);
  });
}
function val(id,table){return table[+document.getElementById(id).value][1];}
function num(id){return parseFloat(document.getElementById(id).value)||0;}

fillSelect("s_C1",T.C1,2); fillSelect("s_C2",T.C2,0); fillSelect("s_C3",T.C3,3);
fillSelect("s_C4",T.C4,1); fillSelect("s_C5",T.C5,1);
fillSelect("d_CD",T.C1,2); fillSelect("d_PB",T.PB,0); fillSelect("d_PTA",T.PTA,0);
fillSelect("d_SPD",T.SPD,0); fillSelect("d_EB",T.SPD,0); fillSelect("d_rt",T.rt,0);
fillSelect("d_rp",T.rp,0); fillSelect("d_rf",T.rf,1); fillSelect("d_hz",T.hz,0);
fillSelect("d_LF",T.LF1,2); fillSelect("d_LO",T.LO1,0); fillSelect("d_KS3",T.KS3,0);

/* line cards */
const LINES=[{key:"l1",name:"Line 1 — Power service",ct:1,pli:0},{key:"l2",name:"Line 2 — Telecom / data service",ct:0,pli:1}];
document.getElementById("lineCards").innerHTML =
 '<h2><span class="num">3</span>Connected services (lines)</h2>' + LINES.map((ln,ix)=>`
 <details ${ix===0?"open":""}><summary>${ln.name}</summary><div class="inner"><div class="grid">
  <div><label>Service present?</label><select id="${ln.key}_on" onchange="calcAll()"><option value="1">Yes</option><option value="0">No</option></select></div>
  <div><label>Line length Lc (ft)</label><input id="${ln.key}_Lc" type="number" value="3280" min="0" oninput="calcAll()"><div class="hint">Unknown? Use 3280 ft (1000 m) — Annex L default.</div></div>
  <div><label>Installation → CI</label><select id="${ln.key}_CI" onchange="calcAll()"></select></div>
  <div><label>Environment → CE</label><select id="${ln.key}_CE" onchange="calcAll()"></select></div>
  <div><label>Line type → CT</label><select id="${ln.key}_CT" onchange="calcAll()"></select></div>
  <div><label>Shielding/bonding → CLD, CLI</label><select id="${ln.key}_CLDI" onchange="calcAll()"></select></div>
  <div><label>Shield condition → PLD</label><select id="${ln.key}_PLD" onchange="calcAll()"></select></div>
  <div><label>Line type → PLI</label><select id="${ln.key}_PLI" onchange="calcAll()"></select></div>
  <div><label>Uw of fed system (kV)</label><select id="${ln.key}_Uw" onchange="calcAll()"><option>1</option><option>1.5</option><option selected>2.5</option><option>4</option><option>6</option></select></div>
  <div><label>Touch protection → PTU</label><select id="${ln.key}_PTU" onchange="calcAll()"></select></div>
  <div><label>Adjacent structure L×W×H (ft) — 0 = none</label>
    <div style="display:flex;gap:6px">
      <input id="${ln.key}_aL" type="number" value="0" min="0" oninput="calcAll()">
      <input id="${ln.key}_aW" type="number" value="0" min="0" oninput="calcAll()">
      <input id="${ln.key}_aH" type="number" value="0" min="0" oninput="calcAll()">
    </div></div>
  <div><label>Adjacent structure location → CDJ</label><select id="${ln.key}_aCD" onchange="calcAll()"></select></div>
 </div></div></details>`).join("");
LINES.forEach(ln=>{
  fillSelect(ln.key+"_CI",T.CI,0); fillSelect(ln.key+"_CE",T.CE,0);
  fillSelect(ln.key+"_CT",T.CT,ln.ct);
  fillSelect(ln.key+"_CLDI",T.CLDI,0,true); fillSelect(ln.key+"_PLD",T.PLDrows,0,true);
  fillSelect(ln.key+"_PLI",T.PLIrows,ln.pli,true); fillSelect(ln.key+"_PTU",T.PTU,0);
});

/* reference tables tab */
(function(){
  const defs=[["Table 1 — C1 / CD location factor",T.C1],["Table 2 — C2 construction",T.C2],
   ["Table 3 — C3 contents",T.C3],["Table 4 — C4 occupancy",T.C4],["Table 5 — C5 consequence",T.C5],
   ["Table 6 — PB (LPS class)",T.PB],["Table 7 — PTA",T.PTA],["Table 8 — PTU",T.PTU],
   ["Table 9 — PSPD / PEB",T.SPD],["Table 13 — KS3 internal wiring",T.KS3],
   ["Table 15 — rt surface",T.rt],["Table 16 — rp fire provisions",T.rp],["Table 17 — rf fire/explosion",T.rf],
   ["Table 18 — hz special hazard",T.hz],["Table 19 — LF (L1)",T.LF1],["Table 20 — LO (L1)",T.LO1],
   ["Table 22 — CI installation",T.CI],["Table 23 — CE environment",T.CE],["Table 24 — CT line type",T.CT]];
  let h="";
  defs.forEach(([t,tab])=>{
    h+=`<details><summary>${t}</summary><div class="inner"><table class="ref"><tr><th>Option</th><th>Value</th></tr>`+
      tab.map(rw=>`<tr><td>${rw[0]}</td><td>${rw[1]}</td></tr>`).join("")+"</table></div></details>";
  });
  h+=`<details><summary>Table 10 — CLD / CLI</summary><div class="inner"><table class="ref"><tr><th>Line</th><th>CLD</th><th>CLI</th></tr>`+
     T.CLDI.map(rw=>`<tr><td>${rw[0]}</td><td style="text-align:right">${rw[1][0]}</td><td>${rw[1][1]}</td></tr>`).join("")+"</table></div></details>";
  h+=`<details><summary>Table 11 — PLD vs Uw</summary><div class="inner"><table class="ref"><tr><th>Condition</th>${UWCOLS.map(u=>`<th>${u} kV</th>`).join("")}</tr>`+
     T.PLDrows.map(rw=>`<tr><td>${rw[0]}</td>${rw[1].map(v=>`<td style="text-align:right">${v}</td>`).join("")}</tr>`).join("")+"</table></div></details>";
  h+=`<details><summary>Table 12 — PLI vs Uw</summary><div class="inner"><table class="ref"><tr><th>Line</th>${UWCOLS.map(u=>`<th>${u} kV</th>`).join("")}</tr>`+
     T.PLIrows.map(rw=>`<tr><td>${rw[0]}</td>${rw[1].map(v=>`<td style="text-align:right">${v}</td>`).join("")}</tr>`).join("")+"</table></div></details>";
  h+=`<details><summary>Table 14 — PM vs KMS · Table 25 — Tolerable risk RT</summary><div class="inner">
      <table class="ref"><tr><th>KMS</th><th>PM</th></tr>
      <tr><td>≥ 0.4</td><td>1</td></tr><tr><td>0.15–0.4</td><td>0.9</td></tr><tr><td>0.07–0.15</td><td>0.5</td></tr>
      <tr><td>0.035–0.07</td><td>0.1</td></tr><tr><td>0.021–0.035</td><td>0.01</td></tr><tr><td>0.016–0.021</td><td>0.005</td></tr>
      <tr><td>0.015–0.016</td><td>0.003</td></tr><tr><td>≤ 0.013</td><td>0.0001</td></tr></table>
      <table class="ref" style="margin-top:12px"><tr><th>Type of loss</th><th>RT (1/yr)</th></tr>
      <tr><td>R1 — Loss of human life</td><td>1×10⁻⁵</td></tr><tr><td>R2 — Loss of service</td><td>1×10⁻³</td></tr>
      <tr><td>R3 — Loss of cultural heritage</td><td>1×10⁻³</td></tr></table></div></details>`;
  document.getElementById("refTables").innerHTML=h;
})();

/* ============================ ZIP → Ng ============================ */
let ngAuto=false;
function ngManual(){ngAuto=false;setPill();calcAll();}
function setPill(){
  const p=document.getElementById("ngpill");
  p.className="pill "+(ngAuto?"auto":"manual");
  p.textContent=ngAuto?"auto (state estimate)":"manual";
}
async function lookupZip(){
  const zip=document.getElementById("zip").value.trim();
  const card=document.getElementById("zipcard"); const btn=document.getElementById("zipbtn");
  card.style.display="block"; card.className="zipcard";
  if(!/^\d{5}$/.test(zip)){card.className="zipcard err";card.textContent="Enter a valid 5-digit U.S. ZIP code.";return;}
  btn.disabled=true; card.textContent="Looking up ZIP "+zip+"…";
  try{
    const rsp=await fetch("https://api.zippopotam.us/us/"+zip);
    if(!rsp.ok)throw new Error("ZIP not found");
    const j=await rsp.json();
    const pl=j.places[0];
    const stAbbr=pl["state abbreviation"]||ST_ABBR[pl.state]||"";
    const ng=NG_STATE[stAbbr];
    if(ng===undefined)throw new Error("No flash-density estimate for state "+stAbbr);
    document.getElementById("ng").value=ng;
    document.getElementById("ngtype").value="ng"; // state estimates are flash density
    ngAuto=true;setPill();
    card.innerHTML=`📍 <b>${pl["place name"]}, ${stAbbr}</b> (lat ${(+pl.latitude).toFixed(3)}, lon ${(+pl.longitude).toFixed(3)}) — `+
      `state-average Ng ≈ <b>${ng} flashes/km²/yr</b> applied (density type set to Ng; on the 2026 basis the tool uses NSG = 1.7 × Ng automatically). `+
      `Adjust manually if you have site-specific NLDN data.`;
    calcAll();
  }catch(e){
    card.className="zipcard err";
    card.textContent="⚠️ "+(e.message||"Lookup failed")+". Check the ZIP or your connection, or enter Ng manually.";
  }finally{btn.disabled=false;}
}

/* ============================ CALCS ============================ */
function fmt(x){
  if(x===0)return "0";
  if(Math.abs(x)>=0.01&&Math.abs(x)<1e6)return x.toLocaleString("en-US",{maximumSignificantDigits:4});
  return x.toExponential(2).replace("e","×10^").replace("×10^-","×10⁻").replace("×10^+","×10");
}
function row(k,v,unit){return `<div class="res-row"><span class="k">${k}</span><span class="v">${v}${unit?" <span style='color:var(--muted);font-weight:400'>"+unit+"</span>":""}</span></div>`;}
function collArea(Lm,Wm,Hm){return Lm*Wm+6*Hm*(Lm+Wm)+Math.PI*9*Hm*Hm;}
function pmFromKms(k){
  if(k>=0.4)return 1; if(k>=0.15)return .9; if(k>=0.07)return .5; if(k>=0.035)return .1;
  if(k>=0.021)return .01; if(k>=0.016)return .005; if(k>=0.015)return .003; return .0001;
}
function uwIdx(u){return u>=6?4:u>=4?3:u>=2.5?2:u>=1.5?1:0;}
function logPos(x,min,max){ if(x<=0)return 0; const p=(Math.log10(x)-min)/(max-min); return Math.max(0,Math.min(1,p));}

function densityUsed(){
  const v=num("ng");
  const isNg=document.getElementById("ngtype").value==="ng";
  const is2026=document.getElementById("edition").value==="2026";
  const N=is2026?(isNg?v*1.7:v):(isNg?v:v/1.7);
  const el=document.getElementById("densUsed");
  if(el)el.textContent="N used in equations: "+N.toFixed(3)+" per km²/yr ("+(is2026?"NSG, 2026 basis":"Ng, 2023 basis")+")";
  return N;
}
function calcAll(){
  const Ng=densityUsed();
  /* ---------- simplified ---------- */
  const sL=num("s_L")*FT,sW=num("s_W")*FT,sH=num("s_H")*FT;
  document.getElementById("s_Lm").textContent="= "+sL.toFixed(2)+" m";
  document.getElementById("s_Wm").textContent="= "+sW.toFixed(2)+" m";
  document.getElementById("s_Hm").textContent="= "+sH.toFixed(2)+" m";
  const Ae=collArea(sL,sW,sH);
  const C1=val("s_C1",T.C1);
  const Nd=Ng*Ae*C1*1e-6;
  const C=val("s_C2",T.C2)*val("s_C3",T.C3)*val("s_C4",T.C4)*val("s_C5",T.C5);
  const Nc=1.5e-3/C;
  document.getElementById("s_rows").innerHTML=
    row("Equivalent collection area Ae = L·W + 6H(L+W) + 9πH²",fmt(Ae),"m²")+
    row("Annual threat Nd = Ng·Ae·C1·10⁻⁶",fmt(Nd),"events/yr")+
    row("Combined coefficient C = C2·C3·C4·C5",fmt(C),"")+
    row("Tolerable frequency Nc = 1.5×10⁻³ / C",fmt(Nc),"events/yr");
  document.getElementById("s_ratio").textContent="Nd/Nc = "+fmt(Nd/Nc);
  document.getElementById("s_fill").style.width=(logPos(Nd,-6,2)*100)+"%";
  document.getElementById("s_th").style.left=(logPos(Nc,-6,2)*100)+"%";
  const sv=document.getElementById("s_verdict");
  if(Nd>Nc){sv.className="verdict bad";sv.innerHTML="<span class='ico'>⚠️</span> LIGHTNING PROTECTION SYSTEM RECOMMENDED — Nd &gt; Nc";}
  else{sv.className="verdict ok";sv.innerHTML="<span class='ico'>✓</span> Lightning protection OPTIONAL — Nd ≤ Nc";}

  /* ---------- detailed ---------- */
  const L=num("d_L")*FT,W=num("d_W")*FT,H=num("d_H")*FT;
  const CD=val("d_CD",T.C1);
  const AD=collArea(L,W,H), AM=2*500*(L+W)+Math.PI*500*500;
  const ND=Ng*AD*CD*1e-6, NM=Ng*AM*1e-6;
  const PBv=val("d_PB",T.PB), PA=val("d_PTA",T.PTA)*PBv;
  const PSPD=val("d_SPD",T.SPD), PEB=val("d_EB",T.SPD);
  const w1=num("d_w1"),w2=num("d_w2");
  const KS1=w1<=0?1:Math.min(1,0.12*w1), KS2=w2<=0?1:Math.min(1,0.12*w2);
  const KS3=val("d_KS3",T.KS3), KS4=Math.min(1,1/num("d_Uw"));
  const PM=PSPD*pmFromKms(KS1*KS2*KS3*KS4);
  const rt=val("d_rt",T.rt),rp=val("d_rp",T.rp),rf=val("d_rf",T.rf),hzv=val("d_hz",T.hz);
  const LFv=val("d_LF",T.LF1),LOv=val("d_LO",T.LO1);
  const occ=(num("d_nz")/Math.max(1,num("d_nt")))*(num("d_tz")/8760);
  const LA=rt*LT*occ, LB=rp*rf*hzv*LFv*occ, LC=LOv*occ;
  const expF=+document.getElementById("d_exp").value;

  let RU=0,RV=0,RW=0,RZ=0,PCacc=1,NLtot=0;
  const lineOut=[];
  LINES.forEach(ln=>{
    const on=+document.getElementById(ln.key+"_on").value;
    const Lc=num(ln.key+"_Lc")*FT;
    const CIv=val(ln.key+"_CI",T.CI),CEv=val(ln.key+"_CE",T.CE),CTv=val(ln.key+"_CT",T.CT);
    const [CLD,CLI]=T.CLDI[+document.getElementById(ln.key+"_CLDI").value][1];
    const ui=uwIdx(num(ln.key+"_Uw"));
    const PLD=T.PLDrows[+document.getElementById(ln.key+"_PLD").value][1][ui];
    const PLI=T.PLIrows[+document.getElementById(ln.key+"_PLI").value][1][ui];
    const PTUv=val(ln.key+"_PTU",T.PTU);
    const AL=40*Lc, AI=4000*Lc;
    const aL=num(ln.key+"_aL")*FT,aW=num(ln.key+"_aW")*FT,aH=num(ln.key+"_aH")*FT;
    const ADJ=(aL>0&&aW>0)?collArea(aL,aW,aH):0;
    const CDJ=val(ln.key+"_aCD",T.C1);
    const NL=on*Ng*AL*CIv*CEv*CTv*1e-6;
    const NI=on*Ng*AI*CIv*CEv*CTv*1e-6;
    const NDJ=on*Ng*ADJ*CDJ*CTv*1e-6;
    const PU=PTUv*PEB*PLD*CLD, PV=PEB*PLD*CLD, PW=PSPD*PLD*CLD, PZ=PSPD*PLI*CLI;
    RU+=(NL+NDJ)*PU*LA; RV+=(NL+NDJ)*PV*LB; RW+=(NL+NDJ)*PW*LC; RZ+=NI*PZ*LC;
    PCacc*=(1-PSPD*CLD*on); NLtot+=NL;
    lineOut.push({name:ln.name,NL,NLJ:NL+NDJ,NI,PV,PW,PZ,LB});
  });
  const PC=1-PCacc;
  const RA=ND*PA*LA, RB=ND*PBv*LB, RC=expF*ND*PC*LC, RM=expF*NM*PM*LC;
  RW*=expF; RZ*=expF;
  const R1=RA+RB+RC+RM+RU+RV+RW+RZ;

  const L2on=+document.getElementById("d_L2").value, L3on=+document.getElementById("d_L3").value;
  const LB2=rp*rf*num("d_LF2")*num("d_svc"), LC2=num("d_LO2")*num("d_svc");
  let R2=L2on*(ND*PBv*LB2+ND*PC*LC2+NM*PM*LC2);
  lineOut.forEach(lo=>{R2+=L2on*(lo.NLJ*lo.PV*LB2+lo.NLJ*lo.PW*LC2+lo.NI*lo.PZ*LC2);});
  const LB3=rp*rf*num("d_LF3")*num("d_cz");
  let R3=L3on*ND*PBv*LB3;
  lineOut.forEach(lo=>{R3+=L3on*lo.NLJ*lo.PV*LB3;});

  document.getElementById("d_rows").innerHTML=
    row("AD (collection area, structure)",fmt(AD),"m²")+
    row("ND — flashes to structure",fmt(ND),"events/yr")+
    row("NM — flashes near structure",fmt(NM),"events/yr")+
    row("NL — flashes to lines (total)",fmt(NLtot),"events/yr")+
    row("PA / PB / PC / PM",fmt(PA)+" / "+fmt(PBv)+" / "+fmt(PC)+" / "+fmt(PM),"")+
    row("LA / LB / LC (L1 losses)",fmt(LA)+" / "+fmt(LB)+" / "+fmt(LC),"");

  const comps=[["RA",RA],["RB",RB],["RC",RC],["RM",RM],["RU",RU],["RV",RV],["RW",RW],["RZ",RZ]];
  const cmax=Math.max(1e-12,...comps.map(c=>c[1]));
  document.getElementById("d_comps").innerHTML=comps.map(([n,v])=>
    `<div class="comp-bar"><span class="cname">${n}</span>
     <div class="ctrack"><div class="cfill" style="width:${v<=0?0:Math.max(1,v/cmax*100)}%"></div></div>
     <span class="cval">${fmt(v)}</span></div>`).join("");

  const meters=[["R1 — Loss of human life",R1,RT1,true],
                ["R2 — Loss of service",R2,RT2,!!L2on],
                ["R3 — Loss of cultural heritage",R3,RT3,!!L3on]];
  document.getElementById("d_meters").innerHTML=meters.map(([n,Rv,RTv,app])=>!app?"":`
   <div class="meter"><div class="mlabel"><span>${n} — log scale</span><span>R = ${fmt(Rv)} · RT = ${fmt(RTv)}</span></div>
   <div class="mtrack"><div class="mfill" style="width:${logPos(Rv,-8,0)*100}%"></div>
   <div class="mthresh" style="left:${logPos(RTv,-8,0)*100}%"></div></div>
   <div class="mscale"><span>10⁻⁸</span><span>10⁻⁶</span><span>10⁻⁴</span><span>10⁻²</span><span>10⁰</span></div></div>`).join("");

  document.getElementById("d_verdicts").innerHTML=meters.map(([n,Rv,RTv,app])=>{
    if(!app)return `<div class="verdict na"><span class="ico">—</span>${n}: not applicable</div>`;
    return Rv>RTv?`<div class="verdict bad"><span class="ico">⚠️</span>${n}: R &gt; RT — PROTECTION REQUIRED (add/upgrade LPS, SPDs or other measures)</div>`
                 :`<div class="verdict ok"><span class="ico">✓</span>${n}: R ≤ RT — adequately protected</div>`;
  }).join("");

  /* sticky summary */
  document.getElementById("stickybar").innerHTML=
    `<span class="st"><span class="dot ${Nd>Nc?'bad':'ok'}"></span>Simplified: <b>${Nd>Nc?'LPS recommended':'optional'}</b></span>`+
    `<span class="st"><span class="dot ${R1>RT1?'bad':'ok'}"></span>R1 = <b>${fmt(R1)}</b> (RT 10⁻⁵)</span>`+
    (L2on?`<span class="st"><span class="dot ${R2>RT2?'bad':'ok'}"></span>R2 = <b>${fmt(R2)}</b></span>`:"")+
    (L3on?`<span class="st"><span class="dot ${R3>RT3?'bad':'ok'}"></span>R3 = <b>${fmt(R3)}</b></span>`:"");

  window.__results={Ae,Nd,Nc,C,AD,ND,NM,PA,PB:PBv,PC,PM,LA,LB,LC,RA,RB,RC,RM,RU,RV,RW,RZ,R1,R2,R3};
}
function showTab(k,btn){
  document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
  document.querySelectorAll(".tabpane").forEach(p=>p.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("pane-"+k).classList.add("active");
}
calcAll();
