# 修正内容の確認

作成日:
- 2026-06-07

## 1. compose 変更
- `infra/compose/docker-compose.dev.yml`
  - `backend`
  - `dashboard`
- `infra/compose/docker-compose.dns.yml`
  - `dns`
- `infra/compose/docker-compose.proxy.yml`
  - `proxy`

上記の常駐サービスへ `restart: unless-stopped` を追加した。

## 2. 対象外
- `deps` は依存解決用のワンショットサービスなので、自動再起動対象から外した。
- ここへ `unless-stopped` を付けると、終了後に繰り返し再実行される可能性があるため。

## 3. ドキュメント
- `docs/readmes/Lab-Core運用手順書.md` に、自動復帰の挙動と `deps` が対象外である理由を追記した。
