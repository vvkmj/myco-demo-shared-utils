"use strict";
// ============================================================================
// MyCo Action — PR Diff Context Fetcher
// Fetches unified diff and changed file metadata directly from GitHub REST API.
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.annotatePatchWithLineNumbers = annotatePatchWithLineNumbers;
exports.buildDiffSummary = buildDiffSummary;
exports.parsePRUrl = parsePRUrl;
exports.fetchDiffContext = fetchDiffContext;
const axios_1 = __importDefault(require("axios"));
function makeHeaders(token) {
    const headers = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token)
        headers["Authorization"] = `Bearer ${token}`;
    return headers;
}
function annotatePatchWithLineNumbers(patch) {
    const lines = patch.split("\n");
    const annotated = [];
    let newLine = 0;
    let oldLine = 0;
    for (const line of lines) {
        const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (hunkMatch) {
            oldLine = parseInt(hunkMatch[1], 10);
            newLine = parseInt(hunkMatch[2], 10);
            annotated.push(line);
            continue;
        }
        if (line === "\\ No newline at end of file") {
            annotated.push(line);
            continue;
        }
        if (line.startsWith("+")) {
            annotated.push(`+${newLine}: ${line.slice(1)}`);
            newLine++;
        }
        else if (line.startsWith("-")) {
            annotated.push(`-${oldLine}: ${line.slice(1)}`);
            oldLine++;
        }
        else {
            const content = line.length > 0 ? line.slice(1) : "";
            annotated.push(` ${newLine}: ${content}`);
            newLine++;
            oldLine++;
        }
    }
    return annotated.join("\n");
}
function buildDiffSummary(files) {
    const lines = [];
    for (const f of files) {
        lines.push(`### ${f.status.toUpperCase()}: ${f.filename} (+${f.additions}/-${f.deletions})`);
        if (f.patch) {
            const annotated = annotatePatchWithLineNumbers(f.patch);
            const patch = annotated.length > 8000
                ? annotated.slice(0, 8000) + "\n... (truncated — file too large)"
                : annotated;
            lines.push("```diff\n" + patch + "\n```");
        }
    }
    return lines.join("\n\n");
}
function parsePRUrl(url) {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!match)
        throw new Error(`Cannot parse GitHub PR URL: ${url}`);
    return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) };
}
async function fetchDiffContext(urlOrIdentifier, explicitToken) {
    const token = explicitToken || process.env.GITHUB_TOKEN;
    const headers = makeHeaders(token);
    const { owner, repo, number } = parsePRUrl(urlOrIdentifier);
    const base = `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`;
    console.log(`🔍  Fetching PR #${number} from ${owner}/${repo} via GitHub REST API...`);
    const [prRes, filesRes] = await Promise.all([
        axios_1.default.get(base, { headers }),
        axios_1.default.get(`${base}/files`, { headers, params: { per_page: 100 } }),
    ]);
    const pr = prRes.data;
    const changedFiles = filesRes.data.map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
    }));
    return {
        owner,
        repo,
        sourceType: "pr",
        prNumber: number,
        title: pr.title || `PR #${number}`,
        description: pr.body || "",
        author: pr.user?.login || "unknown",
        baseRef: pr.base?.ref || "",
        headRef: pr.head?.ref || "",
        state: pr.state || "open",
        labels: (pr.labels || []).map((l) => l.name),
        reviewers: [
            ...(pr.requested_reviewers || []).map((r) => r.login),
            ...(pr.requested_teams || []).map((t) => t.name),
        ],
        changedFiles,
        diffSummary: buildDiffSummary(changedFiles),
        commits: [],
        slug: `pr${number}`,
    };
}
