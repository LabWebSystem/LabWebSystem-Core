import { useMemo, useState } from "react";
import { FaArrowUpRightFromSquare, FaList, FaMagnifyingGlass, FaPlus, FaTableCellsLarge } from "react-icons/fa6";
import type { ApplicationListItem } from "../types";
import {
  applicationStatusMeta,
  buildAttentionSummary,
  formatRelative,
  healthMeta,
  shortCommit
} from "../ui";

type ApplicationsViewProps = {
  applications: ApplicationListItem[];
  selectedApplicationId: string | null;
  onOpenDetail: (applicationId: string) => void;
  onOpenImport: () => void;
};

type FilterStatus = "all" | "healthy" | "warning" | "critical" | "stopped";

function healthDot(application: ApplicationListItem): string {
  const severity = application.health?.severity;
  if (severity === "ok") {
    return "bg-emerald-500";
  }
  if (severity === "warning") {
    return "bg-amber-500";
  }
  if (severity === "critical") {
    return "bg-rose-500";
  }
  if (application.status === "Stopped") {
    return "bg-slate-400";
  }
  return "bg-slate-300";
}

export function ApplicationsView(props: ApplicationsViewProps) {
  const { applications, selectedApplicationId, onOpenDetail, onOpenImport } = props;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filtered = useMemo(() => {
    return applications.filter((application) => {
      const keyword = search.trim().toLowerCase();
      const matchesKeyword =
        keyword.length === 0 ||
        application.name.toLowerCase().includes(keyword) ||
        application.hostname.toLowerCase().includes(keyword);

      const severity = application.health?.severity;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "healthy" && severity === "ok") ||
        (statusFilter === "warning" && severity === "warning") ||
        (statusFilter === "critical" && severity === "critical") ||
        (statusFilter === "stopped" && application.status === "Stopped");

      return matchesKeyword && matchesStatus;
    });
  }, [applications, search, statusFilter]);

  return (
    <div className="space-y-6 p-6">
      <div className="shrink-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex max-w-md flex-1 items-center gap-3">
            <div className="relative w-full">
              <FaMagnifyingGlass className="absolute left-3 top-3 text-sm text-slate-400" />
              <input
                type="text"
                placeholder="アプリケーション名、ホスト名で検索..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm transition-colors focus:outline-none focus:border-violet-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as FilterStatus)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none"
            >
              <option value="all">すべて</option>
              <option value="healthy">正常</option>
              <option value="warning">警告</option>
              <option value="critical">異常</option>
              <option value="stopped">停止中</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`rounded-md p-2 text-sm ${viewMode === "grid" ? "bg-slate-100 text-slate-600" : "text-slate-400"}`}
              >
                <FaTableCellsLarge />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`rounded-md p-2 text-sm ${viewMode === "list" ? "bg-slate-100 text-slate-600" : "text-slate-400"}`}
              >
                <FaList />
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenImport}
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-violet-500/10 transition-all hover:bg-violet-700 hover:shadow-md active:scale-95"
            >
              <FaPlus className="text-xs" />
              新規登録
            </button>
          </div>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((application) => {
            const status = applicationStatusMeta(application.status);
            const health = healthMeta(application.health);

            return (
              <article
                key={application.application_id}
                className={`rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm ${
                  selectedApplicationId === application.application_id ? "ring-2 ring-violet-200" : ""
                }`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${healthDot(application)}`} />
                      <h3 className="truncate text-base font-bold text-slate-800">{application.name}</h3>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-400">{application.hostname}</p>
                  </div>
                  <button type="button" onClick={() => onOpenDetail(application.application_id)} className="text-slate-400 hover:text-slate-600">
                    <FaArrowUpRightFromSquare />
                  </button>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {health.label}
                  </span>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {status.label}
                  </span>
                  {application.has_update ? (
                    <span className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      更新あり
                    </span>
                  ) : null}
                </div>

                <p className="line-clamp-3 text-sm text-slate-600">{buildAttentionSummary(application)}</p>

                <div className="mt-4 grid gap-2 text-sm text-slate-500">
                  <div className="flex justify-between gap-4">
                    <span>更新情報</span>
                    <span>{application.has_update ? "あり" : "最新"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>コミット</span>
                    <span>{shortCommit(application.current_commit)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>最終更新</span>
                    <span>{formatRelative(application.updated_at)}</span>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onOpenDetail(application.application_id)}
                    className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    詳細を開く
                  </button>
                </div>
              </article>
            );
          })}

          {filtered.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-slate-200/60 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
              条件に一致するアプリケーションはありません
            </div>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/70">
              <tr className="text-left text-sm font-bold uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">名前 / ホスト</th>
                <th className="px-6 py-4">ステータス</th>
                <th className="px-6 py-4">コンテナ数</th>
                <th className="px-6 py-4">更新情報</th>
                <th className="px-6 py-4">最終更新</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map((application) => {
                const status = applicationStatusMeta(application.status);
                const health = healthMeta(application.health);
                const containerCount = application.health?.container_summary.total ?? 0;

                return (
                  <tr key={application.application_id}>
                    <td className="px-6 py-4">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-800">{application.name}</p>
                        <p className="truncate text-slate-400">{application.hostname}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">
                          {status.label}
                        </span>
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">
                          {health.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{containerCount}</td>
                    <td className="px-6 py-4 text-slate-600">{application.has_update ? "更新あり" : "最新"}</td>
                    <td className="px-6 py-4 text-slate-600">{formatRelative(application.updated_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenDetail(application.application_id)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        詳細
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-400">
                    条件に一致するアプリケーションはありません
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
