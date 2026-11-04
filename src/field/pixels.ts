import type { FieldResult } from "./types";
import { pressureColour } from "./transfer";
export type FieldMetric = "pressure" | "velocity" | "intensity";
export function fieldScale(
  result: FieldResult,
  metric: FieldMetric,
  range = 0,
) {
  return range > 0
    ? range
    : metric === "pressure"
      ? result.meta.pressureScale
      : metric === "velocity"
        ? result.meta.pressureScale / (result.meta.rho * result.meta.c)
        : result.meta.pressureScale ** 2 / (result.meta.rho * result.meta.c);
}
export function fieldPixels(
  result: FieldResult,
  frame: number,
  metric: FieldMetric,
  range = 0,
) {
  const { width, height } = result.meta.plane,
    count = width * height,
    data = result.data.subarray(frame * count * 4, (frame + 1) * count * 4),
    scale = fieldScale(result, metric, range),
    pixels = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) {
    if (!result.mask[i]) continue;
    const at = i * 4,
      p = data[at],
      speed = Math.hypot(data[at + 1], data[at + 2], data[at + 3]),
      value =
        metric === "pressure"
          ? p
          : metric === "velocity"
            ? speed
            : Math.abs(p) * speed,
      t = Math.min(1, Math.abs(value) / Math.max(1e-12, scale)),
      colour = pressureColour(value,scale);
    for (let c = 0; c < 3; c++)
      pixels[at + c] = colour[c];
    pixels[at + 3] = 255;
  }
  return pixels;
}
