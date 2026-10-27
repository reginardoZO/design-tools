// Physical layout policy. D is the outside diameter of one complete cable.
// Clearance is edge-to-edge, never center-to-center or the trefoil envelope OD.
const EPS = 1e-9;
export const TREFOIL_HEIGHT = 1 + Math.sqrt(3) / 2;

export function arrangementSettings(compartment = {}) {
  return {
    spacing: compartment.spacing || 'touching',
    trefoilSpacing: compartment.trefoilSpacing || '2.15D',
    vfdSpacing: compartment.vfdSpacing || (compartment.spacing === 'one-diameter' ? '1D' : 'touching')
  };
}

export function requiresTrefoil(cable, purpose = 'power') {
  if (!cable || purpose === 'ground' || cable.category === 'vfd') return false;
  const size = Number(cable.sizeKcmil) || (/4\/0/.test(cable.size) ? 211.6 : Number(String(cable.size).replace(/\s*(kcmil|mcm)\s*$/i, '')));
  return size >= 211.5;
}

export function isTrefoil(row) {
  return requiresTrefoil(row.cable, row.purpose) && row.cable.conductors === 1 && row.cablesPerRun === 3;
}

export function circuitPolicyIssues(row) {
  const c = row.cable;
  if (!c) return [];
  if (row.purpose === 'ground') return c.conductors !== 1 ? ['A separate EGC must be a single-conductor product.'] : [];
  if (c.category === 'vfd' && c.conductors < 3) return ['Project rule: a VFD product must remain a complete multiconductor cable with at least three phase conductors. A single-conductor product cannot use the VFD exception.'];
  if (c.groundOnly) return ['This product is an equipment grounding conductor; assign it to a separate EGC row.'];
  if (!requiresTrefoil(c, row.purpose)) return [];
  if (c.conductors !== 1) return ['Project rule: non-VFD phase cables at 4/0 AWG and larger require trefoil. Replace this multiconductor product with a suitable 1/C product; its outside diameter cannot be reused for individual phase cables.'];
  if (row.cablesPerRun !== 3) return ['Project rule: each trefoil run must contain exactly three single-conductor phase cables. Edit this row to use 3 cables/run.'];
  return [];
}

export function arrangementLabel(row, comp = {}) {
  const settings = arrangementSettings(comp);
  if (circuitPolicyIssues(row).length) return 'Update required';
  if (isTrefoil(row)) return `Trefoil · ${settings.trefoilSpacing} clear gap`;
  if (row.cable?.category === 'vfd' && row.purpose !== 'ground') return `VFD · ${settings.vfdSpacing === '1D' ? '1D clear gap' : 'touching'}`;
  if (row.purpose === 'ground') return 'Separate EGC';
  return settings.spacing === 'one-diameter' ? 'Individual cables · 1D clear gap' : 'Standard cables';
}

// Keep runs compressed for calculations: a large quantity never allocates one
// object per cable. Only the SVG preview expands units, with a hard display cap.
export function planArrangement(circuits, settingsInput = {}, singleLayerRequired = false) {
  const settings = arrangementSettings(settingsInput);
  const segments = [];
  const issues = [];
  for (const row of circuits) {
    const c = row.cable;
    if (!c || !(c.odIn > 0) || !Number.isInteger(row.qty) || row.qty < 1 || !Number.isInteger(row.cablesPerRun) || row.cablesPerRun < 1) continue;
    issues.push(...circuitPolicyIssues(row).map(message => `${row.tag || 'Circuit'}: ${message}`));
    const trefoil = isTrefoil(row);
    const vfd = c.category === 'vfd' && row.purpose !== 'ground';
    const factor = trefoil ? (settings.trefoilSpacing === '1D' ? 1 : 2.15) : vfd ? (settings.vfdSpacing === '1D' ? 1 : 0) : settings.spacing === 'one-diameter' ? 1 : 0;
    segments.push({
      id: row.id, tag: row.tag, cat: c.category, d: Number(c.odIn),
      kind: trefoil ? 'trefoil' : vfd ? 'vfd' : 'cable',
      count: trefoil ? row.qty : row.qty * row.cablesPerRun,
      cablesPerUnit: trefoil ? 3 : 1, factor,
      width: Number(c.odIn) * (trefoil ? 2 : 1),
      height: Number(c.odIn) * (trefoil ? TREFOIL_HEIGHT : 1),
      large: c.sizeKcmil >= 211.5, rated: c.voltage, conductors: c.conductors
    });
  }
  // A stable order makes calculated and drawn gaps identical. Groups occupy
  // one layer; nothing is stacked above a trefoil or VFD cable.
  segments.sort((a,b) => ({trefoil:0,vfd:1,cable:2}[a.kind] - {trefoil:0,vfd:1,cable:2}[b.kind]) || b.d-a.d);
  const trefoilGroups = segments.filter(s=>s.kind==='trefoil').reduce((n,s)=>n+s.count,0);
  const vfdCables = segments.filter(s=>s.kind==='vfd').reduce((n,s)=>n+s.count,0);
  const linear = singleLayerRequired || settings.spacing === 'one-diameter' || trefoilGroups > 0 || vfdCables > 0;
  let widthIn = 0, previous = null;
  for (const s of segments) {
    if (previous) widthIn += clearGap(previous,s);
    widthIn += s.count * s.width + (s.count-1) * s.factor * s.d;
    previous = s;
  }
  return {settings, segments, issues, linear, widthIn,
    heightIn: Math.max(0,...segments.map(s=>s.height)), trefoilGroups, vfdCables,
    cableCount: segments.reduce((n,s)=>n+s.count*s.cablesPerUnit,0)};
}

export function clearGap(left, right) {
  return Math.max(left.factor,right.factor) * Math.max(left.d,right.d);
}

// Conservative shelf packing using the same order as the schematic. Counts are
// compressed so validation is independent of the SVG's 1,400-cable display cap.
// Failure means this modeled layout was not demonstrated, not that no packing
// solution could possibly exist.
export function checkPhysicalFit(plan, width, depth, fillResult = {}) {
  if (plan.linear) return {fits:plan.widthIn<=width+EPS && plan.heightIn<=depth+EPS, placed:plan.widthIn<=width+EPS && plan.heightIn<=depth+EPS?plan.cableCount:0};
  const mixed = /^392\.22\(A\).*\(c\)$/.test(fillResult.rule);
  const sorted=[...plan.segments].sort((a,b)=>b.d-a.d);
  let lane=0,placed=0;
  if(mixed) for(const s of sorted.filter(s=>s.large)) {
    if(lane+s.count*s.d>width+EPS || s.d>depth+EPS)return {fits:false,placed};
    lane+=s.count*s.d;placed+=s.count;
  }
  let x=lane,y=0,rowHeight=0;
  for(const s of sorted.filter(s=>!mixed||!s.large)) {
    let n=s.count;
    while(n>0) {
      if(s.d>width-lane+EPS || y+s.d>depth+EPS)return {fits:false,placed};
      const capacity=Math.max(0,Math.floor((width-x+EPS)/s.d));
      if(capacity===0){x=lane;y+=rowHeight;rowHeight=0;continue;}
      const taken=Math.min(n,capacity);x+=taken*s.d;placed+=taken;n-=taken;rowHeight=Math.max(rowHeight,s.d);
      if(n>0){
        x=lane;y+=rowHeight;rowHeight=0;
        const full=Math.floor((width-lane+EPS)/s.d);
        const rows=Math.min(Math.floor(n/full),Math.max(0,Math.floor((depth-y+EPS)/s.d)));
        if(rows>0){placed+=rows*full;n-=rows*full;y+=(rows-1)*s.d;x=lane+full*s.d;rowHeight=s.d;}
      }
    }
  }
  return {fits:placed===plan.cableCount,placed};
}

export function drawArrangement(plan, width, depth, fillResult = {}, limit = 1400) {
  const placed = [], groups = [], gaps = [];
  let x = 0, previous = null;
  const put = (s, atX, atY, unitIndex) => {
    const groupId = `${s.id || s.tag}-${unitIndex}`;
    const offsets = s.kind === 'trefoil' ? [[0,0,'A'],[s.d,0,'B'],[s.d/2,s.d*Math.sqrt(3)/2,'C']] : [[0,0,null]];
    if (atX+s.width > width+EPS || atY+s.height > depth+EPS || placed.length+offsets.length > limit) return;
    if (s.kind==='trefoil') groups.push({id:groupId,tag:s.tag,x:atX,y:atY,width:s.width,height:s.height,d:s.d});
    for (const [dx,dy,phase] of offsets) placed.push({d:s.d,cat:s.cat,tag:s.tag,large:s.large,x:atX+dx,y:atY+dy,phase,groupId:phase?groupId:null});
  };
  if (plan.linear) {
    for (const s of plan.segments) {
      if (previous) {
        const gap = clearGap(previous,s);
        if (gap && x+gap<=width+EPS) gaps.push({x,width:gap,factor:Math.max(previous.factor,s.factor)});
        x += gap;
      }
      // Skip units that cannot fit; advance by their full analytical width.
      const visible = Math.min(s.count, Math.max(0,Math.floor((width-x+s.factor*s.d+EPS)/(s.width+s.factor*s.d))), Math.floor((limit-placed.length)/s.cablesPerUnit));
      for (let i=0;i<visible;i++) {
        const at = x + i*(s.width+s.factor*s.d);
        put(s,at,0,i);
        if (i && s.factor) gaps.push({x:at-s.factor*s.d,width:s.factor*s.d,factor:s.factor});
      }
      x += s.count*s.width+(s.count-1)*s.factor*s.d;
      previous=s;
    }
  } else {
    const mixed = /^392\.22\(A\).*\(c\)$/.test(fillResult.rule);
    const sorted = [...plan.segments].sort((a,b)=>b.d-a.d);
    let lane = 0;
    if (mixed) for (const s of sorted.filter(s=>s.large)) {
      for (let i=0;i<Math.min(s.count,limit);i++) put(s,lane+i*s.d,0,i);
      lane+=s.count*s.d;
    }
    x=lane; let y=0,rowHeight=0;
    for (const s of sorted.filter(s=>!mixed||!s.large)) {
      for(let i=0;i<s.count && placed.length<limit;i++) {
        if(x+s.d>width+EPS && x>lane){x=lane;y+=rowHeight;rowHeight=0;}
        if(y+s.d>depth+EPS || s.d>width-lane+EPS) break;
        put(s,x,y,i);x+=s.d;rowHeight=Math.max(rowHeight,s.d);
      }
    }
  }
  return {placed,groups,gaps,omitted:plan.cableCount-placed.length,total:plan.cableCount};
}
