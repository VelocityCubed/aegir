import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Maximize } from "lucide-react";
import type { FieldResult } from "../field/types";
import { PressureSlice, type SliceChoice } from "../field/pressureSlice";
import { fieldScale, type FieldMetric } from "../field/pixels";
import { pressureColour, pressureGradientCss } from "../field/transfer";
import { frameBlend } from "../field/playback";
import { fieldSolidContours } from "../field/grid";
import { buildGeometry } from "../core/geometry";
import { PressureContours } from "../field/contours";
import "./pressure-map.css";

export function PressureMap({
  result,
  frame,
  metric,
  range,
  curve,
  interpolation,
  contours,
  plane,
  position,
}: {
  result: FieldResult;
  frame: number;
  metric: FieldMetric;
  range: number;
  curve: "soft" | "linear";
  interpolation: boolean;
  contours: boolean;
  plane: SliceChoice;
  position: number;
}) {
  const root = useRef<HTMLElement>(null),
    stage = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const [detail, setDetail] = useState(true),
    [point, setPoint] = useState<number | null>(null),
    [pinned, setPinned] = useState(false);
  const slice = useMemo(
    () =>
      new PressureSlice(
        result,
        metric === "pressure" ? plane : "recorded",
        position,
      ),
    [result, metric, plane, position],
  );
  useEffect(() => {
    setPoint(null);
    setPinned(false);
  }, [slice]);
  const { width, height, pitchMm } = slice.plane,
    scale = fieldScale(result, metric, range),
    unit =
      metric === "pressure" ? "Pa" : metric === "velocity" ? "m/s" : "W/m²";
  const buffers = useMemo(() => {
    const raster = document.createElement("canvas");
    raster.width = width;
    raster.height = height;
    return {
      raster,
      image: new ImageData(width, height),
      samples: new Float32Array(width * height * 4),
      lines: new PressureContours(width * height),
    };
  }, [slice]);
  const walls = useMemo(
    () => fieldSolidContours(result.meta.project, slice.plane),
    [slice, result],
  );
  const bounds = useMemo(() => {
    if (!detail) return { x: 0, y: 0, w: width, h: height };
    const g = buildGeometry(result.meta.project),
      p = slice.plane,
      points = [];
    for (const x of [0, g.width])
      for (const y of [0, g.height])
        for (const z of [0, g.depth]) {
          const delta = [x, y, z].map((v, i) => v - p.originMm[i]);
          points.push([
            delta.reduce((s, v, i) => s + v * p.u[i], 0) / pitchMm + 0.5,
            delta.reduce((s, v, i) => s + v * p.v[i], 0) / pitchMm + 0.5,
          ]);
        }
    const xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]),
      margin = Math.max(3, (Math.max(...ys) - Math.min(...ys)) * 0.12);
    const x = Math.max(0, Math.floor(Math.min(...xs) - margin)),
      y = Math.max(0, Math.floor(Math.min(...ys) - margin));
    const box = {
      x,
      y,
      w: Math.min(width, Math.ceil(Math.max(...xs) + margin)) - x,
      h: Math.min(height, Math.ceil(Math.max(...ys) + margin)) - y,
    };
    return box.w > 0 && box.h > 0 ? box : { x: 0, y: 0, w: width, h: height };
  }, [detail, slice, result]);
  useEffect(() => {
    const fit = () => {
      const el = canvas.current,
        box = stage.current;
      if (!el || !box) return;
      const factor = Math.min(
        box.clientWidth / bounds.w,
        box.clientHeight / bounds.h,
      );
      el.style.width = `${bounds.w * factor}px`;
      el.style.height = `${bounds.h * factor}px`;
    };
    const observer = new ResizeObserver(fit);
    if (stage.current) observer.observe(stage.current);
    fit();
    return () => observer.disconnect();
  }, [bounds]);
  const samples = slice.frame(frame, buffers.samples, interpolation);
  const valueAt = (i: number) =>
    metric === "pressure"
      ? samples[i * 4]
      : Math.hypot(samples[i * 4 + 1], samples[i * 4 + 2], samples[i * 4 + 3]) *
        (metric === "intensity" ? Math.abs(samples[i * 4]) : 1);
  let minimum = Infinity,
    maximum = -Infinity,
    clipped = 0,
    air = 0;
  for (let y = bounds.y; y < bounds.y + bounds.h; y++)
    for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
      const i = x + y * width;
      if (!slice.mask[i]) continue;
      const v = valueAt(i);
      minimum = Math.min(minimum, v);
      maximum = Math.max(maximum, v);
      air++;
      if (Math.abs(v) > scale) clipped++;
    }
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const zoom = Math.max(1, Math.min(12, Math.ceil(900 / bounds.h)));
    if (el.width !== bounds.w * zoom || el.height !== bounds.h * zoom) {
      el.width = bounds.w * zoom;
      el.height = bounds.h * zoom;
    }
    const ctx = el.getContext("2d")!,
      pixels = buffers.image.data;
    for (let i = 0; i < width * height; i++) {
      const c = pressureColour(valueAt(i), scale, curve);
      pixels[i * 4] = c[0];
      pixels[i * 4 + 1] = c[1];
      pixels[i * 4 + 2] = c[2];
      pixels[i * 4 + 3] = slice.mask[i] ? 255 : 0;
    }
    buffers.raster.getContext("2d")!.putImageData(buffers.image, 0, 0);
    ctx.fillStyle = "#0c1420";
    ctx.fillRect(0, 0, el.width, el.height);
    ctx.save();
    ctx.translate(0, el.height);
    ctx.scale(zoom, -zoom);
    ctx.translate(-bounds.x, -bounds.y);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buffers.raster, 0, 0);
    if (metric !== "pressure") {
      const spacing = Math.max(3, Math.ceil(bounds.h / 20));
      ctx.strokeStyle = "#eff8ff";
      ctx.lineWidth = 1 / zoom;
      for (let y = bounds.y + spacing; y < bounds.y + bounds.h; y += spacing)
        for (
          let x = bounds.x + spacing;
          x < bounds.x + bounds.w;
          x += spacing
        ) {
          const i = x + y * width;
          if (!slice.mask[i]) continue;
          const velocity = [
              samples[i * 4 + 1],
              samples[i * 4 + 2],
              samples[i * 4 + 3],
            ],
            a = velocity.reduce((s, v, j) => s + v * slice.plane.u[j], 0),
            b = velocity.reduce((s, v, j) => s + v * slice.plane.v[j], 0),
            norm = Math.hypot(a, b),
            strength = Math.min(1, valueAt(i) / scale),
            sign = metric === "intensity" && samples[i * 4] < 0 ? -1 : 1;
          if (!norm || strength < 0.04) continue;
          const dx = (a / norm) * spacing * 0.4 * strength * sign,
            dy = (b / norm) * spacing * 0.4 * strength * sign;
          ctx.globalAlpha = 0.3 + 0.7 * strength;
          ctx.beginPath();
          ctx.moveTo(x + 0.5 - dx / 2, y + 0.5 - dy / 2);
          ctx.lineTo(x + 0.5 + dx / 2, y + 0.5 + dy / 2);
          ctx.lineTo(
            x + 0.5 + dx * 0.2 - dy * 0.3,
            y + 0.5 + dy * 0.2 + dx * 0.3,
          );
          ctx.moveTo(x + 0.5 + dx / 2, y + 0.5 + dy / 2);
          ctx.lineTo(
            x + 0.5 + dx * 0.2 + dy * 0.3,
            y + 0.5 + dy * 0.2 - dx * 0.3,
          );
          ctx.stroke();
        }
      ctx.globalAlpha = 1;
    }
    if (contours && metric === "pressure") {
      const lines = buffers.lines.update(
        samples,
        slice.mask,
        width,
        height,
        scale,
        result.meta.rho * result.meta.c,
      );
      ctx.strokeStyle = "#eff8ff80";
      ctx.lineWidth = 0.8 / zoom;
      ctx.beginPath();
      for (let i = 0; i < lines.count; i += 4) {
        ctx.moveTo(lines.segments[i], lines.segments[i + 1]);
        ctx.lineTo(lines.segments[i + 2], lines.segments[i + 3]);
      }
      ctx.stroke();
    }
    ctx.fillStyle = "#3e4e5d";
    ctx.strokeStyle = "#d1dfeb";
    ctx.lineWidth = 1 / zoom;
    for (const polygon of walls) {
      ctx.beginPath();
      polygon.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (point !== null) {
      const x = (point % width) + 0.5,
        y = Math.floor(point / width) + 0.5;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.4 / zoom;
      ctx.beginPath();
      ctx.moveTo(x - 6 / zoom, y);
      ctx.lineTo(x + 6 / zoom, y);
      ctx.moveTo(x, y - 6 / zoom);
      ctx.lineTo(x, y + 6 / zoom);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 9 / zoom, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }, [
    slice,
    frame,
    metric,
    range,
    curve,
    interpolation,
    contours,
    bounds,
    point,
  ]);
  const select = (e: MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect(),
      x = Math.max(
        0,
        Math.min(
          width - 1,
          Math.floor(bounds.x + ((e.clientX - r.left) / r.width) * bounds.w),
        ),
      ),
      y = Math.max(
        0,
        Math.min(
          height - 1,
          Math.floor(
            bounds.y + (1 - (e.clientY - r.top) / r.height) * bounds.h,
          ),
        ),
      );
    setPoint(x + y * width);
  };
  const valid = point !== null && !!slice.mask[point],
    xyz = point !== null ? slice.world(point) : null,
    rms = valid ? slice.rms(point!) : 0;
  const historyScale = useMemo(
    () =>
      point === null || !slice.mask[point]
        ? 1
        : Math.max(
            1e-12,
            ...result.meta.times.map((_, i) => Math.abs(slice.read(i, point))),
          ),
    [slice, point],
  );
  const trace = useMemo(() => {
    if (point === null || !slice.mask[point]) return "";
    const t0 = result.meta.times[0],
      dt = result.meta.times.at(-1)! - t0;
    return result.meta.times
      .map(
        (t, i) =>
          `${i ? "L" : "M"}${10 + ((t - t0) / Math.max(1e-12, dt)) * 280},${40 - (slice.read(i, point) / historyScale) * 30}`,
      )
      .join(" ");
  }, [slice, point, historyScale]);
  const normal = slice.plane.u.findIndex((v, i) => !v && !slice.plane.v[i]),
    name =
      slice.plane.axis === "yz"
        ? "Side"
        : slice.plane.axis === "xy"
          ? "Front"
          : "Top";
  return (
    <article className="surface pressure-map" ref={root}>
      <div className="pressure-map-heading">
        <div>
          <h3>{name} section</h3>
          <span>
            {"XYZ"[normal]} = {slice.plane.originMm[normal].toFixed(0)} mm ·{" "}
            {pitchMm} mm stored grid
          </span>
        </div>
        <div>
          <button onClick={() => setDetail(!detail)}>
            {detail ? "Show surrounding air" : "Focus on cabinet"}
          </button>
          <button
            aria-label="Expand pressure map"
            onClick={() => void root.current?.requestFullscreen()}
          >
            <Maximize size={16} />
          </button>
        </div>
      </div>
      <div className="pressure-map-stage" ref={stage}>
        <canvas
          ref={canvas}
          aria-label="Solved acoustic field"
          data-field-frame={frame}
          data-physical-time={frameBlend(result, frame, interpolation).time}
          data-slice-axis={slice.plane.axis}
          onPointerMove={(e) => {
            if (!pinned) select(e);
          }}
          onClick={(e) => {
            select(e);
            setPinned(!pinned);
          }}
        />
      </div>
      <div className="pressure-map-scale">
        <div
          style={{
            background:
              metric === "pressure"
                ? pressureGradientCss(curve)
                : "linear-gradient(90deg,#101928,#ff5b31,#ffe9ad)",
          }}
        />
        <div>
          <span>
            {metric === "pressure" ? `−${scale.toPrecision(3)}` : "0"} {unit}
          </span>
          <span>{metric === "pressure" ? "0 · equilibrium" : "magnitude"}</span>
          <span>
            +{scale.toPrecision(3)} {unit}
          </span>
        </div>
      </div>
      <div className="pressure-extrema">
        <span>
          Section min{" "}
          <b>
            {Number.isFinite(minimum) ? minimum.toPrecision(3) : "—"} {unit}
          </b>
        </span>
        <span>
          Section max{" "}
          <b>
            {Number.isFinite(maximum) ? maximum.toPrecision(3) : "—"} {unit}
          </b>
        </span>
        <span>
          {air ? ((100 * clipped) / air).toFixed(1) : 0}% beyond colour range
        </span>
      </div>
      <div className="pressure-inspector" aria-live="off">
        <div>
          <span>
            {pinned
              ? "Pinned point · click to release"
              : "Move over the map · click to pin"}
          </span>
          <strong>
            {valid
              ? `${slice.sample(frame, point!, 0, interpolation).toPrecision(4)} Pa`
              : point === null
                ? "Inspect pressure"
                : "Solid / unrecorded air"}
          </strong>
          <small>
            {xyz
              ? `X ${xyz[0].toFixed(0)} · Y ${xyz[1].toFixed(0)} · Z ${xyz[2].toFixed(0)} mm`
              : "Coordinates and pressure history appear here"}
          </small>
          {valid && <small>Recorded-window RMS {rms.toPrecision(3)} Pa</small>}
          {valid && (
            <small>History scale ±{historyScale.toPrecision(3)} Pa</small>
          )}
        </div>
        <svg
          viewBox="0 0 300 80"
          role="img"
          aria-label="Selected point pressure history"
        >
          <path d="M10 40H290" stroke="#42536b" />
          <path d={trace} fill="none" stroke="#e7bc81" strokeWidth="1.5" />
          <line
            x1={
              10 +
              (result.meta.times.length > 1
                ? ((frameBlend(result, frame, interpolation).time -
                    result.meta.times[0]) /
                    (result.meta.times.at(-1)! - result.meta.times[0])) *
                  280
                : 0)
            }
            x2={
              10 +
              (result.meta.times.length > 1
                ? ((frameBlend(result, frame, interpolation).time -
                    result.meta.times[0]) /
                    (result.meta.times.at(-1)! - result.meta.times[0])) *
                  280
                : 0)
            }
            y1="5"
            y2="75"
            stroke="#fff"
          />
        </svg>
      </div>
      <p className="field-help">
        {metric === "pressure"
          ? "Blue: rarefaction (−). Orange: compression (+). "
          : "Brighter colour indicates greater magnitude. "}
        Colour range stays fixed during playback.{" "}
        {curve === "soft" ? "Weaker pressure is visually enhanced. " : ""}
        {slice.source === "volume"
          ? "Section sampled from the saved pressure volume; velocity is available on the recorded plane only."
          : "Section uses the original pressure and velocity recording."}
      </p>
    </article>
  );
}
