# 回答言語およびプロジェクトドキュメント保存ルール

## 基本方針

- 特に指示がない限り、日本語で回答する。
- 以下のドキュメントも日本語で作成する：
    - 実装計画 (Implementation Plan)
    - 修正内容の確認 (Walkthrough)
    - タスクリスト (Task List)
- nodeのパッケージインストーラーには**yarn（latest）**を使用する。
- ツールのバージョン管理には**mise**を使用する。
- コミットメッセージの生成と、適切な粒度・適切なタイミングでのgitコミットも行って。
    - 小さな修正で毎回コミットするのは禁止

## ファイル構成

- チャット内で作成した以下の3つのファイルを保存する：
    - `task.md`
    - `implementation_plan.md`
    - `walkthrough.md`

## 保存場所

- プロジェクト内の `docs/logs` フォルダの下に新しいフォルダを作成する。
- フォルダ名：**作成日時+短いトピック名**

## ドキュメント配置ルール

- ユーザーが説明書として本当に読むべき現行文書は `docs/readmes` に置く。
- `docs/readmes` に置くファイル名は日本語で統一する。
- 一時的な作業記録や単発作業の `task.md` / `implementation_plan.md` / `walkthrough.md` は `docs/logs` に置く。
- `docs/logs` が肥大化してきたら、定期的に内容を統合して `docs/summarys` に要約を作成する。
- 要約へ統合する前の元ログは `docs/archives` へ移動する。
- 草案・検討中メモ・未確定文書は `docs/temps` に置く。

## UI デザイン参照ルール

- ダッシュボード UI を追加・修正する前に、必ず `docs/readmes/ダッシュボードUIデザインルール.md` を確認する。
- `core/dashboard/src/components` / `core/dashboard/src/views` / `core/dashboard/src/styles.css` を編集するときは、このルール文書に沿って見た目を合わせる。
- 新しい UI パターンを追加して既存ルールでは不足する場合は、実装だけで済ませず `docs/readmes/ダッシュボードUIデザインルール.md` も更新する。
