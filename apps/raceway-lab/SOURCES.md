# Raceway Lab — NEC 2023 basis, provenance and limits

## Implemented model

Three-phase 60 Hz copper power circuits: LV <=1000 V ac and shielded MV >2000 V
through 15 kV, 3 x 1/C or one 3/C cable per set. Each parallel set is in a separate
raceway. Identical LV circuits may share a raceway. The model does not mix different
loads/cable families in a raceway. Ordinary locations only. Aluminum, unshielded MV,
VFD output, 1001–2000 V, DC, engineered grouped MV raceways and underground segments
are outside this implementation. These are scope boundaries, not claims that the
NEC prohibits those arrangements.

## Data provenance

| Data / rule | Source and treatment |
|---|---|
| LV copper ampacity | NEC 2023 Table 310.16; isolated copy of the hub's copper table, crosschecked against Southwire ampacity publications. No tray calculation imported. |
| MV 3 x 1/C copper | NEC 2023 Table 315.60(C)(7). Shielded 2001–5000 / 5001–35000 V columns at 90/105°C, app capped at 15 kV. Visually crosschecked against **Okonite Engineering Handbook 2025 p.37, Table 6-23**. |
| MV 3/C copper | NEC Table 315.60(C)(9); visually crosschecked against **Okonite 2025 p.38, Table 6-24**. Nonshielded columns are not used. |
| Independent MV comparison | Classic Wire PowerGuard ampacity chart identifies NEC 2023 C(7), 40°C ambient. Its MV-105 conduit values match the implemented higher-voltage column. Do not transfer a product-sheet 5/8 kV heading to the wrong table column. |
| Temperature | Explicit 5°C-band entries for 310.15(B)(1)(1) and 315.60(D)(4); no interpolated factors. The lowest tabulated band is used below 10°C; cable installation-temperature rating still requires review. |
| Raceway | NEC Chapter 9 Table 4 areas. Steel IDs crosschecked with Wheatland 2025 brochure pp.3–5. PVC40 reused from the existing tested conduit tool; PVC80 data is a separate Table 4 transcription. Do not derive size from trade name. |
| Cable geometry | Selected Southwire families from `../traylab-southwire/catalog.json`, retaining per-row source URL. Only geometry/construction fields imported. No catalog free-air or underground ampacity becomes a conduit-in-air ampacity. For duplicate family/size rows, the **largest OD** is used. Custom mode verifies one exact construction. |
| Wire EGC | Table 250.122 copper; 250.122(B) proportional upsizing from the smallest supported sufficient-ampacity size at the same number of parallel sets; 250.190(C)(1) >=6 AWG for nonintegral MV EGC. Conservative >=6 AWG also applied to integral MV in this implementation. Separate insulated EGC uses Chapter 9 Table 5 THHN/THWN-2 area. |
| Voltage drop | Table 9 uncoated copper PVC/steel columns: three single conductors, 60 Hz, 75°C, system <=600 V. No interpolation for unlisted sizes. Other constructions and voltages require actual R/X in manual mode. |
| Load | 215.2(A)(1) two checks; single motor 430.6, 430.22 / 430.250; VFD **input** 430.122(A). Engineer-defined MV basis cites Article 235 / 430 as applicable. |

Primary reference URLs (consulted 2026-11-04):

- [NFPA 70 official edition access](https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70) — choose **2023**. The official edition, amendments and AHJ interpretation govern. Public change reports are used to identify edition migration, not as substitutes for adopted text.
- [Okonite Engineering Handbook 2025](https://www.okonite.com/media/catalog/product/files/EHB_2025.pdf) — pp.21, 37–40, electrical/mechanical reference.
- [Southwire cable data](https://cabletechsupport.southwire.com/) — each selected row includes its original product URL.
- [Southwire MC installation guide](https://www.southwire.com/medias/2402-MC-Installation-Guide-WEB.pdf?context=bWFzdGVyfHJvb3R8MjE1NjIyOTl8YXBwbGljYXRpb24vcGRmfGgxMy9oMTkvOTExNzE1NjI3ODMwMi8yNDAyX01DX0luc3RhbGxhdGlvbiBHdWlkZV9XRUIucGRmfDUxNjM4ZTYwMDkxMmFkYTdkYjA5MWJkMDFhYzIwOTcwMWMyZjg1MGU3NmNmYzk3ZmFiMDc1MWMzZmMxZmRiMDY) — independent LV ampacity comparison; old section numbers in supporting publications must not be propagated as 2023 citations.
- [Wheatland EMT and conduit brochure](https://www.wheatland.com/wp-content/uploads/2018/03/EMT-and-Conduit-Brochure.pdf) — revision WEL-041825.
- [Steel Tube Institute, NEC 2023 changes](https://steeltubeinstitute.org/resources/2023-national-electrical-code-nec-changes/) — 3/4-inch rooftop threshold, 33°C adder and XHHW-2 exception; fill and raceway changes.
- [Southwire conduit fill calculator](https://www.southwire.com/calculator-conduit) — fill and jam screening.
- [Classic Wire MV ampacity comparison](https://www.classicwire.com/products/ul-type-mv-105-ampacities-copper-conductors-rated-5-kv-to-35-kv/).

## Calculation and engineering decisions

1. LV feeder: terminal/unadjusted capacity >=125% continuous +100%
   noncontinuous, adjusted conductor capacity >=actual load. For motor/VFD the
   125% requirement is also checked against adjusted capacity.
2. Normal LV feeder OCPD is checked against the governing conductor capacity.
   The next-standard-rating exception of 240.4(B) and 100%-rated assembly
   exceptions are not implemented. Small-conductor limits are enforced for
   ordinary LV feeders, with the motor/VFD branches left to protection review.
3. MV insulation rating and terminal rating are separate. At a 90°C terminal,
   MV-105 does not eliminate the 90°C ampacity ceiling. Cable rated voltage
   selects the table band, not only the circuit operating voltage.
4. Table MV ampacity is valid only for the selected isolated conduit arrangement.
   No arbitrary 310.15(C)(1) multiplier is applied to clustered MV conduits.
5. All EGCs and neutrals count toward physical fill. Three cores inside one
   jacket count as **one** cable for fill. A separate EGC makes two items and
   a 31% NEC limit. No 24-inch-nipple or same-size-wire rounding exception.
6. Automatic sizing searches phase sizes at the **user-selected number of
   parallel sets**, not a cable-cost optimization. It chooses the first catalog
   candidate passing available numerical checks. When MV/multicore impedance
   is missing it retains a clearly blocked ampacity/space proposal; use the
   selected-size button and supply verified R/X to finish verification.
7. Site-specific R/X must never silently carry across a cable/arrangement change.
   The UI clears these values after relevant edits, and resets size-specific
   short-circuit ratings and installation confirmations. Custom impedance is
   rejected in auto mode. Table 9 is an estimate at its stated 75°C basis.
8. Jamming uses 1.05D/d against 2.8–3.2 and checks the three equal phase cables
   even if an EGC is also present. A warning requires recorded pulling review;
   it is manufacturer guidance, not an extra NEC fill percentage. The app does
   not certify physical packing, pulling tension, friction or sidewall pressure.
9. The MV I√t comparison is only a screening against entered manufacturer 1 s
   conductor/shield ratings. Validate applicability, initial/final temperatures,
   actual ground/phase fault duties, timing and current distribution. The app
   accepts positive clearing times through 5 s only; it does not model a full
   short-circuit or protection study.
10. No shield is credited as EGC. No listed metallic raceway is credited instead
    of a wire EGC. Both are deliberate conservative model choices, not blanket
    prohibitions in the NEC. Actual shield-bonding design remains a review item.

## Release status and evidence

The complete licensed NEC text was not independently reviewed line by line in
this implementation. Table data and principal rules were crosschecked using the
primary sources above, existing repository data, and hand-calculated regression
cases. The software must not be described as an independently certified or
exhaustive NEC compliance checker. Installation layout, mechanical design,
protection and equipment listings require the responsible engineer's review.

Run `node --test tests/raceway-lab.test.js`, then `npm test` and `npm run build`.
Browser checks exercise LV/MV examples, stepped forms, review invalidation,
local save/restore, JSON transfer, guide filtering, mobile layout and printing.
