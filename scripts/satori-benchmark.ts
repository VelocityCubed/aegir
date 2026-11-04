import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { simulate } from "../src/core/acoustics";
import {
  referenceReport,
  closedOpenModes,
  profileVolume,
} from "../src/core/system";
import { validateProject } from "../src/core/validation";
import type { Project } from "../src/core/types";
const p: Project = JSON.parse(
  readFileSync("examples/satori-reference.aegir.json", "utf8"),
);
validateProject(p);
const full = simulate(p, 1000),
  fullReport = referenceReport(p, full);
const bass = structuredClone(p);
bass.name += " · empty unfiltered woofer test";
bass.mounts = bass.mounts!.slice(0, 1);
delete bass.mounts[0].crossover;
bass.system!.references = bass.system!.references!.filter(
  (r) => r.metric === "impedance",
);
bass.system!.distanceM = 1;
const empty = simulate(bass, 1000),
  bassReport = referenceReport(bass, empty);
const axial = [35.4, 144.5, 242.8, 339.7, 438.2, 527.1, 605.8, 697.1];
const modes = closedOpenModes(p, 750);
const ansys = axial.map((reference, i) => ({
  mode: i + 1,
  reference,
  actual: modes[i],
  errorPercent: 100 * (modes[i] / reference - 1),
}));
const out = "test-results/satori";
mkdirSync(out, { recursive: true });
const data = {
  source:
    "MJK 2023-09-23; Fig8/11/15/18; approximate raster digitization. No response fitting.",
  full: fullReport,
  empty: bassReport,
  ansys,
  profileVolumeLitres: profileVolume(p),
  acceptance: "not-achieved",
  coverage: [
    {
      figure: "8/11",
      case: "Acoustic profile volume and axial modes",
      status: fullReport.modal!.status,
    },
    {
      figure: "15",
      case: "Empty unfiltered impedance, sparse10–45Hz subset",
      status: bassReport.curves[0].status,
    },
    {
      figure: "15/16",
      case: "Near-field cone and terminus amplitudes; stuffed impedance",
      status: "unsupported measurement operator and calibrated stuffing",
    },
    {
      figure: "17/18",
      case: "Unfiltered drivers and passive anechoic sum",
      status:
        "incompatible piston radiation, stuffing and unknown reference voltage",
    },
    { figure: "19", case: "Active anechoic sum", status: "not yet compared" },
    {
      figure: "20/21",
      case: "Vertical polar responses",
      status: "unsupported directivity/observation geometry",
    },
    {
      figure: "22–29 / Attachment4",
      case: "Room and boundary-dependent responses",
      status: "unsupported matched room model",
    },
  ],
};
data.acceptance = data.coverage.every((c) => c.status === "within-tolerance")
  ? "achieved"
  : "not-achieved";
writeFileSync(out + "/comparison.json", JSON.stringify(data, null, 2));
writeFileSync(
  out + "/empty-response.csv",
  "frequency_Hz,impedance_ohm,cone_1m_equivalent_dBSPL,terminus_1m_equivalent_dBSPL\n" +
    empty.points
      .map((x) =>
        [x.frequency, x.impedance, x.coneSpl, x.terminusSpl].join(","),
      )
      .join("\n"),
);
writeFileSync(
  out + "/passive-response.csv",
  "frequency_Hz,total_dBSPL,woofer_dBSPL,tweeter_dBSPL,impedance_ohm\n" +
    full.points
      .map((x) =>
        [
          x.frequency,
          x.spl,
          x.drivers![0].spl,
          x.drivers![1].spl,
          x.impedance,
        ].join(","),
      )
      .join("\n"),
);
const plot = (
  title: string,
  sim: typeof full,
  metric: "spl" | "impedance",
  ref: NonNullable<Project["system"]>["references"],
  lo: number,
  hi: number,
) => {
  const x = (f: number) =>
      60 + (800 * Math.log10(f / 10)) / Math.log10(20000 / 10),
    y = (v: number) => 320 - (280 * (v - lo)) / (hi - lo);
  const path = sim.points
    .map((v, i) => `${i ? "L" : "M"}${x(v.frequency)},${y(v[metric])}`)
    .join(" ");
  return `<h2>${title}</h2><svg viewBox="0 0 900 365" role="img" aria-label="${title}"><rect x="60" y="40" width="800" height="280" fill="#fff" stroke="#bbb"/>${[10, 100, 1000, 10000].map((f) => `<path d="M${x(f)} 40V320" stroke="#ddd"/><text x="${x(f)}" y="345">${f}Hz</text>`).join("")}${Array.from(
    { length: 6 },
    (_, i) => {
      const v = lo + ((hi - lo) * i) / 5;
      return `<path d="M60 ${y(v)}H860" stroke="#ddd"/><text x="10" y="${y(v)}">${v}</text>`;
    },
  ).join(
    "",
  )}<defs><clipPath id="${metric}"><rect x="60" y="40" width="800" height="280"/></clipPath></defs><g clip-path="url(#${metric})"><path d="${path}" fill="none" stroke="#146b83" stroke-width="2"/>${ref
    ?.filter((r) => r.metric === metric)
    .map((r) =>
      r.samples
        .map(
          ([f, v]) =>
            `<circle cx="${x(f)}" cy="${y(v)}" r="4" fill="#c04436"/>`,
        )
        .join(""),
    )
    .join("")}</g></svg>`;
};
writeFileSync(
  out + "/comparison.html",
  `<!doctype html><meta charset="utf-8"><title>Satori reference benchmark</title><style>body{max-width:1050px;margin:40px auto;font:16px system-ui;color:#20313b}svg{width:100%}td,th{padding:8px;text-align:right;border-bottom:1px solid #ccc}pre{white-space:pre-wrap}</style><h1>Satori reference reproduction — discrepancies retained</h1><p>Blue: ÆGIR. Red: approximate published raster samples. No gain or damping was fitted. SPL comparison is incompatible with the paper's anechoic stuffed cabinet conditions.</p>${plot("Empty unfiltered woofer: low-frequency impedance", empty, "impedance", bass.system!.references, 0, 60)}${plot("Passive two-way: provisional half-space piston sum at 3 m", full, "spl", p.system!.references, 40, 100)}<h2>Axial modes (Hz)</h2><table><tr><th>Mode</th><th>ÆGIR digitized 1D</th><th>Paper 1D</th><th>Paper ANSYS 3D</th><th>Error vs 3D</th></tr>${ansys.map((r, i) => `<tr><td>${i + 1}</td><td>${r.actual.toFixed(2)}</td><td>${fullReport.modal!.rows[i].reference}</td><td>${r.reference}</td><td>${r.errorPercent.toFixed(2)}%</td></tr>`).join("")}</table><h2>Comparison evidence</h2><pre>${JSON.stringify(data, null, 2).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</pre>`,
);
console.log(
  JSON.stringify(
    {
      drivers: fullReport.drivers,
      profileVolumeLitres: data.profileVolumeLitres,
      modal: fullReport.modal,
      empty: bassReport.curves.map(({ rows, ...v }) => v),
      full: fullReport.curves.map(({ rows, ...v }) => v),
      ansys,
      report: out + "/comparison.html",
    },
    null,
    2,
  ),
);
if (process.argv.includes("--check"))
  process.exitCode = data.coverage.every((c) => c.status === "within-tolerance")
    ? 0
    : 1;
