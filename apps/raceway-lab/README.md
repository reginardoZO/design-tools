# Conduit Way Lab

Static browser-local NEC 2023 calculation aid for copper power
circuits in aboveground RMC, IMC, EMT and PVC 40/80. Open through the hub card.
No runtime backend, dependencies, or database is added; the existing SQLite
engineering database and TrayLab catalog remain unchanged.

The four-step interface sizes/validates cables, EGC and conduit, with an English
learning guide, traceable calculations, candidate comparison, JSON import/export,
local browser save and printable draft/final-status calculation records.

The first panel offers eight load types: LV/MV direct-online motor, LV/MV VFD
input, heater, transformer, distribution-panel feeder and general load. Only
applicable inputs are displayed. Changing the type clears incompatible load and
protection data. Circuit Arrangement contains parallel runs and physical circuit
configuration, not a generic breaker input. The actual protective-device basis
is entered with the wire EGC and optional protection checks in the installation
step. Without it, load-based conductor sizing remains available, but EGC and
raceway fill are explicitly pending and the design cannot be marked Calculated.

Nominal current, NEC load-based requirement, before-adjustment ampacity,
termination limit, corrected/adjusted ampacity, selected allowable ampacity,
OCPD and EGC basis are shown independently. General LV loads use two checks:
unadjusted insulation/termination capacity covers 125% continuous plus 100%
noncontinuous current; corrected/adjusted capacity covers actual load current.
Conductor protection is checked separately, conservatively without next-size-up.

Projects use JSON version 5; versions 2-4 are migrated. Blank numbers remain
blank. Legacy MV motors without an overload setting remain incomplete; old
neutral designs require the newly collected unbalanced-current input.

- **Cables:** Okonite OSC 2024 copper product data sheets for aboveground
  raceway (`catalog.json`): LV 3:1, 4:1 (C-L-X 3/C), 4:2 (C-L-X 3/C power +
  control, one family per control set) and 4:5 (TC 3/C); MV
  2:3, 2:4, 2:8, 2:11 (1/C) and 2:19, 2:20, 2:21, 2:22, 2:24 (3/C).
- **LV:** <=1000 V ac, Table 310.16, correction and CCC adjustment, termination
  limit. Single-phase two-wire circuits use single conductors; the existing 3/C
  cable workflow remains three-phase. Motor Tables 430.248/430.250 are selected
  by phase and voltage, including 480 V system to 460 V table mapping. Standard
  motors use table FLC; explicit low-speed, high-torque and multispeed categories
  use separate nameplate current under 430.6(A)(1). Other motor duties are blocked.
- **Heater:** current or kW, electrical-input versus thermal-output basis,
  efficiency only for output power, and continuous/noncontinuous operation.
  Fixed process (425.4(B)) and space (424.3(B)) heaters remain continuous even if
  stale noncontinuous data are imported. No 425.22(D) exception is implemented.
- **Transformer:** primary/secondary rated currents from kVA and voltages, full
  capacity or calculated load with a specified continuous portion. Optional LV
  winding-protection checks apply conservative Table 450.3(B) percentages; they
  do not establish conductor protection under 240.4 or 240.21(C). Secondary
  conductor arrangements always require engineering review.
- **Feeder/general load:** 125% continuous plus 100% noncontinuous, without
  unsupported demand factors. Feeder portions accept A or kVA. General loads
  accept A, kW or kVA. Optional full-size neutrals use entered maximum unbalanced
  current, conservatively checked at 125%, with no 220.61 demand reduction;
  nonlinear neutrals count as CCC and require harmonic-current review.
- **MV:** >1000 V through 15 kV, Tables 315.60(C)(7)/(9), isolated conduit in
  air. MV motors use NEC 430.205(A) overload trip current; VFD inputs use
  125% of rated input current. MV general feeders fail closed pending a verified
  Article 235 sizing basis.
- **Feeder continuous-load exception:** available only when the user confirms that the
  complete applicable assembly is listed for 100% continuous operation. A
  100%-rated breaker alone is not sufficient.
- **Raceway:** NEC fill limit by number of items (53/31/40%) and the Chapter 9
  Table 2 conduit bend radius against the cable minimum bending radius.
- **Parallel:** equal sets, one set per conduit; full-circuit EGC in each.
- **LV sharing:** multiple identical circuits; unlike loads are outside scope.

Voltage drop, short-circuit withstand and the installation review checklist are
not part of this tool. Existing sibling cable-tray, underground and voltage-drop
applications are unchanged; these calculations were not integrated into Raceway
Lab and are not replaced by this update.

Regression examples include all requested load cases and rejection of a
conventional 250 A device for 202.58 A continuous load. Calculations retain full
precision: 160 kW thermal output at 95% efficiency gives 202.57904182 A and
253.22380228 A at 125% (displayed 202.58 / 253.22 A). Entering 202.58 A directly
gives 253.225 A, displayed 253.23 A. No intermediate current rounding is applied.

See [SOURCES.md](SOURCES.md) for source provenance, method, exclusions and
review limitations. Portuguese report: [docs/aboveground-raceways-pt.md](../../docs/aboveground-raceways-pt.md).

`Calculated` is completion of the implemented numerical checks, not independent
NEC certification. Printing preserves DRAFT status when checks fail.

Tests: `node --test tests/raceway-lab.test.js`.
