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

const thisFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(thisFile), "..", "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const SELF_SCRIPT_NAME = "tasks";
const SEARCH_BACK = "__search_back__";
const RESET = "\x1b[0m";

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
    console.error("[tasks] TUIの実行にはTTYが必要です。");
    console.error("[tasks] ターミナル上で `yarn run tasks` を実行してください。");
    process.exit(1);
  }
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

function renderMenu(items: VisibleItem[], selectedIndex: number, expanded: Set<string>, totalCommands: number): void {
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
  console.log(`\n[tasks] yarn run ${scriptName} を実行します。\n`);

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
    console.error("[tasks] package.json に実行可能な scripts が見つかりません。");
    process.exit(1);
  }

  const root = buildTree(entries);
  const expanded = new Set<string>();
  let selectedIndex = 0;
  let items = flattenVisibleItems(root, expanded);
  let closed = false;

  const refreshAndRender = (): void => {
    items = flattenVisibleItems(root, expanded);
    if (items.length === 0) {
      console.error("[tasks] 表示可能なコマンドがありません。");
      process.exit(1);
    }
    if (selectedIndex >= items.length) {
      selectedIndex = items.length - 1;
    }
    renderMenu(items, selectedIndex, expanded, entries.length);
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
    stopRawInput();
    process.stdout.write("\n");
  };

  const runAndReturn = (scriptName: string): void => {
    stopRawInput();
    const status = runSelectedScript(scriptName);
    if (status !== 0) {
      console.error(`[tasks] yarn run ${scriptName} は終了コード ${status} で終了しました。`);
    }
    startRawInput();
    refreshAndRender();
  };

  const openSearch = async (): Promise<void> => {
    stopRawInput();
    try {
      const selected = await chooseBySearch(entries);
      if (selected) {
        const status = runSelectedScript(selected);
        if (status !== 0) {
          console.error(`[tasks] yarn run ${selected} は終了コード ${status} で終了しました。`);
        }
      }
    } finally {
      startRawInput();
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
        renderMenu(items, selectedIndex, expanded, entries.length);
        return;
      case "down":
        selectedIndex = selectedIndex >= items.length - 1 ? 0 : selectedIndex + 1;
        renderMenu(items, selectedIndex, expanded, entries.length);
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
      default:
        return;
    }
  };

  console.log(`[tasks] ${entries.length} 件のコマンドを読み込みました。`);
  startRawInput();
  refreshAndRender();

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
  console.error(`[tasks] failed: ${message}`);
  process.exit(1);
});
