---
kind: agent-tool-research
reviewed: 2026-11-04
scope: Hornresp-and-SigmaStudio-accuracy-opportunities
status: research-only; no cross-simulator or physical acceptance
---

# Hornresp and SigmaStudio: accuracy research

Read [numerical-validation-2026-11-04.md](numerical-validation-2026-11-04.md)
before quoting current ÆGIR residuals. This note identifies independent checks and
possible model extensions. No Hornresp or SigmaStudio prediction has yet been
compared numerically with ÆGIR, and no physical prototype has been measured.

## What was inspected

REA 6.8.0 ran in a temporary directory with Node 22.23.4 and a provider-owned
Chromium 156 profile. The retained captures are in
`../../research/rea-hornresp-sigmastudio-2026/`:

| Capture | REA evidence ID | Observation |
| --- | --- | --- |
| `hornresp-capture.json` | `ev_862a0dedff88fbce7f0ff1cb765521b39e7cf192c69483da35458c60b2c70e96` | `hornresp.net` returns a frameset loading `hardware-test.de/mcbean/`. Both HTTP requests returned 200. |
| `hornresp-host-capture.json` | `ev_54de0dc2aa49e519cb6a1fac2b5960fe81d4792dde0669cd7904653f3a766388` | David McBean's page calls Hornresp a direct-radiator and horn-loaded loudspeaker simulator and links a Windows installer, product number 6060-261010. |
| `sigmastudio-capture.json` | `ev_4b37c773ab811879d3a372c907e192d798b80af6e58173c57e4eb4fb1fe5196b` | ADI's site returned an Access Denied page in this browser. It yielded no SigmaStudio application behavior or algorithms. |

That Access Denied result applied to REA's separate Chromium profile; the
official SigmaStudio download subsequently completed in Edge.

## Downloaded binary inspection (2026-11-04)

The [Hornresp author's download](http://www.hardware-test.de/mcbean/) is a
3,594,246-byte `Setup.exe` (SHA-256
`f99aa3612426bdce26a33be92ad4be73e456edb8c695d6607516fd4365e2ddcd`).
Its embedded archive was extracted without running it. The included `Readme.txt`
identifies **Hornresp 60.60**; the actual `Hornresp.exe` is 14,192,640 bytes,
SHA-256 `7d0c1433bd672229b9f0c46ec110d9175afc62f2068a163a4c15ebd6ca1faee5`.
REA inspected that executable, not just the installer:

| REA operation | Evidence ID | Direct observation |
| --- | --- | --- |
| `inspect-artifact` | `ev_2d229d2655df7a685a728b4ab300f1d92167ed38368a55e82335557b4a4077c7` | Actual application PE identified. |
| `inspect-desktop-application` | `ev_e2abc2fcba94eb73a92fd0396887e39e99020ab657a9714218ce708d34232aa0` | Extracted application folder inventoried. |
| `inspect-pe-imports` | `ev_f1bbbd441aaeb0800d7e5583b0435145745ec366c4f01f9af1284d2a72b8e02b` | 32-bit PE; one imported library, `MSVBVM60.DLL`, with 189 functions, consistent with Visual Basic 6. |
| `inspect-pe-resources` | `ev_4c321042576d387b41e65fa7007bcbe90647ccf4d4c58ea1120971b66713e516` | Three PE resource entries. |
| `inspect` with Ghidra 12.1.4 | `ev_a46bfc0bc4f452c9a31f1b49146a94b01dafba9c9f1c2f4cdb06ebfdf821c84a` | Native analysis inventory: 3,208 procedures and 6,751 defined strings across five segments. |

Ghidra's default analysis needed a longer startup limit than REA's default
330 seconds. The completed overview is an inventory, not a verified recovery
of Hornresp's acoustic equations. No acoustic function was identified and
decompiled to a defensible formula.

The [official ADI download](https://www.analog.com/en/resources/evaluation-hardware-and-software/embedded-development-software/ss_sigst_02.html)
provided `adi_sigmastudio-rel4.7-x64.exe`, 48,548,272 bytes, SHA-256
`4339e886e5b6dab1774df85d9b3939f49e432ef6619fe35f7d480a0fa0208032`.
Windows reports a valid Analog Devices signature and version 4.7. REA's
`inspect-artifact` (`ev_40caac1864e35d9202e17ac80edbe1345c5004e07bbc07450152f6f2ef2c966b`)
and `inspect-managed-artifact` (`ev_4a80ca42d43fc276c01cdbf828d7c19270fdea228e62de89377067b2b0b53bcb`)
show the installer is a **native** 32-bit PE, not the managed application. Its
payload was obtained using InstallShield's [documented `/a` administrative
extraction](https://docs.revenera.com/installshield/helplibrary/IHelpSetup_EXECmdLine.htm)
into a temporary directory. The MSI log records `ACTION = ADMIN`; no product
files were found in Program Files or the uninstall registry afterward. The
extraction yielded 180 files, including the real `SStudio.exe`, filter DLLs,
sample projects and sample speaker-response text files. No application was run.
The user also supplied `C:\tempInstall\Program Files 64\Analog Devices\SigmaStudio 4.7`.
Its `SStudio.exe`, `AutoFilterDesigner.dll`, and `ZoltzerFilter.dll` hashes
exactly match the extracted copies. REA separately inspected `SStudio.exe`
at that supplied path (`ev_ad897d92f75485c8ad13daf799e929b3d73bad71283679192a1fb12df1c478e3`).

REA's `inspect-managed-artifact` identified these **extracted application** files
as managed .NET assemblies, with PE/CLI metadata available:

| File | REA evidence ID | Metadata counts |
| --- | --- | --- |
| `SStudio.exe` | `ev_b5f9ea97271e9520427b72e97b2d9667ac3a974d22793bfbe090a7214b457c21` | 249 types, 3,378 methods. |
| `AutoFilterDesigner.dll` | `ev_70d740c43085263311e3c33f8ffa0d3af6d2ac56e4f4b8713aa9938ddf4f5cff` | 147 types, 2,233 methods. |
| `ZoltzerFilter.dll` | `ev_154a087ac74e648c50ec8257058bbeacf8d8c4c7fbf7e8a1bd92f655ef0736c5` | 33 types, 277 methods. |
| `Peregrine.dll` | `ev_212bf0161c0f87f027dee6568204ce562bdb8f37aeaff182e6fef663cce5bc33` | 242 types, 3,424 methods. |
| `DataLib.dll` | `ev_b138de9365a9b393d103b96f993d1df98046674165de01d9e373a8dcae37ab42` | 118 types, 1,406 methods. |
| `FixIntLib.dll` | `ev_43f0a74b3f7b1c699fe88fc016634111b5c43a6146398bab37867384099f9159` | 64 types, 816 methods. |

REA `inspect-managed-members` on `AutoFilterDesigner.dll`
(`ev_9b2ad806c46861b71568012eb3e06d095d389777bd30e652c10e6fc4f4f2749a`)
found method names/signatures/CIL anchors for `AutoEQ.GetXoverCoeffs`,
`GetFilter`, `freqz`, `PhaseCorrection.tf2sos`/`zp2sos`,
`ImpulseResponse.ApplyHannWindow`/`ProcessImpulseResponse`, and
`BandDesign.generateComplexFilterResponse`. The assembly also has named
`FreqResponse`, `TargetResponse`, `XOver`, and `PhaseAlignment` types.
These are **implementation surfaces**, not proof of a particular algorithm or
its numerical accuracy. REA has not established their formulas, coefficients,
or output behavior. The bundled speaker text files declare frequency, dB and
phase columns, but their measurement provenance is unknown; do not treat them
as measured specifications or validation data.
The REA output for the actual Hornresp executable, the user-supplied SigmaStudio
`SStudio.exe`, and the full `AutoFilterDesigner.dll` member inventory is retained
under `../../research/rea-hornresp-sigmastudio-2026/`. No vendor executable or
DLL was added to the repository.

## Hornresp

The [current author page](http://www.hardware-test.de/mcbean/) establishes the
download location. An [archived copy of the author's Hornresp help](https://pearl-hifi.com/06_Lit_Archive/14_Books_Tech_Papers/Kolbrek_Bjorn/Horn_Response_Manual.pdf)
describes theoretical acoustical impedance, SPL, electrical impedance, diaphragm
displacement, phase and group delay versus frequency. It supports selectable
free/half/quarter/eighth-space radiation, driver and chamber inputs, segmented
horn profiles, and offset/tapped/back-loaded arrangements. The help describes
CSV/tab-delimited chart export, including SPL and impedance magnitude/phase.
The help is historical; its segment count and option details have not been
verified against the 2026 executable.

Strings in the extracted 60.60 executable include `Transmission Line...`,
`Rectangular Horn`, `Wavefront Simulator`, `Passive Radiator`, `Power
Compression...`, `Export Horn Data`, and `SPL + Phase...`. This confirms those
labels occur in the current binary. It does not establish how each operation
works or whether its results agree with ÆGIR. The transmission-line and export
labels make an actual numerical comparison worth pursuing.

The useful first comparison is an **empty, straight, constant-area line** using
the existing King 2006 generic-driver project. Match line length/area, driver
parameters and Mmd versus Mms convention, drive voltage and output resistance,
rear loading, radiation angle, temperature/sound speed, and result units before
comparing impedance magnitude/phase, cone displacement, and individual/combined
acoustic output. Export the actual Hornresp numerical curves rather than reading
pixels. Record the exact Hornresp build and input file. Test empty before adding
lining because differing loss laws would obscure a geometry/driver discrepancy.
Then try an offset/contracting-line case as a separate topology test; a folded
cabinet's centreline profile is only an acoustic approximation.

The historical Hornresp help describes an axisymmetric system and rigid
plane-piston driver, with a warning about multi-segment throat-impedance
accuracy when its normalized mouth-circumference condition grows. The current
binary also has a `Rectangular Horn` label; the historical caveat cannot be
applied to that mode without current documentation or behavior checks.
Agreement would support only
the matched small-signal 1D case. It cannot settle ÆGIR's finite rectangular
mouth, cabinet folds, transverse modes, measured stuffing transport properties,
or physical speaker accuracy. Keep the existing King comparison, independent
Python reference, and mesh-refinement evidence distinct from this new simulator
comparison.

## SigmaStudio

ADI describes [SigmaStudio](https://www.analog.com/en/resources/evaluation-hardware-and-software/embedded-development-software/ss_sigst_02.html)
as a graphical programming/tuning environment for SigmaDSP and supported SHARC
devices. Its filter library includes [two/three-way crossovers](https://wiki.analog.com/resources/tools-software/sigmastudio/toolbox/filters/crossover)
with Linkwitz-Riley, Butterworth and Bessel choices and cascaded biquads.
[General second-order filters](https://wiki.analog.com/resources/tools-software/sigmastudio/toolbox/filters/general2ndorder)
cover EQ, shelving, all-pass, notch and direct IIR coefficients. The documented
transfer-function denominator uses `1 + a1 z^-1 + a2 z^-2`; parameter RAM stores
inverted feedback coefficients, a sign convention to check during export/import.
[Stimulus and Probe](https://wiki.analog.com/resources/tools-software/sigmastudio/tutorials/probeandstimulusblocks)
show simulated linear filter response, but the documented probe excludes some
blocks. [Automatic Speaker EQ](https://wiki.analog.com/resources/tools-software/sigmastudio/toolbox/adialgorithms/automaticspeakereq)
uses measured/target overlays and phase, polarity, gain and delay alignment.

ÆGIR's current `activeTransfer` is a continuous-time first/second-order
Butterworth cascade. It has no sample-rate-dependent digital biquad,
coefficient quantization, FIR, explicit delay, or DSP headroom model. These are
possible accuracy gains **only when predicting an actual DSP signal chain**;
they do not make the passive crossover or enclosure solver more accurate.
If a target DSP is selected, represent sample rate, ordered filter coefficients,
gain/polarity and per-channel delay explicitly. Compare complex transfer
functions and summed mounted-driver response with the same timing reference.
ADI's [filter guidance](https://wiki.analog.com/resources/tools-software/sigmastudio/toolbox/filters)
recommends double precision for low-frequency/high-Q use, while its
[numeric-format documentation](https://wiki.analog.com/resources/tools-software/sigmastudio/usingsigmastudio/numericformats)
describes device-dependent fixed-point coefficients and clipping. Do not assign
one generic quantization error to all SigmaDSP devices.

## Decision and acceptance order

1. Reproduce one empty 1D line in Hornresp and ÆGIR with matched declared inputs;
   retain exported complex numerical curves and per-frequency residuals. This
   is the clearest independent test of low-frequency driver/line/radiation coupling.
2. Add a distinct digital-signal-chain model only for a specified DSP target and
   measured mounted drivers. Validate analytic biquad magnitude/phase first,
   then compare SigmaStudio's reported or exported coefficients and response.
3. Continue 3D mesh convergence and physical impedance/near-field measurements.
   Cross-simulator agreement alone cannot promote the current study to a
   validated complete loudspeaker.
