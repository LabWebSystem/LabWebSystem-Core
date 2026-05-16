# 修正内容の確認

## 追加したもの
- `samples/homepage` を新規作成。
- 3コンテナ構成:
  - `db`: `postgres:16-alpine`
  - `api`: Hono + node-postgres
  - `web`: Vite build + preview
- SDK 適合ファイル:
  - `labcore.app.yaml`
  - `labcore/profiles/{dev-sim,dev-real-device,prod}.yaml`
  - `labcore/seeds/{apply,verify,reset}.sh`

## API 実装内容
- `GET /api/tasks`: 現在タスク取得
- `GET /api/tasks/history`: 過去タスク取得
- `POST /api/tasks`: タスク作成
- `PATCH /api/tasks/:id`: 進捗/状態更新
- `DELETE /api/tasks/:id`: タスク削除
- `POST /api/tasks/:id/timer`: タイマー設定
- `POST /api/tasks/:id/timer/pause`: タイマー中断
- `POST /api/tasks/:id/timer/resume`: タイマー再開
- `DELETE /api/tasks/:id/timer`: タイマー削除
- `POST /api/tasks/:id/evaluation`: タイマー満了後評価投稿（投稿時に完了化）

## フロントエンド実装内容
- 現在タスクページ:
  - タスク入力/削除
  - 進捗更新/状態更新
  - タイマー設定/中断/再開/削除
  - タイマー満了後の評価投稿（所感を任意入力）
- 過去タスクページ:
  - 完了済みタスクの一覧
  - 評価・所感の表示

## 検証
- `corepack yarn typecheck` (`samples/homepage/api`): 成功
- `corepack yarn typecheck` (`samples/homepage/frontend`): 成功
- `corepack yarn build` (`samples/homepage/frontend`): 成功
- `docker compose config --services` (`samples/homepage`): `db`, `api`, `web`
- `docker compose build` (`samples/homepage`): 成功
- `docker compose up -d` 後に `curl http://localhost:8787/health`: `{\"ok\":true}`
- `curl -I http://localhost:5180`: `HTTP/1.1 200 OK`
- API スモーク:
  - タスク作成
  - タイマー設定（3秒）
  - タイマー満了後評価投稿
  - 履歴ページ向け API (`/api/tasks/history`) で反映確認
- `node ../../sdk/packages/sdk-cli/bin/labcore.js lint --profile dev-sim` (`samples/homepage`): `ok: true`

## 補足
- ルート script (`yarn sdk:labcore`) は workspace 実行時に CLI 作業ディレクトリが固定されるため、サンプル検証では `sdk-cli` の bin を直接実行した。
