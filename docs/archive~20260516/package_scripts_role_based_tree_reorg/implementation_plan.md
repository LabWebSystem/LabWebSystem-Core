# 実装計画

1. `package.json` の scripts を新しい階層構造へ置換する。
2. `scripts/dev/root-command.ts` の公開コマンド名を再編し、旧命名を整理する。
3. `scripts/tasks/interactive-tasks.ts` の自己参照名を `tasks` から `launcher` へ変更する。
4. `scripts/maintenance/reset-lab-core.ts` を、プレビュー表示後の確認ダイアログ実行方式へ変更する。
5. TypeScript スクリプト群の型検証を実施する。
