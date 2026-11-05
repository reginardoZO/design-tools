# Conduit Way Lab — NEC 2023 basis, provenance and limits

## Implemented model

Three-phase 60 Hz copper power circuits in **aboveground** raceways: LV <=1000 V ac
and MV >1000 V through 15 kV, 3 x 1/C or one 3/C cable per set. Every cable comes
from the Okonite OSC 2024 catalog; there is no custom cable construction. Each
parallel set is in a separate raceway. Identical LV circuits may share a raceway.
The model does not mix different loads/cable families in a raceway. Ordinary
locations only. Aluminum, VFD output, unverified MV general-feeder sizing, DC,
engineered grouped MV raceways, underground/direct-buried segments, voltage drop
and short-circuit withstand are outside this implementation. These are scope boundaries, not claims
that the NEC prohibits those arrangements.

Inputs depend on circuit type: continuous/noncontinuous load, applicable LV motor
FLC, MV motor overload trip setting, or VFD rated input current. The required
conductor ampacity, the NEC fill limit, cable minimum bending radius and conduit
bending radius are derived; the breaker rating and EGC sizing protective-device
setting remain separate from the MV motor overload trip setting.

## Data provenance

| Data / rule | Source and treatment |
|---|---|
| Cable geometry | `catalog.json`, 215 copper rows transcribed from **Okonite Product Catalog OSC 2024** (`C:\Temp\Okinite\OSC_2024.pdf`) and visually checked against the rendered sheets. Each row keeps spec, sheet, PDF page, catalog number, OD, core OD (3/C MV), integral grounds, voltage/insulation-level ratings and maximum temperature. Only geometry/construction fields are used; no catalog ampacity is used. |
| Okonite families | LV: 3:1 Okoguard-Okolon TS-CPE RHH/RHW-2/USE-2 1/C (p.56); 4:1 C-L-X MC-HL XHHW-2 3/C with grounds (p.60); 4:2 C-L-X MC XHHW-2 composite 3/C power + control, split into 4:2/3x14, 4:2/4x14, 4:2/3x12 and 4:2/4x12 by control set (#12–#2 power; bare #10/#8 ground only where published, 4×12 rows; control conductors not counted as CCC, consistent with Okonite's unchanged 3/C power ampacity) (p.64); 4:5 Okonite-FMR Okoseal TC/TC-ER XHHW-2 3/C, with and without ground (p.67). MV Okoguard: 2:3 / 2:4 (5/8 kV 1/C, pp.10–12); 2:8 Okoseal and 2:11 Okolon TS-CPE (15 kV 1/C, split into 100% and 133% rows, pp.14, 18); 2:19, 2:20 (3/C shielded with ground, 2:20 split 100/133%, pp.26–28); 2:21 C-L-X 2.4 kV nonshielded MV-90 (p.30); 2:22 C-L-X 5/8 kV (#8 row 5 kV 133% only, p.32); 2:24 C-L-X 15 kV 133% (p.34). 4/C power rows (4:1, 4:2 and TC with neutral) and 2:11 1250/1500 kcmil are not imported. |
| LV copper ampacity | NEC 2023 Table 310.16, isolated copy of the hub's copper table. |
| MV 3 x 1/C copper | NEC 2023 Table 315.60(C)(7), 2001–5000 / 5001–35000 V columns at 90/105°C, capped at 15 kV. Crosschecked against **Okonite Engineering Handbook 2025 p.37, Table 6-23**. |
| MV 3/C copper | NEC Table 315.60(C)(9); crosschecked against **Okonite 2025 p.38, Table 6-24**. The 2:21 nonshielded 2.4 kV cable uses the 2001–5000 V column; confirm with Okonite/AHJ. |
| Temperature | Explicit 5°C-band entries for 310.15(B)(1)(1) and 315.60(D)(4); no interpolated factors. |
| Raceway area | NEC Chapter 9 Table 4. Steel IDs crosschecked with Wheatland 2025 brochure pp.3–5. |
| Conduit bending radius | NEC Chapter 9 Table 2, "Other bends" column (1/2 in = 4 in through 6 in = 36 in). |
| Cable bending radius | Shielded MV 1/C: 12 x OD. Shielded MV 3/C: max(12 x individual core, 7 x overall OD), core = assembled core OD / (1 + 2/√3). Nonshielded C-L-X: 7 x OD (330.24(B)). Other nonshielded LV: 4 / 5 / 6 x OD for OD <=1.0 / 1.0–2.0 / >2.0 in (336.24 for 3/C TC; ICEA S-95-658 / NEMA WC 70 guidance for 1/C). |
| Wire EGC | Table 250.122 copper; 250.122(B) proportional upsizing using circular-mil area from the smallest size that passes ampacity **and exists in the selected family**; 250.190(C)(1) >=6 AWG for nonintegral MV EGC. Integral catalog grounds pass when their total area (all sectioned grounds) covers the required EGC. Separate insulated EGC uses Chapter 9 Table 5 THHN/THWN-2 area. |
| Motor full-load current | NEC 2023 Table 430.250 horsepower and rated-voltage columns. LV motor FLC is selected from the table; no user-entered current is accepted for this load rule. |
| Load | General LV feeder/branch: 210.19(A)(1) / 215.2(A)(1), 125% continuous + noncontinuous; the 100%-continuous exception requires affirmation that the complete applicable assembly is listed for 100% operation. LV motor: 430.6(A)(1), 430.22 and Table 430.250, 125% of applicable table FLC. MV motor: 430.205(A), overload trip setting with no automatic 125% FLC multiplier. VFD input: 430.122(A) LV / 430.205(B) MV, 125% of rated input. MV general feeders fail closed pending a separately verified Article 235 basis. |

Primary reference URLs:

- [NFPA 70 official edition access](https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70) — choose **2023**. The official edition, amendments and AHJ interpretation govern.
- [Okonite](https://www.okonite.com/) — Product Catalog OSC 2024 (cable data) and Engineering Handbook 2025 pp.21, 37–40.
- [Wheatland EMT and conduit brochure](https://www.wheatland.com/wp-content/uploads/2018/03/EMT-and-Conduit-Brochure.pdf) — revision WEL-041825.
- [Steel Tube Institute, NEC 2023 changes](https://steeltubeinstitute.org/resources/2023-national-electrical-code-nec-changes/) — 3/4-inch rooftop threshold, 33°C adder and XHHW-2 exception.
- [Classic Wire MV ampacity comparison](https://www.classicwire.com/products/ul-type-mv-105-ampacities-copper-conductors-rated-5-kv-to-35-kv/).

## Calculation and engineering decisions

1. LV feeder: terminal/unadjusted capacity >=125% continuous +100%
   noncontinuous, adjusted conductor capacity >=actual load. For motor/VFD and
   all MV loads the 125% requirement is also checked against adjusted capacity.
2. Normal LV feeder OCPD is checked against the governing conductor capacity.
   The next-standard-rating exception of 240.4(B) and 100%-rated assembly
   exceptions are not implemented.
3. MV insulation rating and terminal rating are separate. At a 90°C terminal,
   MV-105 does not eliminate the 90°C ampacity ceiling. Cable rated voltage
   selects the table band. A 105°C basis is blocked for MV-90 families (2:21).
   The catalog 100%/133% rating at the selected cable voltage must cover the
   selected insulation level.
4. Table MV ampacity is valid only for the selected isolated conduit arrangement.
   No arbitrary multiplier is applied to clustered MV conduits.
5. Fill uses the NEC Chapter 9 Table 1 limit for the number of physical items:
   53% (1), 31% (2), 40% (3+). There is no user fill target. All EGCs and
   neutrals count. One 3/C cable with integral grounds is one item; a separate
   EGC makes two items and a 31% limit.
6. The conduit passes only when its Table 2 radius is >= the cable minimum
   bending radius. Automatic sizing picks the smallest conduit that passes fill
   and bending radius and is outside the jam band; a manual conduit below the
   radius is blocked.
7. Automatic sizing searches phase sizes at the **user-selected number of
   parallel sets**, limited to sizes offered by the family. Where a family has
   duplicate rows for a size, the row matching the EGC mode (integral or
   separate) and then the largest OD is used.
8. Jamming uses 1.05D/d against 2.8–3.2 for three 1/C phase cables. It is a
   review item (manufacturer guidance), not an extra NEC fill percentage. The app
   does not certify pulling tension or sidewall pressure.
9. No shield or C-L-X sheath is credited as EGC. No listed metallic raceway is
   credited instead of a wire EGC. Both are deliberate conservative choices.

## Release status and evidence

The complete licensed NEC text was not independently reviewed line by line in
this implementation. The software must not be described as an independently
certified or exhaustive NEC compliance checker. Installation layout, mechanical
design, protection and equipment listings require the responsible engineer's
review.

Run `node --test tests/raceway-lab.test.js`, then `npm test` and `npm run build`.
