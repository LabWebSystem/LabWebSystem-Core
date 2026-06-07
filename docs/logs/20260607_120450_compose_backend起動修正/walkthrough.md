# 修正内容の確認

## 原因

- `infra/compose/docker-compose.dev.yml` の `backend` サービスが `corepack yarn dev:backend` を実行していた。
- ルート `package.json` には `dev:backend` が存在せず、現行の公開コマンド名は `service:backend:up` に変更済みだった。
- 同じ旧参照が `scripts/testing/run_full_system_smoke_test.sh` にも残っていた。

## 対応

- `infra/compose/docker-compose.dev.yml` の backend 起動コマンドを `corepack yarn service:backend:up` に変更した。
- `scripts/testing/run_full_system_smoke_test.sh` でも backend 起動コマンドを同じく `corepack yarn service:backend:up` に変更した。
- `README.md` の既知制約メモから、修正済みとなった旧コマンド注意書きを削除した。

## 検証結果

- `docker compose -f infra/compose/docker-compose.dev.yml config` : 成功
- `bash -n scripts/testing/run_full_system_smoke_test.sh` : 成功
- `corepack yarn quality:test:smoke` : backend 起動と `/health` 応答は成功、その後のアプリ登録で GitHub HTTPS 認証不足により 400
- `docker compose -f infra/compose/docker-compose.dev.yml up -d backend` + `curl http://127.0.0.1:7300/health` : 成功

## 補足

- 今回の主不具合である `dev:backend` 未定義エラーは解消済み。
- スモークテストの残件は、登録対象リポジトリの取得時に必要な GitHub 認証情報が実行環境にないことによる別問題。
