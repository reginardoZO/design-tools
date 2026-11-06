# TrayLab · Cable tray sizing

Static, browser-only tool that finds the cable tray size for a set of
Southwire cables. It is purely geometric/mathematical: cables are assumed to be
sized already, so there is no ampacity, voltage-drop, temperature, cover or
installation-condition input. U.S. units throughout (inches, AWG/kcmil, lb/ft).

## Workflow

1. **Add cable** opens the Southwire catalog. Filter by SPEC family,
   application, voltage or conductor count, click a row, set the quantity of
   physical cables and the compartment, then **Add to tray**. The window stays
   open so several cable types can be added. Clicking a cable size opens its
   Southwire PDF data sheet.
2. Set the tray width, usable depth, type (ladder, ventilated trough, solid
   bottom), divider thickness and an optional spare reserve. The cover option
   only draws a cover.
3. Add dividers (or drag them on the drawing) and name each compartment.
4. Choose the arrangement in each compartment:
   - Multiconductor: random fill (stacked), single layer touching, single
     layer with 1D spacing.
   - Single conductor: trefoil (touching, 1D or 2.15D between groups) or flat
     (touching or 1D). Trefoils take three cables each; leftovers are laid
     individually.
5. **Suggest tray size** returns the smallest standard width (6–48 in) at the
   current depth, then at deeper standard depths (3–6 in), keeping
   compartment proportions and arrangements.
6. **Issue report** prints the configuration on screen (U.S. Letter
   landscape). **Clear** resets the tray.

## Calculation

Each compartment is checked in two independent ways, both reduced by the
spare reserve:

- **NEC 2023 392.22 fill** from catalog outside diameters: multiconductor area
  tables or sum of diameters (392.22(A)), single conductors (392.22(B)) and
  cables above 2,000 V (392.22(C)). Published table values are used exactly at
  tabulated widths. Intermediate clear widths use linear engineering
  interpolation between the adjacent table rows, with that basis identified
  in the sizing check and printed report. Widths below 2 in have no table
  result; widths above 36 in remain capped at the 36 in row (no extrapolation).
  Where NEC gives no combined rule (single and multiconductor
  cables together, cables above and below 2,000 V together, single conductors
  in a solid-bottom tray) the result says so and the physical layout governs.
- **Physical fit** of the modeled layout: layer items side by side from the
  left wall with edge-to-edge gaps (the larger neighbouring OD governs),
  stacked multiconductor cables shelf-packed in the remaining width, all
  within the usable depth.

D is the outside diameter of one cable. A trefoil is 2D wide and 1.866D high.

### Intermediate compartment widths

NEC Tables 392.22(A) and 392.22(B)(1) publish discrete widths. They do not
expressly instruct the user to interpolate. TrayLab treats an intermediate
clear width as an engineering calculation between adjacent table values,
rather than reporting the next smaller row as the compartment's capacity.
This preserves all published values and still subtracts the physical divider
thickness. It does not round a compartment up to a nominal tray width.

For example, a 24 in ladder tray with a 0.125 in divider centered at 12 in
has 11.9375 in clear compartments. For multiconductor cables smaller than
4/0 AWG, interpolation of Table 392.22(A), Column 1, between 9 in (10.5 in²)
and 12 in (14 in²) gives:

`10.5 + (11.9375 - 9) / (12 - 9) × (14 - 10.5) = 13.927083 in²`.

In this interval the result is also `clear width × 7/6`. The
[Eaton Cable Tray Manual](https://www.eaton.com/content/dam/eaton/products/support-systems/cable-management/ct-manual.pdf),
MAN-23 and MAN-44, explains the area/width relationship and the inverse
method `required width = cable area × 6/7` for this cable class. Its manual
is based on NEC 2014; the table values were cross-checked against the
[NFPA 2023-cycle CMP-8 record](https://docinfofiles.nfpa.org/files/AboutTheCodes/70/70_A2022_NEC_P08_FD_PIResponses.pdf),
Table 392.22(A). The interpolation is TrayLab's engineering treatment, not
an additional NEC provision. The same bounded interpolation is used for
the other area columns, retaining their published rounding and mixed-size
deductions. Diameter/single-layer rules are unchanged.

The reported 21-cable example (stocks 480590 × 11, 480616 × 1, 480608 × 4,
480657 × 2, 480624 × 3; ODs 0.688, 0.815, 0.783, 1.304, 0.982 in) uses
11.480298 in²: 82.0% in an undivided 12 in ladder tray and 82.4% in the
11.9375 in clear compartment, with zero spare reserve. The old next-smaller
row policy returned 109.3% for that compartment. Both physical fit and the
area check must pass; solid-bottom trays use their smaller area column.

## Catalog

`catalog.json` is a dated Southwire CableTech snapshot filtered to copper and
tinned-copper conductors, multiconductor cables up to and including 2/0 AWG
and single conductors in all sizes. SPEC 45252 (3/C XHHW-2 TC-ER, 600/1000 V)
is loaded in full, 8 AWG to 750 kcmil (24 items), from its current data sheet
(revision 1.000.012,
[PDF](https://cabletechsupport.southwire.com/en/cablespec/download_spec/?spec=45252&country=US)).
1,484 items in all. In the **Add cable** window the SPEC selector picks one
family; families loaded in full are listed first.
`catalog-metadata.json` records the source, families and the filter.
Dimensions are nominal.

## Run and test

From the hub root: `npm run build` then `npm run preview`, and open TrayLab from
the hub. ES modules and the catalog need an HTTP origin, so do not open
`index.html` from the file system.

```sh
node --test tests/traylab-*.test.js
```
