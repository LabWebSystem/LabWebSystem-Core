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
SDK は TypeScript ライブラリとして、GitHub リポジトリから直接導入できます。

```bash
yarn add @lab-core/sdk@git@github.com:<ORG>/<REPO>.git#workspace=@lab-core/sdk&head=main
```

使用例:
```ts
import { lintSdk, inspectSdk, exportSdkPayload, guardProdSdk } from "@lab-core/sdk";
```

## 4. 基本フロー
1. `yarn sdk:labcore init --template standard`
2. 生成された `labcore.app.yaml` と profile を調整する
3. `yarn sdk:labcore lint --profile dev-sim`
4. `yarn sdk:labcore preflight --profile dev-sim`
5. `yarn sdk:labcore guard prod`
6. `yarn sdk:labcore export --profile prod --out build/labcore-payload.json`
7. Lab-Core ダッシュボードで GitHub リポジトリを登録する

## 5. 生成される主なファイル
- `labcore.app.yaml`
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
