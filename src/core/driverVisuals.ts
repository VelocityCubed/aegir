/** Stable source colours shared by the 3D models, slice markers and readouts. */
export const driverColours = [
  "#93d9e9",
  "#f5b67d",
  "#c5a2ec",
  "#a6dc9e",
  "#ef9bb6",
  "#ede18b",
  "#8cb7f0",
  "#a9d8c7",
];
export const driverColour = (index: number) =>
  driverColours[index % driverColours.length];
