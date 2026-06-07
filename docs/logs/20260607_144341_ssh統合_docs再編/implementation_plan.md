# 実装計画

作成日: 2026-06-07

## 1. SSH 統合
1. `LAB_CORE_SSH_SERVICE_IP` を `192.168.40.224` へ変更する。
2. 将来の再生成で 225 へ戻らないよう、既定値と設定ウィザードの研究室向け初期値を 224 に揃える。
3. 可能であれば live の `sshd` 待受と backend の現在反映値も 224 に切り替える。
4. 権限不足で live 変更ができない場合は、repo 側反映と未完了点を分離して記録する。

## 2. docs 再編
1. `AGENTS.md` に新しい docs 配置ルールを追加する。
2. `docs/readmes` を「現行の説明書だけ置く場所」として再編する。
3. `docs/temps` と `docs/summarys` を新設する。
4. `docs/readmes` 内ファイル名を日本語へ揃える。
5. root `README.md` と `docs/README.md` の導線を修正する。

## 3. readmes の中身
1. 既存の運用手順書を日本語ファイル名へ移動する。
2. 旧 `開発前使用提案書.md` は草案として `docs/temps` へ移動する。
3. 適合アプリ作成ガイドを `docs/readmes` へ昇格する。
4. SDK 概要と SDK 仕様書を新規作成する。

## 4. 確認
1. リンク切れと古いパス参照を検索する。
2. `yarn quality:typecheck:scripts` と `yarn quality:build` を試行する。
3. live の `sshd` と backend 状態を確認し、反映可否を記録する。
