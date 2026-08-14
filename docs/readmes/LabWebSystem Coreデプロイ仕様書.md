# LabWebSystem Core デプロイ仕様書

文書ステータス: current

## 目的

LabWebSystem Coreは、`lwsctl`がなくてもGitHub ReleaseとDocker Composeだけでインストール、起動、更新、再生成できる自己完結した製品とする。`lwsctl`はこの標準手順を自動化する薄い管理CLIであり、別のデプロイ方式を持たない。

## 配布とRelease

配布単位は常に`LabWebSystem Core vX.Y.Z`の一つである。`vX.Y.Z`のGit tagだけをversionの正本とし、GitHub Actionsはそのtagから以下を公開する。

- `ghcr.io/labwebsystem/backend:X.Y.Z`（linux/amd64, linux/arm64）
- `ghcr.io/labwebsystem/dashboard:X.Y.Z`（linux/amd64, linux/arm64）
- GitHub Release asset: `release.json`, `compose.yaml`

`release.json`は次だけを持つ。

```json
{
  "manifestVersion": 1,
  "version": "0.1.0",
  "minimumLwsctlVersion": "0.1.0",
  "artifacts": {
    "compose": { "name": "compose.yaml", "sha256": "..." }
  }
}
```

image情報、DB schema、migration、rollback、Application情報、architecture別情報はmanifestに含めない。Compose、Core、Dockerの責務として扱う。Release workflowはtag以外を入口にせず、既存Releaseの上書き・同一versionの再publish・package visibility変更・production hostへのdeployを行わない。

## Production runtime

`compose.yaml`が本番ランタイム構成の唯一の正本である。Core service、OCI image、network、永続データのmount、restart policy、依存関係、healthcheckはここで定義し、lwsctlやGitHub Actionsは重複して管理しない。

ホスト上の配置は次のとおりとする。

```text
/etc/labwebsystem/
├── compose.yaml
└── runtime.env

/var/lib/labwebsystem/
├── database/
├── apps/
├── appdata/
└── generated/
```

container、image、network、Composeファイルは再生成可能であり、DBと利用者データはReleaseから独立する。

## 設定と手動操作

設定は`runtime.env`へ集約する。

```dotenv
LWS_VERSION=0.1.0
LWS_PRIMARY_DOMAIN=example.com
LWS_INSTALLATION_ID=<stable-installation-id>
LWS_DATA_DIR=/var/lib/labwebsystem
```

手動インストールはReleaseから`compose.yaml`を取得してこのファイルを作成した後、次の操作だけで完了する。ホストにNode.js、Yarn、npm、Git、build toolchainは要求しない。

```bash
mkdir -p /etc/labwebsystem
cd /etc/labwebsystem
docker compose --env-file runtime.env pull
docker compose --env-file runtime.env up -d
docker compose ps
```

更新時は新Releaseの`compose.yaml`を取得し、`LWS_VERSION`を更新して同じ`pull`と`up -d`を実行する。runtime破損時も、Releaseを再取得して同じ手順で再生成する。

## Health

ComposeはDocker healthcheckでCoreを監視する。Backendは`/health/live`と`/health/ready`を公開し、利用者とlwsctlはready / not readyだけを判断する。DB migrationなどの起動準備はCore内部の責務とする。

Backendのreadinessに必要な`dataDirectory`、`appsRoot`、`appDataRoot`、`generatedSyncDir`は、すべて`/var/lib/labwebsystem`配下の永続ディレクトリへ割り当てる。Composeはこれらのサブディレクトリを個別にbind mountするため、初回起動時も各パスが存在し、読み書き可能になる。
