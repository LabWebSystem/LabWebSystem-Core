# 修正内容の確認

`dismissible` / `retryable` / `cancellable` が API から返らない場合でも、ジョブの `status` と `related_application_id` から UI 側で操作可否を補完するようにした。

- `queued` は `取り消す`
- `failed` かつ関連アプリありは `再実行`
- `succeeded` / `failed` / `cancelled` は `削除`

この判定をジョブキューパネルとアプリ詳細の関連ジョブ一覧の両方に適用したため、バックエンドの再起動前や旧レスポンス混在時でもボタンが消えにくくなった。

確認結果:

- `corepack yarn workspace @lab-core/dashboard build` が成功
