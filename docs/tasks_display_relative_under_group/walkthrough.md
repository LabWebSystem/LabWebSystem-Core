# 修正内容の確認

## 1. 実装内容

- `scripts/tasks/interactive-tasks.ts` に `commandLabelInTree()` を追加。
- コマンド行の表示名を「親グループからの相対名」に変更。
  - 例: `dev:dashboard` → `dev` 配下で `dashboard`
  - 例: `dev:local` → `dev` 配下で `local`
- 表示は `/` 区切りに統一（`:` は表示変換）。

## 2. 実行仕様

- 実行時には従来どおり元の script 名（`dev:dashboard` など）を使用。

## 3. 検証

- `yarn run typecheck:scripts` 成功。
- `yarn run tasks` で `dev` 展開時に `dashboard` / `local` など相対表示になることを確認。
