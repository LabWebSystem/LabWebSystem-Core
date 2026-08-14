<!-- This file is generated. Do not edit manually. -->

# Active
- ADR-001 | ACCEPTED | - | Backend API を Operation 中心へ破壊的に統一する
- ADR-002 | ACCEPTED | - | Operation SSE は単一 backend 前提の in-memory pub/sub で開始する
- ADR-003 | ACCEPTED | - | アプリ runtime は application_id 配下へ閉じ込めて正規化 Compose のみ実行する
- ADR-006 | ACCEPTED | - | Core ReleaseをCompose単体で再生成可能な最小契約へ統一する
- BUG-001 | VERIFIED | production image / backend startup | Production Backend imageからOpenAPI定義が欠落する
- BUG-002 | VERIFIED | production image / Docker runtime | Production Backend imageにDocker CLIが含まれない
- BUG-003 | VERIFIED | release-automation | Release workflowのchecksum検証がrunnerで失敗する
- BUG-004 | VERIFIED | production compose / backend readiness | Production Compose の Backend readiness 用ディレクトリが未設定
- CHG-001 | ACTIVE | - | セットアッププロファイルと system コマンドを統一
- CHG-002 | ACTIVE | - | system 起動時の backend/dashboard 直公開を廃止
- CHG-003 | ACTIVE | - | Operation 基盤と jobs→operations migration の土台を追加
- CHG-004 | ACTIVE | - | Application 正規API・Operation Runner・OpenAPI/README・dashboard API client を同期更新
- CHG-005 | ACTIVE | - | destroy コマンドを soft / hard に分離
- CHG-006 | ACTIVE | - | application_id ベース runtime・Compose サンドボックス・app root 削除 helper を追加
- CHG-008 | ACTIVE | - | Production Backend imageへOpenAPI定義を含める
- CHG-010 | ACTIVE | - | Coreデプロイを最小Compose Releaseへ移行
- CHG-011 | ACTIVE | - | Production Compose の Backend 永続パスを readiness 契約へ統一
- SUP-001 | ACTIVE | - | 旧Core外部契約とRelease公開方式を最小Compose契約で置換する
