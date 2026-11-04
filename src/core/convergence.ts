/** Numerical stability diagnostics, never a physical accuracy certificate. */
export function refinement(
  values: { resolution: number; value: number }[],
  relativeTolerance = 0.01,
) {
  if (
    values.length < 2 ||
    values.some((v) => !Number.isFinite(v.value) || !(v.resolution > 0)) ||
    values.slice(1).some((v, i) => v.resolution >= values[i].resolution)
  )
    throw Error(
      "Refinement requires finite values on strictly decreasing positive resolutions.",
    );
  const changes = values
    .slice(1)
    .map(
      (v, i) =>
        (v.value - values[i].value) / Math.max(Math.abs(v.value), 1e-30),
    );
  const fine = values.at(-1)!,
    d1 =
      values.length >= 3 ? values.at(-2)!.value - values.at(-3)!.value : null,
    d2 = fine.value - values.at(-2)!.value;
  const roundoff = 1e-11 * Math.max(1, ...values.map((v) => Math.abs(v.value)));
  const unchanged =
    values.length >= 3 && Math.abs(d1!) < roundoff && Math.abs(d2) < roundoff;
  const monotonic =
    values.length >= 3 && d1! * d2 > 0 && Math.abs(d2) < Math.abs(d1!);
  const ratios = values
    .slice(1)
    .map((v, i) => values[i].resolution / v.resolution);
  const geometric =
    ratios.length >= 2 && Math.abs(ratios.at(-1)! / ratios.at(-2)! - 1) < 0.02;
  const order =
    monotonic && geometric
      ? Math.log(Math.abs(d1! / d2)) / Math.log(ratios.at(-1)!)
      : null;
  const extrapolated =
    order !== null && order > 0
      ? fine.value + d2 / (ratios.at(-1)! ** order - 1)
      : null;
  const discretizationEstimate =
    extrapolated !== null
      ? (1.25 * Math.abs(extrapolated - fine.value)) /
        Math.max(Math.abs(fine.value), 1e-30)
      : null;
  const stable =
    values.length >= 3 &&
    (unchanged || monotonic) &&
    changes.slice(-2).every((v) => Math.abs(v) <= relativeTolerance);
  return {
    status: stable
      ? "stable"
      : values.length < 3
        ? "insufficient-levels"
        : monotonic
          ? "refine-further"
          : "unresolved",
    stable,
    changes,
    observedOrder: order,
    extrapolated,
    discretizationEstimate,
    relativeTolerance,
    note: "Stability/conditional Richardson estimate only; geometry, boundary and physical-model errors remain separate.",
  };
}
export function modalConvergence(
  studies: {
    frequenciesHz: number[];
    meta: { cellMm: number; cavityLitres: number; geometry?:string; bodyCavityLitres?:number; cadCavityLitres?:number };
  }[],
) {
  const count = Math.min(...studies.map((s) => s.frequenciesHz.length));
  const modes = Array.from({ length: count }, (_, i) =>
    refinement(
      studies.map((s) => ({
        resolution: s.meta.cellMm,
        value: s.frequenciesHz[i],
      })),
    ),
  );
  const volume = refinement(
    studies.map((s) => ({
      resolution: s.meta.cellMm,
      value: s.meta.cavityLitres,
    })),
  );
  const coarse = studies.at(-2)!,
    fine = studies.at(-1)!;
  const geometryAcceptable=studies.every(s=>s.meta.geometry!=='staircase'&&(s.meta.bodyCavityLitres===undefined||s.meta.cadCavityLitres===undefined||Math.abs(s.meta.bodyCavityLitres/s.meta.cadCavityLitres-1)<=.005));
  return {
    convergencePercent: fine.frequenciesHz.map(
      (f, i) => 100 * (f / coarse.frequenciesHz[i] - 1),
    ),
    meshStableWithin1Percent: modes.every((m) => m.stable) && volume.stable && geometryAcceptable,
    geometryAcceptable,
    refinement: {
      modes,
      volume,
      modeAssociation:
        "frequency-order; crossings/degenerate modes require shape comparison",
    },
    note: "Requires at least three mesh levels and consistent refinement. Numerical stationarity is not physical validation; sorted frequencies can change identity near crossings.",
  };
}
