# 実装計画

1. `launcher` の TUI 構成と既存の `config` 実装を調査し、差し込みやすい拡張ポイントを特定する。
2. `core/backend/.env` を参照して監視対象 URL を組み立てるロジックを `launcher` に追加する。
3. HTTP ベースの死活チェックと `/api/system/status` 要約表示を追加し、自動更新と手動更新の両方を実装する。
4. 既存の `config` 導線を `config:set` / `config:show` / `config:edit` に再構成し、TTY の有無やファイル未作成時の扱いも整理する。
5. README と利用ガイドを更新し、型検証・コマンド検証・疑似TTYでの画面確認を行う。
