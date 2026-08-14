<!-- This file is generated. Do not edit manually. -->

# By Type

## ADR
- ADR-001 | ACCEPTED | - | Backend API を Operation 中心へ破壊的に統一する
- ADR-002 | ACCEPTED | - | Operation SSE は単一 backend 前提の in-memory pub/sub で開始する
- ADR-003 | ACCEPTED | - | アプリ runtime は application_id 配下へ閉じ込めて正規化 Compose のみ実行する
- ADR-004 | SUPERSEDED | - | lwsctlとの接点を外部契約へ限定する
- ADR-005 | SUPERSEDED | - | Core Releaseはタグ起点のGitHub Actionsでimageとartifactを同時公開する
- ADR-006 | ACCEPTED | - | Core ReleaseをCompose単体で再生成可能な最小契約へ統一する
- ADR-007 | ACCEPTED | - | 開発者向け操作を目的中心の mise task に統一する

## BUG
- BUG-001 | VERIFIED | production image / backend startup | Production Backend imageからOpenAPI定義が欠落する
- BUG-002 | VERIFIED | production image / Docker runtime | Production Backend imageにDocker CLIが含まれない
- BUG-003 | VERIFIED | release-automation | Release workflowのchecksum検証がrunnerで失敗する
- BUG-004 | VERIFIED | production compose / backend readiness | Production Compose の Backend readiness 用ディレクトリが未設定

## CHG
- CHG-001 | SUPERSEDED | - | セットアッププロファイルと system コマンドを統一
- CHG-002 | SUPERSEDED | - | system 起動時の backend/dashboard 直公開を廃止
- CHG-003 | ACTIVE | - | Operation 基盤と jobs→operations migration の土台を追加
- CHG-004 | ACTIVE | - | Application 正規API・Operation Runner・OpenAPI/README・dashboard API client を同期更新
- CHG-005 | SUPERSEDED | - | destroy コマンドを soft / hard に分離
- CHG-006 | ACTIVE | - | application_id ベース runtime・Compose サンドボックス・app root 削除 helper を追加
- CHG-007 | SUPERSEDED | - | lwsctl向けProduction外部契約と配布基盤を追加
- CHG-008 | ACTIVE | - | Production Backend imageへOpenAPI定義を含める
- CHG-009 | SUPERSEDED | - | Release manifestとmulti-arch公開workflowを追加
- CHG-010 | ACTIVE | - | Coreデプロイを最小Compose Releaseへ移行
- CHG-011 | ACTIVE | - | Production Compose の Backend 永続パスを readiness 契約へ統一
- CHG-012 | ACTIVE | - | mise task 中心の開発・検証・デプロイ体制へ移行

## SUP
- SUP-001 | ACTIVE | - | 旧Core外部契約とRelease公開方式を最小Compose契約で置換する
- SUP-002 | ACTIVE | - | profile / system Yarn 操作体系を mise task 体系で置換する
