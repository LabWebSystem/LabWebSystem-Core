# 修正内容の確認

## 1. 変更方針

- `package.json` にはコマンド名だけを残し、実処理は `scripts/dev/root-command.mjs` へ移動。
- 既存の script 名は互換性のため維持。
- 重複していた環境変数設定・docker compose 呼び出し・連鎖実行をランナー側で一元管理。

## 2. scripts の役割と必要性

| script | 役割 | 必要性判定 |
|---|---|---|
| `dev` | ローカル標準起動（kernel 一式） | 必須 |
| `lab:up` | 本番向け一括起動（80/53 bind） | 必須 |
| `lab:down` | 本番向け一括停止 | 必須 |
| `lab:logs` | 本番向け一括ログ追跡 | 必須 |
| `lab:down-clean` | 停止 + 管理領域初期化 | 必須 |
| `config:init` | 初期 `.env` 作成 | 必須 |
| `config:reset` | 設定再作成 | 必須 |
| `build` | backend/dashboard のビルド | 必須 |
| `permissions:repair` | root 所有崩れの自己修復 | 運用補助 |
| `maintenance:reset` | 初期化プレビュー | 運用補助 |
| `maintenance:reset:yes` | 初期化実行 | 運用補助 |
| `test:register-fixtures` | 登録テストデータ投入 | 運用補助 |
| `test:smoke` | E2E スモーク | 運用補助 |
| `dev:backend` | backend 単体起動 | 運用補助 |
| `dev:dashboard` | dashboard 単体起動 | 運用補助 |
| `dev:local` | `dev:backend` への短縮導線 | 互換/任意 |
| `dev:kernel:up` | kernel 一式起動（`dev` の実体） | 内部実装/運用補助 |
| `dev:kernel:down` | kernel 一式停止 | 内部実装/運用補助 |
| `dev:kernel:logs` | kernel 一式ログ | 内部実装/運用補助 |
| `dev:core:deps` | core 依存準備 | 内部実装/運用補助 |
| `dev:core:up` | backend/dashboard コンテナ起動 | 内部実装/運用補助 |
| `dev:core:down` | backend/dashboard コンテナ停止 | 内部実装/運用補助 |
| `dev:core:logs` | backend/dashboard ログ | 内部実装/運用補助 |
| `dev:dns` | DNS コンテナ起動 | 運用補助 |
| `dev:dns:down` | DNS コンテナ停止 | 運用補助 |
| `dev:dns:logs` | DNS ログ | 運用補助 |
| `dev:proxy` | proxy 起動 + ネットワーク同期 | 運用補助 |
| `dev:proxy:refresh` | proxy ネットワーク再同期 | 運用補助 |
| `dev:proxy:down` | proxy 停止 | 運用補助 |
| `dev:proxy:logs` | proxy ログ | 運用補助 |
| `dev:lab` | `lab:up` 旧名互換 | 互換のみ（将来削除候補） |
| `dev:lab:down` | `lab:down` 旧名互換 | 互換のみ（将来削除候補） |
| `dev:lab:logs` | `lab:logs` 旧名互換 | 互換のみ（将来削除候補） |

## 3. 実装内容

- 新規追加: `scripts/dev/root-command.mjs`
- 変更: `package.json` の scripts はすべて `node scripts/dev/root-command.mjs <command>` へ統一。

## 4. 得られた効果

- `package.json` の各 script が「名前だけ」の薄い定義になり、読みやすさが向上。
- 実行順序・環境変数・compose コマンドを1ファイルに集約でき、変更時の影響範囲が明確化。
- 互換 alias を維持しつつ、将来の削除候補を明示できた。

## 5. 検証

- `node scripts/dev/root-command.mjs __invalid__` で usage が表示されることを確認。
- `yarn build` はランナー経由で実行開始できることを確認。
- ただし検証環境では既存の `core/backend/dist` 所有権問題により `EACCES` でビルド失敗（今回変更とは独立）。
