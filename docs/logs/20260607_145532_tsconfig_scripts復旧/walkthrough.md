# 修正内容の確認

作成日: 2026-06-07

## 実施内容
- root に `tsconfig.scripts.json` を追加した。
- 内容は `tsconfig.json` を `extends` するだけの薄い橋渡し設定にした。

```json
{
  "extends": "./tsconfig.json"
}
```

## そうした理由
- `scripts/dev/root-command.ts` の `quality:typecheck:scripts` は `tsconfig.scripts.json` を参照している。
- 一方で現在の repo には `tsconfig.ts` は存在せず、scripts 向けの実体は root `tsconfig.json` にまとまっていた。
- そのため、参照先を復元する最小変更として橋渡しファイル追加を採用した。

## 確認結果
- `yarn quality:typecheck:scripts`: 成功
