# 実装計画

1. 既存の `labcore` 呼び出し箇所を `rg` で探索する。
2. 現行導線（README / CI テンプレート）を `yarn sdk:labcore` へ置換する。
3. 参照漏れを再探索し、必要最小限の修正に留める。
4. `yarn sdk:labcore help` で実行確認を行う。
