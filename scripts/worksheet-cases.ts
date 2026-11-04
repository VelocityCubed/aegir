import type { Project } from "../src/core/types";
import { circuitFromProject } from "../src/core/circuit";
/** Research input adapter only. No worksheet-specific branches in any solver. */
export function worksheetCases(base: Project) {
  const common = structuredClone(base);
  delete common.circuit;
  common.system!.references = [];
  delete common.system!.modalReference;
  common.system!.air = {
    densityKgM3: 1.205,
    soundSpeedMs: 344,
    source: "King Anechoic_Passive/Active.pdf p1, 2023-09-19",
  };
  common.system!.numerics = { lineStepMm: 10 };
  common.design.voltage = Math.sqrt(8);
  const [w, t] = common.mounts!;
  w.crossover!.passive![0].value = 0.00338;
  w.crossover!.passive![1].value = 36.7e-6;
  w.acousticOffsetMm = [0, 0, 42];
  t.driver.le = 0.02;
  t.driver.note +=
    " Worksheet-specific Le0.02mH (passive p1); other driver specifications retained from the report.";
  t.at = [165.1, 850.9];
  common.system!.observation!.positionMm = [165.1, 850.9, -3000];
  const cable = (p: Project, shared: boolean) => {
    p.circuit = circuitFromProject(p);
    const amps = p.circuit.parts.filter((part) => part.kind === "input");
    if (shared && amps.length !== 1)
      throw Error("Shared cable case requires one input");
    if (shared) {
      const amp = amps[0];
      p.circuit.parts.push({
        id: "cable",
        kind: "R",
        label: "Cable 0.5Ω",
        value: 0.5,
        at: [220, 70],
        rotation: 0,
      });
      p.circuit.wires.forEach((wire) => {
        if (wire.from.part === amp.id && wire.from.pin === "a")
          wire.from = { part: "cable", pin: "b" };
        if (wire.to.part === amp.id && wire.to.pin === "a")
          wire.to = { part: "cable", pin: "b" };
      });
      p.circuit.wires.push({
        id: "cable-feed",
        from: { part: amp.id, pin: "a" },
        to: { part: "cable", pin: "a" },
      });
    } else {
      // A separate lead per driver; trace interpretation retained as an ablation.
      for (const [i, d] of p.circuit.parts
        .filter((part) => part.kind === "driver")
        .entries()) {
        const id = "lead" + i;
        p.circuit.parts.push({
          id,
          kind: "R",
          label: "Lead 0.5Ω",
          value: 0.5,
          at: [d.at[0] - 100, d.at[1] + 60],
          rotation: 0,
        });
        p.circuit.wires.forEach((wire) => {
          if (wire.from.part === d.id && wire.from.pin === "a")
            wire.from = { part: id, pin: "a" };
          if (wire.to.part === d.id && wire.to.pin === "a")
            wire.to = { part: id, pin: "a" };
        });
        p.circuit.wires.push({
          id: id + "-driver",
          from: { part: id, pin: "b" },
          to: { part: d.id, pin: "a" },
        });
      }
    }
    p.mounts!.forEach((m) => delete m.crossover);
    return p;
  };
  const passive = structuredClone(common);
  passive.name = "MJK Satori · passive worksheet · cable placement assumed";
  cable(passive, true);
  const noCable = structuredClone(common);
  noCable.name = "MJK Satori · passive worksheet · cable bypass diagnostic";
  noCable.circuit = circuitFromProject(noCable);
  noCable.mounts!.forEach((m) => delete m.crossover);
  const branchCable = structuredClone(common);
  branchCable.name = "MJK Satori · passive worksheet · branch-lead diagnostic";
  cable(branchCable, false);
  const active = structuredClone(common);
  active.name = "MJK Satori · active worksheet";
  active.mounts![0].crossover = {
    active: [{ kind: "lowpass", frequency: 200, order: 1 }],
  };
  active.mounts![1].crossover = {
    active: [{ kind: "highpass", frequency: 1600, order: 2 }],
  };
  active.mounts![1].voltageScale = 10 ** (-10 / 20);
  cable(active, false);
  return { passive, noCable, branchCable, active };
}
