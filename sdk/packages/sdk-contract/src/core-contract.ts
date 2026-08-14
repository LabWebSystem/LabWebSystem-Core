import { z } from "zod";

/** 外部CTLとLabWebSystemが共有するDocker label namespace。 */
export const labWebSystemLabels = {
  managed: "com.labwebsystem.managed",
  installationId: "com.labwebsystem.installation-id",
  role: "com.labwebsystem.role",
  applicationId: "com.labwebsystem.application-id",
  version: "com.labwebsystem.version"
} as const;

export const coreConfigSchema = z.object({
  configSchemaVersion: z.number().int().positive(),
  installationId: z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
  primaryDomain: z.string().min(1).max(253).regex(/^[a-z0-9.-]+$/),
  dataDirectory: z.string().min(1).refine((value) => value.startsWith("/"), {
    message: "dataDirectory must be an absolute path"
  })
});

export type CoreConfig = z.infer<typeof coreConfigSchema>;

const imageReferenceSchema = z.object({
  reference: z.string().min(1),
  digest: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional()
});

export const releaseManifestSchema = z.object({
  manifestSchemaVersion: z.number().int().positive(),
  labWebSystemVersion: z.string().min(1),
  configSchemaVersion: z.number().int().positive(),
  databaseSchemaVersion: z.number().int().positive(),
  recoveryDescriptorSchemaVersion: z.number().int().positive(),
  minimumLwsctlVersion: z.string().min(1),
  platforms: z.array(z.string().min(1)).min(1),
  images: z.object({
    backend: imageReferenceSchema,
    dashboard: imageReferenceSchema
  }),
  compose: z.object({
    artifact: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/)
  }),
  migration: z.object({
    required: z.boolean(),
    fromDatabaseSchemaVersion: z.number().int().positive().optional(),
    toDatabaseSchemaVersion: z.number().int().positive(),
    artifact: z.string().min(1).optional(),
    backupRequired: z.boolean(),
    rollbackSupported: z.boolean()
  })
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
