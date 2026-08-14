# LabWebSystem Core v0.1.0

研究室向け統合 Web アプリ配信・運用基盤です。

## 構成

- `core/backend`: Hono + TypeScript + SQLite の API サーバー
- `core/dashboard`: React + Vite の運用ダッシュボード
- `infra/compose`: 開発・検証・Production のコンテナ定義
- `sdk`: 適合アプリ向け SDK

## 開発

開発者向けのリポジトリ全体の入口は `mise` です。設定プロファイルや事前の `config:set` は必要ありません。

```bash
mise install
mise run dev
```

目的別の入口は次のとおりです。

| タスク | 用途 |
| --- | --- |
| `mise run dev` | dashboard + backend の通常開発 |
| `mise run dashboard` | dashboard 単体の Vite/HMR 開発 |
| `mise run backend` | backend 単体の watch 開発 |
| `mise run test` | Docker に依存しない通常テスト |
| `mise run test:container` | Docker image / runtime 検証 |
| `mise run test:system` | DNS / reverse proxy を含む独立システム検証 |
| `mise run deploy` | CI Release の統一入口 |
| `mise run stop` | 開発・検証プロセスの停止 |
| `mise run clean` | 開発生成物のクリーンアップ |

開発時の DB、runtime、secret 相当値、内部 URL はタスクが自動的に決定します。通常の UI 開発や backend 開発で Docker、DNS、reverse proxy を起動しません。

## Production

Production は GitHub Release の `compose.yaml` と `runtime.env` で動作します。Release 契約と導入手順は [`LabWebSystem Coreデプロイ仕様書.md`](docs/readmes/LabWebSystem%20Coreデプロイ仕様書.md) を参照してください。

## バージョン

現在のリポジトリバージョンは [`VERSION`](VERSION) を正本とし、`v0.1.0` に統一しています。Release tag は `v0.1.0` 形式です。

## ドキュメント

- [`LabWebSystem Core 開発・検証・デプロイ体制仕様書.md`](docs/readmes/LabWebSystem%20Core%20開発・検証・デプロイ体制仕様書.md)
- [`説明書一覧.md`](docs/readmes/説明書一覧.md)
- [`LabWebSystem Coreデプロイ仕様書.md`](docs/readmes/LabWebSystem%20Coreデプロイ仕様書.md)
- [`SDK概要.md`](docs/readmes/SDK概要.md)
- [`SDK仕様書.md`](docs/readmes/SDK仕様書.md)
