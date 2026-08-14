# docs 入口

## まず読む場所
- 説明書一覧: `docs/readmes/説明書一覧.md`
- 開発・検証・デプロイ体制: `docs/readmes/LabWebSystem Core 開発・検証・デプロイ体制仕様書.md`
- Coreデプロイ仕様: `docs/readmes/LabWebSystem Coreデプロイ仕様書.md`
- 正式仕様（現行実装準拠）: `docs/archives/20260516_230913_公式仕様統合/official_specification.md`

## フォルダの役割
- `docs/readmes`
  - ユーザーが読む現行説明書を置く場所
  - ファイル名は日本語で統一
- `docs/logs`
  - 単発作業の `task.md` / `implementation_plan.md` / `walkthrough.md` を置く場所
- `docs/summarys`
  - `docs/logs` を定期統合した要約を置く場所
- `docs/archives`
  - 統合前ログや旧版資料を保管する場所
- `docs/temps`
  - 草案や未確定メモを置く場所

## 運用ルール
- 仕様判断・運用判断は実装コードと正式仕様を優先してください。
- `docs/logs` が肥大化したら、内容を `docs/summarys` に要約し、元ログは `docs/archives` へ移動します。
- 草案を現行説明書と同じ階層へ置かないでください。
