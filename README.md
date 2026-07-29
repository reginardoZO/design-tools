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
apps/<app>/             the six applications
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

- `tests/neher-calc.test.js` pins the Neher-McGrath port to reference values
  produced by compiling and running the original C# `NeherCalc.cs`, and checks
  the data extracted from `elec.db`.
- `tests/nec-cable-tray.test.js` checks the NEC 392.80 derating chain, load
  rules, ambient and adjustment factors, voltage drop and EGC sizing against
  values worked by hand from the code tables.

## Design system

`shared/theme.css` holds the palette and typography every tool uses — the light,
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

One deliberate exception: the MV Panel Load Router keeps its own ten-hue
`PALETTE` array. Those colours identify individual routes and have to stay
visually distinct from each other.

## The Neher-McGrath app

`apps/neher` is a web port of the **Neher** screen of the EleCalc WPF desktop
application (`eleCalc/EleCalc/Neher/`). It covers the two areas that matter for
duct-bank sizing — **Current Calc** and **Neher-McGrath** — side by side. The
calculations are a one-to-one translation:

| Web file | Ported from |
| --- | --- |
| `js/neher-calc.js` | `NeherCalc.cs` (`CalculateThermal`) and the duct-bank geometry in `Neher.xaml.cs` |
| `js/sizing-calc.js` | the Current Calc handlers (`retornaUnidades`, `btnCurrentMain_Click`) |
| `js/app.js` | the remaining `Neher.xaml.cs` event handlers |

The port was verified against the C# original on three duct-bank configurations
(LV single duct, LV 2×3 bank, MV staggered 3×3 bank). All ampacities and
conductor temperatures matched to six decimal places; those values are locked in
by `npm test`.

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
