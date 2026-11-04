import { z } from "zod";
const finite = (min: number, max: number) =>
  z.number().finite().min(min).max(max);
const source = z.string().min(1).max(4000);
export const frequencyTraceSchema = z
  .object({
    source,
    samples: z
      .array(
        z.tuple([
          finite(1, 100000),
          finite(-300, 1e6),
          finite(-1e6, 1e6).nullable(),
        ]),
      )
      .min(2)
      .max(5000)
      .refine(
        (s) => s.slice(1).every((v, i) => v[0] > s[i][0]),
        "Measurement frequencies must strictly increase.",
      ),
  })
  .strict();
export const measurementSchema = z
  .object({
    impedance: frequencyTraceSchema
      .refine(
        (t) => t.samples.every((s) => s[1] > 0),
        "Impedance magnitude must be positive.",
      )
      .optional(),
    response: z
      .object({
        trace: frequencyTraceSchema.refine(
          (t) => t.samples.every((v) => v[1] >= -300 && v[1] <= 300),
          "Acoustic trace must be dB SPL, not linear pressure.",
        ),
        voltage: finite(0.001, 100).nullable(),
        distanceM: finite(0.001, 100).nullable(),
        timing: z.enum(["common", "unknown"]),
        includesBaffle: z.boolean(),
        includesTerminus: z.boolean(),
        microphoneMm: z
          .tuple([
            finite(-100000, 100000),
            finite(-100000, 100000),
            finite(-100000, 100000),
          ])
          .nullable(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const crossoverSchema = z
  .object({
    passive: z
      .array(
        z
          .object({
            connection: z.enum(["series", "shunt"]),
            kind: z.enum(["R", "L", "C"]),
            value: finite(1e-12, 1e6),
            resistance: finite(0, 1000).optional(),
          })
          .strict(),
      )
      .max(32)
      .optional(),
    active: z
      .array(
        z
          .object({
            kind: z.enum(["lowpass", "highpass"]),
            frequency: finite(1, 100000),
            order: z.union([z.literal(1), z.literal(2)]),
          })
          .strict(),
      )
      .max(8)
      .optional(),
  })
  .strict()
  .refine(
    (v) => !v.passive?.length || !v.active?.length,
    "Choose passive or active filtering per branch.",
  );
const section = z
  .object({
    distance: finite(0, 24),
    area: finite(1, 16e6),
    width: finite(1, 4000),
    damping: finite(0, 5),
  })
  .strict();
const sections = z
  .array(section)
  .min(2)
  .max(512)
  .refine(
    (s) =>
      s[0].distance === 0 &&
      s.slice(1).every((v, i) => v.distance > s[i].distance),
    "Profile must start at 0 m and strictly increase.",
  );
export const referenceSchema = z
  .object({
    id: z.string().regex(/^[-a-zA-Z0-9_]{1,64}$/),
    title: z.string().min(1).max(300),
    source,
    evidence: z.enum(["published-simulation", "published-measurement"]),
    trace: z
      .enum(["calculated-solid", "measured-dashed", "unspecified"])
      .optional(),
    frequencyUncertaintyPercent: finite(0, 20).optional(),
    metric: z.enum(["spl", "coneSpl", "terminusSpl", "impedance"]),
    conditions: z
      .object({
        voltage: finite(0.001, 100).nullable(),
        distanceM: finite(0.001, 100).nullable(),
        radiation: z.enum(["half-space", "anechoic", "near-field", "in-room"]),
        stuffing: z.enum(["empty", "stuffed"]),
        crossover: z.enum(["bypass", "passive", "active"]),
        notes: z.string().max(4000).optional(),
        microphoneMm: z
          .tuple([
            finite(-100000, 100000),
            finite(-100000, 100000),
            finite(-100000, 100000),
          ])
          .optional(),
      })
      .strict(),
    tolerance: finite(0, 1000),
    uncertainty: finite(0, 1000),
    samples: z
      .array(z.tuple([finite(1, 100000), finite(-300, 1e6)]))
      .min(2)
      .max(5000)
      .refine(
        (s) => s.slice(1).every((v, i) => v[0] > s[i][0]),
        "Reference frequencies must strictly increase.",
      ),
  })
  .strict();
export const systemSchema = z
  .object({
    air: z.object({densityKgM3:finite(0.1,3),soundSpeedMs:finite(250,450),source}).strict().optional(),
    numerics: z.object({lineStepMm:finite(1,1000)}).strict().optional(),
    physics: z
      .object({
        ductLoss: z.enum(["none", "thermoviscous", "mjk-2003"]),
        radiation: z.enum(["low-ka", "piston"]),
        stuffing: z
          .array(
            z
              .object({
                start: finite(0, 1),
                end: finite(0, 1),
                source,
                calibration: z.enum(["assumed", "measured", "reference-fit"]),
                placement: z.object({kind:z.literal("lining"),thicknessMm:finite(0.1,1000)}).strict().optional(),
                presetId: z.string().min(1).max(120).optional(),
                frequencyRangeHz: z.tuple([finite(0.01,1e6),finite(0.01,1e6)]).refine(([a,b])=>b>a,"Material evidence band must increase.").optional(),
                material: z.discriminatedUnion("model", [
                  z
                    .object({
                      model: z.literal("mjk-2003"),
                      densityKgM3: finite(0, 0.573 * 16.0184634),
                    })
                    .strict(),
                  z.object({model:z.literal("miki"),flowResistivity:finite(0.01,1e7)}).strict(),
                  z.object({model:z.literal("empirical-power-law"),flowResistivity:finite(0.01,1e7),coefficients:z.tuple([finite(0,100),finite(-5,0),finite(0,100),finite(-5,0),finite(0,100),finite(-5,0),finite(0,100),finite(-5,0)])}).strict(),
                  z.object({model:z.literal("jca"),flowResistivity:finite(0.01,1e7),porosity:finite(0.01,1),tortuosity:finite(1,100),viscousLengthUm:finite(0.1,100000),thermalLengthUm:finite(0.1,100000)}).strict(),
                  z
                    .object({
                      model: z.literal("jcal"),
                      flowResistivity: finite(0.01, 1e7),
                      porosity: finite(0.01, 1),
                      tortuosity: finite(1, 100),
                      viscousLengthUm: finite(0.1, 100000),
                      thermalLengthUm: finite(0.1, 100000),
                      thermalPermeability: finite(1e-14, 1e-3),
                    })
                    .strict(),
                ]),
              })
              .strict()
              .refine(
                (r) => r.end > r.start,
                "Stuffing end must exceed start.",
              ),
          )
          .max(32)
          .refine(
            (regions) =>
              regions.every((r, i) =>
                regions.every(
                  (s, j) => i === j || r.end <= s.start || s.end <= r.start,
                ),
              ),
            "Stuffing regions cannot overlap.",
          )
          .optional(),
      })
      .strict()
      .optional(),
    observation: z
      .object({
        positionMm: z.tuple([
          finite(-100000, 100000),
          finite(-100000, 100000),
          finite(-100000, 100000),
        ]),
        space: z.enum(["half-space", "free-field"]),
        baffle: z.enum(["infinite", "sphere-transition"]),
        baffleRadiusMm: finite(1, 5000).optional(),
        operator: z.enum(["far-field", "rayleigh"]).optional(),
      })
      .strict()
      .refine(
        (o) =>
          o.baffle !== "sphere-transition" || o.baffleRadiusMm !== undefined,
        "Sphere transition requires an explicit equivalent baffle radius.",
      )
      .refine(
        (o) =>
          o.operator !== "rayleigh" ||
          (o.space === "half-space" && o.baffle === "infinite"),
        "Rayleigh evaluation requires an infinite half-space baffle.",
      )
      .optional(),
    profile: z
      .object({
        source,
        evidence: z.enum(["derived", "digitized"]),
        sections,
        mouthArea: finite(1, 16e6),
      })
      .strict()
      .optional(),
    sweep: z
      .tuple([finite(1, 20000), finite(1, 20000)])
      .refine(([a, b]) => b > a, "Sweep end must exceed start."),
    distanceM: finite(0.1, 100),
    references: z
      .array(referenceSchema)
      .max(32)
      .refine(
        (r) => new Set(r.map((x) => x.id)).size === r.length,
        "Reference IDs must be unique.",
      )
      .refine(
        (r) => r.reduce((n, x) => n + x.samples.length, 0) <= 5000,
        "At most 5000 total reference samples.",
      )
      .optional(),
    modalReference: z
      .object({
        source,
        frequencies: z
          .array(finite(1, 10000))
          .min(1)
          .max(64)
          .refine(
            (s) => s.slice(1).every((v, i) => v > s[i]),
            "Mode frequencies must increase.",
          ),
        tolerancePercent: finite(0, 100),
      })
      .strict()
      .optional(),
  })
  .strict();
