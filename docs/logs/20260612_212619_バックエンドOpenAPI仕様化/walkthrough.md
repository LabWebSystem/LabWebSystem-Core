# 修正内容の確認

- `core/backend/openapi/openapi.yaml`
  - 現行 backend API を OpenAPI 3.1 形式で整理し、主要 endpoint と共通 schema を追加した。
- `core/backend/src/openapi.ts`
  - OpenAPI 正本を backend 配下から読み込み、`dist` 実行とコンテナ実行の両方で見失いにくい解決順を追加した。
- `core/backend/src/index.ts`
  - `/api/openapi.json` と `/api/openapi.yaml` を追加し、`/api` のメタ情報にも OpenAPI 配信先を含めた。
- `README.md` / `core/backend/README.md` / `docs/readmes/説明書一覧.md`
  - 現行 backend 仕様書への導線を追加した。
- 検証
  - `corepack yarn workspace @lab-core/backend build`
  - `core/backend/openapi/openapi.yaml` の YAML 解析を実行した。
