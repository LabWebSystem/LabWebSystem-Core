import type Database from "better-sqlite3";

export function prepareInsertEventStatement(database: Database.Database): Database.Statement {
  return database.prepare(`
    INSERT INTO system_events (
      event_id,
      scope,
      application_id,
      level,
      title,
      message,
      created_at
    ) VALUES (?, ?, (SELECT application_id FROM applications WHERE application_id = ?), ?, ?, ?, ?)
  `);
}
