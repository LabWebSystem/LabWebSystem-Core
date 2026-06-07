# 修正内容の確認

## 変更概要

- `core/dashboard/src/api.ts`
  - `resolveImportSource` の応答にランタイム検証を追加した。
  - `manifest` や `manifest.app` が欠けている場合は、画面クラッシュではなく明示的なエラーを返すようにした。
- `core/dashboard/src/App.tsx`
  - `applyResolveResult` に manifest 不在時の防御を追加した。

## 確認結果

- `corepack yarn workspace @lab-core/dashboard build` : 成功
- `corepack yarn workspace @lab-core/backend build` : 成功
