# タスクリスト

## 依頼内容
- 設計書に従って `LabCore-SDK_v0.0.1` を `sdk/` 配下に実装する。

## 実施タスク
1. SDK モノレポ構成（workspace / package）を作成
2. contract / inspect / profile / seed / ci / cli の各パッケージを実装
3. CLI コマンド（init/inspect/lint/preflight/seed/export/guard/doctor/ci-install）を実装
4. root package から `yarn labcore` で実行できる導線を追加
5. ビルド・テスト・実行スモークを実施

## 完了条件
- `sdk/` 以下に v0.0.1 実装が存在する
- `yarn sdk:build` と `yarn sdk:test` が成功する
- CLI の基本導線（init/inspect/lint/export）が動作確認済み
