# 実装計画: SDK導線 dlx 化

## 方針
- 初回の雛形生成は `yarn dlx -p @lab-core/sdk-cli@... labcore init ...` を正規導線として説明する。
- 継続利用は `@lab-core/sdk-cli` を対象リポジトリへ `devDependencies` 追加し、`yarn exec labcore ...` で運用する形に統一する。
- library API は CLI とは分けて、必要時のみ `@lab-core/sdk` を追加する説明にする。
- CI テンプレートも `yarn exec labcore ...` 前提に合わせる。

## 実装ステップ
1. `docs/readmes/SDK概要.md` の導入方法と基本フローを置き換える。
2. `docs/readmes/SDK仕様書.md` の CLI / CI 記述を新導線に合わせる。
3. `sdk/README.md` を利用者向け導線へ合わせる。
4. `sdk/packages/sdk-cli/src/commands/init.ts` の生成ガイドを更新する。
5. `sdk/packages/sdk-ci/templates/github-actions-labcore.yml` を更新する。
6. `sdk-cli` / `sdk-ci` テストを追従させる。
7. SDK ワークスペース直下で `yarn build` / `yarn test` を実行する。

## 備考
- ルート `package.json` の `sdk:build` / `sdk:test` script は今回の作業開始時点で削除済みだったため、検証は `sdk/` ディレクトリで行う。
