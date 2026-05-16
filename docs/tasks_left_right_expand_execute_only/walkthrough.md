# 修正内容の確認

## 1. 操作仕様の変更

- `Enter` はコマンド実行専用に変更。
- グループ開閉は `←/→` 専用に変更。
- グループ選択中の `Enter` は無効化。

## 2. 実装内容

- `scripts/tasks/interactive-tasks.ts` を更新し、raw key input の分岐を以下に整理:
  - `right`: 選択中グループを展開
  - `left`: 選択中グループを折りたたみ（コマンド行では親グループを折りたたみ）
  - `return`: 選択中がコマンドの場合のみ `yarn run <script>` 実行
- 実行後は追加確認なしで一覧へ復帰。

## 3. 検証

- `yarn run typecheck:scripts` 成功。
- `yarn run tasks` を TTY で確認し、以下を実機確認:
  - `→` で展開
  - `←` で折りたたみ
  - グループ上で `Enter` は何も起こらない
  - コマンド上で `Enter` 1回で実行される
