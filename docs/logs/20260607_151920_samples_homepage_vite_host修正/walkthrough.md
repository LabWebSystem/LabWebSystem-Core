# 修正内容の確認

作成日: 2026-06-07

## 原因
- `frontend/vite.config.ts` には `preview.allowedHosts: true` が入っていた。
- しかし `frontend/Dockerfile` の本番ステージが `vite.config.ts` をイメージへコピーしておらず、実際の `vite preview` 起動時には host 許可設定が読まれていなかった。

## 実施内容
- `frontend/Dockerfile`
  - 本番ステージへ `vite.config.ts` をコピーするよう修正。
- `frontend/vite.config.ts`
  - `server` / `preview` の両方で `allowedHosts: true` を維持。
  - `/api` を `http://api:8787` へ proxy する設定を追加。
- `frontend/src/main.tsx`
  - API の既定向き先を `http://localhost:8787` から空文字へ変更し、same-origin の `/api/*` を使うようにした。
- `docker-compose.yml`
  - `VITE_API_BASE_URL` を空文字に変更。
  - `CORS_ORIGIN` を `*` に変更。
- `README.md`
  - Lab-Core 配備時は `web` 公開だけで動くことを追記。

## 確認結果
- `curl -H 'Host: homepage.samples.fukaya-sus.lab' http://127.0.0.1/`
  - HTML 返却を確認。
- `curl -H 'Host: homepage.samples.fukaya-sus.lab' http://127.0.0.1/api/tasks`
  - `{"tasks":[]}` を確認。
- 実行中 web コンテナ内に `vite.config.ts` が存在することを確認。
- 配信中 dist から `localhost:8787` が消えていることを確認。

## 補足
- Docker build による通常再配備は `repo.yarnpkg.com` の DNS 失敗 (`EAI_AGAIN`) で不安定だったため、確認時は既存 web コンテナ内で `dist` を再ビルドし、再起動して反映した。
