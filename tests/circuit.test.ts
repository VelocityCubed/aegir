import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { circuitSchema, type Circuit } from "../src/core/circuit-schema";
import {
  circuitFromProject,
  circuitTopology,
  circuitElectricalKey,
  solveCircuit,
} from "../src/core/circuit";
import { defaultProject } from "../src/core/defaults";
import { simulate } from "../src/core/acoustics";
import { abs, add, sub, div, mul } from "../src/core/complex";
const divider = (): Circuit => ({
  version: 1,
  parts: [
    {
      id: "amp",
      kind: "input",
      label: "Input",
      at: [0, 0],
      rotation: 0,
      gain: 1,
      phase: 0,
    },
    { id: "r", kind: "R", label: "R1", value: 4, at: [200, 0], rotation: 0 },
    {
      id: "d",
      kind: "driver",
      label: "Driver",
      mountId: "primary",
      at: [400, 0],
      rotation: 0,
    },
  ],
  wires: [
    { id: "w1", from: { part: "amp", pin: "a" }, to: { part: "r", pin: "a" } },
    { id: "w2", from: { part: "r", pin: "b" }, to: { part: "d", pin: "a" } },
    { id: "w3", from: { part: "d", pin: "b" }, to: { part: "amp", pin: "b" } },
  ],
});
describe("drawn crossover circuit", () => {
  it("matches an independent loaded voltage divider and input impedance", () => {
    const result = solveCircuit(divider(), 123, 3, [
      { id: "primary", impedance: [8, 0] },
    ]);
    expect(result.drivers[0].voltage[0]).toBeCloseTo(2, 12);
    expect(result.drivers[0].current[0]).toBeCloseTo(0.25, 12);
    expect(result.inputs[0].impedance![0]).toBeCloseTo(12, 12);
  });
  it("solves shared series components and parallel driver branches with Kirchhoff conservation", () => {
    const c = divider();
    c.parts.push({
      id: "d2",
      kind: "driver",
      label: "Second driver",
      mountId: "second",
      at: [400, 200],
      rotation: 0,
    });
    c.wires.push(
      { id: "p1", from: { part: "d", pin: "a" }, to: { part: "d2", pin: "a" } },
      { id: "p2", from: { part: "d", pin: "b" }, to: { part: "d2", pin: "b" } },
    );
    const r = solveCircuit(c, 400, 4, [
      { id: "primary", impedance: [8, 0] },
      { id: "second", impedance: [8, 0] },
    ]);
    expect(r.drivers[0].voltage[0]).toBeCloseTo(2, 12);
    expect(r.drivers[1].voltage[0]).toBeCloseTo(2, 12);
    expect(r.inputs[0].impedance![0]).toBeCloseTo(8, 12);
    expect(
      abs(
        sub(
          r.inputs[0].current,
          add(r.drivers[0].current, r.drivers[1].current),
        ),
      ),
    ).toBeLessThan(1e-12);
  });
  it("matches the analytic response of a series inductor and a parallel RLC trap with ESR", () => {
    const c = divider();
    c.parts[1] = { ...c.parts[1], kind: "L", value: 0.001, resistance: 0.35 };
    c.parts.push({
      id: "cap",
      kind: "C",
      label: "C1",
      at: [200, 150],
      rotation: 90,
      value: 10e-6,
      resistance: 0.1,
    });
    c.wires.push(
      {
        id: "c1",
        from: { part: "r", pin: "b" },
        to: { part: "cap", pin: "a" },
      },
      {
        id: "c2",
        from: { part: "amp", pin: "b" },
        to: { part: "cap", pin: "b" },
      },
    );
    for (const f of [20, 200, 2000, 20000]) {
      const w = 2 * Math.PI * f,
        zc: [number, number] = [0.1, -1 / (w * 10e-6)],
        zparallel = div(mul([8, 0], zc), add([8, 0], zc)),
        z = add([0.35, w * 0.001], zparallel),
        expected = div(zparallel, z),
        r = solveCircuit(c, f, 1, [{ id: "primary", impedance: [8, 0] }]);
      expect(abs(sub(r.drivers[0].voltage, expected))).toBeLessThan(1e-10);
      expect(abs(sub(r.inputs[0].impedance!, z))).toBeLessThan(1e-8);
    }
  });
  it("treats crossings and visual moves as layout, not hidden electrical connections", () => {
    const c = divider(),
      key = circuitElectricalKey(c),
      before = solveCircuit(c, 1200, 1, [{ id: "primary", impedance: [8, 3] }]);
    c.parts[1].at = [400, 900];
    c.parts[1].rotation = 90;
    c.wires[0].route = "vertical";
    c.wires[0].bend = 400;
    expect(circuitElectricalKey(c)).toBe(key);
    expect(
      solveCircuit(c, 1200, 1, [{ id: "primary", impedance: [8, 3] }]),
    ).toEqual(before);
  });
  it("rejects disconnected parts, floating return paths, missing drivers and shorted ideal sources", () => {
    const c = divider();
    c.wires.pop();
    expect(circuitTopology(c, ["primary"]).issues.length).toBeGreaterThan(0);
    expect(() =>
      solveCircuit(c, 200, 1, [{ id: "primary", impedance: [8, 0] }]),
    ).toThrow();
    const short = divider();
    short.wires.push({
      id: "short",
      from: { part: "amp", pin: "a" },
      to: { part: "amp", pin: "b" },
    });
    expect(() =>
      solveCircuit(short, 100, 1, [{ id: "primary", impedance: [8, 0] }]),
    ).toThrow(/shorted/);
    expect(circuitTopology(divider(), ["another"]).issues.join(" ")).toContain(
      "cabinet",
    );
  });
  it("preserves loaded electro-acoustic results when converting a legacy two-way crossover to a drawn circuit", () => {
    const p = JSON.parse(
      readFileSync("examples/satori-upgraded.aegir.json", "utf8"),
    );
    const a = simulate(p, 90);
    p.circuit = circuitFromProject(p);
    circuitSchema.parse(p.circuit);
    expect(
      circuitTopology(
        p.circuit,
        p.mounts.map((m: any) => m.id),
      ).issues,
    ).toEqual([]);
    const b = simulate(p, 90);
    for (let i = 0; i < a.points.length; i++) {
      expect(b.points[i].spl).toBeCloseTo(a.points[i].spl, 7);
      expect(b.points[i].impedance).toBeCloseTo(a.points[i].impedance, 7);
      expect(b.points[i].excursion).toBeCloseTo(a.points[i].excursion, 8);
    }
  });
  it("retains phase and gain when importing independently amplified branches", () => {
    const p = structuredClone(defaultProject);
    p.mounts = [
      {
        id: "primary",
        driver: p.driver,
        position: 0.1,
        face: "front",
        voltageScale: 0.8,
        phase: 180,
      },
      {
        id: "secondary",
        driver: p.driver,
        position: 0.7,
        face: "back",
        voltageScale: 0.4,
        phase: 0,
        crossover: { active: [{ kind: "lowpass", frequency: 100, order: 2 }] },
      },
    ];
    const c = circuitFromProject(p);
    expect(c.parts.filter((p) => p.kind === "input")).toHaveLength(2);
    const r = solveCircuit(c, 100, 2, [
      { id: "primary", impedance: [8, 0] },
      { id: "secondary", impedance: [8, 0] },
    ]);
    expect(r.drivers[0].voltage[0]).toBeCloseTo(-1.6, 10);
    expect(r.drivers[1].voltage[1]).toBeCloseTo(-0.8 / Math.SQRT2, 10);
  });
});
