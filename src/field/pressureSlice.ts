import type { FieldResult, FieldMeta, Axis } from "./types";
import type { Project, XYZ } from "../core/types";
import { buildGeometry } from "../core/geometry";
import { solid } from "./grid";
import { frameBlend } from "./playback";
export type SliceChoice = "auto" | "recorded" | Axis;
export function preferredPressurePlane(p: Project): Axis {
  if (!p.layout?.baffles.length) return "xy";
  const g = buildGeometry(p),
    outer = [g.width, g.height, g.depth],
    shell = new Set(["front", "back", "left", "right", "top", "bottom"]);
  const internal = g.panels
    .filter((p) => !shell.has(p.id))
    .sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!internal) return "xy";
  const s = solid(internal),
    ratios = s.max.map(
      (v, i) => (v - s.min[i]) / Math.max(1, outer[i] - 2 * p.design.thickness),
    );
  const normal = ratios.indexOf(Math.max(...ratios));
  return normal === 0 ? "yz" : normal === 1 ? "xz" : "xy";
}
/** Reads existing samples only. Alternate planes use the stored volume grid. */
export class PressureSlice {
  readonly plane: FieldMeta["plane"];
  readonly mask: Uint8Array;
  readonly cells?: Uint32Array;
  readonly source: "recorded" | "volume";
  readonly velocityAvailable: boolean;
  constructor(
    readonly result: FieldResult,
    choice: SliceChoice = "recorded",
    fraction = 0.5,
  ) {
    const axis =
        choice === "auto"
          ? preferredPressurePlane(result.meta.project)
          : choice,
      v = result.meta.volume;
    if (axis === "recorded" || !v || !result.volumeMask) {
      this.plane = result.meta.plane;
      this.mask = result.mask;
      this.source = "recorded";
      this.velocityAvailable = true;
      return;
    }
    const normal = axis === "xy" ? 2 : axis === "xz" ? 1 : 0;
    const geometry = buildGeometry(result.meta.project),
      extent = [geometry.width, geometry.height, geometry.depth];
    const selected = Math.max(
      0,
      Math.min(
        v.dimensions[normal] - 1,
        Math.round(
          (extent[normal] * fraction - v.originMm[normal]) / v.pitchMm,
        ),
      ),
    );
    const actual = v.originMm[normal] + selected * v.pitchMm;
    const original = result.meta.plane;
    if (
      axis === original.axis &&
      axis !== "yz" &&
      Math.abs(original.originMm[normal] - actual) < v.pitchMm * 0.51
    ) {
      this.plane = original;
      this.mask = result.mask;
      this.source = "recorded";
      this.velocityAvailable = true;
      return;
    }
    // Side sections are upright: depth horizontally, height vertically.
    const horizontal = axis === "yz" ? 2 : 0,
      vertical = axis === "xy" || axis === "yz" ? 1 : 2;
    const width = v.dimensions[horizontal],
      height = v.dimensions[vertical],
      u: XYZ = [0, 0, 0],
      w: XYZ = [0, 0, 0],
      origin = [...v.originMm] as XYZ;
    u[horizontal] = 1;
    w[vertical] = 1;
    origin[normal] = actual;
    this.plane = {
      axis,
      width,
      height,
      pitchMm: v.pitchMm,
      originMm: origin,
      u,
      v: w,
    };
    this.source = "volume";
    this.velocityAvailable = false;
    this.cells = new Uint32Array(width * height);
    this.mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const point = [0, 0, 0];
        point[normal] = selected;
        point[horizontal] = x;
        point[vertical] = y;
        const i =
          point[0] + v.dimensions[0] * (point[1] + v.dimensions[1] * point[2]);
        this.cells[x + y * width] = i;
        this.mask[x + y * width] = result.volumeMask[i];
      }
  }
  read(frame: number, index: number, component = 0) {
    if (!this.mask[index]) return NaN;
    if (this.source === "recorded")
      return this.result.data[
        (frame * this.mask.length + index) * 4 + component
      ];
    if (component) return NaN;
    const v = this.result.meta.volume!;
    return this.result.data[v.offset + frame * v.cells + this.cells![index]];
  }
  sample(frame: number, index: number, component = 0, interpolate = true) {
    const { a, b, mix } = frameBlend(this.result, frame, interpolate);
    return (
      this.read(a, index, component) * (1 - mix) +
      this.read(b, index, component) * mix
    );
  }
  frame(frame: number, out: Float32Array, interpolate = true) {
    const { a, b, mix } = frameBlend(this.result, frame, interpolate);
    for (let i = 0; i < this.mask.length; i++) {
      out[i * 4] = this.mask[i]
        ? this.read(a, i) * (1 - mix) + this.read(b, i) * mix
        : 0;
      for (let c = 1; c < 4; c++)
        out[i * 4 + c] =
          this.velocityAvailable && this.mask[i]
            ? this.read(a, i, c) * (1 - mix) + this.read(b, i, c) * mix
            : 0;
    }
    return out;
  }
  world(index: number): XYZ {
    const p = this.plane,
      x = index % p.width,
      y = Math.floor(index / p.width);
    return p.originMm.map(
      (v, i) => v + (p.u[i] * x + p.v[i] * y) * p.pitchMm,
    ) as XYZ;
  }
  rms(index: number) {
    const t = this.result.meta.times;
    if (!this.mask[index]) return NaN;
    if (t.length < 2) return Math.abs(this.read(0, index));
    let sum = 0;
    for (let f = 1; f < t.length; f++)
      sum +=
        (this.read(f - 1, index) ** 2 + this.read(f, index) ** 2) *
        0.5 *
        (t[f] - t[f - 1]);
    return Math.sqrt(sum / (t.at(-1)! - t[0]));
  }
}
