# 実装計画

## 原因整理

- `system_events.application_id` は `applications.application_id` を参照している。
- ジョブ開始時に取得した `applicationId` を保持したまま処理を続けるため、途中で対象アプリが削除されると失敗時の `recordEvent` が古い ID を書き込もうとして外部キー違反になる。

## 対応方針

1. `recordEvent` の INSERT を見直し、存在している `application_id` のみを関連付ける。
2. 参照先が存在しない場合は `system_events.application_id` に `NULL` を保存する。
3. SQL ロジックをテストしやすいように切り出す。
4. 「削除済み ID は `NULL` になる」「存在する ID は保持される」の 2 ケースをテストで固定化する。

## 検証方針

- `corepack yarn node --import tsx --test core/backend/src/testing/events.test.ts core/backend/src/testing/compose-inspection.test.ts`
- `corepack yarn workspace @lab-core/backend build`
