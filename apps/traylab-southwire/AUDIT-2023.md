# NEC 2023 application audit — October 27, 2026

This release corrects identified false passes and introduces a fail-closed report boundary. The audit covers source code, referenced Article 392 rules, method compatibility, persistence, exports and browser behavior. It does not certify universal NEC compliance.

## Findings and disposition

| Finding | Correction |
| --- | --- |
| Standard packing always reported geometry pass | Full-count compressed packing checks width/depth independently of area fill and the SVG display limit |
| Missing industrial declaration / rung spacing could pass | Explicit industrial confirmation; positive rung spacing <=9 in where applicable |
| MV rating accepted without Type MV/MC identity | Construction identity required; MV industrial conditions checked |
| EGC minimum-size citation used welding subsection | Corrected to 392.10(B)(1)(c); combined EGC fill remains blocked as unsupported |
| Spacing messages omitted the actual table | Per-circuit method and source clause, messenger/free-air distinction, table ambient basis and applicable percentage displayed |
| Changing spacing could retain an old ampacity assumption | Basis and installation-review records tied to the current configuration; incompatibility and stale records block issue |
| Generic covered checkbox lacked thermal meaning | Cover construction and continuous length added; explicit >72 in threshold; unsupported cover conditions blocked |
| VFD spacing could be confused with individual phase spacing | Whole multiconductor construction, CCC and insulated-conductor counts checked separately |
| A family maximum rating could be mistaken for every stock's rating | Actual marked voltage and insulation rating required, independently of the catalog family ceiling |
| Divider geometry could be mistaken for thermal eligibility | Verified physical barriers required; unmodeled divided-tray spaced thermal claims explicitly blocked |
| Control-only switch could apply to power circuits | Per-circuit function required and cross-checked with compartment declaration |
| Report/CSV could be issued with unresolved conditions | Shared issue gate; draft outputs visibly labeled; ordinary browser printing defaults to draft |
| Imported string booleans could act as truthy declarations | Strict input validation and a second validation boundary at assessment/issue |
| Old default confirmations could look like actual review | Legacy industrial/barrier confirmations reset; data and quantities preserved |
| Review had no traceable basis | Engineer, external calculation/revision and installation-review reference recorded; no checkbox override of known conflicts |

## Regression evidence

The original fill, project and arrangement suites remain in place. In this hub,
[`traylab-compliance.test.js`](../../tests/traylab-compliance.test.js) contains
the source package's 45 named compliance scenarios, with 80 deterministic
comparisons between compressed packing and full schematic placement.

Key test vectors:

- Two D=1 in trefoils: 6.15 in physical width at 2.15D, 5 in at 1D; individual diameter sum remains 6 in.
- Two catalog 350 kcmil trefoils, D=0.861 in: 5.29515 in at 2.15D and 4.305 in at 1D. Changing the gap blocks a retained Table 310.20 declaration.
- Three multicables D=1 in, 2 in ×1.5 in compartment: area fill passes 2.356/2.5 in², but physical packing fails. Overall issue is blocked.
- Continuous solid unventilated cover at 72 in does not trigger the explicit >72 in branch; unsupported short-cover thermal treatment remains blocked. At 72.001 in, the long-cover branch applies.
- 500/600 kcmil ordinary singles: displayed external tray requirements 65/75% uncovered and 60/70% qualifying covered.
- 2,000 kcmil cannot claim a nonexistent Table 310.20 entry.
- LV VFD touching cannot claim the 1D engineering route; a 1D route with an unsupported insulated-conductor count remains blocked even if CCC=3.
- 2,000 small cables can pass full geometry while only 1,400 are rendered; display omission alone is not treated as a physical failure.
- Changing geometry, quantities, ambient, cable data or installation conditions invalidates mismatched basis/review records.
- Invalid booleans and malformed review fields are rejected on import and at issue.

Browser QA uses disposable projects labeled **QA ONLY**. It exercises catalog insertion, the required external-method dialog, Table 310.20 explanations, report enablement with a complete supported fixture, immediate blocking after 2.15D→1D, and persistent state. A VFD fixture also verifies that the 1D engineering route rejects more than three insulated conductors, while the ordinary Table 310.16 route can record its basis without releasing unresolved installation conditions. These fixtures are software test data, not approved engineering designs.

## Corporate acceptance boundary

The automated scope is deliberately narrower than every possible NEC-compliant installation. See the explicit blocked categories in README.md. The public NFPA source records are not a substitute for the licensed final adopted code. Before company-wide adoption, the responsible engineering authority must compare the rule matrix with its adopted NEC 2023 text, local amendments, manufacturer requirements and company standards, and approve representative acceptance designs. The application requires that project review to be recorded; it cannot perform the physical or documentary engineering review itself.
