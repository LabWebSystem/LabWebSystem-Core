import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { simpleGit } from "simple-git";
import { z } from "zod";
import {
	collectRepositoryMetadataFromPaths as collectComposeRepositoryMetadataFromPaths,
	inspectComposeYaml,
	listLocalRepositoryFiles as listComposeLocalRepositoryFiles,
	type ComposeInspectionResult,
	type RepositoryMetadata
} from "../../services/compose-inspection.js";
import {
	findLabcoreManifestPath,
	parseLabcoreManifest,
	type LabcoreManifest
} from "../../services/import-manifest.js";

export const resolveImportSchema = z.object({
	sourceUrl: z.string().url()
});

export const inspectImportComposeSchema = z.object({
	repositoryUrl: z.string().url(),
	branch: z.string().min(1).max(120),
	composePath: z.string().min(1).max(400)
});

type ParsedGithubImportSource = {
	sourceType: "tree" | "repository";
	canonicalRepositoryUrl: string;
	treeTail: string | null;
};

type GithubRepositoryRef = {
	owner: string;
	repository: string;
};

type GithubTreeEntry = {
	path: string;
	mode: string;
	type: "blob" | "tree";
	sha: string;
	url: string;
};

type GithubTreeResponse = {
	tree: GithubTreeEntry[];
	truncated?: boolean;
};

type GithubBlobResponse = {
	content: string;
	encoding: string;
};

type ResolvedImportManifest = {
	manifestPath: string;
	manifest: LabcoreManifest;
};

type ImportResolveResult = {
	canonicalRepositoryUrl: string;
	resolvedBranch: string;
	branchFixed: boolean;
	branchCandidates: string[];
	repositoryFiles: string[];
	yamlFiles: string[];
	composeCandidates: string[];
	recommendedComposePath: string | null;
	manifestPath: string;
	manifest: LabcoreManifest;
	warning?: string;
};

function decodeSegment(segment: string): string {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
}

function normalizeBranchInput(value: string): string {
	return value.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

function parseGithubImportSource(sourceUrl: string): ParsedGithubImportSource {
	let parsedUrl: URL;

	try {
		parsedUrl = new URL(sourceUrl.trim());
	} catch {
		throw new Error("GitHub URL の形式が不正です。");
	}

	const hostname = parsedUrl.hostname.toLowerCase();

	if (hostname !== "github.com" && hostname !== "www.github.com") {
		throw new Error("GitHub の URL のみ指定できます。");
	}

	const segments = parsedUrl.pathname
		.split("/")
		.filter((segment) => segment.length > 0)
		.map((segment) => decodeSegment(segment));

	if (segments.length < 2) {
		throw new Error("リポジトリ URL は owner/repo 形式で指定してください。");
	}

	const owner = segments[0].trim();
	const rawRepo = segments[1].trim();
	const repository = rawRepo.endsWith(".git") ? rawRepo.slice(0, -4) : rawRepo;

	if (owner.length === 0 || repository.length === 0) {
		throw new Error("GitHub URL から owner/repo を解釈できません。");
	}

	const canonicalRepositoryUrl = `https://github.com/${owner}/${repository}.git`;
	const hasTreePath = segments[2] === "tree";
	const rawTreeTail = hasTreePath ? segments.slice(3).join("/") : "";
	const treeTail = normalizeBranchInput(rawTreeTail);

	if (hasTreePath) {
		return {
			sourceType: "tree",
			canonicalRepositoryUrl,
			treeTail: treeTail.length > 0 ? treeTail : null
		};
	}

	return {
		sourceType: "repository",
		canonicalRepositoryUrl,
		treeTail: null
	};
}

function selectBestBranch(
	treeTail: string | null,
	branchCandidates: string[]
): { branch: string; matched: boolean } {
	if (!treeTail) {
		if (branchCandidates.includes("main")) {
			return { branch: "main", matched: true };
		}

		if (branchCandidates.length > 0) {
			return { branch: branchCandidates[0], matched: true };
		}

		return { branch: "main", matched: false };
	}

	const normalizedTail = normalizeBranchInput(treeTail);
	let bestMatch = "";

	for (const branch of branchCandidates) {
		if (normalizedTail === branch || normalizedTail.startsWith(`${branch}/`)) {
			if (branch.length > bestMatch.length) {
				bestMatch = branch;
			}
		}
	}

	if (bestMatch.length > 0) {
		return { branch: bestMatch, matched: true };
	}

	return { branch: normalizedTail, matched: false };
}

async function fetchRemoteBranches(repositoryUrl: string): Promise<string[]> {
	const output = await simpleGit().listRemote([repositoryUrl, "--heads"]);

	const branches = output
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => {
			const match = line.match(/refs\/heads\/(.+)$/);
			return match ? match[1].trim() : "";
		})
		.filter((branch) => branch.length > 0);

	return [...new Set(branches)].sort((a, b) => a.localeCompare(b));
}

function normalizeCreateImportInput(
	repositoryUrl: string,
	defaultBranch: string
): { repositoryUrl: string; defaultBranch: string } {
	const parsed = parseGithubImportSource(repositoryUrl);

	if (parsed.sourceType === "repository") {
		return {
			repositoryUrl: parsed.canonicalRepositoryUrl,
			defaultBranch: "main"
		};
	}

	const preferredBranch = normalizeBranchInput(defaultBranch);
	const resolvedBranch =
		preferredBranch.length > 0 ? preferredBranch : parsed.treeTail ?? "main";

	if (resolvedBranch.length > 120) {
		throw new Error("ブランチ名が長すぎます。");
	}

	return {
		repositoryUrl: parsed.canonicalRepositoryUrl,
		defaultBranch: resolvedBranch
	};
}

function parseCanonicalGithubRepository(repositoryUrl: string): GithubRepositoryRef {
	const normalized = normalizeCreateImportInput(repositoryUrl, "main");
	const parsedUrl = new URL(normalized.repositoryUrl);
	const segments = parsedUrl.pathname.split("/").filter((segment) => segment.length > 0);

	if (segments.length < 2) {
		throw new Error("GitHub リポジトリ URL を解釈できません。");
	}

	return {
		owner: segments[0],
		repository: segments[1].endsWith(".git") ? segments[1].slice(0, -4) : segments[1]
	};
}

async function fetchGithubJson<T>(url: string): Promise<T> {
	const response = await fetch(url, {
		headers: {
			Accept: "application/vnd.github+json",
			"User-Agent": "lab-core-backend"
		}
	});

	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		throw new Error(`GitHub API ${response.status}: ${detail || "取得に失敗しました。"}`);
	}

	return (await response.json()) as T;
}

async function fetchRepositoryTree(
	repositoryUrl: string,
	branch: string
): Promise<GithubTreeEntry[]> {
	const ref = parseCanonicalGithubRepository(repositoryUrl);
	const normalizedBranch = normalizeBranchInput(branch);
	const treeUrl =
		`https://api.github.com/repos/${ref.owner}/${ref.repository}` +
		`/git/trees/${encodeURIComponent(normalizedBranch)}?recursive=1`;

	try {
		const directTree = await fetchGithubJson<GithubTreeResponse>(treeUrl);
		return directTree.tree.filter((entry) => entry.type === "blob");
	} catch {
		const refUrl =
			`https://api.github.com/repos/${ref.owner}/${ref.repository}` +
			`/git/ref/heads/${encodeURIComponent(normalizedBranch)}`;

		const refResponse = await fetchGithubJson<{ object?: { sha?: string } }>(refUrl);
		const refSha = refResponse.object?.sha;

		if (!refSha) {
			throw new Error(`branch ${normalizedBranch} の参照先を取得できません。`);
		}

		const commitResponse = await fetchGithubJson<{ tree?: { sha?: string } }>(
			`https://api.github.com/repos/${ref.owner}/${ref.repository}/git/commits/${refSha}`
		);

		const treeSha = commitResponse.tree?.sha;

		if (!treeSha) {
			throw new Error(`branch ${normalizedBranch} の tree sha を取得できません。`);
		}

		const treeFromCommit = await fetchGithubJson<GithubTreeResponse>(
			`https://api.github.com/repos/${ref.owner}/${ref.repository}/git/trees/${treeSha}?recursive=1`
		);

		return treeFromCommit.tree.filter((entry) => entry.type === "blob");
	}
}

async function withTemporaryGitClone<T>(
	repositoryUrl: string,
	branch: string,
	run: (repoPath: string) => Promise<T>
): Promise<T> {
	const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lab-core-remote-"));
	const normalizedBranch = normalizeBranchInput(branch);

	try {
		await simpleGit().clone(repositoryUrl, tempRoot, [
			"--depth",
			"1",
			"--branch",
			normalizedBranch,
			"--single-branch"
		]);

		return await run(tempRoot);
	} finally {
		fs.rmSync(tempRoot, { recursive: true, force: true });
	}
}

async function fetchBlobContent(blobUrl: string): Promise<string> {
	const blob = await fetchGithubJson<GithubBlobResponse>(blobUrl);

	if (blob.encoding !== "base64") {
		throw new Error(`未対応の blob encoding です: ${blob.encoding}`);
	}

	return Buffer.from(blob.content.replace(/\n/g, ""), "base64").toString("utf8");
}

function listLocalRepositoryFiles(repoPath: string): string[] {
	return listComposeLocalRepositoryFiles(repoPath);
}

function collectRepositoryMetadataFromPaths(repositoryFiles: string[]): RepositoryMetadata {
	return collectComposeRepositoryMetadataFromPaths(repositoryFiles);
}

function collectRepositoryMetadata(entries: GithubTreeEntry[]): RepositoryMetadata {
	return collectRepositoryMetadataFromPaths(entries.map((entry) => entry.path));
}

async function fetchRepositoryFilesFromRemote(
	repositoryUrl: string,
	branch: string
): Promise<string[]> {
	try {
		const entries = await fetchRepositoryTree(repositoryUrl, branch);
		return entries.map((entry) => entry.path).sort((a, b) => a.localeCompare(b));
	} catch {
		return withTemporaryGitClone(repositoryUrl, branch, async (repoPath) =>
			listLocalRepositoryFiles(repoPath).sort((a, b) => a.localeCompare(b))
		);
	}
}

async function collectRepositoryMetadataFromRemote(
	repositoryUrl: string,
	branch: string
): Promise<{ repositoryFiles: string[]; metadata: RepositoryMetadata }> {
	const repositoryFiles = await fetchRepositoryFilesFromRemote(repositoryUrl, branch);

	return {
		repositoryFiles,
		metadata: collectRepositoryMetadataFromPaths(repositoryFiles)
	};
}

async function resolveImportManifestFromRemote(
	repositoryUrl: string,
	branch: string
): Promise<ResolvedImportManifest> {
	try {
		const entries = await fetchRepositoryTree(repositoryUrl, branch);
		const manifestPath = findLabcoreManifestPath(entries.map((entry) => entry.path));
		const matchedEntry = entries.find((entry) => entry.path === manifestPath);

		if (!matchedEntry) {
			throw new Error(`labcore.app.yaml の取得に失敗しました: ${manifestPath}`);
		}

		const rawManifest = await fetchBlobContent(matchedEntry.url);

		return {
			manifestPath,
			manifest: parseLabcoreManifest(rawManifest, manifestPath)
		};
	} catch {
		return withTemporaryGitClone(repositoryUrl, branch, async (repoPath) => {
			const repositoryFiles = listLocalRepositoryFiles(repoPath);
			const manifestPath = findLabcoreManifestPath(repositoryFiles);
			const absoluteManifestPath = path.resolve(repoPath, manifestPath);
			const rawManifest = fs.readFileSync(absoluteManifestPath, "utf8");

			return {
				manifestPath,
				manifest: parseLabcoreManifest(rawManifest, manifestPath)
			};
		});
	}
}

function resolveSelectedComposePath(composePath: string, metadata: RepositoryMetadata): string {
	const normalizedComposePath = composePath.trim().replace(/^\/+/, "");

	return normalizedComposePath.length > 0
		? normalizedComposePath
		: metadata.recommendedComposePath ?? metadata.composeCandidates[0] ?? "";
}

function buildResolveWarning(
	parsedSource: ParsedGithubImportSource,
	selectedBranch: { branch: string; matched: boolean },
	branchCandidates: string[]
): string | undefined {
	if (parsedSource.sourceType !== "tree" || selectedBranch.matched) {
		return undefined;
	}

	if (branchCandidates.length === 0) {
		return "branch候補を取得できなかったため、URLから解釈したbranchを使用しています。";
	}

	return "URLのbranch部分を既存branch候補と完全一致できなかったため、URLから解釈したbranchを使用しています。";
}

export async function resolveImportSource(sourceUrl: string): Promise<ImportResolveResult> {
	const parsedSource = parseGithubImportSource(sourceUrl);

	let branchCandidates: string[] = [];
	let selectedBranch: { branch: string; matched: boolean } = {
		branch: parsedSource.sourceType === "repository" ? "main" : parsedSource.treeTail ?? "main",
		matched: false
	};

	try {
		branchCandidates = await fetchRemoteBranches(parsedSource.canonicalRepositoryUrl);
		selectedBranch = selectBestBranch(parsedSource.treeTail, branchCandidates);
	} catch {
		branchCandidates = [];
	}

	const resolvedBranch = selectedBranch.branch;
	const [{ repositoryFiles, metadata }, manifestResult] = await Promise.all([
		collectRepositoryMetadataFromRemote(parsedSource.canonicalRepositoryUrl, resolvedBranch),
		resolveImportManifestFromRemote(parsedSource.canonicalRepositoryUrl, resolvedBranch)
	]);

	return {
		canonicalRepositoryUrl: parsedSource.canonicalRepositoryUrl,
		resolvedBranch,
		branchFixed: parsedSource.sourceType === "repository",
		branchCandidates,
		repositoryFiles,
		yamlFiles: metadata.yamlFiles,
		composeCandidates: metadata.composeCandidates,
		recommendedComposePath: metadata.recommendedComposePath,
		manifestPath: manifestResult.manifestPath,
		manifest: manifestResult.manifest,
		warning: buildResolveWarning(parsedSource, selectedBranch, branchCandidates)
	};
}

export async function inspectImportCompose(
	repositoryUrl: string,
	branch: string,
	composePath: string
): Promise<ComposeInspectionResult> {
	try {
		const entries = await fetchRepositoryTree(repositoryUrl, branch);
		const metadata = collectRepositoryMetadata(entries);
		const normalizedPath = resolveSelectedComposePath(composePath, metadata);
		const matchedEntry = entries.find((entry) => entry.path === normalizedPath);

		if (!matchedEntry) {
			throw new Error(`compose ファイルが見つかりません: ${normalizedPath}`);
		}

		const content = await fetchBlobContent(matchedEntry.url);

		return inspectComposeYaml({
			rawYaml: content,
			composeCandidates: metadata.composeCandidates,
			yamlFiles: metadata.yamlFiles,
			recommendedComposePath: metadata.recommendedComposePath,
			selectedComposePath: normalizedPath,
			source: {
				kind: "github",
				path: normalizedPath,
				repositoryUrl,
				branch,
				blobUrl: matchedEntry.url
			}
		});
	} catch {
		return withTemporaryGitClone(repositoryUrl, branch, async (repoPath) => {
			const repositoryFiles = listLocalRepositoryFiles(repoPath);
			const metadata = collectRepositoryMetadataFromPaths(repositoryFiles);
			const normalizedPath = resolveSelectedComposePath(composePath, metadata);

			if (normalizedPath.length === 0) {
				throw new Error("compose 候補を検出できませんでした。");
			}

			const absolutePath = path.resolve(repoPath, normalizedPath);

			if (!fs.existsSync(absolutePath)) {
				throw new Error(`compose ファイルが見つかりません: ${normalizedPath}`);
			}

			const rawYaml = fs.readFileSync(absolutePath, "utf8");

			return inspectComposeYaml({
				rawYaml,
				composeCandidates: metadata.composeCandidates,
				yamlFiles: metadata.yamlFiles,
				recommendedComposePath: metadata.recommendedComposePath,
				selectedComposePath: normalizedPath,
				source: {
					kind: "github",
					path: normalizedPath,
					repositoryUrl,
					branch
				}
			});
		});
	}
}