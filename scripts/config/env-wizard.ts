#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { confirm, input, select } from "@inquirer/prompts";
import { fileURLToPath } from "node:url";

type ProfileKey = "mock" | "local" | "lab";
type ExistingEnvAction = "inherit" | "reset" | "cancel";

type EnvValues = Record<string, string>;

interface IpCandidate {
  address: string;
  iface: string;
}

interface IpChoice {
  name: string;
  value: string;
  description?: string;
}

const command = process.argv[2] ?? "init";
const thisFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(thisFile), "..", "..");
const envPath = path.join(rootDir, "core", "backend", ".env");

const profileCatalog: Record<ProfileKey, { label: string; summary: string; exposure: string }> = {
  mock: {
    label: "モック",
    summary: "実コマンドを実行せず UI/API/設定生成を確認する構成",
    exposure: "localhost のみ"
  },
  local: {
    label: "ローカル実行",
    summary: "実コマンドを実行しつつ localhost に閉じて検証する構成",
    exposure: "localhost のみ"
  },
  lab: {
    label: "研究室公開",
    summary: "研究室 LAN 向けに proxy/DNS を 0.0.0.0 公開する構成",
    exposure: "0.0.0.0 公開"
  }
};

const commonDefaults: EnvValues = {
  LAB_CORE_PORT: "7300",
  LAB_CORE_DB_PATH: "./core/backend/data/database.sqlite",
  LAB_CORE_DOCKER_SOCKET: "/var/run/docker.sock",
  LAB_CORE_APPS_ROOT: "./runtime/apps",
  LAB_CORE_APPDATA_ROOT: "./runtime/appdata",
  LAB_CORE_PROXY_CONFIG_PATH: "./core/backend/data/generated/Caddyfile",
  LAB_CORE_DNS_HOSTS_PATH: "./core/backend/data/generated/fukaya-sus.hosts",
  LAB_CORE_SYNC_DIR: "./core/backend/data/generated",
  LAB_CORE_DNS_SERVER_ENABLED: "true",
  LAB_CORE_DNS_UPSTREAMS: ""
};

const profileFixedValues: Record<ProfileKey, EnvValues> = {
  mock: {
    LAB_CORE_PROFILE: "mock",
    LAB_CORE_EXECUTION_MODE: "dry-run",
    LAB_CORE_PROXY_HTTP_BIND: "127.0.0.1:80",
    LAB_CORE_DNS_BIND: "127.0.0.1:53",
    LAB_CORE_DNS_BIND_HOST: "127.0.0.1",
    LAB_CORE_DNS_PORT: "53"
  },
  local: {
    LAB_CORE_PROFILE: "local",
    LAB_CORE_EXECUTION_MODE: "execute",
    LAB_CORE_PROXY_HTTP_BIND: "127.0.0.1:80",
    LAB_CORE_DNS_BIND: "127.0.0.1:53",
    LAB_CORE_DNS_BIND_HOST: "127.0.0.1",
    LAB_CORE_DNS_PORT: "53"
  },
  lab: {
    LAB_CORE_PROFILE: "lab",
    LAB_CORE_EXECUTION_MODE: "execute",
    LAB_CORE_PROXY_HTTP_BIND: "0.0.0.0:80",
    LAB_CORE_DNS_BIND: "0.0.0.0:53",
    LAB_CORE_DNS_BIND_HOST: "0.0.0.0",
    LAB_CORE_DNS_PORT: "53"
  }
};

function isValidIpv4(value: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    return false;
  }

  const octets = value.split(".").map((part) => Number(part));
  return octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255);
}

function isPrivateIpv4(value: string): boolean {
  if (!isValidIpv4(value)) {
    return false;
  }

  const [a, b] = value.split(".").map((part) => Number(part));
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function normalizeFamily(family: string | number): string {
  return typeof family === "string" ? family : String(family);
}

function isValidRootDomain(value: string): boolean {
  return /^[a-z0-9.-]+$/.test(value);
}

function parseHostPort(value: string): { host: string; port: string } | null {
  const separatorIndex = value.lastIndexOf(":");
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    return null;
  }

  const host = value.slice(0, separatorIndex).trim();
  const port = value.slice(separatorIndex + 1).trim();
  if (host.length === 0 || port.length === 0) {
    return null;
  }

  return { host, port };
}

function ipCandidatePriority(candidate: IpCandidate): number {
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

function collectMachineIpv4Candidates(): IpCandidate[] {
  const interfaces = os.networkInterfaces();
  const unique = new Map<string, IpCandidate>();

  for (const [iface, records] of Object.entries(interfaces)) {
    for (const record of records ?? []) {
      const family = normalizeFamily(record.family);
      if (family !== "IPv4" && family !== "4") {
        continue;
      }
      if (record.internal) {
        continue;
      }
      if (!isValidIpv4(record.address) || record.address.startsWith("169.254.")) {
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

function buildProfileInputDefaults(profile: ProfileKey, candidates: IpCandidate[]): EnvValues {
  if (profile === "lab") {
    const mainIp = candidates[0]?.address ?? "127.0.0.1";
    const sshIp = candidates[1]?.address ?? mainIp;
    return {
      LAB_CORE_MAIN_SERVICE_IP: mainIp,
      LAB_CORE_SSH_SERVICE_IP: sshIp,
      LAB_CORE_ROOT_DOMAIN: "fukaya-sus.lab"
    };
  }

  return {
    LAB_CORE_MAIN_SERVICE_IP: "127.0.0.1",
    LAB_CORE_SSH_SERVICE_IP: "127.0.0.1",
    LAB_CORE_ROOT_DOMAIN: "lab.localhost"
  };
}

function buildIpChoices(currentValue: string, candidates: IpCandidate[]): IpChoice[] {
  const choices: IpChoice[] = [];
  const seen = new Set<string>();

  if (isValidIpv4(currentValue)) {
    choices.push({
      name: `${currentValue} を使う`,
      value: currentValue,
      description: "現在の既定値をそのまま採用します。"
    });
    seen.add(currentValue);
  }

  for (const candidate of candidates) {
    if (seen.has(candidate.address)) {
      continue;
    }

    choices.push({
      name: `${candidate.address} (${candidate.iface})`,
      value: candidate.address,
      description: "検出した IPv4 候補を採用します。"
    });
    seen.add(candidate.address);
  }

  choices.push({
    name: "手入力する",
    value: "__manual__",
    description: "候補にない IP を直接入力します。"
  });

  return choices;
}

function profileLabel(profileKey: ProfileKey): string {
  return profileCatalog[profileKey].label;
}

function buildInitialValues(
  selectedProfile: ProfileKey,
  existingValues: EnvValues,
  inheritExisting: boolean,
  candidates: IpCandidate[]
): EnvValues {
  return {
    ...commonDefaults,
    ...buildProfileInputDefaults(selectedProfile, candidates),
    ...(inheritExisting ? existingValues : {}),
    ...profileFixedValues[selectedProfile]
  };
}

function dashboardUrl(values: EnvValues): string {
  return `http://dashboard.${values.LAB_CORE_ROOT_DOMAIN}/`;
}

function apiUrl(values: EnvValues): string {
  return `http://api.${values.LAB_CORE_ROOT_DOMAIN}/api`;
}

function nextSteps(values: EnvValues): string[] {
  const steps = [
    "1) yarn system:up",
    `2) ${dashboardUrl(values)} を開く`,
    `3) ${apiUrl(values)} を確認する`
  ];

  if (values.LAB_CORE_PROFILE === "lab") {
    steps.push(`4) クライアント側の DNS を ${values.LAB_CORE_MAIN_SERVICE_IP} へ向ける`);
  }

  return steps;
}

function nowStamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}${hh}${mm}${ss}`;
}

function buildTemplate(profileName: ProfileKey, values: EnvValues): string {
  return `# Lab-Core runtime configuration
# generated_by: yarn config:set
# generated_at: ${new Date().toISOString()}
# profile: ${profileName}

LAB_CORE_PROFILE=${values.LAB_CORE_PROFILE}
LAB_CORE_PORT=${values.LAB_CORE_PORT}
LAB_CORE_EXECUTION_MODE=${values.LAB_CORE_EXECUTION_MODE}

LAB_CORE_PROXY_HTTP_BIND=${values.LAB_CORE_PROXY_HTTP_BIND}
LAB_CORE_DNS_BIND=${values.LAB_CORE_DNS_BIND}

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

function printPreview(selectedProfile: ProfileKey, values: EnvValues): void {
  const dnsBind = parseHostPort(values.LAB_CORE_DNS_BIND);

  console.log("\n保存前プレビュー:");
  console.log(`Profile:    ${values.LAB_CORE_PROFILE} (${profileLabel(selectedProfile)})`);
  console.log(`Execution:  ${values.LAB_CORE_EXECUTION_MODE}`);
  console.log(`Exposure:   proxy=${values.LAB_CORE_PROXY_HTTP_BIND}, dns=${values.LAB_CORE_DNS_BIND}`);
  console.log("Network:");
  console.log(`  - main: ${values.LAB_CORE_MAIN_SERVICE_IP}`);
  console.log(`  - ssh:  ${values.LAB_CORE_SSH_SERVICE_IP}`);
  console.log(`  - root: ${values.LAB_CORE_ROOT_DOMAIN}`);
  console.log("Paths:");
  console.log(`  - db:    ${values.LAB_CORE_DB_PATH}`);
  console.log(`  - apps:  ${values.LAB_CORE_APPS_ROOT}`);
  console.log(`  - data:  ${values.LAB_CORE_APPDATA_ROOT}`);
  console.log(`  - sync:  ${values.LAB_CORE_SYNC_DIR}`);
  console.log("DNS:");
  console.log(`  - server enabled: ${values.LAB_CORE_DNS_SERVER_ENABLED}`);
  console.log(`  - canonical bind: ${values.LAB_CORE_DNS_BIND}`);
  console.log(`  - legacy host:    ${values.LAB_CORE_DNS_BIND_HOST}`);
  console.log(`  - legacy port:    ${values.LAB_CORE_DNS_PORT}`);
  if (dnsBind) {
    console.log(`  - parsed:         host=${dnsBind.host}, port=${dnsBind.port}`);
  }
  console.log("Next command:");
  console.log("  - yarn system:up");

  if (selectedProfile === "lab") {
    console.log("\nWARNING:");
    console.log("  lab profile exposes proxy and DNS on 0.0.0.0.");
    console.log("  Make sure firewall and LAN access are intended.");
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readEnvFile(filePath: string): Promise<EnvValues> {
  const content = await fs.readFile(filePath, "utf8");
  const entries: EnvValues = {};

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
    if (
      value.length >= 2 &&
      ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }

  return entries;
}

async function selectExistingEnvAction(fileExists: boolean, existingValues: EnvValues): Promise<ExistingEnvAction> {
  if (!fileExists || Object.keys(existingValues).length === 0) {
    return "reset";
  }

  return select({
    message: "既存 .env が見つかりました。初期値として引き継ぎますか？",
    choices: [
      {
        name: "引き継いで編集する",
        value: "inherit",
        description: "既存のパスやドメインを初期値に使い、固定値だけ新プロファイルで上書きします。"
      },
      {
        name: "初期化して作り直す",
        value: "reset",
        description: "推奨デフォルトから設定を作り直します。"
      },
      {
        name: "中止する",
        value: "cancel",
        description: "既存 .env を変更せず終了します。"
      }
    ],
    pageSize: 6
  });
}

async function selectProfile(): Promise<ProfileKey> {
  return select({
    message: "使用するプロファイルを選択してください",
    choices: (Object.keys(profileCatalog) as ProfileKey[]).map((profile) => ({
      name: `${profile} - ${profileCatalog[profile].label}`,
      value: profile,
      description: `${profileCatalog[profile].summary} / ${profileCatalog[profile].exposure}`
    })),
    pageSize: 6
  });
}

function printWizardIntro(selectedProfile: ProfileKey, candidates: IpCandidate[]): void {
  console.log("\nこのウィザードでは次の 3 項目を Enter だけで決められます:");
  console.log("1) Main service IP");
  console.log("2) SSH service IP");
  console.log("3) Root domain");
  console.log("その他の値は選択プロファイルの既定値を使います。");

  if (candidates.length > 0) {
    console.log("\n検出した IPv4 候補から Main/SSH 用 IP を選択できます。");
  }

  if (selectedProfile === "lab" && candidates.length > 0) {
    const detected = candidates
      .slice(0, 3)
      .map((candidate) => `${candidate.address} (${candidate.iface})`)
      .join(", ");
    console.log(`\n検出した LAN IPv4 候補: ${detected}`);
  }
}

async function promptIpv4Field(message: string, defaultValue: string): Promise<string> {
  return input({
    message,
    default: defaultValue,
    validate: (value) => isValidIpv4(value) || "IPv4 アドレスを入力してください。"
  });
}

async function promptIpv4Value(
  label: string,
  currentValue: string,
  candidates: IpCandidate[]
): Promise<string> {
  if (candidates.length === 0) {
    return promptIpv4Field(`${label} を入力してください`, currentValue);
  }

  const selected = await select({
    message: `${label} を選択してください`,
    choices: buildIpChoices(currentValue, candidates),
    pageSize: Math.min(candidates.length + 2, 8)
  });

  if (selected === "__manual__") {
    return promptIpv4Field(`${label} を入力してください`, currentValue);
  }

  return selected;
}

async function promptUserValues(values: EnvValues, candidates: IpCandidate[]): Promise<void> {
  values.LAB_CORE_MAIN_SERVICE_IP = await promptIpv4Value(
    "Main service IP",
    values.LAB_CORE_MAIN_SERVICE_IP,
    candidates
  );

  values.LAB_CORE_SSH_SERVICE_IP = await promptIpv4Value(
    "SSH service IP",
    values.LAB_CORE_SSH_SERVICE_IP,
    candidates
  );

  values.LAB_CORE_ROOT_DOMAIN = await input({
    message: "Root domain を入力してください",
    default: values.LAB_CORE_ROOT_DOMAIN,
    validate: (value) => isValidRootDomain(value) || "英小文字・数字・ドット・ハイフンのみで入力してください。"
  });
}

async function saveValues(fileExists: boolean, selectedProfile: ProfileKey, values: EnvValues): Promise<void> {
  await fs.mkdir(path.dirname(envPath), { recursive: true });
  if (fileExists) {
    const backupPath = `${envPath}.backup.${nowStamp()}`;
    await fs.copyFile(envPath, backupPath);
    console.log(`既存 .env をバックアップしました: ${backupPath}`);
  }

  await fs.writeFile(envPath, buildTemplate(selectedProfile, values), "utf8");
  console.log(`\n保存完了: ${envPath}`);
  console.log("次の手順:");
  for (const step of nextSteps(values)) {
    console.log(step);
  }
  console.log("\n補足: 追加の詳細設定は core/backend/.env を直接編集して調整できます。");
}

async function run(): Promise<void> {
  console.log(`\n=== Lab-Core 設定ウィザード (${command}) ===`);
  console.log(`対象ファイル: ${envPath}`);

  const fileExists = await exists(envPath);
  const existingValues = fileExists ? await readEnvFile(envPath) : {};
  const existingAction = await selectExistingEnvAction(fileExists, existingValues);
  if (existingAction === "cancel") {
    console.log("中止しました。既存 .env は変更していません。");
    return;
  }

  const selectedProfile = await selectProfile();
  const candidates = collectMachineIpv4Candidates();
  const values = buildInitialValues(selectedProfile, existingValues, existingAction === "inherit", candidates);

  printWizardIntro(selectedProfile, candidates);
  await promptUserValues(values, candidates);
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
