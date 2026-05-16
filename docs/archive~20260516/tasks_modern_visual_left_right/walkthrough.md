# 修正内容の確認

## 1. UI/UXの刷新内容

- タイトルを「ブランド + 機能名」の2層見出しに変更。
- 状態チップを追加:
  - `N commands`
  - `M groups open`
- キーガイドをキーキャップ風に表示。
- 一覧の視覚改善:
  - グループ/コマンドでアイコンと色を分離
  - 選択行に背景ハイライト
  - 階層は `│` ガイドで可視化
- フッターで選択中コマンドを要約表示。

## 2. 操作仕様の維持

- `→` で展開
- `←` で折りたたみ
- `Enter` はコマンド実行時のみ
- グループ選択中に `Enter` を押しても開閉しない

## 3. 変更ファイル

- `scripts/tasks/interactive-tasks.ts`
- `docs/tasks_modern_visual_left_right/task.md`
- `docs/tasks_modern_visual_left_right/implementation_plan.md`
- `docs/tasks_modern_visual_left_right/walkthrough.md`

## 4. 検証

- `yarn run typecheck:scripts` 成功。
- `yarn run tasks` をTTYで起動し、配色付きUI表示と `←/→` 開閉、`Enter` 実行専用を確認。
