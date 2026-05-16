# 修正内容の確認

## 1. 実装

- `scripts/tasks/interactive-tasks.ts` に `toDisplayPath()` を追加。
- コマンド行の表示名を `dev:dashboard` から `dev/dashboard` 形式へ変換して表示。
- 下部の Selected 表示も同じく `/` 区切りへ統一。
- 検索結果の表示名も `/` 区切りへ統一。
- 実行自体は従来どおり元の script 名（`dev:dashboard`）を使用。

## 2. 検証

- `yarn run typecheck:scripts` 成功。
- `yarn run tasks` で `dev/dashboard` 表示になることを確認。
