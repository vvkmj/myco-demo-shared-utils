#!/usr/bin/env node
"use strict";
// ============================================================================
// MyCo Action — Customer-Side Autonomous Review Entrypoint
// Executes exclusively on customer GitHub Actions runner with zero external backend.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const prFetcher_1 = require("./prFetcher");
const llmClient_1 = require("./llmClient");
const productionReviewer_1 = require("./productionReviewer");
async function run() {
    console.log("==================================================================");
    console.log("   🚀 MYCO AI CODE REVIEW ACTION (CANONICAL RUNNER)               ");
    console.log("==================================================================");
    console.log(`Repository:    ${process.env.GITHUB_REPOSITORY || "local"}`);
    console.log(`Run ID:        ${process.env.GITHUB_RUN_ID || "local"}`);
    console.log(`Architecture:  Autonomous Customer-Side GitHub Action`);
    console.log(`Data Privacy:  Source code is never transmitted to MyCo servers.\n`);
    const prLink = (process.env.PR_LINK ||
        process.env.INPUT_PR_LINK ||
        (process.env.GITHUB_REPOSITORY && process.env.GITHUB_REF?.includes("/pull/")
            ? `https://github.com/${process.env.GITHUB_REPOSITORY}/pull/${process.env.GITHUB_REF.split("/")[2]}`
            : "")).trim();
    const githubToken = (process.env.GITHUB_TOKEN || process.env.INPUT_GITHUB_TOKEN || "").trim();
    const llmApiKey = (process.env.MYCO_LLM_API_KEY ||
        process.env.INPUT_MYCO_LLM_API_KEY ||
        process.env.LLM_API_KEY ||
        "").trim();
    const isDemoMode = (process.env.MYCO_DEMO_MODE || process.env.INPUT_DEMO_MODE || "false").toLowerCase() === "true";
    const ciGate = (process.env.CI_GATE || process.env.INPUT_CI_GATE || "false").toLowerCase() === "true";
    const gateMinSeverity = (process.env.GATE_MIN_SEVERITY || process.env.INPUT_GATE_MIN_SEVERITY || "P1").toUpperCase();
    // Fork PR security guard: GitHub intentionally restricts repository secrets on forks
    const isFork = Boolean(process.env.IS_FORK_PR === "true" ||
        (process.env.GITHUB_HEAD_REF && process.env.GITHUB_BASE_REF && process.env.GITHUB_REPOSITORY_OWNER && process.env.GITHUB_ACTOR !== process.env.GITHUB_REPOSITORY_OWNER));
    if (!llmApiKey && !isDemoMode) {
        if (isFork) {
            console.log("⚠️  SECURITY NOTICE: Fork pull request detected without repository secrets access.");
            console.log("    GitHub intentionally restricts repository secrets on fork PRs to prevent credential exfiltration.");
            console.log("    Skipping automated AI review safely without failing the pipeline.");
            process.exit(0);
        }
        console.error("❌ FATAL: Missing LLM API Key.");
        console.error("   Production review requires a customer LLM API key configured in GitHub Secrets.");
        console.error("   Configure repository secret 'MYCO_LLM_API_KEY' under Settings -> Secrets and variables -> Actions.");
        console.error("   To test locally without an API key, set demo-mode: 'true'.");
        process.exit(1);
    }
    if (!prLink) {
        console.error("❌ FATAL: Missing Pull Request context.");
        console.error("   Ensure the workflow triggers on 'pull_request' or provide 'pr-link' input.");
        process.exit(1);
    }
    console.log(`🎯 Target Pull Request: ${prLink}`);
    // 1. Fetch Pull Request Diff directly from GitHub REST API
    console.log("\n📥 Step 1/3: Fetching Pull Request diff directly from GitHub...");
    const diff = await (0, prFetcher_1.fetchDiffContext)(prLink, githubToken);
    console.log(`   PR Title:      "${diff.title}"`);
    console.log(`   Changed Files: ${diff.changedFiles.length}`);
    // 2. Execute Genuine AI Review
    console.log("\n🧠 Step 2/3: Executing AI Code Review...");
    let reviewResult;
    if (isDemoMode) {
        console.log("   ⚠️  Running in deterministic demo mode (MYCO_DEMO_MODE=true).");
        const demoFindings = [
            {
                id: "DEMO-01",
                severity: "P1",
                title: "Missing authorization check on sensitive endpoint",
                description: "Handler allows arbitrary state modification without RBAC verification.",
                fileName: diff.changedFiles[0]?.filename || "src/index.ts",
                filePath: diff.changedFiles[0]?.filename || "src/index.ts",
                lineNumber: 15,
                line: 15,
                rootCause: "Unauthenticated handler does not verify user roles before mutating database state.",
                impact: "Privilege escalation vulnerability allowing unprivileged users to modify protected state.",
                suggestedCorrection: "Add requireAdmin(req) authorization middleware prior to processing mutation.",
                fix: "Add requireAdmin(req) authorization middleware prior to processing mutation.",
                lineValid: true,
            },
        ];
        reviewResult = {
            summary: "Deterministic demo review completed.",
            findings: demoFindings,
            mergeBlocked: true,
            blockers: ["[P1] Missing authorization check (src/index.ts:15)"],
            riskLevel: "High",
            recommendation: "Request Changes",
        };
    }
    else {
        console.log("   Connecting directly to customer's configured AI provider over TLS 1.3 HTTPS...");
        const llmClient = (0, llmClient_1.createActionLLMClient)();
        reviewResult = await (0, productionReviewer_1.executeProductionAIReview)(diff, llmClient);
    }
    // 3. Publish Findings to GitHub Pull Request
    console.log("\n💬 Step 3/3: Publishing review report and annotations to GitHub...");
    let publicationSuccess = false;
    if (githubToken) {
        const pub = await (0, productionReviewer_1.publishReviewToGitHub)(diff, reviewResult, githubToken);
        publicationSuccess = pub.posted;
    }
    else {
        console.log("   ℹ️ GITHUB_TOKEN not provided — skipping comment publication.");
    }
    // 4. Detailed Status Reporting (Separating Review Execution from Merge Policy)
    console.log("\n==================================================================");
    console.log("   📊 MYCO REVIEW & MERGE POLICY STATUS REPORT                   ");
    console.log("==================================================================");
    console.log(`A. Review Execution Status: SUCCESS`);
    console.log(`   • AI Analysis:        Completed successfully`);
    console.log(`   • Findings Detected:  ${reviewResult.findings.length} finding(s)`);
    console.log(`   • Risk Level:         ${reviewResult.riskLevel}`);
    console.log(`   • Recommendation:     ${reviewResult.recommendation}`);
    console.log(`   • GitHub Publication: ${publicationSuccess ? "Published to PR" : "Skipped / Pending Token"}`);
    // Filter merge-blocking findings based on configured gate_min_severity
    const blockingSeverities = gateMinSeverity === "BLOCKER" ? ["BLOCKER"] : ["BLOCKER", "P1"];
    const mergeBlockers = reviewResult.findings.filter((f) => blockingSeverities.includes(f.severity));
    const hasPolicyViolations = mergeBlockers.length > 0;
    console.log(`\nB. Merge Policy Status:     ${hasPolicyViolations ? "POLICY VIOLATIONS DETECTED" : "CLEAN PASS"}`);
    if (hasPolicyViolations) {
        console.log(`   • Merge-Blocking Items: ${mergeBlockers.length} confirmed issue(s) (>= ${gateMinSeverity})`);
        for (const b of mergeBlockers) {
            console.log(`     - [${b.severity}] ${b.title} (${b.fileName}${b.lineNumber ? `:${b.lineNumber}` : ""})`);
        }
        if (ciGate) {
            console.error(`\n❌ CI Gate Enforcement: ACTIVE (ci-gate: true)`);
            console.error(`   Failing workflow step to enforce branch protection policy.`);
            process.exit(1);
        }
        else {
            console.log(`\nℹ️  CI Gate Enforcement: ADVISORY (ci-gate: false)`);
            console.log(`   Findings and recommendation posted to PR for peer review.`);
            console.log(`   Workflow step completed with exit code 0.`);
            process.exit(0);
        }
    }
    else {
        console.log(`   • Clean Pass: No merge-blocking findings detected.`);
        console.log(`✅ CI Gate Enforcement: PASSED (exit code 0)`);
        process.exit(0);
    }
}
run().catch((err) => {
    console.error("\n❌ Unhandled Action Error:", err.message);
    process.exit(1);
});
