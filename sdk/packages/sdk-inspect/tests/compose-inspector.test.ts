import test from "node:test";
import assert from "node:assert/strict";
import { inspectComposeYaml } from "../src/compose-inspector.js";

function inspect(rawYaml: string) {
  return inspectComposeYaml({
    rawYaml,
    selectedComposePath: "docker-compose.yml",
    composeCandidates: ["docker-compose.yml"],
    yamlFiles: ["docker-compose.yml"],
    recommendedComposePath: "docker-compose.yml",
    source: {
      kind: "github",
      path: "docker-compose.yml",
      repositoryUrl: "https://github.com/example/repo.git",
      branch: "main",
      blobUrl: "https://api.github.com/repos/example/repo/git/blobs/example"
    }
  });
}

test("detects service and expose port from nested compose yaml", () => {
  const inspection = inspect(`
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
      target: prod
    restart: unless-stopped
    environment:
      PORT: "\${PORT:-8080}"
    expose:
      - "\${PORT:-8080}"
`);

  const web = inspection.services.find((service) => service.name === "web");
  assert.ok(web);
  assert.equal(inspection.parseError, null);
  assert.equal(web.detectedPublicPort, 8080);
});

test("collects required environment variables", () => {
  const inspection = inspect(`
services:
  api:
    environment:
      ADMIN_FIXED_PASSWORD: "\${ADMIN_FIXED_PASSWORD}"
      OPTIONAL_TOKEN:
`);

  assert.deepEqual(inspection.environmentRequirements, [
    {
      name: "ADMIN_FIXED_PASSWORD",
      required: true,
      defaultValue: null,
      services: ["api"]
    },
    {
      name: "OPTIONAL_TOKEN",
      required: true,
      defaultValue: null,
      services: ["api"]
    }
  ]);
});
