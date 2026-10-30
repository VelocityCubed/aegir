import type { FieldResult } from "./types";
import type { FieldMetric } from "./pixels";
import { fieldScale } from "./pixels";
const cool = [96, 193, 234],
  warm = [244, 172, 127];
export function frameBlend(
  result: FieldResult,
  frame: number,
  interpolate = true,
) {
  const f = Math.max(0, Math.min(result.meta.times.length - 1, frame)),
    a = Math.floor(f),
    b = Math.min(a + 1, result.meta.times.length - 1),
    mix = interpolate ? f - a : 0;
  return {
    a,
    b,
    mix,
    time: result.meta.times[a] * (1 - mix) + result.meta.times[b] * mix,
  };
}
/** Reusable buffers shared by the flat map, arrows and numerical hover readout. */
export class PlanePlayback {
  readonly samples: Float32Array;
  readonly pixels: Uint8ClampedArray;
  constructor(readonly result: FieldResult) {
    const n = result.mask.length;
    this.samples = new Float32Array(n * 4);
    this.pixels = new Uint8ClampedArray(n * 4);
  }
  update(frame: number, metric: FieldMetric, range = 0, interpolate = true) {
    const { a, b, mix } = frameBlend(this.result, frame, interpolate),
      n = this.result.mask.length,
      stride = n * 4,
      data = this.result.data;
    const scale = fieldScale(this.result, metric, range);
    for (let i = 0; i < stride; i++)
      this.samples[i] =
        data[a * stride + i] * (1 - mix) + data[b * stride + i] * mix;
    for (let i = 0; i < n; i++) {
      const at = i * 4;
      if (!this.result.mask[i]) {
        this.pixels.fill(0, at, at + 4);
        continue;
      }
      const p = this.samples[at],
        speed = Math.hypot(
          this.samples[at + 1],
          this.samples[at + 2],
          this.samples[at + 3],
        );
      const value =
          metric === "pressure"
            ? p
            : metric === "velocity"
              ? speed
              : Math.abs(p) * speed,
        t = Math.min(1, Math.abs(value) / Math.max(1e-12, scale));
      const colour = metric === "pressure" && value < 0 ? cool : warm;
      for (let c = 0; c < 3; c++)
        this.pixels[at + c] = Math.round(12 * (1 - t) + colour[c] * t);
      this.pixels[at + 3] = Math.round(18 + 225 * Math.sqrt(t));
    }
    return this;
  }
}
export function particleMotionAt(
  result: FieldResult,
  frame: number,
  out: Float32Array,
  interpolate = true,
) {
  const p = result.meta.particles;
  if (!p) return out;
  const { a, b, mix } = frameBlend(result, frame, interpolate),
    size = p.count * 3;
  for (let i = 0; i < size; i++)
    out[i] =
      result.data[p.offset + a * size + i] * (1 - mix) +
      result.data[p.offset + b * size + i] * mix;
  return out;
}
