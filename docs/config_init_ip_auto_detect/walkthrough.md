# 修正内容の確認

## 変更ファイル
- `scripts/config/env-wizard.mjs`

## 追加した処理
- `node:os` を使って `os.networkInterfaces()` から IPv4 を収集。
- 内部ループバックや `169.254.x.x` を除外。
- 重複IPを排除し、物理NICを優先する簡易スコアで候補を並べ替え。
- 候補が複数ある場合は選択式で IP を選べるようにした。
- 選択後に確認ダイアログを表示し、承認時のみ以下を更新:
  - `LAB_CORE_MAIN_SERVICE_IP`
  - `LAB_CORE_SSH_SERVICE_IP`
- 拒否時は「自動適用スキップ」として既定値のまま継続。

## 期待されるフロー
1. プロファイルを選択
2. マシンIP候補を選択（候補が複数の場合）
3. 適用確認ダイアログで承認
4. セクション編集ウィザードへ進行

## 検証
- `node --check scripts/config/env-wizard.mjs` を実行し、構文エラーがないことを確認。
