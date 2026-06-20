import { z } from "zod";

export const createApplicationSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional().default(""),
  repositoryUrl: z.string().url(),
  defaultBranch: z.string().min(1).max(120).optional().default("main"),
  composePath: z.string().min(1).max(400).optional().default("docker-compose.yml"),
  publicServiceName: z.string().min(1).max(120),
  publicPort: z.number().int().min(1).max(65535),
  hostname: z
    .string()
    .min(3)
    .max(255)
    .regex(/^[a-z0-9.-]+$/),
  mode: z.enum(["standard", "headless"]).optional().default("standard"),
  keepVolumesOnRebuild: z.boolean().optional().default(true),
  deviceRequirements: z.array(z.string().min(1)).optional().default([]),
  envOverrides: z.record(z.string().min(1), z.string()).optional().default({})
}).strict();

export const updateApplicationSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).optional(),
  repositoryUrl: z.string().url().optional(),
  defaultBranch: z.string().min(1).max(120).optional()
}).strict();

export const updateDeploymentSchema = z.object({
  composePath: z.string().min(1).max(400),
  publicServiceName: z.string().min(1).max(120),
  publicPort: z.number().int().min(1).max(65535),
  hostname: z
    .string()
    .min(3)
    .max(255)
    .regex(/^[a-z0-9.-]+$/),
  keepVolumesOnRebuild: z.boolean().optional(),
  envOverrides: z.record(z.string().min(1), z.string()).optional().default({})
}).strict();
