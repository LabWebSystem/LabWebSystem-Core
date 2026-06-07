import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { applySchema } from "../lib/schema.js";
import { prepareInsertEventStatement } from "../services/event-store.js";

test("stores a null application_id when the referenced application has already been deleted", () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applySchema(db);

  const insertEventStatement = prepareInsertEventStatement(db);
  insertEventStatement.run(
    "event-1",
    "runtime",
    "missing-app",
    "error",
    "再ビルドに失敗しました",
    "対象アプリはすでに削除されています。",
    "2026-06-07T00:00:00.000Z"
  );

  const row = db
    .prepare("SELECT application_id, title, message FROM system_events WHERE event_id = ?")
    .get("event-1") as { application_id: string | null; title: string; message: string } | undefined;

  assert.deepEqual(row, {
    application_id: null,
    title: "再ビルドに失敗しました",
    message: "対象アプリはすでに削除されています。"
  });
});

test("keeps application_id when the referenced application exists", () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applySchema(db);

  db.prepare(
    `
      INSERT INTO applications (
        application_id,
        name,
        description,
        repository_url,
        default_branch,
        current_commit,
        previous_commit,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    "app-1",
    "demo-app",
    null,
    "https://github.com/example/demo-app.git",
    "main",
    null,
    null,
    "Running",
    "2026-06-07T00:00:00.000Z",
    "2026-06-07T00:00:00.000Z"
  );

  const insertEventStatement = prepareInsertEventStatement(db);
  insertEventStatement.run(
    "event-2",
    "runtime",
    "app-1",
    "info",
    "再ビルドが完了しました",
    "アプリ demo-app を再ビルドしました。",
    "2026-06-07T00:00:00.000Z"
  );

  const row = db
    .prepare("SELECT application_id FROM system_events WHERE event_id = ?")
    .get("event-2") as { application_id: string | null } | undefined;

  assert.deepEqual(row, {
    application_id: "app-1"
  });
});
