# NEC 2023 rule mapping and deliberate limits

Ruleset: `2023.2026-10-26.1`. This document describes the implemented scope. It is not a reproduction of the NEC and is not a claim that every NEC article or exception has been automated.

## Distinct decisions

`nec.js` computes applicable fill and validates basic cable/tray conditions. `arrangement.js` checks physical geometry and the project trefoil policy. `compliance.js` matches the externally selected sizing method, checks project-wide prerequisites and blocks report issue for every unresolved or unsupported result. No allowable current is calculated.

A report can be issued only after all automated checks pass and the responsible engineer records the external sizing and installation review for the current configuration. A checkbox never overrides an incompatible method or an unsupported fill/thermal rule. A draft remains recoverable and editable.

## Fill

| Condition | Implemented reference / treatment |
| --- | --- |
| LV multiconductor, ladder or ventilated trough | 392.22(A)(1)(a)–(c): conductor-size branches, individual cable OD/area, mixed-size deduction |
| LV multiconductor, solid bottom | 392.22(A)(3)(a)–(c), including the 90% all-large-cable width limit |
| Exclusively declared control/signal multicables | 392.22(A)(2)/(4): 50% or 40%; calculation depth capped at 6 in; actual circuit function required |
| LV single conductors, ladder / ventilated trough | 392.22(B)(1)(a)–(d): 1/0–4/0 diameter branch, 250–900 area branch, >=1,000 diameter branch and mixed-size deduction |
| Type MV / MC rated above 2,000 V | 392.22(C): individual-diameter sum and one layer of cables/groups |
| Separate EGC | Minimum-size reference corrected to 392.10(B)(1)(c); combined fill remains outside issue scope |

Tables use the next smaller listed width for non-tabulated clear widths. Widths above 36 in retain the 36 in area allowance. These are conservative application policies, not NEC interpolation requirements. Divider thickness is deducted. Dividers require material/continuity confirmation before separate-zone release.

The fill test counts every physical cable. A trefoil envelope does not replace three individual cable diameters when the relevant NEC branch requires their sum. Standard packing is an explicit conservative shelf arrangement, not an optimization proof. Failure means this modeled layout has not been demonstrated. The full-count packing check is independent of the SVG preview cap.

## External installation-method matrix

| Declared method | Governing clause | Basis that must have been used externally |
| --- | --- | --- |
| LV trefoil, 2.15D, uncovered | 392.80(A)(2)(d) | Table 310.20, messenger-supported conductors; 40°C / 104°F base ambient |
| LV individual singles, 1D, uncovered one layer | 392.80(A)(2)(c) | Table 310.17; 30°C / 86°F base ambient |
| LV ordinary singles / trefoils | 392.80(A)(2)(a)/(b) | Table 310.17 with applicable tray percentage and temperature correction |
| LV multiconductor / VFD | 392.80(A)(1)(a)/(b) | Table 310.16; adjustment for CCC within each cable, as applicable |
| LV multiconductor / VFD, 1D, uncovered one layer | 392.80(A)(1)(c), 310.14(B) | Documented engineering determination; reference construction has not more than three insulated conductors; Annex B is informational |
| MV grouped, 2.15D, uncovered | 392.80(B)(2)(3) | Tables 315.60(C)(1)/(2) |
| MV individual singles, 1D, uncovered one layer | 392.80(B)(2)(2) | Tables 315.60(C)(3)/(4) |
| MV ordinary singles / groups | 392.80(B)(2)(1) | C(3)/(4), with applicable tray percentage |
| MV multiconductor / VFD | 392.80(B)(1) | C(9)/(10), with applicable cover limitation |
| MV multiconductor / VFD, 1D, uncovered | 392.80(B)(1)(2) | C(5)/(6) |

LV ordinary singles use 65% for 1/0–500 kcmil and 75% for >=600 kcmil when uncovered; the explicit long solid-cover branches use 60% and 70%. MV ordinary singles use 75% or 70%. Multiconductor long solid-cover branches use a 95% limitation. These percentages are displayed as external calculation requirements, not calculated ampacities. The cover threshold is strictly greater than 72 in continuously with a solid unventilated cover. Other covers remain outside the verified workflow.

Temperature columns and actual cable insulation ratings must be compatible. Table 310.20 supports its listed entries through 1,000 kcmil and 75°C/90°C columns; an oversized cable does not acquire an entry because its geometry fits. High-temperature Tables 310.18/310.19 are not implemented. MV entries are conservatively limited to the subset documented in the README, with table construction and temperature verification required. All actual cable rating, table construction, shielding, neutral/CCC treatment, ambient correction and termination limits require external design evidence.

## Trefoil and VFD project policy

The mandatory >=4/0 AWG trefoil threshold is a user project requirement, not a universal NEC mandate. Each phase run contains three actual 1/C cables. VFD products remain complete multiconductor cables; the VFD exception cannot be assigned to a single conductor. Separate EGCs remain distinct.

For equal OD D, touching trefoil width is 2D and height is `(1 + sqrt(3)/2)D`. N groups require `2ND + (N-1)kD`, with k = 1 or 2.15. Gaps are edge-to-edge. Unequal adjacent items use the larger OD and the higher spacing multiplier. No group is split to fit. A 1D inter-group gap is not an individually spaced 1D installation. The cross section shows the minimum envelope; even distribution and securing along the actual route require engineering verification.

The drawing does not establish free-air eligibility across dividers. Spaced methods with more than one occupied compartment are blocked as an application limitation. Voltage segregation does not substitute for thermal assessment. Ordinary reduced methods can be screened in verified divided compartments when all other checks pass.

## Additional blocking checks

Unknown tray suitability/type; actual marked voltage vs operating voltage; industrial conditions for single-conductor and Type MV use; required <=9 in ladder rung spacing for 1/0–4/0 singles; operating-voltage segregation at 1,000 V using 392.20(B) and its Type MC exception; declaration of actual circuit function; forbidden hoistway/severe-damage use; unsupported special systems and locations; missing external calculation or engineering review; stale configuration records; invalid imported booleans/quantities/geometry.

The application does not inspect a physical installation or independently verify the contents of an external calculation document. Structural support/load, grounding/bonding, bend radii, firestopping, accessibility, environment, grouping/parallel sets, EMC, protection and the entire route are recorded as mandatory external engineering checks.

## Sources and verification boundary

- NFPA official Article 392 public development record, PDF pages 134–149: https://docinfofiles.nfpa.org/files/AboutTheCodes/70/70_A2022_NEC_P08_SD_PCStatements.pdf
- NFPA CMP-8 agenda containing 2023 base text, PDF pages 424–432: https://docinfofiles.nfpa.org/files/AboutTheCodes/70/70_A2025_NEC_P08_FD_MeetingAgenda_0124.pdf
- NFPA CMP-6 record containing the ampacity tables and notes, including Table 310.20 at PDF pages 41–42: https://docinfofiles.nfpa.org/files/AboutTheCodes/70/70_A2022_NEC_P06_SD_SRStatements.pdf
- Eaton manufacturer manual, corroborating geometry/percentages; 2014 numbering is not used as the 2023 authority: https://www.eaton.com/content/dam/eaton/products/support-systems/cable-management/ct-manual.pdf
- Southwire family/stock marking ambiguity: https://cabletechsupport.southwire.com/en/tile/1/spec/45002/?country=US and https://cabletechsupport.southwire.com/en/tile/1/spec/45252/?country=US
- Final adopted NFPA 70 remains controlling: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70

NFPA public development records contain proposed changes alongside base text. This audit is not an independent line-by-line verification of the licensed final NEC 2023 or all local amendments. The responsible engineering authority must validate that final basis before adopting the tool as a company standard. Unsupported cases remain blocked rather than silently credited.
