# LabWebSystem-Core バックエンド仕様変更案 v1.0（確定版）

## 1. 目的

現在のバックエンドには、以下の課題がある。

* APIエンドポイントが操作単位で増え続けている
* URLと実装の対応が分かりにくい
* DB操作がRouteやServiceに散在している
* デプロイ時のstdout/stderrを詳細ログとして追跡できない
* ダッシュボードでリアルタイムログを表示する際、DB負荷が高くなる可能性がある
* Job、Operation、Log、Event、Runtime Logの責務が混ざりやすい
* Application自体の状態と、操作実行単位の状態が混同されやすい
* 旧APIと新APIを併存させると、仕様・実装・UIが二重化する可能性がある

これらを解消するため、バックエンドをOperation中心に再設計する。

---

## 2. 基本方針

* 新仕様では `Operation` を正式な実行単位とする
* 外部API名、内部Service名、Repository名、DBテーブル名を原則 `Operation` に統一する
* 既存の `Job` という外部概念は廃止する
* 既存の `jobs` テーブルは `operations` へ移行する
* 旧操作APIは互換レイヤーとして残さない
* 旧 `/api/jobs` 系APIも新Operation APIへ置き換える
* デプロイ、再起動、停止、更新、ロールバック、削除などはすべてOperationとして扱う
* Application削除も `type: delete` のOperationとして扱う
* `DELETE /api/applications/{applicationId}` は正規APIから外す
* OperationにStepとLogを紐づける
* Operation LogとRuntime Logは分離する
* Application StatusとOperation Statusは分離する
* リアルタイムログ配信はDBポーリングに依存しない
* 初期実装は単一backendインスタンス前提とする
* BFFは現時点では追加しない

---

## 3. 旧仕様との互換性について

今回の改修では、互換性維持を主目的にしない。

理由:

* 旧APIと新APIが混在すると、実装の見通しが悪くなる
* 旧Job APIと新Operation APIが並存すると、状態管理が二重化する
* フロントエンド側でも旧操作APIと新Operation APIの両対応が必要になる
* 今後の改修で、どちらの仕様を正とするか判断しづらくなる

したがって、新仕様を正とし、旧仕様は削除または置き換える。

廃止対象の例:

* `POST /api/applications/{applicationId}/restart`
* `POST /api/applications/{applicationId}/stop`
* `POST /api/applications/{applicationId}/resume`
* `POST /api/applications/{applicationId}/rebuild`
* `POST /api/applications/{applicationId}/update-check`
* `POST /api/applications/{applicationId}/update`
* `POST /api/applications/{applicationId}/rollback`
* `DELETE /api/applications/{applicationId}`
* `GET /api/jobs`
* `POST /api/jobs/{jobId}/retry`
* `POST /api/jobs/{jobId}/cancel`

置き換え後:

* `POST /api/applications/{applicationId}/operations`
* `GET /api/applications/{applicationId}/operations`
* `GET /api/operations/{operationId}`
* `POST /api/operations/{operationId}/retry`
* `POST /api/operations/{operationId}/cancel`

---

## 4. 破壊的変更のリリース戦略

この改修は破壊的変更である。

そのため、backend、frontend、OpenAPI、README、DB migrationを同じリリース単位で揃える。

実施方針:

* backendとfrontendは同一PR、または同一リリースで切り替える
* OpenAPIから旧操作APIと `/api/jobs` 系APIを削除する
* READMEの主要API一覧を新Operation APIへ更新する
* frontendが旧操作APIや `/api/jobs` を参照していないことを確認する
* migration前にSQLite DBをバックアップする
* rollback時に旧 `jobs` テーブルへ戻す必要があるか事前に判断する
* 本番相当データでmigrationのリハーサルを行う
* migration失敗時はDBバックアップから復旧する

---

## 5. 用語整理

### 5.1 Operation

デプロイ、再起動、停止、更新、ロールバック、削除などの「実行単位」。

Operationは、状態、Step、Log、結果、エラーを持つ。

### 5.2 Operation Step

Operation内の処理段階。

例:

* `resolveRepository`
* `cloneOrPullRepository`
* `inspectCompose`
* `dockerComposeUpWithBuild`
* `syncInfrastructure`

### 5.3 Operation Log

Operation実行中に発生するstdout/stderr/systemログ。

例:

* `git clone` のstdout/stderr
* `docker compose up` のstdout/stderr
* backend側が出すsystemログ

### 5.4 Runtime Log

起動済みコンテナの `docker compose logs` 相当のログ。

Operation Logとは別物として扱う。

### 5.5 Event

人間向けの履歴・監査情報。

---

## 6. 最終的な概念モデル

```text
Application
  ├─ DeploymentConfig
  ├─ RuntimeLogs
  └─ Operations
       ├─ OperationStatus
       ├─ OperationSteps
       └─ OperationLogs
```

---

# 7. 最終API構成

## 7.1 Application設定系

```text
GET   /api/applications
POST  /api/applications
GET   /api/applications/{applicationId}
PATCH /api/applications/{applicationId}
```

注意:

```text
DELETE /api/applications/{applicationId}
```

は正規APIから外す。

Application削除は、delete Operationで行う。

---

## 7.2 Deployment設定系

```text
GET   /api/applications/{applicationId}/deployment
PATCH /api/applications/{applicationId}/deployment
GET   /api/applications/{applicationId}/deployment/inspection
```

---

## 7.3 Operation系

```text
POST /api/applications/{applicationId}/operations
GET  /api/applications/{applicationId}/operations
GET  /api/operations/{operationId}
POST /api/operations/{operationId}/cancel
POST /api/operations/{operationId}/retry
GET  /api/operations/{operationId}/logs
GET  /api/operations/{operationId}/logs/stream
```

---

## 7.4 Runtime Log系

```text
GET /api/applications/{applicationId}/runtime-logs
```

---

## 7.5 Event系

```text
GET /api/events
```

---

# 8. Operationモデル

## 8.1 operationsテーブル

想定テーブル:

```text
operations
  operation_id
  application_id
  type
  status
  current_step_id
  current_step_name
  current_step_order
  parameters
  result
  error_code
  error_message
  error_details
  retry_of_operation_id
  logs_available
  created_at
  updated_at
  started_at
  finished_at
```

## 8.2 Operation Status

Operation Statusは以下とする。

* `queued`
* `running`
* `succeeded`
* `failed`
* `cancelled`
* `interrupted`

`interrupted` は正式なDB statusとして保存する。

理由:

* `failed` は処理自体の失敗
* `interrupted` はbackend停止・再起動などによる中断
* 障害調査上、両者を分ける必要がある

## 8.3 updated_at

`operations.updated_at` は、Operation状態変更時に必ず更新する。

更新対象の例:

* status変更
* currentStep変更
* error保存
* result保存
* cancel
* interrupted整理
* logs_available更新

## 8.4 error_details

Operation errorは以下に分けて保存する。

```text
error_code
error_message
error_details
```

`error_details` はJSON文字列として保存する。

注意:

* `error_code`
* `error_message`
* `error_details`

上記にはRedaction済みの値だけを保存する。

## 8.5 Operation DTO

Operation DTO例:

```json
{
  "operationId": "op_123",
  "applicationId": "app_456",
  "type": "deploy",
  "status": "running",
  "currentStepId": "step_4",
  "currentStepName": "dockerComposeUpWithBuild",
  "currentStepOrder": 4,
  "createdAt": "2026-06-20T10:00:00.000Z",
  "updatedAt": "2026-06-20T10:01:00.000Z",
  "startedAt": "2026-06-20T10:00:02.000Z",
  "finishedAt": null,
  "parameters": {
    "rebuild": true
  },
  "result": null,
  "error": null,
  "retryOfOperationId": null,
  "logsAvailable": true,
  "canCancel": false,
  "canRetry": false,
  "links": {
    "self": "/api/operations/op_123",
    "logs": "/api/operations/op_123/logs",
    "logStream": "/api/operations/op_123/logs/stream"
  }
}
```

ログ削除済みの場合:

```json
{
  "operationId": "op_123",
  "logsAvailable": false
}
```

`logsAvailable=false` は、Operation本体は残っているがOperation Logsが削除済みであることを表す。

---

# 9. Operation Typeとparameters schema

Operation Typeは以下とする。

* `deploy`
* `restart`
* `stop`
* `resume`
* `rebuild`
* `update-check`
* `update`
* `rollback`
* `delete`

Operation Typeごとにparameters schemaを定義する。

未知キーは原則拒否する。

## 9.1 deploy

```json
{
  "type": "deploy",
  "parameters": {
    "rebuild": true
  }
}
```

## 9.2 restart

```json
{
  "type": "restart"
}
```

## 9.3 stop

```json
{
  "type": "stop"
}
```

## 9.4 resume

```json
{
  "type": "resume"
}
```

## 9.5 rebuild

```json
{
  "type": "rebuild",
  "parameters": {
    "keepData": true
  }
}
```

## 9.6 update-check

```json
{
  "type": "update-check"
}
```

## 9.7 update

```json
{
  "type": "update",
  "parameters": {
    "targetRevision": "abc123"
  }
}
```

## 9.8 rollback

```json
{
  "type": "rollback",
  "parameters": {
    "targetRevision": "abc123"
  }
}
```

## 9.9 delete

```json
{
  "type": "delete",
  "parameters": {
    "mode": "configOnly"
  }
}
```

delete.mode:

* `configOnly`
* `sourceAndConfig`
* `full`

内部値との対応:

* `configOnly` → `config_only`
* `sourceAndConfig` → `source_and_config`
* `full` → `full`

---

# 10. Application削除仕様

## 10.1 削除方式

Applicationは物理削除しない。

削除時は以下を更新する。

```text
applications.status = 'Deleted'
applications.deleted_at = <timestamp>
```

通常のApplication一覧では、削除済みApplicationを返さない。

```text
GET /api/applications
```

は、原則として以下のみを返す。

```text
deleted_at IS NULL
```

削除済みApplicationの詳細取得は、初期仕様では以下を返す。

```text
404 Not Found
```

将来の管理・監査用途として、以下のような取得方法は別途検討可能とする。

```text
GET /api/applications/{applicationId}?includeDeleted=true
```

## 10.2 正規の削除API

Application削除は、以下のOperationとして実行する。

```text
POST /api/applications/{applicationId}/operations
```

```json
{
  "type": "delete",
  "parameters": {
    "mode": "configOnly"
  }
}
```

以下は正規APIから外す。

```text
DELETE /api/applications/{applicationId}
```

OpenAPIにも掲載しない。

---

## 10.3 delete.mode: configOnly

実施内容:

* `applications.status = 'Deleted'`
* `applications.deleted_at` を設定
* routeを無効化する
* deploymentの公開設定を解放状態にする
* proxy / DNS / infrastructure sync対象から除外する
* source directoryは削除しない
* containerは削除しない
* volume / appdataは削除しない

用途:

* DB上のApplication設定を通常画面から消す
* ただし、実体ファイルやコンテナは残す

---

## 10.4 delete.mode: sourceAndConfig

実施内容:

* `configOnly` の内容をすべて実行
* source directoryを削除する

削除しないもの:

* container
* volume
* appdata

---

## 10.5 delete.mode: full

実施内容:

* `configOnly` の内容をすべて実行
* container停止・削除を行う
* source directoryを削除する
* appdata / volume削除を行う
* proxy / DNS / infrastructure syncを実行し、公開経路から完全に除外する

---

# 11. 削除済みApplicationのname / hostname再利用

## 11.1 基本方針

削除済みApplicationの `name` / `hostname` は再利用可能にする。

理由:

* ユーザーが削除後に同じ名前で作り直せる
* 管理ダッシュボード用途では自然
* 論理削除によって古いrecordを残しても、通常運用を妨げない

---

## 11.2 applications.name

現行のような単純なUNIQUE制約は避ける。

変更前のイメージ:

```sql
name TEXT NOT NULL UNIQUE
```

変更後は、削除済みApplicationを除外したpartial unique indexにする。

```sql
CREATE UNIQUE INDEX idx_applications_name_active
ON applications(name)
WHERE deleted_at IS NULL;
```

これにより、削除済みApplicationと同じnameで再作成できる。

---

## 11.3 deployments.hostname

`deployments.hostname` も、削除済みApplicationに紐づく古いDeploymentを除外して再利用可能にする。

SQLiteのpartial indexでは別テーブルの `applications.deleted_at` を直接参照できないため、`deployments` 側にも解放状態を持たせる。

追加カラム:

```text
deployments.released_at
```

delete Operation完了時に、対象ApplicationのDeploymentを以下のように更新する。

```text
deployments.released_at = <timestamp>
```

hostnameの一意制約は、`released_at IS NULL` のDeploymentのみ対象にする。

```sql
CREATE UNIQUE INDEX idx_deployments_hostname_active
ON deployments(hostname)
WHERE released_at IS NULL;
```

これにより、削除済みApplicationが使っていたhostnameを新しいApplicationで再利用できる。

---

# 12. 関連設定の扱い

Applicationは物理削除しないため、既存の `ON DELETE CASCADE` は通常APIでは発火しない。

そのため、delete Operation側で関連設定を明示的に整理する。

---

## 12.1 deployments

delete Operation完了時に以下を行う。

```text
deployments.released_at = <timestamp>
```

意味:

* hostnameを再利用可能にする
* 通常のDeployment取得・公開設定生成の対象から外す
* Operation履歴・監査用にはrecordを残す

---

## 12.2 routes

delete Operation完了時に、対象Applicationのrouteを無効化する。

追加カラム候補:

```text
routes.enabled
routes.released_at
```

推奨:

```text
routes.enabled = 0
routes.released_at = <timestamp>
```

意味:

* proxy / DNS生成対象から外す
* routing履歴は残す
* 削除済みApplicationが外部公開され続けることを防ぐ

---

## 12.3 update_info

`update_info` は物理削除しない。

通常APIでは、削除済みApplicationに紐づく `update_info` を返さない。

理由:

* 監査・履歴として残せる
* 削除済みApplicationの通常UI表示には不要

---

## 12.4 container_instances

modeごとに扱いを分ける。

### configOnly

* containerは削除しない
* container_instancesは原則そのまま残す
* Applicationは通常一覧から消える
* route / proxy / DNS対象からは外す

### sourceAndConfig

* containerは削除しない
* container_instancesは原則そのまま残す
* source directoryは削除する
* route / proxy / DNS対象からは外す

### full

* container停止・削除を行う
* container_instancesは削除済みまたは停止状態として更新する
* appdata / volume削除も実行する

---

## 12.5 generated proxy config / DNS hosts

delete Operation完了後、必ずinfrastructure syncを行う。

削除済みApplicationは以下の生成対象から除外する。

* proxy config
* DNS hosts
* route generation
* infrastructure sync

除外条件:

```text
applications.deleted_at IS NOT NULL
```

または

```text
deployments.released_at IS NOT NULL
```

または

```text
routes.enabled = 0
```

実装上は、生成ロジック内で削除済みApplicationを必ず除外する。

---

# 13. OperationとApplicationの状態分離

OperationとApplicationの状態は分離する。

* `operation.status`: 操作実行単位の状態
* `operation.currentStepId`: 現在のStep ID
* `operation.currentStepName`: 現在のStep名
* `application.status`: アプリケーション自体の状態
* `application.health`: 実行中コンテナやルーティングの健全性

Operationが `succeeded` でも、Applicationが後から落ちる可能性がある。

Operationが `failed` でも、既存Applicationが以前の状態で動き続けている可能性がある。

---

# 14. operations.application_id の外部キー削除ポリシー

Applicationは物理削除しないため、`operations.application_id` は `NOT NULL` とする。

外部キーは以下の方針とする。

```sql
FOREIGN KEY(application_id)
REFERENCES applications(application_id)
ON DELETE RESTRICT
```

方針:

* Operation履歴を残す
* OperationからApplicationを必ず辿れるようにする
* Applicationの物理削除は通常APIでは行わない
* 物理削除が必要な場合はmaintenance処理として別途扱う

---

# 15. DB CHECK制約

Operation / Step / Log のenum値は、TypeScript / ZodだけでなくDB側でも守る。

## 15.1 operations.status

```sql
status TEXT NOT NULL CHECK (
  status IN (
    'queued',
    'running',
    'succeeded',
    'failed',
    'cancelled',
    'interrupted'
  )
)
```

## 15.2 operations.type

```sql
type TEXT NOT NULL CHECK (
  type IN (
    'deploy',
    'restart',
    'stop',
    'resume',
    'rebuild',
    'update-check',
    'update',
    'rollback',
    'delete'
  )
)
```

## 15.3 operation_steps.status

```sql
status TEXT NOT NULL CHECK (
  status IN (
    'pending',
    'running',
    'succeeded',
    'failed',
    'skipped'
  )
)
```

## 15.4 operation_logs.stream

```sql
stream TEXT NOT NULL CHECK (
  stream IN (
    'stdout',
    'stderr',
    'system'
  )
)
```

## 15.5 applications.status

`Deleted` を正式なApplication statusとして追加する。

```sql
status TEXT NOT NULL CHECK (
  status IN (
    'Registered',
    'Cloning',
    'Deploying',
    'Running',
    'Stopped',
    'Failed',
    'Deleted'
  )
)
```

実際のstatus候補は既存実装に合わせて最終調整する。

## 15.6 logs_available

```sql
logs_available INTEGER NOT NULL DEFAULT 1 CHECK (
  logs_available IN (0, 1)
)
```

## 15.7 routes.enabled

```sql
enabled INTEGER NOT NULL DEFAULT 1 CHECK (
  enabled IN (0, 1)
)
```

---

# 16. 同時実行・二重実行の制御

同じApplicationに対して、`queued` または `running` のOperationがある場合、新しいOperationを拒否する。

単純な `active operationを検索 → なければinsert` では、同時リクエスト時に二重作成される可能性がある。

そのため、active Operation確認とOperation作成は同一transactionで実行する。

SQLiteでは `BEGIN IMMEDIATE` 相当で書き込みロックを取る。

Operation作成時:

```text
BEGIN IMMEDIATE
  active Operation確認
  Operation insert
  initial Steps insert
COMMIT
```

推奨index:

```sql
CREATE UNIQUE INDEX idx_operations_one_active_per_application
ON operations(application_id)
WHERE status IN ('queued', 'running');
```

active Operationがある場合のエラー:

```json
{
  "error": {
    "code": "APPLICATION_OPERATION_CONFLICT",
    "message": "Another operation is already running for this application.",
    "details": {
      "applicationId": "app_123",
      "activeOperationId": "op_456"
    }
  }
}
```

---

# 17. Cancel / Retry仕様

## 17.1 Cancel

Cancel仕様:

* `queued` Operation: cancel可能
* `running` Operation: 初期実装ではcancel不可
* `succeeded` Operation: cancel不可
* `failed` Operation: cancel不可
* `interrupted` Operation: cancel不可

running Operation cancel時:

* `409 Conflict` を返す

running cancelの将来対応:

* AbortController
* child process kill
* Step状態更新
* Operation状態更新
* Docker Compose停止
* 後始末処理

---

## 17.2 Retry

Retry仕様:

* `POST /api/operations/{operationId}/retry` は新しいOperationを作成する
* 元Operation自体のstatusは変更しない
* 新Operationには `retryOfOperationId` を持たせる
* 元Operationの `type` と `parameters` をコピーする
* applicationIdも元Operationから引き継ぐ
* レスポンスは `202 Accepted` で新しいOperationを返す
* `failed` と `interrupted` をretry可能とする
* retry作成時にもactive Operation制約を適用する

Retry作成時のtransaction:

```text
BEGIN IMMEDIATE
  retry元Operationを取得
  retry可能statusか確認
  active Operation確認
  new Operation insert
  retry_of_operation_id 設定
  initial Steps insert
COMMIT
```

Retryレスポンス例:

```json
{
  "operationId": "op_999",
  "applicationId": "app_456",
  "type": "deploy",
  "status": "queued",
  "retryOfOperationId": "op_123",
  "canCancel": true,
  "canRetry": false,
  "links": {
    "self": "/api/operations/op_999",
    "logs": "/api/operations/op_999/logs"
  }
}
```

---

# 18. Operation Step管理

## 18.1 operation_stepsテーブル

想定テーブル:

```text
operation_steps
  step_id
  operation_id
  step_order
  name
  status
  started_at
  updated_at
  finished_at
  message
  error_code
  details
```

推奨制約:

```sql
UNIQUE(operation_id, step_order)
```

推奨index:

```sql
CREATE INDEX idx_operation_steps_operation_order
ON operation_steps(operation_id, step_order);
```

Step Status:

* `pending`
* `running`
* `succeeded`
* `failed`
* `skipped`

## 18.2 Step粒度

Step粒度は、実際のコマンド単位と一致させる。

`docker compose up -d --build` を1コマンドで実行する場合、Step名は以下とする。

```text
dockerComposeUpWithBuild
```

buildとupを実装上分ける場合のみ、以下に分ける。

```text
dockerComposeBuild
dockerComposeUp
```

初期Step例:

* `resolveRepository`
* `cloneOrPullRepository`
* `inspectCompose`
* `dockerComposeUpWithBuild`
* `syncInfrastructure`

Operation DTOには以下を含める。

* `currentStepId`
* `currentStepName`
* `currentStepOrder`

Step状態変更時は、OperationのcurrentStepも更新する。

将来拡張候補:

* `duration_ms`

---

# 19. Operation Log保存

## 19.1 operation_logsテーブル

想定テーブル:

```text
operation_logs
  log_id
  operation_id
  step_id
  sequence
  stream
  line
  created_at
```

stream:

* `stdout`
* `stderr`
* `system`

step_id:

* nullable
* まだStepに紐づかないsystem logやOperation全体ログではnullを許可する

必須制約:

```sql
UNIQUE(operation_id, sequence)
```

必須インデックス:

```sql
CREATE INDEX idx_operation_logs_operation_sequence
ON operation_logs(operation_id, sequence);
```

```sql
CREATE INDEX idx_operation_logs_operation_step
ON operation_logs(operation_id, step_id);
```

## 19.2 sequence採番方式

sequence採番方式:

* 単純な `MAX(sequence) + 1` は避ける
* Operation実行中はin-memoryのper-operation counterで採番する
* backend再起動時はDBの最大sequenceから再開する
* Command Runner側で一元的に採番する
* 保存時はbatch insertできるようにする
* log_idはUUIDまたはDB側autoincrementとしてsequenceとは別に持つ

sequenceの意味:

* `sequence` はbackendが受信した順序を表す
* stdout/stderr間の厳密なプロセス内発生順は保証しない
* UI表示順は `sequence ASC` を正とする

---

# 20. Command Runnerの逐次ログ対応

Command Runnerをログ保存対応にする。

処理イメージ:

```text
command-runner
  ↓
stdout / stderrを受信
  ↓
行単位に分割
  ↓
Redaction適用
  ↓
operation_logsへ保存
  ↓
in-memory pub/subへ配信
  ↓
dashboardへSSEで送信
```

Command Runnerに渡す情報:

* operationId
* stepId
* command
* args
* cwd
* env
* redactionContext

ログ保存時に必要な情報:

* operationId
* stepId
* stream
* line
* sequence
* createdAt

実行対象の例:

* git clone
* git pull
* docker compose build
* docker compose up
* docker compose down
* infrastructure sync関連コマンド

重要:

* command表示自体もRedaction対象にする
* Error.messageへ入れる内容もRedaction対象にする
* Operation errorへ保存する前にもRedactionを適用する

---

# 21. Operation Logs API

Operation Log取得API:

```text
GET /api/operations/{operationId}/logs
GET /api/operations/{operationId}/logs?tail=200
GET /api/operations/{operationId}/logs?after=128
GET /api/operations/{operationId}/logs?after=128&limit=1000
GET /api/operations/{operationId}/logs?stepId=step_123
```

仕様:

* `tail` は末尾N行を返す
* `after` は指定sequenceより後のログを昇順で返す
* `after` 指定時にも `limit` を適用する
* `limit` 省略時は 1,000
* `limit` 最大値は 1,000
* `tail` 最大件数は 1,000
* `tail` と `after` を同時指定した場合、初期仕様では `after` を優先する
* レスポンスはsequence昇順で返す
* running Operationのログは削除対象にしない
* Operationの `logsAvailable=false` の場合は空配列と `logsAvailable=false` を返す

レスポンス例:

```json
{
  "operationId": "op_123",
  "logsAvailable": true,
  "items": [
    {
      "sequence": 129,
      "stepId": "step_4",
      "stream": "stdout",
      "line": "#12 building image...",
      "createdAt": "2026-06-20T10:01:00.000Z"
    }
  ],
  "nextAfter": 129,
  "hasMore": false
}
```

ログ削除済みレスポンス例:

```json
{
  "operationId": "op_123",
  "logsAvailable": false,
  "items": [],
  "nextAfter": null,
  "hasMore": false
}
```

---

# 22. リアルタイムログ表示用SSE

## 22.1 基本方針

リアルタイム配信はDBポーリングに依存しない。

推奨構成:

```text
command-runner
  ↓
operation_logsへ永続保存
  ↓
in-memory pub/subへ配信
  ↓
SSEでdashboardへ配信
```

SSE API:

```text
GET /api/operations/{operationId}/logs/stream
```

SSEイベント種別:

* `log`
* `step`
* `operation`
* `heartbeat`

---

## 22.2 logイベント

```text
event: log
data: {
  "operationId": "op_123",
  "sequence": 129,
  "stepId": "step_4",
  "stream": "stdout",
  "line": "#12 building image...",
  "createdAt": "2026-06-20T10:01:00.000Z"
}
```

---

## 22.3 stepイベント

```text
event: step
data: {
  "operationId": "op_123",
  "stepId": "step_4",
  "name": "dockerComposeUpWithBuild",
  "status": "running",
  "message": "Running docker compose up...",
  "startedAt": "2026-06-20T10:01:00.000Z",
  "updatedAt": "2026-06-20T10:01:10.000Z",
  "finishedAt": null
}
```

---

## 22.4 operationイベント

```text
event: operation
data: {
  "operationId": "op_123",
  "status": "running",
  "currentStepId": "step_4",
  "currentStepName": "dockerComposeUpWithBuild",
  "currentStepOrder": 4,
  "updatedAt": "2026-06-20T10:01:10.000Z",
  "canCancel": false,
  "canRetry": false
}
```

---

## 22.5 heartbeat

```text
event: heartbeat
data: {
  "operationId": "op_123",
  "timestamp": "2026-06-20T10:01:30.000Z"
}
```

---

## 22.6 再接続時の流れ

再接続時は以下の流れにする。

1. `GET /api/operations/{operationId}` でOperationとStepsの最新snapshotを取得する
2. `GET /api/operations/{operationId}/logs?after=lastSequence&limit=1000` で不足ログを取得する
3. `GET /api/operations/{operationId}/logs/stream` を購読する

理由:

* logはsequenceで補完できる
* step/operationイベントにはlog sequenceがない
* 再接続時はOperation/Stepsのsnapshot取得で状態差分を補完する

---

## 22.7 terminal status

以下をterminal statusとする。

* `succeeded`
* `failed`
* `cancelled`
* `interrupted`

Operationがterminal statusになったら、SSE streamを終了する。

終了フロー:

1. 最後のlogイベントを送る
2. 最後のstepイベントを送る
3. terminal statusのoperationイベントを送る
4. SSE接続を閉じる

terminal operationイベント例:

```text
event: operation
data: {
  "operationId": "op_123",
  "status": "succeeded",
  "currentStepId": "step_5",
  "currentStepName": "syncInfrastructure",
  "currentStepOrder": 5,
  "updatedAt": "2026-06-20T10:05:00.000Z",
  "finishedAt": "2026-06-20T10:05:00.000Z",
  "canCancel": false,
  "canRetry": false
}
```

---

## 22.8 terminal OperationへのSSE接続

terminal Operationに対して以下へ接続された場合:

```text
GET /api/operations/{operationId}/logs/stream
```

初期仕様では、以下の挙動とする。

1. terminal statusのoperationイベントを1回送る
2. すぐにSSE接続を閉じる
3. 409 Conflictにはしない

理由:

* クライアントは同じSSE処理系でterminal statusを受け取れる
* reconnect loopを避けられる
* 最終状態の正本は `GET /api/operations/{operationId}` として扱える

クライアント側の方針:

* terminal statusを受け取ったら再接続しない
* SSE接続が途中で切れた場合は、まず `GET /api/operations/{operationId}` で最新状態を確認する
* 最新状態がterminal statusなら再接続しない
* 最新状態がrunningまたはqueuedなら、snapshot + logs差分取得後に再接続する

---

## 22.9 初期前提と将来拡張

初期前提:

* 単一backendインスタンス前提
* in-memory pub/subを使用する
* 永続化はSQLiteのoperation_logsを正とする

将来拡張:

* 複数backendインスタンス化する場合、pub/subをRedis、NATS、PostgreSQL LISTEN/NOTIFYなどに差し替える
* pub/subはinterface化し、in-memory実装に閉じない

---

# 23. Redaction方針

RedactionはOperation Log保存前だけでなく、以下すべてに適用する。

対象:

* 保存するlog line
* system streamに出すcommand表示
* operation.error.message
* operation.error.details
* operation.result
* operation_steps.message
* operation_steps.details
* operation_steps.error_codeに付随する詳細
* 例外としてthrowするError.message
* system event message
* SSE payload
* debug用に返すcommand
* API responseに含めるerror.details

マスク対象:

* `Authorization: Bearer ...`
* `Authorization: Basic ...`
* `KEY=value` 形式
* `token=...`
* `password=...`
* `secret=...`
* `api_key=...`
* URL内のuserinfo
* GitHub tokenを含むclone URL
* `.env` やdeployment設定から注入された既知のsecret値
* envOverridesに含まれる値

方針:

* 保存前にマスクする
* 表示時だけのマスクには依存しない
* キー名ベースだけでなく、既知のsecret値そのものも置換対象にする
* マスク済みの値は `********` などに統一する
* Redactionは共通関数として実装する

---

# 24. ログ保存期間・上限

ログを無制限に保存すると、DB肥大化とセキュリティリスクにつながる。

初期値:

* 保存期間: 30日
* Operationごとの最大ログ行数: 10,000行
* 1行の最大長: 8KB
* tail最大件数: 1,000行
* after取得時のlimit最大件数: 1,000行
* 古いログ削除: 起動時または定期実行

削除ルール:

* running Operationのログは削除しない
* queued Operationのログは基本的に削除対象外
* succeeded / failed / cancelled / interrupted のうち、保存期間を超えたものを削除対象にする
* Operation本体を残す場合、operation_logsのみ削除してよい
* operation_logsを削除したOperationでは `logs_available=false` に更新する
* `logs_available=false` のOperationではLogs APIが空配列を返す

---

# 25. Transaction Boundary

トランザクション化する範囲を決める。

必ずtransaction化する処理:

* active Operation確認
* Operation作成
* 初期Step作成
* Operation開始
* Step開始
* Step完了
* Operation完了
* Operation失敗
* Operationキャンセル
* Operation retry作成
* backend再起動時の未完了Operation整理
* logs削除時の `logs_available=false` 更新
* delete Operation完了時のApplication / Deployment / Route整理

Operation作成時:

```text
BEGIN IMMEDIATE
  active Operation確認
  Operation insert
  initial Steps insert
COMMIT
```

Operation完了時:

```text
BEGIN
  current Stepをsucceededまたはfailedへ更新
  Operationをsucceededまたはfailedへ更新
  resultまたはerrorを保存
  updated_atを更新
  finished_atを保存
COMMIT
```

delete Operation完了時:

```text
BEGIN
  applications.status = 'Deleted'
  applications.deleted_at = now
  deployments.released_at = now
  routes.enabled = 0
  routes.released_at = now
  Operationをsucceededへ更新
  updated_at / finished_at を更新
COMMIT
```

ログ1行ごとの保存は、基本的に巨大transactionには含めない。

---

# 26. backend再起動時の未完了Operation整理

backend再起動時に、queuedまたはrunningのOperationが残っていると、UI上で永遠に実行中に見える可能性がある。

起動時に未完了Operationを整理する。

対象:

* `queued`
* `running`

初期方針:

* `queued` → `interrupted`
* `running` → `interrupted`

保存するerror:

```json
{
  "code": "OPERATION_INTERRUPTED",
  "message": "Operation was interrupted by backend restart.",
  "details": {
    "reason": "backend_restart"
  }
}
```

Retry:

* interrupted Operationはretry可能
* `canRetry = true`

---

# 27. 標準エラーレスポンス

エラー形式を以下に統一する。

```json
{
  "error": {
    "code": "DEPLOYMENT_FAILED",
    "message": "Docker compose failed.",
    "details": {
      "applicationId": "app_123",
      "operationId": "op_456",
      "failedStepId": "step_4",
      "failedStepName": "dockerComposeUpWithBuild"
    },
    "requestId": "req_789"
  }
}
```

含める項目:

* code
* message
* details
* requestId
* operationId
* failedStepId
* failedStepName

注意:

* message、detailsにもRedactionを適用する
* 秘匿情報を含むcommandやstderrをそのまま返さない
* 詳細ログはOperation Logs APIで確認する
* DB保存時は `error_code` / `error_message` / `error_details` に分けて保存する

---

# 28. Runtime LogとOperation Logの分離

## 28.1 Operation Log

```text
GET /api/operations/{operationId}/logs
```

用途:

* deploy / rebuild / update / deleteなどの実行ログ
* stdout / stderr / system
* Operation単位
* Step単位

## 28.2 Runtime Log

```text
GET /api/applications/{applicationId}/runtime-logs
```

用途:

* 起動済みコンテナのログ
* docker compose logs相当
* 現在稼働中のアプリ状態確認

## 28.3 Event

```text
GET /api/events
```

用途:

* 人間向け履歴
* 監査
* UIの履歴表示

---

# 29. Repository層

Operation中心設計では、DB操作の入口をRepositoryに集約する。

初期対象:

* `operation.repository.ts`
* `operation-step.repository.ts`
* `operation-log.repository.ts`

構成例:

```text
src/modules/operations/
  operation.routes.ts
  operation.service.ts
  operation.repository.ts
  operation-step.repository.ts
  operation-log.repository.ts
  operation-runner.ts
  operation.schemas.ts
  operation-types.ts
```

Repositoryの責務:

* SELECT
* INSERT
* UPDATE
* DELETE
* JOIN
* transaction内で実行されるDB操作
* DB型とAPI DTOの変換

Serviceの責務:

* 業務処理
* Operation Typeごとの実行判断
* 状態遷移
* Repositoryの呼び出し
* エラー判断
* Redaction適用

Routeの責務:

* URL定義
* HTTPメソッド定義
* リクエストバリデーション
* レスポンス返却

Repository横展開は、Operation周辺が安定した後に行う。

次に移行:

* `application.repository.ts`
* `deployment.repository.ts`

最後に移行:

* `event.repository.ts`
* `infrastructure.repository.ts`
* runtime-log関連

---

# 30. DB migration方針

`jobs` テーブルを正式に `operations` へ置き換える。

対応方針:

* 新規環境では `operations` テーブルのみ作成する
* 既存環境ではmigrationで `jobs` から `operations` へ移す
* 外部APIに `jobId` は出さない
* 内部コード上も `Job` 呼称を削除する
* migrationは冪等にする
* migration前にDBバックアップを作成する

移行後:

* `job_id` → `operation_id`
* `related_application_id` → `application_id`
* `request_payload` → `parameters`
* `message` → `error_message` または status message
* `type` → `type`
* `status` → `status`
* `created_at` → `created_at`
* `started_at` → `started_at`
* `finished_at` → `finished_at`
* `updated_at` → migration時点の現在時刻、または既存値があれば既存値

status移行:

* `queued` → `queued`
* `running` → `running`
* `succeeded` → `succeeded`
* `failed` → `failed`
* `cancelled` → `cancelled`

backend再起動時に未完了だったもの:

* `queued` → `interrupted`
* `running` → `interrupted`

Migration受け入れ基準:

* 既存 `jobs` の履歴が `operations` に移行される
* `request_payload` が `parameters` として移行される
* `related_application_id` が `application_id` として移行される
* 既存の `queued` / `running` は起動時に `interrupted` へ整理される
* `jobs` テーブル削除前にmigrationが冪等である
* migration前にDBバックアップ方針が定義されている
* migration失敗時にDBバックアップから復旧できる
* migration後に `/api/jobs` がOpenAPIから除外されている
* migration後にfrontendが `/api/jobs` を参照していない

---

# 31. Release分割

## Release 1: Operation基盤と破壊的移行

* `operations` テーブル追加
* `jobs` → `operations` migration
* Operation DTO
* Operation Type schema
* Operation Repository
* 新Operation API
* 旧API削除
* OpenAPI更新
* frontend呼び出し更新
* README更新
* Application削除APIをdelete Operationへ統一
* `DELETE /api/applications/{applicationId}` を削除
* `applications.deleted_at` 追加
* `deployments.released_at` 追加
* `routes.enabled` / `routes.released_at` 追加

## Release 2: Stepと状態遷移

* `operation_steps`
* `currentStepId`
* `currentStepName`
* `currentStepOrder`
* Step状態更新
* `failedStepId`
* `failedStepName`
* backend restart時の `interrupted`

## Release 3: LogとRedaction

* `operation_logs`
* Command Runner逐次ログ化
* `sequence`
* `tail` / `after` / `limit` / `hasMore`
* Redaction共通関数
* 保存期間・上限・削除処理
* `logsAvailable`

## Release 4: SSE

* in-memory pub/sub
* `log / step / operation / heartbeat`
* snapshot + after補完
* reconnect flow
* pub/sub interface化

---

# 32. BFFについて

現時点では、独立したBFFは追加しない。

理由:

* 今回の主課題はCore Backend内部の責務整理である
* Operation APIを整備すれば、ダッシュボード側の多くの要件はCore Backendで吸収できる
* 今BFFを追加すると、API層が増えて責務がさらに見えにくくなる可能性がある
* SSEログ配信も初期段階ではCore Backendで実装できる
* フロントエンドが管理ダッシュボード中心であれば、BFFの効果は限定的

将来BFFを検討する条件:

* 管理ダッシュボード以外のUIが増える
* UIごとに必要なレスポンス形状が大きく異なる
* 複数バックエンドを集約する必要が出る
* 認証、セッション、CSRF、Cookie管理をUI専用に分離したい
* ダッシュボード専用の集約APIがCore APIを汚し始める

現時点の判断:

```text
BFFは追加しない。
まずCore BackendをOperation中心に整理する。
```

---

# 33. 受け入れ基準

## 33.1 Release / Migration

* backendとfrontendが同一PR、または同一リリースで切り替えられている
* OpenAPIから旧操作APIと `/api/jobs` 系APIが削除されている
* READMEの主要API一覧が新Operation APIに更新されている
* frontendが旧操作APIと `/api/jobs` を参照していない
* migration前にDBバックアップ方針が定義されている
* `jobs` → `operations` migrationが冪等である
* 既存 `jobs` の履歴が `operations` に移行される
* `request_payload` が `parameters` として移行される
* `related_application_id` が `application_id` として移行される
* 既存の `queued` / `running` は起動時に `interrupted` へ整理される
* migration失敗時にDBバックアップから復旧できる

## 33.2 Operation API

* 旧操作APIではなく、新Operation APIが正として実装されている
* `/api/jobs` 系APIが削除されている
* Operation作成時、applicationIdはURLを正として扱う
* request bodyにapplicationIdを含めない
* Operation DTOに以下が含まれる

  * operationId
  * applicationId
  * type
  * status
  * currentStepId
  * currentStepName
  * currentStepOrder
  * parameters
  * result
  * error
  * retryOfOperationId
  * logsAvailable
  * canCancel
  * canRetry
  * links
  * createdAt
  * updatedAt
  * startedAt
  * finishedAt

## 33.3 Application削除

* `DELETE /api/applications/{applicationId}` が正規APIから除外されている
* Application削除は `type: delete` のOperationとして実行される
* delete.modeが `configOnly | sourceAndConfig | full` として定義されている
* delete Operation完了時に `applications.status = 'Deleted'` になる
* delete Operation完了時に `applications.deleted_at` が設定される
* 通常の `GET /api/applications` は `deleted_at IS NULL` のApplicationのみ返す
* 削除済みApplicationの `GET /api/applications/{applicationId}` の挙動が定義されている
* 削除済みApplicationの `name` は再利用できる
* 削除済みApplicationの `hostname` は再利用できる
* `full` delete後、proxy / DNS / infrastructure syncの対象から外れる

## 33.4 DB制約

* `applications.name` のUNIQUE制約がpartial unique indexへ置き換えられている
* `deployments.hostname` のUNIQUE制約がactive deploymentのみを対象にしている
* `applications.deleted_at` が追加されている
* `deployments.released_at` が追加されている
* `routes.enabled` または `routes.released_at` が追加されている
* `operations.application_id` は `NOT NULL`
* `operations.application_id` は `ON DELETE RESTRICT` 相当
* `operations.status` にCHECK制約がある
* `operations.type` にCHECK制約がある
* `operation_steps.status` にCHECK制約がある
* `operation_logs.stream` にCHECK制約がある
* `applications.status` に `Deleted` が含まれている
* `logs_available` にCHECK制約がある

## 33.5 関連設定

* delete Operation完了時にdeploymentが解放状態になる
* delete Operation完了時にrouteが無効化される
* 削除済みApplicationはproxy config生成対象から除外される
* 削除済みApplicationはDNS hosts生成対象から除外される
* 削除済みApplicationはinfrastructure sync対象から除外される
* `configOnly` ではsource / container / volumeを削除しない
* `sourceAndConfig` ではsourceを削除し、container / volumeは削除しない
* `full` ではcontainer / source / appdata / volumeを削除対象にする

## 33.6 Cancel / Retry

* queued Operationはcancelできる
* running Operationのcancelは初期実装では409を返す
* failed Operationはretryできる
* interrupted Operationはretryできる
* retryは新しいOperationを作成する
* retry元は `retryOfOperationId` で紐づく
* 元Operationのstatusは変更されない
* retry作成時にもactive Operation制約が適用される
* retry作成時のactive checkとinsertが同一transactionである
* active Operationがある場合、retryは `APPLICATION_OPERATION_CONFLICT` で拒否される

## 33.7 Step

* operation_stepsにstep_orderがある
* operation_stepsにupdated_atがある
* Stepの粒度が実際のコマンド粒度と一致している
* Operation DTOにcurrentStepId/currentStepName/currentStepOrderが含まれる
* deploy失敗時にfailedStepId/failedStepNameが返る

## 33.8 Log

* operation_logsにUNIQUE(operation_id, sequence)がある
* operation_logs.step_idはnullableとして定義されている
* after=sequenceでログ差分が順序どおり返る
* after指定時にもlimit最大件数が適用される
* limit省略時は1,000件になる
* limit最大値は1,000件である
* Logs APIレスポンスにhasMoreが含まれる
* tailの最大件数が制限されている
* tailとafterの同時指定時はafterが優先される
* sequenceはbackend受信順である
* stdout/stderrのOSレベルの厳密順序は保証しない
* UI表示順はsequence ASCである
* Command Runnerがstdout/stderrを逐次保存できる
* logs削除済みOperationでは `logsAvailable=false` が返る
* running Operationのログは削除されない

## 33.9 Redaction

* 保存前に秘匿情報がマスクされる
* token/password/secret/authorizationがログに平文保存されない
* command表示にもRedactionが適用される
* operation.error.messageにもRedactionが適用される
* operation.error.detailsにもRedactionが適用される
* operation.resultにもRedactionが適用される
* step.messageにもRedactionが適用される
* step.detailsにもRedactionが適用される
* system eventにもRedactionが適用される
* SSE payloadにもRedactionが適用される

## 33.10 SSE

* SSEでlog/step/operation/heartbeatイベントを受け取れる
* SSE再接続時にOperation/Steps snapshotを取得する
* SSE再接続時にafter=sequenceで不足ログを補完できる
* リアルタイム表示がDBポーリングに依存しない
* in-memory pub/subが単一backend前提として明記されている
* 将来のRedis/NATS等への差し替えを見据えてinterface化されている
* terminal status到達時にterminal operationイベントが送信される
* terminal operationイベント送信後にSSE接続が閉じられる
* terminal Operationに `/logs/stream` 接続した場合、terminal operation eventを1回送って閉じる
* terminal Operationへのstream接続では409を返さない
* クライアントはterminal status受信後に再接続しない
* 接続断時は `GET /api/operations/{operationId}` で最新状態を確認する
* latest Operationがterminal statusならSSE再接続しない

## 33.11 Runtime Log / Event

* Operation LogsとRuntime Logsが混在しない
* Runtime Logsは `/api/applications/{applicationId}/runtime-logs` で取得する
* Eventは人間向け履歴として扱う

## 33.12 Backend Restart

* backend再起動時にqueued/running Operationがinterruptedへ更新される
* interrupted OperationはcanRetry=trueになる
* running Operationのログは削除されない

## 33.13 Documentation

* API Trace Mapが作成されている
* Operation APIがOpenAPIに反映されている
* 旧Job APIや旧操作APIがOpenAPIから除外されている
* READMEの主要API一覧が新Operation APIに更新されている

---

# 34. 実装上の重要方針

* 互換性維持よりも新仕様への統一を優先する
* 旧Job APIと新Operation APIを併存させない
* Operation DTOとparameter schemaを最初に固定する
* `jobs` ではなく `operations` を正式テーブルとして扱う
* 破壊的migrationはfrontend、OpenAPI、README更新と同じリリースで行う
* Operation作成と同時実行制御は必ずtransactionで行う
* `interrupted` は正式なOperation statusにする
* retryは元Operationを再利用せず、新しいOperationを作る
* Application削除もOperationに統一する
* `DELETE /api/applications/{applicationId}` は正規APIから外す
* Applicationは `status = 'Deleted'` と `deleted_at` で論理削除する
* 削除済みApplicationの `name` / `hostname` は再利用可能にする
* `applications.name` はactive Applicationのみ一意にする
* `deployments.hostname` はactive Deploymentのみ一意にする
* delete Operation完了時にroute / proxy / DNS / infrastructure sync対象から外す
* Operation履歴を残すため、`operations.application_id` はNOT NULLのまま維持する
* Applicationの物理削除は通常APIでは行わない
* Operation関連のenum値はDB CHECK制約でも守る
* Stepを追加してからLogを追加する
* LogはOperationとStepに紐づける
* sequence採番方式を決めてからログ保存を実装する
* sequenceはbackend受信順と明記する
* Logs APIにはlimitとhasMoreを入れる
* logs削除済み状態は `logsAvailable=false` として表現する
* SSE再接続時はOperation/Steps snapshotとlogs差分取得を組み合わせる
* SSE streamはterminal status到達後に閉じる
* terminal Operationへのstream接続ではterminal eventを1回送って閉じる
* RedactionはOperation Logだけでなく、error、step、event、SSE、command表示にも適用する
* Runtime LogとOperation Logを混同しない
* Application StatusとOperation Statusを混同しない
* BFFは現時点では追加しない
