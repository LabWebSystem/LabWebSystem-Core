# 実装計画

作成日: 2026-06-07

## 調査方針
1. runtime clone の `frontend/src/main.tsx`, `vite.config.ts`, `docker-compose.yml` を確認する。
2. 実行中 web コンテナ内の `dist` を確認し、`localhost:8787` が bundle に残っているか確認する。
3. 実行中 API コンテナが生きているか、Lab-Core のホスト名経由 `/api/tasks` が実際には通るか確認する。
4. GitHub 上の `Samples-Homepage` 最新 commit と runtime clone が一致するか確認し、配備内容の鮮度を切り分ける。
