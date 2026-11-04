# Loudspeaker system fundamentals

Type: engineering synthesis. Use source register for provenance and current tools.

## What the starting thread contributes [START]

Define intended use, room, listening distance, output, amplifier, size, tools, and
budget before selecting drivers. A modest two-way is a manageable first original
design. Simulate both bass loading and baffle effects, then prototype. Driver data
traced from catalogue graphs can help exploration but is weaker than measurements
on the final baffle. The target is the resulting acoustic response, including
phase, rather than a textbook electrical filter order. Account for driver, brace,
and vent displacement when moving from a net volume to a cabinet. The thread is
unfinished: the real-crossover section and several subsequent posts remain
placeholders. Its later replies contain anecdotes as well as technical advice;
they are not all verified design rules.

## Working definitions and independent checks

| Quantity | Meaning / check |
| --- | --- |
| Fs | Free-air small-signal driver resonance, Hz; not an absolute lowest usable frequency. |
| Qes, Qms, Qts | Electrical, mechanical, total damping factors; `Qts = Qes*Qms/(Qes+Qms)`. They constrain loading, not a one-number sound-quality ranking. |
| Vas | Air volume with the suspension's compliance. Not the recommended box volume by itself. |
| Sd | Effective radiating area; not frame or cutout area. |
| Xmax | Linear excursion convention must be checked. Convert peak-to-peak to one-way peak by dividing by two. Xmech is a separate mechanical limit. |
| Re vs nominal impedance | Re is DC resistance. AC impedance varies with frequency and loading. |
| Le | Inductance and its measurement frequency/model matter; a single constant cannot reproduce every motor. |
| Sensitivity | Preserve voltage/power, distance, and radiation space. `P=V²/R` only for a resistive approximation. 2.83 V across 4 ohms is approximately 2 W, not 1 W. |
| Vd | One-way displacement capacity `Sd*Xmax`, with consistent units. Does not include thermal limits. |

Internal dimensions are outer dimensions minus relevant walls; multiply in SI and
subtract solid displacement. Distinguish geometrical air volume, an alignment's
equivalent volume, and a stuffed enclosure's frequency-dependent behaviour.

Useful small-signal derivations for a sealed box, under the ideal lumped model:
`Fc=Fs*sqrt(1+Vas/Vb)` and `Qtc=Qts*sqrt(1+Vas/Vb)`.
They do not transfer to a folded TL by replacing `Vb` with its air volume.
Also distinguish a sealed system's `Qtc` from a driver's `Qts`: a familiar 0.707
alignment value is not a universal driver-Qts target or a vented/TL design rule.

## System integration lessons from proven designs

**SR71 [Z-SR71]:** its nominal LR4 acoustic crossover uses lower-order electrical
sections together with the drivers' own response. Zaph documents in-box response,
horizontal/vertical behaviour, reverse-null and distortion checks. The chosen
baffle, crossover and recommended placement are part of the design. Inductor DCR
and mounting can matter; changing the baffle or coil is an engineering change,
not an automatically harmless upgrade.

**Overnight Sensations [C-OS]:** a compact vented system uses about 4.5 L and a
53 Hz vent tuning. The specified vent alternatives differ in length/diameter.
The design combines different electrical filter shapes into approximately LR4
acoustic slopes near 4 kHz. Its tweeter variants have different crossover details.
Takeaway: preserve the complete matched version, including port and crossover.

**Carmody's FAQ [C-FAQ]:** a proven design transfers work on loading, layout,
crossover, phase, tonal balance, and iterative listening/measurement. An
off-the-shelf crossover cannot account for arbitrary drivers and baffles. Building
a reference also develops fabrication skills and a basis for later comparisons.
Treat simplified alignment-selection advice as an introduction; Qts alone does
not establish suitability for a particular TL.

## Design decisions agents should reason through

- More bass extension, smaller size, and greater efficiency compete. Compare at
  the required SPL and distortion, not just the lowest point on a graph.
- Acoustic outputs add as complex pressures. Driver spacing, relative delay,
  polarity, and listening angle determine reinforcement/cancellation.
- Smooth on-axis response alone is insufficient. Examine horizontal and vertical
  coverage, especially through crossover, and the actual listening window.
- Passive filters see real complex driver loads. DSP still requires acoustic
  measurements, appropriate slopes, delay, level matching, and excursion control.
- A thermal watt rating does not establish deep-bass output. Check excursion,
  compression, amplifier current, and behaviour below tuning separately.
- Construction and service access are part of the design: leaks, vibrating panels,
  obstructed vents, and inaccessible filters can defeat a sound alignment.

## Do not generalize

Do not promise that expensive drivers, a named cone material, a TL, brass hardware,
or an attractive 3D model produces better sound. Evaluate claims with controlled
comparisons. Mechanical metal near an inductor can change its inductance; that
does not establish every anecdotal claim about screws elsewhere in a circuit.
