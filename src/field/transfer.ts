/** Display mapping only. Pressure samples, sign, range and time are untouched. */
export function pressureAlpha(
  q: number,
  opacity = 1,
  curve: "linear" | "soft" = "soft",
) {
  const level = Math.max(0, Math.min(1, q));
  return Math.min(
    1,
    (0.025 + 0.8 * (curve === "soft" ? Math.sqrt(level) : level)) * opacity,
  );
}
export const negativePressure = [47, 135, 255] as const;
export const positivePressure = [255, 91, 49] as const;
/** Diverging, signed pressure palette. Display contrast never changes the value. */
export function pressureColour(
  value: number,
  range: number,
  curve: "linear" | "soft" = "soft",
): [number, number, number] {
  const q = Math.min(1, Math.abs(value) / Math.max(range, 1e-12)),
    t = curve === "soft" ? Math.sqrt(q) : q;
  const mid = [16, 25, 40],
    colour = value < 0 ? negativePressure : positivePressure,
    highlight = value < 0 ? [180, 235, 255] : [255, 233, 173];
  return (
    t < 0.65
      ? mid.map((v, i) => v + ((colour[i] - v) * t) / 0.65)
      : colour.map((v, i) => v + ((highlight[i] - v) * (t - 0.65)) / 0.35)
  ).map(Math.round) as [number, number, number];
}
export function pressureGradientCss(curve: "linear" | "soft" = "soft") {
  return `linear-gradient(to right, ${Array.from({ length: 17 }, (_, i) => `rgb(${pressureColour(i / 8 - 1, 1, curve).join(",")}) ${(i / 16) * 100}%`).join(",")})`;
}
