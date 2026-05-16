# 修正内容の確認

## L1/L2 再編
- L1 コマンドとして `config` と `destroy` を採用。
- `operations:*` は公開コマンドから廃止。

## config の動的挙動
- 実装先: `scripts/dev/root-command.ts`
- 判定ロジック:
  - `core/backend/.env` 不在: `scripts/config/env-wizard.ts init`
  - `core/backend/.env` 存在: 確認ダイアログ表示後、同意時のみ `reset` 実行
- 非TTY環境で `.env` が存在する場合は安全のため中止。

## reset 二重確認の解消
- 実装先: `scripts/config/env-wizard.ts`
- `LAB_CORE_ENV_WIZARD_SKIP_EXISTING_CONFIRM=1` のとき既存 `.env` の再確認を省略。
- `root-command.ts` から `config` の reset 実行時にのみこの環境変数を付与。

## destroy の扱い
- `destroy` は `scripts/maintenance/reset-lab-core.ts` を呼び出す L1 コマンド。
- スクリプト側の確認ダイアログ挙動は維持。

## 変更後の公開コマンド
- `launcher`
- `environment:dev:up`
- `environment:dev:down`
- `environment:dev:logs`
- `environment:lab:up`
- `environment:lab:down`
- `environment:lab:logs`
- `service:backend:up`
- `service:dashboard:up`
- `quality:build`
- `quality:typecheck:scripts`
- `quality:test:smoke`
- `quality:test:fixtures`
- `config`
- `destroy`
