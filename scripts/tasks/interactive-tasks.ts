#!/usr/bin/env -S node --enable-source-maps

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { search } from "@inquirer/prompts";

interface ScriptEntry {
  name: string;
  command: string;
}

interface TreeNode {
  segment: string;
  fullName: string;
  command?: ScriptEntry;
  children: Map<string, TreeNode>;
}

interface VisibleGroupItem {
  kind: "group";
  node: TreeNode;
  depth: number;
}

interface VisibleCommandItem {
  kind: "command";
  node: TreeNode;
  depth: number;
  command: ScriptEntry;
  parentGroupKey: string | null;
}

type VisibleItem = VisibleGroupItem | VisibleCommandItem;

interface KeyEvent {
  name?: string;
  ctrl?: boolean;
}

interface LauncherConfig {
  backendPort: number;
  dashboardPort: number;
  rootDomain: string | null;
}

interface MonitorTarget {
  id: string;
  label: string;
  url: string;
}

interface MonitorEntry {
  id: string;
  label: string;
  url: string;
  level: "idle" | "up" | "warn" | "down";
  statusCode: number | null;
  latencyMs: number | null;
  detail: string;
}

interface MonitorState {
  config: LauncherConfig;
  entries: MonitorEntry[];
  checkedAt: string | null;
  systemSummary: string | null;
}

const thisFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(thisFile), "..", "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const envFilePath = path.join(projectRoot, "core", "backend", ".env");
const SELF_SCRIPT_NAME = "launcher";
const SEARCH_BACK = "__search_back__";
const RESET = "\x1b[0m";
const MONITOR_INTERVAL_MS = 3000;

function wrap(code: string, text: string): string {
  return `${code}${text}${RESET}`;
}

function bold(text: string): string {
  return wrap("\x1b[1m", text);
}

function dim(text: string): string {
  return wrap("\x1b[2m", text);
}

function fg(text: string, r: number, g: number, b: number): string {
  return wrap(`\x1b[38;2;${r};${g};${b}m`, text);
}

function bg(text: string, r: number, g: number, b: number): string {
  return wrap(`\x1b[48;2;${r};${g};${b}m`, text);
}

function accent(text: string): string {
  return fg(text, 86, 164, 255);
}

function muted(text: string): string {
  return fg(text, 137, 148, 173);
}

function success(text: string): string {
  return fg(text, 110, 227, 150);
}

function warning(text: string): string {
  return fg(text, 255, 196, 94);
}

function selectedRow(text: string): string {
  return wrap("\x1b[48;2;37;99;235m\x1b[38;2;248;250;255m", text);
}

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  if (maxLength <= 1) {
    return text.slice(0, maxLength);
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

function lineWidth(): number {
  return Math.max(72, Math.min(140, process.stdout.columns ?? 100));
}

function renderHotkey(key: string, label: string): string {
  const keyCapsule = bg(fg(` ${key} `, 235, 239, 255), 55, 70, 110);
  return `${keyCapsule} ${muted(label)}`;
}

function info(text: string): string {
  return fg(text, 121, 192, 255);
}

function toDisplayPath(scriptName: string): string {
  return scriptName.replaceAll(":", "/");
}

function commandLabelInTree(item: VisibleCommandItem): string {
  if (!item.parentGroupKey) {
    return toDisplayPath(item.command.name);
  }

  const prefix = `${item.parentGroupKey}:`;
  if (!item.command.name.startsWith(prefix)) {
    return toDisplayPath(item.command.name);
  }

  const relative = item.command.name.slice(prefix.length);
  if (relative.length === 0) {
    return item.node.segment;
  }
  return toDisplayPath(relative);
}

function ensureTty(): void {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error("[launcher] TUIの実行にはTTYが必要です。");
    console.error("[launcher] ターミナル上で `yarn run launcher` を実行してください。");
    process.exit(1);
  }
}

function toPort(value: string | undefined, defaultValue: number): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) {
    return parsed;
  }
  return defaultValue;
}

function parseEnvEntries(raw: string): Record<string, string> {
  const entries: Record<string, string> = {};

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const normalized = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const separatorIndex = normalized.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    let value = normalized.slice(separatorIndex + 1).trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }

  return entries;
}

function loadLauncherConfig(): LauncherConfig {
  try {
    const raw = readFileSync(envFilePath, "utf8");
    const entries = parseEnvEntries(raw);
    return {
      backendPort: toPort(entries.LAB_CORE_PORT, 7300),
      dashboardPort: 5173,
      rootDomain: entries.LAB_CORE_ROOT_DOMAIN?.trim() || null
    };
  } catch {
    return {
      backendPort: 7300,
      dashboardPort: 5173,
      rootDomain: null
    };
  }
}

function buildMonitorTargets(config: LauncherConfig): MonitorTarget[] {
  const targets: MonitorTarget[] = [
    {
      id: "local-backend-health",
      label: "Local Backend Health",
      url: `http://127.0.0.1:${config.backendPort}/health`
    },
    {
      id: "local-system-status",
      label: "Local System Status",
      url: `http://127.0.0.1:${config.backendPort}/api/system/status`
    },
    {
      id: "local-dashboard",
      label: "Local Dashboard",
      url: `http://127.0.0.1:${config.dashboardPort}/`
    }
  ];

  if (config.rootDomain) {
    targets.push(
      {
        id: "routed-dashboard",
        label: "Routed Dashboard",
        url: `http://dashboard.${config.rootDomain}/`
      },
      {
        id: "routed-api-status",
        label: "Routed API Status",
        url: `http://api.${config.rootDomain}/api/system/status`
      }
    );
  }

  return targets;
}

function summarizeSystemStatus(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = payload as {
    applicationSummary?: { total?: number; running?: number; degraded?: number; failed?: number };
    jobSummary?: { queued?: number; running?: number };
    dnsServer?: { enabled?: boolean; udpListening?: boolean; tcpListening?: boolean; lastError?: string | null };
    execution?: { mode?: string };
  };

  const total = data.applicationSummary?.total;
  const running = data.applicationSummary?.running;
  const degraded = data.applicationSummary?.degraded;
  const failed = data.applicationSummary?.failed;
  const queuedJobs = data.jobSummary?.queued;
  const runningJobs = data.jobSummary?.running;
  const executionMode = data.execution?.mode;
  const dnsEnabled = data.dnsServer?.enabled;
  const udpListening = data.dnsServer?.udpListening;
  const tcpListening = data.dnsServer?.tcpListening;

  const parts: string[] = [];
  if (typeof executionMode === "string") {
    parts.push(`mode=${executionMode}`);
  }
  if (typeof total === "number" && typeof running === "number") {
    parts.push(`apps=${running}/${total}`);
  }
  if (typeof degraded === "number" && degraded > 0) {
    parts.push(`degraded=${degraded}`);
  }
  if (typeof failed === "number" && failed > 0) {
    parts.push(`failed=${failed}`);
  }
  if (typeof runningJobs === "number" || typeof queuedJobs === "number") {
    parts.push(`jobs=${runningJobs ?? 0} running / ${queuedJobs ?? 0} queued`);
  }
  if (dnsEnabled) {
    parts.push(`dns=${udpListening ? "udp:on" : "udp:off"} ${tcpListening ? "tcp:on" : "tcp:off"}`);
  }

  return parts.length > 0 ? parts.join(" | ") : null;
}

async function probeMonitorTarget(target: MonitorTarget): Promise<{ entry: MonitorEntry; summary: string | null }> {
  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), 1200);

  try {
    const response = await fetch(target.url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json,text/html;q=0.9,*/*;q=0.8"
      }
    });

    const latencyMs = Date.now() - startedAt;
    let summary: string | null = null;

    if (response.ok && target.url.endsWith("/api/system/status")) {
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        summary = summarizeSystemStatus(await response.json().catch(() => null));
      }
    } else if (response.ok && target.url.endsWith("/health")) {
      await response.text().catch(() => "");
    }

    return {
      entry: {
        id: target.id,
        label: target.label,
        url: target.url,
        level: response.ok ? "up" : "warn",
        statusCode: response.status,
        latencyMs,
        detail: response.ok ? "OK" : `HTTP ${response.status}`
      },
      summary
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      entry: {
        id: target.id,
        label: target.label,
        url: target.url,
        level: "down",
        statusCode: null,
        latencyMs: Date.now() - startedAt,
        detail: message
      },
      summary: null
    };
  } finally {
    clearTimeout(timeout);
  }
}

function formatCheckedAt(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function idleMonitorEntry(target: MonitorTarget): MonitorEntry {
  return {
    id: target.id,
    label: target.label,
    url: target.url,
    level: "idle",
    statusCode: null,
    latencyMs: null,
    detail: "監視待機中"
  };
}

function loadScripts(): ScriptEntry[] {
  const raw = readFileSync(packageJsonPath, "utf8");
  const parsed = JSON.parse(raw) as { scripts?: Record<string, string> };
  const scripts = parsed.scripts ?? {};

  return Object.entries(scripts)
    .filter(([name]) => name !== SELF_SCRIPT_NAME)
    .map(([name, command]) => ({ name, command }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function createNode(segment: string, fullName: string): TreeNode {
  return {
    segment,
    fullName,
    children: new Map()
  };
}

function buildTree(entries: ScriptEntry[]): TreeNode {
  const root = createNode("root", "");

  for (const entry of entries) {
    const parts = entry.name.split(":");
    let cursor = root;
    let currentPath = "";

    for (const part of parts) {
      currentPath = currentPath.length === 0 ? part : `${currentPath}:${part}`;
      const next = cursor.children.get(part) ?? createNode(part, currentPath);
      cursor.children.set(part, next);
      cursor = next;
    }
    cursor.command = entry;
  }

  return root;
}

function sortNodes(nodes: Iterable<TreeNode>): TreeNode[] {
  return [...nodes].sort((a, b) => a.segment.localeCompare(b.segment));
}

function flattenVisibleItems(root: TreeNode, expanded: Set<string>): VisibleItem[] {
  const items: VisibleItem[] = [];

  const walk = (node: TreeNode, depth: number, parentGroupKey: string | null): void => {
    const hasChildren = node.children.size > 0;
    const hasCommand = Boolean(node.command);

    if (!hasChildren && hasCommand && node.command) {
      items.push({ kind: "command", node, depth, command: node.command, parentGroupKey });
      return;
    }

    items.push({ kind: "group", node, depth });
    if (!expanded.has(node.fullName)) {
      return;
    }

    if (hasCommand && node.command) {
      items.push({
        kind: "command",
        node,
        depth: depth + 1,
        command: node.command,
        parentGroupKey: node.fullName
      });
    }

    for (const child of sortNodes(node.children.values())) {
      walk(child, depth + 1, node.fullName);
    }
  };

  for (const node of sortNodes(root.children.values())) {
    walk(node, 0, null);
  }

  return items;
}

function monitorChip(entry: MonitorEntry): string {
  if (entry.level === "up") {
    return bg(fg(" UP ", 14, 39, 24), 110, 227, 150);
  }
  if (entry.level === "warn") {
    return bg(fg(" WARN ", 54, 31, 0), 255, 196, 94);
  }
  if (entry.level === "down") {
    return bg(fg(" DOWN ", 255, 238, 240), 207, 74, 93);
  }
  return bg(fg(" WAIT ", 34, 39, 53), 174, 187, 214);
}

function renderMonitor(state: MonitorState, width: number): void {
  const summaryChip = bg(fg(` refresh ${MONITOR_INTERVAL_MS / 1000}s `, 232, 242, 255), 35, 72, 158);
  const configLabel = state.config.rootDomain ? `root=${state.config.rootDomain}` : "rootDomain 未設定";
  console.log(`${info("Live Monitor")}  ${summaryChip}  ${muted(configLabel)}`);

  if (state.systemSummary) {
    console.log(`${muted("Summary")}   ${truncate(state.systemSummary, Math.max(20, width - 14))}`);
  } else {
    console.log(`${muted("Summary")}   ${muted("system status 未取得")}`);
  }

  for (const entry of state.entries) {
    const latency = typeof entry.latencyMs === "number" ? `${entry.latencyMs}ms` : "-";
    const statusText = entry.statusCode ? `${entry.detail} / ${latency}` : `${entry.detail} / ${latency}`;
    const left = `${monitorChip(entry)} ${bold(entry.label)}`;
    const right = `${muted(statusText)}  ${entry.url}`;
    console.log(`${left} ${truncate(right, Math.max(24, width - stripAnsi(left).length - 1))}`);
  }

  const checked = state.checkedAt ? state.checkedAt : "未更新";
  console.log(`${muted("Last")}      ${checked}`);
}

function renderMenu(
  items: VisibleItem[],
  selectedIndex: number,
  expanded: Set<string>,
  totalCommands: number,
  monitorState: MonitorState
): void {
  process.stdout.write("\x1b[2J\x1b[0f");
  const width = lineWidth();
  const rule = muted("─".repeat(width));
  const title = `${accent("LAB CORE")} ${bold("Task Launcher")}`;
  const subtitle = muted("コマンドを素早く探索し、1回の Enter で実行");
  const statusChip = bg(fg(` ${totalCommands} commands `, 232, 242, 255), 35, 72, 158);
  const expandedChip = bg(fg(` ${expanded.size} groups open `, 17, 33, 21), 139, 223, 167);
  const keyGuide = [
    renderHotkey("↑/↓", "移動"),
    renderHotkey("←/→", "開閉"),
    renderHotkey("Enter", "実行"),
    renderHotkey("/", "検索"),
    renderHotkey("r", "監視更新"),
    renderHotkey("q", "終了")
  ].join(`  ${dim("•")}  `);

  console.log(rule);
  console.log(`${title}  ${statusChip} ${expandedChip}`);
  console.log(subtitle);
  console.log(keyGuide);
  console.log(rule);

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const cursor = index === selectedIndex ? accent("❯") : dim("·");
    const indent = dim("│ ".repeat(item.depth));

    if (item.kind === "group") {
      const isOpen = expanded.has(item.node.fullName);
      const marker = isOpen ? warning("▾") : muted("▸");
      const toggleLabel = isOpen ? "[閉じる]" : "[開く]";
      const rowPlain = `${stripAnsi(cursor)} ${"  ".repeat(item.depth)}${isOpen ? "▾" : "▸"} ${item.node.segment} ${toggleLabel}`;
      const maxSegment = Math.max(12, width - rowPlain.length - 6);
      const segment = isOpen ? bold(item.node.segment) : item.node.segment;
      const rendered = `${cursor} ${indent}${marker} ${truncate(segment, maxSegment)} ${muted(toggleLabel)}`;
      console.log(index === selectedIndex ? selectedRow(rendered) : rendered);
      continue;
    }

    const isCompositeCommand = item.node.children.size > 0;
    const icon = isCompositeCommand ? warning("◆") : accent("•");
    const label = commandLabelInTree(item);
    const displayName = index === selectedIndex ? bold(label) : label;
    const rendered = `${cursor} ${indent}${icon} ${displayName}`;
    console.log(index === selectedIndex ? selectedRow(rendered) : rendered);
  }

  const selected = items[selectedIndex];
  console.log(rule);
  if (selected?.kind === "command") {
    const commandLabel = `${accent("yarn run")} ${bold(toDisplayPath(selected.command.name))}`;
    const content = truncate(selected.command.command, Math.max(24, width - 8));
    console.log(`${success("Selected")}  ${commandLabel}`);
    console.log(`${muted("Command")}   ${content}`);
  } else if (selected?.kind === "group") {
    console.log(`${warning("Selected Group")}  ${bold(selected.node.fullName)}`);
    console.log(`${muted("Hint")}      ${renderHotkey("→", "展開")}  ${renderHotkey("←", "折りたたみ")}`);
  }
  console.log(rule);
  renderMonitor(monitorState, width);
  console.log(rule);
}

function normalizeText(value: string): string {
  return value.toLowerCase();
}

function commandSearchScore(entry: ScriptEntry, term: string): number {
  const normalizedTerm = normalizeText(term.trim());
  if (normalizedTerm.length === 0) {
    return 1;
  }

  const name = normalizeText(entry.name);
  const command = normalizeText(entry.command);
  const tokens = normalizedTerm.split(/\s+/).filter(Boolean);
  if (tokens.some((token) => !name.includes(token) && !command.includes(token))) {
    return 0;
  }

  let score = 0;
  if (name === normalizedTerm) {
    score += 120;
  }
  if (name.startsWith(normalizedTerm)) {
    score += 80;
  }
  if (name.includes(normalizedTerm)) {
    score += 40;
  }
  if (command.includes(normalizedTerm)) {
    score += 20;
  }

  score -= entry.name.length * 0.01;
  return score;
}

async function chooseBySearch(entries: ScriptEntry[]): Promise<string | null> {
  const selected = await search<string>({
    message: "コマンド検索 (名前・実行コマンドで絞り込み)",
    pageSize: 14,
    source: (term) => {
      const normalizedTerm = term?.trim() ?? "";
      const ranked = entries
        .map((entry) => ({ entry, score: commandSearchScore(entry, normalizedTerm) }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
        .slice(0, 30);

      if (ranked.length === 0) {
        return [
          {
            value: SEARCH_BACK,
            name: "該当なし: メニューへ戻る",
            description: "別のキーワードで再検索できます"
          }
        ];
      }

      return ranked.map(({ entry }) => ({
        value: entry.name,
        name: toDisplayPath(entry.name),
        description: entry.command
      }));
    },
    theme: {
      icon: { cursor: "❯" }
    }
  });

  if (selected === SEARCH_BACK) {
    return null;
  }
  return selected;
}

function runSelectedScript(scriptName: string): number {
  console.log(`\n[launcher] yarn run ${scriptName} を実行します。\n`);

  const result = spawnSync("corepack", ["yarn", "run", scriptName], {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env
  });

  if (result.error) {
    throw result.error;
  }
  return typeof result.status === "number" ? result.status : 1;
}

async function main(): Promise<void> {
  ensureTty();

  const entries = loadScripts();
  if (entries.length === 0) {
    console.error("[launcher] package.json に実行可能な scripts が見つかりません。");
    process.exit(1);
  }

  const root = buildTree(entries);
  const expanded = new Set<string>();
  let selectedIndex = 0;
  let items = flattenVisibleItems(root, expanded);
  let closed = false;
  let monitorRefreshing = false;
  let monitorTimer: NodeJS.Timeout | null = null;
  let monitorState: MonitorState = {
    config: loadLauncherConfig(),
    entries: buildMonitorTargets(loadLauncherConfig()).map((target) => idleMonitorEntry(target)),
    checkedAt: null,
    systemSummary: null
  };

  const refreshAndRender = (): void => {
    items = flattenVisibleItems(root, expanded);
    if (items.length === 0) {
      console.error("[launcher] 表示可能なコマンドがありません。");
      process.exit(1);
    }
    if (selectedIndex >= items.length) {
      selectedIndex = items.length - 1;
    }
    renderMenu(items, selectedIndex, expanded, entries.length, monitorState);
  };

  const refreshMonitor = async (): Promise<void> => {
    if (monitorRefreshing || closed) {
      return;
    }

    monitorRefreshing = true;
    const config = loadLauncherConfig();
    const targets = buildMonitorTargets(config);

    try {
      const results = await Promise.all(targets.map((target) => probeMonitorTarget(target)));
      monitorState = {
        config,
        entries: results.map((result) => result.entry),
        checkedAt: formatCheckedAt(new Date()),
        systemSummary: results.map((result) => result.summary).find((summary) => summary) ?? null
      };
    } catch {
      monitorState = {
        config,
        entries: targets.map((target) => idleMonitorEntry(target)),
        checkedAt: formatCheckedAt(new Date()),
        systemSummary: null
      };
    } finally {
      monitorRefreshing = false;
      if (!closed) {
        refreshAndRender();
      }
    }
  };

  const stopRawInput = (): void => {
    process.stdin.off("keypress", onKeyPress);
    process.stdin.setRawMode(false);
    process.stdin.pause();
  };

  const startRawInput = (): void => {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("keypress", onKeyPress);
  };

  const close = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    if (monitorTimer) {
      clearInterval(monitorTimer);
      monitorTimer = null;
    }
    stopRawInput();
    process.stdout.write("\n");
  };

  const runAndReturn = (scriptName: string): void => {
    stopRawInput();
    const status = runSelectedScript(scriptName);
    if (status !== 0) {
      console.error(`[launcher] yarn run ${scriptName} は終了コード ${status} で終了しました。`);
    }
    startRawInput();
    void refreshMonitor();
    refreshAndRender();
  };

  const openSearch = async (): Promise<void> => {
    stopRawInput();
    try {
      const selected = await chooseBySearch(entries);
      if (selected) {
        const status = runSelectedScript(selected);
        if (status !== 0) {
          console.error(`[launcher] yarn run ${selected} は終了コード ${status} で終了しました。`);
        }
      }
    } finally {
      startRawInput();
      void refreshMonitor();
      refreshAndRender();
    }
  };

  const onKeyPress = (_: string, key: KeyEvent): void => {
    if (closed) {
      return;
    }

    if (key.ctrl && key.name === "c") {
      close();
      return;
    }

    switch (key.name) {
      case "q":
      case "escape":
        close();
        return;
      case "up":
        selectedIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1;
        renderMenu(items, selectedIndex, expanded, entries.length, monitorState);
        return;
      case "down":
        selectedIndex = selectedIndex >= items.length - 1 ? 0 : selectedIndex + 1;
        renderMenu(items, selectedIndex, expanded, entries.length, monitorState);
        return;
      case "right": {
        const current = items[selectedIndex];
        if (current?.kind === "group" && !expanded.has(current.node.fullName)) {
          expanded.add(current.node.fullName);
          refreshAndRender();
        }
        return;
      }
      case "left": {
        const current = items[selectedIndex];
        if (current?.kind === "group") {
          if (expanded.has(current.node.fullName)) {
            expanded.delete(current.node.fullName);
            refreshAndRender();
          }
          return;
        }

        if (current?.kind === "command" && current.parentGroupKey && expanded.has(current.parentGroupKey)) {
          expanded.delete(current.parentGroupKey);
          refreshAndRender();
        }
        return;
      }
      case "return": {
        const current = items[selectedIndex];
        if (current?.kind === "command") {
          runAndReturn(current.command.name);
        }
        return;
      }
      case "/":
        void openSearch();
        return;
      case "r":
        void refreshMonitor();
        return;
      default:
        return;
    }
  };

  console.log(`[launcher] ${entries.length} 件のコマンドを読み込みました。`);
  startRawInput();
  monitorTimer = setInterval(() => {
    void refreshMonitor();
  }, MONITOR_INTERVAL_MS);
  refreshAndRender();
  void refreshMonitor();

  await new Promise<void>((resolve) => {
    const checkClosed = (): void => {
      if (closed) {
        resolve();
        return;
      }
      setTimeout(checkClosed, 50);
    };
    checkClosed();
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[launcher] failed: ${message}`);
  process.exit(1);
});
