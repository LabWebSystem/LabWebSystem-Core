# 調査結果

作成日: 2026-06-07

## 結論
- 原因は Lab-Core の reverse proxy や DNS ではなく、`Samples-Homepage` のフロント bundle が `http://localhost:8787` を固定で参照していることです。
- 実際の API は死んでいません。`Host: homepage.samples.fukaya-sus.lab` を付けた `/api/tasks` は Lab-Core 経由で正常応答しています。
- つまり「バックエンドは動いているが、ブラウザが自分自身の localhost を叩いてしまっている」状態です。

## 確認した事実
- runtime clone の `frontend/src/main.tsx`
  - `const API_BASE_URL = ... ?? "http://localhost:8787";`
- runtime clone の `docker-compose.yml`
  - `VITE_API_BASE_URL: http://localhost:8787`
  - `CORS_ORIGIN: http://localhost:5180`
- 実行中 web コンテナの `dist/assets/index-Dajt7u9t.js`
  - `http://localhost:8787` が埋め込まれていることを確認
- 実行中 API コンテナ
  - `docker logs` で `[api] listening on 0.0.0.0:8787`
- Lab-Core 経由 API
  - `curl -H 'Host: homepage.samples.fukaya-sus.lab' http://127.0.0.1/api/tasks`
  - `{"tasks":[]}` を確認

## 切り分け結果
- GitHub `main` HEAD: `128d05f`
- runtime clone HEAD: `128d05f`
- つまり、Lab-Core が古い commit を誤って配備したのではなく、GitHub 上の最新内容そのものが `localhost` 固定の状態です。

## 解釈
- `homepage.samples.fukaya-sus.lab` を開いた利用者ブラウザにとっての `localhost:8787` は、Lab-Core サーバーではなく利用者自身の端末です。
- そのため `ERR_CONNECTION_REFUSED` になります。
- Lab-Core に載せるなら、フロントは same-origin の `/api/...` を叩くか、少なくとも `api.<domain>` など配備先ホスト名ベースで到達できる URL を使う必要があります。
