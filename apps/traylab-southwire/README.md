# TrayLab · Southwire

Cable tray layout and installation-method screening against an explicit NEC 2023 ruleset. This application was imported from `traylab-nec2023-reviewed-complete-source`, replacing the previous hub implementation. It has no build step, package dependencies, server database or ampacity calculation. Projects remain in the browser until exported.

Use U.S. English, inches, AWG/kcmil and lb/ft throughout. Design ambient is entered in °F. NEC conductor-temperature columns retain their °C designation with °F equivalents.

## Run locally

From the hub repository root, build and preview the complete site:

```sh
npm run build
npm run preview
```

Open TrayLab from the hub card at `apps/traylab-southwire/index.html`.
Do not open `index.html` directly: ES modules and the catalog require an HTTP
origin. The hub copies this folder to `dist/apps/traylab-southwire/` and
provides the shared theme and favicon. Relative links support GitHub Pages
project subpaths. The hub adaptation changes presentation and navigation,
not the supplied calculation, arrangement, compliance or project modules.

## Workflow

1. Set tray dimensions, type, cover construction/continuous length, ambient and installation location. Confirm industrial conditions when required. Enter actual divider geometry and verify barrier continuity/materials.
2. Add catalog cables as draft circuit rows. Non-VFD phase cables at 4/0 AWG and larger use three actual 1/C cables per run in touching trefoil. VFD products remain complete multiconductor cables. Choose 1D or 2.15D trefoil clearance, and touching or 1D VFD clearance, independently in each compartment.
3. Use **Review basis** for each circuit. Record its function, verified cable-marking voltage and insulation temperature, the external calculation method, conductor counts where applicable, document/revision and responsible engineer. Read the displayed table, ambient basis and applicable tray percentages.
4. Resolve all design-check items. A physical fit is separate from NEC fill. A fill/geometry pass is not an installation release.
5. Complete **Installation review** against the final adopted NEC 2023 text, manufacturer documents and the external project calculations. Unsupported conditions cannot be overridden with a confirmation.
6. **Issue report** and **Issue CSV** become available only when the current model passes all implemented checks and its review records match the configuration. JSON, draft CSV and draft printouts remain available for work in progress, visibly marked **DRAFT — NOT FOR CONSTRUCTION**.

Changes to the configuration invalidate a basis recorded for a different configuration. This includes cables, quantity, compartment dimensions, gaps, cover, ambient, circuit function and installation declarations. A previous report's status is never accepted instead of recalculating the current checks. The records are local engineering declarations, not authenticated signatures or an approval-management system.

## Key ampacity distinction

For LV touching trefoils, the 2.15D route in 392.80(A)(2)(d) refers to **Table 310.20, messenger-supported conductors**, with a **40°C / 104°F** ambient basis. It does not mean unadjusted Table 310.17. The external calculation must apply the appropriate temperature correction and terminal constraints.

Changing the gap to 1D blocks a retained messenger method. An applicable reduced ordinary-tray method may instead be declared and checked. A 1D gap between trefoils is not a 1D gap between individual conductors. Multiconductor/VFD methods remain distinct.

No allowable current, ampacity correction, circuit sizing, protection coordination or voltage drop is calculated by this application. The application checks the declared installation prerequisites and records the external sizing basis.

## Supported scope and release limitations

The supported fill branches include LV multiconductor ladder/ventilated/solid trays, declared control-only multiconductor compartments, LV single conductors in ladder/ventilated trays and the implemented Type MV/MC diameter rule. A conservative packing check independently validates the modeled physical arrangement.

The following remain blocked for issue, rather than receiving an assumed compliance result:

- Separate-EGC combined fill; mixed single/multiconductor fill within one compartment; mixed above/below-2,000 V rating bands within one compartment; LV singles in solid-bottom trays.
- Spaced ampacity claims when another divider compartment is occupied. Divider thickness/voltage segregation does not establish the unmodeled thermal interaction. This conservative application limitation is not a claim that the NEC prohibits all divided-tray arrangements.
- Short, ventilated or unspecified covers; unknown cable markings/listing/construction; missing design or review evidence.
- Hazardous/classified locations, PV, emergency systems, fire alarm, communications, Class 2/3 and other special circuit rules not implemented here. Hoistways and severe physical-damage locations are explicitly prohibited uses.
- Single-conductor phase configurations other than the modeled three-phase, three-wire sets; unsupported temperature tables, table sizes or construction assumptions. Never omit a real neutral or EGC to bypass a block.

The MV method screen uses a deliberately bounded subset: 1/0–4/0 AWG, 250, 350, 500, 750 and 1,000 kcmil, up to 35 kV, with explicit verification of the selected table's construction/temperature conditions. Other potentially permissible configurations require an implemented and tested extension.

Read `NEC-NOTES.md` and `AUDIT-2023.md` for rules, findings, source limitations and test evidence. The application is not NFPA certification or a guarantee of all-NEC compliance. Corporate deployment requires the responsible engineering authority's validation against the licensed final adopted code and company standards.

## Existing files

Old cable snapshots and quantities are retained. Former built-in Portuguese labels are migrated to English; user-authored names remain unchanged. Former metric-display projects already stored inch geometry, so migration does not rescale dimensions. Old automatically checked industrial/barrier declarations are reset for explicit verification. Existing incompatible arrangements are editable drafts, with issue blocked.

## Verification

Node.js is required only to run the tests:

```sh
node --check apps/traylab-southwire/app.js
node --test tests/traylab-*.test.js
```

The compliance suite covers 45 named scenarios, including 80 deterministic physical-packing comparisons, in addition to the existing fill, project and trefoil tests. Browser QA exercises the real catalog insertion, external basis dialog, release gate, 2.15D-to-1D invalidation and restored-basis workflow. Test engineering records are explicitly labeled QA-only and are not shipped as approved project data.

## Catalog and maintenance

The included catalog has 2,195 items from 167 imported Southwire families. `catalog-metadata.json` records scope, exclusions and provenance. It is a dated snapshot, not a claim of all commercial products. A family's advertised maximum voltage is not proof of the voltage marking of every stock; verified marking is a separate mandatory input.

Catalog refresh scripts remain in the original source package, outside this
static deployment. They require Python and lxml, plus permitted access to Southwire:

```sh
python data-work/collect.py
python data-work/extend_catalog.py
python data-work/parse.py
```

Collectors reuse fetched HTML caches. The hub includes the runnable application,
catalog, pure calculation modules, regression tests and engineering documentation;
hosting metadata, collection caches and QA project data are not deployed.
External manufacturer/code links and shared web fonts require internet access;
the included application and catalog run locally, with system font fallbacks.
