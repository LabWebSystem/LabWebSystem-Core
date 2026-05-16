#!/usr/bin/env -S node --enable-source-maps

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { confirm } from "@inquirer/prompts";

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

interface KeyEvent {
  name?: string;
  ctrl?: boolean;
}

type VisibleItem =
  | { kind: "group"; node: TreeNode; depth: number }
  | { kind: "command"; node: TreeNode; depth: number; command: ScriptEntry }
  | { kind: "exit" };

const thisFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(thisFile), "..", "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const SELF_SCRIPT_NAME = "tasks";

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

  const walk = (node: TreeNode, depth: number): void => {
    const hasChildren = node.children.size > 0;
    const hasCommand = Boolean(node.command);

    if (!hasChildren && hasCommand && node.command) {
      items.push({ kind: "command", node, depth, command: node.command });
      return;
    }

    items.push({ kind: "group", node, depth });

    if (!expanded.has(node.fullName)) {
      return;
    }

    if (hasCommand && node.command) {
      items.push({ kind: "command", node, depth: depth + 1, command: node.command });
    }

    for (const child of sortNodes(node.children.values())) {
      walk(child, depth + 1);
    }
  };

  for (const node of sortNodes(root.children.values())) {
    walk(node, 0);
  }

  items.push({ kind: "exit" });
  return items;
}

function renderMenu(items: VisibleItem[], selectedIndex: number, expanded: Set<string>): void {
  process.stdout.write("\x1b[2J\x1b[0f");
  console.log("[tasks] コマンドランチャー");
  console.log("操作: ↑↓ 移動 / Enter 開閉 or 実行 / ← 折りたたみ / → 展開 / Ctrl+C 終了\n");

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const cursor = index === selectedIndex ? "❯" : " ";

    if (item.kind === "exit") {
      console.log(`${cursor} 終了`);
      continue;
    }

    const indent = "  ".repeat(item.depth);

    if (item.kind === "group") {
      const marker = expanded.has(item.node.fullName) ? "▾" : "▸";
      const hasSelfCommand = item.node.command ? " (実行可能)" : "";
      console.log(`${cursor} ${indent}${marker} ${item.node.segment}${hasSelfCommand}`);
      continue;
    }

    const isGroupedCommand = item.node.children.size > 0;
    const label = isGroupedCommand ? `▶ ${item.command.name}` : item.command.name;
    console.log(`${cursor} ${indent}• ${label}`);
  }

  const selected = items[selectedIndex];
  if (selected?.kind === "command") {
    console.log(`\n選択中: yarn run ${selected.command.name}`);
    console.log(`内容: ${selected.command.command}`);
  } else if (selected?.kind === "group") {
    console.log(`\n選択中グループ: ${selected.node.fullName}`);
  } else {
    console.log("\nランチャーを終了します。");
  }
}

function openTaskTree(root: TreeNode): Promise<string | null> {
  const expanded = new Set<string>();
  let selectedIndex = 0;

  return new Promise((resolve) => {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    let visible = flattenVisibleItems(root, expanded);
    renderMenu(visible, selectedIndex, expanded);

    const refresh = (): void => {
      visible = flattenVisibleItems(root, expanded);
      if (selectedIndex >= visible.length) {
        selectedIndex = Math.max(0, visible.length - 1);
      }
      renderMenu(visible, selectedIndex, expanded);
    };

    const finalize = (value: string | null): void => {
      process.stdin.off("keypress", onKeyPress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      resolve(value);
    };

    const toggleGroup = (node: TreeNode, open?: boolean): void => {
      const shouldOpen = typeof open === "boolean" ? open : !expanded.has(node.fullName);
      if (shouldOpen) {
        expanded.add(node.fullName);
      } else {
        expanded.delete(node.fullName);
      }
      refresh();
    };

    const onKeyPress = (_: string, key: KeyEvent): void => {
      if (key.ctrl && key.name === "c") {
        finalize(null);
        return;
      }

      const current = visible[selectedIndex];
      switch (key.name) {
        case "up":
          selectedIndex = selectedIndex <= 0 ? visible.length - 1 : selectedIndex - 1;
          renderMenu(visible, selectedIndex, expanded);
          return;
        case "down":
          selectedIndex = selectedIndex >= visible.length - 1 ? 0 : selectedIndex + 1;
          renderMenu(visible, selectedIndex, expanded);
          return;
        case "right":
          if (current?.kind === "group") {
            toggleGroup(current.node, true);
          }
          return;
        case "left":
          if (current?.kind === "group") {
            toggleGroup(current.node, false);
          }
          return;
        case "return":
          if (!current || current.kind === "exit") {
            finalize(null);
            return;
          }
          if (current.kind === "group") {
            toggleGroup(current.node);
            return;
          }
          finalize(current.command.name);
          return;
        default:
          return;
      }
    };

    process.stdin.on("keypress", onKeyPress);
  });
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

  const scriptEntries = loadScripts();
  if (scriptEntries.length === 0) {
    console.error("[tasks] package.json に実行可能な scripts が見つかりません。");
    process.exit(1);
  }

  const root = buildTree(scriptEntries);
  console.log(`[tasks] ${scriptEntries.length} 件のコマンドを読み込みました。`);

  while (true) {
    const selected = await openTaskTree(root);
    if (!selected) {
      break;
    }

    const status = runSelectedScript(selected);
    if (status !== 0) {
      console.error(`[tasks] yarn run ${selected} は終了コード ${status} で終了しました。`);
    }

    const retry = await confirm({
      message: "続けて別のコマンドを実行しますか？",
      default: true
    });

    if (!retry) {
      break;
    }
  }
}

main().catch((error: unknown) => {
  if (error && typeof error === "object" && "name" in error && error.name === "ExitPromptError") {
    process.exit(0);
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(`[tasks] failed: ${message}`);
  process.exit(1);
});
