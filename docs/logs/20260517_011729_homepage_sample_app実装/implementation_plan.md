# 実装計画

1. `samples/homepage` の骨組み（compose, README, SDK 設定ファイル）を作成する。
2. `api` に Hono + PostgreSQL 実装を追加し、起動時に DB テーブルを初期化する。
3. `frontend` に Vite + React UI を追加し、現在タスク/履歴ページを実装する。
4. `api` / `frontend` を独立 Yarn プロジェクトとして依存解決し、型チェックを実行する。
5. `docker compose config --services` と SDK lint を実行して整合性を確認する。
