import { nanoid } from "nanoid";
import type Database from "better-sqlite3";
import { redactText } from "../operations/redaction.js";

type RecordEventInput = {
  scope: string;
  applicationId?: string | null;
  level: "info" | "warning" | "error";
  title: string;
  message: string;
  createdAt: string;
};

export function recordSystemEvent(db: Database.Database, input: RecordEventInput): string {
  const eventId = nanoid();
  db.prepare(
    `
      INSERT INTO system_events (
        event_id,
        scope,
        application_id,
        level,
        title,
        message,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    eventId,
    input.scope,
    input.applicationId ?? null,
    input.level,
    redactText(input.title),
    redactText(input.message),
    input.createdAt
  );
  return eventId;
}
