import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { sandboxComposeForRuntime } from "../services/compose-sandbox.js";

function withRuntimeRoots(run: (paths: {
  root: string;
  appRoot: string;
  sourceRoot: string;
  dataRoot: string;
  labCoreRoot: string;
}) => void): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lab-core-compose-sandbox-"));
  const appRoot = path.join(root, "runtime", "apps", "app-123");
  const sourceRoot = path.join(appRoot, "src");
  const dataRoot = path.join(appRoot, "data");
  const labCoreRoot = path.join(appRoot, ".lab-core");

  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.mkdirSync(dataRoot, { recursive: true });
  fs.mkdirSync(labCoreRoot, { recursive: true });

  try {
    run({ root, appRoot, sourceRoot, dataRoot, labCoreRoot });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("rewrites bind mounts and named volumes into the application sandbox", () => {
  withRuntimeRoots(({ appRoot, sourceRoot, dataRoot, labCoreRoot }) => {
    const result = sandboxComposeForRuntime({
      rawCompose: {
        services: {
          web: {
            image: "nginx:alpine",
            volumes: [
              "/data/postgres:/var/lib/postgresql/data",
              "./config:/app/config:ro",
              "../data/cache:/app/cache",
              "db-data:/srv/db"
            ],
            expose: ["8080"]
          }
        },
        volumes: {
          "db-data": {}
        }
      },
      applicationId: "app-123",
      composePath: "docker-compose.yml",
      sourceRoot,
      appRoot,
      dataRoot,
      labCoreRoot,
      envValues: {}
    });

    const web = (result.normalizedCompose.services as Record<string, { volumes: string[] }>).web;
    assert.deepEqual(web.volumes, [
      path.join(appRoot, "data", "postgres") + ":/var/lib/postgresql/data",
      path.join(sourceRoot, "config") + ":/app/config:ro",
      path.join(appRoot, "data", "cache") + ":/app/cache",
      path.join(dataRoot, "volumes", "db-data") + ":/srv/db"
    ]);
    assert.equal("volumes" in result.normalizedCompose, false);
  });
});

test("rejects ports and direct device declarations", () => {
  withRuntimeRoots(({ appRoot, sourceRoot, dataRoot, labCoreRoot }) => {
    assert.throws(
      () => sandboxComposeForRuntime({
        rawCompose: {
          services: {
            web: {
              image: "nginx:alpine",
              ports: ["8080:80"]
            }
          }
        },
        applicationId: "app-123",
        composePath: "docker-compose.yml",
        sourceRoot,
        appRoot,
        dataRoot,
        labCoreRoot,
        envValues: {}
      }),
      /ports は使用できません/
    );

    assert.throws(
      () => sandboxComposeForRuntime({
        rawCompose: {
          services: {
            web: {
              image: "nginx:alpine",
              devices: ["/dev/ttyUSB0:/dev/ttyUSB0"]
            }
          }
        },
        applicationId: "app-123",
        composePath: "docker-compose.yml",
        sourceRoot,
        appRoot,
        dataRoot,
        labCoreRoot,
        envValues: {}
      }),
      /devices は使用できません/
    );
  });
});

test("rejects .lab-core references and docker socket mounts", () => {
  withRuntimeRoots(({ appRoot, sourceRoot, dataRoot, labCoreRoot }) => {
    assert.throws(
      () => sandboxComposeForRuntime({
        rawCompose: {
          services: {
            web: {
              image: "nginx:alpine",
              volumes: ["./../.lab-core:/leak"]
            }
          }
        },
        applicationId: "app-123",
        composePath: "docker-compose.yml",
        sourceRoot,
        appRoot,
        dataRoot,
        labCoreRoot,
        envValues: {}
      }),
      /\.lab-core/
    );

    assert.throws(
      () => sandboxComposeForRuntime({
        rawCompose: {
          services: {
            web: {
              image: "nginx:alpine",
              volumes: ["/var/run/docker.sock:/var/run/docker.sock"]
            }
          }
        },
        applicationId: "app-123",
        composePath: "docker-compose.yml",
        sourceRoot,
        appRoot,
        dataRoot,
        labCoreRoot,
        envValues: {}
      }),
      /Docker socket/
    );
  });
});
