# 調査報告: Lab-Core 適合アプリ作成の最低限ルールと理想SDK構成

## 1. 結論サマリ
- 現行実装での適合条件は、**GitHub URL正規化 + compose解析 + 公開サービス整合 + 必須環境変数充足 + Docker Compose運用互換**です。
- 難しさの主因は、開発者が `composePath / publicServiceName / publicPort / envOverrides / deviceRequirements` を手作業で整合させる必要がある点です。
- SDKは「テンプレ生成」だけでは不十分で、**登録前の静的検証（lint/inspect）と実行検証（preflight）**まで一体化する構成が理想です。

## 2. 現行実装でアプリ作成に最低限必要なもの・ルール

### 2.1 受け入れ入力契約（登録API）
- 登録時に以下が必須です。
  - `name`, `repositoryUrl`, `defaultBranch`, `composePath`, `publicServiceName`, `publicPort`, `hostname`
  - `mode`, `keepVolumesOnRebuild`, `deviceRequirements`, `envOverrides` は既定値あり
- バリデーション制約:
  - `publicPort`: 1-65535 の整数
  - `hostname`: `^[a-z0-9.-]+$`
  - `name`: 2-80 文字
- 参照:
  - `core/backend/src/routes/applications.ts` の `createApplicationSchema`

### 2.2 GitHubリポジトリ要件
- インポートURLは GitHub ドメインのみ受理されます（`github.com`, `www.github.com`）。
- URLは最終的に `https://github.com/<owner>/<repo>.git` に正規化されます。
- tree URL の場合はブランチ候補解決処理が入ります。
- 参照:
  - `core/backend/src/routes/applications.ts` の `parseGithubImportSource`, `normalizeCreateImportInput`

### 2.3 composeファイル要件
- `composePath` はリポジトリ内に存在し、YAMLとして解釈可能である必要があります。
- 選択した `publicServiceName` が compose 内 `services` に存在しないと登録不可です。
- `composePath` と実際の選択結果が一致しない場合もエラーになります。
- 参照:
  - `core/backend/src/services/compose-inspection.ts` の `validateComposeServiceSelection`
  - `core/backend/src/routes/applications.ts` の `inspectComposeFromRepository`

### 2.4 環境変数要件
- compose の `${VAR}` / `environment` を解析し、必須扱いの変数が抽出されます。
- 必須変数が `envOverrides` で埋まっていないと登録不可です。
- 参照:
  - `core/backend/src/services/compose-inspection.ts` の `collectEnvironmentRequirementCandidates`, `validateEnvironmentOverrides`

### 2.5 実行時運用互換（Docker Composeコマンド）
- 運用中に最低限必要な互換:
  - `docker compose ... up -d --build --remove-orphans`
  - `docker compose ... restart`
  - `docker compose ... down [--remove-orphans] [-v]`
  - `docker compose ... logs --no-color --tail`
  - `docker compose ... config --services`
- これらが失敗すると、再起動/更新/削除/ログ取得が破綻します。
- 参照:
  - `core/backend/src/services/application-jobs.ts`
  - `core/backend/src/services/application-logs.ts`

### 2.6 ログ要件
- ダッシュボードのログ表示は `docker compose logs` に依存します。
- 実質的に、アプリは stdout/stderr にログを出す必要があります（ファイルのみ出力は不利）。
- 参照:
  - `core/backend/src/services/application-logs.ts`

### 2.7 データ保持・デバイス要件
- `keepVolumesOnRebuild` により `down -v` の有無が切り替わります。
- `deviceRequirements` は登録データとして保持され、compose からのデバイス候補検出も実装済みです。
- 参照:
  - `core/backend/src/services/application-jobs.ts`
  - `core/backend/src/services/compose-inspection.ts`

## 3. なぜ適合アプリ作成が難しいか（SDK化すべきポイント）
- URL/branch/compose/service/port/env の整合を手作業で合わせる必要がある
- compose の書き方（short/long syntax, テンプレート変数）差分で判定が揺れる
- 「登録が通る」だけでなく、更新・ロールバック・削除までの運用互換を最初から満たす必要がある
- 開発者が backend 実装詳細を読まないと失敗原因を特定しづらい

## 4. 理想的なSDK構成

### 4.1 設計原則
- 1回のコマンドで「ひな形生成→静的検証→実行検証」まで完結
- Lab-Core backend と同等の判定ロジックをSDK側で再利用または共有
- 生成物よりも「失敗しない登録契約」を中心に据える

### 4.2 推奨モジュール構成
1. `@lab-core/sdk-contract`
- `labcore.app.yaml`（または `labcore.app.json`）の型・スキーマ定義
- 項目例:
  - `name`, `repository.url`, `repository.branch`
  - `compose.path`, `exposure.service`, `exposure.port`, `hostname`
  - `env.required`, `env.defaults`, `devices`, `rebuild.keepVolumes`

2. `@lab-core/sdk-inspect`
- 現行 `compose-inspection` 相当の解析API
- サービス候補、ポート候補、必須env、デバイス候補を機械抽出

3. `@lab-core/sdk-cli`
- `labcore init`: テンプレ生成（web/api/headless/device）
- `labcore inspect`: compose解析結果表示
- `labcore lint`: 契約検証（登録前失敗を検出）
- `labcore preflight`: `docker compose config/up/logs/restart/down` のローカル検証
- `labcore export`: 登録API向け payload 生成

4. `@lab-core/sdk-ci`（GitHub Actions テンプレ）
- PR時に `labcore lint && labcore preflight` 実行
- 成功時のみ「Lab-Core適合」バッジ付与

### 4.3 生成される最小ファイルセット
- `docker-compose.yml`
- `Dockerfile`
- `.dockerignore`
- `.env.example`
- `labcore.app.yaml`（SDK専用マニフェスト）
- `README.md`（Lab-Core登録手順を自動埋め込み）

### 4.4 CLIの理想UX
- `labcore doctor` で不足を一覧化
  - `publicServiceName` 不一致
  - `publicPort` 未検出
  - 必須 env 未設定
  - ログ出力未確認
- エラーメッセージは backend の文言に寄せ、登録時の差分をなくす

### 4.5 backend との接続方針
- 最短は `sdk-inspect` で `compose-inspection.ts` を共有ライブラリ化
- 次点は SDK 側で同等ロジックを持ち、互換テストでズレを監視
- 可能なら `POST /api/applications/import/compose-inspect` をSDKから直接叩く「リモート検証モード」も提供

## 5. 実装優先度（提案）
1. まず `sdk-cli lint/preflight` を先行実装（失敗削減効果が大きい）
2. 次に `sdk-contract + manifest` を導入（設定の明示化）
3. 最後に `init テンプレ` と `CIバッジ` を整備（新規開発者導線の最適化）

## 6. 参照した主な実装
- `core/backend/src/routes/applications.ts`
- `core/backend/src/services/compose-inspection.ts`
- `core/backend/src/services/application-jobs.ts`
- `core/backend/src/services/application-logs.ts`
- `core/dashboard/src/App.tsx`
- `docs/20260516_230913_公式仕様統合/official_specification.md`
- `docs/archive~20260516/lab_core_app_repository_guide/app_repository_creation_guide.md`
