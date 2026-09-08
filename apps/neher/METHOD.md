# Neher–McGrath implementation

Primary reference: J. H. Neher and M. H. McGrath, *The Calculation of the Temperature Rise and Load Capability of Cable Systems*, AIEE Transactions, Part III, vol. 76, October 1957, pp. 752–764 (paper 57-660). [User-supplied reproduction](https://pt.scribd.com/document/349164268/neher-mcgrath-1957-pdf), [searchable reproduction](https://www.scribd.com/document/1055540689/Neher-McGrath).

This revision replaces the former requirement to reproduce the WPF implementation. Agreement with the old program was not an independent physical validation. The 1957 thermal circuit is the reference; assumptions needed for the available modern cable/PVC data are explicitly identified below.

## Scope and units

Continuous steady state, LF = 100%, balanced three-phase loading, three identical touching single-core copper cables in trefoil per nonmetallic duct, equal current in every occupied duct. Grid entries are all loaded ducts. Empty rows/columns do not reserve physical space: set the clear duct spacing to define separation. Electrical frequency is 60 Hz in the interface. Dimensions are entered in inches and converted to metres; thermal resistivity in °C·cm/W is divided by 100. Internal heat flow is W/m; thermal resistance is K·m/W.

No cyclic/transient rating, soil drying, nearby external heat source, magnetic duct/armor loss, separate cable circuits with unequal load, or finite sand-trench/native-soil interface is represented. Geometric fit in a duct is not a conduit-fill or pulling/jamming compliance check.

## Thermal circuit and MV losses

Equations 2–9 distinguish the conductor, dielectric and sheath heat sources. For each single-core cable:

- `Wc = I² Rac(Tc)`.
- `Wd = 2π f C (VLL² / 3) tanδ`. C is phase-to-shield capacitance. Entered µF/km is multiplied by `1e-9` to obtain F/m. Tan δ is a fraction, not a percentage.
- `Ws = λs Wc`. The entered total shield factor is referenced to **AC conductor losses**, not DC losses. If a source gives the 1957 factor `Ys` relative to DC losses, convert it to `λs = Ys / (1 + Yc)` before entry.

The manufacturer/project shield factor must include both circulating-current and eddy-current losses for the actual sheath construction, bonding, spacing and design temperature. This implementation accepts the combined factor; it does **not** calculate bonding currents from shield resistance, lead lengths, grounding impedance or cross-bonding sections. Single-point bonding must not automatically imply zero total shield loss. λs and dielectric properties are held constant in the thermal iteration and rating search; their suitability over the operating range must be checked.

Let Ri be insulation thermal resistance, Rb the effective region between insulation and jacket, Rj the jacket, Rad the air gap (per duct), Rd the duct wall, and Eij the external thermal resistance matrix. The conductor temperature is:

```
Qi = 3 (Wci + Wdi + Wsi)
TinnerDuct,i = Ta + Qi Rd,i + Σj Eij Qj
Tsurface,i = TinnerDuct,i + Qi Rad,i
Tc,i = Tsurface,i + (Wci + Wdi + Wsi) Rj
       + (Wci + Wdi) Rb + (Wci + Wdi/2) Ri
```

Consequently dielectric loss crosses half Ri and the entire downstream circuit; shield loss starts outside Ri/Rb. Metallic shield radial thermal resistance is neglected; the effective bedding/screen region is placed inside the shield heat source. The catalog does not resolve individual semiconductor layers. This is an explicit equivalent-layer approximation, not a manufacturer-specific multilayer construction.

All annular layers use `R = ρ ln(Do/Di)/(2π)`. Default resistivities are insulation 350, effective bedding/screens 350 and jacket 600 °C·cm/W; all are editable. Catalog diameters, rather than a second inconsistent jacket-thickness field, define thermal layer boundaries. Verify these dimensions and the equivalent material resistivities against the selected cable datasheet. The catalog has not been replaced with verified manufacturer data.

MV inputs are deliberately blank until supplied. Explicit zero is accepted as an engineering input; absence is rejected. Changing size/voltage clears loss inputs because they belong to the selected construction. MV auto-size is disabled until a catalog with loss data per size exists; automatically carrying one cable's capacitance/λs to another would be incorrect. LV auto-size remains available.

## Conductor AC resistance and air gap

Copper resistance is corrected from 25 °C to conductor temperature with α20 = 0.00393/K. Skin/proximity use the existing rational approximation to the round-conductor factors (implicit ks = kp = 1). These are not the complete construction-dependent Bessel factors/tables of the 1957 paper; segmented, annular or special conductors require different coefficients. No magnetic armor or metal-duct loss is included.

Equation 40 and Table VII use the equivalent diameter **2.15 × cable OD** for three touching cables. The mean air temperature is `(cable surface + inner duct wall)/2`, solved with the thermal network, not `(conductor + ambient soil)/2`.

The chosen 1957 Table VII correlation is **fiber duct in concrete**, A = 17, B = 2.3, C = 0.024. It is used as an engineering approximation for the catalog's PVC ducts in either installation; the paper does not provide modern PVC-specific empirical coefficients. In per-duct SI form:

```
Rad = 17 × 0.3048 / [1 + (2.3 + 0.024 Tmean) Deq,in]
```

The factor of three appears in duct heat Qi and is not multiplied again into Rad. These empirically based assumptions require validation against the actual cable/duct system, especially where the selected duct material differs from the original experiments.

## Sand fill and optional concrete

Sand fill is the default. The external medium is homogeneous with the entered sand/soil resistivity. For source j and target i, the 1957 image-source approximation gives:

```
Eii = ρoutside/(2π) ln(4 Li / Dduct,i)
Eij = ρoutside/(2π) ln(dimage,ij / ddirect,ij), i ≠ j
```

Concrete is a rectangular envelope around the bounding outer surfaces of all ducts. Top, bottom, left and right clearances are independently entered and must be positive. **Top cover is always grade to top of the uppermost duct**, including when concrete is selected. The top concrete clearance subtracts from this cover. The entire concrete envelope and its equivalent cylinder must remain below grade.

Equation 44A at LF = 1 first assumes concrete everywhere, then corrects the exterior to the sand/soil resistivity:

```
Eij = Eij(ρconcrete) + (ρoutside − ρconcrete)/(2π) Gb
Gb = acosh(Lb / rb)
ln rb = 0.5 (x/y) (4/π − x/y) ln[1 + (y/x)²] + ln(x/2)
```

Here x/y are the shorter/longer outer envelope dimensions and Lb is its center depth. Gb and rb follow Appendix II, equations 57–60, expressed with natural logarithms consistently. The common correction is applied to **every source**, so it is multiplied by total bank heat, not just the heat of the target duct. Equal concrete/exterior resistivities reproduce the homogeneous case exactly.

This is the paper's equivalent-envelope approximation, not a two-dimensional finite-element solution. The interface limits the outer aspect ratio to 3:1 and rejects nonpositive calculated transfer resistances. Asymmetric margins determine envelope width, height and center depth; local directional boundary effects are not independently resolved. Highly asymmetric or extreme resistivity-contrast layouts need a more detailed field solution.

## Solution, current and result meaning

The conductor temperatures and local air means are solved together by damped fixed-point iteration; both residuals must be below 0.0001 °C. Limit: 500 iterations. A nonfinite result, thermal runaway or iteration failure is reported as nonconvergent, without displaying the last iterate as a valid temperature.

Bank ampacity is found by bracketed bisection using that same solver until the hottest conductor reaches its limit. A rating must resolve within 0.01 °C of the limit. The allowable current is the common current per phase/cable set in **every loaded duct**; per-cell tooltips display this common bank rating, not independently loadable duct ratings. The highlighted limiting duct is determined at rated current; the hottest operating duct may differ. Excess dielectric heating alone yields zero allowable current.

`I′ = I / parallel sets` is always derived from the current total and integer set count. The displayed rounded I′ is never used as the calculation source. Manual edits to I, Calculate I, motor lookup and set-count changes update I′. Changed inputs invalidate previous thermal results.

## Verification

Run `node --test "tests/**/*.test.js"`. Tests cover the independent closed-form single-duct thermal circuit with nonzero dielectric/shield losses, unit conversions, voltage-squared behavior, distributed dielectric heating, convergence failure, the original Table VII air-gap relation, the Appendix II square-envelope radius, asymmetric clearances, concrete/exterior equality, mutual-source correction, catalog usability and current-update regressions. These analytical checks verify the implemented equations; they are not a field heat-run validation or certification of catalog assumptions.
