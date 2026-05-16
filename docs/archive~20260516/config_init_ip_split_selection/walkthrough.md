# 修正内容の確認

## 変更ファイル
- `scripts/config/env-wizard.mjs`

## 変更点
- IP候補リスト生成を `buildIpSelectionChoices` として分離。
- 自動適用処理を、以下の2段階で独立実行するよう変更。
  1. `LAB_CORE_MAIN_SERVICE_IP`（公開先IP）
  2. `LAB_CORE_SSH_SERVICE_IP`（SSH用IP）
- 各段階で:
  - 候補IP選択
  - 「変更しない（現在値を維持）」選択可
  - 適用確認ダイアログ表示
- 片方をスキップしても、もう片方は続けて選択可能。
- 同じIPを両方に設定することも可能。

## 検証
- `node --check scripts/config/env-wizard.mjs` を実行し、構文エラーがないことを確認。
