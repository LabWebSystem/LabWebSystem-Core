# LabWebSystem Core 運用手順書

## 開発者向け入口

リポジトリ全体の操作は `mise` タスクから行います。環境 profile の選択や `.env` の手動生成は不要です。

```bash
mise install
mise run dev
```

目的別のタスクは [`LabWebSystem Core 開発・検証・デプロイ体制仕様書.md`](LabWebSystem%20Core%20開発・検証・デプロイ体制仕様書.md) を参照してください。

## ダッシュボード

通常開発では `http://127.0.0.1:5173` を開きます。dashboard 単体で作業する場合は `mise run dashboard`、backend API と一緒に作業する場合は `mise run dev` を使用します。

## backend API

backend 単体は `mise run backend` で起動し、`http://127.0.0.1:7300/health` を確認します。通常テストは `mise run test` で実行します。

## 検証

- Docker runtime の確認: `mise run test:container`
- DNS / reverse proxy を含む全体確認: `mise run test:system`
- 開発プロセスと検証環境の停止: `mise run stop`
- 開発生成物の削除: `mise run clean`

## Production

Production の Release、Compose、`runtime.env` の契約は [`LabWebSystem Coreデプロイ仕様書.md`](LabWebSystem%20Coreデプロイ仕様書.md) と [`LabWebSystem外部契約.md`](LabWebSystem外部契約.md) を参照してください。デプロイは `mise run deploy --version vX.Y.Z` で開始します。既存のタグまたはReleaseを再利用する場合は、削除確認が表示されます。
