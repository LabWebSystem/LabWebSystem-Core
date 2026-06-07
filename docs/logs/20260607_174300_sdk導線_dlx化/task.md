# タスク整理: SDK導線 dlx 化

## 依頼内容
- `docs/readmes/SDK概要.md` の導入方法がこのリポジトリ前提になっている問題を修正する。
- 新規作成したアプリリポジトリ利用者の視点で、`dlx` や導入後の実行方法に直す。

## 問題点
- `yarn sdk:labcore` はこの monorepo のルート script であり、新規作成したリポジトリには存在しない。
- `yarn add @lab-core/sdk ...` だけでは CLI で雛形を作る導線になっていない。
- `ci-install` の GitHub Actions テンプレートも同じ誤った前提を持っている。

## 完了条件
1. `SDK概要.md` が新規リポジトリ利用者の導線になっている。
2. `SDK仕様書.md` と `sdk/README.md` の関連説明も矛盾なく更新されている。
3. 生成される `labcore/SDK使い方.md` も同じ導線に揃っている。
4. `ci-install` の workflow テンプレートが新規リポジトリでも成立する実行方法に修正されている。
