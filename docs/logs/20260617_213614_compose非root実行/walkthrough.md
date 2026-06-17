# 修正内容の確認

## 変更概要

- 開発用 compose の `backend` / `dashboard` を、ホスト実行ユーザーの UID/GID で起動するように変更した。
- `backend` には Docker ソケットのグループ ID を追加し、非 root 化後も Docker API へアクセスできるようにした。
- `corepack` / `yarn` のキャッシュ先を `/tmp` 配下へ逃がし、非 root 実行時に `/root` へ書こうとして失敗しないようにした。
- 運用手順書に、生成物が `root` 所有になりにくくなる挙動を追記した。

## 変更ファイル

- `infra/compose/docker-compose.dev.yml`
- `scripts/dev/root-command.ts`
- `docs/readmes/Lab-Core運用手順書.md`

## 動作確認

- `corepack yarn quality:typecheck:scripts`
  - 成功
- `LAB_CORE_HOST_PROJECT_ROOT="$PWD" LAB_CORE_HOST_UID="$(id -u)" LAB_CORE_HOST_GID="$(id -g)" LAB_CORE_DOCKER_SOCKET_GID="$(stat -c %g /var/run/docker.sock)" docker compose -f infra/compose/docker-compose.dev.yml config`
  - `backend` / `dashboard` に `user: 1000:1000` が入り、`backend` に `group_add: "984"` が入ることを確認
- `LAB_CORE_HOST_PROJECT_ROOT="$PWD" LAB_CORE_HOST_UID="$(id -u)" LAB_CORE_HOST_GID="$(id -g)" LAB_CORE_DOCKER_SOCKET_GID="$(stat -c %g /var/run/docker.sock)" docker compose -f infra/compose/docker-compose.dev.yml run --rm --no-deps dashboard sh -lc 'id && corepack yarn workspace @lab-core/dashboard build && stat -c "%u:%g %n" core/dashboard/dist core/dashboard/tsconfig.tsbuildinfo'`
  - `uid=1000(node) gid=1000(node)` で実行され、`core/dashboard/dist` と `core/dashboard/tsconfig.tsbuildinfo` が `1000:1000` で生成されることを確認
- `LAB_CORE_HOST_PROJECT_ROOT="$PWD" LAB_CORE_HOST_UID="$(id -u)" LAB_CORE_HOST_GID="$(id -g)" LAB_CORE_DOCKER_SOCKET_GID="$(stat -c %g /var/run/docker.sock)" docker compose -f infra/compose/docker-compose.dev.yml run --rm --no-deps backend sh -lc 'id && stat -c "%A %u:%g %n" /var/run/docker.sock && corepack yarn workspace @lab-core/backend build && stat -c "%u:%g %n" core/backend/dist'`
  - `uid=1000(node) gid=1000(node) groups=984,1000(node)` で実行され、Docker ソケットを読み書き可能なまま `core/backend/dist` が `1000:1000` で生成されることを確認

## 補足

- 既存の `root` 所有ファイルは今回の設定変更だけでは所有者が変わらないため、検証前に `core/backend/dist` / `core/dashboard/dist` / `core/dashboard/tsconfig.tsbuildinfo` を一度ホストユーザーへ戻してから再ビルドした。
