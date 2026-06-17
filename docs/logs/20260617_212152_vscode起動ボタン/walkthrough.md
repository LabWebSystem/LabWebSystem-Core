# 修正内容の確認

## 変更概要

- `DashboardShell` に `sshServiceIp` プロパティを追加した。
- `system.execution.sshServiceIp` から VS Code Remote-SSH 用の URL を動的生成するようにした。
- ヘッダー右側のボタン群で、「ジョブパネルを開く」ボタンの左に「VS Codeで開く」ボタンを追加した。
- アイコンには `react-icons/vsc` の `VscVscode` を使用した。
- UI ルール文書へ、外部サービス起点の操作ではブランドアイコンを例外利用できるルールを追記した。

## 変更ファイル

- `core/dashboard/src/App.tsx`
- `core/dashboard/src/components/DashboardShell.tsx`
- `docs/readmes/ダッシュボードUIデザインルール.md`

## 動作確認

- `corepack yarn workspace @lab-core/dashboard exec tsc --noEmit -p tsconfig.json`
  - 成功
- `corepack yarn workspace @lab-core/dashboard exec vite build --outDir /tmp/labweb-dashboard-build`
  - 成功

## 補足

- 既定の `core/dashboard/tsconfig.tsbuildinfo` と `core/dashboard/dist` が `root` 所有だったため、通常の `yarn build` は権限エラーで完了しなかった。
- そのため、型チェックは `--noEmit`、ビルド確認は書き込み可能な一時出力先を使って実施した。
