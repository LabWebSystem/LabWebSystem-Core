# 修正内容の確認

## 実施内容

- `infra/compose/Dockerfile.dev-node-tools` を追加し、`git`, `docker-cli`, `python3`, `make`, `g++` を含む開発用共通イメージを導入した
- `infra/compose/docker-compose.dev.yml` の `deps`, `backend`, `dashboard` をこの共通イメージ利用へ切り替え、起動時の `apk add` を除去した
- `scripts/dev/sync-workspace-deps.mjs` を追加し、依存定義ハッシュと `node_modules/.yarn-state.yml` を見て、変更時だけ `yarn install --immutable` を走らせるようにした
- `scripts/dev/root-command.ts` の `coreUp()` を `docker compose up -d --force-recreate backend dashboard` に変更し、`lab:up` で最新ソースが必ず起動へ反映されるようにした

## 検証結果

- `node scripts/dev/sync-workspace-deps.mjs`
  - 1回目: 依存同期を実行
  - 2回目: `package manifests unchanged; skipping yarn install`
- `time corepack yarn environment:lab:up`
  - 初回: 約 1分49秒
    - 初回 dev イメージ build と volume 側の初回 `yarn install` が走るため重い
  - 2回目: 約 20秒
    - 依存同期はスキップ
    - backend / dashboard の再作成と起動時ビルドのみ実行

## 補足

- 現在の主な待ち時間は backend の TypeScript ビルドと dashboard の Vite build で、これは「本番と同じ配信方式」を維持するために意図的に残している
- `docker compose` 実行時に orphan container 警告が出るが、今回の高速化変更とは独立した既存課題
