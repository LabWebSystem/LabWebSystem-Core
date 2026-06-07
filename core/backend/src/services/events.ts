import { nanoid } from "nanoid";
import { db, nowIso } from "../lib/db.js";
import type { EventLevel } from "../types.js";
import { prepareInsertEventStatement } from "./event-store.js";

type RecordEventInput = {
  scope: string;
  applicationId?: string;
  level: EventLevel;
  title: string;
  message: string;
};

const insertEventStatement = prepareInsertEventStatement(db);

export function recordEvent(input: RecordEventInput): string {
  const eventId = nanoid();
  insertEventStatement.run(
    eventId,
    input.scope,
    input.applicationId ?? null,
    input.level,
    input.title,
    input.message,
    nowIso()
  );
  return eventId;
}
