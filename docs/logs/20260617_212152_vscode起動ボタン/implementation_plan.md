# 実装計画

## 目的

ダッシュボードから対象ワークスペースを VS Code Remote-SSH で直接開ける導線を追加し、環境差分のある SSH 接続先 IP にも追従できるようにする。

## 実施手順

1. `App.tsx` から `system.execution.sshServiceIp` を `DashboardShell` へ渡す。
2. `DashboardShell.tsx` に VS Code 起動用 URL の組み立て処理を追加する。
3. 「ジョブパネルを開く」ボタンの左に「VS Codeで開く」ボタンを追加する。
4. `sshServiceIp` 未取得時は無効ボタンを表示して誤動作を防ぐ。
5. `docs/readmes/ダッシュボードUIデザインルール.md` に、ブランド起点操作ではブランドアイコンを例外利用できる旨を追記する。
6. 型チェックとビルド相当の確認を行い、結果を記録する。

## 想定する URL 形式

`vscode://vscode-remote/ssh-remote+amoeba@{sshServiceIp}/home/arpanet/work/LabWebSystem-Core`

## 確認観点

- ヘッダーの高さと既存ボタン列の見た目が崩れていないこと
- `sshServiceIp` が存在する環境で URL が正しく生成されること
- `sshServiceIp` が未設定でも画面が壊れず、無効状態で表示されること
