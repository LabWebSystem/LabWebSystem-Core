# 実装計画

1. `package.json` の `scripts` 内で `yarn` を呼んでいる箇所を抽出する。
2. すべて `corepack yarn` へ置換する。
3. JSON 構文と置換漏れを検証する。
