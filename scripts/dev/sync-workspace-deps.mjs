#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const stateDir = path.join(projectRoot, "node_modules", ".lab-core");
const stateFile = path.join(stateDir, "dependency-manifest.sha256");
const yarnNodeModulesState = path.join(projectRoot, "node_modules", ".yarn-state.yml");

function walkPackageJsonFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkPackageJsonFiles(absolute));
      continue;
    }

    if (entry.isFile() && entry.name === "package.json") {
      files.push(absolute);
    }
  }

  return files;
}

function dependencyManifestFiles() {
  const fixedFiles = [
    path.join(projectRoot, "package.json"),
    path.join(projectRoot, "yarn.lock"),
    path.join(projectRoot, ".yarnrc.yml"),
    path.join(projectRoot, "core", "backend", "package.json"),
    path.join(projectRoot, "core", "dashboard", "package.json"),
    path.join(projectRoot, "sdk", "package.json")
  ];

  const sdkPackageFiles = walkPackageJsonFiles(path.join(projectRoot, "sdk", "packages"));

  return [...fixedFiles, ...sdkPackageFiles]
    .filter((filePath, index, list) => list.indexOf(filePath) === index)
    .filter((filePath) => fs.existsSync(filePath))
    .sort((left, right) => left.localeCompare(right));
}

function currentManifestHash() {
  const hash = createHash("sha256");
  for (const filePath of dependencyManifestFiles()) {
    const relativePath = path.relative(projectRoot, filePath);
    hash.update(relativePath);
    hash.update("\n");
    hash.update(fs.readFileSync(filePath));
    hash.update("\n");
  }
  return hash.digest("hex");
}

function storedManifestHash() {
  if (!fs.existsSync(stateFile)) {
    return null;
  }

  return fs.readFileSync(stateFile, "utf8").trim() || null;
}

function runYarnInstall() {
  const result = spawnSync("corepack", ["yarn", "install", "--immutable"], {
    cwd: projectRoot,
    stdio: "inherit"
  });

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    throw result.error;
  }
}

const nextHash = currentManifestHash();
const previousHash = storedManifestHash();
const requiresInstall = previousHash !== nextHash || !fs.existsSync(yarnNodeModulesState);

if (!requiresInstall) {
  console.log("[deps] package manifests unchanged; skipping yarn install");
  process.exit(0);
}

console.log("[deps] dependency change detected; running yarn install --immutable");
runYarnInstall();

fs.mkdirSync(stateDir, { recursive: true });
fs.writeFileSync(stateFile, `${nextHash}\n`, "utf8");
console.log("[deps] dependency state updated");
