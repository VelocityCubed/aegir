import type { FieldResult } from "./types";
import { frameBlend } from "./playback";
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
    Math.min(meta.steps - 1, frameBlend(result, frame).time / meta.dt - 1),
  );
  return meta.sources.map((source, index) => {
    const lo = Math.floor(step),
      hi = Math.min(meta.steps - 1, lo + 1),
      t = step - lo;
    const at =
        meta.layout.driverOffset + (lo * meta.sources.length + index) * 4,
      next = meta.layout.driverOffset + (hi * meta.sources.length + index) * 4;
    return {
      id: source.id,
      displacementMm: (data[at] * (1 - t) + data[next] * t) * 1000,
      current: data[at + 2] * (1 - t) + data[next + 2] * t,
    };
  });
}
