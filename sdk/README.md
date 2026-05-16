# LabCore-SDK v0.0.1

Lab-Core compatible application SDK implementation.

## Packages
- `@lab-core/sdk` (programmatic API)
- `@lab-core/sdk-cli` (CLI)
- `@lab-core/sdk-contract`
- `@lab-core/sdk-inspect`
- `@lab-core/sdk-profile`
- `@lab-core/sdk-seed`
- `@lab-core/sdk-ci`

## Node.js library usage via GitHub

Yarn の Git workspace 依存を使うと、GitHub リポジトリ経由で SDK を直接ライブラリ導入できます。

```bash
yarn add @lab-core/sdk@git@github.com:<ORG>/<REPO>.git#workspace=@lab-core/sdk&head=<BRANCH>
```

例 (`main` ブランチ):

```bash
yarn add @lab-core/sdk@git@github.com:<ORG>/<REPO>.git#workspace=@lab-core/sdk&head=main
```

### ライブラリ呼び出し例

```ts
import { lintSdk, inspectSdk, exportSdkPayload, guardProdSdk } from "@lab-core/sdk";

const lint = lintSdk({ cwd: process.cwd(), profile: "dev-sim" });
if (!lint.ok) {
  console.error(lint.errors);
  process.exit(1);
}

const inspection = inspectSdk({ profile: "dev-sim" });
console.log(inspection.services);

const payload = exportSdkPayload({ profile: "prod" });
console.log(payload);

const guard = guardProdSdk({ profile: "prod" });
if (!guard.ok) {
  console.error(guard.violations);
  process.exit(1);
}
```

## CLI usage
- `yarn sdk:labcore init --template standard`
- `yarn sdk:labcore inspect --profile dev-sim`
- `yarn sdk:labcore lint --profile dev-sim`
- `yarn sdk:labcore preflight --profile dev-sim`
- `yarn sdk:labcore export --profile prod --out build/labcore-payload.json`
- `yarn sdk:labcore guard prod`

## Build/Test
- `yarn sdk:build`
- `yarn sdk:test`
