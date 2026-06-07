import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";

const deploymentModeSchema = z.enum(["standard", "headless"]);

export const labcoreManifestSchema = z.object({
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

export type LabcoreManifest = z.infer<typeof labcoreManifestSchema>;

export const DEFAULT_LABCORE_MANIFEST_PATH = "labcore.app.yaml";

export function findLabcoreManifestPath(repositoryFiles: string[]): string {
  const manifestCandidates = repositoryFiles
    .filter((filePath) => path.posix.basename(filePath).toLowerCase() === DEFAULT_LABCORE_MANIFEST_PATH)
    .sort((a, b) => {
      const depthDiff = a.split("/").length - b.split("/").length;
      return depthDiff !== 0 ? depthDiff : a.localeCompare(b);
    });

  if (manifestCandidates.length === 0) {
    throw new Error("labcore.app.yaml が見つかりません。SDK 適合アプリのみ登録できます。");
  }

  if (manifestCandidates.length > 1) {
    throw new Error(
      `labcore.app.yaml が複数見つかりました。1つに絞ってください。(${manifestCandidates.join(", ")})`
    );
  }

  return manifestCandidates[0];
}

export function parseLabcoreManifest(rawYaml: string, manifestPath: string): LabcoreManifest {
  let parsedYaml: unknown;
  try {
    parsedYaml = parse(rawYaml);
  } catch (error) {
    const message = error instanceof Error ? error.message : "YAML の解析に失敗しました。";
    throw new Error(`labcore.app.yaml の YAML 解析に失敗しました (${manifestPath}): ${message}`);
  }

  const parsedManifest = labcoreManifestSchema.safeParse(parsedYaml);
  if (!parsedManifest.success) {
    const details = parsedManifest.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new Error(`labcore.app.yaml の schema 検証に失敗しました (${manifestPath}): ${details}`);
  }

  return parsedManifest.data;
}
