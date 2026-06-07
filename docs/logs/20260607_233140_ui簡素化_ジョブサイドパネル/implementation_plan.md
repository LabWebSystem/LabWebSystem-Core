# 実装計画

## 目的

- 文字量過多の解消
- アイコンを使った視認性向上
- Tailwind ベースの画面骨格へ移行
- ジョブ一覧を常設セクションではなくサイドパネル化

## 方針

1. `react-icons` と Tailwind をダッシュボードで有効化する
2. ヘッダーを再設計し、ジョブパネル開閉ボタンを追加する
3. ジョブ専用のサイドパネルを追加する
4. ホーム画面の冗長な説明を削除し、注意アプリ・失敗ジョブ・イベントを短く整理する
5. アプリ一覧も Tailwind ベースのカード UI に寄せる

## 今回の対象

- `core/dashboard/vite.config.ts`
- `core/dashboard/src/components/DashboardShell.tsx`
- `core/dashboard/src/components/JobsPanel.tsx`
- `core/dashboard/src/views/HomeView.tsx`
- `core/dashboard/src/views/ApplicationsView.tsx`
- `core/dashboard/src/App.tsx`
- `core/dashboard/src/styles.css`
- `core/dashboard/package.json`
- `yarn.lock`

## ねらい

- 最初に見るホーム画面から「説明を読む UI」を外す
- ジョブ詳細は必要時だけ開く
- CSS の大規模専用設計ではなく、Tailwind のユーティリティで主要レイアウトを組む
