# Lab-Core SDK 技術設計書

作成日: 2026-05-16
対象: Lab-Core 向けアプリ開発者および Lab-Core 保守者

## 1. 背景と目的
Lab-Core は DB やメッセージ基盤を提供しない「純粋なコンテナ配信プラットフォーム」である。
このため、配信対象アプリは以下を自前で満たす必要がある。
1. 単体で起動できる
2. 単体で最低限のテストができる
3. デバイス依存がある場合でも、開発時に擬似構成で検証できる

本 SDK は「Lab-Core 適合アプリの作成難易度を下げる」ことに加え、「開発構成と本番構成の安全な切り分け」を標準機能として提供する。

## 2. スコープ
### 2.1 in-scope
1. アプリ適合契約の定義（manifest + profile）
2. compose 解析と登録前バリデーション
3. ローカル preflight（起動・再起動・ログ・停止）
4. dev-sim / prod の構成分離
5. デバイスモック・テストデータ導入の枠組み
6. CI テンプレートの提供
7. Lab-Core 登録用 payload のエクスポート

### 2.2 out-of-scope
1. アプリ固有ビジネスロジックのテスト実装
2. 本番データバックアップ製品の提供
3. Kubernetes など別基盤への抽象化

## 3. 必要な機能

### 3.1 機能要件（FR）
FR-01: Manifest 契約定義
- `labcore.app.yaml` で登録必須項目を管理する。
- `name/repository/compose/exposure/hostname/device/env` を型保証する。

FR-02: Profile 合成
- `dev-sim`, `dev-real-device`, `prod` を profile として定義する。
- manifest + profile から最終 compose/env/device 要件を合成する。

FR-03: Compose Inspect
- 現行 core の compose 解析と同等ロジックで以下を抽出する。
- サービス候補
- 公開ポート候補
- 必須/任意環境変数
- デバイス要件候補

FR-04: Lint
- 適合判定を登録前にローカルで実施する。
- `publicServiceName` 未存在
- 必須 env 未設定
- composePath 不整合
- hostname 不正
- device 要件不一致

FR-05: Preflight
- 以下の運用互換コマンドを実行確認する。
- `docker compose config --services`
- `docker compose up -d --build --remove-orphans`
- `docker compose restart`
- `docker compose logs --no-color --tail`
- `docker compose down --remove-orphans`

FR-06: Dev/Prod Guard
- `labcore guard prod` を提供する。
- mock 設定混入検知
- dev override 混入検知
- prod 必須 env 未設定検知
- prod profile での deviceRequirements 整合検知

FR-07: Device Adapter Scaffold
- デバイス依存アプリ向けに `real/mock` アダプタ雛形を生成する。
- アプリ側で `LABCORE_DEVICE_MODE=real|mock` を安全に切替可能にする。

FR-08: Seed 管理
- `labcore seed apply` でテストデータ投入
- `labcore seed verify` で投入後検証
- `labcore seed reset` で再現可能な状態へ初期化

FR-09: Export
- Lab-Core 登録 API 用 payload を profile から生成する。
- `repositoryUrl/defaultBranch/composePath/publicServiceName/publicPort/hostname/mode/keepVolumesOnRebuild/deviceRequirements/envOverrides`

FR-10: CI テンプレート
- `dev-sim` と `prod` の二段階ジョブを自動生成する。

### 3.2 非機能要件（NFR）
NFR-01: core と判定差異を最小化する（判定差異ゼロを目標）
NFR-02: 主要コマンドは 5 分以内で完了（標準 web app 構成）
NFR-03: 同一入力で同一出力（再現性）
NFR-04: 失敗理由を機械可読 JSON でも出力可能
NFR-05: Node.js 22 LTS で動作

## 4. SDK に使用する言語・フレームワーク

### 4.1 言語
1. TypeScript 6.x
2. Node.js 22.x (LTS)

### 4.2 パッケージ管理とツール管理
1. Yarn 4（workspace 構成）
2. mise（Node/Yarn のバージョン固定）

### 4.3 主要ライブラリ
1. CLI: `commander` + `@inquirer/prompts`
2. Schema Validation: `zod`
3. YAML: `yaml`
4. Process 実行: Node.js `child_process` ベースの共通ラッパ
5. テスト: `node:test` + `assert/strict`

### 4.4 採用理由
1. 既存 core/backend が TypeScript + Node + yaml で実装されており、コード共有や移植が容易
2. Yarn workspace と相性が良く、monorepo 内で SDK と core の整合テストを運用しやすい
3. node:test は依存を増やしすぎず、CI 実行が軽量

## 5. 具体的なディレクトリ/ファイル構成

```text
lab-core/
├── .mise.toml
├── package.json
├── sdk/
│   ├── package.json
│   ├── tsconfig.base.json
│   ├── packages/
│   │   ├── sdk-contract/
│   │   │   ├── package.json
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── manifest-schema.ts
│   │   │   │   ├── profile-schema.ts
│   │   │   │   └── export-schema.ts
│   │   │   └── README.md
│   │   ├── sdk-inspect/
│   │   │   ├── package.json
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── compose-inspector.ts
│   │   │   │   └── env-detector.ts
│   │   │   └── README.md
│   │   ├── sdk-profile/
│   │   │   ├── package.json
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── merge-profile.ts
│   │   │   │   ├── guard-prod.ts
│   │   │   │   └── resolve-device-mode.ts
│   │   │   └── README.md
│   │   ├── sdk-seed/
│   │   │   ├── package.json
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── seed-apply.ts
│   │   │   │   ├── seed-verify.ts
│   │   │   │   └── seed-reset.ts
│   │   │   └── README.md
│   │   ├── sdk-ci/
│   │   │   ├── package.json
│   │   │   ├── templates/
│   │   │   │   └── github-actions-labcore.yml
│   │   │   └── README.md
│   │   └── sdk-cli/
│   │       ├── package.json
│   │       ├── bin/
│   │       │   └── labcore.js
│   │       ├── src/
│   │       │   ├── main.ts
│   │       │   ├── commands/
│   │       │   │   ├── init.ts
│   │       │   │   ├── inspect.ts
│   │       │   │   ├── lint.ts
│   │       │   │   ├── preflight.ts
│   │       │   │   ├── seed.ts
│   │       │   │   ├── export.ts
│   │       │   │   ├── guard.ts
│   │       │   │   └── doctor.ts
│   │       │   ├── presenters/
│   │       │   │   ├── human.ts
│   │       │   │   └── json.ts
│   │       │   └── shared/
│   │       │       ├── command-runner.ts
│   │       │       └── error-codes.ts
│   │       └── README.md
│   ├── templates/
│   │   ├── app-standard/
│   │   ├── app-headless/
│   │   └── app-device/
│   ├── fixtures/
│   │   ├── compose/
│   │   └── manifests/
│   └── docs/
│       ├── migration-guide.md
│       └── compatibility-matrix.md
└── core/
    └── backend/
```

## 6. 設計詳細

### 6.1 Manifest 例
```yaml
schemaVersion: 1
app:
  name: oruca-web
repository:
  url: https://github.com/example/oruca.git
  defaultBranch: main
deployment:
  composePath: docker-compose.yml
  mode: standard
  keepVolumesOnRebuild: true
exposure:
  service: web
  port: 8080
  hostname: oruca.fukaya-sus.lab
devices:
  required:
    - /dev/bus/usb
env:
  required:
    - ADMIN_FIXED_PASSWORD
  defaults:
    LOG_LEVEL: info
profiles:
  default: dev-sim
```

### 6.2 Profile 例（dev-sim）
```yaml
profile: dev-sim
overrides:
  env:
    LABCORE_DEVICE_MODE: mock
  composeFiles:
    - docker-compose.yml
    - docker-compose.dev.yml
  deviceRequirements: []
  guard:
    allowMock: true
```

### 6.3 Profile 例（prod）
```yaml
profile: prod
overrides:
  env:
    LABCORE_DEVICE_MODE: real
  composeFiles:
    - docker-compose.yml
    - docker-compose.prod.yml
  guard:
    allowMock: false
    requireDevicePaths:
      - /dev/bus/usb
```

### 6.4 CLI コマンド仕様
1. `labcore init --template standard|headless|device`
2. `labcore inspect --profile <name>`
3. `labcore lint --profile <name> [--format human|json]`
4. `labcore preflight --profile <name> [--tail 200]`
5. `labcore seed apply|verify|reset --profile <name>`
6. `labcore export --profile prod --out build/labcore-payload.json`
7. `labcore guard prod`
8. `labcore doctor`

## 7. 使用方法（ユースケース）

### 7.1 ユースケースA: 新規 Web アプリを作る
1. `labcore init --template standard`
2. `labcore inspect --profile dev-sim`
3. `labcore lint --profile dev-sim`
4. `labcore preflight --profile dev-sim`
5. `labcore export --profile prod`
6. `labcore guard prod`

### 7.2 ユースケースB: NFC/USB デバイス必須アプリを作る
1. `labcore init --template device`
2. `labcore seed apply --profile dev-sim`
3. `labcore preflight --profile dev-sim`（mock モード）
4. 実機接続後 `labcore preflight --profile dev-real-device`
5. `labcore guard prod`

### 7.3 ユースケースC: 既存リポジトリを Lab-Core 対応へ移行
1. `labcore init --template standard --existing`
2. 既存 compose から manifest を生成
3. `labcore inspect` と `labcore lint` で不足項目を修正
4. `labcore export --profile prod` で登録 payload を出力

### 7.4 ユースケースD: CI で適合性を自動判定
1. `sdk-ci` テンプレートを導入
2. PR で `lint + preflight(dev-sim)` を実行
3. main マージ前に `guard prod + export` を実行
4. 成功時のみ「Lab-Core compatible」判定

## 8. SDK の保守方法（core 修正時）

### 8.1 基本方針
- core と SDK の仕様差分を「テストで検知する」運用にする。
- 手動読み合わせのみでの同期は行わない。

### 8.2 互換性維持の仕組み
1. 契約スナップショット
- core 側の入力契約（create/update schema）を JSON スナップショット化
- SDK 側 `sdk-contract` と毎 CI で比較

2. 解析ロジック比較テスト
- core の `compose-inspection` 用フィクスチャを SDK でも実行
- 抽出結果（service/port/env/device）が一致するかを golden test 化

3. E2E 擬似登録テスト
- SDK `export` 出力を core の `POST /api/applications` 互換スキーマへ検証
- 実サーバー起動または schema-only モードで互換テスト

4. 変更検知トリガ
- `core/backend/src/routes/applications.ts`
- `core/backend/src/services/compose-inspection.ts`
- `core/backend/src/services/application-jobs.ts`
- 上記が変更された PR では SDK 互換ジョブを必須実行

### 8.3 バージョニング方針
1. SDK は SemVer 運用
2. core 互換レンジを `compatibility-matrix.md` に明示
3. 破壊的変更時は以下を同時実施
- core: 変更点ドキュメント化
- sdk: major/minor 更新
- migration-guide 更新

### 8.4 リリース運用
1. `main` へのマージ後に nightly 互換テスト
2. 互換テスト green のみ SDK リリース候補作成
3. リリースノートに「対応 core commit/タグ」を明記

### 8.5 保守当番と責務
1. core 変更者: SDK 互換チェックの実行責任を持つ
2. SDK 保守者: 互換失敗時の修正と matrix 更新責任を持つ
3. レビュー時チェック項目
- schema 差分の反映有無
- guard prod の検知漏れ有無
- dev-sim で再現可能か

## 9. 導入ロードマップ
1. Phase 1 (MVP)
- `sdk-contract`, `sdk-inspect`, `sdk-cli(lint/preflight/export)`

2. Phase 2
- `sdk-profile`, `guard prod`, `sdk-ci`

3. Phase 3
- `sdk-device-adapter`, `sdk-seed`, 既存リポジトリ移行支援

4. Phase 4
- core との双方向互換テスト自動化の完成

## 10. 受け入れ基準
1. SDK 生成テンプレから作成したアプリが `labcore preflight --profile dev-sim` を通る
2. `labcore guard prod` が dev 設定混入を検知できる
3. `labcore export --profile prod` 出力が core 登録スキーマに一致する
4. core の compose-inspection テストフィクスチャに対し SDK 判定が一致する
