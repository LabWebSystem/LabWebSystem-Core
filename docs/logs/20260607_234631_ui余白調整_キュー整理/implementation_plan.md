# 実装計画

## 目的

- 左右余白を減らして表示領域を広げる
- 全体スクロールを回復して、縦長コンテンツが欠けないようにする
- ジョブパネルを「失敗ジョブ / 実行中ジョブ」の分断ではなく、単純なキュー表示へ寄せる
- 再起動後に残存する未完了ジョブを整理する

## 方針

1. 画面レイアウトの最大幅制限と overflow 設定を見直す
2. ジョブパネルを単一リストへ再構成し、長文メッセージは折り返し・要約表示にする
3. 完了済みジョブをキューから削除できるようにする
4. バックエンド起動時に `queued` / `running` の未完了ジョブを中断扱いへ更新する

## 対象

- `core/dashboard/src/components/DashboardShell.tsx`
- `core/dashboard/src/components/JobsPanel.tsx`
- `core/dashboard/src/styles.css`
- `core/dashboard/src/App.tsx`
- `core/dashboard/src/api.ts`
- `core/dashboard/src/types.ts`
- `core/backend/src/services/jobs.ts`
- `core/backend/src/routes/jobs.ts`
- `core/backend/src/index.ts`

## 完了条件

- ページ全体がスクロールできる
- 左右余白が縮まる
- ジョブパネルが単一のキューとして見える
- 再起動後に古い未完了ジョブが「実行中」のまま残らない
