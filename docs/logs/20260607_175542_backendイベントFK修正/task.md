# タスク

## 背景

- バックエンドで `recordEvent` 実行時に `SQLITE_CONSTRAINT_FOREIGNKEY` が発生することがある。
- 発生箇所は `system_events.application_id -> applications.application_id` の外部キー制約。

## 目的

- アプリ削除やジョブ失敗の競合時でも、イベント記録でバックエンドが追加で失敗しないようにする。

## 完了条件

- 削除済み `application_id` を含むイベント記録で外部キー違反が発生しない。
- 既存アプリに対するイベント記録では従来どおり `application_id` が保持される。
- 再現テストを追加し、バックエンドのテストとビルドが通る。
