# 実装計画

## 方針
- 実行順序は維持しつつ、実装言語のみ TS へ統一する。
- ランナーの実行はトランスパイル不要で扱える `tsx` を採用する。

## 手順
1. ランナーを TS へ移植（action 型定義を追加）
2. `sdk/package.json` の scripts を `tsx scripts/workspace-runner.ts` に変更
3. `sdk/package.json` に `tsx` を追加し `yarn install`
4. `yarn sdk:build` と `yarn sdk:test` を実行
