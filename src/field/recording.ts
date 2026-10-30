import type { FieldSettings } from "./types";
type V = [number, number, number];
/** Observation-only sampling. Neither stride nor frame count changes the solve. */
export function planRecording(
  dims: V,
  flags: Uint32Array,
  origin: V,
  settings: FieldSettings,
  steps: number,
  sources: number,
  cabinet: V,
  pml: number,
) {
  const frames = Math.min(settings.frames, steps),
    [nx, ny, nz] = dims,
    h = settings.cellMm;
  const point = (i: number): V => [
    origin[0] * 1000 + ((i % nx) + 0.5) * h,
    origin[1] * 1000 + ((Math.floor(i / nx) % ny) + 0.5) * h,
    origin[2] * 1000 + (Math.floor(i / (nx * ny)) + 0.5) * h,
  ];
  const eligible = (i: number) => {
    if (!(flags[i] & 1)) return false;
    const x = origin[0] * 1000 + ((i % nx) + 0.5) * h,
      y = origin[1] * 1000 + ((Math.floor(i / nx) % ny) + 0.5) * h,
      z = origin[2] * 1000 + (Math.floor(i / (nx * ny)) + 0.5) * h;
    return (
      x > 0 &&
      x < cabinet[0] &&
      y > 0 &&
      y < cabinet[1] &&
      z > 0 &&
      z < cabinet[2]
    );
  };
  let eligibleCount = 0;
  if (settings.volume)
    for (let i = 0; i < flags.length; i++) if (eligible(i)) eligibleCount++;
  const particleCount = Math.min(256, eligibleCount),
    particleCells = new Uint32Array(particleCount);
  for (
    let i = 0, rank = 0, pick = 0;
    pick < particleCount && i < flags.length;
    i++
  )
    if (eligible(i)) {
      if (rank === Math.floor((pick * eligibleCount) / particleCount))
        particleCells[pick++] = i;
      rank++;
    }
  const historyBytes =
    steps * (sources * 4 + 2) * 4 + frames * particleCount * 3 * 4;
  const remaining = 14 * 1024 * 1024 - historyBytes;
  if (remaining < 1024 * 1024)
    throw Error(
      "Recording history exceeds its memory budget; shorten duration.",
    );
  const planeBudget = settings.volume
    ? remaining * 0.3
    : Math.min(10 * 1024 * 1024, remaining);
  const volumeBudget = settings.volume ? remaining * 0.7 : 0;
  let stride = 1;
  while (
    settings.volume &&
    dims.reduce((s, v) => s * Math.max(1, Math.floor(v / stride)), 1) *
      frames *
      4 >
      volumeBudget
  )
    stride++;
  const dimensions = dims.map((v) => Math.max(1, Math.floor(v / stride))) as V;
  const cells = settings.volume ? dimensions.reduce((a, b) => a * b, 1) : 0;
  const volumeCells = new Uint32Array(cells),
    volumeMask = new Uint8Array(cells);
  for (let z = 0, k = 0; z < dimensions[2] && cells; z++)
    for (let y = 0; y < dimensions[1]; y++)
      for (let x = 0; x < dimensions[0]; x++, k++) {
        const xyz = [x, y, z].map((v, a) =>
          Math.min(dims[a] - 1, v * stride + Math.floor(stride / 2)),
        );
        const index = xyz[0] + nx * (xyz[1] + ny * xyz[2]);
        volumeCells[k] = index;
        volumeMask[k] = Number(
          Boolean(flags[index] & 1) &&
            xyz.every((v, a) => v >= pml && v < dims[a] - pml),
        );
      }
  return {
    frames,
    planeBudget,
    dimensions,
    stride,
    volumeCells,
    volumeMask,
    particleCells,
    particlePositions: Array.from(particleCells, point),
    volumeOrigin: cells ? point(volumeCells[0]) : ([0, 0, 0] as V),
  };
}
