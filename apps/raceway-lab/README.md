# Raceway Lab

Static browser-local NEC 2023 calculation aid for three-phase copper power
circuits in aboveground RMC, IMC, EMT and PVC 40/80. Open through the hub card.
No runtime backend, dependencies, or database is added; the existing SQLite
engineering database and TrayLab catalog remain unchanged.

The four-step interface sizes/validates cables, EGC and conduit, with an English
learning guide, traceable calculations, candidate comparison, JSON import/export,
local browser save and printable draft/final-status calculation records.

- **LV:** <=1000 V ac, Table 310.16, correction and CCC adjustment, terminal
  limit, feeder/single-motor/VFD-input rules. Table 9 voltage drop only <=600 V
  and single-conductor construction; other cases require actual R/X.
- **MV:** >2000 V through 15 kV, shielded copper, Tables 315.60(C)(7)/(9),
  isolated conduit in air. Enter required design current and actual impedance.
  Auto mode can propose an ampacity/space size, but completing MV verification
  requires selecting that size and entering verified R/X.
- **Parallel:** equal sets, one set per conduit; full-circuit EGC in each.
- **LV sharing:** multiple identical circuits; unlike loads are outside scope.

See [SOURCES.md](SOURCES.md) for source provenance, method, exclusions and
review limitations. Portuguese report: [docs/aboveground-raceways-pt.md](../../docs/aboveground-raceways-pt.md).

`Calculated` is completion of the implemented checks and entered confirmations,
not independent NEC certification. Printing preserves incomplete/DRAFT status.

Tests: `node --test tests/raceway-lab.test.js`.
