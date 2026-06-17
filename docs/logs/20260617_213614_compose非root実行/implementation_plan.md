# 実装計画

1. `infra/compose/docker-compose.dev.yml` の `backend` / `dashboard` にホスト UID/GID ベースの `user` 設定を追加する。
2. `scripts/dev/root-command.ts` でホスト UID/GID と Docker ソケット GID を解決し、compose 起動時に環境変数として渡す。
3. `corepack` / `yarn` が非 root 実行でも `/root` へ書かないよう、compose 側に一時キャッシュ用環境変数を追加する。
4. 関連ドキュメントと作業ログを更新し、実コンテナで所有者とビルド結果を確認する。
