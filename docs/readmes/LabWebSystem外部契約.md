# LabWebSystem 外部契約

LabWebSystem全体の導入・停止・起動・更新・再生成を担うCTLは、Backend APIやBackend内部DBを参照しません。CTLとCoreの接点は、Release artifact、Production Compose、runtime.env、Docker healthcheckです。

## Production配置

Productionでは、ホスト上のLabWebSystem-Core repository、Node.js、Yarn、Gitを必要としません。

```text
/etc/labwebsystem/
  compose.yaml
  runtime.env

/var/lib/labwebsystem/
  database/
  apps/<application-id>/
  appdata/<application-id>/
```

Production用のComposeとOCI imageは、`infra/compose/compose.yaml`、`Dockerfile.backend`、`Dockerfile.dashboard`で定義します。GitHub Releaseには`release.json`と`compose.yaml`だけを含めます。起動時にbuildやrepositoryのbind mountは行いません。

## runtime.env

ホスト固有設定の正本は `/etc/labwebsystem/runtime.env` です。

```dotenv
LWS_VERSION=1.2.3
LWS_PRIMARY_DOMAIN=example.com
LWS_INSTALLATION_ID=<stable-installation-id>
LWS_DATA_DIR=/var/lib/labwebsystem
```

ComposeがこれらをBackend環境変数、image tag、永続データのbind mountへ変換します。Backend/Dashboardごとの個別設定はありません。

## Health

`/health/live` はプロセスの生存、`/health/ready` はDBと必須filesystemを含む起動準備状態を返します。CTLが利用する状態はHTTP statusと `ok` / `ready` の真偽だけです。

## Release manifest

`release.json`にはmanifest version、Core version、最低lwsctl version、`compose.yaml`の名前とSHA-256だけを記録します。OCI image、migration、DB schema、architecture別情報は含めません。
