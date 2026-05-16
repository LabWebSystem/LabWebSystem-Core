# 修正内容の確認

## 実施内容
- ルートの npm script は既に `sdk:labcore` へ変更済みだったため、関連導線を追従修正。
- `sdk/README.md` の CLI 使用例をすべて `yarn sdk:labcore ...` に更新。
- `sdk/packages/sdk-ci/templates/github-actions-labcore.yml` の CI 実行コマンドを `yarn sdk:labcore ...` に更新。

## 検証
- `yarn sdk:labcore help` を実行し、CLI ヘルプが正常表示されることを確認。

## 補足
- `sdk/packages/sdk-cli/package.json` の `bin.labcore` は npm CLI コマンド名であり、今回依頼の「script名変更」とは別レイヤのため据え置き。
