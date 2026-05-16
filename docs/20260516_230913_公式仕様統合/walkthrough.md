# 修正内容の確認

## 実施概要
- `docs` 配下 **104ファイル** を対象に、全件の存在確認・更新時刻確認・内容分類を実施。
- 現行コード（`package.json`, `scripts/`, `core/backend/`, `core/dashboard/`）を基準に整合性を検証。
- その結果をもとに、正式仕様書 `official_specification.md` を新規作成。

## 採用判断ルール
1. **実装コード一致を最優先**
2. コードでは判断しきれない箇所は **新しい文書を優先**
3. 以下は正式仕様から除外
   - 細かなバグ修正ログ
   - 単発タスクの作業記録
   - 現在の実装と異なる旧運用記述

## 主な分析対象（カテゴリ）
- 中核仕様候補
  - `docs/lab_core_system_documentation/*`
  - `docs/lab_core_app_repository_guide/app_repository_creation_guide.md`
- 直近更新（高優先）
  - `docs/l1_l2_command_cleanup_config_destroy/*`（最新のコマンド体系）
  - `docs/package_scripts_role_based_tree_reorg/*`
  - `docs/tasks_*/*`（launcher UI更新）
  - `docs/config_init_*/*`（設定ウィザード更新）
- 参考だが仕様本文には非採用
  - `docs/*/task.md`, `docs/*/implementation_plan.md`, `docs/*/walkthrough.md` の作業ログ性記述
  - `docs/readmes/開発前使用提案書.md`（Draft色が強い将来案）
  - 旧コマンド体系（`yarn dev`, `yarn lab:*`, `yarn maintenance:*` など）を前提にした運用記述

## 現行実装との照合結果（重要）
- 現在の公開 scripts は `launcher`, `config`, `destroy`, `environment:*`, `service:*`, `quality:*`。
- 既存 docs の多くは旧 scripts 名を参照しており、そのままでは現行運用と不一致。
- backend / dashboard / jobs / logs / infra-sync の実装は、既存のシステム文書より機能が進んでいる箇所（停止/再開、デプロイ設定編集など）がある。

## 成果物
- `docs/20260516_230913_公式仕様統合/task.md`
- `docs/20260516_230913_公式仕様統合/implementation_plan.md`
- `docs/20260516_230913_公式仕様統合/walkthrough.md`
- `docs/20260516_230913_公式仕様統合/official_specification.md`（正式仕様書）

## 補足
- 既存の旧ドキュメント群は参照履歴として残し、今回作成した正式仕様書を「正」として扱う前提で整理。
