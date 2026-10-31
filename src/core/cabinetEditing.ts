import type { Project, Driver, XYZ } from "./types";
import { buildGeometry, editableLayout } from "./geometry";
import { drivers } from "./defaults";
export function cabinetDraft(project: Project): Project {
  const g = buildGeometry(project),
    p = editableLayout(project);
  p.mounts = g.mounts.map((m) => ({
    id: m.id,
    driver: structuredClone(m.driver),
    position: m.position,
    face: m.face,
    voltageScale: m.voltageScale,
    phase: m.phase,
    at:
      m.at ??
      (m.face === "front" || m.face === "back"
        ? [m.center[0], m.center[1]]
        : m.face === "left" || m.face === "right"
          ? [m.center[2], m.center[1]]
          : [m.center[0], m.center[2]]),
  }));
  return p;
}
export function freeBoard(p: Project, id: string): Project {
  const next = structuredClone(p),
    b = next.layout!.baffles.find((b) => b.id === id),
    panel = buildGeometry(p, true).panels.find((q) => q.id === id);
  if (b && panel && !b.pose)
    b.pose = {
      center: [...panel.position],
      size: [panel.width, panel.height],
      rotation: [...panel.rotation],
    };
  return next;
}
export function foldedMultiway(source: Project): Project {
  const p = structuredClone(source),
    t = 18;
  const tweeter: Driver = {
    id: "demo-hf",
    name: "Dome 25 · example",
    note: "Synthetic rigid-piston high-frequency example; no crossover or dome breakup model.",
    fs: 900,
    qes: 0.7,
    qms: 3,
    vas: 0.015,
    re: 5.6,
    le: 0.04,
    sd: 5,
    xmax: 0.25,
    cutout: 60,
    frame: 80,
    depth: 30,
  };
  p.name = "Multiway folded cabinet · example";
  p.driver = { ...drivers[2] };
  p.design = { ...p.design, thickness: t, voltage: 1 };
  p.layout = {
    width: 420,
    height: 1200,
    depth: 360,
    mouth: {
      side: "front",
      center: [290, 60],
      offset: 60,
      width: 140,
      height: 65,
    },
    route: [
      [110, 700],
      [110, 150],
      [290, 150],
      [290, 1060],
      [360, 1060],
      [360, 60],
      [290, 60],
    ],
    baffles: [
      {
        id: "chamber-shelf",
        label: "Mid / HF chamber floor",
        start: [0, 720],
        end: [216, 720],
        thickness: t,
      },
      {
        id: "chamber-wall",
        label: "Mid / HF chamber wall",
        start: [225, 720],
        end: [225, 1164],
        thickness: t,
      },
      {
        id: "fold-one",
        label: "First line fold",
        start: [225, 180],
        end: [225, 702],
        thickness: t,
      },
      {
        id: "fold-two",
        label: "Second line fold",
        start: [320, 0],
        end: [320, 1000],
        thickness: t,
      },
    ],
  };
  p.mounts = [
    {
      id: "primary",
      driver: { ...drivers[2] },
      position: 0.1,
      face: "front",
      at: [128, 465],
      voltageScale: 1,
      phase: 0,
    },
    {
      id: "midrange",
      driver: { ...drivers[1] },
      position: 0.2,
      face: "front",
      at: [128, 875],
      voltageScale: 1,
      phase: 0,
    },
    {
      id: "high-frequency",
      driver: tweeter,
      position: 0.3,
      face: "front",
      at: [128, 1070],
      voltageScale: 1,
      phase: 0,
    },
  ];
  return p;
}
export const xyzLabels = ["X", "Y", "Z"];
export const degrees = (r: XYZ) => r.map((v) => (v * 180) / Math.PI) as XYZ;
