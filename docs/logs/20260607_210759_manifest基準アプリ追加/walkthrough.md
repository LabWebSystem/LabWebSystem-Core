# 修正内容の確認

## 変更概要

- `core/backend/src/services/import-manifest.ts`
  - `labcore.app.yaml` の検出と schema 検証を行う専用ロジックを追加した。
- `core/backend/src/routes/applications.ts`
  - GitHub URL 解析時に `labcore.app.yaml` が必須になるよう変更した。
  - UI に返す compose 候補を manifest の `deployment.composePath` のみに限定した。
  - アプリ登録時も manifest の `deployment.composePath` と一致するか検証するようにした。
- `core/dashboard/src/App.tsx`
  - manifest の内容でフォーム初期値を埋めるように変更した。
  - manifest 未解決や compose 未解析の状態では登録できないようにした。
- `core/dashboard/src/views/ImportView.tsx`
  - YAML 一覧から選ばせる UI をやめ、`labcore.app.yaml` の確認 UI に変更した。
  - manifest 由来の env も確認できるようにした。
- `core/backend/src/testing/import-manifest.test.ts`
  - manifest 検出と schema 解析のテストを追加した。

## 確認結果

- `corepack yarn workspace @lab-core/backend build` : 成功
- `corepack yarn workspace @lab-core/dashboard build` : 成功
- `corepack yarn node --import tsx --test core/backend/src/testing/compose-inspection.test.ts core/backend/src/testing/import-manifest.test.ts` : 12件成功
