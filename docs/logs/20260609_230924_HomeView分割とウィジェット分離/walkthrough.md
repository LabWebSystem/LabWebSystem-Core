# 修正内容の確認

## 主な分割

- `core/dashboard/src/views/HomeView.tsx`
  - 画面の組み立てとジェスチャ制御中心のファイルへ縮小した
- `core/dashboard/src/hooks/useDashboardWorkspace.ts`
  - ダッシュボードレイアウト、保存、ページ移動、ウィジェット追加削除を管理するようにした
- `core/dashboard/src/hooks/useDashboardMetrics.ts`
  - メトリクスのポーリングと履歴管理を分離した
- `core/dashboard/src/hooks/useDashboardLogWidget.ts`
  - ログウィジェットの取得状態と選択状態を分離した
- `core/dashboard/src/dashboard/*`
  - レイアウト正規化、ウィジェット定義、共通定数、共通ユーティリティを分離した
- `core/dashboard/src/widgets/dashboard/*`
  - 各ウィジェットを個別コンポーネントとして実装し、レンダラーで束ねる構成へ変更した
- `core/dashboard/src/components/WidgetPickerModal.tsx`
  - 追加モーダルを独立コンポーネントへ切り出した

## 効果

- `HomeView.tsx` は 2255 行から 332 行へ縮小した
- 個別ウィジェットの修正が局所化され、今後の追加や差し替えがしやすくなった
- ダッシュボード状態のテストや再利用をフック単位で検討しやすくなった

## 確認

- `corepack yarn workspace @lab-core/dashboard build`
  - 成功
