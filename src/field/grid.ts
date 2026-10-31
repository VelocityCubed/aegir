import { buildGeometry, editableLayout } from "../core/geometry";
import { driverModel } from "../core/acoustics";
import { validateProject } from "../core/validation";
import type { Panel, Project } from "../core/types";
import { faceFrame, facePoint, wallPieces } from "../core/spatial";
import { planRecording } from "./recording";
import {
  validateFieldSettings,
  type FieldSettings,
  type PreparedField,
  type FieldProgress,
  type FieldMeta,
} from "./types";
type V = [number, number, number];
type Solid = { planes: [number, number, number, number][]; min: V; max: V };
const dot = (a: number[], b: number[]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function solid(panel: Panel): Solid {
  if (panel.footprint) {
    const { polygon, z, depth } = panel.footprint,
      sign = Math.sign(
        polygon.reduce((sum, p, i) => {
          const q = polygon[(i + 1) % polygon.length];
          return sum + p[0] * q[1] - q[0] * p[1];
        }, 0),
      );
    const planes = polygon.map((p, i): [number, number, number, number] => {
      const q = polygon[(i + 1) % polygon.length],
        nx = sign * (q[1] - p[1]),
        ny = sign * (p[0] - q[0]);
      return [nx, ny, 0, nx * p[0] + ny * p[1]];
    });
    planes.push([0, 0, -1, -z], [0, 0, 1, z + depth]);
    return {
      planes,
      min: [
        Math.min(...polygon.map((v) => v[0])),
        Math.min(...polygon.map((v) => v[1])),
        z,
      ],
      max: [
        Math.max(...polygon.map((v) => v[0])),
        Math.max(...polygon.map((v) => v[1])),
        z + depth,
      ],
    };
  }
  const [rx, ry, rz] = panel.rotation,
    cx = Math.cos(rx),
    sx = Math.sin(rx),
    cy = Math.cos(ry),
    sy = Math.sin(ry),
    cz = Math.cos(rz),
    sz = Math.sin(rz);
  const axes: V[] = [
      [cz * cy, sz * cy, -sy],
      [cz * sy * sx - sz * cx, sz * sy * sx + cz * cx, cy * sx],
      [cz * sy * cx + sz * sx, sz * sy * cx - cz * sx, cy * cx],
    ],
    half = [panel.width / 2, panel.height / 2, panel.thickness / 2];
  const planes = axes.flatMap((v, i): [number, number, number, number][] => [
    [...v, dot(v, panel.position) + half[i]],
    [-v[0], -v[1], -v[2], -dot(v, panel.position) + half[i]],
  ]);
  const extent = [0, 1, 2].map((k) =>
    axes.reduce((sum, v, i) => sum + Math.abs(v[k]) * half[i], 0),
  );
  return {
    planes,
    min: panel.position.map((v, i) => v - extent[i]) as V,
    max: panel.position.map((v, i) => v + extent[i]) as V,
  };
}
function contains(s: Solid, p: V) {
  return (
    p.every((v, i) => v >= s.min[i] - 1e-6 && v <= s.max[i] + 1e-6) &&
    s.planes.every(
      (v) => v[0] * p[0] + v[1] * p[1] + v[2] * p[2] <= v[3] + 1e-6,
    )
  );
}
function intersects(s: Solid, p: V, q: V) {
  if (
    p.some(
      (v, i) =>
        Math.max(v, q[i]) < s.min[i] - 1e-6 ||
        Math.min(v, q[i]) > s.max[i] + 1e-6,
    )
  )
    return false;
  let a = 0,
    b = 1;
  for (const v of s.planes) {
    const dist = v[0] * p[0] + v[1] * p[1] + v[2] * p[2] - v[3],
      slope =
        v[0] * (q[0] - p[0]) + v[1] * (q[1] - p[1]) + v[2] * (q[2] - p[2]);
    if (Math.abs(slope) < 1e-10) {
      if (dist > 1e-6) return false;
    } else if (slope > 0) b = Math.min(b, -dist / slope);
    else a = Math.max(a, -dist / slope);
    if (a > b) return false;
  }
  return a <= b;
}
/** Clip magnified drawing at exact cabinet solids; this never alters recorded motion. */
export function visualMotionClipper(project: Project) {
  const solids = buildGeometry(project).panels.flatMap(wallPieces).map(solid);
  return (start: V, end: V) => {
    let fraction = 1;
    for (const s of solids) {
      if (!intersects(s, start, end)) continue;
      let enter = 0,
        leave = 1;
      for (const n of s.planes) {
        const d = dot(n, start) - n[3],
          v =
            n[0] * (end[0] - start[0]) +
            n[1] * (end[1] - start[1]) +
            n[2] * (end[2] - start[2]);
        if (Math.abs(v) < 1e-10) {
          if (d > 1e-6) {
            enter = 2;
            break;
          }
        } else if (v < 0) enter = Math.max(enter, -d / v);
        else leave = Math.min(leave, -d / v);
      }
      if (enter <= leave && enter <= 1 && leave >= 0)
        fraction = Math.min(fraction, Math.max(0, enter - 1e-4));
    }
    return fraction;
  };
}
/** Exact convex solid sections for the field-map overlay; pressure remains grid-sampled. */
export function fieldSolidContours(
  project: Project,
  plane: FieldMeta["plane"],
): [number, number][][] {
  const u = plane.u,
    v = plane.v,
    o = plane.originMm,
    pitch = plane.pitchMm;
  const point = (a: number, b: number): V =>
    o.map((x, k) => x + u[k] * a * pitch + v[k] * b * pitch) as V;
  return buildGeometry(project)
    .panels.flatMap(wallPieces).map((panel) => {
      let polygon: V[] = [
        point(-0.5, -0.5),
        point(plane.width - 0.5, -0.5),
        point(plane.width - 0.5, plane.height - 0.5),
        point(-0.5, plane.height - 0.5),
      ];
      for (const n of solid(panel).planes) {
        const next: V[] = [];
        for (let i = 0; i < polygon.length; i++) {
          const a = polygon[i],
            b = polygon[(i + 1) % polygon.length],
            da = dot(n, a) - n[3],
            db = dot(n, b) - n[3];
          if (da <= 1e-7) next.push(a);
          if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
            const t = da / (da - db);
            next.push(a.map((x, k) => x + t * (b[k] - x)) as V);
          }
        }
        polygon = next;
      }
      return polygon.map((p) => {
        const d = p.map((x, k) => x - o[k]);
        return [dot(d, u) / pitch + 0.5, dot(d, v) / pitch + 0.5] as [
          number,
          number,
        ];
      });
    })
    .filter((p) => p.length >= 3);
}
export function cholesky(a: Float64Array, n: number) {
  const l = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let v = a[i * n + j];
      for (let k = 0; k < j; k++) v -= l[i * n + k] * l[j * n + k];
      if (i === j) {
        if (v <= 0 || !Number.isFinite(v))
          throw Error("Non-passive driver coupling matrix.");
        l[i * n + j] = Math.sqrt(v);
      } else l[i * n + j] = v / l[j * n + j];
    }
  return l;
}
export function prepareField(
  project: Project,
  input: Partial<FieldSettings> = {},
  progress: FieldProgress = () => {},
  cpuBudget = false,
): PreparedField {
  validateProject(project);
  const settings = validateFieldSettings(input),
    p = editableLayout(project),
    g = buildGeometry(p);
  // Route intent is not a spatial boundary: shortcuts must emerge in the solved field.
  const fatal = g.physicalErrors ?? g.errors.filter(e => !/^(Wave route|Closed end|The intended route|Cavity routing|The route has)/.test(e));
  if (fatal.length) throw Error("Field geometry: " + fatal.join(" "));
  const h = settings.cellMm / 1000,
    pml = Math.max(6, Math.ceil(120 / settings.cellMm));
  if (settings.paddingMm < (pml + 3) * settings.cellMm)
    throw Error(
      `Exterior padding must be at least ${(pml + 3) * settings.cellMm} mm for this grid and PML.`,
    );
  const dims = [g.width, g.height, g.depth].map((v) =>
      Math.ceil((v + 2 * settings.paddingMm) / settings.cellMm),
    ) as V,
    [nx, ny, nz] = dims,
    n = nx * ny * nz;
  if (n > 4_000_000)
    throw Error(
      `Field grid has ${n.toLocaleString()} cells; limit is 4,000,000. Increase cell size or reduce exterior padding.`,
    );
  const { c, rho } = driverModel(project),
    bulk = rho * c * c,
    dt = (0.85 * h) / (c * Math.sqrt(3)),
    steps = Math.ceil(settings.durationMs / 1000 / dt);
  if (cpuBudget && (n > 300000 || n * steps > 300e6))
    throw Error(
      "CPU work budget exceeded. Use WebGPU, a coarser grid, or a shorter study.",
    );
  if (steps > 20000 || n * steps > 15e9)
    throw Error(
      "Field study exceeds the step/work budget. Shorten duration or use a coarser grid.",
    );
  const pointsPerWavelength =
    c / (settings.frequency * h * (settings.signal === "burst" ? 2 : 1));
  if (pointsPerWavelength < 8)
    throw Error(
      "Wave bandwidth has fewer than 8 grid cells per wavelength. Reduce frequency or refine the grid.",
    );
  if (p.layout!.mouth.width < 2 * settings.cellMm || ((p.layout!.mouth.side === "front" || p.layout!.mouth.side === "back") && (p.layout!.mouth.height ?? Math.min(60,g.innerHeight/4)) < 2*settings.cellMm))
    throw Error(
      "The mouth needs at least two grid cells across its width. Refine the spatial grid.",
    );
  const origin: V = [
    -settings.paddingMm / 1000,
    -settings.paddingMm / 1000,
    -settings.paddingMm / 1000,
  ];
  const point = (i: number): V => [
    origin[0] + ((i % nx) + 0.5) * h,
    origin[1] + ((Math.floor(i / nx) % ny) + 0.5) * h,
    origin[2] + (Math.floor(i / (nx * ny)) + 0.5) * h,
  ];
  const solids = g.panels.flatMap(wallPieces).map(solid),
    flags = new Uint32Array(n);
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const index = i + nx * (j + ny * k),
          pt = point(index).map((v) => v * 1000) as V;
        if (!solids.some((s) => contains(s, pt))) flags[index] = 1;
      }
    if (k % 4 === 0) progress((0.09 * k) / nz);
  }
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const index = i + nx * (j + ny * k);
        if (!flags[index]) continue;
        const a = point(index).map((v) => v * 1000) as V;
        for (const [offset, bit, valid] of [
          [1, 2, i < nx - 1],
          [nx, 4, j < ny - 1],
          [nx * ny, 8, k < nz - 1],
        ] as const)
          if (valid && flags[index + offset]) {
            const b = point(index + offset).map((v) => v * 1000) as V;
            if (!solids.some((s) => intersects(s, a, b))) flags[index] |= bit;
          }
      }
    if (k % 4 === 0) progress(0.09 + (0.09 * k) / nz);
  }
  let interiorCells = 0;
  for (let i = 0; i < n; i++)
    if (flags[i] & 1) {
      const q = point(i).map((v) => v * 1000);
      if (
        q[0] > project.design.thickness &&
        q[0] < g.width - project.design.thickness &&
        q[1] > project.design.thickness &&
        q[1] < g.height - project.design.thickness &&
        q[2] > project.design.thickness &&
        q[2] < g.depth - project.design.thickness
      )
        interiorCells++;
    }
  const voxelCavityLitres = interiorCells * h * h * h * 1000,
    volumeError = Math.abs(voxelCavityLitres / g.airVolume - 1);
  const coeffOffsets: V = [0, 4 * nx, 4 * (nx + ny)],
    coeff = new Float64Array(4 * (nx + ny + nz));
  dims.forEach((size, axis) => {
    const sigma = (i: number) =>
      settings.attenuation * c +
      ((-4 * c * Math.log(1e-5)) / (2 * pml * h)) *
        Math.max(0, 1 - Math.min(i + 0.5, size - i - 0.5) / pml) ** 3;
    for (let i = 0; i < size; i++) {
      const sp = sigma(i),
        sv = (sigma(i) + sigma(Math.min(size - 1, i + 1))) / 2,
        at = coeffOffsets[axis] + i * 4;
      coeff[at] = (1 - 0.5 * dt * sp) / (1 + 0.5 * dt * sp);
      coeff[at + 1] = dt / (1 + 0.5 * dt * sp);
      coeff[at + 2] = (1 - 0.5 * dt * sv) / (1 + 0.5 * dt * sv);
      coeff[at + 3] = dt / (1 + 0.5 * dt * sv);
    }
  });
  const nd = g.mounts.length,
    sourceMap = new Map<number, Float64Array>();
  const sources = g.mounts.map((m) => ({
    id: m.id,
    name: m.driver.name,
    xmax: m.driver.xmax,
    sd: m.driver.sd * 1e-4,
  }));
  const models = new Float64Array(nd * 9);
  g.mounts.forEach((mount, d) => {
    const model = driverModel({ ...project, driver: mount.driver });
    models.set(
      [
        model.mmd,
        model.rmd,
        model.cms,
        model.bl,
        mount.driver.re,
        mount.driver.le * 1e-3,
        model.sd,
        mount.voltageScale,
        (mount.phase * Math.PI) / 180,
      ],
      d * 9,
    );
    const radius = Math.min(
        Math.sqrt(model.sd / Math.PI),
        mount.driver.cutout / 2000,
      ),
      pairs: { index: number; weight: number }[][] = [[], []];
    const frame = faceFrame(mount.face), normal = frame.axis, [u,v] = frame.uv,
      extent = [g.width,g.height,g.depth], t=project.design.thickness;
    for(let j=0;j<dims[v];j++) for(let i=0;i<dims[u];i++) {
      const pu=(origin[u]+(i+.5)*h)*1000,pv=(origin[v]+(j+.5)*h)*1000;
      const w=Math.max(0,Math.min(1,(radius*1000-Math.hypot(pu-mount.center[u],pv-mount.center[v]))/settings.cellMm+.5));
      if(!w) continue;
      const xyz=[0,0,0];xyz[u]=i;xyz[v]=j;
      const outside:number[]=[],inside:number[]=[];
      for(let k=0;k<dims[normal];k++) {
        xyz[normal]=k;const index=xyz[0]+nx*(xyz[1]+ny*xyz[2]);
        const q=(origin[normal]+(k+.5)*h)*1000;
        // Only the immediately adjacent layer is a piston port. Never tunnel through
        // a nearby board into another room when the chosen grid cannot resolve air.
        const outsideDistance=frame.sign<0?-q:q-extent[normal];
        const insideDistance=frame.sign<0?q-t:extent[normal]-t-q;
        if(flags[index]&1) {
          if(outsideDistance>0&&outsideDistance<=settings.cellMm*1.51) outside.push(index);
          if(insideDistance>0&&insideDistance<=settings.cellMm*1.51) inside.push(index);
        }
      }
      const ext=frame.sign<0?outside.at(-1):outside[0],int=frame.sign<0?inside[0]:inside.at(-1);
      if(ext!==undefined&&int!==undefined){pairs[0].push({index:ext,weight:w});pairs[1].push({index:int,weight:w});}
    }
    for (let side = 0; side < 2; side++) {
      const sum = pairs[side].reduce((a, b) => a + b.weight, 0);
      if (sum < 2)
        throw Error(
          `Driver ${mount.id} has too few resolved piston cells. Refine the grid or check placement.`,
        );
      for (const v of pairs[side]) {
        let row = sourceMap.get(v.index);
        if (!row) {
          row = new Float64Array(nd);
          sourceMap.set(v.index, row);
        }
        row[d] += ((side === 0 ? 1 : -1) * v.weight) / sum;
      }
    }
  });
  const sourceCells = Uint32Array.from(sourceMap.keys()),
    weights = new Float64Array(sourceCells.length * nd);
  [...sourceMap.values()].forEach((row, i) => weights.set(row, i * nd));
  // Eliminate electrical midpoint current and the pressure response to piston flux.
  // The resulting SPD velocity matrix includes K*dt/(2*cellVolume) times port overlap.
  const matrix = new Float64Array(nd * nd);
  for (let i = 0; i < nd; i++)
    for (let j = 0; j < nd; j++) {
      let sum = 0;
      for (let k = 0; k < sourceCells.length; k++)
        sum += weights[k * nd + i] * weights[k * nd + j];
      matrix[i * nd + j] =
        ((0.5 * bulk * dt) / (h * h * h)) *
        models[i * 9 + 6] *
        models[j * 9 + 6] *
        sum;
      if (i === j) {
        const m = i * 9;
        matrix[i * nd + i] +=
          (2 * models[m]) / dt +
          models[m + 1] +
          dt / (2 * models[m + 2]) +
          models[m + 3] ** 2 / (models[m + 4] + (2 * models[m + 5]) / dt);
      }
    }
  const chol = cholesky(matrix, nd),
    axis = settings.axis,
    uv = axis === "xy" ? [0, 1, 2] : axis === "xz" ? [0, 2, 1] : [1, 2, 0],
    planeAt = Math.min(
      dims[uv[2]] - 1,
      Math.max(
        0,
        Math.floor(
          (settings.paddingMm +
            settings.slice * [g.width, g.height, g.depth][uv[2]]) /
            settings.cellMm,
        ),
      ),
    );
  const recording = planRecording(
    dims,
    flags,
    origin,
    settings,
    steps,
    nd,
    [g.width, g.height, g.depth],
    pml,
  );
  const stride = Math.max(
      1,
      Math.ceil(
        Math.sqrt(
          (recording.frames * dims[uv[0]] * dims[uv[1]] * 4 * 4) /
            recording.planeBudget,
        ),
      ),
    ),
    width = Math.floor(dims[uv[0]] / stride),
    height = Math.floor(dims[uv[1]] / stride),
    recordCells = new Uint32Array(width * height),
    recordMask = new Uint8Array(width * height);
  for (let j = 0; j < height; j++)
    for (let i = 0; i < width; i++) {
      const xyz = [0, 0, 0];
      xyz[uv[0]] = i * stride + Math.floor(stride / 2);
      xyz[uv[1]] = j * stride + Math.floor(stride / 2);
      xyz[uv[2]] = planeAt;
      const index = xyz[0] + nx * (xyz[1] + ny * xyz[2]);
      recordCells[i + width * j] = index;
      recordMask[i + width * j] = flags[index] & 1;
    }
  const first = point(recordCells[0]).map((v) => v * 1000) as V,
    u: V = [0, 0, 0],
    v: V = [0, 0, 0];
  u[uv[0]] = 1;
  v[uv[1]] = 1;
  const recordSteps = new Uint32Array(steps).fill(0xffffffff),
    times: number[] = [];
  for (let f = 0; f < Math.min(settings.frames, steps); f++) {
    const s = Math.round(
      (f * (steps - 1)) / (Math.min(settings.frames, steps) - 1),
    );
    recordSteps[s] = times.length;
    times.push((s + 1) * dt);
  }
  const mouth = p.layout!.mouth, t=project.design.thickness,
    at: [number,number] = mouth.side==='front'||mouth.side==='back'
      ? (mouth.center??[(g.width-2*t)/2,mouth.offset]).map(x=>x+t) as [number,number]
      : mouth.side==='left'||mouth.side==='right' ? [g.depth/2,t+mouth.offset] : [t+mouth.offset,g.depth/2],
    mouthPos:V=facePoint(mouth.side,at,[g.width,g.height,g.depth]);
  const near = (pt: V) => {
    let best = -1,
      cost = Infinity;
    const centre = pt.map((v, i) => Math.floor((v / 1000 - origin[i]) / h));
    for (let z = -3; z <= 3; z++)
      for (let y = -3; y <= 3; y++)
        for (let x = -3; x <= 3; x++) {
          const a = centre[0] + x,
            b = centre[1] + y,
            c = centre[2] + z;
          if (a < 0 || b < 0 || c < 0 || a >= nx || b >= ny || c >= nz)
            continue;
          const i = a + nx * (b + ny * c);
          if (!(flags[i] & 1)) continue;
          const q = point(i),
            d = q.reduce((s, v, k) => s + (v * 1000 - pt[k]) ** 2, 0);
          if (d < cost) {
            cost = d;
            best = i;
          }
        }
    if (best < 0) throw Error("No resolved air cell near a probe.");
    return best;
  };
  const rearIndex = [...sourceCells].find((_, k) => weights[k * nd] < 0)!;
  const seen = new Uint8Array(n),
    queue = new Uint32Array(n);
  let head = 0,
    tail = 1,
    rearAirReachesExterior = false;
  queue[0] = rearIndex;
  seen[rearIndex] = 1;
  while (head < tail) {
    const i = queue[head++],
      q = point(i);
    if (
      q[0] < 0 ||
      q[1] < 0 ||
      q[2] < 0 ||
      q[0] * 1000 > g.width ||
      q[1] * 1000 > g.height ||
      q[2] * 1000 > g.depth
    ) {
      rearAirReachesExterior = true;
      break;
    }
    for (const [offset, bit] of [
      [1, 2],
      [nx, 4],
      [nx * ny, 8],
    ]) {
      if (flags[i] & bit && !seen[i + offset]) {
        seen[i + offset] = 1;
        queue[tail++] = i + offset;
      }
      if (i >= offset && flags[i - offset] & bit && !seen[i - offset]) {
        seen[i - offset] = 1;
        queue[tail++] = i - offset;
      }
    }
  }
  const probeCells = Uint32Array.from([rearIndex, near(mouthPos)]),
    probes = Array.from(probeCells, (i, k) => ({
      name: k ? "Mouth" : "Primary rear air",
      positionMm: point(i).map((v) => v * 1000) as V,
    }));
  const volumeOffset = times.length * recordCells.length * 4,
    particleOffset = volumeOffset + times.length * recording.volumeCells.length,
    driverOffset =
      particleOffset + times.length * recording.particleCells.length * 3,
    probeOffset = driverOffset + steps * nd * 4,
    total = probeOffset + steps * probeCells.length;
  if (total * 4 > 15 * 1024 * 1024)
    throw Error("Recording exceeds 15 MiB. Reduce frame count or duration.");
  const warnings = [
    "Experimental linear 3D FDTD: rigid cabinet, rigid-piston T/S sources, no panel vibration, cone breakup or nonlinear port flow.",
    "Driver basket/magnet and bracing displacement are not included unless represented by cabinet solids. No calibrated porous stuffing model; the 1D damping value is not used. Uniform attenuation is an optional phenomenological loss.",
    "Exterior PML and staircase geometry require padding/grid convergence and physical validation.",
  ];
  if (settings.volume && recording.stride > 1)
    warnings.push(
      `3D pressure recording sampled every ${recording.stride} grid cells (${recording.stride * settings.cellMm} mm); the full-resolution solver is unchanged. Interpolated rendering cannot recover unresolved recorded detail.`,
    );
  if (settings.volume && pointsPerWavelength / recording.stride < 6)
    warnings.push(
      `3D playback has only ${(pointsPerWavelength / recording.stride).toFixed(1)} recorded samples per shortest estimated wavelength. Pressure fronts may alias spatially; shorten the study/reduce frame count to retain a finer recording, or use the slice. Drawing interpolation cannot repair this.`,
    );
  if (
    times.length / (steps * dt) <
    (settings.signal === "burst" ? 8 : 4) * settings.frequency
  )
    warnings.push(
      "Playback has fewer than four samples per shortest estimated source-band cycle; interpolation smooths drawing but cannot reconstruct missing temporal detail. Increase recorded frames or shorten duration.",
    );
  const minStock = Math.min(...g.panels.map((p) => p.thickness));
  if (settings.cellMm > minStock / 2)
    warnings.push(
      `Preview grid: thinnest stock spans ${(minStock / settings.cellMm).toFixed(1)} cells. Exact face barriers prevent wall leakage, but volume/angle errors require refinement.`,
    );
  if (settings.durationMs / 1000 < 6 / settings.frequency)
    warnings.push(
      "Short study: fewer than six carrier cycles; a settled bass response is not established.",
    );
  if (stride > 1)
    warnings.push(
      `Recording downsampled by ${stride} in each plane direction to bound memory; the solver uses the full 3D grid.`,
    );
  if (volumeError > 0.05)
    warnings.push(
      `Voxel cavity volume differs from CAD by ${(100 * volumeError).toFixed(1)}%. Refine the grid before quantitative comparisons.`,
    );
  if (!rearAirReachesExterior)
    warnings.push(
      "The primary rear air cells do not connect to exterior air: check physical sealing or unresolved passages.",
    );
  if (pointsPerWavelength < 12)
    warnings.push(
      "Wave bandwidth has fewer than 12 cells per shortest estimated wavelength; numerical dispersion needs a finer-grid comparison.",
    );
  if (
    times.length / (steps * dt) <
    (settings.signal === "burst" ? 4 : 2) * settings.frequency
  )
    warnings.push(
      "Recorded playback undersamples the estimated wave bandwidth. Individual frames are solved, but apparent motion can alias; increase frames or shorten the study.",
    );
  if (g.errors.length)
    warnings.push(
      "1D route-intent diagnostics are not spatial boundaries; actual air connectivity determines wave travel.",
    );
  const meta: FieldMeta = {
    version: 1,
    project: structuredClone(project),
    settings,
    backend: "unstarted",
    dimensions: dims,
    cells: n,
    h,
    dt,
    steps,
    c,
    rho,
    bulk,
    origin,
    times,
    warnings,
    seconds: 0,
    plane: {
      axis,
      width,
      height,
      pitchMm: settings.cellMm * stride,
      originMm: first,
      u,
      v,
    },
    sources,
    probes,
    layout: { driverOffset, probeOffset, total },
    ...(settings.volume
      ? {
          volume: {
            dimensions: recording.dimensions,
            originMm: recording.volumeOrigin,
            pitchMm: settings.cellMm * recording.stride,
            stride: recording.stride,
            offset: volumeOffset,
            cells: recording.volumeCells.length,
          },
          particles: {
            positionsMm: recording.particlePositions,
            offset: particleOffset,
            count: recording.particleCells.length,
          },
        }
      : {}),
    quality: {
      cadCavityLitres: g.airVolume,
      voxelCavityLitres,
      volumeError,
      pointsPerWavelength,
      pmlCells: pml,
      rearAirReachesExterior,
    },
    pressurePeak: 0,
    pressureScale: 1,
  };
  progress(0.2);
  return {
    meta,
    flags,
    aux: coeff,
    sourceCells,
    weights,
    models,
    chol,
    recordCells,
    recordMask,
    recordSteps,
    probeCells,
    coeffOffsets,
    volumeCells: recording.volumeCells,
    volumeMask: recording.volumeMask,
    particleCells: recording.particleCells,
  };
}
