# SDK概要

対象読者:
- Lab-Core 適合アプリを新規作成する開発者
- 既存リポジトリを Lab-Core に統合したい開発者

文書ステータス:
- current

最終更新日:
- 2026-06-07

## 1. SDK の位置づけ
Lab-Core は、所定のルールに従う GitHub リポジトリを Web アプリとして登録するプラグイン方式の基盤です。  
各アプリは Lab-Core 本体に直接組み込むのではなく、独立した GitHub リポジトリとして管理し、そのリポジトリを登録して運用します。

SDK は、その「Lab-Core に統合できるアプリリポジトリ」を作るための TypeScript ライブラリ兼 CLI です。

## 2. SDK でできること
- Lab-Core 適合リポジトリの雛形を生成する
- manifest / profile / compose の整合性を検査する
- 開発用と本番用の設定を profile で分離する
- 登録用 payload を生成する
- seed / CI の導線を標準化する

## 3. 導入方法
新しい Lab-Core 適合アプリを作るときは、まず CLI を一時実行して雛形を生成します。

```bash
yarn dlx -p @lab-core/sdk-cli@git@github.com:<ORG>/<REPO>.git#workspace=@lab-core/sdk-cli&head=main labcore init --template standard
```

継続的に lint / preflight / export / CI で使う場合は、新規作成したリポジトリ側に CLI を開発依存として追加します。

```bash
yarn add -D @lab-core/sdk-cli@git@github.com:<ORG>/<REPO>.git#workspace=@lab-core/sdk-cli&head=main
```

library API を使いたい場合だけ、必要に応じて `@lab-core/sdk` も追加します。

```bash
yarn add @lab-core/sdk@git@github.com:<ORG>/<REPO>.git#workspace=@lab-core/sdk&head=main
```

library 使用例:
```ts
import { lintSdk, inspectSdk, exportSdkPayload, guardProdSdk } from "@lab-core/sdk";
```

## 4. 基本フロー
1. `yarn dlx -p @lab-core/sdk-cli@git@github.com:<ORG>/<REPO>.git#workspace=@lab-core/sdk-cli&head=main labcore init --template standard`
2. `yarn add -D @lab-core/sdk-cli@git@github.com:<ORG>/<REPO>.git#workspace=@lab-core/sdk-cli&head=main`
3. 生成された `labcore.app.yaml` と profile を調整する
4. `yarn exec labcore lint --profile dev-sim`
5. `yarn exec labcore preflight --profile dev-sim`
6. `yarn exec labcore guard prod --profile prod`
7. `yarn exec labcore export --profile prod --out build/labcore-payload.json`
8. Lab-Core ダッシュボードで GitHub リポジトリを登録する

## 5. 生成される主なファイル
- `labcore.app.yaml`
- `labcore/SDK使い方.md`
- `labcore/profiles/dev-sim.yaml`
- `labcore/profiles/dev-real-device.yaml`
- `labcore/profiles/prod.yaml`
- `labcore/seeds/apply.sh`
- `labcore/seeds/verify.sh`
- `labcore/seeds/reset.sh`

## 6. どういう場面で使うか
- 新しい Lab-Core 適合アプリの雛形を最短で作りたいとき
- 既存の Docker Compose アプリが Lab-Core に正しく統合可能かを確認したいとき
- 本番配備前に mock 設定や必須 env 漏れを検出したいとき

## 7. 詳細仕様
manifest / profile / CLI / library API の詳細は `docs/readmes/SDK仕様書.md` を参照してください。
