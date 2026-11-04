import type { Project } from "./types";

/** Validation attachments never replace the enclosure or choose response sample points. */
export function designInput(project: Project): Project {
  const next = structuredClone(project);
  if (next.system) {
    delete next.system.profile;
    delete next.system.references;
    delete next.system.modalReference;
  }
  return next;
}

export function designKey(project: Project): string {
  const next = designInput(project);
  next.name = "";
  return JSON.stringify(next);
}

/** Explicit opt-in for transient studies; never changes the saved design. */
export function basicWaveInput(project: Project): Project {
  const next = designInput(project);
  delete next.circuit;
  next.design.damping=0;
  if (next.system) delete next.system.physics;
  delete next.driver.lossyInductance;
  for (const m of next.mounts ?? []) {
    delete m.crossover;
    delete m.driver.lossyInductance;
  }
  return next;
}
