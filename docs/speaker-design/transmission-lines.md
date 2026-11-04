# Transmission-line reasoning

## Physical model [MJK-A]

A TL uses distributed air mass/compliance and an opening's radiation load.
The driver and line form a coupled system. Its impedance peaks are not simply
the unloaded pipe modes: coupling can split the low-frequency resonances.
Near the minimum between the first two impedance peaks, cone motion can be low
while terminus output supplies much of the radiation. That is not evidence of
zero stored energy or an inherently superior transient response.

`L=c/(4*f)` is a useful first estimate for a uniform lossless closed/open pipe.
Taper and end loading change the tuning. At a common tuning, a contracting line
can be shorter and an expanding line longer than that estimate.

## Area, tuning, and comparison [MJK-21]

For a linearly varying section, integrating area gives
`V = L*(S0+SL)/2`. With `r=SL/S0`, algebra gives
`S0=2*V/[L*(1+r)]`, `SL=r*S0`.
These equations conserve volume; they do not independently determine tuning.

King's 2021 method starts from a suitable vented alignment's volume and tuning,
then finds a TL geometry with corresponding low-frequency loading. A fair TL/
reflex comparison controls those quantities, driver, drive level, and losses.
His comparisons do not support a universal claim that TLs deliver deeper bass
in a smaller equivalent enclosure. Damping can suppress ripple while also
reducing output. Larger terminus area can reduce air velocity; that is not a
guarantee of inaudible turbulence at every drive level.

## Driver offset [MJK-O]

The driver sees an upstream closed stub and downstream open line in parallel.
Its displacement supplies both branches according to their acoustic impedances.
An offset can reduce excitation of selected higher modes. Approximately one-third
of a straight line's length is a useful starting location for reducing the
three-quarter-wave contribution; it is not a universal optimum for every tapered
or folded geometry. Moving the driver primarily changes excitation of modes,
rather than just changing an effective pipe length. Recompute from the actual
geometry and evaluate the combined cone/terminus pressure.

## Independent uniform-pipe derivation

With a rigid closed end at `x=0` and ideal pressure-release end at `x=L`, the
boundary conditions are `dp/dx(0)=0`, `p(L)=0`. A solution is
`p_n(x)=A*cos(k_n*x)`, `k_n*L=(2*n+1)*pi/2`.
Thus `f_n=(2*n+1)*c/(4*L)`. This explains the odd sequence in this ideal special
case. The pressure and particle-velocity patterns differ spatially. A pressure
antinode is not automatically a region of maximum oscillating particle velocity.

## Terminology

| Type | Practical distinction |
| --- | --- |
| Classic TL | One distributed line, potentially straight, contracting or expanding, with an open terminus. |
| TQWT / Voigt pipe | Usually an expanding quarter-wave structure; naming varies. Read the actual area profile and termination. |
| MLTL | Distributed line plus a restrictive mass-loading vent. Port dimensions matter independently of line length. |
| Rear-loaded horn | Driver rear output couples to an expanding acoustic transformer; may also exhibit quarter-wave behaviour. Not every folded passage is a TL. |

## Model selection and failure modes [APP]

Use ÆGIR 1D for a valid dominant route and its sampled physical areas. It uses
phenomenological attenuation, constant real wave speed, an approximate opening
load, and co-located half-space summation. It cannot translate grams of polyester
or foam thickness into calibrated losses. Do not tune its damping slider until a
plot looks like the publication and call that validation.

Use 3D for depth folds, finite rectangular openings, spatial interference, or
non-planar paths. Inspect source fit, solid barriers, grid resolution, captured
duration, PML, and recording quality. A finite pulse animation is not a converged
low-frequency transfer function. Two grids are a numerical sensitivity check,
not physical validation.

Never infer the acoustic route from a drawn line alone. Check for bypasses,
unsealed partition edges, blocked turns, magnet obstruction and real opening
dimensions. A fold's convenient centreline is only one approximation to the
actual three-dimensional field.
