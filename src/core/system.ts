import { buildGeometry } from "./geometry";
import type { Geometry, Project, ReferenceCurve, Simulation } from "./types";
import { soundSpeed, lineMatrix } from "./acoustics";
import { projectAir } from './medium';
import { cascade, identity } from "./crossover";
import { impedancePeaks } from "./diagnostics";
import {materialWarnings} from './porous-materials';

/** An explicit profile never changes CAD or disguises a failed route extraction. */
export function analysisGeometry(p: Project): Geometry {
  const g = buildGeometry(p),
    profile = p.system?.profile;
  if (!profile) return g;
  return {
    ...g,
    errors: g.physicalErrors ?? g.errors,
    sections: profile.sections,
    lineLength: profile.sections.at(-1)!.distance,
    mounts: g.mounts.map((m) => ({
      ...m,
      position: p.mounts?.find((q) => q.id === m.id)?.position ?? m.position,
    })),
  };
}
export function profileVolume(p: Project) {
  return p.system?.profile?.sections.slice(1).reduce((sum, b, i) => {
    const a = p.system!.profile!.sections[i];
    return sum + ((b.distance - a.distance) * (a.area + b.area)) / 2 / 1000;
  }, 0);
}
/** Lossless rigid closed end U(0)=0, ideal pressure release p(L)=0. No driver or radiation. */
export function closedOpenModes(p: Project, maxHz = 1000): number[] {
  const g = analysisGeometry(p),
    {c,rho} = projectAir(p);
  if (g.errors.length) throw Error(g.errors.join(" "));
  const intervals = g.sections.slice(1).flatMap((b, i) => {
    const a = g.sections[i],
      n = Math.max(1, Math.ceil((b.distance - a.distance) / 0.01));
    return Array.from({ length: n }, (_, k) => ({
      length: (b.distance - a.distance) / n,
      area: (a.area + ((b.area - a.area) * (k + 0.5)) / n) * 1e-6,
    }));
  });
  const residual = (f: number) => {
    let m = identity();
    for (const s of intervals)
      m = cascade(m, lineMatrix(f, s.length, s.area, c, rho, 0));
    return m.d[0]; // p(L)=D*p(0) when U(0)=0 (determinant=1).
  };
  const modes: number[] = [];
  let previous = 0.01,
    yp = residual(previous);
  for (let f = 1; f <= maxHz; f += 1) {
    const y = residual(f);
    if (yp * y < 0) {
      let lo = previous,
        hi = f,
        yl = yp;
      for (let i = 0; i < 32; i++) {
        const mid = (lo + hi) / 2,
          ym = residual(mid);
        if (yl * ym <= 0) hi = mid;
        else {
          lo = mid;
          yl = ym;
        }
      }
      modes.push((lo + hi) / 2);
    }
    previous = f;
    yp = y;
  }
  return modes;
}
export function compareReference(p: Project, s: Simulation, r: ReferenceCurve) {
  const issues: string[] = [],
    mounts = p.mounts ?? [];
  const kind = p.circuit?.parts.some(c=>['R','L','C'].includes(c.kind))||mounts.some((m) => m.crossover?.passive?.length)
    ? "passive"
    : p.circuit?.parts.some(c=>c.active?.length)||mounts.some((m) => m.crossover?.active?.length)
      ? "active"
      : "bypass";
  if (r.metric !== "impedance") {
    if (p.system?.observation) {
      if (!r.conditions.microphoneMm)
        issues.push("Reference microphone coordinates/axis are not specified.");
      else if (
        Math.hypot(
          ...r.conditions.microphoneMm.map(
            (x, i) => x - p.system!.observation!.positionMm[i],
          ),
        ) > 1
      )
        issues.push("Microphone position/axis differs.");
    }
    if (r.conditions.voltage === null)
      issues.push(
        "Reference drive voltage is unknown; absolute SPL cannot be verified.",
      );
    else if (Math.abs(r.conditions.voltage - p.design.voltage) > 1e-6)
      issues.push("Drive voltage differs.");
  }
  if (r.metric !== "impedance") {
    if (
      r.conditions.radiation !== "half-space" &&
      !(
        r.conditions.radiation === "near-field" &&
        p.system?.observation?.operator === "rayleigh"
      )
    )
      issues.push(
        `${r.conditions.radiation} measurement is not validated by the current radiation approximation.`,
      );
    if (r.conditions.distanceM === null)
      issues.push("Reference observation distance is unknown.");
    else if (
      !p.system?.observation &&
      Math.abs(r.conditions.distanceM - (p.system?.distanceM ?? 1)) > 1e-6
    )
      issues.push("Observation distance differs.");
  }
  const regions = p.system?.physics?.stuffing ?? [];
  const stuffed =
    regions.length > 0 ||
    (p.system?.profile
      ? p.system.profile.sections.some((x) => x.damping > 0)
      : p.design.damping > 0);
  if (r.conditions.stuffing === "stuffed")
    if (!regions.length)
      issues.push(
        "Polyester density has no calibrated propagation model; generic attenuation is not equivalent.",
      );
    else if (regions.some((r) => r.calibration !== "measured"))
      issues.push(
        "Stuffing parameters are assumed or fitted; independent material validation is pending.",
      );
  if (r.conditions.stuffing === "empty" && stuffed)
    issues.push("The reference is empty but model attenuation is nonzero.");
  if (r.conditions.crossover !== kind)
    issues.push("Crossover conditions differ.");
  if (
    r.samples.some(
      ([f]) =>
        f >
        (p.system?.physics?.radiation === "piston"
          ? s.planeWaveLimit
          : Math.min(s.radiationLimit, s.planeWaveLimit)),
    )
  )
    issues.push(
      "Reference extends above the radiation/plane-wave model limits.",
    );
  const points = s.points;
  const rows = r.samples.map(([f, expected]) => {
    const i = points.findIndex((x) => x.frequency >= f);
    if (i < 0 || f < points[0].frequency)
      return { frequency: f, expected, actual: null, error: null };
    const a = points[Math.max(0, i - 1)],
      b = points[i],
      t =
        Math.log(f / a.frequency) / (Math.log(b.frequency / a.frequency) || 1);
    const actual = a[r.metric] + t * (b[r.metric] - a[r.metric]);
    return { frequency: f, expected, actual, error: actual - expected };
  });
  if (rows.some((x) => x.actual === null))
    issues.push("Reference extends outside the simulation sweep.");
  const errors = rows.flatMap((x) => (x.error === null ? [] : [x.error]));
  const rmse = errors.length
    ? Math.sqrt(errors.reduce((sum, x) => sum + x * x, 0) / errors.length)
    : null;
  const maxError = errors.length ? Math.max(...errors.map(Math.abs)) : null;
  return {
    id: r.id,
    title: r.title,
    source: r.source,
    evidence: r.evidence,
    trace: r.trace ?? "unspecified",
    frequencyUncertaintyPercent: r.frequencyUncertaintyPercent ?? null,
    metric: r.metric,
    conditions: structuredClone(r.conditions),
    tolerance: r.tolerance,
    uncertainty: r.uncertainty,
    rows,
    peaks: r.metric === "impedance" ? impedancePeaks(s, r) : [],
    rmse,
    maxError,
    issues,
    status: issues.length
      ? "incompatible"
      : maxError !== null && maxError <= r.tolerance
        ? "within-tolerance"
        : "mismatch",
  };
}
export function systemLimitations(p: Project): string[] {
  return [
    p.system?.observation
      ? p.system.observation.operator === "rayleigh"
        ? "Circular-piston Rayleigh integral: exact axial field, numerical off-axis quadrature in an infinite half-space baffle. Port uses an equivalent disk. Probe/grid accuracy requires validation."
        : "Separate source/microphone coordinates, propagation phase and circular-piston directivity. No cabinet shadowing, rectangular-edge diffraction, cone breakup or room reflections; full-speaker response remains provisional."
      : "Linear rigid pistons and co-located radiation in an infinite baffle. Enable explicit microphone coordinates for source path delays and piston directivity.",
    p.system?.physics?.radiation === "piston"
      ? "Circular piston radiation impedance uses full Bessel/Struve integrals. Equivalent-circle mouth and rigid-piston assumptions remain; a1D line still lacks transverse modes."
      : "Radiation impedance uses a low-ka approximation. Sweeping above the radiation/plane-wave limits does not extend model validity.",
    ...(p.system?.observation?.baffle === "sphere-transition"
      ? [
          "Equivalent-sphere baffle-step transition is a selectable approximation, not a rectangular-baffle diffraction solution.",
        ]
      : []),
    ...(p.system?.physics?.ductLoss === "mjk-2003"
      ? [
          "Empty-line loss uses King2003 empirical tube resistance10Pa·s/m². It has not been verified as the2023 worksheet law.",
        ]
      : []),
    ...(p.system?.physics?.ductLoss === "thermoviscous"
      ? [
          "Wide-duct thermal/viscous boundary-layer approximation uses section perimeter/area and air properties; abrupt folds still need spatial validation.",
        ]
      : []),
    ...(p.system?.profile
      ? [
          `Acoustic equivalent profile (${p.system.profile.evidence}), independent of the CAD cavity: ${p.system.profile.source}`,
        ]
      : []),
    ...(p.system?.physics?.stuffing ?? []).map(
      (r) =>
        `Stuffing region${r.start}–${r.end}: ${r.material.model}; calibration=${r.calibration}; ${r.source}`,
    ),
    ...materialWarnings(p),
    "Legacy section attenuation remains empirical Np/m. Material models replace gas propagation inside their regions; density is not converted to JCAL transport parameters.",
    ...(p.mounts?.some((m) => m.crossover?.active?.length)
      ? [
          "Active filters drive separate amplifier outputs. Impedance describes the loudspeaker circuit after filtering, not an active processor input.",
        ]
      : []),
  ];
}
export function referenceReport(p: Project, s: Simulation) {
  const ref = p.system?.modalReference;
  const computed = ref
    ? closedOpenModes(p, Math.max(...ref.frequencies) * 1.25)
    : [];
  const modes =
    ref?.frequencies.map((frequency, i) => ({
      mode: i + 1,
      reference: frequency,
      actual: computed[i] ?? null,
      errorPercent:
        computed[i] === undefined ? null : 100 * (computed[i] / frequency - 1),
    })) ?? [];
  return {
    scope:
      "Reference comparisons do not constitute validation of a complete loudspeaker.",
    project: structuredClone(p),
    drivers: (p.mounts ?? analysisGeometry(p).mounts).map((m) => ({
      id: m.id,
      name: m.driver.name,
      rearLoading: m.rearLoading ?? "cabinet",
      crossover: m.crossover ?? null,
    })),
    profileVolumeLitres: profileVolume(p) ?? null,
    cadVolumeLitres: buildGeometry(p).airVolume,
    curves: p.system?.references?.map((r) => compareReference(p, s, r)) ?? [],
    modal: ref
      ? {
          source: ref.source,
          boundary:
            "Rigid cavity, no driver, lossless air, ideal p=0 mouth; axial 1D modes only.",
          tolerancePercent: ref.tolerancePercent,
          rows: modes,
          status: modes.every(
            (m) =>
              m.errorPercent !== null &&
              Math.abs(m.errorPercent) <= ref.tolerancePercent,
          )
            ? "within-tolerance"
            : "mismatch",
        }
      : null,
    limitations: systemLimitations(p),
  };
}
