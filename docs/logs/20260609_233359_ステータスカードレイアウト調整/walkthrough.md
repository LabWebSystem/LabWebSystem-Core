# 修正内容の確認

## 対応

- `core/dashboard/src/widgets/dashboard/StatusWidget.tsx`
  - 4 枚のサマリーカードが常に並ぶよう、2 列基準で潰れにくいレイアウトへ変更した
  - サイズに応じて余白・文字サイズ・補足文の密度が変わるようにした
  - 4 枚目を赤系の「異常 / アラート発生中のアプリ」カードへ差し替えた
- `core/dashboard/src/widgets/dashboard/WidgetPreview.tsx`
  - 追加モーダルのプレビューも新しい赤カード構成へ合わせた
- `core/dashboard/src/widgets/dashboard/DashboardWidgetRenderer.tsx`
  - 不要になったページ数系 props の受け渡しを整理した

## 確認

- `corepack yarn workspace @lab-core/dashboard build`
  - 成功
