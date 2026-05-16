# 実装計画

## 方針
- 既存提案を壊さずに拡張し、運用で使える開発/本番分離の仕組みをSDK側へ追加する。
- 「単体起動できること」「デバイス無しでも最低限テストできること」「本番混入防止」を三本柱にする。

## 追記設計
1. プロファイル層（`dev-sim` / `dev-real-device` / `prod`）
2. デバイスアダプタ層（real/mock 切替）
3. テストデータ層（seed apply/verify）
4. 本番ガード層（mock混入・override混入・必須env未設定の検知）
5. CI二段構成（dev-sim検証 + prodガード検証）

## 成果物
- 既存レポート `docs/logs/20260516_233144_sdk調査/walkthrough.md` へ追記
- 本フォルダへ task / implementation_plan / walkthrough を保存
