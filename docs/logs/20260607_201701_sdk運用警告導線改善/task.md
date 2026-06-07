# タスク

作成日:
- 2026-06-07

依頼概要:
- `Samples-Homepage` を作成した際のフィードバックをもとに、LabWebSystem-Core / SDK / 現行ドキュメントを改修する。

背景:
- 配備用 compose と localhost 用 compose の分離
- same-origin 前提の API 呼び出し
- `APPDATA_ROOT` を使った永続化
- `LABCORE_DEVICE_MODE` と `prod` profile の明示
- SDK 導入導線と `lint` / `doctor` の運用寄り警告強化

完了条件:
1. SDK が運用上危険な構成を警告できる
2. `labcore init` の初期生成物が現在の推奨運用に沿う
3. 開発者向け現行ドキュメントが改善内容を説明している
4. build / test が通っている
