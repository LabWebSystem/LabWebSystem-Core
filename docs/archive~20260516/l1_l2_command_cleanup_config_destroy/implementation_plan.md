# 実装計画

1. `package.json` の scripts から `operations:*` を削除し、L1 の `config`/`destroy` を追加する。
2. `scripts/dev/root-command.ts` を更新し、`config` の `.env` 存在判定と確認ダイアログ分岐を実装する。
3. `scripts/config/env-wizard.ts` に既存ファイル再確認をスキップできる制御を追加し、二重確認を防ぐ。
4. 型検証を実行して、変更後の scripts がビルドエラーなく実行可能であることを確認する。
