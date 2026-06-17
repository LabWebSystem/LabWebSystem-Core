#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(thisFile), "..", "..");
const uid = typeof process.getuid === "function" ? process.getuid() : 1000;
const gid = typeof process.getgid === "function" ? process.getgid() : 1000;

const managedPaths = [
  path.join(projectRoot, "core", "backend", "data"),
  path.join(projectRoot, "core", "backend", "data", "database.sqlite"),
  path.join(projectRoot, "core", "backend", "data", "database.sqlite-wal"),
  path.join(projectRoot, "core", "backend", "data", "database.sqlite-shm"),
  path.join(projectRoot, "core", "backend", "data", "generated"),
  path.join(projectRoot, "core", "backend", "data", "generated", "Caddyfile.dev"),
  path.join(projectRoot, "core", "backend", "data", "generated", "fukaya-sus.hosts"),
  path.join(projectRoot, "runtime"),
  path.join(projectRoot, "runtime", "apps"),
  path.join(projectRoot, "runtime", "appdata")
];

function nearestExistingPath(targetPath: string): string | null {
  let current = targetPath;

  while (true) {
    if (fs.existsSync(current)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

function isWritable(targetPath: string): boolean {
  const existingPath = nearestExistingPath(targetPath);
  if (!existingPath) {
    return false;
  }

  try {
    fs.accessSync(existingPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function needsRepair(): boolean {
  return managedPaths.some((targetPath) => !isWritable(targetPath));
}

function repairManagedPermissions(): void {
  execFileSync(
    "docker",
    [
      "run",
      "--rm",
      "-v",
      `${projectRoot}:/workspace`,
      "alpine:3.20",
      "sh",
      "-lc",
      [
        "mkdir -p /workspace/core/backend/data/generated",
        "mkdir -p /workspace/runtime/apps",
        "mkdir -p /workspace/runtime/appdata",
        `chown -R ${uid}:${gid} /workspace/core/backend/data /workspace/runtime`
      ].join(" && ")
    ],
    {
      stdio: "inherit"
    }
  );
}

if (!needsRepair()) {
  console.log("managed runtime files are writable");
  process.exit(0);
}

console.warn("managed runtime files are not writable; repairing ownership via Docker");
repairManagedPermissions();
console.log("managed runtime file ownership repaired");
