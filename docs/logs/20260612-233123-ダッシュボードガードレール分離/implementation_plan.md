# 実装計画

## 方針

`layout.ts` に混在していたガードレール責務を `core/dashboard/src/dashboard/guardrails` 配下へ分離し、今後はこのモジュール群を強化するだけで整合性管理を拡張できるようにする。

## 実施項目

1. `guardrails/types.ts` に違反レポートや配置コンテキストの型を定義する
2. `guardrails/geometry.ts` に配置探索、境界判定、重なり判定、幾何検証を分離する
3. `guardrails/sizing.ts` にサイズ補正とレイアウト由来サイズ解決を分離する
4. `guardrails/structure.ts` に構造整合性検証を分離する
5. `guardrails/document.ts` にガードレールレポート集約と自動修復を実装する
6. `layout.ts` と `useDashboardWorkspace.ts` から新モジュールを利用するように切り替える

## 期待効果

- ガードレールの責務境界が明確になる
- 今後、保存前検証や E2E 連携、バックエンド検証との仕様共有がしやすくなる
- 不具合調査時に「構造違反」と「幾何違反」を切り分けやすくなる
