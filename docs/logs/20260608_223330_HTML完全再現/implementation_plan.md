# 実装計画

1. 添付 HTML の全体構成を確認する
   - 左サイドバー
   - ミニマルヘッダー
   - Overview / Applications / Events / Detail の画面構造
2. 既存 React 実装との差分を整理する
   - ビュー構成の違い
   - 情報配置の違い
   - アプリ詳細画面の構成差
3. `DashboardShell` を参考 HTML 準拠に作り直す
4. `HomeView` / `ApplicationsView` / `EventsView` を HTML 構造ベースで実装する
5. `ApplicationDetailView` を HTML の 2 カラム詳細画面へ寄せる
6. ビルド確認後、ログ保存とコミットを行う
