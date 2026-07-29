import { useState, useMemo, useRef, useEffect } from "react";
import {
  countOrderInversions,
  countRouteBends,
  optimizeOrderedAssignment,
} from "./src/route-assignment.js";
import {
  panelSetupFingerprint,
  readPanelCache,
  writePanelCache,
} from "./src/panel-cache.js";

/* ============================================================
   MV PANEL LOAD ROUTER
   · Octilinear routes (straight lines + 45° bends), shortest path
   · Ordered column assignment per bus, minimizing route-order
     inversions before route length and bends
   · Panel can sit on any wall (bottom, left, top, right) — the
     column sequence 1…N NEVER mirrors and bus A always stays at
     the start (left / top)
   · Optional cross-tie columns at the extremities
   · Main-Tie-Main supports one or two metering columns placed in
     user-selected positions
   · Optional transition column in a user-selected position
   · Incomer column(s) defined by the user — excluded from routing
   · Zoom (mouse wheel / buttons) and pan (middle mouse button,
     AutoCAD style) on the canvas
   ============================================================ */

const VB_W = 1000;
const VB_H = 720;
const MM_PER_INCH = 25.4;
const WALLS = ["bottom", "left", "top", "right"];
const WALL_LABEL = { bottom: "BOTTOM", left: "LEFT", top: "TOP", right: "RIGHT" };

const INK = "#1d2530";
const STEEL = "#3d4854";
const STEEL_LT = "#dfe4e9";
const COPPER = "#C07A2E";
const PAPER = "#eceff2";

const PALETTE = [
  "#D6482F", "#2563EB", "#0F8A62", "#C4771B",
  "#7C3AED", "#0E7490", "#C02678", "#64748B",
  "#8A6D1F", "#3B7A2A",
];

const sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const formatInches = (value, digits = 1) => `${Number(value.toFixed(digits))} in`;

function getBrowserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/* Octilinear path between two points: one 45° diagonal + one straight run */
function octi(sx, sy, tx, ty) {
  const dx = tx - sx, dy = ty - sy;
  const d = Math.min(Math.abs(dx), Math.abs(dy));
  const pts = [];
  const mx = sx + sgn(dx) * d, my = sy + sgn(dy) * d;
  if (d > 0.01) pts.push([mx, my]);
  if (Math.abs(tx - mx) > 0.01 || Math.abs(ty - my) > 0.01) pts.push([tx, ty]);
  if (pts.length === 0) pts.push([tx, ty]);
  return pts;
}

function pathLen(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++)
    L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

export default function MVPanelLoadRouter() {
  const [initialCache] = useState(() => readPanelCache(getBrowserStorage()));
  const initialSetup = initialCache?.setup ?? {};
  const initialWorkspace = initialCache?.workspace ?? {};

  /* ---------------- configuration ---------------- */
  const [step, setStep] = useState(initialCache?.step === "canvas" ? "canvas" : "config");
  const [widthIn, setWidthIn] = useState(initialSetup.widthIn ?? 141.73);
  const [heightIn, setHeightIn] = useState(initialSetup.heightIn ?? 90.55);
  const [nCols, setNCols] = useState(initialSetup.nCols ?? 8);
  const [nColsDraft, setNColsDraft] = useState(String(initialSetup.nCols ?? 8));
  const [exclusives, setExclusives] = useState(initialSetup.exclusives ?? []);        // 0-based indices
  const [crossTieLeft, setCrossTieLeft] = useState(initialSetup.crossTieLeft ?? false);  // column 1
  const [crossTieRight, setCrossTieRight] = useState(initialSetup.crossTieRight ?? false); // column N
  const [mtm, setMtm] = useState(initialSetup.mtm ?? false);
  const [tieCol, setTieCol] = useState(initialSetup.tieCol ?? 4);      // 1-based
  const [meteringCount, setMeteringCount] = useState(initialSetup.meteringCount ?? 1);
  const [meteringCols, setMeteringCols] = useState(initialSetup.meteringCols ?? [3, 5]); // 1-based
  const [incomerA, setIncomerA] = useState(initialSetup.incomerA ?? 2);  // 1-based — main incomer (bus A)
  const [hasIncomerB, setHasIncomerB] = useState(initialSetup.hasIncomerB ?? false);
  const [incomerB, setIncomerB] = useState(initialSetup.incomerB ?? 7);  // 1-based — main incomer (bus B, MTM only)
  const [hasTransition, setHasTransition] = useState(initialSetup.hasTransition ?? false);
  const [transitionCol, setTransitionCol] = useState(initialSetup.transitionCol ?? 6); // 1-based
  const [wall, setWall] = useState(initialSetup.wall ?? "bottom");

  /* ---------------- loads & routes ---------------- */
  const [loads, setLoads] = useState(initialWorkspace.loads ?? []);
  const [routes, setRoutes] = useState(initialWorkspace.routes ?? null);
  const [selectedCol, setSelectedCol] = useState(null);
  const [pending, setPending] = useState(null);
  const [pName, setPName] = useState("");
  const [pBus, setPBus] = useState("A");
  const [warn, setWarn] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);

  /* ---------------- zoom & pan ---------------- */
  const [view, setView] = useState(initialWorkspace.view ?? { x: 0, y: 0, w: VB_W });
  const viewH = (w) => (w * VB_H) / VB_W;
  const svgRef = useRef(null);
  const dragRef = useRef(null);

  const panelSetup = {
    widthIn,
    heightIn,
    nCols,
    exclusives,
    crossTieLeft,
    crossTieRight,
    mtm,
    tieCol,
    meteringCount,
    meteringCols,
    incomerA,
    hasIncomerB,
    incomerB,
    hasTransition,
    transitionCol,
    wall,
  };
  const currentSetupFingerprint = panelSetupFingerprint(panelSetup);
  const appliedSetupFingerprintRef = useRef(
    initialWorkspace.setupFingerprint ?? currentSetupFingerprint,
  );

  useEffect(() => {
    const snapshot = {
      step,
      setup: panelSetup,
      workspace: {
        loads,
        routes,
        view,
        setupFingerprint: appliedSetupFingerprintRef.current,
      },
    };
    const persist = () => writePanelCache(getBrowserStorage(), snapshot);
    const timeoutId = window.setTimeout(persist, 150);
    window.addEventListener("pagehide", persist);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("pagehide", persist);
    };
  }, [step, currentSetupFingerprint, loads, routes, view]);

  useEffect(() => {
    if (!routes) setSelectedCol(null);
  }, [routes]);

  const zoomAt = (factor, wx, wy) => {
    setView((v) => {
      const nw = clamp(v.w * factor, 240, 2600);
      const cx = wx !== undefined ? wx : v.x + v.w / 2;
      const cy = wy !== undefined ? wy : v.y + viewH(v.w) / 2;
      return {
        x: cx - (cx - v.x) * (nw / v.w),
        y: cy - (cy - v.y) * (nw / v.w),
        w: nw,
      };
    });
  };

  /* wheel zoom centred on the cursor (non-passive so we can preventDefault) */
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      setView((v) => {
        const wx = v.x + ((e.clientX - rect.left) / rect.width) * v.w;
        const wy = v.y + ((e.clientY - rect.top) / rect.height) * viewH(v.w);
        const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
        const nw = clamp(v.w * factor, 240, 2600);
        return {
          x: wx - (wx - v.x) * (nw / v.w),
          y: wy - (wy - v.y) * (nw / v.w),
          w: nw,
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [step]);

  const horiz = wall === "bottom" || wall === "top";
  const HEAD = 16;

  const geom = useMemo(() => {
    if (horiz) {
      const len = clamp(nCols * 29, 280, 560);
      const th = clamp(heightIn * MM_PER_INCH * 0.045, 80, 120);
      const px = (VB_W - len) / 2;
      const py = wall === "bottom" ? VB_H - th - 58 : 44;
      return { len, th, px, py, cl: len / nCols };
    }
    const len = clamp(nCols * 27, 280, 540);
    const th = 112;
    const py = (VB_H - len) / 2;
    const px = wall === "left" ? 36 : VB_W - th - 40;
    return { len, th, px, py, cl: len / nCols };
  }, [nCols, heightIn, wall, horiz]);

  const inchesPerUnit = widthIn / geom.len;

  const tieIdx = mtm ? tieCol - 1 : -1;
  const activeMeteringCols = mtm ? meteringCols.slice(0, meteringCount) : [];

  /* Column roles — priority: TIE > CROSS-TIE > METERING > TRANSITION > INCOMER > EXCLUSIVE */
  const colInfo = (i) => {
    const isTie = i === tieIdx;
    const isCross = (crossTieLeft && i === 0) || (crossTieRight && i === nCols - 1);
    const isMeter = activeMeteringCols.includes(i + 1);
    const isTransition = hasTransition && i === transitionCol - 1;
    const isIncomer = i === incomerA - 1 || (mtm && hasIncomerB && i === incomerB - 1);
    const isExc = exclusives.includes(i) || isTie || isCross || isMeter || isTransition || isIncomer;
    let bus = null;
    if (!isExc) bus = !mtm ? "A" : i < tieIdx ? "A" : "B";
    return { isTie, isCross, isMeter, isTransition, isIncomer, isExc, bus };
  };

  const availCols = (bus) => {
    const out = [];
    for (let i = 0; i < nCols; i++) if (colInfo(i).bus === bus) out.push(i);
    return out;
  };

  /* Column sequence 1…N always runs in the SAME direction:
     left→right on horizontal walls, top→bottom on vertical walls. */
  const colC = (i) => (horiz ? geom.px : geom.py) + i * geom.cl + geom.cl / 2;

  function buildRoute(colIdx, load, clearance) {
    const c = colC(colIdx);
    if (horiz) {
      const top = load.y <= geom.py + geom.th / 2;
      const ey = top ? geom.py : geom.py + geom.th;
      const sy = top ? ey - clearance : ey + clearance;
      return [[c, ey], [c, sy], ...octi(c, sy, load.x, load.y)];
    }
    const left = load.x <= geom.px + geom.th / 2;
    const ex = left ? geom.px : geom.px + geom.th;
    const sx = left ? ex - clearance : ex + clearance;
    return [[ex, c], [sx, c], ...octi(sx, c, load.x, load.y)];
  }

  const exitSide = (l) =>
    horiz ? (l.y <= geom.py + geom.th / 2 ? "t" : "b") : (l.x <= geom.px + geom.th / 2 ? "l" : "r");

  function buildAll(assign) {
    const groups = {};
    for (const a of assign) {
      const s = exitSide(a.load);
      (groups[s] = groups[s] || []).push(a);
    }
    const clear = new Map();
    for (const s of Object.keys(groups)) {
      groups[s].sort((a, b) => a.col - b.col)
        .forEach((a, k) => clear.set(a.load.id, 15 + k * 10));
    }
    return assign.map((a, i) => {
      const pts = buildRoute(a.col, a.load, clear.get(a.load.id));
      return { load: a.load, col: a.col, pts, len: pathLen(pts) * inchesPerUnit, color: PALETTE[i % PALETTE.length] };
    });
  }

  function evaluateAssignment(assign) {
    const list = buildAll(assign);
    return {
      assign,
      list,
      len: list.reduce((sum, route) => sum + route.len, 0),
      bends: list.reduce((sum, route) => sum + countRouteBends(route.pts), 0),
      cross: countOrderInversions(list.map((route) => ({
        sourceY: route.load.y,
        destinationY: route.pts[0][1],
      }))),
    };
  }

  function solve(loadsToRoute = loads) {
    setWarn("");
    setSelectedCol(null);
    if (loadsToRoute.length === 0) { setWarn("Add at least one load by clicking on the work area."); return; }
    const byBus = { A: loadsToRoute.filter((l) => l.bus === "A"), B: loadsToRoute.filter((l) => l.bus === "B") };
    const assign = [];
    for (const bus of ["A", "B"]) {
      const ls = byBus[bus];
      if (ls.length === 0) continue;
      const cols = availCols(bus);
      if (ls.length > cols.length) {
        setWarn(`Bus ${bus}: ${ls.length} loads but only ${cols.length} available column(s). Remove loads or free up columns.`);
        return;
      }
      const ordered = optimizeOrderedAssignment(ls, cols, (load, col) => {
        const points = buildRoute(col, load, 15);
        return {
          length: pathLen(points) * inchesPerUnit,
          bends: countRouteBends(points),
        };
      });
      const assignedColByLoad = new Map(ordered.map((item) => [item.load, item.col]));
      ls.forEach((load) => assign.push({ load, col: assignedColByLoad.get(load) }));
    }

    const isBetter = (candidate, current) => (
      candidate.cross < current.cross
      || (candidate.cross === current.cross && candidate.len < current.len - 0.01)
      || (candidate.cross === current.cross
        && Math.abs(candidate.len - current.len) <= 0.01
        && candidate.bends < current.bends)
    );
    const preservesPanelOrder = (candidateAssign) => {
      for (const bus of ["A", "B"]) {
        const items = candidateAssign.filter((item) => item.load.bus === bus);
        for (let i = 0; i < items.length; i++)
          for (let j = i + 1; j < items.length; j++)
            if ((items[i].load.y - items[j].load.y) * (items[i].col - items[j].col) < 0) return false;
      }
      return true;
    };

    let best = evaluateAssignment(assign);

    /* Refine the ordered assignment without reintroducing an inversion. */
    for (let iter = 0; iter < 60; iter++) {
      const occupied = new Set(best.assign.map((item) => item.col));
      let next = null;
      const consider = (candidateAssign) => {
        if (!preservesPanelOrder(candidateAssign)) return;
        const candidate = evaluateAssignment(candidateAssign);
        if (isBetter(candidate, best) && (!next || isBetter(candidate, next))) next = candidate;
      };

      for (let i = 0; i < best.assign.length; i++) {
        for (const col of availCols(best.assign[i].load.bus)) {
          if (occupied.has(col)) continue;
          const candidate = best.assign.map((item) => ({ ...item }));
          candidate[i].col = col;
          consider(candidate);
        }
      }

      for (let i = 0; i < best.assign.length; i++) {
        for (let j = i + 1; j < best.assign.length; j++) {
          if (best.assign[i].load.bus !== best.assign[j].load.bus) continue;
          const candidate = best.assign.map((item) => ({ ...item }));
          [candidate[i].col, candidate[j].col] = [candidate[j].col, candidate[i].col];
          consider(candidate);
        }
      }

      if (!next) break;
      best = next;
    }
    setRoutes({ list: best.list, len: best.len, cross: best.cross });
  }

  function rearrangeColumn(col) {
    if (!routes || colInfo(col).isExc) return;
    const clickedRoute = routes.list.find((route) => route.col === col);

    if (selectedCol === null) {
      if (clickedRoute) setSelectedCol(col);
      return;
    }
    if (selectedCol === col) {
      setSelectedCol(null);
      return;
    }

    const selectedRoute = routes.list.find((route) => route.col === selectedCol);
    if (!selectedRoute) {
      setSelectedCol(null);
      return;
    }
    if (colInfo(col).bus !== selectedRoute.load.bus) {
      setWarn(`Load ${selectedRoute.load.name} must remain on Bus ${selectedRoute.load.bus}.`);
      return;
    }

    const nextAssign = routes.list.map((route) => ({ load: route.load, col: route.col }));
    const source = nextAssign.find((item) => item.col === selectedCol);
    const target = nextAssign.find((item) => item.col === col);
    source.col = col;
    if (target) target.col = selectedCol;

    const next = evaluateAssignment(nextAssign);
    setRoutes({ list: next.list, len: next.len, cross: next.cross });
    setSelectedCol(null);
    setWarn("");
  }

  /* ---------------- canvas interaction (click / pan / zoom) ---------------- */
  function worldPoint(clientX, clientY) {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: view.x + ((clientX - rect.left) / rect.width) * view.w,
      y: view.y + ((clientY - rect.top) / rect.height) * viewH(view.w),
    };
  }

  const panelRect = () =>
    horiz
      ? { x: geom.px, y: geom.py, w: geom.len, h: geom.th }
      : { x: geom.px, y: geom.py, w: geom.th, h: geom.len };

  function isOverPanel(point) {
    const rect = panelRect();
    return point.x > rect.x - 6 && point.x < rect.x + rect.w + 6
      && point.y > rect.y - 6 && point.y < rect.y + rect.h + 6;
  }

  function startLoadDrag(e, load) {
    if (pending || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const point = worldPoint(e.clientX, e.clientY);
    dragRef.current = {
      mode: "load",
      id: load.id,
      sx: e.clientX,
      sy: e.clientY,
      startX: load.x,
      startY: load.y,
      x: load.x,
      y: load.y,
      offsetX: load.x - point.x,
      offsetY: load.y - point.y,
      hadRoutes: Boolean(routes),
      moved: false,
      pointerId: e.pointerId,
    };
    svgRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerDown(e) {
    if (pending) return;
    if (e.button === 1) {
      /* middle button: AutoCAD-style pan (blocks browser autoscroll) */
      e.preventDefault();
      dragRef.current = { mode: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, vw: view.w, moved: false };
    } else if (e.button === 0) {
      dragRef.current = { mode: "click", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, vw: view.w, moved: false };
    }
  }

  function onPointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    if (d.mode === "load") {
      if (!(e.buttons & 1)) return;
      const point = worldPoint(e.clientX, e.clientY);
      const x = point.x + d.offsetX;
      const y = point.y + d.offsetY;
      if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true;
      if (!d.moved) return;
      d.x = x;
      d.y = y;
      setLoads((current) => current.map((load) => (
        load.id === d.id ? { ...load, x, y } : load
      )));
      return;
    }
    const panning = (d.mode === "pan" && (e.buttons & 4)) || (d.mode === "click" && (e.buttons & 1));
    if (!panning) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 5) d.moved = true;
    if (d.moved) {
      setView({
        x: d.vx - (dx / rect.width) * d.vw,
        y: d.vy - (dy / rect.height) * viewH(d.vw),
        w: d.vw,
      });
    }
  }

  function onPointerUp(e) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.pointerId !== undefined && svgRef.current?.hasPointerCapture(d.pointerId)) {
      svgRef.current.releasePointerCapture(d.pointerId);
    }
    if (d.mode === "load") {
      if (!d.moved) return;
      const finalPoint = isOverPanel({ x: d.x, y: d.y })
        ? { x: d.startX, y: d.startY }
        : { x: d.x, y: d.y };
      const nextLoads = loads.map((load) => (
        load.id === d.id ? { ...load, ...finalPoint } : load
      ));
      setLoads(nextLoads);
      setWarn("");
      if (d.hadRoutes && (finalPoint.x !== d.startX || finalPoint.y !== d.startY)) solve(nextLoads);
      return;
    }
    if (d.moved || pending) return;
    if (e.button !== 0) return; /* only left click adds a load */
    const p = worldPoint(e.clientX, e.clientY);
    if (isOverPanel(p)) return;
    setPName("");
    setPBus("A");
    setPending(p);
  }

  function addLoad() {
    if (!pName.trim()) return;
    setLoads((ls) => [...ls, {
      id: Date.now() + Math.random(),
      x: pending.x, y: pending.y,
      name: pName.trim().toUpperCase(),
      bus: mtm ? pBus : "A",
    }]);
    setPending(null);
    setRoutes(null);
    setWarn("");
  }

  function removeLoad(id) {
    setLoads((ls) => ls.filter((l) => l.id !== id));
    setRoutes(null);
  }

  function rotate() {
    const nextWall = WALLS[(WALLS.indexOf(wall) + 1) % WALLS.length];
    setWall(nextWall);
    appliedSetupFingerprintRef.current = panelSetupFingerprint({ ...panelSetup, wall: nextWall });
    setRoutes(null);
    setWarn("");
  }

  async function exportPdf() {
    if (!routes || !svgRef.current || exportingPdf) return;
    setExportingPdf(true);
    setWarn("");
    let exportHost = null;
    try {
      const [{ jsPDF }] = await Promise.all([import("jspdf"), import("svg2pdf.js")]);
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      pdf.setProperties({
        title: "MV Panel Load Routing",
        subject: "Panel layout, automatic routing and feeder schedule",
        creator: "MV Panel Load Router",
      });

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(INK);
      pdf.text("MV PANEL LOAD ROUTING", 23.5, 10);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(STEEL);
      pdf.text(
        `${widthIn} x ${heightIn} in | ${nCols} columns | wall: ${WALL_LABEL[wall]} | ${routes.list.length} routes | ${routes.cross} crossings | ${formatInches(routes.len)}`,
        23.5,
        15,
      );

      const panel = panelRect();
      const xs = [panel.x - 35, panel.x + panel.w + 35];
      const ys = [panel.y - 35, panel.y + panel.h + 35];
      for (const load of loads) {
        const labelPadding = Math.max(45, load.name.length * 3.5);
        xs.push(load.x - labelPadding, load.x + labelPadding);
        ys.push(load.y - 28, load.y + 28);
      }
      for (const route of routes.list) {
        for (const [x, y] of route.pts) {
          xs.push(x);
          ys.push(y);
        }
      }
      let minX = Math.min(...xs);
      let maxX = Math.max(...xs);
      let minY = Math.min(...ys);
      let maxY = Math.max(...ys);
      const targetRatio = 250 / 180;
      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;
      if (contentWidth / contentHeight > targetRatio) {
        const extra = (contentWidth / targetRatio - contentHeight) / 2;
        minY -= extra;
        maxY += extra;
      } else {
        const extra = (contentHeight * targetRatio - contentWidth) / 2;
        minX -= extra;
        maxX += extra;
      }

      const svgClone = svgRef.current.cloneNode(true);
      svgClone.setAttribute("viewBox", `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
      svgClone.setAttribute("width", "1000");
      svgClone.setAttribute("height", "720");
      exportHost = document.createElement("div");
      exportHost.style.cssText = "position:fixed;left:-10000px;top:0;width:1000px;height:720px";
      exportHost.appendChild(svgClone);
      document.body.appendChild(exportHost);
      await pdf.svg(svgClone, { x: 23.5, y: 20, width: 250, height: 180 });
      exportHost.remove();
      exportHost = null;

      pdf.addPage("a4", "landscape");
      const margin = 18;
      const pageBottom = 198;
      let y = 15;
      const pageHeader = (title) => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor(INK);
        pdf.text(title, margin, y);
        y += 7;
      };
      const newSchedulePage = () => {
        pdf.addPage("a4", "landscape");
        y = 15;
        pageHeader("FEEDER SCHEDULE - CONTINUED");
      };
      const configLines = [
        ["Panel", `${widthIn} x ${heightIn} in, ${nCols} columns`],
        ["Topology", mtm ? `Main-Tie-Main, tie at column ${tieCol}` : "Single bus A"],
        ["Cross-tie", [crossTieLeft ? 1 : null, crossTieRight ? nCols : null].filter(Boolean).join(", ") || "None"],
        ["Metering", mtm ? activeMeteringCols.map((col) => `column ${col}`).join(", ") : "None"],
        ["Transition", hasTransition ? `Column ${transitionCol}` : "None"],
        ["Incomer", mtm ? `A: column ${incomerA}${hasIncomerB ? `, B: column ${incomerB}` : ""}` : `Column ${incomerA}`],
        ["Exclusive", exclusives.length ? exclusives.map((i) => i + 1).join(", ") : "None"],
        ["Panel wall", WALL_LABEL[wall]],
      ];

      pageHeader("CONFIGURATION");
      pdf.setFontSize(8.5);
      for (const [label, value] of configLines) {
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(INK);
        pdf.text(`${label}:`, margin, y);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(STEEL);
        pdf.text(value, margin + 31, y);
        y += 5.5;
      }

      y += 4;
      pageHeader("FEEDER SCHEDULE");
      const drawScheduleHeader = () => {
        pdf.setFillColor(INK);
        pdf.rect(margin, y - 4.5, 261, 7, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor("#FFFFFF");
        pdf.text("COLUMN", margin + 3, y);
        pdf.text("LOAD", margin + 30, y);
        pdf.text("BUS", margin + 170, y);
        pdf.text("ROUTE LENGTH", margin + 205, y);
        y += 6;
      };
      drawScheduleHeader();
      for (const route of [...routes.list].sort((a, b) => a.col - b.col)) {
        if (y + 7 > pageBottom) {
          newSchedulePage();
          drawScheduleHeader();
        }
        pdf.setDrawColor(STEEL_LT);
        pdf.line(margin, y + 2, margin + 261, y + 2);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.setTextColor(INK);
        pdf.text(String(route.col + 1), margin + 3, y);
        pdf.setFont("helvetica", "normal");
        pdf.text(route.load.name, margin + 30, y, { maxWidth: 132 });
        pdf.text(route.load.bus, margin + 170, y);
        pdf.text(formatInches(route.len), margin + 205, y);
        y += 7;
      }

      const date = new Date().toISOString().slice(0, 10);
      pdf.save(`mv-panel-load-routing-${date}.pdf`);
    } catch (error) {
      setWarn(`Could not export PDF: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      exportHost?.remove();
      setExportingPdf(false);
    }
  }

  const colLoad = (i) => (routes ? routes.list.find((r) => r.col === i) || null : null);

  /* clamp incomer selections when the topology changes */
  function setColsSafe(value) {
    const v = clamp(Math.round(value), 2, 20);
    setNCols(v);
    setNColsDraft(String(v));
    setExclusives([]);
    const t = Math.min(v - 1, Math.max(2, Math.round(v / 2)));
    setTieCol(t);
    setMeteringCols(([first, second]) => {
      const nextFirst = clamp(first, 1, v);
      let nextSecond = clamp(second, 1, v);
      if (nextSecond === nextFirst && v > 1) nextSecond = nextFirst === v ? v - 1 : nextFirst + 1;
      return [nextFirst, nextSecond];
    });
    setIncomerA((a) => Math.min(a, mtm ? t - 1 : v) || 1);
    setIncomerB((b) => (b > t && b <= v ? b : v));
    setTransitionCol((c) => clamp(c, 1, v));
  }
  function commitColsDraft() {
    const parsed = Number(nColsDraft);
    setColsSafe(nColsDraft.trim() && Number.isFinite(parsed) ? parsed : nCols);
  }
  function setTieSafe(t) {
    setTieCol(t);
    setIncomerA((a) => (a < t ? a : 1));
    setIncomerB((b) => (b > t ? b : nCols));
  }
  function drawPanel() {
    if (appliedSetupFingerprintRef.current !== currentSetupFingerprint) {
      setLoads([]);
      setRoutes(null);
      setWarn("");
      setView({ x: 0, y: 0, w: VB_W });
    }
    appliedSetupFingerprintRef.current = currentSetupFingerprint;
    setStep("canvas");
  }

  /* ================= SETUP SCREEN ================= */
  if (step === "config") {
    const toggleExc = (i) =>
      setExclusives((e) => (e.includes(i) ? e.filter((x) => x !== i) : [...e, i]));
    const allColOpts = Array.from({ length: nCols }, (_, i) => i + 1);
    const incomerAOpts = Array.from({ length: nCols }, (_, i) => i + 1)
      .filter((c) => (mtm ? c < tieCol : true));
    const incomerBOpts = Array.from({ length: nCols }, (_, i) => i + 1)
      .filter((c) => c > tieCol);
    const roleColumns = [
      ...(crossTieLeft ? [[1, "cross-tie"]] : []),
      ...(crossTieRight ? [[nCols, "cross-tie"]] : []),
      ...(mtm ? [[tieCol, "tie"], ...activeMeteringCols.map((col, i) => [col, `metering ${i + 1}`])] : []),
      [incomerA, mtm ? "incomer A" : "incomer"],
      ...(mtm && hasIncomerB ? [[incomerB, "incomer B"]] : []),
      ...(hasTransition ? [[transitionCol, "transition"]] : []),
      ...exclusives.map((i) => [i + 1, "exclusive"]),
    ];
    const rolesByColumn = roleColumns.reduce((map, [col, role]) => {
      map.set(col, [...(map.get(col) || []), role]);
      return map;
    }, new Map());
    const configConflicts = [...rolesByColumn]
      .filter(([, roles]) => roles.length > 1)
      .map(([col, roles]) => `col. ${col}: ${roles.join(" / ")}`);
    return (
      <div style={{ minHeight: "100vh", background: PAPER, color: INK, fontFamily: "ui-monospace, 'Cascadia Mono', Consolas, monospace" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 24px" }}>
          <div style={{ borderBottom: `3px solid ${INK}`, paddingBottom: 12, marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 3, color: STEEL }}>SWITCHGEAR LINEUP DEFINITION</div>
              <h1 style={{ fontSize: 26, margin: "4px 0 0", letterSpacing: 1 }}>MV PANEL LOAD ROUTER</h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 10, color: STEEL, textAlign: "right" }}>SHEET<br />1 / 2</div>
              <a
                href="../../index.html"
                style={{
                  fontSize: 11, color: "#0e5da8", textDecoration: "none",
                  border: "1px solid #c6cdd4", background: "#fff", borderRadius: 4,
                  padding: "6px 12px", whiteSpace: "nowrap",
                }}
              >
                &larr; HUB
              </a>
            </div>
          </div>
          <div style={{ fontSize: 12, color: STEEL, marginBottom: 28 }}>
            Step 1 — dimensions, columns and bus topology
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
            {[
              ["PANEL WIDTH (in)", widthIn, setWidthIn, 39.37, 629.92, 0.01],
              ["PANEL HEIGHT (in)", heightIn, setHeightIn, 59.06, 125.98, 0.01],
            ].map(([lab, val, set, mn, mx, increment]) => (
              <label key={lab} style={{ display: "block" }}>
                <div style={{ fontSize: 10, letterSpacing: 1.5, marginBottom: 6 }}>{lab}</div>
                <input
                  type="number" min={mn} max={mx} step={increment} value={val}
                  onChange={(e) => set(Math.max(mn, Math.min(mx, Number(e.target.value) || mn)))}
                  style={{ width: "100%", padding: "10px 12px", border: `2px solid ${INK}`, background: "#fff", fontFamily: "inherit", fontSize: 15, boxSizing: "border-box" }}
                />
              </label>
            ))}
            <label style={{ display: "block" }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, marginBottom: 6 }}>No. OF COLUMNS (max 20)</div>
              <input
                type="number" min="2" max="20" step="1" value={nColsDraft}
                onChange={(e) => setNColsDraft(e.target.value)}
                onBlur={commitColsDraft}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                style={{ width: "100%", padding: "10px 12px", border: `2px solid ${INK}`, background: "#fff", fontFamily: "inherit", fontSize: 15, boxSizing: "border-box" }}
              />
            </label>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, marginBottom: 8 }}>
              EXCLUSIVE COLUMNS <span style={{ color: STEEL }}>(spares / dedicated — receive no load)</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Array.from({ length: nCols }, (_, i) => (
                <button key={i} onClick={() => toggleExc(i)}
                  style={{
                    width: 44, height: 44, border: `2px solid ${INK}`, cursor: "pointer",
                    fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                    background: exclusives.includes(i) ? INK : "#fff",
                    color: exclusives.includes(i) ? "#fff" : INK,
                  }}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div style={{ border: `2px solid ${INK}`, padding: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, marginBottom: 10 }}>CROSS-TIE COLUMNS</div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, marginBottom: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={crossTieLeft} onChange={(e) => setCrossTieLeft(e.target.checked)} />
                Column 1 is a cross-tie
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={crossTieRight} onChange={(e) => setCrossTieRight(e.target.checked)} />
                Column {nCols} is a cross-tie
              </label>
              <div style={{ fontSize: 9, color: STEEL, marginTop: 8 }}>
                Only the selected cross-tie column is reserved and receives no loads.
              </div>
            </div>
            <div style={{ border: `2px solid ${INK}`, padding: 16 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, marginBottom: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={mtm} onChange={(e) => { setMtm(e.target.checked); if (e.target.checked) setTieSafe(tieCol); }} />
                <b>MAIN-TIE-MAIN</b>
              </label>
              {mtm && (
                <div style={{ fontSize: 12 }}>
                  <label>
                    TIE column:&nbsp;
                    <select value={tieCol} onChange={(e) => setTieSafe(Number(e.target.value))}
                      style={{ fontFamily: "inherit", fontSize: 13, padding: "4px 8px", border: `2px solid ${INK}` }}>
                      {Array.from({ length: nCols }, (_, i) => i + 1)
                        .filter((c) => c > 1 && c < nCols)
                        .map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <div style={{ fontSize: 10, letterSpacing: 1.2, marginTop: 12, marginBottom: 6 }}>TIE METERING</div>
                  <div role="group" aria-label="Tie metering columns" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                    {[
                      [1, "ONE METERING"],
                      [2, "TWO METERINGS"],
                    ].map(([count, label]) => (
                      <button key={count} type="button" onClick={() => setMeteringCount(count)} aria-pressed={meteringCount === count}
                        style={{
                          padding: "7px 4px", border: `2px solid ${INK}`, cursor: "pointer",
                          fontFamily: "inherit", fontSize: 9, fontWeight: 700,
                          background: meteringCount === count ? INK : "#fff",
                          color: meteringCount === count ? "#fff" : INK,
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: meteringCount === 2 ? "1fr 1fr" : "1fr", gap: 8, marginTop: 10 }}>
                    {Array.from({ length: meteringCount }, (_, i) => (
                      <label key={i} style={{ display: "block", fontSize: 10 }}>
                        Metering {i + 1}:&nbsp;
                        <select value={meteringCols[i]} onChange={(e) => setMeteringCols((cols) => cols.map((col, index) => index === i ? Number(e.target.value) : col))}
                          style={{ fontFamily: "inherit", fontSize: 12, padding: "4px 6px", border: `2px solid ${INK}` }}>
                          {allColOpts.map((c) => <option key={c} value={c}>Col. {c}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: STEEL, marginTop: 8 }}>
                    Metering position is independent from the tie column.<br />
                    Bus A → col. 1…{tieCol - 1} · Bus B → col. {tieCol + 1}…{nCols}
                  </div>
                </div>
              )}
              {!mtm && <div style={{ fontSize: 10, color: STEEL }}>Single bus — everything on bus A.</div>}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div style={{ border: `2px solid ${INK}`, padding: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, marginBottom: 10 }}>INCOMER COLUMN{mtm && hasIncomerB ? "S" : ""}</div>
              <label style={{ display: "block", fontSize: 12, marginBottom: mtm ? 10 : 0 }}>
                {mtm ? "Main A (bus A) incomer:" : "Power incomer:"}&nbsp;
                <select value={incomerA} onChange={(e) => setIncomerA(Number(e.target.value))}
                  style={{ fontFamily: "inherit", fontSize: 13, padding: "4px 8px", border: `2px solid ${INK}` }}>
                  {incomerAOpts.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              {mtm && (
                <>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, marginBottom: hasIncomerB ? 10 : 0, cursor: "pointer" }}>
                    <input type="checkbox" checked={hasIncomerB} onChange={(e) => setHasIncomerB(e.target.checked)} />
                    Add Main B (bus B) incomer
                  </label>
                  {hasIncomerB && (
                    <label style={{ display: "block", fontSize: 12 }}>
                      Main B (bus B) incomer:&nbsp;
                      <select value={incomerB} onChange={(e) => setIncomerB(Number(e.target.value))}
                        style={{ fontFamily: "inherit", fontSize: 13, padding: "4px 8px", border: `2px solid ${INK}` }}>
                        {incomerBOpts.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                  )}
                </>
              )}
              <div style={{ fontSize: 9, color: STEEL, marginTop: 8 }}>
                Incoming columns are power entries, not feeders — they are excluded from routing.
              </div>
            </div>
            <div style={{ border: `2px solid ${INK}`, padding: 16 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, marginBottom: hasTransition ? 10 : 0, cursor: "pointer" }}>
                <input type="checkbox" checked={hasTransition} onChange={(e) => setHasTransition(e.target.checked)} />
                <b>TRANSITION COLUMN</b>
              </label>
              {hasTransition && (
                <label style={{ display: "block", fontSize: 12 }}>
                  Position:&nbsp;
                  <select value={transitionCol} onChange={(e) => setTransitionCol(Number(e.target.value))}
                    style={{ fontFamily: "inherit", fontSize: 13, padding: "4px 8px", border: `2px solid ${INK}` }}>
                    {allColOpts.map((c) => <option key={c} value={c}>Column {c}</option>)}
                  </select>
                </label>
              )}
              <div style={{ fontSize: 9, color: STEEL, marginTop: 8 }}>
                The selected position is reserved and receives no routed load.
              </div>
            </div>
          </div>

          <div style={{ border: `2px solid ${INK}`, padding: 16, marginBottom: 24 }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, marginBottom: 10 }}>PANEL WALL</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                {WALLS.map((w) => (
                  <button key={w} onClick={() => setWall(w)}
                    style={{
                      padding: "7px 0", border: `2px solid ${INK}`, cursor: "pointer",
                      fontFamily: "inherit", fontSize: 9, fontWeight: 700,
                      background: wall === w ? INK : "#fff", color: wall === w ? "#fff" : INK,
                    }}>
                    {WALL_LABEL[w]}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 9, color: STEEL, marginTop: 8 }}>
                Rotatable at any time. Column sequence 1…N and bus A never mirror.
              </div>
          </div>

          {configConflicts.length > 0 && (
            <div style={{ border: "2px solid #b3261e", color: "#b3261e", background: "#fdecea", padding: "8px 12px", fontSize: 11, marginBottom: 12 }}>
              Choose a different position for overlapping roles: {configConflicts.join("; ")}.
            </div>
          )}

          <button
            disabled={configConflicts.length > 0}
            onClick={drawPanel}
            style={{
              width: "100%", padding: "14px 0", background: configConflicts.length ? "#c6cdd4" : INK, color: "#fff",
              border: "none", fontFamily: "inherit", fontSize: 14, letterSpacing: 3, cursor: configConflicts.length ? "not-allowed" : "pointer",
            }}>
            DRAW PANEL →
          </button>
        </div>
      </div>
    );
  }

  /* ================= ROUTING SCREEN ================= */
  const { px, py, len, th, cl } = geom;

  /* label inside a column, by role priority */
  const roleLabel = (info, i) => {
    if (info.isTie) return { text: "TIE", color: STEEL };
    if (info.isCross) return { text: "CROSS-TIE", color: COPPER };
    if (info.isMeter) return { text: "METERING", color: COPPER };
    if (info.isTransition) return { text: "TRANSITION", color: STEEL };
    if (info.isIncomer) return { text: mtm ? (i === incomerA - 1 ? "INCOMER A" : "INCOMER B") : "INCOMER", color: INK };
    if (info.isExc) return { text: "EXCLUSIVE", color: STEEL };
    return null;
  };

  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK, fontFamily: "ui-monospace, 'Cascadia Mono', Consolas, monospace" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 14px" }}>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <button onClick={() => setStep("config")}
            style={{ padding: "7px 12px", border: `2px solid ${INK}`, background: "#fff", fontFamily: "inherit", fontSize: 10, letterSpacing: 1, cursor: "pointer" }}>
            ← SETUP
          </button>
          <button onClick={() => solve()}
            style={{ padding: "7px 16px", border: "none", background: INK, color: "#fff", fontFamily: "inherit", fontSize: 10, letterSpacing: 2, cursor: "pointer" }}>
            ROUTE LOADS
          </button>
          <button onClick={rotate}
            style={{ padding: "7px 12px", border: `2px solid ${INK}`, background: "#fff", fontFamily: "inherit", fontSize: 10, cursor: "pointer" }}>
            ⟳ WALL: {WALL_LABEL[wall]}
          </button>
          <button onClick={() => { setRoutes(null); setWarn(""); }} disabled={!routes}
            style={{
              padding: "7px 12px", border: `2px solid ${STEEL}`, fontFamily: "inherit", fontSize: 10,
              background: "#fff", color: routes ? STEEL : "#9aa5b1", cursor: routes ? "pointer" : "not-allowed",
            }}>
            CLEAR ROUTES
          </button>
          <button onClick={() => { setLoads([]); setRoutes(null); setWarn(""); }}
            style={{ padding: "7px 12px", border: `2px solid ${STEEL}`, background: "#fff", color: STEEL, fontFamily: "inherit", fontSize: 10, cursor: "pointer" }}>
            CLEAR LOADS
          </button>
          <button onClick={exportPdf} disabled={!routes || exportingPdf}
            style={{
              padding: "7px 12px", border: `2px solid ${INK}`, fontFamily: "inherit", fontSize: 10,
              background: routes && !exportingPdf ? "#fff" : "#c6cdd4", color: routes && !exportingPdf ? INK : STEEL,
              cursor: routes && !exportingPdf ? "pointer" : "not-allowed",
            }}>
            {exportingPdf ? "EXPORTING..." : "EXPORT PDF"}
          </button>
          <div style={{ fontSize: 10, color: STEEL, marginLeft: "auto" }}>
            {routes
              ? <>ROUTES: {routes.list.length} · CROSSINGS: <b style={{ color: routes.cross ? "#b3261e" : "#0F8A62" }}>{routes.cross}</b> · TOTAL LENGTH: {formatInches(routes.len)} · drag load = move &amp; reroute · double-click = delete</>
              : <>Left click = add load{mtm ? " (A/B)" : ""} · drag load = move · double-click load = delete · middle button (drag) = pan · wheel = zoom</>}
          </div>
        </div>

        {warn && (
          <div style={{ border: "2px solid #b3261e", color: "#b3261e", background: "#fdecea", padding: "8px 12px", fontSize: 12, marginBottom: 8 }}>
            ⚠ {warn}
          </div>
        )}

        <div style={{ position: "relative", border: `3px solid ${INK}`, background: "#fff" }}>
          <svg
            ref={svgRef}
            viewBox={`${view.x} ${view.y} ${view.w} ${viewH(view.w)}`}
            style={{ display: "block", width: "100%", cursor: "crosshair", touchAction: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={() => { if (dragRef.current?.mode !== "load") dragRef.current = null; }}
            onAuxClick={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <defs>
              <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="8" stroke={STEEL} strokeWidth="1.5" opacity="0.35" />
              </pattern>
            </defs>

            {/* routes */}
            {routes && routes.list.map((r) => (
              <g key={r.load.id}>
                <polyline
                  points={r.pts.map((p) => p.join(",")).join(" ")}
                  fill="none" stroke={r.color} strokeWidth="2.5"
                  strokeLinejoin="round" strokeLinecap="round"
                />
                <circle cx={r.pts[0][0]} cy={r.pts[0][1]} r="3.5" fill={r.color} />
              </g>
            ))}

            {/* ===== panel ===== */}
            <g>
              {horiz ? (
                <rect x={px - 3} y={py - 3} width={len + 6} height={th + 6} fill={STEEL_LT} stroke={INK} strokeWidth="2" />
              ) : (
                <rect x={px - 3} y={py - 3} width={th + 6} height={len + 6} fill={STEEL_LT} stroke={INK} strokeWidth="2" />
              )}

              {Array.from({ length: nCols }, (_, i) => {
                const info = colInfo(i);
                const rt = colLoad(i);
                const role = roleLabel(info, i);
                const isSelected = selectedCol === i;
                const isManualTarget = Boolean(routes) && !info.isExc && (Boolean(rt) || selectedCol !== null);
                const activateColumn = (event) => {
                  if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  event.stopPropagation();
                  rearrangeColumn(i);
                };
                if (horiz) {
                  const x = px + i * cl;
                  const cx = x + cl / 2, cy = py + (th + HEAD) / 2;
                  return (
                    <g key={i} role={isManualTarget ? "button" : undefined} tabIndex={isManualTarget ? 0 : undefined}
                      aria-label={isManualTarget ? `${rt ? rt.load.name : `Empty Bus ${info.bus} slot`} at column ${i + 1}` : undefined}
                      onClick={isManualTarget ? activateColumn : undefined} onKeyDown={isManualTarget ? activateColumn : undefined}
                      style={{ cursor: isManualTarget ? "pointer" : "default" }}>
                      {isManualTarget && <title>{rt ? `Select ${rt.load.name}` : `Move selected load to column ${i + 1}`}</title>}
                      <rect x={x} y={py} width={cl} height={th} fill={isSelected ? "#fdf6e3" : info.isExc ? "url(#hatch)" : "#fff"}
                        stroke={isSelected ? COPPER : INK} strokeWidth={isSelected ? "3" : "1.2"} />
                      <rect x={x} y={py} width={cl} height={HEAD} fill={INK} />
                      <text x={cx} y={py + 12} textAnchor="middle" fill="#fff" fontSize="9.5" fontWeight="700" fontFamily="inherit">{i + 1}</text>
                      {role && (
                        <text x={cx} y={cy + 3} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={role.color} fontFamily="inherit"
                          transform={`rotate(-90 ${cx} ${cy})`}>{role.text}</text>
                      )}
                      {rt && (
                        <text x={cx} y={cy + 3} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={rt.color} fontFamily="inherit"
                          transform={`rotate(-90 ${cx} ${cy})`}>{rt.load.name}</text>
                      )}
                      {!info.isExc && !rt && (
                        <text x={cx} y={py + th - 6} textAnchor="middle" fontSize="7" fill="#9aa5b1" fontFamily="inherit">{info.bus}</text>
                      )}
                    </g>
                  );
                }
                const y = py + i * cl;
                const cx = px + HEAD + (th - HEAD) / 2, cy = y + cl / 2;
                return (
                  <g key={i} role={isManualTarget ? "button" : undefined} tabIndex={isManualTarget ? 0 : undefined}
                    aria-label={isManualTarget ? `${rt ? rt.load.name : `Empty Bus ${info.bus} slot`} at column ${i + 1}` : undefined}
                    onClick={isManualTarget ? activateColumn : undefined} onKeyDown={isManualTarget ? activateColumn : undefined}
                    style={{ cursor: isManualTarget ? "pointer" : "default" }}>
                    {isManualTarget && <title>{rt ? `Select ${rt.load.name}` : `Move selected load to column ${i + 1}`}</title>}
                    <rect x={px} y={y} width={th} height={cl} fill={isSelected ? "#fdf6e3" : info.isExc ? "url(#hatch)" : "#fff"}
                      stroke={isSelected ? COPPER : INK} strokeWidth={isSelected ? "3" : "1.2"} />
                    <rect x={px} y={y} width={HEAD} height={cl} fill={INK} />
                    <text x={px + HEAD / 2} y={cy + 3.5} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" fontFamily="inherit">{i + 1}</text>
                    {role && (
                      <text x={cx} y={cy + 3} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={role.color} fontFamily="inherit">{role.text}</text>
                    )}
                    {rt && (
                      <text x={cx} y={cy + 3} textAnchor="middle" fontSize="8" fontWeight="700" fill={rt.color} fontFamily="inherit">{rt.load.name}</text>
                    )}
                    {!info.isExc && !rt && (
                      <text x={px + th - 8} y={cy + 3} textAnchor="middle" fontSize="7" fill="#9aa5b1" fontFamily="inherit">{info.bus}</text>
                    )}
                  </g>
                );
              })}

              {/* bus bars — bus A always at the start (column 1) */}
              {horiz ? (
                !mtm ? (
                  <>
                    <line x1={px + 5} y1={py + HEAD + 8} x2={px + len - 5} y2={py + HEAD + 8} stroke={COPPER} strokeWidth="3" />
                    <text x={px + len / 2} y={wall === "bottom" ? py - 7 : py + th + 14} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={COPPER} fontFamily="inherit">BUS A</text>
                  </>
                ) : (
                  <>
                    <line x1={px + 5} y1={py + HEAD + 8} x2={px + tieIdx * cl + 4} y2={py + HEAD + 8} stroke={COPPER} strokeWidth="3" />
                    <line x1={px + (tieIdx + 1) * cl - 4} y1={py + HEAD + 8} x2={px + len - 5} y2={py + HEAD + 8} stroke={COPPER} strokeWidth="3" />
                    <rect x={px + tieIdx * cl + cl / 2 - 5} y={py + HEAD + 3} width="10" height="10" fill="#fff" stroke={COPPER} strokeWidth="2" />
                    <text x={px + (tieIdx * cl) / 2} y={wall === "bottom" ? py - 7 : py + th + 14} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={COPPER} fontFamily="inherit">BUS A</text>
                    <text x={px + (tieIdx + 1) * cl + (len - (tieIdx + 1) * cl) / 2} y={wall === "bottom" ? py - 7 : py + th + 14} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={COPPER} fontFamily="inherit">BUS B</text>
                  </>
                )
              ) : !mtm ? (
                <>
                  <line x1={px + HEAD + 8} y1={py + 5} x2={px + HEAD + 8} y2={py + len - 5} stroke={COPPER} strokeWidth="3" />
                  <text x={px + th / 2} y={py - 8} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={COPPER} fontFamily="inherit">BUS A</text>
                </>
              ) : (
                <>
                  <line x1={px + HEAD + 8} y1={py + 5} x2={px + HEAD + 8} y2={py + tieIdx * cl + 4} stroke={COPPER} strokeWidth="3" />
                  <line x1={px + HEAD + 8} y1={py + (tieIdx + 1) * cl - 4} x2={px + HEAD + 8} y2={py + len - 5} stroke={COPPER} strokeWidth="3" />
                  <rect x={px + HEAD + 3} y={py + tieIdx * cl + cl / 2 - 5} width="10" height="10" fill="#fff" stroke={COPPER} strokeWidth="2" />
                  <text x={px + th / 2} y={py - 8} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={COPPER} fontFamily="inherit">BUS A ▲</text>
                  <text x={px + th / 2} y={py + len + 14} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={COPPER} fontFamily="inherit">BUS B ▼</text>
                </>
              )}

              {/* dimension note */}
              {horiz ? (
                <text x={px + len / 2} y={wall === "bottom" ? py + th + 26 : py - 18} textAnchor="middle" fontSize="9" fill={STEEL} fontFamily="inherit">
                  {widthIn} × {heightIn} in · {nCols} col.
                </text>
              ) : (
                <text x={px + th / 2} y={py + len + 30} textAnchor="middle" fontSize="9" fill={STEEL} fontFamily="inherit">
                  {widthIn} × {heightIn} in · {nCols} col.
                </text>
              )}
            </g>

            {/* loads */}
            {loads.map((l) => {
              const rt = routes && routes.list.find((r) => r.load.id === l.id);
              const cor = rt ? rt.color : INK;
              return (
                <g key={l.id} style={{ cursor: "grab" }} onPointerDown={(e) => startLoadDrag(e, l)}
                  onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); dragRef.current = null; removeLoad(l.id); }}>
                  <title>Double-click to delete {l.name}</title>
                  <circle cx={l.x} cy={l.y} r="18" fill="transparent" />
                  <circle cx={l.x} cy={l.y} r="6.5" fill="#fff" stroke={cor} strokeWidth="2.5" />
                  <circle cx={l.x} cy={l.y} r="2" fill={cor} />
                  <text x={l.x} y={l.y - 12} textAnchor="middle" fontSize="10" fontWeight="700" fill={cor} fontFamily="inherit">
                    {l.name} <tspan fontSize="8" fill={STEEL}>[{l.bus}]</tspan>
                  </text>
                  {rt && (
                    <text x={l.x} y={l.y + 19} textAnchor="middle" fontSize="8" fill={STEEL} fontFamily="inherit">← col. {rt.col + 1}</text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* zoom controls */}
          <div style={{ position: "absolute", top: 10, right: 10, display: "flex", flexDirection: "column", gap: 5 }}>
            {[
              ["＋", () => zoomAt(1 / 1.3)],
              ["－", () => zoomAt(1.3)],
              ["⤢", () => setView({ x: 0, y: 0, w: VB_W })],
            ].map(([lab, fn]) => (
              <button key={lab} onClick={fn}
                style={{
                  width: 34, height: 34, border: `2px solid ${INK}`, background: "#fff",
                  fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer", color: INK,
                }}>
                {lab}
              </button>
            ))}
            <div style={{ textAlign: "center", fontSize: 9, color: STEEL, background: "rgba(255,255,255,0.85)", padding: "2px 0" }}>
              {Math.round((VB_W / view.w) * 100)}%
            </div>
          </div>

          {/* new load modal */}
          {pending && (
            <div style={{
              position: "absolute", inset: 0, background: "rgba(24,34,48,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ background: "#fff", border: `3px solid ${INK}`, padding: 22, width: 300 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: STEEL, marginBottom: 10 }}>NEW LOAD</div>
                <input
                  autoFocus value={pName} placeholder="Load name (e.g., PUMP P-101)"
                  onChange={(e) => setPName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLoad()}
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: `2px solid ${INK}`, fontFamily: "inherit", fontSize: 13, marginBottom: 12 }}
                />
                {mtm && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    {["A", "B"].map((b) => (
                      <button key={b} onClick={() => setPBus(b)}
                        style={{
                          flex: 1, padding: "8px 0", border: `2px solid ${INK}`, cursor: "pointer",
                          fontFamily: "inherit", fontWeight: 700, fontSize: 13,
                          background: pBus === b ? INK : "#fff", color: pBus === b ? "#fff" : INK,
                        }}>
                        BUS {b}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addLoad} disabled={!pName.trim()}
                    style={{
                      flex: 1, padding: "10px 0", border: "none", fontFamily: "inherit", fontSize: 12,
                      letterSpacing: 1, cursor: pName.trim() ? "pointer" : "not-allowed",
                      background: pName.trim() ? INK : "#c6cdd4", color: "#fff",
                    }}>
                    ADD
                  </button>
                  <button onClick={() => setPending(null)}
                    style={{ padding: "10px 14px", border: `2px solid ${STEEL}`, background: "#fff", color: STEEL, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>
                    CANCEL
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* feeder schedule */}
        {routes && routes.list.length > 0 && (
          <div style={{ marginTop: 12, border: `2px solid ${INK}`, background: "#fff" }}>
            <div style={{ background: INK, color: "#fff", fontSize: 10, letterSpacing: 2, padding: "5px 12px" }}>
              FEEDER SCHEDULE
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
              {[...routes.list].sort((a, b) => a.col - b.col).map((r) => (
                <div key={r.load.id} style={{ padding: "7px 10px", borderRight: `1px solid ${STEEL_LT}`, borderTop: `1px solid ${STEEL_LT}`, fontSize: 11, display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 9, height: 9, background: r.color, display: "inline-block" }} />
                  <b>COL {r.col + 1}</b> → {r.load.name}
                  <span style={{ color: STEEL, marginLeft: "auto", fontSize: 9 }}>[{r.load.bus}] {formatInches(r.len)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
