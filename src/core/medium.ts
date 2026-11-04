import { add, sub, mul, div, scale, sqrt, cosh, sinh, type C } from "./complex";
import type { Project, Section, StuffingRegion, PorousMaterial } from "./types";

export const mediumSources = {
  thermoviscous:
    "https://doc.comsol.com/6.4/doc/com.comsol.help.aco/aco_ug_pressure.05.186.html (wide duct limit)",
  mjk: "http://quarter-wave.com/TLs/Damping_Coefficient.pdf (2003 empirical fit, not verified as the 2023 worksheet model)",
  jcal: "https://apmr.matelys.com/PropagationModels/MotionlessSkeleton/JohnsonChampouxAllardLafargeModel.html",
  jca: "https://apmr.matelys.com/PropagationModels/MotionlessSkeleton/JohnsonChampouxAllardModel.html",
  miki: "https://doi.org/10.1250/ast.11.19 (1990 equations30–34; f/sigma in SI)",
  empirical: "https://ntrs.nasa.gov/citations/20160010140 (equations1–2, X=rho_air*f/sigma)",
};
export function air(
  temperature: number,
  explicit?: NonNullable<Project["system"]>["air"],
) {
  const kelvin = 273.15 + temperature,
    c = explicit?.soundSpeedMs ?? 331.3 + 0.606 * temperature,
    rho = explicit?.densityKgM3 ?? (1.2041 * 293.15) / kelvin;
  const viscosity =
    (1.716e-5 * (kelvin / 273.15) ** 1.5 * (273.15 + 111)) / (kelvin + 111);
  return {
    c,
    rho,
    viscosity,
    prandtl: 0.71,
    heatCapacity: 1005,
    gamma: 1.4,
    pressure: (rho * c * c) / 1.4,
  };
}
export const projectAir = (p: Project) =>
  air(p.design.temperature, p.system?.air);
/** e^(jωt): passive effective density has negative imaginary part. */
export function jcal(
  f: number,
  temperature: number,
  m: Extract<StuffingRegion["material"], { model: "jcal" }>,
  explicit?: NonNullable<Project["system"]>["air"],
) {
  const a = air(temperature, explicit),
    w = 2 * Math.PI * f,
    phi = m.porosity,
    tau = m.tortuosity,
    sigma = m.flowResistivity;
  const lv = m.viscousLengthUm * 1e-6,
    lt = m.thermalLengthUm * 1e-6,
    kp = m.thermalPermeability;
  const conductivity = (a.viscosity * a.heatCapacity) / a.prandtl;
  const gv = sqrt([
    1,
    (4 * tau * tau * a.viscosity * a.rho * w) /
      (sigma * sigma * lv * lv * phi * phi),
  ]);
  const density = scale(
    add([1, 0], mul([0, (-sigma * phi) / (w * a.rho * tau)], gv)),
    (tau * a.rho) / phi,
  );
  const gt = sqrt([
    1,
    (4 * kp * kp * a.heatCapacity * a.rho * w) /
      (conductivity * lt * lt * phi * phi),
  ]);
  const thermal = add(
    [1, 0],
    mul([0, (-phi * conductivity) / (kp * a.heatCapacity * a.rho * w)], gt),
  );
  const bulk = div(
    [(a.gamma * a.pressure) / phi, 0],
    sub([a.gamma, 0], div([a.gamma - 1, 0], thermal)),
  );
  return { density, bulk };
}
/** JCA is JCAL with the analytical thermal permeability phi*Lambda'^2/8.
 * This is the JCA closure, not an inferred measurement of thermal permeability. */
export function jca(f:number, temperature:number, m:Extract<PorousMaterial,{model:'jca'}>, explicit?:NonNullable<Project['system']>['air']) {
  return jcal(f,temperature,{...m,model:'jcal',thermalPermeability:m.porosity*(m.thermalLengthUm*1e-6)**2/8},explicit);
}
export function materialMedium(f:number,temperature:number,m:PorousMaterial,explicit?:NonNullable<Project['system']>['air']) {
  if (!(f>0) || !Number.isFinite(f)) throw Error('Material frequency must be positive and finite.');
  if(m.model==='jca')return jca(f,temperature,m,explicit);
  if(m.model==='jcal')return jcal(f,temperature,m,explicit);
  if(m.model==='mjk-2003')return mjk2003(f,temperature,m.densityKgM3,explicit);
  const a=air(temperature,explicit),w=2*Math.PI*f;
  // Do not merge these normalizations: Miki1990 uses f/sigma; NASA2016 uses rho*f/sigma.
  const x=(m.model==='miki'?f:a.rho*f)/m.flowResistivity;
  const c=m.model==='miki'?[.070,-.632,.107,-.632,.160,-.618,.109,-.618]:m.coefficients;
  const z:C=[a.rho*a.c*(1+c[0]*x**c[1]),-a.rho*a.c*c[2]*x**c[3]];
  const k:C=[w/a.c*(1+c[6]*x**c[7]),-w/a.c*c[4]*x**c[5]];
  return {density:scale(mul(k,z),1/w),bulk:scale(div(z,k),w)};
}
export function liningFraction(section:Section,thicknessMm:number) {
  const width=section.width,depth=section.area/width;
  if(!(thicknessMm>0) || 2*thicknessMm>=Math.min(width,depth))throw Error('Lining thickness must leave an open air core in every section.');
  return 1-(width-2*thicknessMm)*(depth-2*thicknessMm)/section.area;
}
/** Long-wavelength equal-pressure parallel channels: rho^-1 and K^-1 add by area.
 * It is not a transverse lined-duct mode solution. 3D instead places real liner cells. */
export function parallelMedium(core:{density:C;bulk:C},liner:{density:C;bulk:C},fraction:number) {
  return {density:div([1,0],add(scale(div([1,0],core.density),1-fraction),scale(div([1,0],liner.density),fraction))),bulk:div([1,0],add(scale(div([1,0],core.bulk),1-fraction),scale(div([1,0],liner.bulk),fraction)))};
}
/** Propagation/energy diagnostics for a rigid-backed normal-incidence material coupon. */
export function materialLayer(f:number,temperature:number,m:PorousMaterial,thicknessMm:number,explicit?:NonNullable<Project['system']>['air']) {
  if(!(thicknessMm>0) || !Number.isFinite(thicknessMm))throw Error('Sample thickness must be positive and finite.');
  const medium=materialMedium(f,temperature,m,explicit),a=air(temperature,explicit),w=2*Math.PI*f;
  const k=scale(sqrt(div(medium.density,medium.bulk)),w),z=sqrt(mul(medium.density,medium.bulk)),gamma:C=[-k[1],k[0]];
  const t=scale(gamma,thicknessMm*1e-3),surface=mul(z,div(cosh(t),sinh(t))),r=div(sub(surface,[a.rho*a.c,0]),add(surface,[a.rho*a.c,0]));
  return {density:medium.density,bulk:medium.bulk,wavenumber:k,characteristicImpedance:z,surfaceImpedance:surface,absorption:1-r[0]**2-r[1]**2};
}
export function mjk2003(
  f: number,
  temperature: number,
  densityKgM3: number,
  explicit?: NonNullable<Project["system"]>["air"],
) {
  const a = air(temperature, explicit),
    d = densityKgM3 / 16.0184634;
  if (d < 0 || d > 0.5730001)
    throw Error(
      "MJK2003 density exceeds the retained empirical calibration range (0–0.573 lb/ft³).",
    );
  const order = 2 - Math.max(0, d - 0.2) / 0.2 + Math.max(0, d - 0.4) / 0.2;
  // King explicitly defines cycle=2*pi*rad, Hz=cycle/sec (DX3 worksheet p1).
  // Therefore omega/(50*Hz) = (2*pi*f)/(50*2*pi), not omega/50 s^-1.
  const x = (f / 50) ** order,
    lambda = 10 + (1570 * d * x) / (1 + x);
  const ds = [0, 0.191, 0.382, 0.573],
    cs = [342, 335, 325, 320];
  const i = Math.max(
    1,
    ds.findIndex((x) => x >= d),
  );
  const speed =
    ((cs[i - 1] +
      ((cs[i] - cs[i - 1]) * (d - ds[i - 1])) / (ds[i] - ds[i - 1])) *
      a.c) /
    342;
  return {
    density: [a.rho, -lambda / (2 * Math.PI * f)] as C,
    bulk: [a.rho * speed * speed, 0] as C,
    lambda,
    speed,
  };
}
export function sectionMedium(
  p: Project,
  s: Section,
  f: number,
  fraction: number,
) {
  const physics = p.system?.physics;
  const region = physics?.stuffing?.find(
    (r) => fraction >= r.start && fraction < r.end,
  );
  if (region) {
    const material=materialMedium(f,p.design.temperature,region.material,p.system?.air);
    return region.placement?.kind==='lining'?parallelMedium(emptySectionMedium(p,s,f),material,liningFraction(s,region.placement.thicknessMm)):material;
  }
  return emptySectionMedium(p,s,f);
}
export function emptySectionMedium(p:Project,s:Section,f:number) {
  const a=projectAir(p),physics=p.system?.physics;
  if (physics?.ductLoss === "mjk-2003")
    return mjk2003(f, p.design.temperature, 0, p.system?.air);
  let density: C = [a.rho, 0],
    bulk: C = [a.rho * a.c * a.c, 0];
  if (physics?.ductLoss === "thermoviscous") {
    const width = s.width * 1e-3,
      depth = (s.area / s.width) * 1e-3,
      area = width * depth,
      perimeter = 2 * (width + depth);
    const delta = Math.sqrt((2 * a.viscosity) / (a.rho * 2 * Math.PI * f)),
      v = (delta * perimeter) / (2 * area),
      t = v / Math.sqrt(a.prandtl);
    if (v > 0.25)
      throw Error(
        "Wide-duct boundary-layer approximation outside its range; use a resolved thermoviscous model.",
      );
    density = div(density, [1 - v, v]);
    bulk = div(bulk, [1 + (a.gamma - 1) * t, -(a.gamma - 1) * t]);
  }
  return { density, bulk };
}
export function mediumMatrix(
  p: Project,
  s: Section,
  f: number,
  length: number,
  fraction: number,
) {
  const m = sectionMedium(p, s, f, fraction),
    area = s.area * 1e-6,
    w = 2 * Math.PI * f;
  const k = scale(sqrt(div(m.density, m.bulk)), w),
    gamma: C = [-k[1] + s.damping * Math.sqrt(f / 100), k[0]];
  const z = scale(sqrt(mul(m.density, m.bulk)), 1 / area),
    a = cosh(scale(gamma, length)),
    b = sinh(scale(gamma, length));
  return { a, b: mul(b, z), c: div(b, z), d: a };
}
