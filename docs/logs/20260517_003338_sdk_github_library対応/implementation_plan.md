# 実装計画

## 方針
- CLI だけでなく API 利用可能な package を新設し、Node.js からの直接呼び出しを可能にする。
- GitHub 依存で利用しやすいよう、各 package の pack 時ビルドを有効化する。

## 実装ステップ
1. `sdk/packages/sdk` を追加し、lint/inspect/export/guard/seed API を公開
2. 各 package に `exports` と `prepack` を追加
3. `sdk/package.json` の build/test チェーンに `@lab-core/sdk` を追加
4. `sdk/README.md` に GitHub 経由（Yarn git workspace）導入手順とサンプルコードを追記
5. build/test を実行
