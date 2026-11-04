export interface Driver {
  id: string;
  name: string;
  note: string;
  fs: number;
  qes: number;
  qms: number;
  vas: number;
  re: number;
  le: number;
  sd: number;
  xmax: number;
  cutout: number;
  frame: number;
  depth: number;
  /** Rp || jωLp in series with Re + jωLe, for published lossy-inductance fits. */
  lossyInductance?: { resistance: number; inductance: number };
}
export interface Design {
  length: number;
  areaRatio: number;
  laneWidth: number;
  folds: number;
  thickness: number;
  driverPosition: number;
  damping: number;
  voltage: number;
  temperature: number;
}
export interface Targets {
  low: number;
  high: number;
  maxHeight: number;
  maxWidth: number;
  maxDepth: number;
  minLength: number;
  maxLength: number;
  maxVelocity: number;
}
export interface Project {
  circuit?: import('./circuit-schema').Circuit;
  version: 1;
  name: string;
  driver: Driver;
  design: Design;
  targets: Targets;
  layout?: CustomLayout;
  mounts?: DriverMount[];
  system?: SystemStudy;
}
export type XY = [number, number];
export type XYZ = [number, number, number];
export type CabinetFace =
  "front" | "back" | "left" | "right" | "top" | "bottom";
export interface Baffle {
  id: string;
  label: string;
  start: XY;
  end: XY;
  thickness?: number;
  pose?: { center: XYZ; size: XY; rotation: XYZ };
}
export interface Mouth {
  side: CabinetFace;
  offset: number;
  width: number;
  center?: XY;
  height?: number;
}
export interface CustomLayout {
  width: number;
  height: number;
  depth: number;
  baffles: Baffle[];
  route: XY[];
  mouth: Mouth;
}
export interface DriverMount {
  id: string;
  driver: Driver;
  position: number;
  face: CabinetFace;
  voltageScale: number;
  phase: number;
  /** Face-plane mm from outer cabinet origin. Front/back X,Y; sides Z,Y; top/bottom X,Z. */
  at?: XY;
  /** T/S data for a factory sealed-back unit already includes its rear chamber. */
  rearLoading?: "cabinet" | "sealed-back";
  crossover?: Crossover;
  acousticOffsetMm?: XYZ;
  measurements?: MountedMeasurements;
}
export interface FrequencyTrace { source:string; samples:[number,number,number|null][]; }
export interface MountedMeasurements {
  impedance?:FrequencyTrace;
  response?:{trace:FrequencyTrace;voltage:number|null;distanceM:number|null;timing:"common"|"unknown";includesBaffle:boolean;includesTerminus:boolean;microphoneMm:XYZ|null};
}
/** Ladder order runs from amplifier to driver. Values are SI (ohm, H, F). */
export interface CircuitElement {
  connection: "series" | "shunt";
  kind: "R" | "L" | "C";
  value: number;
  resistance?: number;
}
export interface Crossover {
  passive?: CircuitElement[];
  active?: { kind: "lowpass" | "highpass"; frequency: number; order: 1 | 2 }[];
}
export interface AcousticProfile {
  source: string;
  evidence: "derived" | "digitized";
  /** Explicit acoustic equivalent, independent of fabrication solids. mm, mm², Np/m. */
  sections: Section[];
  mouthArea: number;
}
export interface ReferenceCurve {
  trace?: "calculated-solid" | "measured-dashed" | "unspecified";
  frequencyUncertaintyPercent?: number;
  id: string;
  title: string;
  source: string;
  evidence: "published-simulation" | "published-measurement";
  metric: "spl" | "coneSpl" | "terminusSpl" | "impedance";
  conditions: { voltage: number | null; distanceM: number | null; radiation: "half-space" | "anechoic" | "near-field" | "in-room"; stuffing: "empty" | "stuffed"; crossover: "bypass" | "passive" | "active"; notes?: string; microphoneMm?:XYZ };
  /** Absolute error limit in the metric's native units; no fitted level offset. */
  tolerance: number;
  uncertainty: number;
  samples: [number, number][];
}
export interface SystemStudy {
  /** Explicit ambient constants, e.g. measured test conditions. SI units. */
  air?: { densityKgM3: number; soundSpeedMs: number; source: string };
  /** Optional integration cap along the actual/equivalent 1D profile. */
  numerics?: { lineStepMm: number };
  physics?: {
    ductLoss: "none" | "thermoviscous" | "mjk-2003";
    radiation: "low-ka" | "piston";
    stuffing?: StuffingRegion[];
  };
  observation?: { positionMm: XYZ; space: "half-space" | "free-field"; baffle: "infinite" | "sphere-transition"; baffleRadiusMm?: number; operator?:"far-field"|"rayleigh" };
  profile?: AcousticProfile;
  sweep: [number, number];
  distanceM: number;
  references?: ReferenceCurve[];
  modalReference?: { source: string; frequencies: number[]; tolerancePercent: number };
}
export interface StuffingRegion {
  start: number;
  end: number;
  source: string;
  calibration: "assumed" | "measured" | "reference-fit";
  /** Omitted means full cross-section, preserving version-1 projects. */
  placement?: { kind: "lining"; thicknessMm: number };
  presetId?: string;
  /** Retained use/evidence range of this sample, not a universal model limit. */
  frequencyRangeHz?: [number, number];
  material: PorousMaterial;
}
export type PorousMaterial = { model: "mjk-2003"; densityKgM3: number }
  | { model: "miki"; flowResistivity: number }
  | { model: "empirical-power-law"; flowResistivity: number;
      /** NASA Allen/Schiller convention X=rho_air*f/sigma; coefficients C1..C8. */
      coefficients: [number,number,number,number,number,number,number,number] }
  | { model: "jca"; flowResistivity: number; porosity: number; tortuosity: number;
      viscousLengthUm: number; thermalLengthUm: number }
  | { model: "jcal"; flowResistivity: number; porosity: number; tortuosity: number;
    viscousLengthUm: number; thermalLengthUm: number; thermalPermeability: number;
  };
export interface Section {
  distance: number;
  area: number;
  width: number;
  damping: number;
}
export interface Point {
  frequency: number;
  spl: number;
  coneSpl: number;
  terminusSpl: number;
  impedance: number;
  impedancePhase: number;
  excursion: number;
  velocity: number;
  pressureRe: number;
  pressureIm: number;
  phase: number;
  groupDelay: number;
  drivers?: {
    id: string;
    excursion: number;
    impedance: number;
    current: number;
    inputCurrent?: number;
    spl?: number;
    pressureRe?: number;
    pressureIm?: number;
  }[];
}
export interface Simulation {
  points: Point[];
  quarterWave: number;
  planeWaveLimit: number;
  radiationLimit: number;
  peakExcursion: number;
  peakVelocity: number;
  bandMean: number;
  ripple: number;
  f3: number | null;
  impedanceConvention?: "common-parallel-input" | "first-driven-source";
  limitations?: string[];
}
export interface Hole {
  x: number;
  y: number;
  radius: number;
}
export interface Panel {
  id: string;
  label: string;
  width: number;
  height: number;
  thickness: number;
  position: [number, number, number];
  rotation: [number, number, number];
  holes: Hole[];
  outline?: XY[];
  openings?: { x: number; y: number; width: number; height: number }[];
  footprint?: { polygon: XY[]; z: number; depth: number };
  notes?: string[];
}
export interface Geometry {
  width: number;
  height: number;
  depth: number;
  innerHeight: number;
  innerDepth: number;
  lane: number;
  area: number;
  airVolume: number;
  panels: Panel[];
  path: [number, number, number][];
  driverCenter: [number, number, number];
  errors: string[];
  warnings: string[];
  physicalErrors?: string[];
  analysisErrors?: string[];
  lineLength: number;
  sections: Section[];
  mounts: (DriverMount & {
    center: XYZ;
  })[];
}
export interface Candidate {
  project: Project;
  score: number;
  simulation: Simulation;
  geometry: Geometry;
}
export interface Snapshot {
  id: string;
  name: string;
  project: Project;
  color: string;
}
