# NEC audit corrections — November 2026

These changes address the ten findings in the review of main commit
`7f94ae2a945564a2a2a161d165ec705be9686694`, plus the trefoil-height error.
The applications continue to target NEC 2023. This is a calculation correction,
not a claim of exhaustive Code compliance.

| Finding | Change | Regression evidence |
| --- | --- | --- |
| F01 | Spaced LV multicore uses the Annex B multicore free-air engineering reference at 40°C, not Table 310.17. The reference is limited to at most three insulated circuit conductors, including a neutral. | 1/0 Cu at 90°C starts at 186 A; at 65°C ambient the rounded factor is 0.71, giving 132.06 A. A 140 A requirement selects 2/0. |
| F02 | Ordinary MV 3/C tray uses 315.60(C)(9), with 100% uncovered / 95% under the specified solid cover. Maintained 1D spacing retains C(5). | 5kV 1/0 at 90°C / 40°C ambient: 165 A uncovered, 156.75 A covered. MV-105 remains capped by its 90°C termination basis. |
| F03 | MV single-conductor eligibility compares circular-mil areas. | All methods/voltage bands start at 1/0 AWG. |
| F04 | Circuit-linked EGC has an explicit separate-tray/integral selection, retained in MCC JSON and printed reports. | 100 A device: #4 separate tray EGC, #8 integral/table-only basis. Separate MV raceway logic retains the #6 floor. |
| F05 | MV DOL motor sizing requires the effective overload trip current under 430.205(A). Motor circuit voltage is separate from the cable table selection. | 100 A motor / 110 A overload trip sizes for 110 A, not 125 A; missing trip or incompatible voltage/phase configuration issues no recommendation. |
| F06 | MCC demand applies the extra 25% of the largest connected motor separately to each conductor. | Reordering the two equal single-phase motors in the audit case always gives 151 A and 2/0 AWG. The balanced four-50HP case remains 276.25 A. |
| F07 | Multicore >=4/0 and MV cables occupy a reserved single-layer lane, shared by fit and drawing. | Small cables in the SPEC 45252 audit example never appear above the 4/0 zone. |
| F08 | Area-based single/multicore mixes add normalized occupancies under 392.80(A)(3). Unsupported width-based or other mixes stay unverified. | The physically fitting 6in mixed tray with 114.3% normalized fill is rejected. Unverified mixes cannot receive a verified size recommendation or a green status. |
| F09 | Voltage-drop recommendations exclude ordinary power parallels below 1/0 and require an integer set count. | The 2×#14 example still has 1.678% mathematical drop, but is not an admissible recommendation; the first eligible parallel size is 1/0. |
| F10 | EGC table lookup instructions require the protective-device rating/setting, removing the conductor-ampacity alternative. | With a 175 A device, the Cu table basis is #6; the 85 A cable ampacity is not a substitute input. |
| G01 | Correct trefoil height to `D × (1 + √3/2)`. | Three touching 1in circles are 1.866in tall. |

## Data and engineering references

- [NFPA CMP-8, NEC 2023 cycle](https://docinfofiles.nfpa.org/files/AboutTheCodes/70/70_A2022_NEC_P08_SD_PCStatements.pdf):
  reproduced sections 392.10, 392.22 and 392.80 distinguish the arrangements.
- [NFPA CMP-6, FR-7968 Annex B](https://docinfofiles.nfpa.org/files/AboutTheCodes/70/70_A2020_NEC_P06_FD_FRStatements.pdf):
  copper 60/75/90°C columns of legacy Table B.310.15(B)(2)(3), 40°C ambient.
  This is the provenance of `LV_MULTI_FREE_AIR`, an engineering reference under
  310.14(B). It is not described as a mandatory single-conductor table or a
  new independent certification of any cable construction. The maintained
  uncovered 1D arrangement, cable type/construction and at most three insulated
  circuit conductors (including a neutral, excluding EGC) must be verified for its use.
- MV ordinary 3/C data reuse the raceway app's independently checked
  `MV_3C` table (315.60(C)(9)); see its `SOURCES.md`, including the Okonite
  Engineering Handbook 2025 p.38 cross-check. The separate free-air table
  remains in place for its own spaced arrangement.
- [NFPA CMP-11, NEC 2023 second revisions](https://www.nfpa.org/api/files?path=%2Ffiles%2FAboutTheCodes%2F70%2F70_A2022_NEC_P11_SD_SRStatements.pdf):
  430.205(A), effective motor-overload setting for an MV motor circuit.

The printed calculation uses the same selected method, motor criterion,
per-conductor MCC result and EGC installation as the screen.

## Explicit scope boundaries

Neher–McGrath labels its successful result **Thermal pass**. Its protective-device
reference mode does not establish a load calculation, continuous-load allowance,
conduit fill, EGC or termination compliance. The incorrect assertion that a
standard 240.6(A) rating already includes the continuous-load allowance was
removed. Its documented MV shield-loss estimate remains an engineering
assumption, not a guaranteed loss bound.

Cable Tray Ampacity continues to leave circuit overcurrent protection to a
separate check; that boundary is now visible with the result. In particular,
small-conductor table ampacities do not waive 240.4(D). Motor/transformer
exceptions and feeder protection remain separate from the EGC's device basis.

For mixed cable-tray fill, normalized **area** rules are combined directly.
When one group's controlling rule is based on linear width, this implementation
does not invent an area conversion; the user must separate the groups into
compartments. Unsupported solid-bottom single-conductor and mixed-voltage cases
also remain unverified, even if the drawing fits.

## Validation

`npm test` runs the existing suite and `tests/nec-audit-regressions.test.js`.
The regression cases use hand-computed reference values, real catalog audit
fixtures, permutations, invalid configurations, and the generated report.
`npm run build` packages all applications. Further changes to a criterion must
update its report and regression expectations together.
