# 修正内容の確認

## 変更概要

- `core/backend/src/services/event-store.ts` を追加し、`system_events` への INSERT 文を共通化した。
- `application_id` には直接値を書き込まず、`applications` に存在する場合のみ関連付ける SQL に変更した。
- `core/backend/src/services/events.ts` は新しい共通 INSERT 文を利用するように変更した。
- `core/backend/src/testing/events.test.ts` を追加し、削除済みアプリ ID と既存アプリ ID の両方を検証した。

## SQL の変更意図

- 変更前は `VALUES (?, ?, ?, ?, ?, ?, ?)` で `application_id` をそのまま保存していた。
- 変更後は `VALUES (?, ?, (SELECT application_id FROM applications WHERE application_id = ?), ?, ?, ?, ?)` とし、参照先がない場合は自動で `NULL` にする。
- この方式は事前存在確認と INSERT を分けないため、削除との競合が起きても 1 クエリで安全に処理できる。

## 検証結果

- `node:test` で 10 件のテストが成功した。
- バックエンドの TypeScript ビルドが成功した。
