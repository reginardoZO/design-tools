# TrayLab · Cable tray sizing

Static, browser-only tool that finds the cable tray size for a set of
Southwire cables. It is purely geometric/mathematical: cables are assumed to be
sized already, so there is no ampacity, voltage-drop, temperature, cover or
installation-condition input. U.S. units throughout (inches, AWG/kcmil, lb/ft).

## Workflow

1. **Add cable** opens the Southwire catalog. Click a row, set the quantity of
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
  cables above 2,000 V (392.22(C)). Non-tabulated widths use the next smaller
  table row. Where NEC gives no combined rule (single and multiconductor
  cables together, cables above and below 2,000 V together, single conductors
  in a solid-bottom tray) the result says so and the physical layout governs.
- **Physical fit** of the modeled layout: layer items side by side from the
  left wall with edge-to-edge gaps (the larger neighbouring OD governs),
  stacked multiconductor cables shelf-packed in the remaining width, all
  within the usable depth.

D is the outside diameter of one cable. A trefoil is 2D wide and 1.866D high.

## Catalog

`catalog.json` is a dated Southwire CableTech snapshot filtered to copper and
tinned-copper conductors, multiconductor cables up to and including 2/0 AWG
and single conductors in all sizes (1,469 of 2,195 imported records).
`catalog-metadata.json` records the source, families and the filter.
Dimensions are nominal.

## Run and test

From the hub root: `npm run build` then `npm run preview`, and open TrayLab from
the hub. ES modules and the catalog need an HTTP origin, so do not open
`index.html` from the file system.

```sh
node --test tests/traylab-*.test.js
```
