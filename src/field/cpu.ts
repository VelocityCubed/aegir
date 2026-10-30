import { prepareField } from "./grid";
import type { Project } from "../core/types";
import type {
  FieldResult,
  FieldSettings,
  PreparedField,
  FieldProgress,
} from "./types";

export function excitation(
  t: number,
  frequency: number,
  phase: number,
  signal: "burst" | "tone",
) {
  if (signal === "tone")
    return (
      Math.cos(2 * Math.PI * frequency * t + phase) *
      (0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, (t * frequency) / 2)))
    );
  const tau = (t - 2 / frequency) * frequency;
  return (
    Math.exp(-0.5 * (tau / 0.55) ** 2) * Math.cos(2 * Math.PI * tau + phase)
  );
}
/** Float64 reference; identical ordering to the GPU's pressure/velocity/port updates. */
export class FieldKernel {
  readonly state: Float64Array;
  readonly drivers: Float64Array;
  readonly data: Float32Array;
  readonly p: Float64Array;
  readonly px: Float64Array;
  readonly py: Float64Array;
  readonly pz: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly vz: Float64Array;
  readonly old: Float64Array;
  stepIndex = 0;
  constructor(readonly grid: PreparedField) {
    const n = grid.meta.cells;
    this.state = new Float64Array(
      8 * n + 3 * (grid.particleCells?.length ?? 0),
    );
    [this.p, this.px, this.py, this.pz, this.vx, this.vy, this.vz, this.old] =
      Array.from({ length: 8 }, (_, i) =>
        this.state.subarray(i * n, (i + 1) * n),
      );
    this.drivers = new Float64Array(1 + 5 * grid.meta.sources.length);
    this.data = new Float32Array(grid.meta.layout.total);
  }
  step() {
    const g = this.grid,
      m = g.meta,
      [nx, ny, nz] = m.dimensions,
      xy = nx * ny,
      { dt, h, rho, bulk } = m,
      flags = g.flags,
      aux = g.aux,
      [ox, oy, oz] = g.coeffOffsets,
      { p, px, py, pz, vx, vy, vz, old } = this,
      nd = m.sources.length;
    for (let z = 0; z < nz; z++) {
      const az = oz + z * 4;
      for (let y = 0; y < ny; y++) {
        const ay = oy + y * 4;
        for (let x = 0; x < nx; x++) {
          const i = x + nx * y + xy * z,
            f = flags[i];
          if (!(f & 1)) continue;
          const ax = ox + x * 4,
            base = p[i];
          vx[i] =
            f & 2
              ? aux[ax + 2] * vx[i] -
                (aux[ax + 3] / (rho * h)) * (p[i + 1] - base)
              : 0;
          vy[i] =
            f & 4
              ? aux[ay + 2] * vy[i] -
                (aux[ay + 3] / (rho * h)) * (p[i + nx] - base)
              : 0;
          vz[i] =
            f & 8
              ? aux[az + 2] * vz[i] -
                (aux[az + 3] / (rho * h)) * (p[i + xy] - base)
              : 0;
        }
      }
    }
    for (let z = 0; z < nz; z++) {
      const az = oz + z * 4;
      for (let y = 0; y < ny; y++) {
        const ay = oy + y * 4;
        for (let x = 0; x < nx; x++) {
          const i = x + nx * y + xy * z;
          if (!(flags[i] & 1)) continue;
          const ax = ox + x * 4;
          old[i] = p[i];
          px[i] =
            aux[ax] * px[i] -
            ((aux[ax + 1] * bulk) / h) * (vx[i] - (x ? vx[i - 1] : 0));
          py[i] =
            aux[ay] * py[i] -
            ((aux[ay + 1] * bulk) / h) * (vy[i] - (y ? vy[i - nx] : 0));
          pz[i] =
            aux[az] * pz[i] -
            ((aux[az + 1] * bulk) / h) * (vz[i] - (z ? vz[i - xy] : 0));
          p[i] = px[i] + py[i] + pz[i];
        }
      }
    }
    const rhs = new Float64Array(nd),
      vMid = new Float64Array(nd),
      volts = new Float64Array(nd),
      t = (this.stepIndex + 0.5) * dt;
    for (let d = 0; d < nd; d++) {
      let avg = 0;
      for (let k = 0; k < g.sourceCells.length; k++) {
        const i = g.sourceCells[k];
        avg += g.weights[k * nd + d] * (old[i] + p[i]) * 0.5;
      }
      const at = d * 9,
        s = 1 + d * 5,
        mass = g.models[at],
        cms = g.models[at + 2],
        bl = g.models[at + 3],
        re = g.models[at + 4],
        le = g.models[at + 5],
        sd = g.models[at + 6],
        ze = re + (2 * le) / dt;
      volts[d] =
        m.project.design.voltage *
        Math.SQRT2 *
        g.models[at + 7] *
        excitation(
          t,
          m.settings.frequency,
          g.models[at + 8],
          m.settings.signal,
        );
      rhs[d] =
        ((2 * mass) / dt) * this.drivers[s + 1] -
        this.drivers[s] / cms +
        (bl * (volts[d] + ((2 * le) / dt) * this.drivers[s + 2])) / ze -
        sd * avg;
    }
    for (let i = 0; i < nd; i++) {
      let v = rhs[i];
      for (let j = 0; j < i; j++) v -= g.chol[i * nd + j] * vMid[j];
      vMid[i] = v / g.chol[i * nd + i];
    }
    for (let i = nd - 1; i >= 0; i--) {
      let v = vMid[i];
      for (let j = i + 1; j < nd; j++) v -= g.chol[j * nd + i] * vMid[j];
      vMid[i] = v / g.chol[i * nd + i];
    }
    for (let d = 0; d < nd; d++) {
      const at = d * 9,
        s = 1 + d * 5,
        bl = g.models[at + 3],
        re = g.models[at + 4],
        le = g.models[at + 5],
        im =
          (volts[d] + ((2 * le) / dt) * this.drivers[s + 2] - bl * vMid[d]) /
          (re + (2 * le) / dt);
      this.drivers[s] += dt * vMid[d];
      this.drivers[s + 1] = 2 * vMid[d] - this.drivers[s + 1];
      this.drivers[s + 2] = le
        ? 2 * im - this.drivers[s + 2]
        : (volts[d] - bl * this.drivers[s + 1]) / re;
      this.drivers[s + 3] = vMid[d];
      this.drivers[s + 4] = im;
      const out = m.layout.driverOffset + (this.stepIndex * nd + d) * 4;
      this.data.set([this.drivers[s], vMid[d], im, volts[d]], out);
    }
    for (let k = 0; k < g.sourceCells.length; k++) {
      let q = 0;
      for (let d = 0; d < nd; d++)
        q += g.weights[k * nd + d] * g.models[d * 9 + 6] * vMid[d];
      const i = g.sourceCells[k],
        delta = ((bulk * dt) / (h * h * h)) * q;
      p[i] += delta;
      px[i] += delta / 3;
      py[i] += delta / 3;
      pz[i] += delta / 3;
    }
    for (let k = 0; k < g.probeCells.length; k++)
      this.data[
        m.layout.probeOffset + this.stepIndex * g.probeCells.length + k
      ] = p[g.probeCells[k]];
    const frame = g.recordSteps[this.stepIndex];
    // Linear acoustics: integrate each small fluid displacement at its fixed
    // equilibrium position using the existing midpoint velocity. Observation only.
    for (let k = 0; k < (g.particleCells?.length ?? 0); k++) {
      const i = g.particleCells![k],
        a = 8 * m.cells + 3 * k;
      this.state[a] += dt * 0.5 * (vx[i] + (i % nx ? vx[i - 1] : 0));
      this.state[a + 1] +=
        dt * 0.5 * (vy[i] + (Math.floor(i / nx) % ny ? vy[i - nx] : 0));
      this.state[a + 2] += dt * 0.5 * (vz[i] + (i >= xy ? vz[i - xy] : 0));
      if (frame !== 0xffffffff)
        this.data.set(
          this.state.subarray(a, a + 3),
          m.particles!.offset + (frame * m.particles!.count + k) * 3,
        );
    }
    if (frame !== 0xffffffff) {
      for (let k = 0; k < (g.volumeCells?.length ?? 0); k++)
        this.data[m.volume!.offset + frame * m.volume!.cells + k] =
          p[g.volumeCells![k]];
      // Pressure is at the end step; centre each staggered face velocity in
      // time before spatial interpolation (important for instantaneous p*u).
      const face = (i: number, axis: number) => {
        const bit = 2 << axis;
        if (!(flags[i] & bit)) return 0;
        const offset = [1, nx, xy][axis],
          coordinate =
            axis === 0
              ? i % nx
              : axis === 1
                ? Math.floor(i / nx) % ny
                : Math.floor(i / xy),
          coeff = g.coeffOffsets[axis] + coordinate * 4,
          value = [vx, vy, vz][axis][i];
        return (
          0.5 *
          (value +
            aux[coeff + 2] * value -
            (aux[coeff + 3] / (rho * h)) * (p[i + offset] - p[i]))
        );
      };
      for (let k = 0; k < g.recordCells.length; k++) {
        const i = g.recordCells[k],
          at = (frame * g.recordCells.length + k) * 4;
        this.data[at] = p[i];
        this.data[at + 1] = 0.5 * (face(i, 0) + (i % nx ? face(i - 1, 0) : 0));
        this.data[at + 2] =
          0.5 * (face(i, 1) + (Math.floor(i / nx) % ny ? face(i - nx, 1) : 0));
        this.data[at + 3] =
          0.5 * (face(i, 2) + (i >= xy ? face(i - xy, 2) : 0));
      }
    }
    this.stepIndex++;
    this.drivers[0] = this.stepIndex;
  }
}
export function finishField(
  grid: PreparedField,
  data: Float32Array,
  backend: string,
  seconds: number,
): FieldResult {
  const meta = structuredClone(grid.meta),
    planeCells = grid.recordCells.length;
  let peak = 0;
  const levels: number[] = [];
  for (let f = 0; f < meta.times.length; f++)
    for (let i = 0; i < planeCells; i++) {
      const p = Math.abs(data[(f * planeCells + i) * 4]);
      if (!Number.isFinite(p))
        throw Error(
          "Wave solver produced non-finite pressure. Refine settings or lower drive.",
        );
      peak = Math.max(peak, p);
      if (i % 3 === 0 && grid.recordMask[i]) levels.push(p);
    }
  if (meta.volume) {
    const v = meta.volume;
    for (let f = 0; f < meta.times.length; f++)
      for (let k = 0; k < v.cells; k++) {
        const p = Math.abs(data[v.offset + f * v.cells + k]);
        if (!Number.isFinite(p))
          throw Error("Non-finite volume pressure recording.");
        if (grid.volumeMask?.[k]) {
          peak = Math.max(peak, p);
          if (k % 3 === 0) levels.push(p);
        }
      }
  }
  levels.sort((a, b) => a - b);
  meta.pressurePeak = peak;
  meta.pressureScale = Math.max(
    1e-6,
    levels[Math.floor(levels.length * 0.995)] ?? peak,
  );
  meta.backend = backend;
  meta.seconds = seconds;
  for (let d = 0; d < meta.sources.length; d++) {
    let ex = 0,
      current = 0;
    for (let s = 0; s < meta.steps; s++) {
      const at = meta.layout.driverOffset + (s * meta.sources.length + d) * 4;
      if (!Number.isFinite(data[at]) || !Number.isFinite(data[at + 2]))
        throw Error("Driver state diverged.");
      ex = Math.max(ex, Math.abs(data[at]) * 1000);
      current = Math.max(current, Math.abs(data[at + 2]));
    }
    meta.sources[d].peakExcursion = ex;
    meta.sources[d].peakCurrent = current;
    if (ex > meta.sources[d].xmax)
      meta.warnings.push(
        `Driver ${meta.sources[d].id} exceeds Xmax during this stimulus (${ex.toFixed(2)} mm). Small-signal predictions need lower voltage.`,
      );
  }
  if (meta.particles)
    for (
      let i = meta.particles.offset;
      i < meta.particles.offset + meta.particles.count * 3 * meta.times.length;
      i++
    )
      if (!Number.isFinite(data[i]))
        throw Error("Non-finite parcel displacement recording.");
  return {
    meta,
    data,
    mask: grid.recordMask,
    ...(meta.volume ? { volumeMask: grid.volumeMask } : {}),
  };
}
export async function runFieldCpu(
  project: Project,
  settings: Partial<FieldSettings>,
  progress: FieldProgress = () => {},
): Promise<FieldResult> {
  const start = performance.now(),
    grid = prepareField(project, settings, progress, true);
  if (grid.meta.cells > 300_000 || grid.meta.cells * grid.meta.steps > 300e6)
    throw Error(
      "CPU work budget exceeded. Use WebGPU, a coarser grid, or a shorter study.",
    );
  const kernel = new FieldKernel(grid);
  for (let i = 0; i < grid.meta.steps; i++) {
    kernel.step();
    if (i % 16 === 0) {
      progress(0.2 + (0.79 * i) / grid.meta.steps);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  return finishField(
    grid,
    kernel.data,
    "cpu-float64",
    (performance.now() - start) / 1000,
  );
}
