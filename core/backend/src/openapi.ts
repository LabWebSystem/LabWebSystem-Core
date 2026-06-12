import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const currentModuleDir = path.dirname(fileURLToPath(import.meta.url));

function resolveOpenApiFilePath(): string {
  const envPath = process.env.LAB_CORE_OPENAPI_PATH;
  const candidates = [
    envPath,
    path.resolve(currentModuleDir, "../openapi/openapi.yaml"),
    path.resolve(currentModuleDir, "../../openapi/openapi.yaml"),
    path.resolve(process.cwd(), "core/backend/openapi/openapi.yaml"),
    path.resolve(process.cwd(), "openapi/openapi.yaml")
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`OpenAPI 仕様ファイルが見つかりません: ${candidates.join(", ")}`);
}

const openApiFilePath = resolveOpenApiFilePath();

export function getOpenApiYaml(): string {
  return fs.readFileSync(openApiFilePath, "utf8");
}

export function getOpenApiDocument(): unknown {
  return parse(getOpenApiYaml());
}

export function getOpenApiFilePath(): string {
  return openApiFilePath;
}
