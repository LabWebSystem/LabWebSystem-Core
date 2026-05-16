# タスク

## 目的
コマンド体系を L1/L2 呼称で再整理し、`operations` 階層を廃止する。

## 要件
- `operations` 配下の公開コマンドを削除する。
- L1 コマンドとして `config` と `destroy` を追加する。
- `config` は以下の動作とする。
  - `.env` が無い: `init` 相当で起動
  - `.env` がある: ダイアログ確認後に `reset` 相当で起動
- `destroy` は旧 `env_clean` の役割を引き継ぐ。
