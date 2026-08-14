# LabWebSystem Core Backend v0.1.0

Hono、TypeScript、SQLite で構成する Core API サーバーです。

## API

- `GET /health`
- `GET /api`
- `GET /api/openapi.json`
- `GET /api/openapi.yaml`
- `GET /api/system/status`
- `GET /api/applications`
- `POST /api/applications`
- `GET /api/applications/:applicationId`
- `POST /api/applications/:applicationId/operations`
- `GET /api/operations/:operationId`
- `GET /api/operations/:operationId/logs`
- `GET /api/events`
- `POST /api/infrastructure/sync`

API の正本は [`openapi.yaml`](openapi/openapi.yaml) です。

## 開発

ルートから次を実行します。

```bash
mise run backend
```

backend は `tsx watch` で起動し、DB、runtime、生成物のパスは開発タスクが自動で用意します。dashboard を起動せず、API は `http://127.0.0.1:7300` から直接確認できます。

## 設定

開発者が `.env` を生成・選択する方式は廃止しました。実行時の設定はタスク、コンテナ、Production infrastructure がそれぞれ決定します。Production の設定契約は [`LabWebSystem外部契約.md`](../../docs/readmes/LabWebSystem外部契約.md) を参照してください。
