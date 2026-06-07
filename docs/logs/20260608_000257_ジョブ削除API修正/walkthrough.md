# 修正内容の確認

原因は、backend ソース上には `DELETE /api/jobs/:jobId` が定義されているにもかかわらず、実行中の Hono サーバーではそのルートだけ plain text の `404 Not Found` になっていたことです。一方で `POST /api/jobs/:jobId/retry` や `POST /api/jobs/:jobId/cancel` は正常にマッチしていました。

このため、削除処理本体は共通化したまま、確実に通る `POST /api/jobs/:jobId/delete` を backend に追加し、dashboard の `deleteJob()` はこの新しいルートを呼ぶように変更しました。既存の `DELETE /api/jobs/:jobId` もコード上は残していますが、UI は `POST` 側を使います。

確認結果:

- `corepack yarn workspace @lab-core/backend build` : 成功
- `corepack yarn workspace @lab-core/dashboard build` : 成功
- `docker restart compose-backend-1 compose-dashboard-1` 実施
- `curl -X POST http://127.0.0.1:7300/api/jobs/5XqDKf0pKyu_a04samumZ/delete` : 200
- `curl -X POST -H 'Host: dashboard.fukaya-sus.lab' http://127.0.0.1/api/jobs/F3CEvCkDQD2f2PxeEUqf1/delete` : 200

上記 2 件は実際にジョブ一覧から消えることも確認した。
