import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";

function findProjectRoot(startDir: string): string {
  let current = startDir;

  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return startDir;
    }

    current = parent;
  }
}

const projectRoot = findProjectRoot(process.cwd());
const openApiFilePath = path.resolve(projectRoot, "docs/readmes/バックエンドOpenAPI仕様.yaml");

export function getOpenApiYaml(): string {
  return fs.readFileSync(openApiFilePath, "utf8");
}

export function getOpenApiDocument(): unknown {
  return parse(getOpenApiYaml());
}

export function getOpenApiFilePath(): string {
  return openApiFilePath;
}
