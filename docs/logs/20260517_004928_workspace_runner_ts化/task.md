# タスクリスト

## 依頼内容
- `workspace-runner.mjs` を TypeScript 化し、`tsx` で実行するように変更する。

## 実施タスク
1. `sdk/scripts/workspace-runner.mjs` を `workspace-runner.ts` へ移行
2. `sdk/package.json` scripts を `tsx` 実行に変更
3. `tsx` を SDK monorepo devDependencies に追加
4. build/test 実行で整合性確認

## 完了条件
- `sdk/scripts/workspace-runner.ts` が存在する
- `.mjs` が廃止される
- `yarn sdk:build` / `yarn sdk:test` が成功する
