import { abs, add, sub, mul, div, type C } from "./complex";
/** Pivoted complex solve; no artificial grounding/leakage is added to singular networks. */
export function solveComplex(matrix: C[][], rhs: C[]): C[] {
  const n = rhs.length,
    a = matrix.map((r, i) => [...r.map((v) => [...v] as C), [...rhs[i]] as C]);
  const scales = a.map((r) => Math.max(...r.slice(0, n).map(abs)));
  for (let k = 0; k < n; k++) {
    let pivot = k,
      best = 0;
    for (let i = k; i < n; i++) {
      const ratio = abs(a[i][k]) / (scales[i] || 1);
      if (ratio > best) {
        best = ratio;
        pivot = i;
      }
    }
    if (best < 1e-13)
      throw Error(
        "Circuit is singular or ill-conditioned. Check floating nodes, shorted inputs and component values.",
      );
    [a[k], a[pivot]] = [a[pivot], a[k]];
    [scales[k], scales[pivot]] = [scales[pivot], scales[k]];
    const d = a[k][k];
    for (let j = k; j <= n; j++) a[k][j] = div(a[k][j], d);
    for (let i = k + 1; i < n; i++) {
      const f = a[i][k];
      for (let j = k; j <= n; j++) a[i][j] = sub(a[i][j], mul(f, a[k][j]));
    }
  }
  const x: C[] = Array.from({ length: n }, () => [0, 0]);
  for (let i = n - 1; i >= 0; i--) {
    let v = a[i][n];
    for (let j = i + 1; j < n; j++) v = sub(v, mul(a[i][j], x[j]));
    x[i] = v;
  }
  return x;
}
export const complexMatrix = (n: number): C[][] =>
  Array.from({ length: n }, () => Array.from({ length: n }, (): C => [0, 0]));
export const complexVector = (n: number): C[] =>
  Array.from({ length: n }, (): C => [0, 0]);
export function stampAdmittance(
  a: C[][],
  positive: number,
  negative: number,
  y: C,
) {
  if (positive >= 0) a[positive][positive] = add(a[positive][positive], y);
  if (negative >= 0) a[negative][negative] = add(a[negative][negative], y);
  if (positive >= 0 && negative >= 0) {
    a[positive][negative] = sub(a[positive][negative], y);
    a[negative][positive] = sub(a[negative][positive], y);
  }
}
