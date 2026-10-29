# Design Tools

A single static site bundling the electrical engineering web tools, plus the
engineering database they are derived from. The hub page lists every
application; clicking a card opens it. The published site runs entirely in the
browser — no server, no backend, and no database at runtime.

## Repository layout

```
index.html              hub page
shared/theme.css        palette and typography for every tool
assets/                 favicon
apps/<app>/             individual applications
data/elec.db            cable and conduit tables (build-time source)
scripts/                build and data scripts
tests/                  regression tests
.github/workflows/      GitHub Pages deployment
```

`data/elec.db` is a **build-time input only**. `scripts/extract-elec-db.mjs`
pulls the tables the web apps need into JSON; the database itself is never
copied into `dist/` and never reaches the published site.

It is a trimmed copy of the full engineering database — four tables, no project
data. See [`data/README.md`](data/README.md) for what it contains and how to
regenerate it.

## Applications

| App | Path | Type |
| --- | --- | --- |
| Neher-McGrath Duct Bank Ampacity | `apps/neher` | static (vanilla JS) |
| Cable Tray Ampacity & Sizing | `apps/nec-cable-tray` | Vite + React + Tailwind |
| TrayLab - NEC 2023 / Southwire | `apps/traylab-southwire` | static (vanilla JS) |
| Conduit Fill | `apps/conduit-fill` | static (vanilla JS) |
| LV Cable Voltage Drop | `apps/voltage-drop` | Vite + React |
| LV Panel Sizer | `apps/dimensionador` | Vite + React + TS |
| MV Panel Load Router | `apps/panel-router` | Vite + React |
| Underground Route Planner | `apps/under-routing` | static (vanilla JS) |

## Build

```bash
npm run build        # node scripts/build.mjs
```

This installs and builds each Vite app, copies the static apps, and assembles
everything into `dist/`:

```
dist/
  index.html            hub
  assets/               favicon
  shared/theme.css      shared palette and typography
  apps/<app>/           each application
  .nojekyll
```

The `apps/` prefix mirrors the source layout, so the hub's links work both in
the repository and in the published site. Every Vite app uses `base: "./"`, so
the bundle works from any sub-path of a GitHub Pages project site.

Preview the built site locally:

```bash
npm run preview      # serves dist/ on http://localhost:8080
```

## Publish to GitHub Pages

`.github/workflows/deploy.yml` builds and deploys on every push to `main`.
Enable it once under **Settings → Pages → Build and deployment → Source:
GitHub Actions**. The site is served at `https://<user>.github.io/<repo>/`.

## Tests

```bash
npm test
```

- `tests/neher-calc.test.js` checks the revised Neher–McGrath thermal network
  against analytical loss-weighted circuits, concrete geometry and physical invariants.
  `tests/neher-current.test.js` covers derived per-set current updates.
- `tests/nec-cable-tray.test.js` checks the NEC 392.80 derating chain, load
  rules, ambient and adjustment factors, voltage drop and EGC sizing against
  values worked by hand from the code tables.
- `tests/conduit-fill.test.js` checks NEC Chapter 9 fill factors and the
  Schedule 40 conduit geometry used by the Conduit Fill tool.
- `tests/traylab-nec.test.js` and `tests/traylab-project.test.js` preserve the
  TrayLab regression checks for NEC fill, divider geometry, project migration,
  catalog integrity, width suggestions and CSV exports.
- `tests/traylab-arrangement.test.js` checks trefoil/VFD arrangements,
  spacing, migration and physical geometry.
- `tests/traylab-compliance.test.js` preserves the reviewed source's 45
  compliance scenarios, including 80 deterministic packing comparisons,
  external calculation basis, review invalidation and fail-closed issue gates.
- `tests/traylab-hub.test.js` checks hub registration, theme integration,
  local asset resolution and the absence of the superseded installation module.

## Design system

`shared/theme.css` holds the shared palette and typography — the light,
instrument-panel look established by the LV Cable Voltage Drop app:

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#eceff2` | page background |
| `--panel` | `#ffffff` | cards |
| `--ink` | `#1d2530` | text, rules |
| `--muted` | `#5c6875` | labels, secondary text |
| `--steel` | `#c6cdd4` | borders |
| `--accent` | `#0e5da8` | selection, active state, links |
| `--ok` / `--warn` / `--bad` | `#1e7d46` / `#d99a00` / `#b3261e` | status |
| `--plate` | `#2a323c` | dark result nameplate |

Type is Saira Semi Condensed for UI and IBM Plex Mono for data, loaded from
Google Fonts with a system fallback. Static pages link `shared/theme.css`
directly; Vite apps import it from their entry CSS. Colours should not be
defined anywhere else.

The hub, Neher-McGrath, Cable Tray, TrayLab, LV Cable Voltage Drop and Underground
Route Planner are on it, and the MV Panel Load Router uses it for its chrome. Two
deliberate exceptions stay outside:

- **MV Panel Load Router** keeps its own ten-hue `PALETTE` array. Those colours
  identify individual routes and have to stay visually distinct from each other.
- **LV Panel Sizer** keeps its own green/orange signal palette
  (`apps/dimensionador/src/index.css`). It reads well as-is and is intentionally
  left alone.

New work should use the shared tokens rather than adding a third palette.

## TrayLab - NEC 2023 / Southwire

[`apps/traylab-southwire`](apps/traylab-southwire/README.md) is a static,
browser-local cable tray fill tool with a 2,195-item Southwire catalog,
individually checked compartments, draggable dividers, design reserve and
tray-width suggestions. It supports saved projects, JSON import/export, CSV
export and printable U.S. Letter landscape reports.

This integration uses `traylab-nec2023-reviewed-complete-source`, replacing
the earlier TrayLab implementation. Its calculation, arrangement, compliance
and project modules are preserved. Large single-conductor phase cables use
ABC trefoils with per-compartment 1D/2.15D clearance; multiconductor/VFD
spacing is modeled separately. Physical fit and NEC fill are independent.

External calculation-basis records and installation review must match the
current configuration before reports or CSVs can be issued. Incomplete or
unsupported configurations remain drafts. The application does not calculate
ampacity or certify NEC compliance; the responsible engineer must verify the
adopted code and project evidence.

The interface, including the tray diagram, uses `shared/theme.css` tokens,
shared typography and a return link to the hub. The catalog and provenance manifest are served
locally; no runtime backend, package installation or separate build is needed.
Project storage remains local to the browser and origin; export JSON for backup
or to transfer projects from another site.

See [calculation scope and verification](apps/traylab-southwire/NEC-NOTES.md)
and the [supplied source audit](apps/traylab-southwire/AUDIT-2023.md).
Fill checks do not establish ampacity or mechanical approval.

## The Neher-McGrath app

`apps/neher` is a web port of the **Neher** screen of the EleCalc WPF desktop
application (`eleCalc/EleCalc/Neher/`). It covers the two areas that matter for
duct-bank sizing — **Current Calc** and **Neher-McGrath** — side by side. The
original WPF port has been revised against Neher–McGrath (1957). It now supports
homogeneous sand fill (default), optional concrete with four user-defined clearances,
MV dielectric and shield loss estimates, and synchronized current per parallel set.
Ampacity and operating temperature use the same thermal solver.

See [the method, equations, assumptions and verification](apps/neher/METHOD.md).
MV capacitance is estimated from each cable's geometry; dielectric and shield loss
factors use stated screening assumptions, including during MV auto-size. The catalog,
MV loss estimates and PVC air-gap approximation require project-specific verification.

### Data

`apps/neher/data/cables.json` is extracted from `data/elec.db`, which carries
the same tables the EleCalc desktop tool reads:

```bash
node scripts/extract-elec-db.mjs                 # uses data/elec.db
node scripts/extract-elec-db.mjs path/to/other.db
```

It exports the `low_voltage`, `medium_voltage`, `conduitsNeher` and
`nec_430_250` tables with exactly the column names the ported code queries.
Re-run it whenever the database changes, then commit the regenerated JSON.

To refresh `data/elec.db` itself from the full engineering database, run
`node scripts/make-app-db.mjs` first — see [`data/README.md`](data/README.md).

12 and 10 AWG carry no construction geometry in `low_voltage`, so — exactly as
in the desktop tool — selecting them reports that the cable has no valid
conductor diameter.

## The Cable Tray app

`apps/nec-cable-tray` was authored as a single-file Claude artifact. Two
non-functional changes were made to run it as a standalone Vite app:

- The NEC data tables and the pure calculation engine were moved from `App.jsx`
  into `src/engine.js` so they can be unit-tested from Node without a JSX
  transform. The move is mechanical — no calculation was changed.
- Tailwind was supplied implicitly by the artifact runtime; here it is bundled
  through `@tailwindcss/vite` so the published page needs no CDN at runtime.

## Scope and limitations of the thermal model

- Steady state only; the load factor is fixed at 100%.
- Three touching 1/C cables in trefoil per duct.
- Medium voltage results are marked **PRELIMINARY**: dielectric and shield
  losses are not included.

Support tools only — final sizing must be verified by the responsible engineer.
