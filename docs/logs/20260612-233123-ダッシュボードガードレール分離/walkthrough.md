# 修正内容の確認

## 分離したモジュール

- `core/dashboard/src/dashboard/guardrails/types.ts`
  ガードレール専用型、違反コード、レポート型を定義
- `core/dashboard/src/dashboard/guardrails/geometry.ts`
  衝突判定、境界判定、安全配置探索、幾何違反検証を担当
- `core/dashboard/src/dashboard/guardrails/sizing.ts`
  サイズ補正と既存レイアウトからのサイズ解決を担当
- `core/dashboard/src/dashboard/guardrails/structure.ts`
  重複 ID、孤立 layout、存在しない page 参照などの構造違反検証を担当
- `core/dashboard/src/dashboard/guardrails/document.ts`
  検証レポート集約とダッシュボード全体の再配置修復を担当
- `core/dashboard/src/dashboard/guardrails/index.ts`
  利用側向けの公開窓口

## 既存コード側の変更

- `layout.ts` はレガシー入力の正規化と既存 API の薄い窓口に寄せた
- `useDashboardWorkspace.ts` は配置探索・サイズ取得・検証レポート利用をガードレールモジュール経由へ切り替えた
- 修復後にも違反が残る場合に備えて、`inspectDashboardGuardrails` を使った監視用フックポイントを追加した

## 確認結果

- 実行コマンド:
  `yarn --cwd core/dashboard vite build --outDir dist-codex-check`
- 結果:
  ビルド成功
