import { add, mul, div, type C } from "./complex";
import type { CircuitElement, Crossover, Driver } from "./types";
export function coilImpedance(driver: Driver, f: number): C {
  const base: C = [driver.re, 2 * Math.PI * f * driver.le * 1e-3],
    loss = driver.lossyInductance;
  if (!loss) return base;
  const l: C = [0, 2 * Math.PI * f * loss.inductance * 1e-3];
  return add(
    base,
    div(mul([loss.resistance, 0], l), add([loss.resistance, 0], l)),
  );
}
export type TwoPort = { a: C; b: C; c: C; d: C };
export const identity = (): TwoPort => ({
  a: [1, 0],
  b: [0, 0],
  c: [0, 0],
  d: [1, 0],
});
export function cascade(x: TwoPort, y: TwoPort): TwoPort {
  return {
    a: add(mul(x.a, y.a), mul(x.b, y.c)),
    b: add(mul(x.a, y.b), mul(x.b, y.d)),
    c: add(mul(x.c, y.a), mul(x.d, y.c)),
    d: add(mul(x.c, y.b), mul(x.d, y.d)),
  };
}
export function elementImpedance(e: CircuitElement, f: number): C {
  const w = 2 * Math.PI * f;
  return e.kind === "R"
    ? [e.value, 0]
    : e.kind === "L"
      ? [e.resistance ?? 0, w * e.value]
      : [e.resistance ?? 0, -1 / (w * e.value)];
}
/** Vin=A*Vcoil+B*Icoil, Iin=C*Vcoil+D*Icoil. Includes the actual load. */
export function passiveNetwork(
  elements: CircuitElement[] | undefined,
  f: number,
): TwoPort {
  return (elements ?? []).reduce((m, e) => {
    const z = elementImpedance(e, f),
      n = identity();
    if (e.connection === "series") n.b = z;
    else n.c = div([1, 0], z);
    return cascade(m, n);
  }, identity());
}
export function activeTransfer(crossover: Crossover | undefined, f: number): C {
  return (crossover?.active ?? []).reduce(
    (v, e) => {
      const x = f / e.frequency,
        den: C = e.order === 1 ? [1, x] : [1 - x * x, Math.SQRT2 * x];
      const num: C =
        e.kind === "lowpass" ? [1, 0] : e.order === 1 ? [0, x] : [-x * x, 0];
      return mul(v, div(num, den));
    },
    [1, 0] as C,
  );
}
