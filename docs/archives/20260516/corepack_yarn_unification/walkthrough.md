# 修正内容の確認

## 変更ファイル
- `package.json`

## 実施内容
- `scripts` 内の Yarn 呼び出しを `corepack yarn` へ統一。
- 代表例:
  - `lab:up`: `... yarn dev` → `... corepack yarn dev`
  - `dev:kernel:up`: `yarn ... && yarn ...` → `corepack yarn ... && corepack yarn ...`
  - `build`: `yarn workspace ...` → `corepack yarn workspace ...`

## 検証
- `package.json` を `JSON.parse` で構文検証。
- `scripts` 内に裸の `yarn` 呼び出しが残っていないことを確認。
