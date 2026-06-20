import path from "node:path";
import { stringify } from "yaml";
import {
  getExistingAncestorRealPath,
  isPathWithin
} from "./application-paths.js";

type JsonRecord = Record<string, unknown>;

type ComposeSandboxOptions = {
  rawCompose: unknown;
  applicationId: string;
  composePath: string;
  sourceRoot: string;
  appRoot: string;
  dataRoot: string;
  labCoreRoot: string;
  envValues: Record<string, string>;
};

type ExpandedValue = {
  value: string;
  unresolved: string[];
};

const dockerSocketTargets = new Set(["/var/run/docker.sock", "/run/docker.sock"]);
const namedVolumeNamePattern = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function expandTemplateString(value: string, envValues: Record<string, string>): ExpandedValue {
  const unresolved = new Set<string>();
  const expanded = value.replace(/\$\{([A-Z0-9_]+)(:-([^}]*))?\}/gi, (_match, name: string, _withDefault, defaultValue?: string) => {
    const resolved = envValues[name];
    if (typeof resolved === "string" && resolved.length > 0) {
      return resolved;
    }
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    unresolved.add(name);
    return "";
  });

  return {
    value: expanded,
    unresolved: [...unresolved]
  };
}

function assertNoUnresolvedPathVariables(expanded: ExpandedValue, fieldLabel: string, originalValue: string): void {
  if (expanded.unresolved.length === 0) {
    return;
  }

  throw new Error(
    `${fieldLabel} に未解決の環境変数が含まれています: ${originalValue} (${expanded.unresolved.join(", ")})`
  );
}

function assertSafeHostPathSyntax(value: string, fieldLabel: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldLabel} が空です。`);
  }
  if (value.startsWith("~")) {
    throw new Error(`${fieldLabel} に ~ は使用できません: ${value}`);
  }
  if (/^[A-Za-z]:[\\/]/.test(value)) {
    throw new Error(`${fieldLabel} に Windows パスは使用できません: ${value}`);
  }
}

function assertPathAnchorIsSafe(
  candidatePath: string,
  allowedRoot: string,
  fieldLabel: string
): void {
  const allowedRootReal = getExistingAncestorRealPath(allowedRoot);
  const candidateAnchorReal = getExistingAncestorRealPath(candidatePath);

  if (!isPathWithin(candidateAnchorReal, allowedRootReal)) {
    throw new Error(`${fieldLabel} が許可された root 外を参照しています: ${candidatePath}`);
  }
}

function assertNotLabCorePath(
  resolvedPath: string,
  labCoreRoot: string,
  fieldLabel: string
): void {
  if (isPathWithin(resolvedPath, labCoreRoot) || isPathWithin(labCoreRoot, resolvedPath)) {
    throw new Error(`${fieldLabel} から .lab-core は参照できません: ${resolvedPath}`);
  }
}

function resolveBindSourcePath(
  source: string,
  options: {
    composeDir: string;
    appRoot: string;
    labCoreRoot: string;
  },
  fieldLabel: string
): string {
  assertSafeHostPathSyntax(source, fieldLabel);

  const resolvedPath = source.startsWith("/")
    ? path.resolve(options.appRoot, `.${source}`)
    : path.resolve(options.composeDir, source);

  assertPathAnchorIsSafe(resolvedPath, options.appRoot, fieldLabel);

  if (!isPathWithin(resolvedPath, options.appRoot)) {
    throw new Error(`${fieldLabel} は application root 外へ出ています: ${source}`);
  }

  assertNotLabCorePath(resolvedPath, options.labCoreRoot, fieldLabel);

  return resolvedPath;
}

function resolveSourceScopedPath(
  source: string,
  options: {
    composeDir: string;
    sourceRoot: string;
    labCoreRoot: string;
  },
  fieldLabel: string
): string {
  assertSafeHostPathSyntax(source, fieldLabel);

  const resolvedPath = path.isAbsolute(source)
    ? path.resolve(source)
    : path.resolve(options.composeDir, source);

  assertPathAnchorIsSafe(resolvedPath, options.sourceRoot, fieldLabel);

  if (!isPathWithin(resolvedPath, options.sourceRoot)) {
    throw new Error(`${fieldLabel} は src 配下のみ許可されます: ${source}`);
  }

  assertNotLabCorePath(resolvedPath, options.labCoreRoot, fieldLabel);
  return resolvedPath;
}

function normalizeManagedVolumeDirectoryName(volumeName: string): string {
  return volumeName.replace(/[^a-zA-Z0-9_.-]+/g, "-");
}

function assertSafeNamedVolume(volumeName: string): void {
  if (!namedVolumeNamePattern.test(volumeName)) {
    throw new Error(`安全でない named volume 名です: ${volumeName}`);
  }
  if (volumeName === "." || volumeName === ".." || volumeName.includes("/") || volumeName.includes("\\")) {
    throw new Error(`named volume 名として許可できません: ${volumeName}`);
  }
}

function assertNoDockerSocket(targetPath: string, fieldLabel: string): void {
  if (dockerSocketTargets.has(targetPath) || targetPath.endsWith("/docker.sock")) {
    throw new Error(`${fieldLabel} から Docker socket は使用できません: ${targetPath}`);
  }
}

function assertNoDockerSocketSource(sourcePath: string, fieldLabel: string): void {
  if (sourcePath.includes("docker.sock")) {
    throw new Error(`${fieldLabel} から Docker socket は使用できません: ${sourcePath}`);
  }
}

function splitVolumeSpec(value: string): string[] {
  const segments: string[] = [];
  let current = "";
  let templateDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]!;
    const next = value[index + 1];

    if (char === "$" && next === "{") {
      templateDepth += 1;
      current += char;
      continue;
    }

    if (char === "}" && templateDepth > 0) {
      templateDepth -= 1;
      current += char;
      continue;
    }

    if (char === ":" && templateDepth === 0) {
      segments.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  segments.push(current);
  return segments;
}

function parseShortVolume(value: string): { source: string | null; target: string; mode: string | null } {
  const segments = splitVolumeSpec(value);

  if (segments.length === 1) {
    return {
      source: null,
      target: segments[0] ?? "",
      mode: null
    };
  }

  return {
    source: segments[0] ?? null,
    target: segments[1] ?? "",
    mode: segments.length > 2 ? segments.slice(2).join(":") : null
  };
}

function looksLikeBindSource(source: string): boolean {
  return source.startsWith("/")
    || source.startsWith("./")
    || source.startsWith("../")
    || source === "."
    || source === ".."
    || source.startsWith("~")
    || source.includes("/")
    || source.includes("\\")
    || source.startsWith("${");
}

function rewriteVolumeEntry(
  entry: unknown,
  options: {
    composeDir: string;
    sourceRoot: string;
    appRoot: string;
    dataRoot: string;
    labCoreRoot: string;
    envValues: Record<string, string>;
  },
  fieldLabel: string
): unknown {
  if (typeof entry === "string") {
    const parsed = parseShortVolume(entry);

    if (!parsed.source) {
      throw new Error(`${fieldLabel} で anonymous volume は使用できません: ${entry}`);
    }

    assertNoDockerSocket(parsed.target, `${fieldLabel}.target`);
    const expandedSource = expandTemplateString(parsed.source, options.envValues);
    assertNoUnresolvedPathVariables(expandedSource, `${fieldLabel}.source`, parsed.source);
    assertNoDockerSocketSource(expandedSource.value, `${fieldLabel}.source`);

    if (looksLikeBindSource(expandedSource.value)) {
      const resolvedSource = resolveBindSourcePath(expandedSource.value, options, `${fieldLabel}.source`);
      return [resolvedSource, parsed.target, parsed.mode].filter((segment) => segment && segment.length > 0).join(":");
    }

    assertSafeNamedVolume(expandedSource.value);
    const managedVolumePath = path.join(
      options.dataRoot,
      "volumes",
      normalizeManagedVolumeDirectoryName(expandedSource.value)
    );
    return [managedVolumePath, parsed.target, parsed.mode].filter((segment) => segment && segment.length > 0).join(":");
  }

  if (!isRecord(entry)) {
    throw new Error(`${fieldLabel} に未対応の volume 定義があります。`);
  }

  const typeValue = typeof entry.type === "string" ? entry.type : "volume";
  const targetValue = typeof entry.target === "string" ? entry.target : "";
  assertNoDockerSocket(targetValue, `${fieldLabel}.target`);

  if (typeValue === "bind") {
    const sourceValue = typeof entry.source === "string" ? entry.source : "";
    const expandedSource = expandTemplateString(sourceValue, options.envValues);
    assertNoUnresolvedPathVariables(expandedSource, `${fieldLabel}.source`, sourceValue);
    assertNoDockerSocketSource(expandedSource.value, `${fieldLabel}.source`);

    if (typeof entry.propagation === "string" || (isRecord(entry.bind) && entry.bind.propagation !== undefined)) {
      throw new Error(`${fieldLabel} で mount propagation は使用できません。`);
    }

    return {
      ...entry,
      type: "bind",
      source: resolveBindSourcePath(expandedSource.value, options, `${fieldLabel}.source`)
    };
  }

  if (typeValue === "volume") {
    const sourceValue = typeof entry.source === "string" ? entry.source : "";
    if (sourceValue.trim().length === 0) {
      throw new Error(`${fieldLabel} で anonymous volume は使用できません。`);
    }

    const expandedSource = expandTemplateString(sourceValue, options.envValues);
    assertNoUnresolvedPathVariables(expandedSource, `${fieldLabel}.source`, sourceValue);
    assertSafeNamedVolume(expandedSource.value);

    return {
      type: "bind",
      source: path.join(
        options.dataRoot,
        "volumes",
        normalizeManagedVolumeDirectoryName(expandedSource.value)
      ),
      target: targetValue,
      read_only: Boolean(entry.read_only)
    };
  }

  if (typeValue === "tmpfs") {
    return entry;
  }

  throw new Error(`${fieldLabel} の type ${String(typeValue)} は許可されていません。`);
}

function rewritePathList(
  value: unknown,
  options: {
    composeDir: string;
    sourceRoot: string;
    labCoreRoot: string;
    envValues: Record<string, string>;
  },
  fieldLabel: string
): string[] {
  return asArray(value).map((entry, index) => {
    if (typeof entry !== "string") {
      throw new Error(`${fieldLabel}[${index}] は文字列である必要があります。`);
    }

    const expanded = expandTemplateString(entry, options.envValues);
    assertNoUnresolvedPathVariables(expanded, `${fieldLabel}[${index}]`, entry);
    return resolveSourceScopedPath(expanded.value, options, `${fieldLabel}[${index}]`);
  });
}

function rewriteBuild(buildValue: unknown, options: {
  composeDir: string;
  sourceRoot: string;
  labCoreRoot: string;
  envValues: Record<string, string>;
}, fieldLabel: string): unknown {
  if (typeof buildValue === "string") {
    const expanded = expandTemplateString(buildValue, options.envValues);
    assertNoUnresolvedPathVariables(expanded, fieldLabel, buildValue);
    return resolveSourceScopedPath(expanded.value, options, fieldLabel);
  }

  if (!isRecord(buildValue)) {
    throw new Error(`${fieldLabel} の形式を解釈できません。`);
  }

  const nextBuild: JsonRecord = { ...buildValue };
  let resolvedContextPath: string | null = null;

  if (typeof buildValue.context === "string") {
    const expandedContext = expandTemplateString(buildValue.context, options.envValues);
    assertNoUnresolvedPathVariables(expandedContext, `${fieldLabel}.context`, buildValue.context);
    resolvedContextPath = resolveSourceScopedPath(expandedContext.value, options, `${fieldLabel}.context`);
    nextBuild.context = resolvedContextPath;
  }

  if (typeof buildValue.dockerfile === "string") {
    const expandedDockerfile = expandTemplateString(buildValue.dockerfile, options.envValues);
    assertNoUnresolvedPathVariables(expandedDockerfile, `${fieldLabel}.dockerfile`, buildValue.dockerfile);
    const dockerfileBaseDir = resolvedContextPath ?? options.composeDir;
    const resolvedDockerfilePath = resolveSourceScopedPath(
      path.isAbsolute(expandedDockerfile.value)
        ? expandedDockerfile.value
        : path.resolve(dockerfileBaseDir, expandedDockerfile.value),
      options,
      `${fieldLabel}.dockerfile`
    );

    nextBuild.dockerfile = path.isAbsolute(expandedDockerfile.value) || !resolvedContextPath
      ? resolvedDockerfilePath
      : path.relative(resolvedContextPath, resolvedDockerfilePath).replace(/\\/g, "/");
  }

  return nextBuild;
}

function rewriteFileBackedDefinitions(
  definitions: unknown,
  options: {
    composeDir: string;
    sourceRoot: string;
    labCoreRoot: string;
    envValues: Record<string, string>;
  },
  fieldLabel: string
): JsonRecord | undefined {
  if (definitions === undefined) {
    return undefined;
  }
  if (!isRecord(definitions)) {
    throw new Error(`${fieldLabel} は object である必要があります。`);
  }

  const rewritten = Object.fromEntries(
    Object.entries(definitions).map(([name, definition]) => {
      if (!isRecord(definition)) {
        throw new Error(`${fieldLabel}.${name} は object である必要があります。`);
      }

      if (typeof definition.file !== "string") {
        return [name, definition];
      }

      const expanded = expandTemplateString(definition.file, options.envValues);
      assertNoUnresolvedPathVariables(expanded, `${fieldLabel}.${name}.file`, definition.file);
      return [
        name,
        {
          ...definition,
          file: resolveSourceScopedPath(expanded.value, options, `${fieldLabel}.${name}.file`)
        }
      ];
    })
  );

  return rewritten;
}

function validateTopLevelVolumes(value: unknown): void {
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    throw new Error("volumes は object である必要があります。");
  }

  for (const [volumeName, definition] of Object.entries(value)) {
    assertSafeNamedVolume(volumeName);

    if (definition === null) {
      continue;
    }
    if (!isRecord(definition)) {
      throw new Error(`volumes.${volumeName} は object である必要があります。`);
    }
    if (definition.external === true) {
      throw new Error(`volumes.${volumeName}.external は使用できません。`);
    }
    if (definition.driver_opts !== undefined) {
      throw new Error(`volumes.${volumeName}.driver_opts は使用できません。`);
    }
    if (definition.driver !== undefined) {
      throw new Error(`volumes.${volumeName}.driver は使用できません。`);
    }
  }
}

function validateNetworkDefinitions(value: unknown): void {
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    throw new Error("networks は object である必要があります。");
  }

  for (const [networkName, definition] of Object.entries(value)) {
    if (!isRecord(definition)) {
      continue;
    }
    if (definition.external === true) {
      throw new Error(`networks.${networkName}.external は使用できません。`);
    }
  }
}

function rejectForbiddenServiceSettings(serviceName: string, service: JsonRecord): void {
  if (service.volumes_from !== undefined) {
    throw new Error(`services.${serviceName}.volumes_from は使用できません。`);
  }
  if (asArray(service.ports).length > 0) {
    throw new Error(`services.${serviceName}.ports は使用できません。`);
  }
  if (asArray(service.devices).length > 0) {
    throw new Error(`services.${serviceName}.devices は使用できません。`);
  }
  if (asArray(service.device_cgroup_rules).length > 0) {
    throw new Error(`services.${serviceName}.device_cgroup_rules は使用できません。`);
  }
  if (service.gpus !== undefined) {
    throw new Error(`services.${serviceName}.gpus は使用できません。`);
  }
  if (service.privileged === true) {
    throw new Error(`services.${serviceName}.privileged=true は使用できません。`);
  }

  for (const [field, forbiddenValue] of [
    ["pid", "host"],
    ["ipc", "host"],
    ["uts", "host"],
    ["userns_mode", "host"],
    ["cgroup", "host"]
  ] as const) {
    if (service[field] === forbiddenValue) {
      throw new Error(`services.${serviceName}.${field}=host は使用できません。`);
    }
  }

  if (typeof service.network_mode === "string" && (
    service.network_mode === "host" || service.network_mode.startsWith("container:")
  )) {
    throw new Error(`services.${serviceName}.network_mode=${service.network_mode} は使用できません。`);
  }

  if (service.cgroup_parent !== undefined) {
    throw new Error(`services.${serviceName}.cgroup_parent は使用できません。`);
  }
  if (asArray(service.cap_add).length > 0) {
    throw new Error(`services.${serviceName}.cap_add は使用できません。`);
  }
  if (asArray(service.security_opt).some((entry) => String(entry).toLowerCase().includes("unconfined"))) {
    throw new Error(`services.${serviceName}.security_opt の unconfined 設定は使用できません。`);
  }
  if (service.use_api_socket !== undefined && service.use_api_socket !== false) {
    throw new Error(`services.${serviceName}.use_api_socket は使用できません。`);
  }
}

function rejectDangerousTopLevelSettings(compose: JsonRecord): void {
  if (compose.include !== undefined) {
    throw new Error("include は使用できません。");
  }
  validateTopLevelVolumes(compose.volumes);
  validateNetworkDefinitions(compose.networks);
}

export function sandboxComposeForRuntime(options: ComposeSandboxOptions): {
  normalizedCompose: JsonRecord;
  normalizedYaml: string;
} {
  if (!isRecord(options.rawCompose)) {
    throw new Error("compose のルートが object ではありません。");
  }

  rejectDangerousTopLevelSettings(options.rawCompose);

  const composeDir = path.resolve(options.sourceRoot, path.posix.dirname(options.composePath).replace(/\\/g, "/"));
  const sourceScopedOptions = {
    composeDir,
    sourceRoot: options.sourceRoot,
    appRoot: options.appRoot,
    dataRoot: options.dataRoot,
    labCoreRoot: options.labCoreRoot,
    envValues: options.envValues
  };
  const services = options.rawCompose.services;

  if (!isRecord(services)) {
    throw new Error("compose に services がありません。");
  }

  const normalizedServices: JsonRecord = {};

  for (const [serviceName, serviceValue] of Object.entries(services)) {
    if (!isRecord(serviceValue)) {
      throw new Error(`services.${serviceName} は object である必要があります。`);
    }

    rejectForbiddenServiceSettings(serviceName, serviceValue);

    if (serviceValue.extends !== undefined) {
      throw new Error(`services.${serviceName}.extends は使用できません。`);
    }

    const nextService: JsonRecord = { ...serviceValue };

    if (serviceValue.build !== undefined) {
      nextService.build = rewriteBuild(serviceValue.build, sourceScopedOptions, `services.${serviceName}.build`);
    }

    if (serviceValue.env_file !== undefined) {
      nextService.env_file = rewritePathList(serviceValue.env_file, sourceScopedOptions, `services.${serviceName}.env_file`);
    }

    if (serviceValue.volumes !== undefined) {
      nextService.volumes = asArray(serviceValue.volumes).map((entry, index) =>
        rewriteVolumeEntry(entry, sourceScopedOptions, `services.${serviceName}.volumes[${index}]`)
      );
    }

    normalizedServices[serviceName] = nextService;
  }

  const normalizedCompose: JsonRecord = {
    ...options.rawCompose,
    services: normalizedServices
  };

  const rewrittenSecrets = rewriteFileBackedDefinitions(options.rawCompose.secrets, sourceScopedOptions, "secrets");
  const rewrittenConfigs = rewriteFileBackedDefinitions(options.rawCompose.configs, sourceScopedOptions, "configs");
  if (rewrittenSecrets) {
    normalizedCompose.secrets = rewrittenSecrets;
  }
  if (rewrittenConfigs) {
    normalizedCompose.configs = rewrittenConfigs;
  }

  delete normalizedCompose.volumes;

  return {
    normalizedCompose,
    normalizedYaml: stringify(normalizedCompose)
  };
}
