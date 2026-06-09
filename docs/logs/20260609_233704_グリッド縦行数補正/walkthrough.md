# 修正内容の確認

## 対応

- `core/dashboard/src/views/HomeView.tsx`
  - 現在ページのグリッド表示領域を `ResizeObserver` で監視するようにした
  - `rowHeight` / `margin` / `containerPadding` から `maxRows` を算出し、 `ResponsiveGridLayout` に渡すようにした

## 期待効果

- 見えているダッシュボード枠より下に 1 行余分に配置できてしまうズレを防ぐ

## 確認

- `corepack yarn workspace @lab-core/dashboard build`
  - 成功
