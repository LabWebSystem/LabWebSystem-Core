import { z } from "zod";

export const deploymentModeSchema = z.enum(["standard", "headless"]);

export const manifestSchema = z.object({
  schemaVersion: z.number().int().min(1).default(1),
  app: z.object({
    name: z.string().min(2).max(80),
    description: z.string().max(500).default("")
  }),
  repository: z.object({
    url: z.string().url(),
    defaultBranch: z.string().min(1).max(120).default("main")
  }),
  deployment: z.object({
    composePath: z.string().min(1).default("docker-compose.yml"),
    mode: deploymentModeSchema.default("standard"),
    keepVolumesOnRebuild: z.boolean().default(true)
  }),
  exposure: z.object({
    service: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    hostname: z
      .string()
      .min(3)
      .max(255)
      .regex(/^[a-z0-9.-]+$/)
  }),
  devices: z.object({
    required: z.array(z.string().min(1)).default([])
  }).default({ required: [] }),
  env: z.object({
    required: z.array(z.string().min(1)).default([]),
    defaults: z.record(z.string().min(1), z.string()).default({})
  }).default({ required: [], defaults: {} }),
  profiles: z.object({
    default: z.string().min(1).default("dev-sim")
  }).default({ default: "dev-sim" })
});

export type Manifest = z.infer<typeof manifestSchema>;
