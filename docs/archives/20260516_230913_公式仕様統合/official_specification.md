# Lab-Core 正式仕様書（現行実装準拠）

作成日: 2026-05-16  
対象リポジトリ: `lab-core`

## 1. 本仕様書の位置づけ
- 本書は Lab-Core の**現行実装**を正として記述した公式仕様である。
- 既存 docs 内で記述が競合する場合は、以下の優先順位で採用する。
  1. 実装コード
  2. 更新日時が新しいドキュメント
  3. それ以外は参考情報（非正規）
- 作業ログ（task/implementation_plan/walkthrough）や単発バグ修正履歴は、仕様本文に含めない。

## 2. システム構成
- `core/backend`
  - Hono + TypeScript + SQLite
  - API、ジョブ、イベント、DNS/Proxy同期生成を担当
- `core/dashboard`
  - React + Vite
  - 運用 UI（ホーム/一覧/登録/詳細）を担当
- `infra/compose`
  - `docker-compose.dev.yml`（backend/dashboard）
  - `docker-compose.proxy.yml`（proxy）
  - `docker-compose.dns.yml`（dns）
- `scripts`
  - 起動・設定・保守・テスト導線

## 3. 公開コマンド体系（現行）
ルート `package.json` で公開される運用コマンドは以下。

- `launcher`
  - コマンドツリーUIランチャー
- `config`
  - `.env` 未存在: 初期作成
  - `.env` 存在: 確認後に再作成
- `destroy`
  - 環境クリーン（確認付き破壊的操作）
- `environment:dev:up` / `environment:dev:down` / `environment:dev:logs`
  - 開発向け一括起動・停止・ログ
- `environment:lab:up` / `environment:lab:down` / `environment:lab:logs`
  - 研究室運用向け一括起動・停止・ログ
- `service:backend:up` / `service:dashboard:up`
  - 個別サービス起動
- `quality:build`
  - backend/dashboard ビルド
- `quality:typecheck:scripts`
  - scripts の型検証
- `quality:test:fixtures`
  - 登録テストデータ投入
- `quality:test:smoke`
  - スモークテスト実行

## 4. 設定仕様（`.env`）
### 4.1 生成方法
- 標準は `yarn config` を使用する。
- 設定ウィザードは `local` / `lab` / `vm` / `custom` を選択可能。
- ウィザードで主に入力対象とするのは次の3項目。
  - `LAB_CORE_MAIN_SERVICE_IP`
  - `LAB_CORE_SSH_SERVICE_IP`
  - `LAB_CORE_ROOT_DOMAIN`
- それ以外はプロファイル既定値を適用する。

### 4.2 主要環境変数
- 実行制御
  - `LAB_CORE_EXECUTION_MODE` (`dry-run` / `execute`)
- パス
  - `LAB_CORE_DB_PATH`
  - `LAB_CORE_APPS_ROOT`
  - `LAB_CORE_APPDATA_ROOT`
  - `LAB_CORE_PROXY_CONFIG_PATH`
  - `LAB_CORE_DNS_HOSTS_PATH`
  - `LAB_CORE_SYNC_DIR`
- ネットワーク
  - `LAB_CORE_MAIN_SERVICE_IP`
  - `LAB_CORE_SSH_SERVICE_IP`
  - `LAB_CORE_ROOT_DOMAIN`
  - `LAB_CORE_DNS_BIND_HOST`
  - `LAB_CORE_DNS_PORT`
  - `LAB_CORE_DNS_UPSTREAMS`

### 4.3 互換変換
backend 側で旧パス定義（`/opt/lab-core/...`）の互換変換を持つ。

## 5. 実行モード
- `dry-run`
  - Docker/Git の実処理をスキップ
  - ジョブ進行・状態遷移・UI導線を確認
  - ログAPIはイベント由来の疑似ログを返す
- `execute`
  - Docker/Git を実行
  - 実コンテナ起動、実ログ取得、更新/ロールバック実処理を行う

## 6. データモデル（SQLite）
主要テーブル:
- `applications`
- `deployments`
- `routes`
- `container_instances`
- `jobs`
- `system_events`
- `update_info`

## 7. API仕様（主要）
### 7.1 システム
- `GET /health`
- `GET /api`
- `GET /api/system/status`

### 7.2 アプリケーション
- `GET /api/applications`
- `POST /api/applications/import/resolve`
- `POST /api/applications/import/compose-inspect`
- `POST /api/applications`
- `GET /api/applications/:applicationId`
- `POST /api/applications/:applicationId/deployment/inspect`
- `PATCH /api/applications/:applicationId/deployment`
- `POST /api/applications/:applicationId/restart`
- `POST /api/applications/:applicationId/stop`
- `POST /api/applications/:applicationId/resume`
- `POST /api/applications/:applicationId/rebuild`
- `POST /api/applications/:applicationId/update-check`
- `POST /api/applications/:applicationId/update`
- `POST /api/applications/:applicationId/rollback`
- `DELETE /api/applications/:applicationId`

### 7.3 観測・補助
- `GET /api/jobs`
- `GET /api/events`
- `POST /api/infrastructure/sync`
- `GET /api/logs/:applicationId/services`
- `GET /api/logs/:applicationId?service=&tail=`
- `GET /api/testing/registration-fixtures`

## 8. ジョブと状態遷移
### 8.1 ジョブ種別
`deploy`, `restart`, `stop`, `resume`, `rebuild`, `update`, `rollback`, `delete`（他内部種別あり）

### 8.2 ジョブ状態
`queued` → `running` → `succeeded | failed`

### 8.3 アプリ状態（主要）
`Build Pending`, `Cloning`, `Deploying`, `Running`, `Stopped`, `Failed`, `Rebuilding`, `Deleting`

### 8.4 重要挙動
- 登録時は deploy ジョブを起動。
- `stop` は `deployments.enabled` / `routes.enabled` を無効化し、状態を `Stopped` にする。
- `resume` は `enabled` を再有効化して再配備する。
- `rollback` は `previous_commit` がない場合拒否（400）。
- `delete` は mode に応じて設定/ソース/データを削除。

## 9. Dashboard仕様
### 9.1 画面構成
- `ホーム`
- `アプリ一覧`
- `アプリ登録`
- `アプリ詳細`

### 9.2 主操作
- 登録ウィザード（GitHub URL解析、compose候補選択、サービス選択、登録）
- デプロイ設定編集（compose path / service / port / hostname / keepData / envOverrides）
- 運用操作（停止/再開/再起動/再ビルド/更新確認/更新適用/ロールバック）
- ログ閲覧（サービス選択、tail切替、自動スクロール、手動更新）
- 削除（mode選択 + 確認名入力）

### 9.3 自動更新
- 全体状態: 15秒周期
- 詳細状態: 10秒周期
- ログ表示中: 5秒周期

## 10. DNS/Proxy 同期仕様
- 同期API: `POST /api/infrastructure/sync`
- 出力ファイル:
  - `LAB_CORE_PROXY_CONFIG_PATH`（Caddyfile）
  - `LAB_CORE_SYNC_DIR/Caddyfile.dev`
  - `LAB_CORE_DNS_HOSTS_PATH`（hosts形式）
- DNS生成ルール:
  - `dashboard.<rootDomain>` → `LAB_CORE_MAIN_SERVICE_IP`
  - `api.<rootDomain>` → `LAB_CORE_MAIN_SERVICE_IP`
  - `ssh.<rootDomain>` → `LAB_CORE_SSH_SERVICE_IP`
  - route host → `LAB_CORE_MAIN_SERVICE_IP`

## 11. 現行の標準運用手順
### 11.1 初回
1. `yarn install`
2. `yarn config`
3. 開発用途: `yarn environment:dev:up`
4. 研究室用途: `yarn environment:lab:up`

### 11.2 停止とログ
- 停止:
  - 開発: `yarn environment:dev:down`
  - 研究室: `yarn environment:lab:down`
- ログ:
  - 開発: `yarn environment:dev:logs`
  - 研究室: `yarn environment:lab:logs`

### 11.3 品質確認
- `yarn quality:build`
- `yarn quality:typecheck:scripts`
- `yarn quality:test:fixtures`
- `yarn quality:test:smoke`

### 11.4 破壊的初期化
- `yarn destroy`
  - 実行前に対象プレビューと確認ダイアログを表示
  - `.env` は保持

## 12. 既知の実装注意点（2026-05-16時点）
- 設定ウィザード内部メッセージに旧コマンド例（`yarn dev`, `yarn lab:up`）が残存している。
- `quality:test:smoke` で呼ばれる `scripts/testing/run_full_system_smoke_test.sh` は旧コマンド `yarn dev:backend` を参照しており、現行 scripts 名と不一致。
- したがって smoke 実行導線は、現行コマンド体系へ合わせた修正が別途必要。

## 13. 非正規文書の扱い
- `docs` 配下の過去 `task.md` / `implementation_plan.md` / `walkthrough.md` は履歴資料として扱う。
- 現行仕様の参照元は本書を優先し、運用判断は実装コードを最終正とする。
