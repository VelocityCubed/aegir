import type { Project } from "../core/types";
export type Axis = "xy" | "xz" | "yz";
export interface FieldSettings {
  cellMm: number;
  paddingMm: number;
  durationMs: number;
  frequency: number;
  signal: "burst" | "tone" | "steady";
  frames: number;
  axis: Axis;
  slice: number;
  backend: "auto" | "cpu" | "webgpu";
  attenuation: number;
  volume: boolean;
  geometry?: "fitted" | "staircase";
  /** Developer mesh-phase audit; physical cabinet coordinates are unchanged. */
  gridShiftMm?: [number, number, number];
}
export const fieldDefaults: FieldSettings = {
  cellMm: 20,
  paddingMm: 180,
  durationMs: 40,
  frequency: 400,
  signal: "burst",
  frames: 160,
  axis: "xy",
  slice: 0.5,
  backend: "auto",
  attenuation: 0,
  volume: true,
  geometry: "fitted",
};
export interface FieldMeta {
  medium?: {
    frequency: number;
    materialCells: number;
    regionCells: number[];
    placement: "nearest-route-guide";
    scope: string;
  };
  steadyState?: { relativeChange: number; settled: boolean; cycles: number };
  electrical?: {
    scheme: "implicit-midpoint-MNA";
    states: number;
    inputs: number;
    parts: number;
  };
  studyModel?: "basic-wave";
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
  probes: {
    name: string;
    positionMm: [number, number, number];
    sampling?: "fixed-trilinear" | "nearest-cell";
  }[];
  layout: { driverOffset: number; probeOffset: number; total: number };
  volume?: {
    dimensions: [number, number, number];
    originMm: [number, number, number];
    pitchMm: number;
    stride: number;
    offset: number;
    cells: number;
  };
  particles?: {
    positionsMm: [number, number, number][];
    offset: number;
    count: number;
  };
  quality?: {
    cadCavityLitres: number;
    voxelCavityLitres: number;
    volumeError: number;
    pointsPerWavelength: number;
    pmlCells: number;
    rearAirReachesExterior: boolean;
    geometry?: "conservative-cut-cell" | "staircase";
    partialCells?: number;
    minimumAirFraction?: number;
    timeStepRatio?: number;
    pistonCoverage?: number[];
    scope?: string;
  };
  pressurePeak: number;
  pressureScale: number;
}
export interface FieldResult {
  meta: FieldMeta;
  data: Float32Array;
  mask: Uint8Array;
  volumeMask?: Uint8Array;
}
export interface PreparedField {
  fitted?: Float64Array;
  medium?: Float64Array;
  electrical?: import("./circuit").CircuitStep;
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
  probeNodes?: Uint32Array;
  probeWeights?: Float64Array;
  coeffOffsets: [number, number, number];
  volumeCells?: Uint32Array;
  volumeMask?: Uint8Array;
  particleCells?: Uint32Array;
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
    ["frames", 12, 640],
    ["slice", 0, 1],
    ["attenuation", 0, 2],
  ] as const)
    if (!Number.isFinite(s[k]) || s[k] < lo || s[k] > hi)
      throw Error(`Field ${k} must be between ${lo} and ${hi}.`);
  if (
    !Number.isInteger(s.frames) ||
    typeof s.volume !== "boolean" ||
    !["xy", "xz", "yz"].includes(s.axis) ||
    !["auto", "cpu", "webgpu"].includes(s.backend) ||
    !["burst", "tone", "steady"].includes(s.signal)
  )
    throw Error("Invalid field recording/backend settings.");
  if (
    !["fitted", "staircase"].includes(s.geometry ?? "fitted") ||
    (s.gridShiftMm &&
      (s.gridShiftMm.length !== 3 ||
        s.gridShiftMm.some(
          (v) => !Number.isFinite(v) || Math.abs(v) > s.cellMm * 0.5,
        )))
  )
    throw Error("Invalid geometry scheme or mesh shift (maximum half a cell).");
  if (
    s.signal === "steady" &&
    ((s.durationMs * s.frequency) / 1000 < 8 || s.frames < 64)
  )
    throw Error(
      "A steady-tone study needs at least eight periods and 64 recording frames.",
    );
  return s;
}
