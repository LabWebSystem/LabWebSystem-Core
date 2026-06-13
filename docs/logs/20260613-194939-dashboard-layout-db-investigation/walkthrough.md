# 修正内容の確認

今回はコード修正は行わず、保存フローの調査のみを実施した。

## 確認結果

- 保存先DBは `core/backend/data/database.sqlite`。
- ダッシュボードレイアウトは `dashboard_layouts` テーブルに保存される。
- 主キーは `dashboard_id` と `user_id` の複合キー。
- 保存APIは `GET /api/system/dashboard-layout` と `PUT /api/system/dashboard-layout`。
- フロントエンドは `saveDashboardLayout()` から `PUT /api/system/dashboard-layout` を呼び出し、`layout` オブジェクト全体を `payload_json` として保存する。
- 編集完了時だけではなく、通常の状態変化後の自動保存と `sendBeacon` による離脱時保存も入っている。
- 現在DBに入っている `operations-monitoring / default` の保存データは、3ページ・6ウィジェット構成だった。
- したがって、現状は「何のウィジェットを登録したか」だけでなく、ページ配属やレイアウトJSON自体もDBに保存されている。

## 調査時点の判断

- 保存APIやテーブル定義そのものが情報を欠落させている形跡は薄い。
- 一方で、保存される `layout` オブジェクトはロード時に `normalizeDashboardLayout()` を通り、その後 `sanitizeDashboardDocument()` で再配置される。
- さらに `sanitizeDashboardDocument()` の本体は新グリッドモジュール側 `moduleAdapter.ts` にあり、ここでページ再割当と全体再配置が走る。
- そのため、見た目や状態が崩れている主因は、DB保存失敗よりも「保存前後の正規化・再配置ロジック」である可能性が高い。

## DB初期化の扱い

- 全DB初期化は非推奨。他テーブルのアプリ情報、ジョブ、イベントまで消えるため影響が大きい。
- ダッシュボードだけをやり直したい場合は、`dashboard_layouts` の対象行だけ削除または上書きする方が安全。
- ただし対象行を削除すると、次回ロード時は `buildDefaultDashboardLayout()` の初期構成へ戻る。
