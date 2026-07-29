// pdf.js — export the current drawing to PDF.
//
// To keep the app fully self-contained on GitHub Pages (no external CDN,
// works offline) we build a clean standalone SVG of the whole scene and open
// it in a print window; the browser's "Save as PDF" produces the file.

import { state } from './store.js?v=20260723-2';
import { render, fitToContent } from './render.js?v=20260723-2';

// SVG-only styles inlined into the export document so it renders identically
// without the app's stylesheet.
const EXPORT_CSS = `
  svg { background:#ffffff; }
  .panel-box { fill:#ffffff; stroke:#1f2733; stroke-width:2; }
  .panel-box.selected { stroke:#2f6fd8; }
  .panel-sep { stroke:#c4ccd6; stroke-width:1; }
  .panel-bus { stroke:#d98a2b; stroke-width:2.5; }
  .panel-hatch { fill:url(#hatch); stroke:none; }
  .panel-num { fill:#1f2733; font:600 11px 'Courier New',monospace; }
  .panel-label { fill:#3b4756; font:600 11px 'Courier New',monospace; letter-spacing:.5px; dominant-baseline:middle; }
  .panel-size { fill:#6a7686; font:500 7px 'Courier New',monospace; letter-spacing:.25px; dominant-baseline:middle; }
  .panel-end-label { fill:#3b4756; font:600 6px 'Courier New',monospace; letter-spacing:.25px; dominant-baseline:middle; }
  .panel-title { fill:#1f2733; font:700 13px 'Courier New',monospace; letter-spacing:1px; }
  .panel-tap { fill:#1f2733; }
  .route { fill:none; stroke-width:2.4; stroke-linejoin:round; stroke-linecap:round; }
  .route.blocked { stroke:#b42318 !important; stroke-width:3.2; stroke-dasharray:8 5; }
  .foundation-area { fill:rgba(180,57,45,.16); stroke:#a9362b; stroke-width:2; stroke-dasharray:7 4; }
  .foundation-label { fill:#8f2f27; font:700 11px 'Courier New',monospace; letter-spacing:.5px; }
  .foundation-size { fill:#8f2f27; font:600 10px 'Courier New',monospace; }
  .load-ring { fill:#ffffff; stroke-width:2.4; }
  .load-tag { font:700 12px 'Courier New',monospace; letter-spacing:.5px; }
  .load-sub { fill:#6a7686; font:500 10px 'Courier New',monospace; }
`;

const HATCH_DEF = `
  <defs>
    <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="#c9d2dd" stroke-width="1.2"/>
    </pattern>
  </defs>`;

export function exportPdf() {
  const svg = document.getElementById('canvas');
  if (!svg) return;

  // Snapshot the view, fit everything, and re-render so the export shows the
  // full drawing regardless of current pan/zoom.
  const savedView = { ...state.view };
  const savedSel = state.selection;
  state.selection = null;
  fitToContent(50);
  render();

  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const w = svg.clientWidth;
  const h = svg.clientHeight;
  clone.setAttribute('width', w);
  clone.setAttribute('height', h);
  clone.setAttribute('viewBox', `0 0 ${w} ${h}`);

  const stats = state.stats;
  const header =
    `ROUTES: ${stats.routes}   CROSSINGS: ${stats.crossings}   ` +
    `BLOCKED: ${stats.blocked || 0}   FOUNDATIONS: ${state.foundations.length}   ` +
    `TOTAL LENGTH: ${stats.length} in`;

  const doc = `<!doctype html><html><head><meta charset="utf-8">
    <title>Underground Route Plan</title>
    <style>
      @page { size: landscape; margin: 12mm; }
      body { margin:0; font-family:'Courier New',monospace; color:#1f2733; }
      .head { padding:8px 4px; font-size:12px; letter-spacing:1px; border-bottom:1px solid #1f2733; }
      ${EXPORT_CSS}
    </style></head>
    <body>
      <div class="head">UNDERGROUND ROUTE PLAN &nbsp;·&nbsp; ${header}</div>
      ${withHatch(clone.outerHTML)}
      <script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>
    </body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.open();
    win.document.write(doc);
    win.document.close();
  }

  // Restore the interactive view.
  state.view = savedView;
  state.selection = savedSel;
  render();
}

function withHatch(svgHtml) {
  // Ensure the hatch pattern def exists inside the exported SVG without
  // duplicating the definition rebuilt by render().
  if (/\bid=["']hatch["']/.test(svgHtml)) return svgHtml;
  return svgHtml.replace(/<svg([^>]*)>/, `<svg$1>${HATCH_DEF}`);
}
