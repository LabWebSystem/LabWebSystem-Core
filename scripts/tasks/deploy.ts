import { execFileSync } from "node:child_process";
import { productVersion, releaseTag } from "./version.js";

if (productVersion !== "0.1.0") throw new Error(`unsupported release version: ${productVersion}`);

function capture(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function captureOrEmpty(args: string[]): string {
  try {
    return capture(args);
  } catch {
    return "";
  }
}

function runGit(args: string[]): void {
  execFileSync("git", args, { stdio: "inherit", env: process.env });
}

const dirtyFiles = capture(["status", "--porcelain"]);
if (dirtyFiles.length > 0) {
  throw new Error("deploy requires a clean working tree; commit or stash changes before deploying");
}

const head = capture(["rev-parse", "HEAD"]);
const localTagCommit = captureOrEmpty(["rev-parse", `${releaseTag}^{commit}`]);
if (localTagCommit && localTagCommit !== head) {
  throw new Error(`${releaseTag} already points to ${localTagCommit}, not HEAD ${head}`);
}

if (!localTagCommit) {
  runGit(["tag", "-a", releaseTag, "-m", `LabWebSystem Core ${releaseTag}`]);
}

const remoteTagOutput = captureOrEmpty([
  "ls-remote",
  "--tags",
  "origin",
  `refs/tags/${releaseTag}`,
  `refs/tags/${releaseTag}^{}`
]);
const remoteTagEntries = remoteTagOutput
  .split(/\r?\n/)
  .map((line) => line.split(/\s+/))
  .filter((entry) => entry.length >= 2);
const remoteTagCommit = (
  remoteTagEntries.find((entry) => entry[1] === `refs/tags/${releaseTag}^{}`) ?? remoteTagEntries[0]
)?.[0] ?? "";
if (remoteTagCommit.length > 0 && remoteTagCommit !== head) {
  throw new Error(`${releaseTag} already exists on origin at ${remoteTagCommit}; refusing to deploy a different revision`);
}

if (remoteTagCommit.length === 0) {
  runGit(["push", "origin", `refs/tags/${releaseTag}`]);
  console.log(`release workflow started by pushing ${releaseTag}`);
} else {
  execFileSync("gh", ["workflow", "run", "core-release.yml", "--ref", releaseTag], {
    stdio: "inherit",
    env: process.env
  });
  console.log(`release workflow re-run for ${releaseTag}`);
}
