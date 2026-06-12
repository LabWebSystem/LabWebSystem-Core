# 実装計画

1. `core/backend/src/routes` と関連 service / type を読み、現行 API の path・query・requestBody・response を整理する。
2. `docs/readmes/バックエンドOpenAPI仕様.yaml` を作成し、OpenAPI 3.1 形式で共通 schema を定義する。
3. backend に OpenAPI 読み出しモジュールを追加し、`/api/openapi.json` と `/api/openapi.yaml` を配信する。
4. `README.md`、`core/backend/README.md`、`docs/readmes/説明書一覧.md` を更新し、仕様書の参照先を明確にする。
5. `yarn` で build を実行し、YAML の構文と TypeScript ビルドが通ることを確認する。
