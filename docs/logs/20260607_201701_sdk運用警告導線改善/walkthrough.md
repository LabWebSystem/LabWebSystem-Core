# 修正内容の確認

作成日:
- 2026-06-07

## 1. SDK の変更
- `sdk/packages/sdk/src/operational-warnings.ts` を追加し、運用警告を集約した。
- `lintSdk` に `composePath` を含め、library と CLI が同じ警告結果を共有するようにした。
- `doctor` は CLI 側の独自実装ではなく `lintSdk` の結果を使うように揃えた。

検知できるようになった内容:
- 配備用 compose の `ports:`
- resolved env / compose に残った `localhost`
- same-origin ではない `VITE_API_BASE_URL`
- `APPDATA_ROOT` 未使用
- `prod` profile の `LABCORE_DEVICE_MODE` 未指定
- `prod` profile への dev compose 混入
- `hostname` の `*.lab.localhost` 残留

## 2. `labcore init` の変更
- `hostname` の既定値を `<app>.lab.localhost` に変更した。
- `docker-compose.dev.yml` へ localhost 用 `ports:` を生成するようにした。
- `dev-real-device` は `docker-compose.dev.yml` を使うように変更した。
- `prod` は `docker-compose.yml` のみを使うように変更した。
- `package.json` に `labcore:lint` / `labcore:preflight` / `labcore:guard` / `labcore:export` を生成するようにした。
- 生成されるガイド文面を、実在の GitHub URL と新しい運用ルールに合わせて更新した。

## 3. 導入導線の変更
- `sdk-profile` / `sdk` / `sdk-cli` の `prepack` を `yarn --cwd ../../ build` へ変更した。
- ローカル `yarn pack` により、workspace 依存の成果物不足で pack が落ちないことを確認した。

## 4. ドキュメントの変更
- `docs/readmes/適合アプリ作成ガイド.md` を、compose 分離 / same-origin / `APPDATA_ROOT` / `hostname` 中心に更新した。
- `docs/readmes/LabWebSystem適合アプリ構成図.md` を追加した。
- `docs/readmes/登録前チェックリスト.md` を追加した。
- `docs/readmes/SDK概要.md` / `SDK仕様書.md` / `説明書一覧.md` を更新した。
- `sdk/README.md` も repo ローカル scripts と GitHub 導線に合わせて更新した。

## 5. 検証結果
- `corepack yarn --cwd sdk build`: 成功
- `corepack yarn --cwd sdk test`: 成功
- `corepack yarn pack`:
  - `sdk/packages/sdk-cli`: 成功
  - `sdk/packages/sdk`: 成功
  - `sdk/packages/sdk-profile`: 成功
