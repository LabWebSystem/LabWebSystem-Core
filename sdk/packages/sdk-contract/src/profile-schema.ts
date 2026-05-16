import { z } from "zod";

export const profileSchema = z.object({
  profile: z.string().min(1),
  overrides: z.object({
    env: z.record(z.string().min(1), z.string()).default({}),
    composeFiles: z.array(z.string().min(1)).default([]),
    deviceRequirements: z.array(z.string().min(1)).default([]),
    guard: z.object({
      allowMock: z.boolean().default(false),
      requireDevicePaths: z.array(z.string().min(1)).default([])
    }).default({ allowMock: false, requireDevicePaths: [] })
  }).default({ env: {}, composeFiles: [], deviceRequirements: [], guard: { allowMock: false, requireDevicePaths: [] } })
});

export type ProfileConfig = z.infer<typeof profileSchema>;
