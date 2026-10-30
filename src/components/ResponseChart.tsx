import { useState } from "react";
import type { Simulation, Project } from "../core/types";
import type { ViewState } from "../agent/contracts";
type Metric = "spl" | "impedance" | "excursion" | "velocity" | "groupDelay";
const info: Record<Metric, { label: string; unit: string }> = {
  spl: { label: "Frequency response", unit: "dB SPL" },
  impedance: { label: "Impedance", unit: "Ω" },
  excursion: { label: "Cone excursion", unit: "mm peak" },
  velocity: { label: "Mouth velocity", unit: "m/s peak" },
  groupDelay: { label: "Group delay", unit: "ms" },
};
export function ResponseChart({
  simulation: s,
  project: p,
  comparisons = [],
  view,
  onViewChange,
}: {
  simulation: Simulation & { error?: string };
  project: Project;
  comparisons?: { name: string; color: string; simulation: Simulation }[];
  view?: ViewState;
  onViewChange?: (patch: Partial<ViewState>) => void;
}) {
  const [localMetric, localSetMetric] = useState<Metric>("spl"),
    [localComponents, localSetComponents] = useState(false),
    [hover, setHover] = useState<number | null>(null);
  const metric = view?.metric ?? localMetric,
    components = view?.components ?? localComponents;
  const setMetric = (metric: Metric) =>
    onViewChange ? onViewChange({ metric }) : localSetMetric(metric);
  const setComponents = (components: boolean) =>
    onViewChange
      ? onViewChange({ components })
      : localSetComponents(components);
  if (s.error)
    return (
      <section className="response-card">
        <h3>Simulation unavailable</h3>
        <p className="error-text">{s.error}</p>
        <p>Correct the physical layout to calculate a new response.</p>
      </section>
    );
  const width = 900,
    height = 250,
    left = 48,
    right = 18,
    top = 14,
    bottom = 48,
    w = width - left - right,
    h = height - top - bottom;
  const x = (f: number) => left + (Math.log(f / 15) / Math.log(800 / 15)) * w;
  const multiple = p.mounts && p.mounts.length > 1 ? p.mounts : [],
    sourceColors = [
      "#8cbccb",
      "#bec5c9",
      "#7795ac",
      "#92a99d",
      "#a8a193",
      "#e7e9e8",
      "#648694",
      "#a7b0b7",
    ];
  const threshold =
    metric === "excursion"
      ? multiple.length
        ? null
        : p.driver.xmax
      : metric === "velocity"
        ? p.targets.maxVelocity
        : null;
  const values = [
    ...(metric === "excursion" ? multiple.map((m) => m.driver.xmax) : []),
    ...s.points.map((pt) => pt[metric]),
    ...comparisons.flatMap((c) => c.simulation.points.map((pt) => pt[metric])),
  ];
  const lo =
    metric === "spl"
      ? Math.floor((Math.min(...values) - 4) / 10) * 10
      : metric === "groupDelay"
        ? Math.floor(Math.min(0, ...values) / 10) * 10
        : 0;
  const hi =
    metric === "spl"
      ? Math.ceil((Math.max(...values) + 3) / 10) * 10
      : metric === "impedance"
        ? Math.ceil(Math.max(...values) / 10) * 10
        : Math.max(1, Math.ceil(Math.max(...values, threshold || 0) * 1.15));
  const y = (v: number) => top + h - ((v - lo) / (hi - lo)) * h;
  const line = (data: Simulation, key: Metric | "coneSpl" | "terminusSpl") =>
    data.points
      .map(
        (pt, i) =>
          `${i ? "L" : "M"}${x(pt.frequency).toFixed(2)},${y(pt[key]).toFixed(2)}`,
      )
      .join(" ");
  const nearest =
    hover === null
      ? null
      : s.points.reduce(
          (best, pt) =>
            Math.abs(x(pt.frequency) - hover) <
            Math.abs(x(best.frequency) - hover)
              ? pt
              : best,
          s.points[0],
        );
  return (
    <section className="response-card">
      <div className="response-head">
        <div>
          <span className="eyebrow">SIMULATION / 1 M · HALF-SPACE</span>
          <h3>How will this design respond?</h3>
        </div>
        <select
          aria-label="Chart metric"
          value={metric}
          onChange={(e) => {
            setMetric(e.target.value as Metric);
            setHover(null);
          }}
        >
          {Object.entries(info).map(([key, v]) => (
            <option key={key} value={key}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="chart-legend">
        <span>
          <i style={{ background: "#9ccbd3" }} />
          Current design
        </span>
        {components && metric === "spl" && (
          <>
            <span>
              <i style={{ background: "#7795ac" }} />
              Cone
            </span>
            <span>
              <i style={{ background: "#bec5c9" }} />
              Mouth
            </span>
          </>
        )}
        {comparisons.map((c) => (
          <span key={c.name}>
            <i style={{ background: c.color }} />
            {c.name}
          </span>
        ))}
        {metric === "spl" && (
          <label>
            <input
              type="checkbox"
              checked={components}
              onChange={(e) => setComponents(e.target.checked)}
            />{" "}
            Show components
          </label>
        )}
        {metric === "excursion" &&
          multiple.map((m, i) => (
            <span key={m.id}>
              <i style={{ background: sourceColors[i] }} />
              {m.id} · Xmax {m.driver.xmax} mm
            </span>
          ))}
        <em>{info[metric].unit}</em>
      </div>
      <svg
        className="chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${info[metric].label} prediction`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHover(((e.clientX - rect.left) / rect.width) * width);
        }}
      >
        <defs>
          <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#9ccbd3" stopOpacity=".15" />
            <stop offset="100%" stopColor="#9ccbd3" stopOpacity="0" />
          </linearGradient>
          <clipPath id="plot">
            <rect x={left} y={top} width={w} height={h} />
          </clipPath>
        </defs>
        <rect
          x={x(p.targets.low)}
          y={top}
          width={x(p.targets.high) - x(p.targets.low)}
          height={h}
          fill="#1e333d"
        />
        {Array.from({ length: 5 }, (_, i) => {
          const v = lo + ((hi - lo) * i) / 4;
          return (
            <g key={i}>
              <line
                x1={left}
                x2={width - right}
                y1={y(v)}
                y2={y(v)}
                stroke="#35434d"
                strokeDasharray="3 4"
              />
              <text x={left - 10} y={y(v) + 4} textAnchor="end">
                {v.toFixed(metric === "spl" || metric === "impedance" ? 0 : 1)}
              </text>
            </g>
          );
        })}
        {[20, 30, 50, 80, 100, 200, 300, 500, 800].map((f) => (
          <g key={f}>
            <line
              x1={x(f)}
              x2={x(f)}
              y1={top}
              y2={height - bottom}
              stroke="#26343e"
            />
            <text x={x(f)} y={height - 22} textAnchor="middle">
              {f}
            </text>
          </g>
        ))}
        <text x={left + w / 2} y={height - 4} textAnchor="middle">
          Frequency (Hz)
        </text>
        <g clipPath="url(#plot)">
          <path
            d={`${line(s, metric)} L${x(800)},${y(lo)} L${x(15)},${y(lo)} Z`}
            fill="url(#area)"
          />
          {threshold !== null && (
            <>
              <line
                x1={left}
                x2={width - right}
                y1={y(threshold)}
                y2={y(threshold)}
                stroke="#bca66b"
                strokeDasharray="5 4"
              />
              <text
                x={width - right - 5}
                y={y(threshold) - 5}
                textAnchor="end"
                fill="#bca66b"
              >
                {metric === "excursion" ? "Xmax" : "Velocity limit"}
              </text>
            </>
          )}
          {components && metric === "spl" && (
            <>
              <path
                d={line(s, "coneSpl")}
                fill="none"
                stroke="#7795ac"
                strokeWidth="1.4"
                strokeDasharray="5 4"
              />
              <path
                d={line(s, "terminusSpl")}
                fill="none"
                stroke="#bec5c9"
                strokeWidth="1.4"
                strokeDasharray="2 4"
              />
            </>
          )}
          {comparisons.map((c, i) => (
            <path
              key={c.name}
              d={line(c.simulation, metric)}
              fill="none"
              stroke={c.color}
              strokeWidth="1.7"
              strokeDasharray={["6 3", "2 4", "8 3 2 3", "12 5"][i % 4]}
            />
          ))}
          {metric === "excursion" &&
            multiple.map((m, j) => (
              <g key={m.id}>
                <path
                  d={s.points
                    .map(
                      (pt, i) =>
                        `${i ? "L" : "M"}${x(pt.frequency)},${y(pt.drivers?.find((d) => d.id === m.id)?.excursion ?? 0)}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke={sourceColors[j]}
                  strokeWidth="1.4"
                  strokeDasharray={["", "6 3", "2 4", "8 3 2 3", "12 5"][j % 5]}
                />
                <line
                  x1={left}
                  x2={width - right}
                  y1={y(m.driver.xmax)}
                  y2={y(m.driver.xmax)}
                  stroke={sourceColors[j]}
                  strokeDasharray="3 5"
                />
              </g>
            ))}
          <path
            d={line(s, metric)}
            fill="none"
            stroke="#9ccbd3"
            strokeWidth="2.7"
          />
        </g>
        {nearest && (
          <g>
            <line
              x1={x(nearest.frequency)}
              x2={x(nearest.frequency)}
              y1={top}
              y2={height - bottom}
              stroke="#7b939f"
            />
            <circle
              cx={x(nearest.frequency)}
              cy={y(nearest[metric])}
              r="4"
              fill="#9ccbd3"
              stroke="#101c25"
              strokeWidth="2"
            />
            <rect
              x={Math.min(
                width - 170,
                Math.max(left, x(nearest.frequency) + 10),
              )}
              y={top + 4}
              width="150"
              height="28"
              rx="4"
              fill="#dce8ed"
            />
            <text
              x={Math.min(
                width - 160,
                Math.max(left + 10, x(nearest.frequency) + 20),
              )}
              y={top + 23}
              fill="#101c25"
              className="tooltip-text"
            >
              {nearest.frequency.toFixed(1)} Hz · {nearest[metric].toFixed(1)}{" "}
              {info[metric].unit}
            </text>
          </g>
        )}
      </svg>
      <div className="chart-foot">
        <span>
          Shaded region: {p.targets.low}–{p.targets.high} Hz target band
        </span>
        <span>{p.design.voltage} V RMS · 15–800 Hz sweep</span>
      </div>
      {metric === "impedance" && s.impedanceConvention && (
        <p className="field-help">
          {s.impedanceConvention === "first-driven-source"
            ? "Different source excitations: impedance is voltage / current at the first driven source. It is not a shared amplifier load."
            : "Impedance is the common excitation voltage divided by total source current (parallel input)."}
        </p>
      )}
    </section>
  );
}
