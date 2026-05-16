# タスクリスト

1. `samples/homepage` に SDK 適合のサンプルアプリを新規作成する。
2. 3コンテナ構成（frontend/web, api, postgresql/db）を `docker-compose.yml` で定義する。
3. API で TODO 作成/削除/進捗更新、タイマー設定/中断/削除、タイマー満了後評価、履歴取得を実装する。
4. フロントエンドで現在タスク画面と過去タスク画面を作り、すべて API 経由で操作可能にする。
5. SDK 用 `labcore.app.yaml` と profile/seed を配置し、lint で適合性を確認する。
