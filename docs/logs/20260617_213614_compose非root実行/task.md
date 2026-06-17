# タスク

`core/dashboard/dist` と `core/dashboard/tsconfig.tsbuildinfo` が Docker 経由の起動で `root` 所有になる問題を解消する。

## 目的

- `backend` / `dashboard` の生成物をホスト実行ユーザー所有で作成できるようにする。
- Docker ソケット利用を維持しつつ、開発用 compose 起動を非 root 実行へ寄せる。
