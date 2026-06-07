# 確認結果: SSH / docs/readmes / SDKドキュメント改善計画

作成日: 2026-06-07

## 要点
- `ssh.fukaya-sus.lab` 用の仕組みは、実装上すでに半分できています。
- 先に DNS 名を安定化し、その後に必要なら IP 統合する二段階方式が最も安全です。
- `docs/readmes` は今のまま文書を増やすより、責務分離と命名規則を先に定義した方が保守しやすいです。
- SDK ドキュメントは「概要」と「仕様」を分けると、利用者と保守者の両方が読みやすくなります。

## 調査で確認したこと

### 1. SSH / DNS まわり
- `core/backend/src/lib/env.ts` に `LAB_CORE_SSH_SERVICE_IP` があり、SSH 用 IP を設定できる。
- `core/backend/src/services/infrastructure-sync.ts` では DNS hosts 生成時に `ssh.<rootDomain>` を出力している。
- つまり、実装追加より先に「運用設定と DNS 導線の整理」で解決できる可能性が高い。

### 2. docs/readmes の現状
- `docs/readmes` には現状 2 ファイルしかない。
- `how_to_use_lab_core.md` は現行運用手順。
- `開発前使用提案書.md` は提案書色が強く、現行 README 群と同列に置くには役割が異なる。
- `docs/README.md` と root `README.md` に、現ディレクトリ構成と一致しない参照パスが残っている。

### 3. SDK の現状
- `sdk/README.md` に GitHub 経由の library 導入例がある。
- `sdk/packages/sdk/src/index.ts` で公開 API が整理されている。
- `sdk/packages/sdk-contract` に manifest / profile / export schema がある。
- `sdk/packages/sdk-cli/src/main.ts` に CLI 一覧がまとまっている。
- `sdk/packages/sdk-cli/src/commands/init.ts` から、SDK が生成する雛形ファイル群を確認できた。

## 推奨結論

### SSH
- まず `ssh.fukaya-sus.lab` を現行 IP に向けて使えるようにする。
- そのうえで、`192.168.40.225` が本当にセキュリティ境界として機能しているかを確認する。
- 単なる別名 IP なら `192.168.40.224` へ統合し、セキュリティは `sshd` 設定と firewall で担保する。

### docs/readmes
- `current` と `draft` を混在させない。
- ファイル名は ASCII に揃える。
- 役割ごとに文書を分け、`docs/readmes/README.md` を入口にする。

### SDK ドキュメント
- `sdk_overview.md` と `sdk_reference.md` の 2 本立てがよい。
- overview では「プラグイン方式」「SDK の役割」「導入フロー」を説明する。
- reference では「schema」「CLI」「library API」「CI」を仕様として整理する。

## 次にやるとよいこと
1. 実運用 `.env` の `LAB_CORE_SSH_SERVICE_IP` とクライアント DNS 参照先を確認する。
2. `docs/readmes` の再編対象一覧を作る。
3. SDK 文書の初版を `overview` と `reference` で起草する。
4. 参照切れしている README リンクをまとめて修正する。
