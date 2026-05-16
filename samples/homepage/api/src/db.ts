import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new Pool({
  connectionString: databaseUrl
});

export async function initDatabase(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
      progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
      timer_state TEXT NOT NULL DEFAULT 'idle' CHECK (timer_state IN ('idle', 'running', 'paused', 'done')),
      timer_duration_seconds INTEGER,
      timer_end_at TIMESTAMPTZ,
      timer_remaining_seconds INTEGER,
      evaluation_score INTEGER CHECK (evaluation_score BETWEEN 1 AND 5),
      evaluation_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
  `);
}

export async function markExpiredTimers(): Promise<void> {
  await pool.query(`
    UPDATE tasks
    SET timer_state = 'done',
        timer_remaining_seconds = 0,
        timer_end_at = NULL,
        updated_at = NOW()
    WHERE timer_state = 'running'
      AND timer_end_at IS NOT NULL
      AND timer_end_at <= NOW();
  `);
}
