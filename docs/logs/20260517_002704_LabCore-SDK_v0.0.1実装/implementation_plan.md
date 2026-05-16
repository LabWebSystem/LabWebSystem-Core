# 実装計画

## 方針
- まず SDK の骨格（workspace + package 分割）を作り、次に CLI と検証ロジックを接続する。
- 既存 core との整合性を重視し、compose 解析ロジックは core 実装互換を優先する。

## 実装ステップ
1. `sdk/` 直下に monorepo (`sdk/package.json`, `tsconfig.base.json`) を作成
2. `sdk-contract` で manifest/profile/export schema と loader を実装
3. `sdk-inspect` に compose 解析機能とテストを実装
4. `sdk-profile` で profile merge / prod guard / export payload を実装
5. `sdk-seed`, `sdk-ci` を実装
6. `sdk-cli` で各コマンドを実装し root script へ接続
7. build/test/smoke を実施して調整

## 検証
- `yarn sdk:build`
- `yarn sdk:test`
- `yarn labcore help`
- 一時ディレクトリで `labcore init`, `inspect`, `lint`, `export` を実行
