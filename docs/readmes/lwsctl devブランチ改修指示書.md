# lwsctl devブランチ改修指示書

文書ステータス: current

対象: `LabWebSystem/LabWebSystem-CTL` の `dev` ブランチ

## 目的

`lwsctl`を、LabWebSystem Core Releaseの標準手順を自動化するだけの薄いCLIへ統一する。Coreの本番構成はGitHub Releaseの`compose.yaml`が唯一の正本であり、lwsctlはCoreの内部API、DB、独自のCompose定義、`config.yaml`へ依存してはならない。

この指示書の正本となるCore契約は`LabWebSystem Coreデプロイ仕様書.md`である。

## 完成条件

`lwsctl install --primary-domain example.com`は、Core Releaseの`release.json`と`compose.yaml`を取得・検証し、次の2ファイルだけを生成してからComposeを実行する。

```text
/etc/labwebsystem/
├── compose.yaml
└── runtime.env

/var/lib/labwebsystem/
└── persistent data
```

生成する`runtime.env`は次の4項目だけとする。

```dotenv
LWS_VERSION=1.2.3
LWS_PRIMARY_DOMAIN=example.com
LWS_INSTALLATION_ID=<lwsctlが一度だけ生成する安定ID>
LWS_DATA_DIR=/var/lib/labwebsystem
```

実行する本番操作は次だけである。

```bash
docker compose -f /etc/labwebsystem/compose.yaml \
  --env-file /etc/labwebsystem/runtime.env pull
docker compose -f /etc/labwebsystem/compose.yaml \
  --env-file /etc/labwebsystem/runtime.env up -d --wait --wait-timeout 180
```

`--wait`のDocker healthcheck結果を正常性判定に使う。Coreの内部状態解析、DB migration判断、backup、rollback、SSH deployは実装しない。

## 現状との差分

現行devの`internal/model/release.go`と`internal/releaseclient/client.go`は、`manifestVersion`、`version`、`minimumLwsctlVersion`、`artifacts.compose.{name,sha256}`を読むため、Coreの最小manifestと整合している。この2箇所の責務は広げない。

一方、以下は旧契約なので削除または置換する。

| 現行箇所 | 旧動作 | 改修後 |
| --- | --- | --- |
| `internal/lifecycle/service.go` | `config.yaml`を生成 | 生成しない |
| `RuntimeEnv` | `LAB_CORE_*`を出力 | `LWS_*`の4項目を出力 |
| `Config` / `ConfigYAML` | `network`、`persistentRoot`を管理 | 削除。installに必要なのはprimary domainのみ |
| `internal/state/paths.go` | `ConfigFile()`を持つ | 削除 |
| `internal/cli/run.go` | `--network`を受理 | 削除 |
| `Update` | runtime.env全体を旧形式で再生成 | 既存設定を保ち`LWS_VERSION`だけを更新 |

## 実装指示

### 1. runtime.envを唯一のホスト設定にする

`internal/lifecycle/service.go`の`Config`は`PrimaryDomain string`だけに縮小する。`ConfigYAML`と`Paths.ConfigFile()`を削除し、install時に`config.yaml`を作らない。

`RuntimeEnv`は、version、installation ID、primary domain、data rootから上記4行を生成する。値に改行を含めないことを検証し、primary domainは空文字を拒否する。`LWS_DATA_DIR`には`state.Paths.DataRoot`をそのまま使用する。

`internal/cli/run.go`では`--network`と関連変数を削除する。`install`時の`--primary-domain`は必須にする。標準以外の`--config-dir`と`--data-dir`を使用する場合も、同じ2ファイル／同じ4項目の構成を保つ。

### 2. updateで利用者設定を維持する

`update`は新しい`compose.yaml`を配置し、`runtime.env`の`LWS_VERSION`だけをReleaseのversionへ更新する。`LWS_PRIMARY_DOMAIN`、`LWS_INSTALLATION_ID`、`LWS_DATA_DIR`、コメント、将来追加される利用者設定を失ってはならない。

小さなdotenv更新関数を用意し、以下を守る。

- `LWS_VERSION`があればその行だけ置換する。
- なければ末尾に追加する。
- 同じキーが複数ある壊れたファイルはエラーにする。
- install時のみ4項目を新規作成する。
- `rebuild`、`start`、`stop`、`status`はruntime.envを書き換えない。

更新処理中にCompose起動が失敗した場合、installation metadataのversionを更新しない。既存実装どおり、`pull`成功後に`up -d --wait`を実行し、両方が成功してからversionを保存する。

### 3. Composeの責務を複製しない

image名、port、network、volume、restart policy、service依存、healthcheckをlwsctlへ移さない。lwsctlがReleaseから配置した`compose.yaml`を`docker compose -f ... --env-file ...`でそのまま実行するだけにする。

`internal/docker/compose.go`の`Pull`、`Up`、`Stop`、`Down`、`PS`はこの方針に合っている。Composeコマンドの前に`-f`と`--env-file`を渡す現行順序も維持する。

### 4. Release検証を最小契約へ固定する

Release manifestの許可フィールドは以下だけとする。image、schema、migration、rollback、architecture別情報を要求・解釈してはならない。

```json
{
  "manifestVersion": 1,
  "version": "1.2.3",
  "minimumLwsctlVersion": "0.1.0",
  "artifacts": {
    "compose": { "name": "compose.yaml", "sha256": "<64桁hex>" }
  }
}
```

GitHub Release tagの`v`を除いた値と`version`が一致すること、Compose asset名がbasenameであること、SHA-256が一致すること、minimum lwsctl versionを満たすことは維持する。既存Releaseの上書きや同一versionの再publishはlwsctlの責務ではない。

## コマンド別の期待結果

| コマンド | 期待結果 |
| --- | --- |
| `install` | Release取得・検証、compose.yamlと新規runtime.envを配置、`pull`、`up -d --wait`、installation metadata保存 |
| `update` | 指定version（省略時latest）のRelease取得・検証、compose.yaml置換、runtime.envの`LWS_VERSION`だけ更新、`pull`、`up -d --wait`、metadata更新 |
| `rebuild` | インストール済みversionのReleaseを再取得してcompose.yamlを再配置し、runtime.envを変えずに`pull`と`up -d --wait` |
| `start` / `stop` / `status` | 配置済みcompose.yamlとruntime.envだけを使う |
| `uninstall` | 通常はComposeを停止し`/etc/labwebsystem`を削除して永続データを残す。`--purge --yes`だけが`/var/lib/labwebsystem`も削除する |

## テスト指示

`go test ./...`に加え、少なくとも次をテストする。

1. 最小manifestを取得し、`compose.yaml`のchecksumを検証できる。
2. installが`config.yaml`を作らず、4項目だけのruntime.envを作る。
3. `--primary-domain`なしのinstallは使用方法エラーになる。
4. updateがprimary domain、installation ID、data dir、コメントを保持し、`LWS_VERSION`だけ置換する。
5. updateのCompose失敗時はinstallation metadataのversionが変わらない。
6. rebuild/start/stop/statusがruntime.envを変更しない。
7. Compose fake runnerが`-f <compose> --env-file <runtime.env> pull`と`up -d --wait --wait-timeout 180`を受け取る。
8. `uninstall`と`uninstall --purge --yes`の永続データ削除境界を確認する。

実DockerのE2Eでは、amd64またはarm64の任意のLinux hostでinstall、update、rebuildを実行し、`docker compose ps`がhealthyになることを確認する。ホストへNode.js、Yarn、npm、Git、build toolchainを導入せずに通ること。

## 禁止事項

- `config.yaml`、Caddyfile、独自Compose、Backend API、Backend DBへの依存を復活させない。
- Backend/Dashboardごとの設定値をlwsctlのCLI flagや設定ファイルへ増やさない。
- Core image tagやCompose構成をlwsctl側で組み立てない。
- migration、rollback、backup、release再publish、GHCR package visibility、production hostへのSSH deployを追加しない。

## 完了時の確認

```bash
mise install
mise exec -- gofmt -w ./cmd ./internal
mise exec -- go test ./...
mise exec -- go vet ./...
mise exec -- go build ./cmd/lwsctl
```

実装時にはCTLリポジトリ側のMemADR運用にも従い、旧config.yaml契約を無効化した判断を記録すること。
