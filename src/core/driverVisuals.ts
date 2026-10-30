/** Stable source colours shared by the 3D models, slice markers and readouts. */
export const driverColours = [
  "#8cbccb", "#bec5c9", "#7795ac", "#92a99d", "#a8a193", "#e7e9e8", "#648694", "#a7b0b7",
];
export const driverColour = (index: number) =>
  driverColours[index % driverColours.length];
