# 実装計画

1. ルート `package.json` の `scripts` を読み取る Node.js スクリプトを新規作成する。
2. `@inquirer/prompts` の `select` を使って TUI メニューを表示する。
3. 選択された script を `corepack yarn run <script名>` で実行する。
4. 実行後に継続可否を確認し、連続実行できるようにする。
5. ルート `package.json` に `tasks` script を追加する。
