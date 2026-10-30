export interface Driver {
  id: string; name: string; note: string;
  fs: number; qes: number; qms: number; vas: number; re: number; le: number;
  sd: number; xmax: number; cutout: number; frame: number; depth: number;
}
export interface Design {
  length: number; areaRatio: number; laneWidth: number; folds: number;
  thickness: number; driverPosition: number; damping: number;
  voltage: number; temperature: number;
}
export interface Targets {
  low: number; high: number; maxHeight: number; maxWidth: number; maxDepth: number;
  minLength: number; maxLength: number; maxVelocity: number;
}
export interface Project {
  version: 1; name: string; driver: Driver; design: Design; targets: Targets;
  layout?: CustomLayout;
  mounts?: DriverMount[];
}
export type XY = [number, number];
export interface Baffle { id: string; label: string; start: XY; end: XY; thickness?: number }
export interface Mouth { side: 'top'|'bottom'|'left'|'right'; offset: number; width: number }
export interface CustomLayout {
  width: number; height: number; depth: number;
  baffles: Baffle[];
  route: XY[];
  mouth: Mouth;
}
export interface DriverMount {
  id: string; driver: Driver; position: number;
  face: 'front'|'back'; voltageScale: number; phase: number;
}
export interface Section { distance: number; area: number; width: number; damping: number }
export interface Point {
  frequency: number; spl: number; coneSpl: number; terminusSpl: number;
  impedance: number; impedancePhase: number; excursion: number; velocity: number;
  pressureRe: number; pressureIm: number; phase: number; groupDelay: number;
  drivers?: {id:string;excursion:number;impedance:number;current:number}[];
}
export interface Simulation {
  points: Point[]; quarterWave: number; planeWaveLimit: number; radiationLimit: number;
  peakExcursion: number; peakVelocity: number; bandMean: number; ripple: number; f3: number | null;
  impedanceConvention?: 'common-parallel-input'|'first-driven-source';
}
export interface Hole { x: number; y: number; radius: number }
export interface Panel {
  id: string; label: string; width: number; height: number; thickness: number;
  position: [number, number, number]; rotation: [number, number, number]; holes: Hole[];
  outline?: XY[];
  footprint?: { polygon: XY[]; z: number; depth: number };
  notes?: string[];
}
export interface Geometry {
  width: number; height: number; depth: number; innerHeight: number; innerDepth: number;
  lane: number; area: number; airVolume: number; panels: Panel[];
  path: [number, number, number][]; driverCenter: [number, number, number];
  errors: string[]; warnings: string[];
  lineLength: number; sections: Section[];
  mounts: { id: string; driver: Driver; center: [number,number,number]; face: 'front'|'back'; position: number; voltageScale: number; phase: number }[];
}
export interface Candidate { project: Project; score: number; simulation: Simulation; geometry: Geometry }
export interface Snapshot { id: string; name: string; project: Project; color: string }
