import type { Project } from "../core/types";
import { circuitFromProject, circuitTopology } from "../core/circuit";
export interface CircuitStep {
  stateCount: number;
  inputLength: number;
  driveCount: number;
  filterCount: number;
  /** Rows: driver midpoint v, coil i, terminal V, then all next storage states. */
  transform: Float64Array;
  drives: Float64Array;
  filters: Float64Array;
  storageWeights:Float64Array;
}
type Branch = {
  positive: number;
  negative: number;
  resistance: number;
  kind: "R" | "L" | "C";
  value: number;
  state: number;
  driver?: number;
};
function solveMany(
  matrix: Float64Array,
  rhs: Float64Array,
  n: number,
  m: number,
) {
  const a = matrix.slice(),
    b = rhs.slice(),
    scales = Array.from({ length: n }, (_, i) =>
      Math.max(...a.subarray(i * n, (i + 1) * n).map(Math.abs)),
    );
  for (let k = 0; k < n; k++) {
    let pivot = k,
      best = 0;
    for (let i = k; i < n; i++) {
      const r = Math.abs(a[i * n + k]) / (scales[i] || 1);
      if (r > best) {
        best = r;
        pivot = i;
      }
    }
    if (best < 1e-13)
      throw Error(
        "Transient circuit is singular or ill-conditioned; check its wiring and component values.",
      );
    if (pivot !== k) {
      for (let j = 0; j < n; j++) {
        const t = a[k * n + j];
        a[k * n + j] = a[pivot * n + j];
        a[pivot * n + j] = t;
      }
      for (let j = 0; j < m; j++) {
        const t = b[k * m + j];
        b[k * m + j] = b[pivot * m + j];
        b[pivot * m + j] = t;
      }
      [scales[k], scales[pivot]] = [scales[pivot], scales[k]];
    }
    const d = a[k * n + k];
    for (let j = k; j < n; j++) a[k * n + j] /= d;
    for (let j = 0; j < m; j++) b[k * m + j] /= d;
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const f = a[i * n + k];
      if (!f) continue;
      for (let j = k; j < n; j++) a[i * n + j] -= f * a[k * n + j];
      for (let j = 0; j < m; j++) b[i * m + j] -= f * b[k * m + j];
    }
  }
  return b;
}
export function filterCoefficients(
  kind: "lowpass" | "highpass",
  order: 1 | 2,
  frequency: number,
  dt: number,
): number[] {
  const w = 2 * Math.PI * frequency,
    q = 2 / dt;
  if (order === 1) {
    const a = (w - q) / (w + q),
      b = kind === "lowpass" ? w / (w + q) : q / (w + q);
    return [b, kind === "lowpass" ? b : -b, 0, a, 0];
  }
  const d = q * q + Math.SQRT2 * w * q + w * w,
    b = kind === "lowpass" ? (w * w) / d : (q * q) / d;
  return [
    b,
    kind === "lowpass" ? 2 * b : -2 * b,
    b,
    (2 * (w * w - q * q)) / d,
    (q * q - Math.SQRT2 * w * q + w * w) / d,
  ];
}
/** MNA companion model, implicit midpoint. The acoustic port matrix is solved in the same system as back EMF and every RLC state. */
export function compileCircuitStep(
  p: Project,
  models: Float64Array,
  port: Float64Array,
  dt: number,
): CircuitStep {
  const mounts = p.mounts ?? [
    {
      id: "primary",
      driver: p.driver,
      position: p.design.driverPosition,
      face: "front" as const,
      voltageScale: 1,
      phase: 0,
    },
  ];
  const t = circuitTopology(
    circuitFromProject(p),
    mounts.map((m) => m.id),
  );
  if (t.issues.length) throw Error(t.issues[0]);
  const nd = mounts.length,
    branches: Branch[] = [],
    coilRows: number[] = [];
  let stateCount = 2 * nd,
    nodeCount = t.nodeCount;
  const branch = (
    positive: number,
    negative: number,
    kind: Branch["kind"],
    value: number,
    resistance: number,
    driver?: number,
  ) => {
    const state = kind === "R" ? -1 : stateCount++;
    branches.push({
      positive,
      negative,
      kind,
      value,
      resistance,
      state,
      driver,
    });
    return branches.length - 1;
  };
  for (const { part, positive, negative } of t.parts)
    branch(
      positive,
      negative,
      part.kind as Branch["kind"],
      part.value!,
      part.kind === "R" ? part.value! : (part.resistance ?? 0),
    );
  mounts.forEach((mount, d) => {
    const port = t.drivers.find((p) => p.part.mountId === mount.id)!,
      loss = mount.driver.lossyInductance,
      end = loss ? nodeCount++ : port.negative;
    coilRows.push(
      branch(
        port.positive,
        end,
        mount.driver.le > 0 ? "L" : "R",
        mount.driver.le > 0 ? mount.driver.le * 1e-3 : mount.driver.re,
        mount.driver.re,
        d,
      ),
    );
    if (loss) {
      branch(end, port.negative, "R", loss.resistance, loss.resistance);
      branch(end, port.negative, "L", loss.inductance * 1e-3, 0);
    }
  });
  const nm = nodeCount,
    na = t.inputs.length,
    n = nm + branches.length + na + nd,
    velocityStart = nm + branches.length + na,
    m = stateCount + na + nd;
  if (m > 160 || stateCount + 3 * nd > 160)
    throw Error(
      "The crossover has too many dynamic states for this field kernel.",
    );
  const a = new Float64Array(n * n),
    b = new Float64Array(n * m),
    stamp = (r: number, c: number, v: number) => {
      if (r >= 0 && c >= 0) a[r * n + c] += v;
    };
  const connect = (positive: number, negative: number, row: number) => {
    for (const [node, sign] of [
      [positive, 1],
      [negative, -1],
    ]) {
      stamp(node, row, sign);
      stamp(row, node, sign);
    }
  };
  branches.forEach((e, i) => {
    const row = nm + i;
    connect(e.positive, e.negative, row);
    const z =
      e.resistance +
      (e.kind === "L"
        ? (2 * e.value) / dt
        : e.kind === "C"
          ? dt / (2 * e.value)
          : 0);
    stamp(row, row, -z);
    if (e.kind === "L") b[row * m + e.state] = (-2 * e.value) / dt;
    else if (e.kind === "C") b[row * m + e.state] = 1;
    if (e.driver !== undefined) {
      const bl = models[e.driver * 9 + 3];
      stamp(row, velocityStart + e.driver, -bl);
      stamp(velocityStart + e.driver, row, -bl);
    }
  });
  t.inputs.forEach((e, i) => {
    const row = nm + branches.length + i;
    connect(e.positive, e.negative, row);
    b[row * m + stateCount + i] = 1;
  });
  for (let d = 0; d < nd; d++) {
    const at = d * 9,
      row = velocityStart + d;
    for (let j = 0; j < nd; j++)
      stamp(row, velocityStart + j, port[d * nd + j]);
    stamp(
      row,
      row,
      (2 * models[at]) / dt + models[at + 1] + dt / (2 * models[at + 2]),
    );
    b[row * m + 2 * d] = -1 / models[at + 2];
    b[row * m + 2 * d + 1] = (2 * models[at]) / dt;
    b[row * m + stateCount + na + d] = -models[at + 6];
  }
  const x = solveMany(a, b, n, m),
    rows = 3 * nd + stateCount,
    map = new Float64Array(rows * m);
  const addRow = (dest: number, src: number, factor: number) => {
    if (src < 0) return;
    for (let k = 0; k < m; k++) map[dest * m + k] += factor * x[src * m + k];
  };
  mounts.forEach((mount, d) => {
    const port = t.drivers.find((p) => p.part.mountId === mount.id)!;
    addRow(d, velocityStart + d, 1);
    addRow(nd + d, nm + coilRows[d], 1);
    addRow(2 * nd + d, port.positive, 1);
    addRow(2 * nd + d, port.negative, -1);
    addRow(3 * nd + 2 * d, velocityStart + d, dt);
    map[(3 * nd + 2 * d) * m + 2 * d] += 1;
    addRow(3 * nd + 2 * d + 1, velocityStart + d, 2);
    map[(3 * nd + 2 * d + 1) * m + 2 * d + 1] -= 1;
  });
  branches.forEach((e, i) => {
    if (e.state < 0) return;
    const row = 3 * nd + e.state;
    addRow(row, nm + i, e.kind === "L" ? 2 : dt / e.value);
    map[row * m + e.state] += e.kind === "L" ? -1 : 1;
  });
  const storageWeights=new Float64Array(stateCount);
  for(let d=0;d<nd;d++){storageWeights[2*d]=1/models[9*d+2];storageWeights[2*d+1]=models[9*d];}
  for(const e of branches)if(e.state>=0)storageWeights[e.state]=e.value;
  const filters: number[] = [],
    drives: number[] = [];
  for (const { part } of t.inputs) {
    const start = filters.length / 5;
    for (const f of part.active ?? [])
      filters.push(...filterCoefficients(f.kind, f.order, f.frequency, dt));
    drives.push(
      part.gain ?? 1,
      ((part.phase ?? 0) * Math.PI) / 180,
      (part.active ?? []).length,
      start,
    );
  }
  return {
    stateCount,
    inputLength: m,
    driveCount: na,
    filterCount: filters.length / 5,
    transform: map,
    drives: Float64Array.from(drives),
    filters: Float64Array.from(filters),
    storageWeights,
  };
}
export class CircuitState {
  readonly state: Float64Array;
  readonly filterState: Float64Array;
  readonly input: Float64Array;
  readonly output: Float64Array;
  constructor(
    readonly model: CircuitStep,
    readonly drivers: number,
  ) {
    this.state = new Float64Array(model.stateCount);
    this.filterState = new Float64Array(model.filterCount * 2);
    this.input = new Float64Array(model.inputLength);
    this.output = new Float64Array(3 * drivers + model.stateCount);
  }
  step(
    voltage: (gain: number, phase: number) => number,
    pressure: Float64Array,
  ) {
    const c = this.model,
      input = this.input;
    input.set(this.state);
    for (let i = 0; i < c.driveCount; i++) {
      const at = i * 4;
      let v = voltage(c.drives[at], c.drives[at + 1]);
      for (let j = 0; j < c.drives[at + 2]; j++) {
        const f = c.drives[at + 3] + j,
          k = f * 5,
          s = 2 * f,
          y = c.filters[k] * v + this.filterState[s];
        this.filterState[s] =
          c.filters[k + 1] * v - c.filters[k + 3] * y + this.filterState[s + 1];
        this.filterState[s + 1] = c.filters[k + 2] * v - c.filters[k + 4] * y;
        v = y;
      }
      input[c.stateCount + i] = v;
    }
    input.set(pressure, c.stateCount + c.driveCount);
    for (let r = 0; r < this.output.length; r++) {
      let v = 0;
      for (let k = 0; k < c.inputLength; k++)
        v += c.transform[r * c.inputLength + k] * input[k];
      this.output[r] = v;
    }
    this.state.set(this.output.subarray(3 * this.drivers));
    return this.output;
  }
}
