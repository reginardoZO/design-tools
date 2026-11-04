# Raceway Lab

Static browser-local NEC 2023 calculation aid for three-phase copper power
circuits in aboveground RMC, IMC, EMT and PVC 40/80. Open through the hub card.
No runtime backend, dependencies, or database is added; the existing SQLite
engineering database and TrayLab catalog remain unchanged.

The four-step interface sizes/validates cables, EGC and conduit, with an English
learning guide, traceable calculations, candidate comparison, JSON import/export,
local browser save and printable draft/final-status calculation records.

The user enters only the load current; the 125% load rule, the NEC fill limit,
cable geometry, integral grounding conductors and bending radii are derived.

- **Cables:** Okonite OSC 2024 copper product data sheets for aboveground
  raceway (`catalog.json`): LV 3:1, 4:1 (C-L-X 3/C), 4:2 (C-L-X 3/C power +
  control, one family per control set) and 4:5 (TC 3/C); MV
  2:3, 2:4, 2:8, 2:11 (1/C) and 2:19, 2:20, 2:21, 2:22, 2:24 (3/C).
- **LV:** <=1000 V ac, Table 310.16, correction and CCC adjustment, terminal
  limit, feeder/single-motor/VFD-input rules.
- **MV:** >2000 V through 15 kV, Tables 315.60(C)(7)/(9), isolated conduit in
  air. Feeder, motor FLC or VFD input current at 125%.
- **Raceway:** NEC fill limit by number of items (53/31/40%) and the Chapter 9
  Table 2 conduit bend radius against the cable minimum bending radius.
- **Parallel:** equal sets, one set per conduit; full-circuit EGC in each.
- **LV sharing:** multiple identical circuits; unlike loads are outside scope.

Voltage drop, short-circuit withstand and the installation review checklist are
not part of this tool.

See [SOURCES.md](SOURCES.md) for source provenance, method, exclusions and
review limitations. Portuguese report: [docs/aboveground-raceways-pt.md](../../docs/aboveground-raceways-pt.md).

`Calculated` is completion of the implemented numerical checks, not independent
NEC certification. Printing preserves DRAFT status when checks fail.

Tests: `node --test tests/raceway-lab.test.js`.
