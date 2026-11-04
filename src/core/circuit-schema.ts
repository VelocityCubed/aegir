import { z } from "zod";
const id = z.string().regex(/^[-a-zA-Z0-9_]{1,64}$/);
const terminal = z.object({ part: id, pin: z.enum(["a", "b"]) }).strict();
export const circuitSchema = z
  .object({
    version: z.literal(1),
    parts: z
      .array(
        z
          .object({
            id,
            kind: z.enum([
              "R",
              "L",
              "C",
              "input",
              "driver",
              "ground",
              "junction",
            ]),
            label: z.string().max(80),
            at: z.tuple([
              z.number().finite().min(-10000).max(10000),
              z.number().finite().min(-10000).max(10000),
            ]),
            rotation: z.union([
              z.literal(0),
              z.literal(90),
              z.literal(180),
              z.literal(270),
            ]),
            value: z.number().finite().min(1e-12).max(1e6).optional(),
            resistance: z.number().finite().min(0).max(1000).optional(),
            mountId: id.optional(),
            gain: z.number().finite().min(0).max(8).optional(),
            phase: z.number().finite().min(-360).max(360).optional(),
            active: z
              .array(
                z
                  .object({
                    kind: z.enum(["lowpass", "highpass"]),
                    frequency: z.number().finite().min(1).max(100000),
                    order: z.union([z.literal(1), z.literal(2)]),
                  })
                  .strict(),
              )
              .max(8)
              .optional(),
          })
          .strict()
          .superRefine((p, c) => {
            if (["R", "L", "C"].includes(p.kind) && p.value === undefined)
              c.addIssue({
                code: "custom",
                message: "A component value is required.",
              });
            if (p.kind === "driver" && !p.mountId)
              c.addIssue({
                code: "custom",
                message: "Choose a cabinet driver for this terminal.",
              });
          }),
      )
      .min(1)
      .max(96),
    wires: z
      .array(
        z
          .object({
            id,
            from: terminal,
            to: terminal,
            route: z.enum(["horizontal", "vertical"]).optional(),
            bend: z.number().finite().min(-10000).max(10000).optional(),
          })
          .strict(),
      )
      .max(256),
  })
  .strict().superRefine((c,ctx)=>{
    const parts=new Map<string,typeof c.parts[number]>();
    for(const p of c.parts){if(parts.has(p.id))ctx.addIssue({code:'custom',message:'Duplicate part identifier: '+p.id});parts.set(p.id,p);}
    const wireIds=new Set<string>();
    for(const w of c.wires){if(wireIds.has(w.id))ctx.addIssue({code:'custom',message:'Duplicate wire identifier: '+w.id});wireIds.add(w.id);for(const t of [w.from,w.to]){const p=parts.get(t.part);if(!p||(t.pin==='b'&&(p.kind==='ground'||p.kind==='junction')))ctx.addIssue({code:'custom',message:'Wire refers to a missing terminal.'});}}
  });
export type Circuit = z.infer<typeof circuitSchema>;
export type CircuitPart = Circuit["parts"][number];
export type CircuitPin = z.infer<typeof terminal>;
export type CircuitWire = Circuit["wires"][number];
