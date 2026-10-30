import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import type { FieldResult, FieldMeta } from "./types";
export function encodeField(result: FieldResult): Uint8Array {
  if (
    result.data.byteLength > 15 * 1024 * 1024 ||
    result.data.length !== result.meta.layout.total ||
    result.mask.length !== result.meta.plane.width * result.meta.plane.height ||
    (result.meta.volume &&
      result.volumeMask?.length !== result.meta.volume.cells)
  )
    throw Error("Invalid or oversized field recording.");
  const readme = `AEGIR spatial study v1\nExperimental 3D linear pressure/velocity FDTD. Read field.json warnings and source project.\n\nfield.json: SI solver units; plane/world coordinates with Mm suffix are millimetres.\nsamples.f32: little-endian IEEE float32 samples, offsets counted in floats.\nFirst: frames in field.json times order, row-major plane cells (U fastest, V upward), four components per cell: pressure Pa, vx/vy/vz m/s. Velocities are interpolated to cell centres and centred in time at the pressure timestamp.\nAt layout.driverOffset: step-major, then source-major, four components: end-step displacement m, midpoint velocity m/s, midpoint current A, midpoint drive voltage V. Displacement time is (step+1)*dt; electrical/velocity time is (step+0.5)*dt.\nAt layout.probeOffset: step-major, then probe-major pressure Pa, time (step+1)*dt.\nair-mask.u8: one byte per recorded plane cell, 1 air, 0 solid.\nPlane originMm is the first sampled cell centre. U/V basis vectors and pitchMm locate each sample in the 3D cabinet; this is a slice of a 3D solve, not a 2D extrusion.\nOptional meta.volume: frame-major scalar pressure Pa at volume.offset, X fastest, with volume-mask.u8 (0 excludes solid/PML samples), originMm and pitchMm locating samples. Optional meta.particles: frame-major XYZ displacement m at particles.offset, integrated at fixed equilibrium positions positionsMm using midpoint velocities (linear small-signal trajectories). Both use the plane timestamps. Spatial/temporal interpolation is display-only.\nColours in the app use a fixed range and can clip near-source peaks; raw samples do not clip. User design data and ordinary outputs remain subject to the output exception in the application licence.\n`;
  return zipSync(
    {
      "README.txt": strToU8(readme),
      "field.json": strToU8(JSON.stringify(result.meta)),
      "samples.f32": new Uint8Array(
        result.data.buffer,
        result.data.byteOffset,
        result.data.byteLength,
      ),
      "air-mask.u8": result.mask,
      ...(result.volumeMask ? { "volume-mask.u8": result.volumeMask } : {}),
    },
    { level: 1 },
  );
}
export function decodeField(bytes: Uint8Array): FieldResult {
  const files = unzipSync(bytes),
    meta = JSON.parse(strFromU8(files["field.json"])) as FieldMeta,
    raw = files["samples.f32"],
    mask = files["air-mask.u8"];
  if (
    meta.version !== 1 ||
    !raw ||
    raw.byteLength > 15 * 1024 * 1024 ||
    raw.byteLength !== meta.layout.total * 4 ||
    mask?.length !== meta.plane.width * meta.plane.height ||
    (meta.volume &&
      (files["volume-mask.u8"]?.length !== meta.volume.cells ||
        meta.volume.dimensions.reduce((a, b) => a * b, 1) !==
          meta.volume.cells ||
        meta.volume.offset < 0 ||
        meta.volume.offset + meta.volume.cells * meta.times.length >
          meta.layout.total)) ||
    (meta.particles &&
      (meta.particles.count !== meta.particles.positionsMm.length ||
        meta.particles.offset < 0 ||
        meta.particles.offset + meta.particles.count * meta.times.length * 3 >
          meta.layout.total))
  )
    throw Error("Invalid field archive.");
  return {
    meta,
    data: new Float32Array(raw.slice().buffer),
    mask,
    ...(meta.volume ? { volumeMask: files["volume-mask.u8"] } : {}),
  };
}
