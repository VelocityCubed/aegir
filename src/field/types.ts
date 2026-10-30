import type { Project } from "../core/types";
export type Axis = "xy" | "xz" | "yz";
export interface FieldSettings {
  cellMm: number;
  paddingMm: number;
  durationMs: number;
  frequency: number;
  signal: "burst" | "tone";
  frames: number;
  axis: Axis;
  slice: number;
  backend: "auto" | "cpu" | "webgpu";
  attenuation: number;
}
export const fieldDefaults: FieldSettings = {
  cellMm: 20,
  paddingMm: 180,
  durationMs: 40,
  frequency: 400,
  signal: "burst",
  frames: 80,
  axis: "xy",
  slice: 0.5,
  backend: "auto",
  attenuation: 0,
};
export interface FieldMeta {
  version: 1;
  project: Project;
  settings: FieldSettings;
  backend: string;
  dimensions: [number, number, number];
  cells: number;
  h: number;
  dt: number;
  steps: number;
  c: number;
  rho: number;
  bulk: number;
  origin: [number, number, number];
  times: number[];
  warnings: string[];
  seconds: number;
  plane: {
    axis: Axis;
    width: number;
    height: number;
    pitchMm: number;
    originMm: [number, number, number];
    u: [number, number, number];
    v: [number, number, number];
  };
  sources: {
    id: string;
    name: string;
    xmax: number;
    sd: number;
    peakExcursion?: number;
    peakCurrent?: number;
  }[];
  probes: { name: string; positionMm: [number, number, number] }[];
  layout: { driverOffset: number; probeOffset: number; total: number };
  quality?: {
    cadCavityLitres: number;
    voxelCavityLitres: number;
    volumeError: number;
    pointsPerWavelength: number;
    pmlCells: number;
    rearAirReachesExterior: boolean;
  };
  pressurePeak: number;
  pressureScale: number;
}
export interface FieldResult {
  meta: FieldMeta;
  data: Float32Array;
  mask: Uint8Array;
}
export interface PreparedField {
  meta: FieldMeta;
  flags: Uint32Array;
  aux: Float64Array;
  sourceCells: Uint32Array;
  weights: Float64Array;
  models: Float64Array;
  chol: Float64Array;
  recordCells: Uint32Array;
  recordMask: Uint8Array;
  recordSteps: Uint32Array;
  probeCells: Uint32Array;
  coeffOffsets: [number, number, number];
}
export type FieldProgress = (value: number) => void;
export function validateFieldSettings(
  input: Partial<FieldSettings>,
): FieldSettings {
  const s = { ...fieldDefaults, ...input };
  for (const [k, lo, hi] of [
    ["cellMm", 6, 40],
    ["paddingMm", 80, 600],
    ["durationMs", 5, 500],
    ["frequency", 20, 2000],
    ["frames", 12, 160],
    ["slice", 0, 1],
    ["attenuation", 0, 2],
  ] as const)
    if (!Number.isFinite(s[k]) || s[k] < lo || s[k] > hi)
      throw Error(`Field ${k} must be between ${lo} and ${hi}.`);
  if (
    !Number.isInteger(s.frames) ||
    !["xy", "xz", "yz"].includes(s.axis) ||
    !["auto", "cpu", "webgpu"].includes(s.backend) ||
    !["burst", "tone"].includes(s.signal)
  )
    throw Error("Invalid field recording/backend settings.");
  return s;
}
