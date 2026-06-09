# 修正内容の確認

## 対応

- `core/dashboard/src/dashboard/layout.ts`
  - 旧レイアウトを読み込む際でも `status` ウィジェットの `static / isDraggable / isResizable` を可動前提へ補正するようにした
- `core/dashboard/src/widgets/dashboard/WidgetFrame.tsx`
  - 削除ボタンを編集モード時に常に表示できるようにした
- `core/dashboard/src/widgets/dashboard/StatusWidget.tsx`
  - `Apps / Healthy / Queue / Pages` を日本語表記へ変更した
  - 詳細表示内の文言も日本語寄りに揃えた
- `core/dashboard/src/widgets/dashboard/WidgetPreview.tsx`
  - 追加モーダルのステータスプレビュー表記も日本語へ変更した

## 確認

- `corepack yarn workspace @lab-core/dashboard build`
  - 成功
