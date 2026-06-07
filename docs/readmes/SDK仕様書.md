# SDK仕様書

対象読者:
- SDK 利用者
- SDK 保守者

文書ステータス:
- current

最終更新日:
- 2026-06-07

## 1. パッケージ構成
- `@lab-core/sdk`
  - programmatic API
- `@lab-core/sdk-cli`
  - CLI
- `@lab-core/sdk-contract`
  - manifest / profile / export schema
- `@lab-core/sdk-inspect`
  - compose 解析
- `@lab-core/sdk-profile`
  - profile merge / prod guard / export payload
- `@lab-core/sdk-seed`
  - seed 実行
- `@lab-core/sdk-ci`
  - GitHub Actions テンプレート

## 2. `labcore.app.yaml` の要点
```yaml
schemaVersion: 1
app:
  name: my-app
  description: 説明
repository:
  url: https://github.com/example/my-app.git
  defaultBranch: main
deployment:
  composePath: docker-compose.yml
  mode: standard
  keepVolumesOnRebuild: true
exposure:
  service: web
  port: 4173
  hostname: my-app.lab.localhost
devices:
  required: []
env:
  required:
    - ADMIN_FIXED_PASSWORD
  defaults:
    APPDATA_ROOT: ../../appdata/my-app
profiles:
  default: dev-sim
```

重要な考え方:
- `composePath` は配備用 compose を指す
- `hostname` は登録時に使われる値そのもの
- localhost 開発の既定値には `*.lab.localhost` を使う
- 永続データがある場合は `APPDATA_ROOT` を defaults に置く

## 3. profile の推奨構成
### 3.1 `dev-sim`
```yaml
profile: dev-sim
overrides:
  env:
    APPDATA_ROOT: ./.appdata/my-app
    LABCORE_DEVICE_MODE: mock
    LABCORE_ENABLE_MOCK: "true"
  composeFiles:
    - docker-compose.yml
    - docker-compose.dev.yml
  deviceRequirements: []
  guard:
    allowMock: true
    requireDevicePaths: []
```

### 3.2 `dev-real-device`
```yaml
profile: dev-real-device
overrides:
  env:
    APPDATA_ROOT: ./.appdata/my-app
    LABCORE_DEVICE_MODE: real
  composeFiles:
    - docker-compose.yml
    - docker-compose.dev.yml
  deviceRequirements: []
  guard:
    allowMock: false
    requireDevicePaths: []
```

### 3.3 `prod`
```yaml
profile: prod
overrides:
  env:
    LABCORE_DEVICE_MODE: real
  composeFiles:
    - docker-compose.yml
  deviceRequirements: []
  guard:
    allowMock: false
    requireDevicePaths: []
```

## 4. CLI コマンド
導入:

```bash
yarn add -D @lab-core/sdk-cli@https://github.com/LabWebSystem/LabWebSystem-Core.git#workspace=@lab-core/sdk-cli&head=main
```

主要コマンド:
- `init`
  - ひな形生成と repo ローカル scripts 作成
- `inspect`
  - compose の解析結果を表示
- `lint`
  - manifest / profile / compose の整合性と運用警告を表示
- `preflight`
  - compose の起動確認
- `seed <apply|verify|reset>`
  - seed スクリプト実行
- `guard prod`
  - 本番向け安全性チェック
- `export`
  - 登録用 payload 出力
- `doctor`
  - 実行環境と lint をまとめて診断
- `ci-install`
  - GitHub Actions テンプレート導入

## 5. `lint` / `doctor` の運用警告
現在の SDK は、schema 的には通っても本番事故になりやすい構成を警告します。

- 配備用 compose に `ports:` がある
- resolved env や compose に `localhost` が含まれている
- `VITE_API_BASE_URL` が same-origin ではない
- `APPDATA_ROOT` が compose から参照されていない
- `prod` profile に `LABCORE_DEVICE_MODE` がない
- `prod` profile に `docker-compose.dev.yml` が混ざっている
- `hostname` が `*.lab.localhost` のままになっている

## 6. library API
公開 API:
- `loadSdkContext(options)`
- `inspectSdk(options)`
- `lintSdk(options)`
- `guardProdSdk(options)`
- `exportSdkPayload(options)`
- `runSdkSeed(action, options)`

使用例:
```ts
import { lintSdk, exportSdkPayload } from "@lab-core/sdk";

const lint = lintSdk({ cwd: process.cwd(), profile: "dev-sim" });
if (!lint.ok) {
  console.error(lint.errors);
  process.exit(1);
}

for (const warning of lint.warnings) {
  console.warn(warning);
}

const payload = exportSdkPayload({ cwd: process.cwd(), profile: "prod" });
console.log(payload);
```

## 7. GitHub 参照導入の補足
workspace 依存を含むパッケージを git 経由で利用しやすくするため、`sdk-profile` / `sdk` / `sdk-cli` の `prepack` は monorepo 全体 build を実行します。  
これにより、依存 workspace の成果物不足で pack が失敗しにくくなります。

## 8. 関連資料
- `docs/readmes/SDK概要.md`
- `docs/readmes/適合アプリ作成ガイド.md`
- `docs/readmes/LabWebSystem適合アプリ構成図.md`
- `docs/readmes/登録前チェックリスト.md`
