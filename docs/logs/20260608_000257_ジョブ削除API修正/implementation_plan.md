# 実装計画

1. backend のジョブ削除ルートが実際にマッチしているか、コンテナ内 API へ直接リクエストして切り分ける
2. `DELETE` だけ 404 になる実行系の差異を避けるため、ジョブ削除に `POST /api/jobs/:jobId/delete` を追加する
3. dashboard 側の削除 API 呼び出し先を新しい `POST` ルートへ切り替える
4. backend / dashboard を再ビルドし、起動中コンテナを再起動して same-origin 経由で削除成功を確認する
