# SDK概要

対象読者:
- LabWebSystem 適合アプリを新規作成する開発者
- 既存リポジトリを LabWebSystem に統合したい開発者

文書ステータス:
- current

最終更新日:
- 2026-06-07

## 1. SDK の位置づけ
SDK は、LabWebSystem に安全に登録できるアプリリポジトリを作るための TypeScript ライブラリ兼 CLI です。  
単なる schema 検証だけでなく、compose 分離、same-origin、`APPDATA_ROOT`、`hostname` といった運用上の落とし穴も確認できる入口として使います。

## 2. SDK でできること
- LabWebSystem 適合リポジトリのひな形生成
- manifest / profile / compose の整合性検査
- 開発用と本番用の compose / env 分離
- 登録用 payload の生成
- seed / CI / repo ローカル scripts の導線生成

## 3. 導入方法
最初のひな形作成:

```bash
yarn dlx -p @lab-core/sdk-cli@https://github.com/LabWebSystem/LabWebSystem-Core.git#workspace=@lab-core/sdk-cli&head=main labcore init --template standard
```

継続利用する場合:

```bash
yarn add -D @lab-core/sdk-cli@https://github.com/LabWebSystem/LabWebSystem-Core.git#workspace=@lab-core/sdk-cli&head=main
```

library API を使う場合だけ `@lab-core/sdk` を追加します。

```bash
yarn add @lab-core/sdk@https://github.com/LabWebSystem/LabWebSystem-Core.git#workspace=@lab-core/sdk&head=main
```

## 4. `init` で生成される主なもの
- `labcore.app.yaml`
- `labcore/profiles/dev-sim.yaml`
- `labcore/profiles/dev-real-device.yaml`
- `labcore/profiles/prod.yaml`
- `labcore/SDK使い方.md`
- `package.json` の `labcore:lint` / `labcore:preflight` / `labcore:guard` / `labcore:export`

初期値の方針:
- `hostname` は `*.lab.localhost`
- 配備用 compose は `docker-compose.yml`
- localhost 用 compose は `docker-compose.dev.yml`
- `prod` profile は配備用 compose だけを使う

## 5. 基本フロー
1. `labcore init` でひな形を作る
2. `labcore.app.yaml` の `repository.url` と `hostname` を実アプリ向けに直す
3. `docker-compose.yml` と `docker-compose.dev.yml` を実装に合わせる
4. `yarn labcore:lint`
5. `yarn labcore:preflight`
6. `yarn labcore:guard`
7. `yarn labcore:export`
8. ダッシュボードで登録する

## 6. `lint` / `doctor` が見ること
- `exposure.service` と compose の一致
- `exposure.port` と listen ポートの一致
- 必須 env の不足
- デバイス要件の不足
- 配備用 compose に `ports:` が残っていないか
- runtime 設定に `localhost` が残っていないか
- `APPDATA_ROOT` が未使用ではないか
- `prod` profile に `LABCORE_DEVICE_MODE=real` があるか
- `hostname` が `*.lab.localhost` のままではないか

## 7. 関連資料
- `docs/readmes/適合アプリ作成ガイド.md`
- `docs/readmes/LabWebSystem適合アプリ構成図.md`
- `docs/readmes/登録前チェックリスト.md`
- `docs/readmes/SDK仕様書.md`
