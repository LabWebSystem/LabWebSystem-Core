import fs from "node:fs";
import path from "node:path";
import { simpleGit } from "simple-git";
import { db, nowIso } from "../lib/db.js";
import { env } from "../lib/env.js";
import { recordEvent } from "./events.js";
import { finishJob, startJob } from "./jobs.js";

const upsertUpdateInfoStatement = db.prepare(`
  INSERT INTO update_info (
    application_id,
    current_commit,
    latest_remote_commit,
    has_update,
    checked_at
  ) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(application_id) DO UPDATE SET
    current_commit = excluded.current_commit,
    latest_remote_commit = excluded.latest_remote_commit,
    has_update = excluded.has_update,
    checked_at = excluded.checked_at
`);

function buildDryRunCommit(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

type ApplicationUpdateCheckTarget = {
  name: string;
  default_branch: string;
  current_commit: string | null;
};

function getApplicationTarget(applicationId: string): ApplicationUpdateCheckTarget {
  const row = db
    .prepare(
      `
        SELECT name, default_branch, current_commit
        FROM applications
        WHERE application_id = ?
      `
    )
    .get(applicationId) as ApplicationUpdateCheckTarget | undefined;

  if (!row) {
    throw new Error("対象アプリが見つかりません。");
  }

  return row;
}

export async function executeUpdateCheckJob(applicationId: string, jobId: string): Promise<void> {
  const application = getApplicationTarget(applicationId);
  startJob(jobId, "リモートとの差分確認を開始します。");

  const repoPath = path.join(env.appsRoot, application.name);
  if (env.executionMode === "dry-run") {
    const currentCommit = application.current_commit ?? "dry-run-current";
    const latestRemoteCommit = buildDryRunCommit("dry-run-remote");
    const hasUpdate = currentCommit !== latestRemoteCommit;

    upsertUpdateInfoStatement.run(applicationId, currentCommit, latestRemoteCommit, hasUpdate ? 1 : 0, nowIso());
    finishJob(jobId, "succeeded", hasUpdate ? "更新があります。" : "最新状態です。");
    recordEvent({
      scope: "update",
      applicationId,
      level: hasUpdate ? "warning" : "info",
      title: hasUpdate ? "更新があります" : "更新なし",
      message: hasUpdate
        ? `remote=${latestRemoteCommit} / current=${currentCommit}`
        : `最新コミット (${currentCommit}) を確認しました。`
    });
    return;
  }

  if (!fs.existsSync(repoPath)) {
    const message = `ローカルリポジトリが見つかりません: ${repoPath}`;
    finishJob(jobId, "failed", message);
    recordEvent({
      scope: "update",
      applicationId,
      level: "warning",
      title: "更新確認に失敗しました",
      message
    });
    return;
  }

  try {
    const git = simpleGit(repoPath);
    await git.fetch();

    const currentCommit = (await git.revparse(["HEAD"])).trim();
    const latestRemoteCommit = (await git.revparse([`origin/${application.default_branch}`])).trim();
    const hasUpdate = currentCommit !== latestRemoteCommit;

    upsertUpdateInfoStatement.run(applicationId, currentCommit, latestRemoteCommit, hasUpdate ? 1 : 0, nowIso());
    finishJob(jobId, "succeeded", hasUpdate ? "更新があります。" : "最新状態です。");
    recordEvent({
      scope: "update",
      applicationId,
      level: hasUpdate ? "warning" : "info",
      title: hasUpdate ? "更新があります" : "更新なし",
      message: hasUpdate
        ? `remote=${latestRemoteCommit} / current=${currentCommit}`
        : `最新コミット (${currentCommit}) を確認しました。`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    finishJob(jobId, "failed", message);
    recordEvent({
      scope: "update",
      applicationId,
      level: "error",
      title: "更新確認に失敗しました",
      message
    });
  }
}
