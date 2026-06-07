# タスク

- `launcher` 上で、現在アクセス確認に使える URL / エンドポイントを表示できるようにする。
- 各 URL / エンドポイントの死活チェックを自動更新し、リアルタイムに監視できるようにする。
- 設定コマンドを `config:set` / `config:show` / `config:edit` に分離する。
- `config:show` では現在の `core/backend/.env` を確認できるようにし、`config:edit` ではエディタで直接編集できるようにする。
