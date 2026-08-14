import fs from "node:fs";
import path from "node:path";

export const productVersion = fs.readFileSync(path.join(process.cwd(), "VERSION"), "utf8").trim();
export const releaseTag = `v${productVersion}`;
