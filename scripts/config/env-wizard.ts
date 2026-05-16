#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { confirm, input, select } from "@inquirer/prompts";
import { fileURLToPath } from "node:url";

const command = process.argv[2] ?? "init";
const thisFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(thisFile), "..", "..");
const envPath = path.join(rootDir, "core", "backend", ".env");

const presets = {
  local: {
    label: "ローカル開発",
    summary: "1台の開発機で dry-run 中心に確認する構成",
    values: {
      LAB_CORE_PORT: "7300",
      LAB_CORE_EXECUTION_MODE: "dry-run",
      LAB_CORE_DB_PATH: "./core/backend/data/database.sqlite",
      LAB_CORE_DOCKER_SOCKET: "/var/run/docker.sock",
      LAB_CORE_APPS_ROOT: "./runtime/apps",
      LAB_CORE_APPDATA_ROOT: "./runtime/appdata",
      LAB_CORE_MAIN_SERVICE_IP: "127.0.0.1",
      LAB_CORE_SSH_SERVICE_IP: "127.0.0.1",
      LAB_CORE_ROOT_DOMAIN: "lab.localhost",
      LAB_CORE_PROXY_CONFIG_PATH: "./core/backend/data/generated/Caddyfile",
      LAB_CORE_DNS_HOSTS_PATH: "./core/backend/data/generated/fukaya-sus.hosts",
      LAB_CORE_SYNC_DIR: "./core/backend/data/generated",
      LAB_CORE_DNS_SERVER_ENABLED: "true",
      LAB_CORE_DNS_BIND_HOST: "127.0.0.1",
      LAB_CORE_DNS_PORT: "1053",
      LAB_CORE_DNS_UPSTREAMS: ""
    }
  },
  lab: {
    label: "研究室運用",
    summary: "研究室サーバー向けの本番運用構成",
    values: {
      LAB_CORE_PORT: "7300",
      LAB_CORE_EXECUTION_MODE: "execute",
      LAB_CORE_DB_PATH: "./core/backend/data/database.sqlite",
      LAB_CORE_DOCKER_SOCKET: "/var/run/docker.sock",
      LAB_CORE_APPS_ROOT: "./runtime/apps",
      LAB_CORE_APPDATA_ROOT: "./runtime/appdata",
      LAB_CORE_MAIN_SERVICE_IP: "192.168.11.224",
      LAB_CORE_SSH_SERVICE_IP: "192.168.11.225",
      LAB_CORE_ROOT_DOMAIN: "fukaya-sus.lab",
      LAB_CORE_PROXY_CONFIG_PATH: "./core/backend/data/generated/Caddyfile",
      LAB_CORE_DNS_HOSTS_PATH: "./core/backend/data/generated/fukaya-sus.hosts",
      LAB_CORE_SYNC_DIR: "./core/backend/data/generated",
      LAB_CORE_DNS_SERVER_ENABLED: "true",
      LAB_CORE_DNS_BIND_HOST: "0.0.0.0",
      LAB_CORE_DNS_PORT: "53",
      LAB_CORE_DNS_UPSTREAMS: ""
    }
  },
  vm: {
    label: "検証VM",
    summary: "本番近似だがリポジトリ直下データで扱う検証構成",
    values: {
      LAB_CORE_PORT: "7300",
      LAB_CORE_EXECUTION_MODE: "execute",
      LAB_CORE_DB_PATH: "./core/backend/data/database.sqlite",
      LAB_CORE_DOCKER_SOCKET: "/var/run/docker.sock",
      LAB_CORE_APPS_ROOT: "./runtime/apps",
      LAB_CORE_APPDATA_ROOT: "./runtime/appdata",
      LAB_CORE_MAIN_SERVICE_IP: "192.168.11.224",
      LAB_CORE_SSH_SERVICE_IP: "192.168.11.225",
      LAB_CORE_ROOT_DOMAIN: "fukaya-sus.lab",
      LAB_CORE_PROXY_CONFIG_PATH: "./core/backend/data/generated/Caddyfile",
      LAB_CORE_DNS_HOSTS_PATH: "./core/backend/data/generated/fukaya-sus.hosts",
      LAB_CORE_SYNC_DIR: "./core/backend/data/generated",
      LAB_CORE_DNS_SERVER_ENABLED: "true",
      LAB_CORE_DNS_BIND_HOST: "0.0.0.0",
      LAB_CORE_DNS_PORT: "53",
      LAB_CORE_DNS_UPSTREAMS: ""
    }
  }
};

function isValidIpv4(value) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    return false;
  }

  const octets = value.split(".").map((part) => Number(part));
  return octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255);
}

function isPrivateIpv4(value) {
  if (!isValidIpv4(value)) {
    return false;
  }

  const [a, b] = value.split(".").map((part) => Number(part));
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function normalizeFamily(family) {
  return typeof family === "string" ? family : String(family);
}

function isValidRootDomain(value) {
  return /^[a-z0-9.-]+$/.test(value);
}

function ipCandidatePriority(candidate) {
  let score = 0;
  if (isPrivateIpv4(candidate.address)) {
    score += 3;
  }

  const iface = candidate.iface.toLowerCase();
  if (/^(eth|en|eno|ens|wlan|wl)/.test(iface)) {
    score += 2;
  }
  if (/(docker|br-|veth|virbr|cni|podman|tun|tap|wg|tailscale|zt)/.test(iface)) {
    score -= 3;
  }
  return score;
}

function collectMachineIpv4Candidates() {
  const interfaces = os.networkInterfaces();
  const unique = new Map();

  for (const [iface, records] of Object.entries(interfaces)) {
    for (const record of records ?? []) {
      const family = normalizeFamily(record.family);
      if (family !== "IPv4" && family !== "4") {
        continue;
      }
      if (record.internal) {
        continue;
      }
      if (!isValidIpv4(record.address)) {
        continue;
      }
      if (record.address.startsWith("169.254.")) {
        continue;
      }
      if (!unique.has(record.address)) {
        unique.set(record.address, { address: record.address, iface });
      }
    }
  }

  return Array.from(unique.values()).sort((a, b) => {
    const priorityDiff = ipCandidatePriority(b) - ipCandidatePriority(a);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return a.address.localeCompare(b.address);
  });
}

function buildIpSelectionChoices(candidates, currentValue) {
  const choices = candidates.map((candidate) => ({
    name: `${candidate.address} (${candidate.iface})`,
    value: candidate.address
  }));

  if (isValidIpv4(currentValue) && !candidates.some((candidate) => candidate.address === currentValue)) {
    choices.push({
      name: `${currentValue} (現在値)`,
      value: currentValue
    });
  }

  choices.push({
    name: "変更しない（現在値を維持）",
    value: "__keep__"
  });

  return choices;
}

function profileLabel(profileKey) {
  return profileKey === "custom" ? "custom" : presets[profileKey].label;
}

function buildInitialValues(selectedProfile, existingValues) {
  if (selectedProfile === "custom") {
    return {
      ...presets.local.values,
      ...existingValues
    };
  }

  return {
    ...presets[selectedProfile].values
  };
}

function dashboardUrl(values) {
  return `http://dashboard.${values.LAB_CORE_ROOT_DOMAIN}/`;
}

function apiUrl(values) {
  return `http://api.${values.LAB_CORE_ROOT_DOMAIN}/api`;
}

function pickStartCommand(selectedProfile, values) {
  if (selectedProfile === "lab") {
    return "yarn lab:up";
  }
  if (selectedProfile === "local") {
    return "yarn dev";
  }
  if (values.LAB_CORE_MAIN_SERVICE_IP === "127.0.0.1" || values.LAB_CORE_ROOT_DOMAIN.endsWith(".localhost")) {
    return "yarn dev";
  }
  return "yarn lab:up";
}

function nextSteps(selectedProfile, values) {
  const startCommand = pickStartCommand(selectedProfile, values);
  const steps = [
    `1) ${startCommand}`,
    `2) ${dashboardUrl(values)} を開く`,
    `3) ${apiUrl(values)} を確認する`
  ];

  if (startCommand === "yarn lab:up") {
    steps.push(`4) クライアント側の DNS を ${values.LAB_CORE_MAIN_SERVICE_IP} へ向ける`);
  }

  return steps;
}

function nowStamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}${hh}${mm}${ss}`;
}

function buildTemplate(profileName, values) {
  return `# Lab-Core backend runtime configuration
# generated_by: yarn config:${command}
# generated_at: ${new Date().toISOString()}
# profile: ${profileName}

LAB_CORE_PORT=${values.LAB_CORE_PORT}
LAB_CORE_EXECUTION_MODE=${values.LAB_CORE_EXECUTION_MODE}
LAB_CORE_DB_PATH=${values.LAB_CORE_DB_PATH}
LAB_CORE_DOCKER_SOCKET=${values.LAB_CORE_DOCKER_SOCKET}
LAB_CORE_APPS_ROOT=${values.LAB_CORE_APPS_ROOT}
LAB_CORE_APPDATA_ROOT=${values.LAB_CORE_APPDATA_ROOT}
LAB_CORE_MAIN_SERVICE_IP=${values.LAB_CORE_MAIN_SERVICE_IP}
LAB_CORE_SSH_SERVICE_IP=${values.LAB_CORE_SSH_SERVICE_IP}
LAB_CORE_ROOT_DOMAIN=${values.LAB_CORE_ROOT_DOMAIN}
LAB_CORE_PROXY_CONFIG_PATH=${values.LAB_CORE_PROXY_CONFIG_PATH}
LAB_CORE_DNS_HOSTS_PATH=${values.LAB_CORE_DNS_HOSTS_PATH}
LAB_CORE_SYNC_DIR=${values.LAB_CORE_SYNC_DIR}
LAB_CORE_DNS_SERVER_ENABLED=${values.LAB_CORE_DNS_SERVER_ENABLED}
LAB_CORE_DNS_BIND_HOST=${values.LAB_CORE_DNS_BIND_HOST}
LAB_CORE_DNS_PORT=${values.LAB_CORE_DNS_PORT}
LAB_CORE_DNS_UPSTREAMS=${values.LAB_CORE_DNS_UPSTREAMS}
`;
}

function printPreview(selectedProfile, values) {
  console.log("\n設定プレビュー:");
  console.log(`- プロファイル: ${profileLabel(selectedProfile)}`);
  console.log(`- LAB_CORE_MAIN_SERVICE_IP=${values.LAB_CORE_MAIN_SERVICE_IP}`);
  console.log(`- LAB_CORE_SSH_SERVICE_IP=${values.LAB_CORE_SSH_SERVICE_IP}`);
  console.log(`- LAB_CORE_ROOT_DOMAIN=${values.LAB_CORE_ROOT_DOMAIN}`);
  console.log("- その他の値は選択プロファイルの既定値を適用");
  console.log(`  - 実行モード: ${values.LAB_CORE_EXECUTION_MODE}`);
  console.log(`  - DNS bind/port: ${values.LAB_CORE_DNS_BIND_HOST}:${values.LAB_CORE_DNS_PORT}`);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readEnvFile(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  const entries = {};

  for (const rawLine of content.split(/\r?\n/)) {
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

async function selectProfile(fileExists, existingValues) {
  const customHint = fileExists && Object.keys(existingValues).length > 0
    ? "既存 .env を初期値として利用"
    : "local プロファイルを土台に .env を作成";

  return select({
    message: "使用するプロファイルを選択してください",
    choices: [
      {
        name: `local  - ${presets.local.label} | ${presets.local.summary}`,
        value: "local"
      },
      {
        name: `lab    - ${presets.lab.label} | ${presets.lab.summary}`,
        value: "lab"
      },
      {
        name: `vm     - ${presets.vm.label} | ${presets.vm.summary}`,
        value: "vm"
      },
      {
        name: `custom - ${customHint}`,
        value: "custom"
      }
    ],
    pageSize: 8
  });
}

async function confirmExistingFile(fileExists) {
  if (!fileExists) {
    return true;
  }

  if (process.env.LAB_CORE_ENV_WIZARD_SKIP_EXISTING_CONFIRM === "1") {
    return true;
  }

  if (command === "init") {
    return confirm({
      message: ".env は既に存在します。バックアップを取って上書きしますか？",
      default: false
    });
  }

  return confirm({
    message: "現在の .env を再作成します。バックアップを取って続行しますか？",
    default: false
  });
}

async function maybeApplyMachineIp(values) {
  const candidates = collectMachineIpv4Candidates();
  if (candidates.length === 0) {
    console.log("\nこのマシンで利用可能な外向き IPv4 を検出できなかったため、IP は初期値のまま開始します。");
    return;
  }

  const targets = [
    {
      key: "LAB_CORE_MAIN_SERVICE_IP",
      label: "公開先IP"
    },
    {
      key: "LAB_CORE_SSH_SERVICE_IP",
      label: "SSH用IP"
    }
  ];

  for (const target of targets) {
    const selected = await select({
      message: `${target.label} に設定する IP を選択してください`,
      choices: buildIpSelectionChoices(candidates, values[target.key]),
      pageSize: 10
    });

    if (selected === "__keep__") {
      console.log(`${target.label} は現在値のまま維持します。`);
      continue;
    }

    const confirmed = await confirm({
      message: `${target.label} を ${selected} に設定しますか？`,
      default: true
    });

    if (!confirmed) {
      console.log(`${target.label} の自動適用はスキップしました。`);
      continue;
    }

    values[target.key] = selected;
    console.log(`${target.label} を適用しました: ${target.key}=${selected}`);
  }
}

async function configureRootDomain(values) {
  const selected = await input({
    message: "ルートドメインを入力してください",
    default: values.LAB_CORE_ROOT_DOMAIN,
    validate: (value) => isValidRootDomain(value) || "英小文字・数字・ドット・ハイフンのみで入力してください。"
  });

  const confirmed = await confirm({
    message: `ルートドメインを ${selected} に設定しますか？`,
    default: true
  });

  if (confirmed) {
    values.LAB_CORE_ROOT_DOMAIN = selected;
    return;
  }

  console.log("ルートドメインは現在値のまま維持します。");
}

async function saveValues(fileExists, selectedProfile, values) {
  await fs.mkdir(path.dirname(envPath), { recursive: true });
  if (fileExists) {
    const backupPath = `${envPath}.backup.${nowStamp()}`;
    await fs.copyFile(envPath, backupPath);
    console.log(`既存 .env をバックアップしました: ${backupPath}`);
  }

  await fs.writeFile(envPath, buildTemplate(profileLabel(selectedProfile), values), "utf8");
  console.log(`\n保存完了: ${envPath}`);
  console.log("次の手順:");
  for (const step of nextSteps(selectedProfile, values)) {
    console.log(step);
  }
  console.log("\n補足: 追加の詳細設定は core/backend/.env を直接編集して調整できます。");
}

async function run() {
  console.log(`\n=== Lab-Core 設定ウィザード (${command}) ===`);
  console.log(`対象ファイル: ${envPath}`);

  const fileExists = await exists(envPath);
  const existingValues = fileExists ? await readEnvFile(envPath) : {};

  const proceed = await confirmExistingFile(fileExists);
  if (!proceed) {
    console.log("中止しました。既存 .env は変更していません。");
    return;
  }

  const selectedProfile = await selectProfile(fileExists, existingValues);
  const values = buildInitialValues(selectedProfile, existingValues);

  console.log("\nこのウィザードでは最小構成として次の 3 項目だけ設定します:");
  console.log("1) 公開先IP");
  console.log("2) SSH用IP");
  console.log("3) ルートドメイン");
  console.log("その他の設定は選択プロファイルの既定値を使います。\n");

  await maybeApplyMachineIp(values);
  await configureRootDomain(values);

  printPreview(selectedProfile, values);
  const confirmed = await confirm({
    message: "この内容で保存しますか？",
    default: true
  });

  if (!confirmed) {
    console.log("中止しました。ファイルは保存していません。");
    return;
  }

  await saveValues(fileExists, selectedProfile, values);
}

run().catch((error) => {
  if (error && typeof error === "object" && "name" in error && error.name === "ExitPromptError") {
    console.log("\nウィザードを終了しました。ファイルは保存していません。");
    process.exit(0);
  }

  console.error(`[config-wizard] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
