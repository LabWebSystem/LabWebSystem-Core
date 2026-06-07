# 実装計画: SSH / docs/readmes / SDKドキュメント改善

作成日: 2026-06-07

## 0. 前提整理
- backend にはすでに `LAB_CORE_SSH_SERVICE_IP` があり、DNS hosts 生成時に `ssh.<rootDomain>` を出力する実装が存在する。
- 現行 docs は「正式仕様」「運用手順」「履歴資料」「草案」が混在しており、参照導線にも古いパスが残っている。
- SDK はすでに monorepo として実装済みで、CLI・library API・manifest/profile schema・seed/CI 導線が揃っている。

## 1. SSH を `ssh.fukaya-sus.lab` で使えるようにする計画

### 推奨方針
最初の一歩は「IP を変えず、名前だけ安定化する」です。  
その後、分離 IP の意義が firewall / ACL 上で薄いことを確認できたら、`192.168.40.224` へ統合する二段階移行を推奨します。

### Phase 1: DNS 別名化
1. 実運用 `.env` の `LAB_CORE_SSH_SERVICE_IP` を現行 SSH 待受 IP に合わせる。
2. `POST /api/infrastructure/sync` もしくは既存同期導線で `ssh.fukaya-sus.lab` を生成させる。
3. クライアントが Lab-Core の DNS を参照していることを確認する。
4. `ssh user@ssh.fukaya-sus.lab` の疎通確認を行う。

### Phase 2: `192.168.40.224` への統合可否判定
統合してよい条件:
- `192.168.40.225` が別 VLAN / 別 NIC / 別 firewall policy の要ではない
- SSH の安全性を「IP 分離」ではなく「sshd 設定 + firewall 制御」で確保できる
- `dashboard/api` と同居しても運用監視・切り分けが複雑化しない

統合時の推奨セキュリティ対策:
- `PasswordAuthentication no`
- `PubkeyAuthentication yes`
- `PermitRootLogin no` もしくは `prohibit-password`
- `AllowUsers` または `AllowGroups` で管理対象を限定
- `192.168.40.0/24` など研究室セグメントからのみに TCP/22 を許可
- 必要なら fail2ban または接続回数制限を追加

### Phase 3: 224 へ統合する移行手順
1. `sshd` を `192.168.40.224` でも待受させる。
2. 一時的に `224` と `225` の両方で接続可能にする。
3. `ssh.fukaya-sus.lab` の向き先を `224` に変更する。
4. 既存運用端末で host key 警告が出ないことを確認する。
5. firewall / 監視 / 手順書を更新する。
6. 数日運用で問題なければ `225` の待受と DNS 設定を削除する。

### 判断メモ
- 同一ホスト上の SSH に専用 IP を割り当てること自体は可能だが、強いセキュリティ境界にはなりにくい。
- 本当に効く境界は「ネットワークセグメント分離」か「firewall 制御」なので、`225` が単なる別名 IP なら統合メリットの方が大きい。
- 逆に `225` が別経路や別機器に依存しているなら、無理に統合せず `ssh.fukaya-sus.lab -> 225` のまま安定運用するほうが安全。

## 2. `docs/readmes` を統一する計画

### 現状課題
- `docs/readmes` に現行運用文書と提案書が混在している。
- `docs/README.md` と root `README.md` に古い参照パスが残っている。
- 日本語ファイル名と英語ファイル名、履歴資料と現行資料の境界が曖昧。

### 推奨構成
`docs/readmes` は「今読むべき現行文書」だけを置く。

配置案:
- `docs/readmes/README.md`
- `docs/readmes/operations_guide.md`
- `docs/readmes/app_repository_guide.md`
- `docs/readmes/sdk_overview.md`
- `docs/readmes/sdk_reference.md`

履歴・草案の扱い:
- 提案段階の資料は `docs/archives` へ移す
- 作業ログは引き続き `docs/logs` に保存する
- 正式仕様は `docs/specs` のような専用置き場へ将来分離してもよい

### 命名規則
- ファイル名は ASCII の `snake_case` または `kebab-case` に統一する
- 文書タイトルは日本語でよい
- 1ファイル1責務にする
- 「how_to_use」「proposal」のような曖昧名は避け、役割で命名する

### 文書テンプレート
各文書の先頭に最低限以下を持たせる:
- タイトル
- 対象読者
- 文書ステータス（current / draft / archived）
- 最終更新日
- 正本の位置づけ
- 関連文書

本文構成の標準:
1. 目的
2. 対象読者
3. 前提条件
4. 手順または仕様
5. 確認方法
6. トラブルシュート / 注意点
7. 関連資料

### 実施順
1. `docs/readmes` の責務を README で定義する
2. 現行文書を `current / draft / archive` に分類する
3. ファイル名を統一し、古い参照リンクを修正する
4. markdownlint / prettier などの整形ルールを追加する
5. 以後の文書追加は同テンプレート準拠にする

## 3. SDK 仕様・使用方法ドキュメントを追加する計画

### 推奨方針
SDK 文書は 1 ファイルに全部詰めるより、以下の 2 層に分けるのが読みやすいです。

1. `sdk_overview.md`
   - 何のための SDK か
   - Lab-Core のプラグイン方式とリポジトリ契約
   - 最短導入手順
   - 典型的な開発フロー
2. `sdk_reference.md`
   - manifest / profile schema
   - CLI コマンド仕様
   - library API
   - seed / CI / 互換性注意点

### `sdk_overview.md` に入れる内容
1. Lab-Core は「所定ルールに従う GitHub リポジトリを Web アプリとして登録する」プラットフォームであること
2. 各アプリは plugin 的に独立したリポジトリとして管理されること
3. SDK の役割
   - 雛形生成
   - 適合性チェック
   - profile ごとの安全な構成分離
   - 登録用 payload 生成
4. 想定フロー
   - `init`
   - `lint`
   - `preflight`
   - `guard prod`
   - `export`
   - Lab-Core へ登録
5. 導入方法
   - まずは現行 README にある Git URL + workspace 指定を正本として記載する
   - `github:` 形式を公式記載したい場合は、Yarn 4 で `workspace=@lab-core/sdk` 付き導入が安定再現するかを先に検証する

### `sdk_reference.md` に入れる内容
1. 生成される標準ファイル
   - `labcore.app.yaml`
   - `labcore/profiles/dev-sim.yaml`
   - `labcore/profiles/dev-real-device.yaml`
   - `labcore/profiles/prod.yaml`
   - `labcore/seeds/apply.sh`
   - `labcore/seeds/verify.sh`
   - `labcore/seeds/reset.sh`
2. `labcore.app.yaml` の schema
   - `schemaVersion`
   - `app`
   - `repository`
   - `deployment`
   - `exposure`
   - `devices`
   - `env`
   - `profiles`
3. profile schema
   - `profile`
   - `overrides.env`
   - `overrides.composeFiles`
   - `overrides.deviceRequirements`
   - `overrides.guard`
4. CLI コマンド仕様
   - `init`
   - `inspect`
   - `lint`
   - `preflight`
   - `seed`
   - `export`
   - `guard prod`
   - `doctor`
   - `ci-install`
5. library API
   - `loadSdkContext`
   - `inspectSdk`
   - `lintSdk`
   - `guardProdSdk`
   - `exportSdkPayload`
   - `runSdkSeed`
6. CI 連携
   - `labcore-sdk-check` workflow の使い方
7. よくある失敗
   - compose service 名不一致
   - exposure port 不一致
   - 必須 env 未設定
   - deviceRequirements 不足

### 作成順
1. `sdk_overview.md` を先に作る
2. `sdk_reference.md` で schema / CLI / API を整理する
3. `docs/readmes/README.md` から両方へ導線を張る
4. root `README.md` と `sdk/README.md` からもリンクする

## 4. 全体の実施優先順位
1. `ssh.fukaya-sus.lab` の名前解決だけ先に通す
2. `docs/readmes` の責務と命名規則を確定する
3. SDK overview / reference を追加する
4. 参照切れを直し、README 導線を一本化する
5. その後に 224 への SSH 統合を段階移行する
