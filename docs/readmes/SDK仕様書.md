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

## 2. `labcore.app.yaml` の仕様
必須の大枠は次のとおりです。

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
  port: 3000
  hostname: my-app.fukaya-sus.lab
devices:
  required: []
env:
  required:
    - ADMIN_FIXED_PASSWORD
  defaults:
    LOG_LEVEL: info
profiles:
  default: dev-sim
```

主な項目:
- `schemaVersion`
  - 現在は `1`
- `app`
  - アプリ名と説明
- `repository`
  - GitHub リポジトリ URL と既定ブランチ
- `deployment`
  - compose の入口と mode
- `exposure`
  - 公開対象サービス・ポート・ホスト名
- `devices`
  - 必須デバイスパス
- `env`
  - 必須環境変数と既定値
- `profiles`
  - 既定 profile 名

## 3. profile の仕様
profile ファイルでは、manifest に対する上書きを定義します。

```yaml
profile: dev-sim
overrides:
  env:
    LABCORE_DEVICE_MODE: mock
  composeFiles:
    - docker-compose.yml
    - docker-compose.dev.yml
  deviceRequirements: []
  guard:
    allowMock: true
    requireDevicePaths: []
```

主な項目:
- `profile`
  - profile 名
- `overrides.env`
  - 環境変数上書き
- `overrides.composeFiles`
  - 利用する compose ファイル一覧
- `overrides.deviceRequirements`
  - profile ごとのデバイス要件
- `overrides.guard`
  - 本番ガード条件

## 4. CLI コマンド
新規作成したアプリリポジトリでは、まず `@lab-core/sdk-cli` を追加してから `yarn exec labcore ...` で使います。

```bash
yarn add -D @lab-core/sdk-cli@git@github.com:<ORG>/<REPO>.git#workspace=@lab-core/sdk-cli&head=main
yarn exec labcore lint --profile dev-sim
```

- `init`
  - 雛形生成（`labcore/SDK使い方.md` を含む）
- `inspect`
  - compose の解析結果を表示
- `lint`
  - manifest / profile / compose の整合性を検証
- `preflight`
  - 実行前確認
- `seed <apply|verify|reset>`
  - seed スクリプト実行
- `export`
  - 登録用 payload 出力
- `guard prod`
  - 本番向け安全性チェック
- `doctor`
  - 設定診断
- `ci-install`
  - GitHub Actions テンプレート導入

## 5. library API
`@lab-core/sdk` は次の API を公開しています。

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

const payload = exportSdkPayload({ cwd: process.cwd(), profile: "prod" });
console.log(payload);
```

## 6. CI 連携
`ci-install` を使うと `.github/workflows/labcore-sdk.yml` を追加できます。  
この workflow は、対象リポジトリ側の `devDependencies` に `@lab-core/sdk-cli` が入っている前提で、主に次を実行します。

- `yarn exec labcore lint --profile dev-sim`
- `yarn exec labcore preflight --profile dev-sim`
- `yarn exec labcore guard prod --profile prod`
- `yarn exec labcore export --profile prod --out build/labcore-payload.json`

## 7. よくある失敗
- `exposure.service` と compose のサービス名が一致しない
- `exposure.port` と実際の listen ポートが一致しない
- `env.required` の値が profile で埋まっていない
- `devices.required` と `deviceRequirements` が一致しない
- 開発用 compose にしか公開サービスが定義されていない

## 8. 関連資料
- `docs/readmes/SDK概要.md`
- `docs/readmes/適合アプリ作成ガイド.md`
- `sdk/README.md`
