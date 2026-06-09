# 修正内容の確認

## UI整理

- `core/dashboard/src/views/HomeView.tsx`
  - 上部の説明文、ページごとの見出し、固定メタ表示を削除した
  - そのぶんグリッド表示領域を広げた
- `core/dashboard/src/widgets/dashboard/WidgetFrame.tsx`
  - `page 5 · 標準 · 6×6 / min 4×4` のような補助情報を削除した
  - 削除ボタンは編集モード時のみ表示するようにした

## ページ挙動

- `core/dashboard/src/hooks/useDashboardWorkspace.ts`
  - 空ページを自動削除するようにした
  - 末尾ページの下端へドラッグしたときだけ、次ページのドラフトを 1 枚だけ生成するようにした
  - ドラッグ終了時にドラフトページへ実際に移動した場合だけ確定するようにした
- `core/dashboard/src/views/HomeView.tsx`
  - ドラッグ中に上端・下端へカーソルを維持したとき、少し待ってから連続でページ移動するようにした
  - ドラフトページは半透明表示にした

## 確認

- `corepack yarn workspace @lab-core/dashboard build`
  - 成功
