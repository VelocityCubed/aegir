/** Display mapping only. Pressure samples, sign, range and time are untouched. */
export function pressureAlpha(q: number, opacity = 1, curve: "linear" | "soft" = "soft") {
  const level = Math.max(0, Math.min(1, q));
  return Math.min(1, (.025 + .8 * (curve === "soft" ? Math.sqrt(level) : level)) * opacity);
}
export const negativePressure = [140, 188, 203] as const;
export const positivePressure = [190, 197, 201] as const;
