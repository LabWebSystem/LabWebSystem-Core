# 実装計画

作成日: 2026-06-07

## 方針
1. runtime 上の clone と実行中コンテナを見て、`allowedHosts` がどこで失われているか確認する。
2. 必要なら sample repo 側の Dockerfile / Vite 設定を修正する。
3. Lab-Core の 1 公開サービス前提に合わせ、フロントから API へ same-origin で到達できるかも合わせて確認する。
4. 再配備またはコンテナ内再ビルドで動作確認し、ログを残す。
