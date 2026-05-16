# 実装計画

## 方針
- 推測ではなく、現行コードのバリデーション・実行処理を一次情報として調査する。
- 「SDKで隠蔽すべき複雑性」を抽出し、最小契約と理想構成を分離して提案する。

## 調査ステップ
1. 公式仕様と既存ガイドから運用上の期待値を把握する
2. `POST /api/applications` までの入力契約（URL、branch、compose、service、env）を確認する
3. `compose-inspection` の解析ロジックから自動判定可能項目を特定する
4. `application-jobs` / `application-logs` から運用時の暗黙要件（composeコマンド互換、ログ方式）を特定する
5. SDK構成を「契約層」「生成層」「検証層」「CI層」に分けて設計する

## 成果物
- `walkthrough.md` に以下を記述する
  - 現行実装ベースの最低限ルール
  - 現在難しい理由（SDK化対象）
  - 理想SDK構成（モジュール、CLI、manifest、CI）
