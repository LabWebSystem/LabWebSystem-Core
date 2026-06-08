import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FiAlertTriangle, FiCode, FiInfo, FiList, FiX } from "react-icons/fi";
import type { ComposeInspectionPayload } from "../types";

type InspectTab = "raw" | "parsed" | "analysis";

type ComposeInspectDialogProps = {
  open: boolean;
  title: string;
  inspection: ComposeInspectionPayload | null;
  onClose: () => void;
};

function stringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return error instanceof Error ? error.message : "JSON へ整形できませんでした。";
  }
}

const tabs: Array<{ key: InspectTab; label: string; icon: typeof FiCode }> = [
  { key: "raw", label: "Raw YAML", icon: FiCode },
  { key: "parsed", label: "Parsed JSON", icon: FiList },
  { key: "analysis", label: "Analysis", icon: FiInfo }
];

export function ComposeInspectDialog(props: ComposeInspectDialogProps) {
  const { open, title, inspection, onClose } = props;
  const [activeTab, setActiveTab] = useState<InspectTab>("raw");

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (open) {
      setActiveTab("raw");
    }
  }, [open]);

  const parsedJsonText = useMemo(() => {
    if (!inspection || inspection.parsedYaml === null) {
      return "";
    }
    return stringifyJson(inspection.parsedYaml);
  }, [inspection]);

  if (!open || !inspection) {
    return null;
  }

  const hasWarnings = inspection.parseWarnings.length > 0 || inspection.analysisWarnings.length > 0;

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-slate-950/45 px-4 py-6 backdrop-blur-sm" role="presentation" onClick={onClose}>
      <div
        className="mx-auto flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_30px_100px_-38px_rgba(15,23,42,0.7)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compose-inspect-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.98))] px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-indigo-600">Compose Inspect</p>
              <h2 id="compose-inspect-title" className="text-2xl font-bold text-slate-900">
                {title}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                source: <code>{inspection.source.kind}</code> / <code>{inspection.selectedComposePath}</code>
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              onClick={onClose}
            >
              <FiX className="h-4 w-4" />
              閉じる
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="compose inspection tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    selected
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-6 py-5">
          {activeTab === "raw" ? (
            <pre className="min-h-[320px] overflow-auto rounded-[1.25rem] border border-slate-200 bg-slate-950 px-5 py-4 font-mono text-[13px] leading-6 text-slate-100">
              {inspection.rawYaml.length > 0 ? inspection.rawYaml : "YAML を取得できませんでした。"}
            </pre>
          ) : null}

          {activeTab === "parsed" ? (
            inspection.parseError ? (
              <div className="grid gap-4">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-700">
                  <FiAlertTriangle className="h-4 w-4" />
                  YAML 解析エラー
                </div>
                <pre className="min-h-[320px] overflow-auto rounded-[1.25rem] border border-rose-200 bg-rose-50 px-5 py-4 font-mono text-[13px] leading-6 text-rose-900">
                  {inspection.parseError}
                </pre>
              </div>
            ) : (
              <pre className="min-h-[320px] overflow-auto rounded-[1.25rem] border border-slate-200 bg-slate-900 px-5 py-4 font-mono text-[13px] leading-6 text-slate-100">
                {parsedJsonText}
              </pre>
            )
          ) : null}

          {activeTab === "analysis" ? (
            <div className="grid gap-5">
              <section className="grid gap-3 rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-[0_20px_40px_-34px_rgba(15,23,42,0.45)]">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Metadata</h3>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    <p>
                      path: <code>{inspection.source.path}</code>
                    </p>
                    <p className="mt-2">
                      selected: <code>{inspection.selectedComposePath}</code>
                    </p>
                    {inspection.source.repositoryUrl ? (
                      <p className="mt-2">
                        repo: <code>{inspection.source.repositoryUrl}</code>
                      </p>
                    ) : null}
                    {inspection.source.branch ? (
                      <p className="mt-2">
                        branch: <code>{inspection.source.branch}</code>
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    {inspection.source.absolutePath ? (
                      <p>
                        local: <code>{inspection.source.absolutePath}</code>
                      </p>
                    ) : null}
                    {inspection.source.blobUrl ? (
                      <p className={inspection.source.absolutePath ? "mt-2" : ""}>
                        blob: <code>{inspection.source.blobUrl}</code>
                      </p>
                    ) : null}
                    <p className="mt-2">
                      compose候補: <strong>{inspection.composeCandidates.length}</strong> 件 / YAML:{" "}
                      <strong>{inspection.yamlFiles.length}</strong> 件
                    </p>
                    <p className="mt-2">
                      env要件:{" "}
                      <strong>
                        {inspection.environmentRequirements.length > 0
                          ? inspection.environmentRequirements.map((item) => item.name).join(", ")
                          : "なし"}
                      </strong>
                    </p>
                    <p className="mt-2">
                      device要件:{" "}
                      <strong>
                        {inspection.detectedDeviceRequirements.length > 0
                          ? inspection.detectedDeviceRequirements.join(", ")
                          : "なし"}
                      </strong>
                    </p>
                  </div>
                </div>
              </section>

              {inspection.parseError ? (
                <p className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  YAML の parse に失敗しているため、サービス解析結果は空です。
                </p>
              ) : null}

              <section className="grid gap-3">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Warnings</h3>
                {hasWarnings ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {inspection.parseWarnings.length > 0 ? (
                      <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4">
                        <h4 className="text-sm font-bold text-amber-900">Parser Warnings</h4>
                        <ul className="mt-3 grid gap-2 text-sm text-amber-800">
                          {inspection.parseWarnings.map((warning) => (
                            <li key={`parse-${warning}`}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {inspection.analysisWarnings.length > 0 ? (
                      <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4">
                        <h4 className="text-sm font-bold text-amber-900">Analysis Warnings</h4>
                        <ul className="mt-3 grid gap-2 text-sm text-amber-800">
                          {inspection.analysisWarnings.map((warning) => (
                            <li key={`analysis-${warning}`}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                    parser / analysis warning はありません。
                  </p>
                )}
              </section>

              <section className="grid gap-3">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Detected Services</h3>
                {inspection.services.length > 0 ? (
                  <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                    {inspection.services.map((service) => (
                      <article
                        key={service.name}
                        className="grid gap-2 rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-[0_20px_40px_-34px_rgba(15,23,42,0.45)]"
                      >
                        <strong className="text-base text-slate-900">{service.name}</strong>
                        <p className="text-sm text-slate-600">推定公開ポート: {service.detectedPublicPort ?? "未検出"}</p>
                        <p className="text-sm text-slate-600">
                          port options: {service.portOptions.length > 0 ? service.portOptions.join(", ") : "なし"}
                        </p>
                        <p className="text-sm text-slate-600">
                          published: {service.publishedPorts.length > 0 ? service.publishedPorts.join(", ") : "なし"}
                        </p>
                        <p className="text-sm text-slate-600">
                          expose: {service.exposePorts.length > 0 ? service.exposePorts.join(", ") : "なし"}
                        </p>
                        <p className="text-sm text-slate-500">{service.reason}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                    検出できた service はありません。
                  </p>
                )}
              </section>

              <section className="grid gap-3">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Detected Environment Variables</h3>
                {inspection.environmentRequirements.length > 0 ? (
                  <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                    {inspection.environmentRequirements.map((item) => (
                      <article key={item.name} className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                        <p className="text-sm font-bold text-slate-900">
                          {item.name}
                          {item.required ? " *" : ""}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">services: {item.services.join(", ")}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          default: {item.defaultValue === null ? "なし" : item.defaultValue}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                    環境変数は検出されていません。
                  </p>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
