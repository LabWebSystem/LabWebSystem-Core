# 修正内容の確認

作成日: 2026-06-07

## 実施したこと

### 1. docs 運用ルール
- `AGENTS.md` に次のルールを追加した。
  - 現行説明書は `docs/readmes`
  - 一時ログは `docs/logs`
  - logs の統合要約は `docs/summarys`
  - 統合前ログと旧版資料は `docs/archives`
  - 草案は `docs/temps`
  - `docs/readmes` のファイル名は日本語

### 2. readmes 再編
- `docs/readmes/how_to_use_lab_core.md` を `docs/readmes/Lab-Core運用手順書.md` へ移動。
- `docs/readmes/開発前使用提案書.md` を `docs/temps/開発前使用提案書.md` へ移動。
- 新規追加:
  - `docs/readmes/説明書一覧.md`
  - `docs/readmes/適合アプリ作成ガイド.md`
  - `docs/readmes/SDK概要.md`
  - `docs/readmes/SDK仕様書.md`
  - `docs/temps/草案一覧.md`
  - `docs/summarys/要約一覧.md`

### 3. SSH 統合の repo 側反映
- `core/backend/.env` の `LAB_CORE_SSH_SERVICE_IP` を `192.168.40.224` に変更。
- `core/backend/.env.example` の研究室向け例を 224 統合後の値へ更新。
- `core/backend/src/lib/env.ts` の既定値を `192.168.40.224` に変更。
- `scripts/config/env-wizard.ts` の `lab` / `vm` 初期値を `192.168.40.224` に変更。
- 研究室向けの `LAB_CORE_MAIN_SERVICE_IP` 既定値も `192.168.40.224` に揃えた。

## live 反映の状況
- `sshd` は確認時点で `192.168.40.225:22` のみ待受。
- backend の `/api/system/status` でも `sshServiceIp` は `192.168.40.225` のまま。
- 原因:
  - `sshd` 設定変更と再読込には sudo 権限が必要
  - 稼働中 backend の再起動権限も不足している

## 確認結果
- `yarn quality:typecheck:scripts`
  - 失敗
  - `tsconfig.scripts.json` が見つからない既存導線不整合
- `yarn quality:build`
  - 失敗
  - `core/dashboard/node_modules/.vite-temp` への書き込み権限不足
- `ss -tlnp`
  - `192.168.40.225:22` で `sshd` 待受中
- `GET /api/system/status`
  - `mainServiceIp=192.168.40.224`
  - `sshServiceIp=192.168.40.225`

## 未完了
1. live の `sshd` を `192.168.40.224` でも待受させること
2. `ssh.fukaya-sus.lab` の live 生成値を backend 再起動後に 224 へ揃えること
3. 数日安定運用後に 225 待受を削除すること
