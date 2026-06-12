# 修正内容の確認

## 実施内容

- `core/dashboard/src/dashboard/guardrails` に、配置判定と修復処理を「現在のブレークポイントだけ厳密に守る」オプションを追加した
- ウィジェット追加、ページ跨ぎドラッグ、ドラッグ終了後の確定、リサイズ後修復で、現在のブレークポイントをガードレールへ渡すようにした
- ドラッグ中のウィジェット本体は非表示にするのではなく、同じグリッド位置へ破線プレースホルダを表示するようにした

## 確認結果

- `corepack yarn workspace @lab-core/dashboard exec tsc -b`
  - 成功
- `corepack yarn workspace @lab-core/dashboard exec vite build --emptyOutDir false --outDir .vite-check`
  - 成功
- 配置関数の計算確認
  - 修正前は `status + cpu` の後に `chart` / `alert` を同ページへ置けないケースがあった
  - 修正後は `strictBreakpoint: 'lg'` で同ケースがページ 1 に配置可能になった

## 補足

- 既存の `core/dashboard/dist` は一部が root 所有で、通常の `vite build` では出力掃除時に `EACCES` となったため、検証は別出力先 `.vite-check` を使った
- これは今回の配置ロジック修正とは別件で、コンテナ経由 build の生成物権限が原因
