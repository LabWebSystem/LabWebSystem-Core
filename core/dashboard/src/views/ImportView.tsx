import {
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes
} from "react";
import {
  FiCheck,
  FiFileText,
  FiGithub,
  FiInfo,
  FiLayers,
  FiLock,
  FiServer,
  FiSettings
} from "react-icons/fi";
import { ComposeInspectDialog } from "../components/ComposeInspectDialog";
import type {
  ComposeServiceCandidate,
  ImportComposeInspectResponse,
  ImportResolvedManifest
} from "../types";

export type ImportFormState = {
  name: string;
  description: string;
  sourceUrl: string;
  defaultBranch: string;
  composePath: string;
  publicServiceName: string;
  publicPort: string;
  hostname: string;
  mode: "standard" | "headless";
  keepVolumesOnRebuild: boolean;
};

export type ImportResolveState = {
  status: "idle" | "resolving" | "resolved" | "error";
  canonicalRepositoryUrl: string;
  branchCandidates: string[];
  branchFixed: boolean;
  repositoryFiles: string[];
  yamlFiles: string[];
  composeCandidates: string[];
  recommendedComposePath: string | null;
  manifestPath: string;
  manifest: ImportResolvedManifest | null;
  warning: string;
};

export type ImportComposeState = {
  status: "idle" | "inspecting" | "ready" | "error";
  inspection: ImportComposeInspectResponse | null;
  services: ComposeServiceCandidate[];
  warning: string;
};

type ImportViewProps = {
  form: ImportFormState;
  deviceRequirementsRaw: string;
  environmentOverrides: Record<string, string>;
  resolveState: ImportResolveState;
  composeState: ImportComposeState;
  rootDomain: string;
  loading: boolean;
  onFieldChange: <K extends keyof ImportFormState>(key: K, value: ImportFormState[K]) => void;
  onDeviceRequirementsChange: (value: string) => void;
  onEnvironmentOverrideChange: (name: string, value: string) => void;
  onResolveSource: () => Promise<void>;
  onInspectCompose: (composePath: string) => Promise<void>;
  onSelectService: (service: ComposeServiceCandidate) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

type StepCardProps = {
  index: string;
  title: string;
  icon: ReactNode;
  locked?: boolean;
  children: ReactNode;
};

function StepCard(props: StepCardProps) {
  const { index, title, icon, locked = false, children } = props;

  return (
    <section
      className={
        locked
          ? "rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-100/50 p-6 text-slate-400"
          : "rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.5)]"
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <span
          className={
            locked
              ? "inline-flex items-center rounded-lg bg-slate-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500"
              : "inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-indigo-700"
          }
        >
          {index}
        </span>
        <div
          className={
            locked
              ? "flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/70 text-slate-400"
              : "flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white"
          }
        >
          {icon}
        </div>
        <h3 className={locked ? "text-base font-bold text-slate-500" : "text-base font-bold text-slate-900"}>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function InfoPill(props: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
      {props.children}
    </span>
  );
}

function TextField(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 ${props.className ?? ""}`}
    />
  );
}

function SelectField(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 ${props.className ?? ""}`}
    />
  );
}

export function ImportView(props: ImportViewProps) {
  const {
    form,
    deviceRequirementsRaw,
    environmentOverrides,
    resolveState,
    composeState,
    rootDomain,
    loading,
    onFieldChange,
    onDeviceRequirementsChange,
    onEnvironmentOverrideChange,
    onResolveSource,
    onInspectCompose,
    onSelectService,
    onSubmit
  } = props;
  const [inspectDialogOpen, setInspectDialogOpen] = useState(false);

  const hasResolvedRepository = resolveState.canonicalRepositoryUrl.length > 0;
  const hasBranch = form.defaultBranch.trim().length > 0;
  const hasComposeSelection = form.composePath.trim().length > 0;
  const hasComposeInspection =
    composeState.status === "ready" && composeState.services.length > 0 && form.publicServiceName.trim().length > 0;
  const manifest = resolveState.manifest;
  const composeEnvRequirements = composeState.inspection?.environmentRequirements ?? [];
  const composeEnvNames = new Set(composeEnvRequirements.map((requirement) => requirement.name));
  const manifestOnlyEnvRequirements = manifest
    ? [
        ...manifest.env.required
          .filter((name) => !composeEnvNames.has(name))
          .map((name) => ({
            name,
            required: true,
            defaultValue: manifest.env.defaults[name] ?? null,
            services: ["manifest"]
          })),
        ...Object.entries(manifest.env.defaults)
          .filter(([name]) => !composeEnvNames.has(name) && !manifest.env.required.includes(name))
          .map(([name, defaultValue]) => ({
            name,
            required: false,
            defaultValue,
            services: ["manifest"]
          }))
      ]
    : [];
  const displayedEnvRequirements = [...composeEnvRequirements, ...manifestOnlyEnvRequirements];

  return (
    <div className="h-full overflow-y-auto pr-1">
      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))] p-6 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.55)] md:p-8">
        <div className="mb-8 rounded-[1.5rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_48px_-38px_rgba(15,23,42,0.55)]">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-indigo-600">New App</p>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <FiGithub className="h-5 w-5" />
                </span>
                GitHub からアプリ登録
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                URL 解析、manifest 確認、compose 解析、登録内容の確定までを一画面で進めます。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <InfoPill>Indigo / Slate UI</InfoPill>
              <InfoPill>Manifest Driven</InfoPill>
              <InfoPill>Compose Inspect</InfoPill>
            </div>
          </div>
        </div>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-6">
          <StepCard index="STEP 1" title="GitHub URL を入力" icon={<FiGithub className="h-5 w-5" />}>
            <p className="mb-4 text-sm text-slate-500">`/tree/&lt;branch&gt;` URL または `.git` URL を指定できます。</p>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              GitHub URL
              <div className="flex flex-col gap-3 md:flex-row">
                <TextField
                  required
                  placeholder="https://github.com/<org>/<repo>/tree/<branch>"
                  value={form.sourceUrl}
                  onChange={(event) => onFieldChange("sourceUrl", event.target.value)}
                  onBlur={() => void onResolveSource()}
                />
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void onResolveSource()}
                  disabled={resolveState.status === "resolving"}
                >
                  {resolveState.status === "resolving" ? "解析中..." : "URL解析"}
                </button>
              </div>
            </label>
          </StepCard>

          {hasResolvedRepository ? (
            <StepCard index="STEP 2" title="ブランチを確認" icon={<FiLayers className="h-5 w-5" />}>
              <div className="grid gap-4 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Canonical URL</p>
                  <code className="break-all text-sm text-slate-800">{resolveState.canonicalRepositoryUrl}</code>
                </div>

                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  ブランチ
                  <TextField
                    list="branch-candidates"
                    value={form.defaultBranch}
                    onChange={(event) => onFieldChange("defaultBranch", event.target.value)}
                    disabled={resolveState.branchFixed}
                    className="disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  <datalist id="branch-candidates">
                    {resolveState.branchCandidates.map((branch) => (
                      <option key={branch} value={branch} />
                    ))}
                  </datalist>
                </label>

                <div className="flex flex-wrap gap-2">
                  <InfoPill>
                    {resolveState.branchFixed
                      ? "このURL形式では branch は main 固定です。"
                      : "branch候補は自動取得済みです。必要なら上書きできます。"}
                  </InfoPill>
                  <InfoPill>取得ファイル数: {resolveState.repositoryFiles.length} 件</InfoPill>
                </div>

                {resolveState.warning ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {resolveState.warning}
                  </p>
                ) : null}
              </div>
            </StepCard>
          ) : (
            <StepCard
              index="STEP 2"
              title="ブランチを確認"
              icon={<FiLock className="h-5 w-5" />}
              locked
            >
              <p className="text-sm text-slate-400">先に GitHub URL を解析してください。</p>
            </StepCard>
          )}

          {hasResolvedRepository && hasBranch ? (
            <StepCard index="STEP 3" title="labcore.app.yaml を確認" icon={<FiFileText className="h-5 w-5" />}>
              <div className="grid gap-4 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Manifest Path</p>
                    <code className="break-all text-sm text-slate-800">{resolveState.manifestPath || "未検出"}</code>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Compose Path</p>
                    <code className="break-all text-sm text-slate-800">{form.composePath || "未設定"}</code>
                  </div>
                </div>

                {manifest ? (
                  <div className="grid gap-3">
                    <p className="text-sm font-semibold text-slate-700">manifest から取得した初期値</p>
                    <div className="flex flex-wrap gap-2">
                      <InfoPill>{manifest.app.name}</InfoPill>
                      <InfoPill>{manifest.exposure.service}</InfoPill>
                      <InfoPill>{String(manifest.exposure.port)}</InfoPill>
                      <InfoPill>{manifest.deployment.mode}</InfoPill>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">manifest はまだ取得できていません。</p>
                )}
              </div>
            </StepCard>
          ) : (
            <StepCard
              index="STEP 3"
              title="labcore.app.yaml を確認"
              icon={<FiLock className="h-5 w-5" />}
              locked
            >
              <p className="text-sm text-slate-400">ブランチを確定すると manifest の内容を表示します。</p>
            </StepCard>
          )}

          {hasResolvedRepository && hasBranch && hasComposeSelection ? (
            <StepCard
              index="STEP 4"
              title="manifest 指定の compose を解析してサービスを選ぶ"
              icon={<FiServer className="h-5 w-5" />}
            >
              <div className="grid gap-4 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Selected Compose</p>
                    <code className="break-all text-sm text-slate-800">{form.composePath}</code>
                  </div>
                  <div className="flex gap-2">
                    {composeState.inspection ? (
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
                        aria-label="取得した YAML と解析結果を表示"
                        title="取得した YAML と解析結果を表示"
                        onClick={() => setInspectDialogOpen(true)}
                      >
                        <FiInfo className="h-4 w-4" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => void onInspectCompose(form.composePath)}
                      disabled={composeState.status === "inspecting"}
                    >
                      {composeState.status === "inspecting" ? "compose解析中..." : "manifest の compose を再解析"}
                    </button>
                  </div>
                </div>

                {composeState.warning ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {composeState.warning}
                  </p>
                ) : null}

                {composeState.services.length > 0 ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {composeState.services.map((service) => {
                      const selected = form.publicServiceName === service.name;
                      return (
                        <button
                          key={service.name}
                          type="button"
                          className={`grid gap-2 rounded-[1.25rem] border p-4 text-left transition ${
                            selected
                              ? "border-indigo-500 bg-indigo-50 shadow-[0_20px_40px_-34px_rgba(79,70,229,0.65)]"
                              : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40"
                          }`}
                          onClick={() => onSelectService(service)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <strong className="text-base text-slate-900">{service.name}</strong>
                            {selected ? (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white">
                                <FiCheck className="h-4 w-4" />
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <InfoPill>{service.likelyPublic ? "公開候補" : "候補"}</InfoPill>
                            <InfoPill>推定ポート: {service.detectedPublicPort ?? "未検出"}</InfoPill>
                          </div>
                          <p className="text-sm text-slate-600">
                            ports/expose: {service.portOptions.length > 0 ? service.portOptions.join(", ") : "なし"}
                          </p>
                          <p className="text-sm text-slate-500">{service.reason}</p>
                        </button>
                      );
                    })}
                  </div>
                ) : composeState.status === "inspecting" ? (
                  <p className="text-sm text-slate-500">compose を解析しています。</p>
                ) : composeState.inspection?.parseError ? (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    YAML の parse に失敗しました。右上の情報ボタンから raw YAML と parse error を確認できます。
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">サービス候補がまだありません。compose解析を実行してください。</p>
                )}
              </div>
            </StepCard>
          ) : (
            <StepCard
              index="STEP 4"
              title="manifest 指定の compose を解析してサービスを選ぶ"
              icon={<FiLock className="h-5 w-5" />}
              locked
            >
              <p className="text-sm text-slate-400">manifest の composePath が確定するとサービス候補を解析できます。</p>
            </StepCard>
          )}

          {hasComposeInspection ? (
            <StepCard index="STEP 5" title="アプリ情報を入力して登録" icon={<FiSettings className="h-5 w-5" />}>
              <div className="grid gap-4 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap gap-2">
                  <InfoPill>選択した compose: {form.composePath}</InfoPill>
                  <InfoPill>公開サービス: {form.publicServiceName}</InfoPill>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    アプリ名
                    <TextField required value={form.name} onChange={(event) => onFieldChange("name", event.target.value)} />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    説明
                    <TextField value={form.description} onChange={(event) => onFieldChange("description", event.target.value)} />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    サブドメイン
                    <TextField
                      required
                      placeholder={`app.${rootDomain}`}
                      value={form.hostname}
                      onChange={(event) => onFieldChange("hostname", event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    公開ポート
                    <TextField
                      type="number"
                      required
                      min={1}
                      max={65535}
                      value={form.publicPort}
                      onChange={(event) => onFieldChange("publicPort", event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    モード
                    <SelectField
                      value={form.mode}
                      onChange={(event) => onFieldChange("mode", event.target.value as "standard" | "headless")}
                    >
                      <option value="standard">Standard</option>
                      <option value="headless">Headless</option>
                    </SelectField>
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    再ビルド時データ保持
                    <SelectField
                      value={String(form.keepVolumesOnRebuild)}
                      onChange={(event) => onFieldChange("keepVolumesOnRebuild", event.target.value === "true")}
                    >
                      <option value="true">保持する</option>
                      <option value="false">保持しない</option>
                    </SelectField>
                  </label>
                </div>

                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  デバイス要件 (カンマ区切り)
                  <TextField
                    placeholder="/dev/bus/usb, /dev/ttyUSB0"
                    value={deviceRequirementsRaw}
                    onChange={(event) => onDeviceRequirementsChange(event.target.value)}
                  />
                </label>

                {composeState.inspection?.detectedDeviceRequirements.length ? (
                  <p className="text-sm text-slate-600">
                    compose から自動検出:{" "}
                    <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-800">
                      {composeState.inspection.detectedDeviceRequirements.join(", ")}
                    </code>
                  </p>
                ) : null}

                {displayedEnvRequirements.length > 0 ? (
                  <div className="grid gap-3">
                    <p className="text-sm font-semibold text-slate-700">compose / manifest から取得した環境変数</p>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {displayedEnvRequirements.map((requirement) => (
                        <label
                          key={requirement.name}
                          className="grid gap-2 rounded-[1.25rem] border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700"
                        >
                          <span>
                            {requirement.name}
                            {requirement.required ? " *" : ""}
                          </span>
                          <TextField
                            value={environmentOverrides[requirement.name] ?? ""}
                            onChange={(event) => onEnvironmentOverrideChange(requirement.name, event.target.value)}
                            placeholder={requirement.defaultValue ?? "値を入力"}
                          />
                          <small className="text-xs font-medium leading-5 text-slate-500">
                            services: <code>{requirement.services.join(", ")}</code>
                            {requirement.required
                              ? " / 必須"
                              : requirement.defaultValue !== null
                                ? ` / 既定値: ${requirement.defaultValue}`
                                : " / 任意"}
                          </small>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                  現在の設定ドメインは <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-800">{rootDomain}</code> です。
                  別ドメインも登録できますが、その場合は DNS または hosts で名前解決できるようにしてください。
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">追加後はアプリ一覧へ戻り、準備中の状態と関連ジョブをすぐ確認できます。</p>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={loading}
                  >
                    アプリを追加する
                  </button>
                </div>
              </div>
            </StepCard>
          ) : (
            <StepCard
              index="STEP 5"
              title="アプリ情報を入力して登録"
              icon={<FiLock className="h-5 w-5" />}
              locked
            >
              <p className="text-sm text-slate-400">compose 解析が終わると登録フォームが表示されます。</p>
            </StepCard>
          )}
        </form>
      </section>

      <ComposeInspectDialog
        open={inspectDialogOpen}
        title="Compose Inspection"
        inspection={composeState.inspection}
        onClose={() => setInspectDialogOpen(false)}
      />
    </div>
  );
}
