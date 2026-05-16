# 修正内容の確認

## 変更ファイル
- `README.md`

## 追加内容
- `## 前提依存関係` セクションを追加。
- 以下を明記:
  - Node.js `22.x` 推奨
  - `corepack yarn` 使用
  - Docker Engine
  - Docker Compose v2
  - Git
- 補足として、`Node 24` で `better-sqlite3` のネイティブビルド失敗が発生しうる点を追記。
- ホストで `yarn install` する場合の追加ツール（`make` / `gcc-c++` / `python3`）要件を追記。
