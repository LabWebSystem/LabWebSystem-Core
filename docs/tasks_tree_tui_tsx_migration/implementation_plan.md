# 実装計画

1. `scripts` 配下の `.mjs` ファイルを `.ts` にリネームする。
2. `package.json` と関連シェルスクリプトの実行コマンドを `node ...mjs` から `corepack yarn tsx ...ts` に切り替える。
3. `tasks` ランチャーをツリー構造に再実装し、`:` 区切りで階層化する。
4. キーボード操作でグループ開閉・コマンド実行・終了ができる TUI を実装する。
5. TypeScript 実行基盤として `tsx` / `typescript` を追加し、`tsconfig.scripts.json` と型チェックコマンドを整備する。
