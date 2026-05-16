# Lab-Core 使い方（現行実装準拠）

補足:
- 正式仕様は `docs/20260516_230913_公式仕様統合/official_specification.md` を参照してください。

## 1. この説明書の対象
この説明書は、研究室メンバーが Lab-Core でアプリを登録・確認・復旧するための操作手順です。

## 2. 起動手順
1. `yarn install`
2. `yarn config`
3. 開発環境: `yarn environment:dev:up`
4. 研究室運用: `yarn environment:lab:up`
5. ブラウザで `http://dashboard.<LAB_CORE_ROOT_DOMAIN>/` を開く

停止:
- 開発環境: `yarn environment:dev:down`
- 研究室運用: `yarn environment:lab:down`

ログ:
- 開発環境: `yarn environment:dev:logs`
- 研究室運用: `yarn environment:lab:logs`

## 3. 画面の見方
### 3.1 ホーム
- `登録アプリ`
- `稼働中`
- `不安定`
- `失敗`
- `実行モード`（`dry-run` / `execute`）

### 3.2 アプリ一覧
- 現在の一覧画面で主操作は `詳細へ` です。
- 再起動・再ビルド・更新・削除・ログ確認は **アプリ詳細画面** で実行します。

## 4. アプリを登録する
1. `アプリ登録` タブを開く
2. GitHub URL を入力して解析
3. ブランチ確認
4. compose候補を選択
5. 公開サービス候補を選択
6. アプリ名/ホスト名/公開ポートなどを入力
7. `登録して配備キューに追加` を押す

補足:
- 登録後はアプリ詳細へ遷移し、ジョブ進行を確認できます。

## 5. アプリ詳細での運用操作
アプリ詳細画面で次の操作ができます。
- `停止` / `再開`
- `再起動`
- `再ビルド`
- `更新確認`
- `更新適用`
- `ロールバック`
- `ログ確認`
- `削除`

障害時の基本導線:
1. 再起動
2. 進行状況とエラー確認
3. ログ確認
4. 再ビルド
5. 必要に応じて削除・再登録

## 6. ログ確認
1. アプリ詳細で `ログ確認` を開く
2. サービスを選択
3. 表示行数（100/200/500/1000）を調整
4. 必要なら `ログ更新`

補足:
- `dry-run`: イベント由来の疑似ログ
- `execute`: `docker compose logs` の実ログ

## 7. 削除手順
1. アプリ詳細の削除セクションを開く
2. 削除モードを選択
   - `config_only`
   - `source_and_config`
   - `full`
3. 確認用アプリ名を正確に入力
4. `削除ジョブを開始`

## 8. 品質確認コマンド
- ビルド: `yarn quality:build`
- scripts 型検証: `yarn quality:typecheck:scripts`
- 登録フィクスチャ投入: `yarn quality:test:fixtures`
- スモークテスト: `yarn quality:test:smoke`

## 9. 既知注意点
- `quality:test:smoke` は現状、内部スクリプトに旧コマンド参照が残っており、そのままでは失敗する場合があります。
- 設定は `yarn config` を使用し、旧 `config:init` / `config:reset` は使いません。

## 10. 参考資料
- 正式仕様: `docs/20260516_230913_公式仕様統合/official_specification.md`
- docs 入口: `docs/README.md`
- 適合アプリ作成ガイド: `docs/lab_core_app_repository_guide/app_repository_creation_guide.md`
