import type { Project, DriverMount, XY } from "./types";
import {
  circuitSchema,
  type Circuit,
  type CircuitPart,
  type CircuitPin,
  type CircuitWire,
} from "./circuit-schema";
import { abs, add, sub, mul, div, scale, type C } from "./complex";
import { elementImpedance, activeTransfer } from "./crossover";
import {
  complexMatrix,
  complexVector,
  solveComplex,
  stampAdmittance,
} from "./linear";
export const pinKey = (p: CircuitPin) => p.part + ":" + p.pin;
export function pins(part: CircuitPart): ("a" | "b")[] {
  return part.kind === "ground" || part.kind === "junction"
    ? ["a"]
    : ["a", "b"];
}
export function pinPosition(part: CircuitPart, pin: "a" | "b"): XY {
  const local: XY =
    part.kind === "ground"
      ? [0, -20]
      : part.kind === "junction"
        ? [0, 0]
        : part.kind === "driver"
          ? [-60, pin === "a" ? -20 : 20]
          : part.kind === "input"
            ? [60, pin === "a" ? -20 : 20]
            : [pin === "a" ? -60 : 60, 0];
  const r = (part.rotation * Math.PI) / 180;
  return [
    part.at[0] + local[0] * Math.cos(r) - local[1] * Math.sin(r),
    part.at[1] + local[0] * Math.sin(r) + local[1] * Math.cos(r),
  ];
}
export function wirePoints(w: CircuitWire, c: Circuit): XY[] {
  const a = pinPosition(
      c.parts.find((p) => p.id === w.from.part)!,
      w.from.pin,
    ),
    b = pinPosition(
      c.parts.find((p) => p.id === w.to.part)!,
      w.to.pin,
    );
  if (w.route === "vertical") {
    const mid = w.bend ?? (a[1] + b[1]) / 2;
    return [a, [a[0], mid], [b[0], mid], b];
  }
  const mid = w.bend ?? (a[0] + b[0]) / 2;
  return [a, [mid, a[1]], [mid, b[1]], b];
}
export const wirePath = (w: CircuitWire, c: Circuit) =>
  wirePoints(w, c)
    .map((p, i) => (i ? "L" : "M") + p.join(","))
    .join(" ");
export function circuitMounts(p: Project): DriverMount[] {
  return (
    p.mounts ?? [
      {
        id: "primary",
        driver: p.driver,
        position: p.design.driverPosition,
        face: "front",
        voltageScale: 1,
        phase: 0,
      },
    ]
  );
}
export function circuitFromProject(p: Project): Circuit {
  if (p.circuit) return structuredClone(p.circuit);
  const parts: CircuitPart[] = [],
    wires: CircuitWire[] = [],
    counts = { R: 0, L: 0, C: 0 },
    amps = new Map<string, CircuitPart>();
  let wi = 0;
  const wire = (
    from: CircuitPin,
    to: CircuitPin,
    route?: "horizontal" | "vertical",
    bend?: number,
  ) => {
    if (
      !wires.some(
        (w) => pinKey(w.from) === pinKey(from) && pinKey(w.to) === pinKey(to),
      )
    )
      wires.push({
        id: "w" + ++wi,
        from,
        to,
        ...(route ? { route } : {}),
        ...(bend === undefined ? {} : { bend }),
      });
  };
  const mounts = circuitMounts(p),
    bottom = 130 + (mounts.length - 1) * 150 + 170;
  const ground: CircuitPart = {
    id: "ground",
    kind: "ground",
    label: "Return",
    at: [200, bottom + 20],
    rotation: 0,
  };
  parts.push(ground);
  mounts.forEach((m, i) => {
    const key = JSON.stringify([
      m.voltageScale,
      m.phase,
      m.crossover?.active ?? [],
    ]);
    let amp = amps.get(key);
    if (!amp) {
      amp = {
        id: "amp" + (amps.size + 1),
        kind: "input",
        label: "Amplifier " + (amps.size + 1),
        at: [100, 130 + amps.size * 170],
        rotation: 0,
        gain: m.voltageScale,
        phase: m.phase,
        ...(m.crossover?.active?.length
          ? { active: structuredClone(m.crossover.active) }
          : {}),
      };
      parts.push(amp);
      amps.set(key, amp);
    }
    const y = 130 + i * 150;
    wire(
      { part: amp.id, pin: "b" },
      { part: ground.id, pin: "a" },
      "vertical",
      bottom,
    );
    let previous: CircuitPin = { part: amp.id, pin: "a" },
      column = 0;
    for (const e of m.crossover?.passive ?? []) {
      const series = e.connection === "series",
        at: XY = [320 + column * 170, series ? y - 20 : y + 75],
        id = e.kind + ++counts[e.kind];
      const part: CircuitPart = {
        id,
        kind: e.kind,
        label: id,
        at,
        rotation: series ? 0 : 90,
        value: e.value,
        ...(e.resistance === undefined ? {} : { resistance: e.resistance }),
      };
      parts.push(part);
      wire(previous, { part: id, pin: "a" });
      if (series) previous = { part: id, pin: "b" };
      else
        wire(
          { part: id, pin: "b" },
          { part: ground.id, pin: "a" },
          "vertical",
          bottom,
        );
      column++;
    }
    const driver: CircuitPart = {
      id: "driver" + i,
      kind: "driver",
      label: m.driver.name.split(" · ")[0],
      mountId: m.id,
      at: [Math.max(700, 340 + column * 170), y],
      rotation: 0,
    };
    parts.push(driver);
    wire(previous, { part: driver.id, pin: "a" });
    wire(
      { part: driver.id, pin: "b" },
      { part: ground.id, pin: "a" },
      "vertical",
      bottom,
    );
  });
  return { version: 1, parts, wires };
}
export type Topology = {
  circuit: Circuit;
  nodes: Map<string, number>;
  nodeCount: number;
  parts: { part: CircuitPart; positive: number; negative: number }[];
  inputs: { part: CircuitPart; positive: number; negative: number }[];
  drivers: { part: CircuitPart; positive: number; negative: number }[];
  issues: string[];
};
export function circuitTopology(c: Circuit, mountIds?: string[]): Topology {
  circuitSchema.parse(c);
  const issues: string[] = [],
    parent = new Map<string, string>(),
    degrees = new Map<string, number>(),
    ids = new Set<string>();
  for (const p of c.parts) {
    if (ids.has(p.id)) issues.push("Duplicate part ID " + p.id + ".");
    ids.add(p.id);
    for (const pin of pins(p))
      parent.set(pinKey({ part: p.id, pin }), pinKey({ part: p.id, pin }));
  }
  const find = (x: string): string => {
    const a = parent.get(x);
    if (a === undefined) throw Error("Wire refers to a missing terminal: " + x);
    if (a === x) return x;
    const r = find(a);
    parent.set(x, r);
    return r;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));
  const wireIds = new Set<string>();
  for (const w of c.wires) {
    if (wireIds.has(w.id)) issues.push("Duplicate wire ID " + w.id + ".");
    wireIds.add(w.id);
    const a = pinKey(w.from),
      b = pinKey(w.to);
    if (!parent.has(a) || !parent.has(b)) {
      issues.push("A wire has a missing terminal.");
      continue;
    }
    if (a === b) issues.push("A wire connects a terminal to itself.");
    union(a, b);
    degrees.set(a, (degrees.get(a) ?? 0) + 1);
    degrees.set(b, (degrees.get(b) ?? 0) + 1);
  }
  const grounds = c.parts
    .filter((p) => p.kind === "ground")
    .map((p) => pinKey({ part: p.id, pin: "a" }));
  grounds.slice(1).forEach((g) => union(grounds[0], g));
  for (const p of c.parts)
    for (const pin of pins(p))
      if (!degrees.get(pinKey({ part: p.id, pin })))
        issues.push(
          `${p.label || p.id}: connect ${pins(p).length === 1 ? "the terminal" : pin === "a" ? "the + / first terminal" : "the − / second terminal"}.`,
        );
  const inputParts = c.parts.filter((p) => p.kind === "input"),
    driverParts = c.parts.filter((p) => p.kind === "driver");
  if (!inputParts.length) issues.push("Add an amplifier input.");
  if (inputParts.length > 8)
    issues.push("At most eight amplifier inputs are supported.");
  if (!driverParts.length) issues.push("Add a driver terminal.");
  const assigned = new Set<string>();
  for (const p of driverParts) {
    if (assigned.has(p.mountId!))
      issues.push("Each cabinet driver can appear only once.");
    assigned.add(p.mountId!);
    if (mountIds && !mountIds.includes(p.mountId!))
      issues.push(`${p.label}: choose a driver that exists in the cabinet.`);
  }
  mountIds
    ?.filter((id) => !assigned.has(id))
    .forEach((id) =>
      issues.push("Add the cabinet driver " + id + " to this circuit."),
    );
  const roots = [...new Set([...parent.keys()].map(find))],
    adj = new Map(roots.map((r) => [r, new Set<string>()]));
  const branches = c.parts
    .filter((p) => pins(p).length === 2)
    .map((part) => ({
      part,
      a: find(part.id + ":a"),
      b: find(part.id + ":b"),
    }));
  for (const { part, a, b } of branches) {
    if (a === b)
      issues.push(`${part.label}: its two terminals are shorted together.`);
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  }
  const groups: string[][] = [],
    seen = new Set<string>();
  for (const r of roots) {
    if (seen.has(r)) continue;
    const group = [r];
    seen.add(r);
    for (let i = 0; i < group.length; i++)
      for (const x of adj.get(group[i])!) {
        if (!seen.has(x)) {
          group.push(x);
          seen.add(x);
        }
      }
    groups.push(group);
  }
  const refs = new Set<string>();
  for (const group of groups) {
    const source = branches.find(
      (p) => p.part.kind === "input" && group.includes(p.a),
    );
    if (!source) {
      issues.push("A disconnected island has no amplifier input.");
      refs.add(group[0]);
    } else
      refs.add(grounds.map(find).find((g) => group.includes(g)) ?? source.b);
  }
  // A driver requires a closed path through the remaining network, not just two wires on a floating chain.
  for (const d of branches.filter((p) => p.part.kind === "driver")) {
    const reached = new Set([d.a]),
      queue = [d.a];
    for (let i = 0; i < queue.length; i++)
      for (const b of branches) {
        if (b === d) continue;
        const next = b.a === queue[i] ? b.b : b.b === queue[i] ? b.a : null;
        if (next && !reached.has(next)) {
          reached.add(next);
          queue.push(next);
        }
      }
    if (!reached.has(d.b))
      issues.push(`${d.part.label}: complete a return path to the amplifier.`);
  }
  const rootNumbers = new Map<string, number>();
  let nodeCount = 0;
  roots.forEach((r) => rootNumbers.set(r, refs.has(r) ? -1 : nodeCount++));
  const nodes = new Map(
    [...parent.keys()].map((k) => [k, rootNumbers.get(find(k))!]),
  );
  const mapped = branches.map(({ part }) => ({
    part,
    positive: nodes.get(part.id + ":a")!,
    negative: nodes.get(part.id + ":b")!,
  }));
  return {
    circuit: c,
    nodes,
    nodeCount,
    parts: mapped.filter((p) => ["R", "L", "C"].includes(p.part.kind)),
    inputs: mapped.filter((p) => p.part.kind === "input"),
    drivers: mapped.filter((p) => p.part.kind === "driver"),
    issues: [...new Set(issues)],
  };
}
export type ElectricalLoad = { id: string; impedance: C; backEmf?: C };
export function inputVoltage(part: CircuitPart, f: number, voltage: number): C {
  return mul(
    scale(
      [
        Math.cos(((part.phase ?? 0) * Math.PI) / 180),
        Math.sin(((part.phase ?? 0) * Math.PI) / 180),
      ],
      voltage * (part.gain ?? 1),
    ),
    activeTransfer({ active: part.active }, f),
  );
}
export function stampCircuit(
  topology: Topology,
  f: number,
  voltage: number,
  loads: ElectricalLoad[],
  matrix: C[][],
  rhs: C[],
  offset = 0,
  velocityIndices?: number[],
  bl?: number[],
) {
  if (topology.issues.length) throw Error(topology.issues[0]);
  const { nodeCount, parts, inputs, drivers } = topology;
  const node = (n: number) => (n < 0 ? -1 : offset + n);
  for (const { part, positive, negative } of parts)
    stampAdmittance(
      matrix,
      node(positive),
      node(negative),
      div(
        [1, 0],
        elementImpedance(
          {
            connection: "series",
            kind: part.kind as "R" | "L" | "C",
            value: part.value!,
            resistance: part.resistance,
          },
          f,
        ),
      ),
    );
  const branch = (positive: number, negative: number, row: number) => {
    for (const [n, sign] of [
      [positive, 1],
      [negative, -1],
    ])
      if (n >= 0) {
        matrix[node(n)][row] = add(matrix[node(n)][row], [sign, 0]);
        matrix[row][node(n)] = add(matrix[row][node(n)], [sign, 0]);
      }
  };
  const ordered = loads.map((load) => {
    const d = drivers.find((d) => d.part.mountId === load.id);
    if (!d) throw Error("Circuit has no driver terminal for " + load.id);
    return d;
  });
  ordered.forEach((d, i) => {
    const row = offset + nodeCount + i;
    branch(d.positive, d.negative, row);
    matrix[row][row] = sub(matrix[row][row], loads[i].impedance);
    rhs[row] = loads[i].backEmf ?? [0, 0];
    if (velocityIndices) {
      matrix[row][velocityIndices[i]] = sub(matrix[row][velocityIndices[i]], [
        bl![i],
        0,
      ]);
      matrix[velocityIndices[i]][row] = sub(matrix[velocityIndices[i]][row], [
        bl![i],
        0,
      ]);
    }
  });
  inputs.forEach((d, i) => {
    const row = offset + nodeCount + loads.length + i;
    branch(d.positive, d.negative, row);
    rhs[row] = inputVoltage(d.part, f, voltage);
  });
  return {
    ordered,
    node,
    driverOffset: offset + nodeCount,
    inputOffset: offset + nodeCount + loads.length,
  };
}
export function readCircuit(
  topology: Topology,
  loadIds: string[],
  solution: C[],
  f: number,
  voltage: number,
  offset = 0,
) {
  const nodeVoltage = (n: number): C => (n < 0 ? [0, 0] : solution[offset + n]);
  const drivers = loadIds.map((id, i) => {
    const d = topology.drivers.find((d) => d.part.mountId === id)!;
    return {
      id,
      voltage: sub(nodeVoltage(d.positive), nodeVoltage(d.negative)),
      current: solution[offset + topology.nodeCount + i],
    };
  });
  const inputs = topology.inputs.map((a, i) => {
    const v = inputVoltage(a.part, f, voltage),
      current = scale(
        solution[offset + topology.nodeCount + loadIds.length + i],
        -1,
      );
    return {
      id: a.part.id,
      voltage: v,
      current,
      impedance: abs(current) > 1e-14 ? div(v, current) : null,
    };
  });
  return { drivers, inputs };
}
export function solveCircuit(
  circuit: Circuit,
  f: number,
  voltage: number,
  loads: ElectricalLoad[],
) {
  const topology = circuitTopology(
    circuit,
    loads.map((l) => l.id),
  );
  const n = topology.nodeCount + loads.length + topology.inputs.length,
    a = complexMatrix(n),
    b = complexVector(n);
  stampCircuit(topology, f, voltage, loads, a, b);
  return readCircuit(
    topology,
    loads.map((l) => l.id),
    solveComplex(a, b),
    f,
    voltage,
  );
}
export function circuitElectricalKey(c: Circuit) {
  return JSON.stringify({
    parts: c.parts.map(({ at, rotation, label, ...p }) => p),
    wires: c.wires.map(({ id, from, to }) => ({ id, from, to })),
  });
}
export function componentValue(p: CircuitPart): string {
  if (p.kind === "R") return `${Number(p.value!.toPrecision(4))} Ω`;
  if (p.kind === "L") return `${Number((p.value! * 1000).toPrecision(4))} mH`;
  if (p.kind === "C") return `${Number((p.value! * 1e6).toPrecision(4))} µF`;
  if (p.kind === "input") return `${p.gain ?? 1}× · ${p.phase ?? 0}°`;
  return "";
}
