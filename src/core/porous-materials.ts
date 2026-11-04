import type { PorousMaterial, StuffingRegion, Project } from "./types";

export interface MaterialPreset {
  id: string;
  name: string;
  family: string;
  material: PorousMaterial;
  source: string;
  evidence: "published-measurement" | "published-fit";
  note: string;
  frequencyRangeHz?: [number, number];
}
/** Source specimens, not universal product specifications. Never scale transport
 * parameters from bulk density or silently claim a purchased batch is characterized. */
export const materialPresets: MaterialPreset[] = [
  {
    id: "hollofil-2003",
    name: "Hollow polyester · historical loose fill",
    family: "Loose fibre",
    material: { model: "mjk-2003", densityKgM3: 8.0092317 },
    source:
      "Martin J. King, 2003 damping correlation, Dacron Hollofil II; http://quarter-wave.com/TLs/Damping_Coefficient.pdf pp1–3. Interpolated speed and transfer to other batches remain assumptions.",
    evidence: "published-fit",
    note: "For the historical Hollofil correlation only. Density is adjustable within its retained calibration range; it is not a generic wool or foam model.",
  },
  {
    id: "polyester-wm20-2018",
    name: "Polyester batt · WM20 research sample",
    family: "Fibre batt",
    material: { model: "miki", flowResistivity: 5757 },
    source:
      "Yang et al., Study on the sound absorption behavior of multi-component polyester nonwovens, doi:10.1177/0040517518811940, accepted manuscript Table2/PDF p8: WM20, thickness24.09mm, density21.07kg/m³, measured sigma5757±589Pa·s/m²; acoustic tests200–4200Hz. https://eprints.whiterose.ac.uk/id/eprint/142018/1/Accepted%20version.pdf",
    evidence: "published-measurement",
    frequencyRangeHz: [200, 4200],
    note: "Measured airflow resistance; Miki is an empirical fibrous approximation. Specific uncompressed test specimen; no conversion from loose-fill density.",
  },
  {
    id: "polyester-wm20-compressed-2018",
    name: "Polyester batt · compressed WM20 sample",
    family: "Fibre batt",
    material: { model: "miki", flowResistivity: 14989 },
    source:
      "Yang et al., doi:10.1177/0040517518811940, accepted manuscript Table2/PDF p8: WM20, thickness14.27mm, density35.56kg/m³, measured sigma14989±285Pa·s/m²; acoustic tests200–4200Hz. https://eprints.whiterose.ac.uk/id/eprint/142018/1/Accepted%20version.pdf",
    evidence: "published-measurement",
    frequencyRangeHz: [200, 4200],
    note: "Separate measured compressed specimen. Compression changes resistance; this is not a density scaling rule.",
  },
  {
    id: "glass-wool-miki1990",
    name: "Glass wool · Miki research example",
    family: "Mineral fibre",
    material: { model: "miki", flowResistivity: 9000 },
    source:
      "Y. Miki, 1990, doi:10.1250/ast.11.19, PDF p4 Figure4: 50mm glass wool, density32kg/m³; sigma9000Pa·s/m² was fitted, not directly measured. https://www.jstage.jst.go.jp/article/ast1980/11/1/11_1_19/_article",
    evidence: "published-fit",
    note: "Published fitted example, not manufacturer specifications. Mineral wool and other fibre products need their own measured resistance.",
  },
  {
    id: "melamine-jca-2024",
    name: "Melamine foam · measured research sample",
    family: "Open-cell foam",
    material: {
      model: "jca",
      flowResistivity: 8644,
      porosity: 0.97,
      tortuosity: 1.02,
      viscousLengthUm: 123,
      thermalLengthUm: 168,
    },
    source:
      "Sgard, Atalla & Robin, 2024, On the use of the local reflection coefficient to assess the diffuse field sound absorption coefficient of a porous material, Table1. doi:10.3389/facou.2024.1414356. https://www.frontiersin.org/journals/acoustics/articles/10.3389/facou.2024.1414356/full",
    evidence: "published-measurement",
    note: "Measured for one foam sample. Use measured properties for your own grade or batch when available.",
  },
  {
    id: "melamine-mlulb-2016",
    name: "Melamine foam · NASA MLULb research fit",
    family: "Open-cell foam",
    material: {
      model: "empirical-power-law",
      flowResistivity: 9400,
      coefficients: [
        0.0325, -0.8541, 0.1804, -0.563, 0.2671, -0.5566, 0.0401, -0.9238,
      ],
    },
    frequencyRangeHz: [100, 1000],
    source:
      "Allen & Schiller, NASA/NOISE-CON2016, Experimental evaluation of equivalent-fluid models for melamine foam, Table1 and pp3–6. Soundfoam MLULb specimen, measured sigma9400Pa·s/m²; published eight-coefficient fit uses X=rho_air*f/sigma. https://ntrs.nasa.gov/citations/20160010140",
    evidence: "published-fit",
    note: "Fit weighted below1kHz; approximate declared use band100–1000Hz from the study plots. Frame effects near1kHz are not modelled. Not a universal foam law.",
  },
];
export function presetRegion(id: string, start = 0, end = 1): StuffingRegion {
  const preset = materialPresets.find((m) => m.id === id);
  if (!preset) throw Error("Unknown material preset.");
  return {
    start,
    end,
    source: preset.source,
    calibration: "assumed",
    presetId: id,
    material: structuredClone(preset.material),
    ...(preset.frequencyRangeHz
      ? { frequencyRangeHz: [...preset.frequencyRangeHz] as [number, number] }
      : {}),
  };
}
export function materialWarnings(
  p: Project,
  band: [number, number] = p.system?.sweep ?? [15, 20000],
) {
  const warnings: string[] = [];
  for (const [i, r] of (p.system?.physics?.stuffing ?? []).entries()) {
    const label = `Material ${i + 1}`;
    if(r.material.model!=='mjk-2003')warnings.push(`${label}: material properties are treated as isotropic. Match the source measurement direction and packing; fibre orientation and compression can change them.`);
    if (r.material.model === "miki") {
      const low = 0.01 * r.material.flowResistivity,
        high = r.material.flowResistivity;
      if (band[0] < low || band[1] > high)
        warnings.push(
          `${label}: Miki regression range is ${low.toFixed(1)}–${high.toFixed(0)}Hz (0.01<f/sigma<1). Values outside it are extrapolated, not validated bass predictions.`,
        );
    }
    if (
      r.frequencyRangeHz &&
      (band[0] < r.frequencyRangeHz[0] || band[1] > r.frequencyRangeHz[1])
    )
      warnings.push(
        `${label}: retained material use band is ${r.frequencyRangeHz[0]}–${r.frequencyRangeHz[1]}Hz; results outside that band are not validated by this preset.`,
      );
    if (r.placement)
      warnings.push(
        `${label}: 1D wall lining uses an equal-pressure parallel-channel approximation. The 3D steady-tone solver places the liner at channel walls; refine cells across its thickness.`,
      );
    if (r.material.model === "jca" || r.material.model === "jcal")
      warnings.push(
        `${label}: rigid-frame equivalent fluid; frame vibration, anisotropy and nonlinear flow are not predicted. JCA/JCAL low-frequency asymptotes are approximate.`,
      );
    if (r.presetId)
      warnings.push(
        `${label}: source specimen parameters do not characterize an arbitrary purchased batch. ${materialPresets.find((v) => v.id === r.presetId)?.note ?? "Imported preset metadata."}`,
      );
  }
  return warnings;
}
