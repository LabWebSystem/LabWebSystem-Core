# 追記内容（SDK構成案: 開発/本番分離）

## 反映先
- `docs/logs/20260516_233144_sdk調査/walkthrough.md`
- 追記セクション: `4.6 開発/本番の安全分離キット（今回追記）`

## 追加した要点
1. プロファイル分離
- `dev-sim`, `dev-real-device`, `prod` を SDK で定義
- `labcore.app.yaml` + profile 合成で最終設定を生成

2. デバイス依存の抽象化
- `real/mock` 切替できるデバイスアダプタ雛形を SDK 提供
- ハードウェア無し環境でも統合テストを継続

3. テストデータ導線
- `labcore seed apply/verify` で単体起動・検証の初期条件を標準化

4. 本番安全ガード
- `labcore guard prod` を追加
- mock 設定混入、dev override 混入、必須 env 未設定、deviceRequirements 不一致を検出

5. CI二段構成
- `dev-sim` で lint/inspect/preflight/integration
- `prod` で guard/export/構成整合

## 更新した実装優先度
1. `sdk-cli lint/preflight`
2. `sdk-contract + sdk-profile`
3. `sdk-device-adapter + sdk-seed`
4. `initテンプレ + CIバッジ`
