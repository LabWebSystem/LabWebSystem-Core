#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const applicationIdPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/;
const currentFilePath = fileURLToPath(import.meta.url);
const backendRoot = path.resolve(path.dirname(currentFilePath), "..");
const projectRoot = path.resolve(backendRoot, "..", "..");
const appsRoot = path.resolve(projectRoot, "runtime", "apps");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isPathWithin(candidate, container) {
  const relative = path.relative(container, candidate);
  return relative.length === 0 || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function readMountTargets() {
  try {
    const content = fs.readFileSync("/proc/self/mountinfo", "utf8");
    return new Set(
      content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          const segments = line.split(" ");
          return segments[4] ?? "";
        })
        .filter((mountPoint) => mountPoint.length > 0)
    );
  } catch {
    return new Set();
  }
}

const appId = process.argv[2] ?? "";

if (!applicationIdPattern.test(appId)) {
  fail(`安全でない app-id です: ${appId}`);
}

if (!fs.existsSync(appsRoot)) {
  process.exit(0);
}

const appsRootReal = fs.realpathSync.native(appsRoot);
const targetPath = path.join(appsRootReal, appId);

if (!fs.existsSync(targetPath)) {
  process.exit(0);
}

const stat = fs.lstatSync(targetPath);
if (stat.isSymbolicLink()) {
  fail(`削除対象 root が symlink です: ${targetPath}`);
}
if (!stat.isDirectory()) {
  fail(`削除対象 root が directory ではありません: ${targetPath}`);
}

const targetReal = fs.realpathSync.native(targetPath);
if (targetReal === appsRootReal) {
  fail("runtime/apps 自体は削除できません。");
}
if (!isPathWithin(targetReal, appsRootReal)) {
  fail(`削除対象が runtime/apps 配下ではありません: ${targetReal}`);
}

const mountTargets = readMountTargets();
if (mountTargets.has(targetReal)) {
  fail(`mount point 化された app root は削除できません: ${targetReal}`);
}

fs.rmSync(targetReal, { recursive: true, force: true });
console.log(`removed ${targetReal}`);
