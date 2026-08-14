import { z } from "zod";

/** 外部CTLとLabWebSystemが共有するDocker label namespace。 */
export const labWebSystemLabels = {
  managed: "com.labwebsystem.managed",
  installationId: "com.labwebsystem.installation-id",
  role: "com.labwebsystem.role",
  applicationId: "com.labwebsystem.application-id",
  version: "com.labwebsystem.version"
} as const;

export const releaseManifestSchema = z.object({
  manifestVersion: z.literal(1),
  version: z.string().min(1),
  minimumLwsctlVersion: z.string().min(1),
  artifacts: z.object({
    compose: z.object({
      name: z.literal("compose.yaml"),
      sha256: z.string().regex(/^[a-f0-9]{64}$/)
    })
  }),
});

export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;

export const recoveryDescriptorSchema = z.object({
  descriptorSchemaVersion: z.number().int().positive(),
  applicationId: z.string().min(1),
  repositoryPath: z.string().min(1),
  imageIdentifier: z.string().min(1).nullable(),
  build: z.object({
    composePath: z.string().min(1),
    composeProjectName: z.string().min(1),
    serviceName: z.string().min(1)
  }),
  runtime: z.object({
    normalizedComposePath: z.string().min(1),
    composeEnvPath: z.string().min(1).nullable(),
    publicServiceName: z.string().min(1),
    publicPort: z.number().int().positive().max(65535),
    hostname: z.string().min(1)
  }),
  appdataPath: z.string().min(1),
  docker: z.object({
    labels: z.record(z.string(), z.string()),
    resources: z.object({
      containers: z.array(z.string()),
      networks: z.array(z.string()),
      volumes: z.array(z.string())
    })
  }),
  updatedAt: z.string().datetime()
});

export type RecoveryDescriptor = z.infer<typeof recoveryDescriptorSchema>;
