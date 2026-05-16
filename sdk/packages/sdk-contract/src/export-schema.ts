import { z } from "zod";
import { deploymentModeSchema } from "./manifest-schema.js";

export const exportPayloadSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500),
  repositoryUrl: z.string().url(),
  defaultBranch: z.string().min(1).max(120),
  composePath: z.string().min(1),
  publicServiceName: z.string().min(1),
  publicPort: z.number().int().min(1).max(65535),
  hostname: z
    .string()
    .min(3)
    .max(255)
    .regex(/^[a-z0-9.-]+$/),
  mode: deploymentModeSchema,
  keepVolumesOnRebuild: z.boolean(),
  deviceRequirements: z.array(z.string().min(1)),
  envOverrides: z.record(z.string().min(1), z.string())
});

export type ExportPayload = z.infer<typeof exportPayloadSchema>;
