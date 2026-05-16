# 修正内容の確認

## 原因

- ルート `package.json` から `packageManager` が抜けていたため、`corepack yarn` が `1.22.22` を解決していた。
- 一方で手元の `yarn` は `4.14.1` を使っており、実行経路ごとに Yarn バージョンが混在していた。
- その結果、リポジトリ内 `yarn.lock` が Yarn 1 形式で残る状態になり、Yarn 4 で `yarn lab:up` を実行すると `lab-core@workspace:.` エントリ欠落エラーが発生していた。

## 対応

- ルート `package.json` に `"packageManager": "yarn@4.14.1"` を追加。
- `corepack yarn install` を実行して `yarn.lock` を Yarn 4 形式へ再生成。
- `yarn.lock` に `"lab-core@workspace:."` エントリが存在することを確認。

## 検証結果

- `yarn lab:up` 実行時、従来の lockfile エラーは再現しないことを確認。
- 起動処理は先へ進み、別件として `typescript` の checksum エラーで停止（本件とは独立）。

## 再発防止ポイント

- `packageManager` を維持し、Yarn バージョンをプロジェクトで固定する。
- lockfile 変更時は Yarn 1 形式へ戻っていないか（先頭ヘッダと `lab-core@workspace:.` の有無）を確認する。
