# 実装計画

1. 旧 `guardrails` と `react-grid-layout` の残存箇所を洗い出し、削除対象を確定する。
2. 新グリッドモジュールの engine を使って、現在ページ内の移動・リサイズ確定を処理するアダプタを追加する。
3. `HomeView` のグリッド描画と編集操作を `react-grid-layout` から自前実装へ置き換える。
4. `react-grid-layout` 依存と関連スタイル、旧 `guardrails` ファイルを削除する。
5. `yarn.lock` を更新し、型確認と別出力先ビルドで動作確認する。
