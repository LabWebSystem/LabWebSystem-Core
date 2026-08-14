# LabWebSystem Core 開発・検証・デプロイ体制仕様書

## 1. 目的

LabWebSystem Core の開発、テスト、システム検証、デプロイを目的中心に整理し、フィードバックサイクルを短縮する。従来の環境プロファイル選択と状態依存の操作体系は廃止し、開発者は `mise run <task>` で目的だけを指定する。

## 2. 基本原則

- リポジトリ全体の開発者向け入口は `mise` に統一する。
- Yarn、Docker Compose、Vite、Node.js、内部スクリプトはタスクの実装詳細とする。
- `mock`、`local`、`lab` の環境プロファイルを公開概念として持たない。
- タスクは必要な設定、DB、secret 相当値、ネットワーク、生成物を自動的に決定する。
- UI 開発で DNS / reverse proxy を起動せず、backend 単体開発で dashboard を必須にしない。
- Local Development、Container Verification、System Verification、Deploy は別の保証として扱う。

## 3. 公開タスク

| タスク | 動作 |
| --- | --- |
| `mise run dev` | dashboard の Vite HMR と backend の watch プロセスを起動する。開発用 DB と runtime は自動生成する。 |
| `mise run dashboard` | dashboard だけを Vite 開発サーバーで起動する。backend を必要としない画面は fixture / mock API を利用できる。 |
| `mise run backend` | backend だけを watch モードで起動し、API を localhost へ直接公開する。dashboard、DNS、proxy は起動しない。 |
| `mise run test` | typecheck、unit、backend API、component、軽量 integration を Docker なしで実行する。 |
| `mise run test:container` | Docker image build、container 起動、health check、HTTP smoke test、停止、cleanup を独立して実行する。 |
| `mise run test:system` | DNS、reverse proxy、network、dashboard、backend を含む一時環境を create → start → test → destroy の順で検証する。 |
| `mise run deploy --version vX.Y.Z` | 指定したRelease tagを作成・pushし、GitHub ActionsのRelease入口へ渡す。既存tag / Releaseは確認後に再作成できる。開発用 `.env` は使用しない。 |
| `mise run stop` | 開発プロセスと検証用 Compose を停止する。 |
| `mise run clean` | 開発用 DB、runtime、タスク状態などの生成物を削除する。 |

## 4. テスト保証の分離

### 4.1 Local Development

ソースコードの変更を最短で確認する。dashboard は Vite HMR、backend は `tsx watch` を使用する。開発時に Docker image の再構築を要求してはならない。

### 4.2 Container Verification

Production Dockerfile を用いて image を生成し、Linux runtime、依存関係、filesystem、permission、user、environment injection、port、startup、graceful shutdown、healthcheck を検証する。開発用プロセスを流用せず、テスト終了時にコンテナと一時データを破棄する。

### 4.3 System Verification

Client → DNS → Reverse Proxy → Dashboard / Backend → Database / Network の経路を、既存の開発状態から独立した Compose 環境で検証する。hostname routing、proxy header、port binding、dashboard ↔ backend 通信、healthcheck、認証を含む system smoke test を対象とする。

## 5. 設定管理

設定は次の3種類に分ける。

- 自動決定: localhost bind、開発 port、Compose project / network 名、一時 DB、内部 URL、healthcheck URL。
- システム管理: session / JWT secret、DB URL、runtime secret、certificate。development / test は自動生成し、Production は deployment infrastructure が提供する。
- ユーザー指定: Production root domain、外部 OAuth / API / SMTP credential など、システムが推測できない値だけを最小限入力する。

リポジトリに `current profile` や前回生成設定を開発状態として保存しない。同じ revision で同じ task を実行した場合、原則として同じ構成を生成する。

## 6. Yarn、Docker、CI の責務

Yarn は依存関係、workspace、package-local の `build` / `test` / `lint` / `typecheck` に限定する。repository-wide の起動、環境選択、設定生成、破壊的 cleanup は Yarn の公開責務から削除する。

Docker は Container Verification、System Verification、Production Artifact を担当し、高速な通常開発の必須条件にしない。

CI は通常テスト、Docker build、container smoke を自動実行し、変更範囲に応じて dashboard、backend、shared / SDK、infra の検証を追加する。最適化によって必要な品質保証を省略してはならない。

## 7. バージョン正本

リポジトリのバージョン正本はルートの `VERSION` とする。現在値は `0.1.0`、Release tag と表示上の表記は `v0.1.0` に統一する。package、SDK、OpenAPI、runtime example、Release metadata の製品バージョンも同じ値を使用する。

## 8. 削除した公開概念

次の公開操作は廃止する。

```text
yarn launcher
yarn config:set / config:show / config:edit
yarn system:*
yarn environment:*
yarn service:*
yarn quality:*
yarn destroy:*
mock / local / lab の事前選択
```

これらの旧入口に依存する後方互換性は維持しない。必要な内部処理は `mise` タスクの実装へ直接移す。

## 9. 完成条件

- 新規 clone 後、profile 選択や手動設定なしで `mise run dev` を開始できる。
- dashboard の変更が Docker 再buildなしで反映される。
- backend の変更が watch により高速に再起動される。
- `mise run test` が Docker 全体を起動せずに完了する。
- `mise run test:container` が Docker runtime 固有の問題を検出する。
- `mise run test:system` が独立環境を生成し、DNS / proxy を含めて検証後に破棄する。
- CI が通常テスト、Docker build、container verification を実行する。
- `mise run deploy --version vX.Y.Z` が Release の標準入口となる。
- repository-wide の Yarn 操作と profile 選択が通常の開発フローから消えている。
