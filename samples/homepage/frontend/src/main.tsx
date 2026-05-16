import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";

type TaskStatus = "pending" | "in_progress" | "completed";
type TimerState = "idle" | "running" | "paused" | "done";

type Task = {
  id: number;
  title: string;
  status: TaskStatus;
  progress: number;
  timer: {
    state: TimerState;
    durationSeconds: number | null;
    endAt: string | null;
    remainingSeconds: number | null;
  };
  evaluation: { score: number; note: string } | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8787";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function formatRemain(seconds: number | null): string {
  if (seconds === null || seconds < 0) {
    return "--:--";
  }
  const minute = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${String(minute).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function useTicker(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 24, fontFamily: "'Noto Sans JP', sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>Timer TODO</h1>
      <p style={{ marginTop: 0, color: "#555" }}>Vite + Hono + PostgreSQL sample</p>
      <nav style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <Link to="/">現在タスク</Link>
        <Link to="/history">過去タスク</Link>
      </nav>
      {children}
    </div>
  );
}

function ActiveTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState<Record<number, number>>({});
  const [evalDraft, setEvalDraft] = useState<Record<number, { score: number; note: string }>>({});
  const now = useTicker();

  const load = async () => {
    try {
      const data = await request<{ tasks: Task[] }>("/api/tasks");
      setTasks(data.tasks);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 3000);
    return () => clearInterval(id);
  }, []);

  const createTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }
    setLoading(true);
    try {
      await request<{ task: Task }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title })
      });
      setTitle("");
      await load();
    } finally {
      setLoading(false);
    }
  };

  const updateTask = async (taskId: number, payload: Partial<{ progress: number; status: TaskStatus }>) => {
    await request<{ task: Task }>(`/api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    await load();
  };

  const deleteTask = async (taskId: number) => {
    await request<{ ok: true }>(`/api/tasks/${taskId}`, { method: "DELETE" });
    await load();
  };

  const setTimer = async (taskId: number) => {
    const minutes = timerMinutes[taskId] ?? 25;
    const durationSeconds = Math.max(1, Math.floor(minutes * 60));
    await request<{ task: Task }>(`/api/tasks/${taskId}/timer`, {
      method: "POST",
      body: JSON.stringify({ durationSeconds })
    });
    await load();
  };

  const pauseTimer = async (taskId: number) => {
    await request<{ task: Task }>(`/api/tasks/${taskId}/timer/pause`, { method: "POST" });
    await load();
  };

  const resumeTimer = async (taskId: number) => {
    await request<{ task: Task }>(`/api/tasks/${taskId}/timer/resume`, { method: "POST" });
    await load();
  };

  const clearTimer = async (taskId: number) => {
    await request<{ task: Task }>(`/api/tasks/${taskId}/timer`, { method: "DELETE" });
    await load();
  };

  const postEvaluation = async (taskId: number) => {
    const draft = evalDraft[taskId] ?? { score: 3, note: "" };
    await request<{ task: Task }>(`/api/tasks/${taskId}/evaluation`, {
      method: "POST",
      body: JSON.stringify(draft)
    });
    setEvalDraft((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    await load();
  };

  return (
    <AppLayout>
      <form onSubmit={createTask} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="新しいタスクを入力"
          style={{ flex: 1, padding: "8px 10px" }}
        />
        <button disabled={loading} type="submit">追加</button>
      </form>

      {error ? <p style={{ color: "#d11" }}>{error}</p> : null}

      {tasks.length === 0 ? <p>現在タスクはありません。</p> : null}

      <div style={{ display: "grid", gap: 12 }}>
        {tasks.map((task) => {
          const remaining = task.timer.state === "running" && task.timer.endAt
            ? Math.max(0, Math.floor((new Date(task.timer.endAt).getTime() - now) / 1000))
            : task.timer.remainingSeconds;

          const evalState = evalDraft[task.id] ?? { score: 3, note: "" };

          return (
            <article key={task.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
              <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <strong>{task.title}</strong>
                <button onClick={() => void deleteTask(task.id)} style={{ background: "#fee", border: "1px solid #f99" }}>削除</button>
              </header>

              <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                <label>
                  状態:
                  <select
                    value={task.status}
                    onChange={(event) => {
                      const status = event.target.value as TaskStatus;
                      void updateTask(task.id, { status });
                    }}
                    style={{ marginLeft: 8 }}
                  >
                    <option value="pending">pending</option>
                    <option value="in_progress">in_progress</option>
                    <option value="completed">completed</option>
                  </select>
                </label>

                <label>
                  進捗: {task.progress}%
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={task.progress}
                    onChange={(event) => {
                      void updateTask(task.id, { progress: Number(event.target.value) });
                    }}
                    style={{ width: "100%" }}
                  />
                </label>

                <div style={{ borderTop: "1px solid #eee", paddingTop: 8 }}>
                  <p style={{ margin: "0 0 8px" }}>
                    タイマー状態: <strong>{task.timer.state}</strong> / 残り: <strong>{formatRemain(remaining)}</strong>
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      type="number"
                      min={1}
                      value={timerMinutes[task.id] ?? 25}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setTimerMinutes((prev) => ({ ...prev, [task.id]: Number.isFinite(next) ? next : 25 }));
                      }}
                      style={{ width: 90 }}
                    />
                    <span>分</span>
                    <button onClick={() => void setTimer(task.id)}>設定/再設定</button>
                    <button onClick={() => void pauseTimer(task.id)} disabled={task.timer.state !== "running"}>中断</button>
                    <button onClick={() => void resumeTimer(task.id)} disabled={task.timer.state !== "paused"}>再開</button>
                    <button onClick={() => void clearTimer(task.id)}>タイマー削除</button>
                  </div>
                </div>

                {task.timer.state === "done" && !task.evaluation ? (
                  <section style={{ borderTop: "1px solid #eee", paddingTop: 8 }}>
                    <h4 style={{ margin: "0 0 8px" }}>タイマー終了後の評価</h4>
                    <label>
                      評価:
                      <select
                        value={evalState.score}
                        onChange={(event) => {
                          const score = Number(event.target.value);
                          setEvalDraft((prev) => ({ ...prev, [task.id]: { ...evalState, score } }));
                        }}
                        style={{ marginLeft: 8 }}
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                        <option value={5}>5</option>
                      </select>
                    </label>
                    <textarea
                      value={evalState.note}
                      onChange={(event) => {
                        setEvalDraft((prev) => ({ ...prev, [task.id]: { ...evalState, note: event.target.value } }));
                      }}
                      placeholder="任意の所感"
                      rows={3}
                      style={{ display: "block", width: "100%", marginTop: 8 }}
                    />
                    <button onClick={() => void postEvaluation(task.id)} style={{ marginTop: 8 }}>評価を送信</button>
                  </section>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </AppLayout>
  );
}

function HistoryPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const data = await request<{ tasks: Task[] }>("/api/tasks/history");
      setTasks(data.tasks);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    if (tasks.length === 0) {
      return { avgScore: "-", completed: 0 };
    }
    const scored = tasks.filter((task) => task.evaluation);
    const avg = scored.length > 0
      ? (scored.reduce((acc, task) => acc + (task.evaluation?.score ?? 0), 0) / scored.length).toFixed(2)
      : "-";

    return {
      avgScore: avg,
      completed: tasks.length
    };
  }, [tasks]);

  return (
    <AppLayout>
      <p>完了タスク: <strong>{summary.completed}</strong> / 平均評価: <strong>{summary.avgScore}</strong></p>
      <button onClick={() => void load()} style={{ marginBottom: 16 }}>再読み込み</button>
      {error ? <p style={{ color: "#d11" }}>{error}</p> : null}
      {tasks.length === 0 ? <p>履歴はまだありません。</p> : null}
      <ul style={{ paddingLeft: 18 }}>
        {tasks.map((task) => (
          <li key={task.id} style={{ marginBottom: 10 }}>
            <strong>{task.title}</strong> ({task.progress}%)
            {task.evaluation ? ` / 評価: ${task.evaluation.score}` : " / 評価なし"}
            {task.evaluation?.note ? ` / 所感: ${task.evaluation.note}` : ""}
          </li>
        ))}
      </ul>
    </AppLayout>
  );
}

function Root() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ActiveTasksPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
