import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { initDatabase, markExpiredTimers, pool } from "./db.js";

const app = new Hono();

const corsOrigin = process.env.CORS_ORIGIN ?? "*";
app.use("*", cors({ origin: corsOrigin }));

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200)
});

const updateTaskSchema = z.object({
  progress: z.number().int().min(0).max(100).optional(),
  status: z.enum(["pending", "in_progress", "completed"]).optional()
});

const timerSchema = z.object({
  durationSeconds: z.number().int().min(1).max(24 * 60 * 60)
});

const evaluationSchema = z.object({
  score: z.number().int().min(1).max(5),
  note: z.string().trim().max(2000).optional().default("")
});

type TaskRow = {
  id: number | string;
  title: string;
  status: "pending" | "in_progress" | "completed";
  progress: number;
  timer_state: "idle" | "running" | "paused" | "done";
  timer_duration_seconds: number | null;
  timer_end_at: string | null;
  timer_remaining_seconds: number | null;
  evaluation_score: number | null;
  evaluation_note: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

function mapTask(row: TaskRow) {
  const timerRemainingSeconds = row.timer_state === "running" && row.timer_end_at
    ? Math.max(0, Math.floor((new Date(row.timer_end_at).getTime() - Date.now()) / 1000))
    : row.timer_remaining_seconds;

  return {
    id: Number(row.id),
    title: row.title,
    status: row.status,
    progress: row.progress,
    timer: {
      state: row.timer_state,
      durationSeconds: row.timer_duration_seconds,
      endAt: row.timer_end_at,
      remainingSeconds: timerRemainingSeconds
    },
    evaluation: row.evaluation_score === null
      ? null
      : {
          score: row.evaluation_score,
          note: row.evaluation_note ?? ""
        },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at
  };
}

async function fetchTaskById(taskId: number): Promise<TaskRow | null> {
  const result = await pool.query<TaskRow>("SELECT * FROM tasks WHERE id = $1", [taskId]);
  return result.rows[0] ?? null;
}

app.get("/health", (c) => c.json({ ok: true }));

app.get("/api/tasks", async (c) => {
  await markExpiredTimers();
  const result = await pool.query<TaskRow>(`
    SELECT *
    FROM tasks
    WHERE status <> 'completed'
    ORDER BY created_at DESC;
  `);

  return c.json({ tasks: result.rows.map(mapTask) });
});

app.get("/api/tasks/history", async (c) => {
  await markExpiredTimers();
  const result = await pool.query<TaskRow>(`
    SELECT *
    FROM tasks
    WHERE status = 'completed'
    ORDER BY completed_at DESC NULLS LAST, updated_at DESC;
  `);

  return c.json({ tasks: result.rows.map(mapTask) });
});

app.post("/api/tasks", async (c) => {
  const payload = createTaskSchema.parse(await c.req.json());
  const result = await pool.query<TaskRow>(`
    INSERT INTO tasks (title, status, progress, timer_state, updated_at)
    VALUES ($1, 'pending', 0, 'idle', NOW())
    RETURNING *;
  `, [payload.title]);

  return c.json({ task: mapTask(result.rows[0]) }, 201);
});

app.patch("/api/tasks/:id", async (c) => {
  const taskId = Number(c.req.param("id"));
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return c.json({ error: "invalid task id" }, 400);
  }

  const payload = updateTaskSchema.parse(await c.req.json());
  const current = await fetchTaskById(taskId);

  if (!current) {
    return c.json({ error: "task not found" }, 404);
  }

  const nextProgress = payload.progress ?? current.progress;
  const nextStatus = payload.status ?? (nextProgress >= 100 ? "completed" : current.status);
  const completedAt = nextStatus === "completed" ? "NOW()" : "NULL";

  const result = await pool.query<TaskRow>(`
    UPDATE tasks
    SET progress = $2,
        status = $3,
        completed_at = ${completedAt},
        updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `, [taskId, nextProgress, nextStatus]);

  return c.json({ task: mapTask(result.rows[0]) });
});

app.delete("/api/tasks/:id", async (c) => {
  const taskId = Number(c.req.param("id"));
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return c.json({ error: "invalid task id" }, 400);
  }

  const result = await pool.query("DELETE FROM tasks WHERE id = $1", [taskId]);
  if (result.rowCount === 0) {
    return c.json({ error: "task not found" }, 404);
  }

  return c.json({ ok: true });
});

app.post("/api/tasks/:id/timer", async (c) => {
  const taskId = Number(c.req.param("id"));
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return c.json({ error: "invalid task id" }, 400);
  }

  const payload = timerSchema.parse(await c.req.json());
  const result = await pool.query<TaskRow>(`
    UPDATE tasks
    SET timer_state = 'running',
        timer_duration_seconds = $2,
        timer_end_at = NOW() + make_interval(secs => $2::int),
        timer_remaining_seconds = NULL,
        updated_at = NOW(),
        status = CASE WHEN status = 'pending' THEN 'in_progress' ELSE status END
    WHERE id = $1
    RETURNING *;
  `, [taskId, payload.durationSeconds]);

  if (result.rowCount === 0) {
    return c.json({ error: "task not found" }, 404);
  }

  return c.json({ task: mapTask(result.rows[0]) });
});

app.post("/api/tasks/:id/timer/pause", async (c) => {
  const taskId = Number(c.req.param("id"));
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return c.json({ error: "invalid task id" }, 400);
  }

  const task = await fetchTaskById(taskId);
  if (!task) {
    return c.json({ error: "task not found" }, 404);
  }

  if (task.timer_state !== "running" || !task.timer_end_at) {
    return c.json({ error: "timer is not running" }, 409);
  }

  const remaining = Math.max(0, Math.floor((new Date(task.timer_end_at).getTime() - Date.now()) / 1000));
  const nextState = remaining === 0 ? "done" : "paused";

  const result = await pool.query<TaskRow>(`
    UPDATE tasks
    SET timer_state = $2,
        timer_remaining_seconds = $3,
        timer_end_at = NULL,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `, [taskId, nextState, remaining]);

  return c.json({ task: mapTask(result.rows[0]) });
});

app.post("/api/tasks/:id/timer/resume", async (c) => {
  const taskId = Number(c.req.param("id"));
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return c.json({ error: "invalid task id" }, 400);
  }

  const task = await fetchTaskById(taskId);
  if (!task) {
    return c.json({ error: "task not found" }, 404);
  }

  if (task.timer_state !== "paused") {
    return c.json({ error: "timer is not paused" }, 409);
  }

  const remaining = task.timer_remaining_seconds ?? task.timer_duration_seconds ?? 0;
  if (remaining <= 0) {
    return c.json({ error: "remaining time is not available" }, 409);
  }

  const result = await pool.query<TaskRow>(`
    UPDATE tasks
    SET timer_state = 'running',
        timer_end_at = NOW() + make_interval(secs => $2::int),
        timer_remaining_seconds = NULL,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `, [taskId, remaining]);

  return c.json({ task: mapTask(result.rows[0]) });
});

app.delete("/api/tasks/:id/timer", async (c) => {
  const taskId = Number(c.req.param("id"));
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return c.json({ error: "invalid task id" }, 400);
  }

  const result = await pool.query<TaskRow>(`
    UPDATE tasks
    SET timer_state = 'idle',
        timer_duration_seconds = NULL,
        timer_end_at = NULL,
        timer_remaining_seconds = NULL,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `, [taskId]);

  if (result.rowCount === 0) {
    return c.json({ error: "task not found" }, 404);
  }

  return c.json({ task: mapTask(result.rows[0]) });
});

app.post("/api/tasks/:id/evaluation", async (c) => {
  const taskId = Number(c.req.param("id"));
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return c.json({ error: "invalid task id" }, 400);
  }

  await markExpiredTimers();
  const current = await fetchTaskById(taskId);
  if (!current) {
    return c.json({ error: "task not found" }, 404);
  }

  if (current.timer_state !== "done") {
    return c.json({ error: "timer has not finished yet" }, 409);
  }

  const payload = evaluationSchema.parse(await c.req.json());

  const result = await pool.query<TaskRow>(`
    UPDATE tasks
    SET evaluation_score = $2,
        evaluation_note = $3,
        status = 'completed',
        progress = CASE WHEN progress < 100 THEN 100 ELSE progress END,
        completed_at = COALESCE(completed_at, NOW()),
        updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `, [taskId, payload.score, payload.note]);

  return c.json({ task: mapTask(result.rows[0]) });
});

app.onError((error, c) => {
  if (error instanceof z.ZodError) {
    return c.json({ error: "validation error", issues: error.issues }, 400);
  }
  console.error(error);
  return c.json({ error: "internal server error" }, 500);
});

const port = Number(process.env.PORT ?? "8787");

async function bootstrap() {
  await initDatabase();
  serve({
    fetch: app.fetch,
    port
  });
  console.log(`[api] listening on ${port}`);
}

bootstrap().catch((error) => {
  console.error("failed to start api", error);
  process.exit(1);
});
