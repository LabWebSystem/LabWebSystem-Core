# 修正内容の確認

## 1. 旧ガードレールの完全撤去

- `core/dashboard/src/dashboard/guardrails` 配下を削除した。
- `layout.ts` から旧 guardrails ベースの sanitize 依存はすでに切れていたため、その状態を維持したまま新モジュール側へ一本化した。

## 2. 新グリッドモジュール主導への切り替え

- `core/dashboard/src/dashboard/gridModule/state.ts` の `collisionMode` デフォルトを `make-room-adjacent` に変更した。
- `core/dashboard/src/dashboard/moduleAdapter.ts` に、`GridDashboardEngine` を使って現在ページ内の移動・リサイズ確定を処理する `applyWidgetRectOnDashboardDocument` を追加した。
- `core/dashboard/src/hooks/useDashboardWorkspace.ts` へ `applyWidgetRect` を追加し、編集操作の保存経路を新モジュール基準へ寄せた。

## 3. UI 側の基盤差し替え

- `core/dashboard/src/views/HomeView.tsx` から `react-grid-layout` / `react-resizable` 依存を除去した。
- ウィジェット表示を絶対配置ベースの自前グリッド描画へ置き換えた。
- ドラッグ操作はヘッダー、リサイズ操作は右下ハンドルで受け取り、ドロップ時に新モジュール engine で衝突解決するよう変更した。
- ページ端オーバーシュートによるページ切替 UX は維持した。

## 4. 依存関係とスタイル整理

- `core/dashboard/package.json` から `react-grid-layout` を削除した。
- `core/dashboard/src/styles.css` から `react-grid-layout` / `react-resizable` 専用スタイルを削除した。
- `yarn.lock` を更新した。

## 5. 確認結果

- `corepack yarn workspace @lab-core/dashboard exec tsc --noEmit` を実行し、型エラーがないことを確認した。
- `corepack yarn workspace @lab-core/dashboard exec vite build --emptyOutDir false --outDir build-check` を実行し、ビルド成功を確認した。
- `corepack yarn install` では `cpu-features` のビルド失敗ログが出たが、依存削除後の lockfile 更新自体は完了した。
