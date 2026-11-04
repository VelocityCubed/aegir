import { useEffect, useMemo, useState, useId } from "react";
import type { Project } from "../core/types";
import type { Circuit } from "../core/circuit-schema";
import { circuitElectricalKey, circuitMounts } from "../core/circuit";
import type { CircuitPreviewResult } from "../core/circuit-preview";
const colours = [
  "#b9e8d2",
  "#dbb078",
  "#a6a5e3",
  "#85b6d0",
  "#d89baf",
  "#a5bd7b",
  "#d0cbb3",
  "#bbc4d0",
];
export function useCircuitPreview(project: Project, circuit: Circuit) {
  const key = JSON.stringify([
    circuitElectricalKey(circuit),
    circuitMounts(project).map((m) => ({
      id: m.id,
      driver: m.driver,
      rearLoading: m.rearLoading,
    })),
    project.design.voltage,
    project.design.temperature,
  ]);
  const [answer, setAnswer] = useState<
    (CircuitPreviewResult & { key: string }) | null
  >(null);
  useEffect(() => {
    const w = new Worker(new URL("../circuit.worker.ts", import.meta.url), {
      type: "module",
    });
    w.onmessage = (e) => setAnswer(e.data);
    w.onerror = (e) =>
      setAnswer({
        key,
        issues: [e.message || "Circuit calculation failed."],
        points: [],
      });
    w.postMessage({ key, project, circuit });
    return () => w.terminate();
  }, [key]);
  return {
    pending: answer?.key !== key,
    answer: answer?.key === key ? answer : null,
  };
}
export function CircuitPreview({
  project,
  circuit,
  result,
}: {
  project: Project;
  circuit: Circuit;
  result: ReturnType<typeof useCircuitPreview>;
}) {
  const [metric, setMetric] = useState<"db" | "phase" | "impedance">("db"),
    [hover, setHover] = useState<number | null>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, ""),
    points = result.answer?.points ?? [],
    mounts = circuitMounts(project);
  const width = 820,
    height = 220,
    left = 48,
    right = 18,
    top = 14,
    bottom = 35,
    w = width - left - right,
    h = height - top - bottom,
    x = (f: number) => left + (Math.log(f / 20) / Math.log(1000)) * w;
  const maxZ = Math.max(
      10,
      ...points.flatMap((p) => p.inputs.map((i) => i.impedance ?? 0)),
    ),
    lo = metric === "db" ? -60 : metric === "phase" ? -180 : 0,
    hi =
      metric === "db"
        ? Math.max(12, ...points.flatMap((p) => p.drivers.map((d) => d.db)))
        : metric === "phase"
          ? 180
          : Math.ceil(maxZ / 10) * 10,
    y = (v: number) => top + h - ((v - lo) / (hi - lo)) * h;
  const traces =
    metric === "impedance"
      ? (points[0]?.inputs.map((i) => ({
          id: i.id,
          label: circuit.parts.find((p) => p.id === i.id)?.label ?? i.id,
        })) ?? [])
      : mounts.map((m) => ({ id: m.id, label: m.driver.name.split(" · ")[0] }));
  const path = (index: number) =>
    points
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${x(p.frequency)},${y(metric === "impedance" ? (p.inputs[index].impedance ?? hi) : p.drivers[index][metric])}`,
      )
      .join(" ");
  const at =
    hover === null
      ? null
      : points.reduce(
          (a, b) =>
            Math.abs(x(a.frequency) - hover) < Math.abs(x(b.frequency) - hover)
              ? a
              : b,
          points[0],
        );
  return (
    <section
      className="circuit-preview"
      aria-label="Electrical circuit preview"
    >
      <div className="circuit-preview-heading">
        <div>
          <b>Electrical response</b>
          <span>
            {result.pending
              ? "Calculating…"
              : result.answer?.issues.length
                ? "Complete the circuit to see a preview"
                : "Free-air T/S driver loads · not acoustic SPL"}
          </span>
        </div>
        <select
          aria-label="Crossover preview metric"
          value={metric}
          onChange={(e) => setMetric(e.target.value as typeof metric)}
        >
          <option value="db">Driver voltage · dB</option>
          <option value="phase">Driver voltage · phase</option>
          <option value="impedance">Amplifier load · Ω</option>
        </select>
      </div>
      {!!points.length && (
        <>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="Crossover electrical response"
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setHover(((e.clientX - r.left) / r.width) * width);
            }}
          >
            <defs>
              <clipPath id={"circuit-plot-" + id}>
                <rect x={left} y={top} width={w} height={h} />
              </clipPath>
            </defs>
            {[0, 1, 2, 3, 4].map((i) => {
              const value = lo + ((hi - lo) * i) / 4;
              return (
                <g key={i}>
                  <path
                    d={`M${left},${y(value)}H${width - right}`}
                    stroke="#354d40"
                    strokeDasharray="3 4"
                  />
                  <text x={left - 8} y={y(value) + 4} textAnchor="end">
                    {value.toFixed(0)}
                  </text>
                </g>
              );
            })}
            {[20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].map(
              (f) => (
                <g key={f}>
                  <path d={`M${x(f)},${top}V${top + h}`} stroke="#283d32" />
                  <text x={x(f)} y={height - 12} textAnchor="middle">
                    {f >= 1000 ? f / 1000 + "k" : f}
                  </text>
                </g>
              ),
            )}
            <g clipPath={`url(#circuit-plot-${id})`}>
              {traces.map((t, i) => (
                <path
                  key={t.id}
                  d={path(i)}
                  stroke={colours[i % colours.length]}
                  strokeWidth={2}
                  fill="none"
                />
              ))}
              {at && (
                <path
                  d={`M${x(at.frequency)},${top}V${top + h}`}
                  stroke="#d9e8dc"
                  strokeDasharray="4 3"
                />
              )}
            </g>
          </svg>
          <div className="circuit-preview-legend">
            {traces.map((t, i) => (
              <span key={t.id}>
                <i style={{ background: colours[i % colours.length] }} />
                {t.label}
                {at
                  ? ` · ${metric === "impedance" ? (at.inputs[i].impedance?.toFixed(1) ?? "open") + " Ω" : at.drivers[i][metric].toFixed(1) + (metric === "phase" ? "°" : " dB")}`
                  : ""}
              </span>
            ))}
            <em>{at ? at.frequency.toFixed(0) + " Hz" : "20 Hz – 20 kHz"}</em>
          </div>
        </>
      )}
      <p>
        Includes the drawn wiring and loaded circuit. Voltage is relative to the
        base amplifier voltage. Cabinet loading and acoustic interference belong
        to the speaker simulation.
      </p>
    </section>
  );
}
