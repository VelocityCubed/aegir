# Measurement and acceptance procedure

Status: proposed work. No physical measurements have been made in this project.

## Preserve interpretable data [V-M, V-F]

Keep raw individual driver responses, impedance, near-field measurements, merged
responses, drawings, and exported results separate. Store microphone calibration,
distance, voltage, axis, timing method, environment, and processing. A crossover
simulator can calculate directional and load behaviour only from appropriate
inputs; an attractive axial plot cannot supply missing angular data.
VituixCAD provides diffraction, merging, crossover and polar analysis; its
published enclosure-feature list does not provide a TL solver.

## Proposed prototype sequence: our acceptance plan

For sound-card impedance work, calibrate the jig and measure a known resistor
before the driver. REW notes that swapped input channels cause a systematic
error related to the sense resistance. Added-mass/known-volume T/S work needs
controlled inputs and suitable driver support; follow the selected method's
instructions rather than combining measurements from incompatible setups [REW].

1. Verify delivered driver identity and mechanical dimensions before cutting.
   Measure resistance and consistent T/S parameters. Keep catalogue and measured
   sets separate; record suspension conditioning and measurement temperature.
2. Build one serviceable cabinet. Check the divider seal, openings, braces,
   driver clearance and gaskets. Record empty-cabinet dimensions and photographs.
3. Measure low-level input impedance in free air and in the empty enclosure.
   Check for expected changes, unexpected leaks, and unexplained resonances.
4. Measure cone and terminus near-field responses with a retained phase/timing
   reference. Record area and microphone distance. Scale and combine complex
   pressures with the correct radiation polarity; never add dB curves directly.
5. Repeat after weighed, documented stuffing placement. Compare empty-to-stuffed
   changes before fitting any loss coefficient. Keep the terminus unobstructed.
6. Measure each driver in the final baffle on a common coordinate/time reference,
   with suitable far-field gating and an overlapping near-field merge. Preserve
   absolute relative delay, or model geometry consistently if minimum phase is
   reconstructed. Do not independently reset every driver's delay to zero.
7. Check the published crossover's acoustic slopes, summed response, reverse
   polarity behaviour, horizontal/vertical coverage, impedance and phase.
8. Increase level cautiously and measure excursion-related distortion,
   compression, air noise and panel vibration. Define the actual usable SPL
   envelope; a low-level frequency response does not establish it.
9. Evaluate in the intended room and listening window. Placement/EQ may address
   room effects. Do not redesign the speaker around one narrow room null.

## Numerical checks before comparisons [APP]

Record solver/version, project hash/revision, excitation, temperature, loss model,
grid, run duration and boundaries. Match sources, voltages and acoustic spaces.
Compare impedance, cone motion, cone pressure, terminus pressure and phase before
declaring agreement from a summed SPL plot. Distinguish an unloaded cavity mode,
a coupled-system impedance peak, tuning, and a graph's chosen F3 definition.

A mesh sensitivity result, external simulator agreement, published measurement
agreement, and a measured local prototype are four distinct milestones. Record
which has actually happened. Never mark an unchecked milestone complete.
