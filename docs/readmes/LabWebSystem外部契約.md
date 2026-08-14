# LabWebSystem 外部契約

LabWebSystem全体の導入・停止・起動・更新・復旧を担うCTLは、Backend APIやBackend内部DBを参照しません。CTLとCoreの接点は、Release artifact、Production Compose、Docker labels、filesystem、config、health、recovery descriptorです。

## Production配置

Productionでは、ホスト上のLabWebSystem-Core repository、Node.js、Yarn、Gitを必要としません。

```text
/etc/labwebsystem/
  config.yaml
  compose.yaml
  runtime.env

/var/lib/labwebsystem/
  database/
  apps/<application-id>/
  appdata/<application-id>/
  state/
  releases/
  backups/
  cache/
```

Production用のComposeとOCI imageは、`infra/compose/compose.production.yml`、`Dockerfile.backend`、`Dockerfile.dashboard`をRelease artifactへ含めます。起動時にbuildやrepositoryのbind mountは行いません。

## Config

利用者向け設定の正本は `/etc/labwebsystem/config.yaml` です。

```yaml
configSchemaVersion: 1
installationId: <lwsctlが生成したID>
primaryDomain: example.labwebsystem.local
dataDirectory: /var/lib/labwebsystem
```

Backendはこの設定からdatabase、apps、appdata、生成状態の配置を解決します。`runtime.env`はCTLがCompose向けに生成する補助ファイルであり、利用者向け設定の別の正本ではありません。

## Docker labels

Coreが管理するcontainer、network、volumeには、次のnamespaceを付与します。

```text
com.labwebsystem.managed=true
com.labwebsystem.installation-id=<installation-id>
com.labwebsystem.role=<backend|dashboard|proxy|application|network|volume>
com.labwebsystem.version=<release-version>
```

Application resourceには、さらに `com.labwebsystem.application-id=<application-id>` を付与します。CTLはこれらのlabelsだけで、他のDocker projectと区別して管理対象を検出します。

## Health

`/health/live` はプロセスの生存、`/health/ready` はDBと必須filesystemを含む起動準備状態を返します。CTLが利用する状態はHTTP statusと `ok` / `ready` の真偽だけです。

## Recovery descriptor

BackendはApplicationのruntime composeを準備した際、`/var/lib/labwebsystem/apps/<application-id>/state.json`（開発環境では設定されたapps root配下）を更新します。このdescriptorには、DBのtable構造ではなく、復旧に必要なapplication ID、repository、compose project、runtime、appdata、Docker labelsだけを保存します。Application削除が完了した場合はdescriptorも削除します。

## Release manifest

`release.json`には、LabWebSystem、Config、Database、Recovery descriptor、manifestのschema version、OCI image参照、Compose artifact、migration情報を記録します。インストール済みversionの正本はこのmanifestであり、Backend APIではありません。
