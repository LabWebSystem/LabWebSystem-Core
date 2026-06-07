# タスク

作成日: 2026-06-07

## 依頼
- `tsconfig.scripts` 系の設定名変更に追従し、必要なら別設定を追加して scripts 型検証導線を復旧する。

## 完了条件
- `yarn quality:typecheck:scripts` が再び実行できる。
- 変更内容が最小限で、既存の root `tsconfig.json` と競合しない。
