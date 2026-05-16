# 実装計画

1. `package.json` の scripts 一覧を取得し、README / docs 内の参照箇所を調査する。
2. scripts の実行ロジックを `scripts/dev/root-command.mjs` に集約する。
3. `package.json` は薄いエントリーポイント（`node scripts/dev/root-command.mjs <name>`）へ置き換える。
4. script ごとの役割と必要性を分類して文書化する。
5. 代表的な実行確認を行う。
