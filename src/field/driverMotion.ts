import type { FieldResult } from "./types";
export interface DriverMotion {
  id: string;
  displacementMm: number;
  current: number;
}
/** End-step displacement at exactly the displayed pressure frame, keyed by mount ID. */
export function driverMotionAt(
  result: FieldResult,
  frame: number,
): DriverMotion[] {
  const { meta, data } = result;
  const step = Math.max(
    0,
    Math.min(meta.steps - 1, Math.round(meta.times[frame] / meta.dt) - 1),
  );
  return meta.sources.map((source, index) => {
    const at =
      meta.layout.driverOffset + (step * meta.sources.length + index) * 4;
    return {
      id: source.id,
      displacementMm: data[at] * 1000,
      current: data[at + 2],
    };
  });
}
