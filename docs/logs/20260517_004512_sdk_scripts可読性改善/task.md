# タスクリスト

## 依頼内容
- `sdk/package.json` の scripts が長すぎて可読性が低い問題を改善する。

## 実施タスク
1. scripts の冗長なコマンド列を解消する
2. build/test/clean の実行順序を維持する
3. `yarn sdk:build` / `yarn sdk:test` で動作確認する

## 完了条件
- `sdk/package.json` scripts が短く読みやすい
- 実行結果が従来同等（全SDK workspace 実行）
