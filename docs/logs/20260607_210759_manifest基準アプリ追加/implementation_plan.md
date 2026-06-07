# 実装計画

1. backend に `labcore.app.yaml` 専用の検出・schema 検証ロジックを追加する。
2. `POST /api/applications/import/resolve` を manifest 前提へ切り替え、候補 compose を `labcore.app.yaml` の `deployment.composePath` のみに絞る。
3. アプリ登録時も manifest の存在と `deployment.composePath` を検証し、UI 以外の経路でも逸脱できないようにする。
4. dashboard のアプリ追加 UI を manifest 確認中心の導線へ変更し、manifest の値でフォームを初期化する。
5. manifest の `env` / `devices` 情報も登録画面に反映し、compose 解析結果と合わせて確認できるようにする。
6. build とテストを実行して結果を記録する。
