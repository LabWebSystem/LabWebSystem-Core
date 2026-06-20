import fs from "node:fs";
import dgram from "node:dgram";
import { Hono } from "hono";
import net from "node:net";
import os from "node:os";
import { db, nowIso } from "../lib/db.js";
import { env } from "../lib/env.js";
import { dnsServer } from "../services/dns-server.js";

export const systemRouter = new Hono();

const DNS_PROBE_QUERY = Buffer.from([
  0x12, 0x34, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x08, 0x6c, 0x61, 0x62, 0x63, 0x6f, 0x72, 0x65,
  0x0a, 0x66, 0x75, 0x6b, 0x61, 0x79, 0x61, 0x2d, 0x73, 0x75, 0x73,
  0x03, 0x6c, 0x61, 0x62, 0x00,
  0x00, 0x01, 0x00, 0x01
]);

type CpuSnapshot = {
  idle: number;
  total: number;
};

let previousCpuSnapshot: CpuSnapshot | null = null;

function readCpuSnapshot(): CpuSnapshot {
  const totals = os.cpus().reduce(
    (accumulator, cpu) => {
      const values = Object.values(cpu.times);
      const total = values.reduce((sum, value) => sum + value, 0);
      return {
        idle: accumulator.idle + cpu.times.idle,
        total: accumulator.total + total
      };
    },
    { idle: 0, total: 0 }
  );

  return totals;
}

function computeCpuUsagePercent(): number {
  const nextSnapshot = readCpuSnapshot();
  if (!previousCpuSnapshot) {
    previousCpuSnapshot = nextSnapshot;
    return 0;
  }

  const idleDelta = nextSnapshot.idle - previousCpuSnapshot.idle;
  const totalDelta = nextSnapshot.total - previousCpuSnapshot.total;
  previousCpuSnapshot = nextSnapshot;

  if (totalDelta <= 0) {
    return 0;
  }

  const usage = 100 - (idleDelta / totalDelta) * 100;
  return Math.max(0, Math.min(100, Number(usage.toFixed(1))));
}

function safeDiskSnapshot(targetPath: string): {
  path: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usagePercent: number;
} {
  try {
    const stats = fs.statfsSync(targetPath);
    const totalBytes = Number(stats.blocks * stats.bsize);
    const freeBytes = Number(stats.bavail * stats.bsize);
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const usagePercent = totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(1)) : 0;
    return {
      path: targetPath,
      totalBytes,
      freeBytes,
      usedBytes,
      usagePercent
    };
  } catch {
    return {
      path: targetPath,
      totalBytes: 0,
      freeBytes: 0,
      usedBytes: 0,
      usagePercent: 0
    };
  }
}

function networkSnapshot() {
  const interfaces = os.networkInterfaces();
  const items = Object.entries(interfaces)
    .flatMap(([name, values]) =>
      (values ?? [])
        .filter((value) => !value.internal)
        .map((value) => ({
          name,
          family: value.family,
          address: value.address,
          mac: value.mac
        }))
    );

  const interfaceNames = [...new Set(items.map((item) => item.name))];

  return {
    interfaceCount: interfaceNames.length,
    interfaces: items,
    primaryAddress: items.find((item) => item.family === "IPv4")?.address ?? null
  };
}

function parseDashboardLayoutPayload(payload: unknown): string {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("ダッシュボードレイアウトの形式が不正です。");
  }

  return JSON.stringify(payload);
}

async function probeUdp(host: string, port: number): Promise<{ reachable: boolean; error: string | null }> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    const timer = setTimeout(() => {
      socket.close();
      resolve({ reachable: false, error: "timeout" });
    }, 500);

    socket.once("message", () => {
      clearTimeout(timer);
      socket.close();
      resolve({ reachable: true, error: null });
    });

    socket.once("error", (error) => {
      clearTimeout(timer);
      socket.close();
      resolve({ reachable: false, error: error.message });
    });

    socket.send(DNS_PROBE_QUERY, port, host, (error) => {
      if (!error) {
        return;
      }
      clearTimeout(timer);
      socket.close();
      resolve({ reachable: false, error: error.message });
    });
  });
}

async function probeTcp(host: string, port: number): Promise<{ reachable: boolean; error: string | null }> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ reachable: false, error: "timeout" });
    }, 500);

    socket.once("connect", () => {
      clearTimeout(timer);
      socket.end();
      resolve({ reachable: true, error: null });
    });

    socket.once("error", (error) => {
      clearTimeout(timer);
      resolve({ reachable: false, error: error.message });
    });
  });
}

systemRouter.get("/status", async (c) => {
  const totalApps = Number(
    (
      db.prepare("SELECT COUNT(*) as count FROM applications WHERE deleted_at IS NULL").get() as
        | { count: number }
        | undefined
    )?.count ?? 0
  );
  const runningApps = Number(
    (
      db.prepare("SELECT COUNT(*) as count FROM applications WHERE deleted_at IS NULL AND status = 'Running'").get() as
        | { count: number }
        | undefined
    )?.count ?? 0
  );
  const degradedApps = Number(
    (
      db.prepare("SELECT COUNT(*) as count FROM applications WHERE deleted_at IS NULL AND status = 'Degraded'").get() as
        | { count: number }
        | undefined
    )?.count ?? 0
  );
  const failedApps = Number(
    (
      db.prepare("SELECT COUNT(*) as count FROM applications WHERE deleted_at IS NULL AND status = 'Failed'").get() as
        | { count: number }
        | undefined
    )?.count ?? 0
  );

  const queuedJobs = Number(
    (
      db.prepare("SELECT COUNT(*) as count FROM operations WHERE status = 'queued'").get() as
        | { count: number }
        | undefined
    )?.count ?? 0
  );
  const runningJobs = Number(
    (
      db.prepare("SELECT COUNT(*) as count FROM operations WHERE status = 'running'").get() as
        | { count: number }
        | undefined
    )?.count ?? 0
  );

  const relayRequired = env.dnsServerEnabled && env.dnsBindHost === "127.0.0.1" && env.dnsPort !== 53;
  const relayTargetHost = env.dnsBindHost;
  const relayTargetPort = 53;
  const udpRelay = relayRequired ? await probeUdp(relayTargetHost, relayTargetPort) : { reachable: true, error: null };
  const tcpRelay = relayRequired ? await probeTcp(relayTargetHost, relayTargetPort) : { reachable: true, error: null };
  const relayLastError = udpRelay.error ?? tcpRelay.error ?? null;

  const dnsStatus = dnsServer.getStatus();

  return c.json({
    generatedAt: nowIso(),
    applicationSummary: {
      total: totalApps,
      running: runningApps,
      degraded: degradedApps,
      failed: failedApps
    },
    jobSummary: {
      queued: queuedJobs,
      running: runningJobs
    },
    paths: {
      dbPath: env.dbPath,
      appsRoot: env.appsRoot,
      appDataRoot: env.appDataRoot,
      generatedProxyConfigPath: env.generatedProxyConfigPath,
      generatedDnsHostsPath: env.generatedDnsHostsPath
    },
    execution: {
      mode: env.executionMode,
      mainServiceIp: env.mainServiceIp,
      sshServiceIp: env.sshServiceIp,
      rootDomain: env.rootDomain
    },
    dnsServer: {
      ...dnsStatus,
      relay: {
        required: relayRequired,
        targetHost: relayTargetHost,
        targetPort: relayTargetPort,
        udpReachable: udpRelay.reachable,
        tcpReachable: tcpRelay.reachable,
        lastError: relayLastError
      }
    }
  });
});

systemRouter.get("/metrics", async (c) => {
  const memoryTotal = os.totalmem();
  const memoryFree = os.freemem();
  const memoryUsed = memoryTotal - memoryFree;
  const memoryUsagePercent = memoryTotal > 0 ? Number(((memoryUsed / memoryTotal) * 100).toFixed(1)) : 0;
  const disk = safeDiskSnapshot(env.appDataRoot);
  const network = networkSnapshot();
  const cpuUsagePercent = computeCpuUsagePercent();
  const loadAverage = os.loadavg();

  const latestAlertRows = db
    .prepare(
      `
        SELECT
          event_id,
          scope,
          application_id,
          level,
          title,
          message,
          created_at
        FROM system_events
        WHERE level IN ('warning', 'error')
        ORDER BY created_at DESC
        LIMIT 8
      `
    )
    .all() as Array<{
      event_id: string;
      scope: string;
      application_id: string | null;
      level: "warning" | "error";
      title: string;
      message: string;
      created_at: string;
    }>;

  return c.json({
    generatedAt: nowIso(),
    cpu: {
      usagePercent: cpuUsagePercent,
      loadAverage1m: Number(loadAverage[0]?.toFixed(2) ?? 0),
      loadAverage5m: Number(loadAverage[1]?.toFixed(2) ?? 0),
      loadAverage15m: Number(loadAverage[2]?.toFixed(2) ?? 0),
      coreCount: os.cpus().length
    },
    memory: {
      totalBytes: memoryTotal,
      freeBytes: memoryFree,
      usedBytes: memoryUsed,
      usagePercent: memoryUsagePercent
    },
    disk,
    network: {
      ...network,
      dnsEnabled: env.dnsServerEnabled,
      dnsBindHost: env.dnsBindHost,
      dnsPort: env.dnsPort,
      rootDomain: env.rootDomain
    },
    alerts: latestAlertRows
  });
});

systemRouter.get("/dashboard-layout", (c) => {
  const dashboardId = c.req.query("dashboardId") ?? "operations-monitoring";
  const userId = c.req.query("userId") ?? "default";

  const row = db
    .prepare(
      `
        SELECT payload_json, updated_at
        FROM dashboard_layouts
        WHERE dashboard_id = ? AND user_id = ?
      `
    )
    .get(dashboardId, userId) as { payload_json: string; updated_at: string } | undefined;

  if (!row) {
    return c.json({
      dashboardId,
      userId,
      layout: null,
      updatedAt: null
    });
  }

  return c.json({
    dashboardId,
    userId,
    layout: JSON.parse(row.payload_json),
    updatedAt: row.updated_at
  });
});

systemRouter.put("/dashboard-layout", async (c) => {
  const payload = await c.req.json().catch(() => null);
  const dashboardId =
    typeof payload === "object" && payload && "dashboardId" in payload && typeof payload.dashboardId === "string"
      ? payload.dashboardId
      : "operations-monitoring";
  const userId =
    typeof payload === "object" && payload && "userId" in payload && typeof payload.userId === "string"
      ? payload.userId
      : "default";
  const layoutPayload =
    typeof payload === "object" && payload && "layout" in payload ? parseDashboardLayoutPayload(payload.layout) : null;

  if (!layoutPayload) {
    return c.json({ message: "layout が指定されていません。" }, 400);
  }

  const updatedAt = nowIso();
  db.prepare(
    `
      INSERT INTO dashboard_layouts (dashboard_id, user_id, payload_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(dashboard_id, user_id)
      DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at
    `
  ).run(dashboardId, userId, layoutPayload, updatedAt);

  return c.json({
    ok: true,
    dashboardId,
    userId,
    updatedAt
  });
});
