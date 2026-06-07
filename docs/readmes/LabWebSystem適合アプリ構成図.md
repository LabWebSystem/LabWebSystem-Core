# LabWebSystem適合アプリ構成図

対象読者:
- LabWebSystem 適合アプリの開発者

文書ステータス:
- current

最終更新日:
- 2026-06-07

## 1. 全体像
```text
Browser
  |
  | https://<hostname>
  v
Reverse Proxy
  |
  | route by hostname
  v
web service (compose service: web)
  |
  | same-origin /api/*
  v
api service (compose service: api)
  |
  | read/write
  v
APPDATA_ROOT -> LAB_CORE_APPDATA_ROOT/<app-name>

Git clone path -> LAB_CORE_APPS_ROOT/<app-name>
Root domain  -> LAB_CORE_ROOT_DOMAIN
Hostname     -> app.<LAB_CORE_ROOT_DOMAIN>
```

## 2. 各要素の意味
- `hostname`
  - reverse proxy がアプリを識別する入口です
- `web service`
  - manifest の `exposure.service` に一致する公開対象サービスです
- `api service`
  - `web` から内部ネットワークで参照される API です
- `APPDATA_ROOT`
  - アプリの永続データを `LAB_CORE_APPDATA_ROOT` 配下へ出すための bind mount 入口です
- `LAB_CORE_APPS_ROOT`
  - GitHub から clone されたアプリソースの保存先です
- `LAB_CORE_APPDATA_ROOT`
  - アプリごとの永続データの保存先です
- `LAB_CORE_ROOT_DOMAIN`
  - 管理下の既定ドメインです

## 3. 開発時と配備時の違い
### 3.1 localhost 開発
- `hostname` は `*.lab.localhost`
- `docker-compose.dev.yml` で `ports:` を追加公開
- `APPDATA_ROOT=./.appdata/<app-name>`

### 3.2 LabWebSystem 配備
- `hostname` は `app.<LAB_CORE_ROOT_DOMAIN>`
- 配備用 compose は `ports:` を持たない
- `APPDATA_ROOT=../../appdata/<app-name>`

## 4. よくある勘違い
- ブラウザから見える `localhost` はサーバーではなく利用者端末です
- `web` と `api` は同じ compose 内でも、ブラウザからは別サービス名で直接見えません
- `hostname` は単なる飾りではなく reverse proxy の実ルーティングキーです
