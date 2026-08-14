<!-- This file is generated. Do not edit manually. -->

# By Type

## ADR
- ADR-001 | ACCEPTED | - | Backend API を Operation 中心へ破壊的に統一する
- ADR-002 | ACCEPTED | - | Operation SSE は単一 backend 前提の in-memory pub/sub で開始する
- ADR-003 | ACCEPTED | - | アプリ runtime は application_id 配下へ閉じ込めて正規化 Compose のみ実行する
- ADR-004 | ACCEPTED | - | lwsctlとの接点を外部契約へ限定する

## CHG
- CHG-001 | ACTIVE | - | セットアッププロファイルと system コマンドを統一
- CHG-002 | ACTIVE | - | system 起動時の backend/dashboard 直公開を廃止
- CHG-003 | ACTIVE | - | Operation 基盤と jobs→operations migration の土台を追加
- CHG-004 | ACTIVE | - | Application 正規API・Operation Runner・OpenAPI/README・dashboard API client を同期更新
- CHG-005 | ACTIVE | - | destroy コマンドを soft / hard に分離
- CHG-006 | ACTIVE | - | application_id ベース runtime・Compose サンドボックス・app root 削除 helper を追加
- CHG-007 | ACTIVE | - | lwsctl向けProduction外部契約と配布基盤を追加
