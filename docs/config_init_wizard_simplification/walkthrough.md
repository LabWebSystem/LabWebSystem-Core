# 修正内容の確認

## 変更ファイル
- `scripts/config/env-wizard.mjs`

## 廃止した構成
- セクション単位の往復ナビゲーション
- 項目ごとの「次/前/一覧へ戻る」
- 任意セクションジャンプ

## 新しいウィザード構成
1. プロファイル選択
2. 公開先IP選択（確認あり）
3. SSH用IP選択（確認あり）
4. ルートドメイン入力（確認あり）
5. 最終プレビュー・保存確認

## 入力対象を最小化した項目
- `LAB_CORE_MAIN_SERVICE_IP`
- `LAB_CORE_SSH_SERVICE_IP`
- `LAB_CORE_ROOT_DOMAIN`

## 既定値運用にした項目
- ポート、実行モード、DB/パス、DNS関連などはプロファイル既定値を自動適用。
- 必要時は `core/backend/.env` を手編集して調整可能。

## 検証
- `node --check scripts/config/env-wizard.mjs` を実行し、構文エラーがないことを確認。
