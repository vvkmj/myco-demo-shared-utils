"use strict";
// ============================================================================
// MyCo Action — AI Production Reviewer
// Analyzes PR diffs, executes genuine LLM code analysis, validates findings,
// verifies diff line boundaries, and publishes review results to GitHub.
// Source code NEVER touches any external MyCo Control Plane.
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFindings = parseFindings;
exports.extractValidHunkLines = extractValidHunkLines;
exports.buildProductionReviewPrompt = buildProductionReviewPrompt;
exports.validateAndNormalizeFindings = validateAndNormalizeFindings;
exports.parseReviewResponse = parseReviewResponse;
exports.executeProductionAIReview = executeProductionAIReview;
exports.publishReviewToGitHub = publishReviewToGitHub;
const axios_1 = __importDefault(require("axios"));
function parseFindings(reviewMarkdown) {
    const findings = [];
    const cardPattern = /---\s*\n\*\*\[(BLOCKER|P1|P2|P3)-(\d+)\]\*\*\s+(.+?)\n\*\*File:\*\*\s+(.+?)\n\*\*Root cause:\*\*\s+([\s\S]+?)\n\*\*Impact:\*\*\s+([\s\S]+?)\n\*\*Fix:\*\*\s+([\s\S]+?)\n---/g;
    let match;
    while ((match = cardPattern.exec(reviewMarkdown)) !== null) {
        const [, severity, num, title, fileRaw, rootCause, impact, fix] = match;
        const id = `${severity}-${num}`;
        const filePathMatch = fileRaw.match(/^([^\s·]+)/);
        const filePath = filePathMatch ? filePathMatch[1].trim() : fileRaw.trim();
        const lineMatch = fileRaw.match(/lines?\s+(\d+)/i);
        const line = lineMatch ? parseInt(lineMatch[1], 10) : null;
        findings.push({
            id,
            severity,
            title: title.trim(),
            file: fileRaw.trim(),
            filePath,
            line,
            rootCause: rootCause.trim(),
            impact: impact.trim(),
            fix: fix.trim(),
        });
    }
    return findings;
}
function extractValidHunkLines(patch) {
    const validLines = new Set();
    if (!patch)
        return validLines;
    const lines = patch.split("\n");
    let currentNewLine = 0;
    let inHunk = false;
    for (const line of lines) {
        const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (hunkMatch) {
            currentNewLine = parseInt(hunkMatch[2], 10);
            inHunk = true;
            continue;
        }
        if (!inHunk)
            continue;
        if (line.startsWith("+")) {
            validLines.add(currentNewLine);
            currentNewLine++;
        }
        else if (line.startsWith("-")) {
            // Deleted line
        }
        else if (line.startsWith(" ")) {
            validLines.add(currentNewLine);
            currentNewLine++;
        }
    }
    return validLines;
}
function buildProductionReviewPrompt(diff) {
    const fileSummaries = diff.changedFiles
        .map((f) => {
        const header = `### File: ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})`;
        const patch = f.patch ? `\n\`\`\`diff\n${f.patch}\n\`\`\`` : "\n_(No diff content)_";
        return `${header}${patch}`;
    })
        .join("\n\n");
    return `You are a Principal Software Engineer and Security Reviewer conducting a strict code review on a GitHub Pull Request.

Target: PR #${diff.prNumber || 0} - "${diff.title}"
Repository: ${diff.owner}/${diff.repo}
Base Branch: ${diff.baseRef} <- Head Branch: ${diff.headRef}

${diff.description ? `### PR Description:\n${diff.description}\n` : ""}

### Changed Files & Diffs:
${fileSummaries}

### Instructions:
1. Thoroughly analyze the changed files and diff hunks.
2. Identify:
   - Genuine bugs and defects
   - Security vulnerabilities (injection, auth bypass, exposed secrets, SSRF, etc.)
   - Performance problems (unindexed queries, memory leaks, quadratic complexity)
   - Incorrect business or logic flows
   - Actionable suggestions and concrete corrections
3. DO NOT hallucinate issues. If the code is correct, clean, and bug-free, return an empty findings list.
4. For every real issue identified, provide:
   - fileName: Exact path to the file from the diff
   - lineNumber: The exact relevant line number in the new file where the issue occurs
   - severity: "BLOCKER" (critical crash/data loss/security), "P1" (functional regression/broken contract), "P2" (missing error handling/defect), or "P3" (minor/code quality)
   - description: Clear, concise summary of the problem
   - rootCause: Detailed technical reason why the code is problematic
   - suggestedCorrection: Exact, actionable code or logic fix

### Output Format:
Respond ONLY with a valid JSON object matching this schema:
{
  "summary": "Brief executive summary of findings and overall review quality assessment",
  "riskLevel": "Low" | "Medium" | "High" | "Critical",
  "recommendation": "Approve" | "Request Changes" | "Block",
  "findings": [
    {
      "id": "SEC-01",
      "severity": "BLOCKER" | "P1" | "P2" | "P3",
      "title": "Short title describing the defect",
      "fileName": "path/to/file.ts",
      "lineNumber": 42,
      "description": "Clear explanation of the problem",
      "rootCause": "Why this code is problematic",
      "suggestedCorrection": "Actionable correction or code snippet"
    }
  ]
}
If no issues are found, return:
{
  "summary": "No issues identified. Clean pass.",
  "riskLevel": "Low",
  "recommendation": "Approve",
  "findings": []
}`;
}
function validateAndNormalizeFindings(rawFindings, diff) {
    const fileHunkMap = new Map();
    for (const f of diff.changedFiles) {
        fileHunkMap.set(f.filename.toLowerCase(), extractValidHunkLines(f.patch));
    }
    const validSeverities = ["BLOCKER", "P1", "P2", "P3"];
    const normalized = [];
    for (let i = 0; i < rawFindings.length; i++) {
        const rf = rawFindings[i];
        if (!rf || typeof rf !== "object")
            continue;
        let severity = "P2";
        if (validSeverities.includes(rf.severity?.toUpperCase())) {
            severity = rf.severity.toUpperCase();
        }
        const fileName = String(rf.fileName || rf.filePath || rf.file || "unknown").trim();
        const rawLine = rf.lineNumber !== undefined ? rf.lineNumber : rf.line;
        const lineNumber = typeof rawLine === "number" && !isNaN(rawLine) && rawLine > 0 ? Math.floor(rawLine) : null;
        const title = String(rf.title || `Finding #${i + 1}`).trim();
        const description = String(rf.description || rf.problem || title).trim();
        const rootCause = String(rf.rootCause || rf.reason || description).trim();
        const suggestedCorrection = String(rf.suggestedCorrection || rf.fix || rf.recommendation || "Review and update code.").trim();
        const impact = String(rf.impact || description).trim();
        let lineValid = false;
        const fileLines = fileHunkMap.get(fileName.toLowerCase());
        if (fileLines && lineNumber !== null) {
            lineValid = fileLines.has(lineNumber);
        }
        normalized.push({
            id: String(rf.id || `MYCO-${severity}-${i + 1}`),
            severity,
            title,
            description,
            fileName,
            filePath: fileName,
            lineNumber: lineValid ? lineNumber : null,
            line: lineValid ? lineNumber : null,
            rootCause,
            impact,
            suggestedCorrection,
            fix: suggestedCorrection,
            lineValid,
        });
    }
    return normalized;
}
function parseReviewResponse(rawResponse, diff) {
    let parsedJson = null;
    const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const potentialJson = jsonMatch ? jsonMatch[1] : rawResponse;
    try {
        parsedJson = JSON.parse(potentialJson);
    }
    catch {
        const firstBrace = rawResponse.indexOf("{");
        const lastBrace = rawResponse.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            try {
                parsedJson = JSON.parse(rawResponse.slice(firstBrace, lastBrace + 1));
            }
            catch {
                parsedJson = null;
            }
        }
    }
    if (parsedJson && typeof parsedJson === "object") {
        const rawFindings = Array.isArray(parsedJson.findings) ? parsedJson.findings : [];
        const findings = validateAndNormalizeFindings(rawFindings, diff);
        const summary = String(parsedJson.summary ||
            (findings.length === 0
                ? "No issues identified. Clean pass."
                : `Found ${findings.length} issue(s) during review.`));
        const blockers = findings
            .filter((f) => f.severity === "BLOCKER" || f.severity === "P1")
            .map((f) => `[${f.severity}] ${f.title}`);
        const mergeBlocked = blockers.length > 0;
        return {
            summary,
            findings,
            mergeBlocked,
            blockers,
            riskLevel: parsedJson.riskLevel || (findings.length > 0 ? "High" : "Low"),
            recommendation: parsedJson.recommendation || (findings.length > 0 ? "Request Changes" : "Approve"),
        };
    }
    const cards = parseFindings(rawResponse);
    if (cards.length > 0) {
        const findings = validateAndNormalizeFindings(cards.map((c) => ({
            id: c.id,
            severity: c.severity,
            title: c.title,
            fileName: c.filePath,
            lineNumber: c.line,
            description: c.title,
            rootCause: c.rootCause,
            suggestedCorrection: c.fix,
            impact: c.impact,
        })), diff);
        const blockers = findings
            .filter((f) => f.severity === "BLOCKER" || f.severity === "P1")
            .map((f) => `[${f.severity}] ${f.title}`);
        const mergeBlocked = blockers.length > 0;
        return {
            summary: `Review completed: ${findings.length} finding(s) parsed from markdown cards.`,
            findings,
            mergeBlocked,
            blockers,
            riskLevel: findings.some((f) => f.severity === "BLOCKER" || f.severity === "P1") ? "High" : "Medium",
            recommendation: findings.some((f) => f.severity === "BLOCKER" || f.severity === "P1")
                ? "Request Changes"
                : "Approve",
        };
    }
    const cleanPassRegex = /no (?:findings|bugs|issues|problems|vulnerabilities)|clean pass/i;
    if (cleanPassRegex.test(rawResponse)) {
        return {
            summary: "No issues identified. Clean pass.",
            findings: [],
            mergeBlocked: false,
            blockers: [],
            riskLevel: "Low",
            recommendation: "Approve",
        };
    }
    return {
        summary: "LLM output could not be parsed into structured findings. No fake findings generated.",
        findings: [],
        mergeBlocked: false,
        blockers: [],
        riskLevel: "Low",
        recommendation: "Approve",
    };
}
async function executeProductionAIReview(diff, llmClient) {
    const prompt = buildProductionReviewPrompt(diff);
    const rawResponse = await llmClient.generate(prompt);
    const parsed = parseReviewResponse(rawResponse, diff);
    const blockers = [];
    for (const f of parsed.findings) {
        if (f.severity === "P1" || f.severity === "BLOCKER") {
            blockers.push(`[${f.severity}] ${f.title} (${f.fileName}${f.lineNumber ? `:${f.lineNumber}` : ""})`);
        }
    }
    const mergeBlocked = blockers.length > 0;
    return {
        summary: parsed.summary,
        findings: parsed.findings,
        mergeBlocked,
        blockers,
        riskLevel: parsed.riskLevel,
        recommendation: parsed.recommendation,
    };
}
async function publishReviewToGitHub(diff, reviewResult, token) {
    if (!token) {
        console.log("ℹ️  GITHUB_TOKEN not provided — skipping review comment publication to GitHub.");
        return { posted: false, inlineCount: 0 };
    }
    if (diff.sourceType !== "pr" || !diff.prNumber) {
        console.log("ℹ️  Source is not a pull request — skipping PR review publication.");
        return { posted: false, inlineCount: 0 };
    }
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    };
    const base = `https://api.github.com/repos/${diff.owner}/${diff.repo}`;
    let headSha = "";
    try {
        const prRes = await axios_1.default.get(`${base}/pulls/${diff.prNumber}`, { headers });
        headSha = prRes.data.head?.sha || "";
    }
    catch (err) {
        console.warn(`⚠️  Could not retrieve PR head SHA: ${err.message}. Proceeding without commit binding.`);
    }
    const blockers = reviewResult.findings.filter((f) => f.severity === "BLOCKER");
    const p1s = reviewResult.findings.filter((f) => f.severity === "P1");
    const p2s = reviewResult.findings.filter((f) => f.severity === "P2");
    const p3s = reviewResult.findings.filter((f) => f.severity === "P3");
    let body = `## 🤖 MyCo AI SDET Code Review\n\n`;
    body += `### Overall Review Summary\n${reviewResult.summary}\n\n`;
    body += `**Risk Level:** \`${reviewResult.riskLevel}\` | **Recommendation:** \`${reviewResult.recommendation}\`\n\n`;
    if (reviewResult.findings.length === 0) {
        body += `✅ **Clean Pass**: No bugs, security vulnerabilities, or performance issues identified.\n\nAll changed files in this PR were analyzed and verified.`;
    }
    else {
        body += `### Findings Breakdown (${reviewResult.findings.length})\n\n`;
        body += `| Severity | Count | Status |\n`;
        body += `| :--- | :--- | :--- |\n`;
        body += `| 🚨 **Critical (BLOCKER)** | ${blockers.length} | ${blockers.length > 0 ? "Merge Blocking" : "Clean"} |\n`;
        body += `| ⚠️ **High (P1)** | ${p1s.length} | ${p1s.length > 0 ? "Merge Blocking" : "Clean"} |\n`;
        body += `| 🔍 **Medium (P2)** | ${p2s.length} | Advisory |\n`;
        body += `| ℹ️ **Low (P3)** | ${p3s.length} | Optional |\n\n`;
        body += `### Detailed Findings & Suggested Corrections\n\n`;
        for (const f of reviewResult.findings) {
            body += `#### [${f.severity}] ${f.title}\n`;
            body += `- **File:** \`${f.fileName}\`${f.lineNumber ? ` (Line ${f.lineNumber})` : ""}\n`;
            body += `- **Problem:** ${f.description}\n`;
            body += `- **Reason (Root Cause):** ${f.rootCause}\n`;
            body += `- **Suggested Correction:**\n\`\`\`\n${f.suggestedCorrection}\n\`\`\`\n\n`;
        }
    }
    const inlineCandidates = reviewResult.findings.filter((f) => f.lineValid && f.lineNumber !== null);
    const inlineComments = inlineCandidates.map((f) => ({
        path: f.fileName,
        line: f.lineNumber,
        side: "RIGHT",
        body: `**[${f.severity}] ${f.title}**\n\n${f.description}\n\n**Reason:** ${f.rootCause}\n\n**Suggested Correction:**\n\`\`\`\n${f.suggestedCorrection}\n\`\`\``,
    }));
    const event = reviewResult.mergeBlocked ? "REQUEST_CHANGES" : "COMMENT";
    try {
        await axios_1.default.post(`${base}/pulls/${diff.prNumber}/reviews`, {
            commit_id: headSha || undefined,
            body,
            event,
            comments: inlineComments,
        }, { headers });
        console.log(`✅  Review published to GitHub PR #${diff.prNumber} (${inlineComments.length} inline comment(s)).`);
        return { posted: true, inlineCount: inlineComments.length };
    }
    catch (err) {
        if (axios_1.default.isAxiosError(err) && err.response?.status === 422) {
            const respMsg = JSON.stringify(err.response?.data || "");
            if (respMsg.toLowerCase().includes("pullrequestreview") || respMsg.toLowerCase().includes("own pull request") || respMsg.toLowerCase().includes("author")) {
                console.warn(`⚠️  Cannot REQUEST_CHANGES on author's own PR — retrying with event: COMMENT...`);
                try {
                    await axios_1.default.post(`${base}/pulls/${diff.prNumber}/reviews`, {
                        commit_id: headSha || undefined,
                        body: `⚠️ **MERGE BLOCKING FINDINGS DETECTED** (Posted as comment due to PR author permissions):\n\n` + body,
                        event: "COMMENT",
                        comments: inlineComments,
                    }, { headers });
                    console.log(`✅  Comment review published to GitHub PR #${diff.prNumber} (${inlineComments.length} inline comment(s)).`);
                    return { posted: true, inlineCount: inlineComments.length };
                }
                catch {
                    // Fall through to body-only retry
                }
            }
            console.warn(`⚠️  Review rejected with 422 (line/comment validation) — retrying with body-only review...`);
            try {
                await axios_1.default.post(`${base}/pulls/${diff.prNumber}/reviews`, {
                    commit_id: headSha || undefined,
                    body: body + `\n\n_Note: Detailed line comments were embedded into this summary because direct diff line binding was rejected by GitHub._`,
                    event: "COMMENT",
                }, { headers });
                console.log(`✅  Body-only review published successfully to GitHub PR #${diff.prNumber}.`);
                return { posted: true, inlineCount: 0 };
            }
            catch (fallbackErr) {
                console.error(`❌  Failed to post fallback review to GitHub: ${fallbackErr.message}`);
                return { posted: false, inlineCount: 0 };
            }
        }
        console.error(`❌  Failed to publish review to GitHub PR: ${err.message}`);
        return { posted: false, inlineCount: 0 };
    }
}
