# 修正内容の確認

## 概要

前回の刷新が添付 HTML のデザインと一致していなかったため、今回の差分では参考 HTML の画面構成を基準にダッシュボードを組み直した。特にサイドバー、ヘッダー、Overview / Applications / Events / Detail のレイアウトを HTML の構造へ合わせている。

## 主な変更

- `core/dashboard/src/components/DashboardShell.tsx`
  - 添付 HTML と同じ細い左サイドバー構成へ変更
  - グローバルヘッダーを HTML 準拠の最小構成へ変更
  - ジョブボタン、更新ボタン、状態表示の位置を合わせた
- `core/dashboard/src/views/HomeView.tsx`
  - 概要画面を HTML の 4 サマリーカード + インフラ情報 + 要確認アプリ + イベント履歴構成へ変更
- `core/dashboard/src/views/ApplicationsView.tsx`
  - 検索欄、状態フィルタ、グリッド / リスト切替、新規登録ボタンを HTML 準拠で再構成
- `core/dashboard/src/views/EventsView.tsx`
  - 参考 HTML に対応するイベント一覧画面を追加
- `core/dashboard/src/views/ApplicationDetailView.tsx`
  - 戻るバー付きの詳細画面へ変更
  - 左 2 列にコントロール、ログ、デプロイ設定、関連ジョブ
  - 右 1 列にヘルス、コンテナ、イベント、削除設定を配置
- `core/dashboard/src/App.tsx`
  - `EventsView` を接続
  - Applications 画面から Import 画面へ遷移できるように接続
- `core/dashboard/src/styles.css`
  - ベースフォントを参考 HTML に合わせて `Inter` / `Noto Sans JP` 系へ変更

## 確認

- 実行コマンド: `corepack yarn workspace @lab-core/dashboard build`
- 結果: 成功
