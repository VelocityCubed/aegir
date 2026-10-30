# Solver, geometry and scoring definitions

SI units in the acoustic solver; millimetres for CAD, litres for displayed volume. Project input stores Fs in Hz, Vas in L, Sd in cm², Le in mH and linear Xmax as **one-way peak mm**. Excursion and air velocity outputs are peak. Drive voltage is RMS; SPL is RMS dB re 20 µPa at 1 m.

## Linear driver

At temperature T Celsius:

```text
c = 331.3 + 0.606 T                     [m/s]
rho = 1.2041 × 293.15/(273.15+T)        [kg/m³, approximate fixed-pressure dry air]
ws = 2 pi Fs
Cms = Vas / (rho c² Sd²)
Mms = 1 / (ws² Cms)
Rms = ws Mms / Qms
Bl² = ws Mms Re / Qes
Ze = Re + j omega Le
Ma_face = Sd² Im(Zrad(Fs,Sd)) / ws
Ra_face = Sd² Re(Zrad(Fs,Sd))
Mmd = Mms - 2 Ma_face
Rmd = Rms - 2 Ra_face
Zm = Rmd + j(omega Mmd - 1/(omega Cms))
```

These form a simplified small-signal equivalent circuit. Mms and Qms are treated as measured free-air effective parameters including radiation from both cone faces. Before replacing the rear radiation load with the line, subtract the two faces' approximate radiation mass and their resistance at Fs. Reattaching both free-air radiation impedances then recovers the input Fs and mechanical Q at resonance without double counting air loading. Inputs implying non-positive Mmd or Rmd are rejected as inconsistent with this approximation. Manufacturer conventions and radiation approximations still require measurement-based verification.

## Acoustic transmission line

For a section of length ell and uniform area S:

```text
Zc = rho c / S
alpha(f) = damping_at_100Hz × sqrt(f/100)
gamma = alpha + j omega/c
A = D = cosh(gamma ell)
B = Zc sinh(gamma ell)
C = sinh(gamma ell)/Zc
[p_in, U_in]ᵀ = [[A,B],[C,D]] [p_out,U_out]ᵀ
```

The real, frequency-dependent attenuation with real characteristic impedance is phenomenological. It is not a porous-material thermoviscous model. It neither specifies stuffing density nor slows sound speed.

At driver distance x from the closed end, the upstream closed stub has impedance `Zstub=A/C`. The downstream radiation-terminated line has `Zdown=(A Zrad+B)/(C Zrad+D)`. Their parallel combination is the rear acoustic impedance `Zrear`.

Low-ka baffled equal-area circular-piston radiation approximation:

```text
a = sqrt(S/pi), ka = omega a / c
Zrad = rho c/S × [(ka)²/2 + j 8ka/(3pi)]
```

This is an asymptotic expression. The same model is used for front radiation with cone area and termination radiation with line area. It is less accurate for rectangular mouths, unflanged openings, finite baffles and ka approaching/exceeding 1. Charts still display the full sweep for exploration; the inspector gives the ka=1 frequency and an approximate `c/(2 max(laneWidth, depth))` straight-duct transverse-mode cutoff. Work well below both; these are bounds, not accuracy guarantees at the boundaries.

Solve mechanical velocity and current:

```text
Zloaded = Zm + Sd² (Zrear + Zfront)
v = Bl V / (Ze Zloaded + Bl²)
I = (V - Bl v)/Ze
Zinput = V/I
Urear = Sd v                    [magnitude/sign convention into rear line]
Udown = Urear Zstub/(Zstub+Zdown)
Uterm = Udown/(C Zrad + D)
p_1m = j rho omega/(2 pi) × (Sd v - Uterm)
```

The rear polarity is inverted when it radiates out of the mouth. Coherent subtraction matters; adding SPL magnitudes would miss interference. Ideal half-space, co-located radiation is assumed, so physical mouth/cone separation and directional interference are not predicted. The 3D cabinet is not a solved FEM field.

```text
SPL = 20 log10(|p_1m| / 20e-6)
excursion_peak_mm = sqrt(2) |v| / omega × 1000
mouth_velocity_peak = sqrt(2) |Uterm| / S
group_delay_ms = -d(unwrap(arg p))/d omega × 1000
```

Group delay uses centred finite differences with one-sided endpoints and is noisy near deep nulls. The sweep has 240 log-spaced frequencies from 15–800 Hz plus exact target edges and geometric midpoint (150 base frequencies during search). Including brief frequencies prevents an empty target band for a narrow brief.

Band mean is the arithmetic mean of dB SPL samples in the target band; ripple is their maximum minus minimum. F3 is the **last upward crossing of bandMean−3 dB below the geometric midpoint of the target band**, interpolated on log frequency. No crossing returns a dash; it is not a universal bass-extension metric for a multi-resonant line. Peak metrics in the inspector use the target band, with the full sweep peaks separately noted.

The pressure probe reconstructs closed-stub and downstream pressure profiles using the transfer matrices, enforces pressure continuity at the injection point, then normalises the maximum to one. It is pressure magnitude at a selected frequency, not absolute SPL, particle displacement or time-domain propagation. Moving 3D dots only illustrate the centreline direction.

## Physical enclosure

Uniform rectangular lanes are side by side, with width w and depth `S/w`, separated by thickness t boards. Each turn has w of clear height. There are N passes. For clear cabinet height H, the rectilinear centreline includes every vertical section and each horizontal turn:

```text
L_mm = N H + (N-1)t
H = (L_mm - (N-1)t)/N
internal_width = N w + (N-1)t
outer_width = internal_width + 2t
outer_height = H + 2t
outer_depth = S/w + 2t
divider_height = H-w
```

The closed end starts at the top of the first lane; the mouth ends at the top of the last lane for even N, or bottom for odd N. End caps stop before that lane. Driver injection is in lane one. Fit checks cover hole edge clearance, frame boundaries, first-turn overlap, magnet/back clearance and positive fold dimensions.

Front/back overlap the sides. Caps and dividers sit between them. The exact clear cavity is computed by subtracting divider board volume from the internal box; for this geometry it also equals `S L`. This does not account for magnet/basket, bracing or stuffing displacement. Square turns are geometrically correct but acoustically idealised; local field changes are not represented in the uniform-line transfer model.

Individual STL panels are triangulated extruded profiles with a polygonal circular hole (128 segments). They are checked for closed edge incidence and approximate analytic material volume. STEP uses exact circles. The reference STL is multiple touching shells, not a boolean-unioned monolithic manufacturing solid. DXF circles are exact and SVG has explicit mm dimensions.

## Search score

Length, area ratio, lane width, pass count and driver position vary. Driver parameters, material thickness, loss and voltage remain fixed. 1,000 seeded candidates consist of broad exploration followed by local perturbations around leading designs. A valid starting design inside the brief is included. Similar results are deduplicated and up to six are returned.

Hard rejection: invalid driver fit/folds, length outside brief, outer width/height/depth outside brief. Excursion and velocity limits are **soft penalties**, so a candidate can exceed them and the inspector still warns.

```text
score = 2 × band_RMS_dB_deviation
      + 0.35 × band_ripple_dB
      + 2 × max(0, band_mean - low_edge_mean - 3)
      + 12 × max(0, band_peak_excursion/Xmax - 1)
      + 8 × max(0, band_peak_mouth_velocity/target_velocity - 1)
      + 0.012 × clear_volume_L
      - 0.025 × band_mean_SPL
```

Low-edge mean uses the first eighth of the band samples (at least two). The weights encode one practical trade-off, are not universal psychoacoustic preferences and are not a promise of a global optimum. Results retain the input project used for that search; editing the brief marks old results as belonging to the previous brief.


## Custom geometry and coupled sources (0.3.0)

Custom baffles are straight XY boards extruded through cavity depth. Their finite-thickness polygons are clipped at cavity walls. The mouth removes a physical portion of one outer side/cap. Driver through-holes are placed on front/back from their fraction along the explicit route. A route crossing a board, leaving the cavity, missing the mouth or starting off a closed wall is invalid. Board overlap, obstructed mouths, driver frame/cutout overlap, opposing magnet-volume collision and short physical bypasses are checked. The clearance-weighted A* tracer derives a route through the actual air space; it does not change cabinet boards. These are screening checks, not a proof that an arbitrary cavity is an acoustically unbranched, leak-tight duct.

Cross-sections are sampled along the route using rays perpendicular to the local tangent. Nearest wall/board intersections define clear width; clear depth gives section area. Uniform samples are supplemented around every polyline vertex so a short bend cannot disappear between samples. The transfer matrix over each small interval uses midpoint-interpolated area/loss and the equations above. Their product gives the matrix between source junctions. It is a piecewise-uniform approximation to a variable-area duct, with ideal pressure/volume-velocity continuity. It does not solve bend scattering or a two/three-dimensional sound field.

For a reciprocal two-port matrix between pressure nodes i and j, outward flows are:

```text
U_i = (D p_i - p_j) / B
U_j = (-p_i + A p_j) / B
```

Stamp these admittances into a complex nodal system. The closed end has zero external flow; the mouth adds radiation admittance. Each driver's injection flow is Sd_i v_i, and each mechanical/electrical row is:

```text
Sd_i p_node + (Zm_i + Sd_i² Zfront_i + Bl_i² / Ze_i) v_i = Bl_i V_i / Ze_i
V_i = V_base × voltageScale_i × exp(j phase_i)
I_i = (V_i - Bl_i v_i) / Ze_i
p_1m = j rho omega/(2 pi) × (sum(Sd_i v_i) - U_mouth)
```

All drivers share the solved line pressures, so a source changes the loading of every other source. Each retains its own T/S model, electrical current, impedance and excursion. The primary project driver mirrors the primary/first explicit mount; other mounts carry independent driver copies. For equal excitations, the main impedance trace is common V divided by summed I (parallel connection). With different phases/scales, it reports the first driven source's V/I and labels that convention; it is not an aggregate amplifier rating. Front/back mounting changes physical geometry but radiation remains an ideal co-located half-space sum, so separated or opposed sources require external spatial validation.

The pressure probe reconstructs pressures from the solved network matrices, including all injection junctions, then normalises the maximum to one. Search excursion penalties compare each driver's target-band excursion with its own Xmax. Hard route-length constraints use actual geometry length, not the dormant generated `design.length` field. Searches with explicit parameter ranges are deterministic; `retrace` optionally derives the route for each changed cavity. Invalid candidate geometry is rejected, and acceptance still requires measurements.

Preview, STL, SCAD and STEP use the same exact clipped footprint polygons. Angled panel local meshes use the inverse world transform; CAD rotation order is X then Y then Z (Three.js Euler ZYX). DXF/SVG remain rectangular stock-face profiles for those boards; end mitres/bevels are described by the 3D solids and panel notes. A manifest is mandatory for custom STEP export, preventing a Python backend from silently regenerating a different fixed-pass cabinet.
