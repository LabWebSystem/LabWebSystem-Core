# 修正内容の確認

`core/dashboard/src/views/HomeView.tsx` のシステムイベント表示を、カードの並列表示から縦のタイムライン表示へ変更した。

## 変更点

- `recentEvents` の並び順を `created_at` の昇順に変更し、直近 10 件を「古い → 新しい」の順で表示するようにした
- 各イベントに以下を表示するようにした
  - 発生時刻
  - scope
  - 連番
  - level
  - title
  - message
- セクション見出しの下に「直近のイベントを発生順に並べています」という補助文を追加した

## 確認結果

- `corepack yarn workspace @lab-core/dashboard build` : 成功
