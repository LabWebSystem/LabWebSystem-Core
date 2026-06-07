# 実装計画

作成日:
- 2026-06-07

## 1. 対象 compose の確認
- `infra/compose/docker-compose.dev.yml`
- `infra/compose/docker-compose.dns.yml`
- `infra/compose/docker-compose.proxy.yml`

## 2. 変更方針
- 常駐する `backend` / `dashboard` / `dns` / `proxy` に `restart: unless-stopped` を追加する
- ワンショット用途の `deps` には追加しない

## 3. 付随対応
- `docs/readmes/Lab-Core運用手順書.md` に自動復帰の挙動を追記する

## 4. 検証
- `docker compose -f ... config` で構文確認する
