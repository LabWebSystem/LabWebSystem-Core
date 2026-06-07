# 確認結果: SDK導線 dlx 化

## 実施内容
- `docs/readmes/SDK概要.md` を「新規作成したリポジトリでどう使うか」という流れに変更した。
  - 初回: `yarn dlx -p @lab-core/sdk-cli@... labcore init ...`
  - 継続利用: `yarn add -D @lab-core/sdk-cli@...`
  - 実行: `yarn exec labcore ...`
- `docs/readmes/SDK仕様書.md` の CLI / CI 説明を同じ前提へ更新した。
- `sdk/README.md` も同じ導線に揃えた。
- `labcore init` が生成する `labcore/SDK使い方.md` の内容を更新した。
- `ci-install` が生成する GitHub Actions テンプレートを `yarn exec labcore ...` ベースに修正した。
- `sdk-cli` と `sdk-ci` のテストを更新した。

## 確認結果
- `corepack yarn build` in `sdk/`: 成功
- `corepack yarn test` in `sdk/`: 成功

## 補足
- ルート `package.json` の `sdk:build` / `sdk:test` は今回の変更とは別に削除されていたため、ルートではなく `sdk/` 直下で検証した。
