# 修正内容の確認

## 変更概要

- `launcher` に `Live Monitor` パネルを追加し、backend / dashboard / routed API の代表 URL を表示するようにした。
- 監視対象ごとに `UP / DOWN / WARN / WAIT` を表示し、3秒ごとの自動更新と `r` キーによる手動更新を追加した。
- `/api/system/status` が取得できた場合は、実行モード・アプリ件数・ジョブ数・DNS 状態の要約も併記するようにした。
- 設定コマンドを `config:set` / `config:show` / `config:edit` に分離した。
- `config:show` は非TTYではそのまま標準出力、TTY では `PAGER` / `less` / `more` / `cat` の順で表示するようにした。
- `config:edit` は `VISUAL` / `EDITOR` / `vim` / `vi` / `nano` の順でエディタを起動するようにした。

## 更新したファイル

- `package.json`
- `scripts/dev/root-command.ts`
- `scripts/config/env-wizard.ts`
- `scripts/tasks/interactive-tasks.ts`
- `README.md`
- `core/backend/README.md`
- `docs/readmes/how_to_use_lab_core.md`

## 検証結果

- `corepack yarn quality:typecheck:scripts` : 成功
- `corepack yarn config:show` : 成功
- `corepack yarn config:edit` : 非TTY環境で期待通り「TTYが必要」と表示
- `corepack yarn launcher` : 疑似TTY起動で `Live Monitor` パネル描画と自動更新を確認

## 補足

- 監視対象の routed URL は `core/backend/.env` の `LAB_CORE_ROOT_DOMAIN` を使って組み立てている。
- `config:set` 実行後に保存される `.env` のヘッダは `generated_by: yarn config:set` へ更新される。
- 既存の `.env` は表示専用のため、過去に生成された `generated_by` コメントが残っていても問題はない。
