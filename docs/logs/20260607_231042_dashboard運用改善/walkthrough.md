# 修正内容の確認

## 概要

ダッシュボードを、状態把握・ジョブ追跡・安全な操作判断を行いやすい V1 仕様へ更新した。

## 主な変更

### 1. アプリ死活監視の追加

- バックエンドに URL 応答とコンテナ状態を組み合わせたヘルス評価を追加した。
- `正常 / 遅延 / 画面確認 / 異常 / 到達不可 / 処理中 / 停止 / 未確認` を返す。
- 一覧・詳細・ホームで同じヘルス情報を使うようにした。

### 2. 状態表示の整理

- フロント側にアプリ状態・ジョブ状態・ヘルス状態の表示辞書を追加した。
- 生の内部状態をそのまま露出せず、日本語ラベルと説明を付与した。
- 「配備」を画面上では「デプロイ」に統一した。

### 3. ジョブ可視化と操作制御

- ジョブ一覧 API にアプリ名、再実行可否、キャンセル可否を追加した。
- 失敗ジョブの再実行、待機中ジョブのキャンセルを追加した。
- 同一アプリで `queued / running` ジョブが存在する場合、危険な操作を 409 で拒否するようにした。
- 詳細画面では、操作できない理由をボタンの無効化と補足文で表示するようにした。

### 4. サービス名重複系エラーの抑制

- 新規アプリには `compose_project_name` を保存し、`アプリ名 + applicationId 由来サフィックス` で内部 Compose 名を一意化した。
- 既存アプリは legacy 名を継続利用するため、運用中環境への破壊的変更を避けた。

### 5. UI 再設計

- ホーム画面
  - 注意アプリ
  - 実行中/待機中ジョブ
  - 失敗ジョブ
  - 最近追加されたアプリ
  - 直近イベント
  - 応答が遅いアプリ
  を一画面に再配置した。
- 一覧画面をカード化し、ヘルス・状態・更新有無・進行中ジョブを集約した。
- 詳細画面に以下を追加した。
  - 状態カード
  - 折りたたみ式の「現在のアラート」
  - 関連ジョブ履歴
  - 技術情報としての内部 Compose 名
  - 破壊的操作前の明示
- 追加画面の送信ボタンを「アプリを追加する」に変更し、追加後は一覧へ戻すようにした。

## 変更ファイル

- backend
  - `core/backend/src/services/application-health.ts`
  - `core/backend/src/services/application-update-check.ts`
  - `core/backend/src/services/compose-project.ts`
  - `core/backend/src/services/jobs.ts`
  - `core/backend/src/routes/applications.ts`
  - `core/backend/src/routes/jobs.ts`
  - `core/backend/src/lib/schema.ts`
- dashboard
  - `core/dashboard/src/ui.ts`
  - `core/dashboard/src/views/HomeView.tsx`
  - `core/dashboard/src/views/ApplicationsView.tsx`
  - `core/dashboard/src/views/ApplicationDetailView.tsx`
  - `core/dashboard/src/views/ImportView.tsx`
  - `core/dashboard/src/styles.css`
  - `core/dashboard/src/App.tsx`
  - `core/dashboard/src/api.ts`
  - `core/dashboard/src/types.ts`

## 検証結果

- `corepack yarn workspace @lab-core/backend build` : 成功
- `corepack yarn workspace @lab-core/dashboard build` : 成功
- `node --import tsx --test core/backend/src/testing/events.test.ts core/backend/src/testing/compose-project.test.ts` : 成功

## 補足

- 実行中ジョブの安全停止までは未実装で、今回は「待機中ジョブのみキャンセル可」とした。
- 既存の root 所有 `dist` / `.vite-temp` 残骸は、再ビルドのために退避しながら回避した。
