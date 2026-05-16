# homepage sample (Vite + Hono + PostgreSQL)

LabCore-SDK 用サンプルアプリです。フロントエンド(web配信)・API・DB を 3 コンテナで構成し、
タイマー付き TODO を扱います。

## 構成
- `web`: Vite + React
- `api`: Hono + node-postgres
- `db`: PostgreSQL 16

## 起動
```bash
docker compose up -d --build
```

- Web: `http://localhost:5180`
- API: `http://localhost:8787`

## SDK チェック
```bash
node ../../sdk/packages/sdk-cli/bin/labcore.js lint --profile dev-sim
```

## 主な API
- `GET /api/tasks` 現在タスク
- `GET /api/tasks/history` 過去タスク
- `POST /api/tasks` タスク作成
- `PATCH /api/tasks/:id` 進捗/状態更新
- `DELETE /api/tasks/:id` タスク削除
- `POST /api/tasks/:id/timer` タイマー設定
- `POST /api/tasks/:id/timer/pause` タイマー中断
- `POST /api/tasks/:id/timer/resume` タイマー再開
- `DELETE /api/tasks/:id/timer` タイマー削除
- `POST /api/tasks/:id/evaluation` 評価投稿
