# タスク

- `yarn run destroy` 実行時に `scripts/maintenance/reset-lab-core.ts` が `top-level await` で変換失敗する問題を修正する
- `launcher` 経由の `destroy` 起動経路で、少なくとも非対話プレビューまで正常に到達することを確認する
