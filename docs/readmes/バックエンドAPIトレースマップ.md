# バックエンドAPIトレースマップ

## 目的

旧 Job / 旧操作 API から、新しい Operation API への対応を明示する。

## 旧API → 新API

| 旧API | 新API |
|---|---|
| `POST /api/applications/{applicationId}/restart` | `POST /api/applications/{applicationId}/operations` with `{ "type": "restart" }` |
| `POST /api/applications/{applicationId}/stop` | `POST /api/applications/{applicationId}/operations` with `{ "type": "stop" }` |
| `POST /api/applications/{applicationId}/resume` | `POST /api/applications/{applicationId}/operations` with `{ "type": "resume" }` |
| `POST /api/applications/{applicationId}/rebuild` | `POST /api/applications/{applicationId}/operations` with `{ "type": "rebuild", "parameters": { "keepData": true } }` |
| `POST /api/applications/{applicationId}/update-check` | `POST /api/applications/{applicationId}/operations` with `{ "type": "update-check" }` |
| `POST /api/applications/{applicationId}/update` | `POST /api/applications/{applicationId}/operations` with `{ "type": "update", "parameters": { "targetRevision": "<revision>" } }` |
| `POST /api/applications/{applicationId}/rollback` | `POST /api/applications/{applicationId}/operations` with `{ "type": "rollback", "parameters": { "targetRevision": "<revision>" } }` |
| `DELETE /api/applications/{applicationId}` | `POST /api/applications/{applicationId}/operations` with `{ "type": "delete", "parameters": { "mode": "configOnly\|sourceAndConfig\|full" } }` |
| `GET /api/jobs` | `GET /api/applications/{applicationId}/operations` |
| `POST /api/jobs/{jobId}/retry` | `POST /api/operations/{operationId}/retry` |
| `POST /api/jobs/{jobId}/cancel` | `POST /api/operations/{operationId}/cancel` |
| `GET /api/logs/{applicationId}` | `GET /api/applications/{applicationId}/runtime-logs` |

## 正規API

- `GET /api/applications`
- `POST /api/applications`
- `GET /api/applications/{applicationId}`
- `PATCH /api/applications/{applicationId}`
- `GET /api/applications/{applicationId}/deployment`
- `PATCH /api/applications/{applicationId}/deployment`
- `GET /api/applications/{applicationId}/deployment/inspection`
- `POST /api/applications/{applicationId}/operations`
- `GET /api/applications/{applicationId}/operations`
- `GET /api/operations/{operationId}`
- `POST /api/operations/{operationId}/cancel`
- `POST /api/operations/{operationId}/retry`
- `GET /api/operations/{operationId}/logs`
- `GET /api/operations/{operationId}/logs/stream`
- `GET /api/applications/{applicationId}/runtime-logs`
- `GET /api/events`

## 備考

- Operation の実行状態と Application 自体の状態は分離する
- Application 削除は論理削除であり、通常 API では物理削除しない
- `jobs` という外部概念は新仕様では使わない
