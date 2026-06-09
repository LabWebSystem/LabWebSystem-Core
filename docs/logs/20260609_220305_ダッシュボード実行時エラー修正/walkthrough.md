# 修正内容の確認

## 原因

`react-grid-layout@2.2.3` は ESM の標準エントリポイントから `WidthProvider` を公開しておらず、`react-grid-layout` 直下からの import ではランタイム時に不正な値を参照していた。

## 対応

- `core/dashboard/src/views/HomeView.tsx`
  - `WidthProvider` と `Responsive` の import 先を `react-grid-layout/legacy` に変更した
- `core/dashboard/index.html`
  - `favicon.svg` を参照する `<link rel="icon">` を追加した
- `core/dashboard/public/favicon.svg`
  - ダッシュボード用のシンプルな favicon を追加した

## 確認

- `corepack yarn workspace @lab-core/dashboard node -e "import('react-grid-layout/legacy')..."`
  - `WidthProvider` と `Responsive` が関数として解決されることを確認
- `corepack yarn workspace @lab-core/dashboard build`
  - ビルド成功
