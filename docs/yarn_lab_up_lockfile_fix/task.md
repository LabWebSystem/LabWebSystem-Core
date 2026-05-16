# タスク

`yarn lab:up` 実行時に発生する以下エラーの恒久対策を行う。

- `Internal Error: lab-core@workspace:.: This package doesn't seem to be present in your lockfile`

## 完了条件

- `yarn lab:up` で上記 lockfile エラーが再発しない。
- Yarn 実行経路（`yarn` / `corepack yarn`）で同一メジャーバージョンが使われる。
- 変更理由と確認結果をドキュメント化する。
