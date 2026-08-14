import { execFileSync } from "node:child_process";
import { productVersion, releaseTag } from "./version.js";

const ref = process.env.LWS_DEPLOY_REF ?? execFileSync("git", ["describe", "--tags", "--exact-match", "HEAD"], { encoding: "utf8" }).trim();
if (ref !== releaseTag) {
  throw new Error(`deploy requires the verified release tag ${releaseTag} (received: ${ref || "none"})`);
}

if (productVersion !== "0.1.0") throw new Error(`unsupported release version: ${productVersion}`);

execFileSync("gh", ["workflow", "run", "core-release.yml", "--ref", ref], { stdio: "inherit", env: process.env });
