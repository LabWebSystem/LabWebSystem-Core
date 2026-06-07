import fs from "node:fs";
import path from "node:path";
import { hasFlag, readOption } from "../shared/args.js";
import { EXIT_FAILURE, EXIT_SUCCESS } from "../shared/error-codes.js";
import { printList, printSection } from "../presenters/human.js";

type TemplateKind = "standard" | "headless" | "device";

type TemplateConfig = {
  service: string;
  port: number;
  mode: "standard" | "headless";
  deviceRequired: boolean;
};

type PackageJsonShape = {
  name?: string;
  private?: boolean;
  packageManager?: string;
  scripts?: Record<string, string>;
};

function templateConfig(kind: TemplateKind): TemplateConfig {
  switch (kind) {
    case "headless":
      return { service: "api", port: 8080, mode: "headless", deviceRequired: false };
    case "device":
      return { service: "web", port: 8080, mode: "standard", deviceRequired: true };
    default:
      return { service: "web", port: 3000, mode: "standard", deviceRequired: false };
  }
}

function writeFile(filePath: string, content: string, force: boolean, changes: { created: string[]; skipped: string[] }): void {
  if (fs.existsSync(filePath) && !force) {
    changes.skipped.push(filePath);
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  changes.created.push(filePath);
}

function composeYaml(config: TemplateConfig): string {
  return `services:\n  ${config.service}:\n    build:\n      context: .\n      dockerfile: Dockerfile\n    restart: unless-stopped\n    environment:\n      PORT: \"${config.port}\"\n    expose:\n      - \"${config.port}\"\n`;
}

function composeDevYaml(config: TemplateConfig): string {
  const envLines = config.deviceRequired
    ? ["      LABCORE_DEVICE_MODE: mock", "      LABCORE_ENABLE_MOCK: \"true\"", "      LOG_LEVEL: debug"]
    : ["      LOG_LEVEL: debug"];
  const publishedPort = config.mode === "headless"
    ? "      - \"${LOCAL_API_PORT:-8080}:8080\""
    : `      - \"\${LOCAL_WEB_PORT:-${config.port}}:${config.port}\"`;

  return `services:\n  ${config.service}:\n    ports:\n${publishedPort}\n    environment:\n${envLines.join("\n")}\n`;
}

function manifestYaml(appName: string, config: TemplateConfig, deviceRequired: boolean): string {
  const deviceBlock = deviceRequired ? "  required:\n    - /dev/bus/usb" : "  required: []";
  const requiredEnvLines = config.deviceRequired
    ? "    - ADMIN_FIXED_PASSWORD\n    - LABCORE_DEVICE_MODE"
    : "    - ADMIN_FIXED_PASSWORD";

  return `schemaVersion: 1\napp:\n  name: ${appName}\n  description: Lab-Core SDK generated application\nrepository:\n  url: https://github.com/example/${appName}.git\n  defaultBranch: main\ndeployment:\n  composePath: docker-compose.yml\n  mode: ${config.mode}\n  keepVolumesOnRebuild: true\nexposure:\n  service: ${config.service}\n  port: ${config.port}\n  hostname: ${appName}.lab.localhost\ndevices:\n${deviceBlock}\nenv:\n  required:\n${requiredEnvLines}\n  defaults:\n    APPDATA_ROOT: ../../appdata/${appName}\n    LOG_LEVEL: info\nprofiles:\n  default: dev-sim\n`;
}

function profileYaml(name: string, appName: string, config: TemplateConfig): string {
  if (name === "dev-sim") {
    return `profile: dev-sim\noverrides:\n  env:\n    APPDATA_ROOT: ./.appdata/${appName}\n    LABCORE_DEVICE_MODE: mock\n    LABCORE_ENABLE_MOCK: \"true\"\n  composeFiles:\n    - docker-compose.yml\n    - docker-compose.dev.yml\n  deviceRequirements: []\n  guard:\n    allowMock: true\n    requireDevicePaths: []\n`;
  }

  if (name === "dev-real-device") {
    return `profile: dev-real-device\noverrides:\n  env:\n    APPDATA_ROOT: ./.appdata/${appName}\n    LABCORE_DEVICE_MODE: real\n  composeFiles:\n    - docker-compose.yml\n    - docker-compose.dev.yml\n  deviceRequirements:${config.deviceRequired ? "\n    - /dev/bus/usb" : " []"}\n  guard:\n    allowMock: false\n    requireDevicePaths:${config.deviceRequired ? "\n      - /dev/bus/usb" : " []"}\n`;
  }

  return `profile: prod\noverrides:\n  env:\n    LABCORE_DEVICE_MODE: real\n  composeFiles:\n    - docker-compose.yml\n  deviceRequirements:${config.deviceRequired ? "\n    - /dev/bus/usb" : " []"}\n  guard:\n    allowMock: false\n    requireDevicePaths:${config.deviceRequired ? "\n      - /dev/bus/usb" : " []"}\n`;
}

function updatePackageJson(cwd: string, appName: string, force: boolean, changes: { created: string[]; skipped: string[] }): void {
  const packageJsonPath = path.resolve(cwd, "package.json");
  const nextScripts = {
    "labcore:lint": "yarn exec labcore lint --profile dev-sim",
    "labcore:preflight": "yarn exec labcore preflight --profile dev-sim",
    "labcore:guard": "yarn exec labcore guard prod --profile prod",
    "labcore:export": "yarn exec labcore export --profile prod --out build/labcore-payload.json"
  };

  if (!fs.existsSync(packageJsonPath)) {
    const content = `${JSON.stringify({
      name: appName,
      private: true,
      packageManager: "yarn@4.14.1",
      scripts: nextScripts
    }, null, 2)}\n`;
    fs.writeFileSync(packageJsonPath, content, "utf8");
    changes.created.push(packageJsonPath);
    return;
  }

  const original = fs.readFileSync(packageJsonPath, "utf8");
  const parsed = JSON.parse(original) as PackageJsonShape;
  const currentScripts = parsed.scripts ?? {};

  const mergedScripts = {
    ...currentScripts,
    ...nextScripts
  };

  const hasAllScripts = Object.entries(nextScripts).every(([name, command]) => currentScripts[name] === command);
  if (hasAllScripts && !force) {
    changes.skipped.push(packageJsonPath);
    return;
  }

  const updated: PackageJsonShape = {
    ...parsed,
    packageManager: parsed.packageManager ?? "yarn@4.14.1",
    scripts: mergedScripts
  };

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  if (hasAllScripts) {
    changes.created.push(packageJsonPath);
    return;
  }
  changes.created.push(packageJsonPath);
}

function sdkUsageGuideMd(appName: string, template: TemplateKind, config: TemplateConfig): string {
  const deviceNotes = config.deviceRequired
    ? [
        "- `device` テンプレートでは `LABCORE_DEVICE_MODE` と `/dev/bus/usb` を前提にしています。",
        "- 実機検証前に `labcore/profiles/dev-real-device.yaml` と `labcore/profiles/prod.yaml` の device 要件を確認してください。"
      ]
    : [
        "- `standard` / `headless` テンプレートでは mock で始めやすい初期値を入れています。",
        "- 実運用前に `labcore/profiles/prod.yaml` の env と compose 差分を確認してください。"
      ];

  return `# SDK使い方

このファイルは \`labcore init\` 実行時に自動生成されました。  
対象アプリ: \`${appName}\`  
テンプレート: \`${template}\`

## 1. まず確認するファイル
- \`labcore.app.yaml\`
- \`labcore/profiles/dev-sim.yaml\`
- \`labcore/profiles/dev-real-device.yaml\`
- \`labcore/profiles/prod.yaml\`
- \`labcore/seeds/apply.sh\` / \`verify.sh\` / \`reset.sh\`

## 2. 初回セットアップの流れ
1. 継続利用するなら \`@lab-core/sdk-cli\` を対象リポジトリへ追加する
2. 生成済みの \`package.json\` に入った \`labcore:lint\` などの scripts を起点にする
3. \`labcore.app.yaml\` の \`repository.url\`, \`exposure.hostname\`, 必須 env を実アプリ向けに直す
4. \`docker-compose.yml\` を配備用、\`docker-compose.dev.yml\` を localhost 用として保つ
5. \`labcore/profiles/*.yaml\` の compose 差分と env 上書きを調整する
6. 必要なら \`labcore/seeds/*.sh\` に初期化処理を書く

## 3. よく使うコマンド
継続利用する場合:

\`\`\`bash
yarn add -D @lab-core/sdk-cli@https://github.com/LabWebSystem/LabWebSystem-Core.git#workspace=@lab-core/sdk-cli&head=main
yarn labcore:lint
yarn labcore:preflight
yarn labcore:guard
yarn labcore:export
yarn exec labcore lint --profile dev-sim
yarn exec labcore preflight --profile dev-sim
yarn exec labcore inspect --profile dev-sim
yarn exec labcore guard prod --profile prod
yarn exec labcore export --profile prod --out build/labcore-payload.json
\`\`\`

まだ依存追加していない状態で一時実行する場合:

\`\`\`bash
yarn dlx -p @lab-core/sdk-cli@https://github.com/LabWebSystem/LabWebSystem-Core.git#workspace=@lab-core/sdk-cli&head=main labcore lint --profile dev-sim
yarn dlx -p @lab-core/sdk-cli@https://github.com/LabWebSystem/LabWebSystem-Core.git#workspace=@lab-core/sdk-cli&head=main labcore preflight --profile dev-sim
yarn dlx -p @lab-core/sdk-cli@https://github.com/LabWebSystem/LabWebSystem-Core.git#workspace=@lab-core/sdk-cli&head=main labcore inspect --profile dev-sim
yarn dlx -p @lab-core/sdk-cli@https://github.com/LabWebSystem/LabWebSystem-Core.git#workspace=@lab-core/sdk-cli&head=main labcore guard prod --profile prod
yarn dlx -p @lab-core/sdk-cli@https://github.com/LabWebSystem/LabWebSystem-Core.git#workspace=@lab-core/sdk-cli&head=main labcore export --profile prod --out build/labcore-payload.json
\`\`\`

## 4. この雛形の初期値
- 公開サービス: \`${config.service}\`
- 公開ポート: \`${String(config.port)}\`
- deployment mode: \`${config.mode}\`
- 既定 hostname: \`${appName}.lab.localhost\`
${deviceNotes.join("\n")}

## 5. 登録前チェック
1. \`lint\` で manifest / profile / compose の整合性を確認する
2. \`preflight\` で起動前の警告を確認する
3. \`guard prod\` で本番設定に mock が残っていないか確認する
4. \`export\` で登録用 payload を出力する

## 6. 補足
- \`docker-compose.yml\` は配備用のため、初期値では \`ports:\` を持ちません。
- \`docker-compose.dev.yml\` は localhost 検証用で、ホストポート公開と \`./.appdata\` の利用を想定しています。
- \`prod\` profile は \`docker-compose.yml\` のみを使い、\`LABCORE_DEVICE_MODE=real\` を明示します。
- このファイルは雛形の初期説明書です。実アプリに合わせて更新してください。
- より詳細な schema / CLI / API 情報が必要なら、利用中の Lab-Core SDK 本体ドキュメントを参照してください。
`;
}

export function runInitCommand(args: string[]): number {
  const templateArg = (readOption(args, "template") ?? "standard") as TemplateKind;
  if (!["standard", "headless", "device"].includes(templateArg)) {
    process.stderr.write("--template must be one of: standard, headless, device\n");
    return EXIT_FAILURE;
  }

  const existing = hasFlag(args, "existing");
  const force = hasFlag(args, "force");
  const appName = (readOption(args, "name") ?? path.basename(process.cwd())).toLowerCase();

  const config = templateConfig(templateArg);
  const changes = { created: [] as string[], skipped: [] as string[] };

  try {
    const cwd = process.cwd();

    if (!existing) {
      writeFile(path.resolve(cwd, "docker-compose.yml"), composeYaml(config), force, changes);
      writeFile(path.resolve(cwd, "docker-compose.dev.yml"), composeDevYaml(config), force, changes);
      writeFile(path.resolve(cwd, "Dockerfile"), "FROM node:22-alpine\nWORKDIR /app\nCOPY . .\nRUN if [ -f package.json ]; then corepack yarn install; fi\nCMD [\"sh\", \"-c\", \"echo Replace CMD in Dockerfile\"]\n", force, changes);
      writeFile(path.resolve(cwd, ".dockerignore"), "node_modules\ndist\n.git\n", force, changes);
      writeFile(path.resolve(cwd, ".env.example"), "ADMIN_FIXED_PASSWORD=changeme\nLOG_LEVEL=info\n", force, changes);
    }

    updatePackageJson(cwd, appName, force, changes);
    writeFile(path.resolve(cwd, "labcore.app.yaml"), manifestYaml(appName, config, config.deviceRequired), force, changes);
    writeFile(path.resolve(cwd, "labcore", "profiles", "dev-sim.yaml"), profileYaml("dev-sim", appName, config), force, changes);
    writeFile(path.resolve(cwd, "labcore", "profiles", "dev-real-device.yaml"), profileYaml("dev-real-device", appName, config), force, changes);
    writeFile(path.resolve(cwd, "labcore", "profiles", "prod.yaml"), profileYaml("prod", appName, config), force, changes);
    writeFile(path.resolve(cwd, "labcore", "SDK使い方.md"), sdkUsageGuideMd(appName, templateArg, config), force, changes);
    writeFile(path.resolve(cwd, "labcore", "seeds", "apply.sh"), "#!/usr/bin/env bash\nset -euo pipefail\necho \"seed apply (${LABCORE_PROFILE:-unknown})\"\n", force, changes);
    writeFile(path.resolve(cwd, "labcore", "seeds", "verify.sh"), "#!/usr/bin/env bash\nset -euo pipefail\necho \"seed verify (${LABCORE_PROFILE:-unknown})\"\n", force, changes);
    writeFile(path.resolve(cwd, "labcore", "seeds", "reset.sh"), "#!/usr/bin/env bash\nset -euo pipefail\necho \"seed reset (${LABCORE_PROFILE:-unknown})\"\n", force, changes);

    for (const seedScript of ["apply.sh", "verify.sh", "reset.sh"]) {
      const scriptPath = path.resolve(cwd, "labcore", "seeds", seedScript);
      if (fs.existsSync(scriptPath)) {
        fs.chmodSync(scriptPath, 0o755);
      }
    }

    printSection("init");
    process.stdout.write(`template: ${templateArg}\n`);
    process.stdout.write(`created: ${changes.created.length}\n`);
    process.stdout.write(`skipped: ${changes.skipped.length}\n`);

    if (changes.created.length > 0) {
      printSection("created files");
      printList(changes.created.map((filePath) => path.relative(cwd, filePath)));
    }

    if (changes.skipped.length > 0) {
      printSection("skipped files");
      printList(changes.skipped.map((filePath) => path.relative(cwd, filePath)));
    }

    return EXIT_SUCCESS;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT_FAILURE;
  }
}
