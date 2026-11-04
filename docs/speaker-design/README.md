---
kind: agent-knowledge-index
scope: loudspeaker-system-design
reviewed: 2026-11-04
status: researched-reference; physical-prototype-not-built
---

# Speaker design: agent entry point

Purpose: retain evidence and decision procedures so later agents can advise the
user without asking them to read this material. This is a working knowledge base,
not a claim of exhaustive expertise or a replacement for measurements.

## Read by task

| Task | Load |
| --- | --- |
| Answer general design questions | `fundamentals.md`, then relevant source IDs |
| Interpret TL behaviour or choose an alignment | `transmission-lines.md` |
| Choose or model stuffing / acoustic foam / wall lining | `stuffing-research.md`, then `../MATERIALS.md`; transport properties and packing matter, source presets are not universal products |
| Resume cut-cell geometry / numerical checks / corrected King units | `numerical-validation-2026-11-04.md`; distinguish integrated volume, response sensitivity, published-simulation agreement and physical validation |
| Choose a proven design | `proven-designs.md`, `recommendation.md` |
| Reproduce the selected cabinet | `models/satori-reference.json`, `aegir-model.md` |
| Resume crossover / 3D circuit work | `../CROSSOVER-BUILDER.md`; single-frequency filling is not a broadband transient model |
| Resume physics upgrades | `physics-upgrades.md`, then `../PHYSICS-UPGRADES.md` |
| Resume product / UX work | `../STUDIO.md`; reference documents are developer tests, never the product workflow |
| Understand 3D waves / volume vs slice / phasor upgrade | `three-dimensional-waves.md`; current solver already computes 3D; proposals are not implemented |
| Reproduce published graphs / extend ÆGIR | `system-reproduction.md`, then `../SYSTEM-STUDIES.md` |
| Interpret a plot or plan prototype tests | `measurement-and-validation.md` |
| Verify a claim or repair a stale link | `sources.md` |
| Find other King projects / MathCad availability | `quarter-wave-projects.md` |
| Refine the Satori worksheet comparison | `worksheet-implementation.md`, then `../MODEL-VALIDATION.md`; exact cases differ from the main-report schematic |
| Reproduce a different published TL / inspect independent comparison | `numerical-validation-2026-11-04.md` for corrected units and geometry; `anatomy-2006-validation.md` preserves the earlier audit |
| Resume this research | `research-log.md` |
| Assess Hornresp / SigmaStudio as accuracy references | `hornresp-sigmastudio-research.md`; downloaded application binaries inspected with REA, no cross-simulator validation yet |

## Evidence contract

- **SOURCE**: a statement or number actually read in a named source; preserve
  driver revision, units, measurement conditions, and page/figure locator.
- **DERIVED**: calculation from stated inputs; retain formula and rounding.
- **ASSUMED**: an explicit modelling choice; never silently promote to SOURCE.
- **SIMULATED**: numerical result, tied to project revision, settings, and solver.
- **MEASURED**: physical data with method and conditions. Published measurements
  belong to their author's system, not to ours.
- **UNKNOWN**: missing evidence; do not replace with a plausible specification.

The selection is Martin J. King's **2023 Satori single-fold tapered TL**. The
original bass/enclosure reconstruction is retained. The newer two-way reference
project includes the tweeter and crossover, but **does not yet reproduce all
published responses**. Read `system-reproduction.md` before quoting performance.
No drivers, components, or cabinets have been purchased.

## Saved deliverables

Current numerical correction0.9.5: `numerical-validation-2026-11-04.md` and
`models/convergence-upgrade/`. Historical0.9.3/0.9.4 exports below retain their
original solver results and are superseded where explicitly identified.

Porous-material upgrade0.9.4: [research and state](stuffing-research.md),
[material equations](../MATERIALS.md),
[comparison report](models/stuffing-upgrade/comparison.html),
[verification](models/stuffing-upgrade/verification.json).
Published NASA foam coupon agreement does not establish full-speaker validation.

Independent King 2006 straight-line reference: [agent record](anatomy-2006-validation.md),
[overlay report](models/anatomy-2006-comparison/comparison.html),
[empty project](models/Anatomy-2006-straight-empty.aegir.json),
[stuffed project](models/Anatomy-2006-straight-stuffed.aegir.json),
[live verification](models/Anatomy-2006-verification.json).
This uses the author's generic simulation driver, not a measured production speaker.
The earlier Satori selection is preserved; this is an additional validation case.

Current worksheet cases: [state](worksheet-implementation.md),
[passive project](models/Satori-worksheet-passive.aegir.json),
[active project](models/Satori-worksheet-active.aegir.json),
[live verification](models/worksheet-live-verification.json).
Original main-report project remains preserved. Full acoustic acceptance is not achieved.


Crossover builder / coupled-field release: [verification](models/crossover-release-verification.json).
The existing two-driver study is preserved; circuit edits are drafts until Apply.


Current physics-upgraded study: [agent record](physics-upgrades.md),
[project](models/Satori-physics-upgraded.aegir.json),
[verification](models/physics-verification.json),
[rendered model](models/Satori-physics-model.png).
Complete published-response acceptance remains unachieved.

Preserved earlier two-way reproduction: [project](models/Satori-two-way-reference.aegir.json),
[live comparison evidence](models/Satori-two-way-reference-comparison.json),
[verification](models/system-verification.json),
[STEP](models/Satori-two-way-reference.step),
[actual rendered model](models/Satori-two-way-model.png).
Read `system-reproduction.md` before interpreting these provisional results.

Earlier bass-study artifacts (preserved):

- [Short recommendation](recommendation.md)
- [Editable ÆGIR project](models/Satori-TL-bass-study-final.aegir.json)
- [STEP geometry](models/Satori-TL-bass-study-final.step)
- [Geometry/CAM handoff ZIP](models/Satori-TL-bass-study-final.zip)
- [Verification and numerical limits](models/verification.json)
- [Rendered model](models/Satori-model.png)
- [Live wave-study screenshot](models/Satori-wave-study.png)

The two large `.aegir-field.zip` recordings are retained locally in `models/` and
excluded from Git. Their settings, original paths and hashes are recorded.

## Retrieval rules

Prefer the smallest relevant page. Use `rg` on source IDs, parameter names, or
topics. Follow primary links before making current availability or price claims.
Update an existing claim when evidence changes; do not leave conflicting values
without explaining the distinction. Retain failed-access records so an agent does
not mistake a title or search snippet for a fully read source.
