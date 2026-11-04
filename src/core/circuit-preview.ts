import type { Project } from "./types";
import type { Circuit } from "./circuit-schema";
import { circuitMounts, solveCircuit, circuitTopology } from "./circuit";
import { driverModel } from "./acoustics";
import { coilImpedance } from "./crossover";
import { add, div, abs, type C } from "./complex";
export function previewCircuit(p: Project, circuit: Circuit, count = 160) {
  const mounts = circuitMounts(p),
    topology = circuitTopology(
      circuit,
      mounts.map((m) => m.id),
    );
  if (topology.issues.length) return { issues: topology.issues, points: [] };
  const models = mounts.map((m) =>
    driverModel({ ...p, driver: m.driver }, m.rearLoading),
  );
  try {
    const points = Array.from({ length: count }, (_, i) => {
      const f = 20 * 1000 ** (i / (count - 1)),
        w = 2 * Math.PI * f;
      const result = solveCircuit(
        circuit,
        f,
        p.design.voltage,
        mounts.map((m, j) => {
          const d = models[j],
            zm: C = [d.rms, w * d.mms - 1 / (w * d.cms)];
          return {
            id: m.id,
            impedance: add(
              coilImpedance(m.driver, f),
              div([d.bl * d.bl, 0], zm),
            ),
          };
        }),
      );
      return {
        frequency: f,
        drivers: result.drivers.map((d) => ({
          id: d.id,
          voltage: abs(d.voltage),
          db:
            20 * Math.log10(Math.max(1e-12, abs(d.voltage)) / p.design.voltage),
          phase: (Math.atan2(d.voltage[1], d.voltage[0]) * 180) / Math.PI,
          current: abs(d.current),
        })),
        inputs: result.inputs.map((a) => ({
          id: a.id,
          impedance: a.impedance ? abs(a.impedance) : null,
        })),
      };
    });
    return { issues: [] as string[], points };
  } catch (e) {
    return { issues: [(e as Error).message], points: [] };
  }
}
export type CircuitPreviewResult = ReturnType<typeof previewCircuit>;
