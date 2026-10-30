/** Marching squares on signed pressure; solid-crossing quads are excluded. */
export class PressureContours {
  readonly segments: Float32Array;
  count = 0;
  private values = new Float64Array(4);
  private hits = new Float64Array(8);
  private ids = new Int32Array(4);
  private add(a: number, b: number) {
    const hits = this.hits;
    this.segments[this.count++] = hits[a * 2];
    this.segments[this.count++] = hits[a * 2 + 1];
    this.segments[this.count++] = hits[b * 2];
    this.segments[this.count++] = hits[b * 2 + 1];
  }
  constructor(readonly cells: number) {
    this.segments = new Float32Array(cells * 56);
  }
  update(
    data: Float32Array,
    mask: Uint8Array,
    width: number,
    height: number,
    scale: number,
    rhoC: number,
  ) {
    this.count = 0;
    const values = this.values,
      hits = this.hits;
    for (let y = 0; y < height - 1; y++)
      for (let x = 0; x < width - 1; x++) {
        const ids = this.ids;
        ids[0] = x + y * width;
        ids[1] = ids[0] + 1;
        ids[2] = ids[1] + width;
        ids[3] = ids[0] + width;
        if (!mask[ids[0]] || !mask[ids[1]] || !mask[ids[2]] || !mask[ids[3]])
          continue;
        let active = 0;
        for (let k = 0; k < 4; k++) {
          const at = ids[k] * 4;
          values[k] = data[at];
          active = Math.max(
            active,
            Math.abs(values[k]) +
              rhoC * Math.hypot(data[at + 1], data[at + 2], data[at + 3]),
          );
        }
        if (active < scale * 0.025) continue;
        for (let step = -3; step <= 3; step++) {
          const level = (step * scale) / 4;
          let n = 0;
          for (let edge = 0; edge < 4; edge++) {
            const a = values[edge],
              b = values[(edge + 1) % 4];
            if (a >= level === b >= level) continue;
            const t = (level - a) / (b - a);
            const px = edge === 0 ? t : edge === 1 ? 1 : edge === 2 ? 1 - t : 0,
              py = edge === 0 ? 0 : edge === 1 ? t : edge === 2 ? 1 : 1 - t;
            hits[n * 2] = x + 0.5 + px;
            hits[n * 2 + 1] = y + 0.5 + py;
            n++;
          }
          if (n === 2) this.add(0, 1);
          else if (n === 4) {
            const centre = (values[0] + values[1] + values[2] + values[3]) / 4;
            if (centre >= level === values[0] >= level) {
              this.add(0, 1);
              this.add(2, 3);
            } else {
              this.add(0, 3);
              this.add(1, 2);
            }
          }
        }
      }
    return this;
  }
}
