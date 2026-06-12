# 修正内容の確認

## 原因

- ブラウザで見えていた画面は、こちらが修正していた `src` ではなく、古い `core/dashboard/dist` 成果物を配信していた
- 古い `dist` には `全ウィジェット削除` の文言自体が入っていなかった
- さらに、正式な `yarn --cwd core/dashboard build` を実行すると、`core/dashboard/src/dashboard/guardrails/document.ts` の型キャスト不備でビルドが止まっていた

## 実施した対応

- `core/dashboard/src/dashboard/guardrails/document.ts` の型キャストを修正し、正式ビルドを通るようにした
- 古い root 所有 `dist` を退避し、新しい `dist` を再生成した
- `compose-dashboard-1` を再起動し、配信サービスが最新の `dist` を読む状態にした
- `curl http://127.0.0.1:5173/` と配信 JS を確認し、`/assets/index-B3FlL-GM.js` に `全ウィジェット削除` が含まれることを確認した

## 確認結果

- 実行コマンド:
  `yarn --cwd core/dashboard build`
- 結果:
  成功
- 実行コマンド:
  `curl http://127.0.0.1:5173/`
- 結果:
  配信中の HTML は `/assets/index-B3FlL-GM.js` を参照
- 実行コマンド:
  `curl http://127.0.0.1:5173/assets/index-B3FlL-GM.js | grep -o '全ウィジェット削除'`
- 結果:
  文言を確認
