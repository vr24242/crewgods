import type { WorkflowDAG } from "../../workflows/types";

export const bugTriage: WorkflowDAG = {
  id: "devops-bug-triage",
  name: "Bug Triage & Classification",
  vertical: "devops",
  description: "Triages incoming bug reports: classifies severity, assigns to team, creates investigation notes",
  version: "1.0.0",
  trigger: { type: "webhook", provider: "github", event: "issues.opened" },
  nodes: [
    {
      id: "load_issue",
      name: "Load Issue Details",
      type: "fetch",
      config: { integration: "github", operation: "issues.get", inputMap: { repo: { source: "trigger", path: "repository.full_name" }, issueNumber: { source: "trigger", path: "issue.number" } } },
    },
    {
      id: "fetch_related",
      name: "Search Related Issues",
      type: "fetch",
      config: { integration: "github", operation: "issues.search", inputMap: { repo: { source: "trigger", path: "repository.full_name" }, query: { source: "trigger", path: "issue.title" }, state: { source: "static", value: "all" } } },
    },
    {
      id: "fetch_recent_deploys",
      name: "Fetch Recent Deploys",
      type: "fetch",
      config: { integration: "github", operation: "deployments.list", inputMap: { repo: { source: "trigger", path: "repository.full_name" }, limit: { source: "static", value: 5 } } },
    },
    {
      id: "triage_bug",
      name: "AI Triage Bug",
      type: "ai_decide",
      config: {
        inputMap: {
          issue: { source: "node", nodeId: "load_issue", path: "issue" },
          relatedIssues: { source: "node", nodeId: "fetch_related", path: "issues" },
          recentDeploys: { source: "node", nodeId: "fetch_recent_deploys", path: "deployments" },
        },
      },
      agent: {
        role: "Bug Triage Engineer",
        model: "sonnet",
        instructions: `Triage this bug report. Return:
{
  "severity": "critical" | "high" | "medium" | "low",
  "category": "crash" | "data_loss" | "security" | "performance" | "ui" | "functionality" | "integration" | "other",
  "component": string (best guess at affected system/service),
  "isRegression": boolean,
  "possibleCause": string | null,
  "relatedToRecent Deploy": boolean,
  "duplicateOf": number | null (issue number if duplicate),
  "reproducibility": "always" | "intermittent" | "rare" | "unknown",
  "assignTeam": string,
  "labels": string[],
  "investigationSteps": string[] (3-5 steps to debug),
  "userImpact": string (1 sentence),
  "priority": "P0" | "P1" | "P2" | "P3"
}
P0: production down, data loss, security breach. P1: major feature broken, workaround exists. P2: minor feature broken. P3: cosmetic, enhancement.
Check if it correlates with recent deploys. Check for duplicates in related issues.`,
      },
    },
    {
      id: "branch_severity",
      name: "Route by Severity",
      type: "branch",
      config: { inputMap: { severity: { source: "node", nodeId: "triage_bug", path: "severity" } } },
    },
    {
      id: "label_issue",
      name: "Apply Labels",
      type: "action",
      config: { integration: "github", operation: "issues.addLabels", inputMap: { repo: { source: "trigger", path: "repository.full_name" }, issueNumber: { source: "trigger", path: "issue.number" }, labels: { source: "node", nodeId: "triage_bug", path: "labels" } } },
    },
    {
      id: "add_triage_comment",
      name: "Add Triage Comment",
      type: "action",
      config: { integration: "github", operation: "issues.createComment", inputMap: { repo: { source: "trigger", path: "repository.full_name" }, issueNumber: { source: "trigger", path: "issue.number" }, body: { source: "template", template: "**Auto-Triage: {{triage_bug.priority}} — {{triage_bug.severity}}**\n\nCategory: {{triage_bug.category}}\nComponent: {{triage_bug.component}}\nUser Impact: {{triage_bug.userImpact}}\nReproducibility: {{triage_bug.reproducibility}}\n\n**Investigation Steps:**\n{{triage_bug.investigationSteps}}\n\nAssigned to: {{triage_bug.assignTeam}}" } } },
    },
    {
      id: "alert_critical",
      name: "Alert Critical Bug",
      type: "action",
      config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "integration", provider: "settings", path: "oncallChannel" }, message: { source: "template", template: "🚨 {{triage_bug.priority}} BUG: {{load_issue.issue.title}}\nSeverity: {{triage_bug.severity}} | Component: {{triage_bug.component}}\nRegression: {{triage_bug.isRegression}} | Impact: {{triage_bug.userImpact}}\n{{load_issue.issue.html_url}}" } } },
    },
    {
      id: "notify_team",
      name: "Notify Team",
      type: "action",
      config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "integration", provider: "settings", path: "devChannel" }, message: { source: "template", template: "New bug triaged: {{load_issue.issue.title}} — {{triage_bug.priority}} ({{triage_bug.category}})\n{{load_issue.issue.html_url}}" } } },
    },
  ],
  edges: [
    { from: "load_issue", to: "triage_bug" },
    { from: "fetch_related", to: "triage_bug" },
    { from: "fetch_recent_deploys", to: "triage_bug" },
    { from: "triage_bug", to: "label_issue" },
    { from: "triage_bug", to: "add_triage_comment" },
    { from: "triage_bug", to: "branch_severity" },
    { from: "branch_severity", to: "alert_critical", condition: { type: "output_equals", field: "severity", value: "critical" } },
    { from: "branch_severity", to: "alert_critical", condition: { type: "output_equals", field: "severity", value: "high" } },
    { from: "branch_severity", to: "notify_team", condition: { type: "output_equals", field: "severity", value: "medium" } },
    { from: "branch_severity", to: "notify_team", condition: { type: "output_equals", field: "severity", value: "low" } },
  ],
  errorHandler: { onNodeFailure: "skip", maxRetries: 1, retryDelaySeconds: 30, notifyChannel: "#dev" },
  metadata: { estimatedDurationMs: 10000, estimatedCostCents: 4, tags: ["bugs", "triage", "issues", "classification"], requiredIntegrations: ["github", "slack"], requiredApprovals: [] },
};

export const prReview: WorkflowDAG = {
  id: "devops-pr-review",
  name: "Automated PR Review",
  vertical: "devops",
  description: "Reviews pull requests: code quality, security, test coverage, best practices, provides actionable feedback",
  version: "1.0.0",
  trigger: { type: "webhook", provider: "github", event: "pull_request.opened" },
  nodes: [
    {
      id: "load_pr",
      name: "Load PR Details",
      type: "fetch",
      config: { integration: "github", operation: "pulls.get", inputMap: { repo: { source: "trigger", path: "repository.full_name" }, pullNumber: { source: "trigger", path: "pull_request.number" } } },
    },
    {
      id: "load_diff",
      name: "Load PR Diff",
      type: "fetch",
      config: { integration: "github", operation: "pulls.getDiff", inputMap: { repo: { source: "trigger", path: "repository.full_name" }, pullNumber: { source: "trigger", path: "pull_request.number" } } },
    },
    {
      id: "load_files",
      name: "Load Changed Files",
      type: "fetch",
      config: { integration: "github", operation: "pulls.listFiles", inputMap: { repo: { source: "trigger", path: "repository.full_name" }, pullNumber: { source: "trigger", path: "pull_request.number" } } },
    },
    {
      id: "review_code",
      name: "AI Code Review",
      type: "ai_decide",
      config: {
        inputMap: {
          pr: { source: "node", nodeId: "load_pr", path: "pull_request" },
          diff: { source: "node", nodeId: "load_diff", path: "diff" },
          files: { source: "node", nodeId: "load_files", path: "files" },
        },
      },
      agent: {
        role: "Code Reviewer",
        model: "opus",
        instructions: `Review this PR thoroughly. Return:
{
  "overallVerdict": "approve" | "request_changes" | "comment",
  "qualityScore": 1-10,
  "summary": string (2-3 sentences on what this PR does),
  "findings": [{
    "file": string,
    "line": number,
    "severity": "critical" | "warning" | "suggestion" | "nitpick",
    "category": "bug" | "security" | "performance" | "style" | "logic" | "testing" | "docs",
    "message": string,
    "suggestion": string | null (code fix if applicable)
  }],
  "securityIssues": [{ file, line, vulnerability, cweId, fix }],
  "testCoverage": { hasTests: boolean, coverageAssessment: string, missingTests: string[] },
  "breakingChanges": boolean,
  "complexity": "low" | "medium" | "high",
  "positives": string[] (what's done well)
}
Focus on: null pointer risks, race conditions, SQL injection, XSS, missing error handling, resource leaks, missing input validation. Don't nitpick style if there's a linter. Be specific with line numbers.`,
      },
    },
    {
      id: "post_review",
      name: "Post Review Comment",
      type: "action",
      config: { integration: "github", operation: "pulls.createReview", inputMap: { repo: { source: "trigger", path: "repository.full_name" }, pullNumber: { source: "trigger", path: "pull_request.number" }, event: { source: "node", nodeId: "review_code", path: "overallVerdict" }, body: { source: "template", template: "**AI Code Review** (Score: {{review_code.qualityScore}}/10)\n\n{{review_code.summary}}\n\n**Positives:** {{review_code.positives}}\n**Test Coverage:** {{review_code.testCoverage.coverageAssessment}}\n**Breaking Changes:** {{review_code.breakingChanges}}\n**Complexity:** {{review_code.complexity}}" } } },
    },
    {
      id: "post_inline_comments",
      name: "Post Inline Comments",
      type: "loop",
      config: { inputMap: { items: { source: "node", nodeId: "review_code", path: "findings" } }, params: { itemNode: "post_single_comment" } },
    },
    {
      id: "post_single_comment",
      name: "Post Inline Comment",
      type: "action",
      config: { integration: "github", operation: "pulls.createReviewComment", inputMap: { repo: { source: "trigger", path: "repository.full_name" }, pullNumber: { source: "trigger", path: "pull_request.number" }, path: { source: "node", nodeId: "post_inline_comments", path: "currentItem.file" }, line: { source: "node", nodeId: "post_inline_comments", path: "currentItem.line" }, body: { source: "template", template: "[{{post_inline_comments.currentItem.severity}}] {{post_inline_comments.currentItem.message}}\n\n{{post_inline_comments.currentItem.suggestion}}" } } },
    },
    {
      id: "branch_security",
      name: "Check Security Issues",
      type: "branch",
      config: { inputMap: { hasSecurityIssues: { source: "expression", expression: "review_code.securityIssues.length > 0" } } },
    },
    {
      id: "alert_security",
      name: "Alert Security Issues",
      type: "action",
      config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "integration", provider: "settings", path: "securityChannel" }, message: { source: "template", template: "🔒 Security issues found in PR #{{load_pr.pull_request.number}}: {{load_pr.pull_request.title}}\n{{review_code.securityIssues.length}} vulnerabilities detected\n{{load_pr.pull_request.html_url}}" } } },
    },
  ],
  edges: [
    { from: "load_pr", to: "review_code" },
    { from: "load_diff", to: "review_code" },
    { from: "load_files", to: "review_code" },
    { from: "review_code", to: "post_review" },
    { from: "review_code", to: "post_inline_comments" },
    { from: "post_inline_comments", to: "post_single_comment" },
    { from: "review_code", to: "branch_security" },
    { from: "branch_security", to: "alert_security", condition: { type: "output_equals", field: "hasSecurityIssues", value: true } },
  ],
  errorHandler: { onNodeFailure: "skip", maxRetries: 1, retryDelaySeconds: 30, notifyChannel: "#dev" },
  metadata: { estimatedDurationMs: 30000, estimatedCostCents: 20, tags: ["pr", "review", "code-quality", "security"], requiredIntegrations: ["github", "slack"], requiredApprovals: [] },
};

export const changelogGeneration: WorkflowDAG = {
  id: "devops-changelog",
  name: "Release Changelog & Docs",
  vertical: "devops",
  description: "Generates changelogs from merged PRs, updates documentation, creates release notes",
  version: "1.0.0",
  trigger: { type: "webhook", provider: "github", event: "release.created" },
  nodes: [
    {
      id: "load_release",
      name: "Load Release Info",
      type: "fetch",
      config: { integration: "github", operation: "releases.get", inputMap: { repo: { source: "trigger", path: "repository.full_name" }, releaseId: { source: "trigger", path: "release.id" } } },
    },
    {
      id: "fetch_prs",
      name: "Fetch Merged PRs Since Last Release",
      type: "fetch",
      config: { integration: "github", operation: "pulls.list", inputMap: { repo: { source: "trigger", path: "repository.full_name" }, state: { source: "static", value: "closed" }, base: { source: "static", value: "main" }, sort: { source: "static", value: "updated" }, sinceTag: { source: "trigger", path: "release.previous_tag" } } },
    },
    {
      id: "fetch_commits",
      name: "Fetch Commits",
      type: "fetch",
      config: { integration: "github", operation: "repos.compareCommits", inputMap: { repo: { source: "trigger", path: "repository.full_name" }, base: { source: "trigger", path: "release.previous_tag" }, head: { source: "trigger", path: "release.tag_name" } } },
    },
    {
      id: "generate_changelog",
      name: "AI Generate Changelog",
      type: "ai_generate",
      config: {
        inputMap: {
          release: { source: "node", nodeId: "load_release", path: "release" },
          prs: { source: "node", nodeId: "fetch_prs", path: "pulls" },
          commits: { source: "node", nodeId: "fetch_commits", path: "commits" },
        },
      },
      agent: {
        role: "Release Manager",
        model: "sonnet",
        instructions: `Generate a comprehensive changelog. Return:
{
  "version": string,
  "date": string,
  "changelog": {
    "breaking": [{ title, description, migrationGuide }],
    "features": [{ title, description, prNumber }],
    "fixes": [{ title, description, prNumber }],
    "improvements": [{ title, description, prNumber }],
    "internal": [{ title, prNumber }]
  },
  "highlights": string (2-3 sentence summary of most impactful changes),
  "contributors": string[],
  "markdownChangelog": string (full formatted changelog in markdown),
  "slackAnnouncement": string (concise version for Slack, 3-5 bullet points)
}
Categorize by conventional commit prefixes or PR labels. Write user-facing descriptions (not technical jargon). Highlight breaking changes prominently.`,
      },
    },
    {
      id: "update_release_notes",
      name: "Update GitHub Release",
      type: "action",
      config: { integration: "github", operation: "releases.update", inputMap: { repo: { source: "trigger", path: "repository.full_name" }, releaseId: { source: "trigger", path: "release.id" }, body: { source: "node", nodeId: "generate_changelog", path: "markdownChangelog" } } },
    },
    {
      id: "notify_team",
      name: "Announce Release",
      type: "action",
      config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "integration", provider: "settings", path: "devChannel" }, message: { source: "template", template: "🚀 Release {{generate_changelog.version}} is live!\n\n{{generate_changelog.slackAnnouncement}}\n\nFull notes: {{load_release.release.html_url}}" } } },
    },
  ],
  edges: [
    { from: "load_release", to: "generate_changelog" },
    { from: "fetch_prs", to: "generate_changelog" },
    { from: "fetch_commits", to: "generate_changelog" },
    { from: "generate_changelog", to: "update_release_notes" },
    { from: "generate_changelog", to: "notify_team" },
  ],
  errorHandler: { onNodeFailure: "retry", maxRetries: 2, retryDelaySeconds: 60, notifyChannel: "#dev" },
  metadata: { estimatedDurationMs: 20000, estimatedCostCents: 8, tags: ["changelog", "release", "docs"], requiredIntegrations: ["github", "slack"], requiredApprovals: [] },
};

export const incidentResponse: WorkflowDAG = {
  id: "devops-incident-response",
  name: "Incident Response Automation",
  vertical: "devops",
  description: "Automates incident response: alert classification, runbook execution, status page updates, postmortem generation",
  version: "1.0.0",
  trigger: { type: "webhook", provider: "pagerduty", event: "incident.triggered" },
  nodes: [
    {
      id: "load_incident",
      name: "Load Incident Details",
      type: "fetch",
      config: { integration: "pagerduty", operation: "incidents.get", inputMap: { incidentId: { source: "trigger", path: "incident.id" } } },
    },
    {
      id: "fetch_metrics",
      name: "Fetch Service Metrics",
      type: "fetch",
      config: { integration: "monitoring", operation: "metrics.query", inputMap: { service: { source: "trigger", path: "incident.service.name" }, period: { source: "static", value: "last_1_hour" } } },
    },
    {
      id: "fetch_recent_changes",
      name: "Fetch Recent Changes",
      type: "fetch",
      config: { integration: "github", operation: "deployments.list", inputMap: { repo: { source: "trigger", path: "incident.service.metadata.repo" }, limit: { source: "static", value: 10 } } },
    },
    {
      id: "classify_incident",
      name: "AI Classify & Assess",
      type: "ai_decide",
      config: {
        inputMap: {
          incident: { source: "node", nodeId: "load_incident", path: "incident" },
          metrics: { source: "node", nodeId: "fetch_metrics", path: "metrics" },
          recentChanges: { source: "node", nodeId: "fetch_recent_changes", path: "deployments" },
        },
      },
      agent: {
        role: "Incident Commander",
        model: "sonnet",
        instructions: `Classify and assess this incident. Return:
{
  "severity": "SEV1" | "SEV2" | "SEV3" | "SEV4",
  "category": "outage" | "degradation" | "error_spike" | "latency" | "security" | "data" | "capacity",
  "affectedServices": string[],
  "userImpact": string,
  "estimatedUsersAffected": number | "unknown",
  "possibleCauses": [{ cause, confidence, evidence }],
  "correlatedDeploy": { sha, author, time, message } | null,
  "suggestedActions": [{ action, priority, automated: boolean }],
  "rollbackRecommended": boolean,
  "statusPageUpdate": { title, body, severity: "minor" | "major" | "critical" },
  "incidentChannel": string (suggested Slack channel name)
}
Correlate with recent deploys. Check if metrics show a clear regression point. If a deploy correlates >80%, recommend rollback.`,
      },
    },
    {
      id: "create_channel",
      name: "Create Incident Channel",
      type: "action",
      config: { integration: "slack", operation: "conversations.create", inputMap: { name: { source: "node", nodeId: "classify_incident", path: "incidentChannel" } } },
    },
    {
      id: "post_summary",
      name: "Post Incident Summary",
      type: "action",
      config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "node", nodeId: "create_channel", path: "channel.id" }, message: { source: "template", template: "🔴 INCIDENT: {{classify_incident.severity}} — {{classify_incident.category}}\n\nImpact: {{classify_incident.userImpact}}\nAffected: {{classify_incident.affectedServices}}\nRollback recommended: {{classify_incident.rollbackRecommended}}\n\n**Possible causes:**\n{{classify_incident.possibleCauses}}\n\n**Suggested actions:**\n{{classify_incident.suggestedActions}}" } } },
    },
    {
      id: "alert_oncall",
      name: "Alert On-Call Channel",
      type: "action",
      config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "integration", provider: "settings", path: "oncallChannel" }, message: { source: "template", template: "🚨 {{classify_incident.severity}} incident on {{load_incident.incident.service.name}}: {{load_incident.incident.title}}\nIncident channel: #{{classify_incident.incidentChannel}}\nRollback: {{classify_incident.rollbackRecommended}}" } } },
    },
    {
      id: "branch_rollback",
      name: "Check Rollback",
      type: "branch",
      config: { inputMap: { rollbackRecommended: { source: "node", nodeId: "classify_incident", path: "rollbackRecommended" } } },
    },
    {
      id: "request_rollback_approval",
      name: "Request Rollback Approval",
      type: "approval",
      config: {
        inputMap: {
          title: { source: "template", template: "Rollback {{classify_incident.correlatedDeploy.sha}} — {{classify_incident.severity}}" },
          description: { source: "template", template: "Correlated deploy by {{classify_incident.correlatedDeploy.author}}: {{classify_incident.correlatedDeploy.message}}" },
        },
      },
      agent: { role: "Incident Commander", model: "sonnet" },
    },
    {
      id: "execute_rollback",
      name: "Execute Rollback",
      type: "action",
      config: { integration: "github", operation: "deployments.create", inputMap: { repo: { source: "trigger", path: "incident.service.metadata.repo" }, ref: { source: "node", nodeId: "classify_incident", path: "correlatedDeploy.previousSha" }, environment: { source: "static", value: "production" }, description: { source: "static", value: "Automated rollback — incident response" } } },
    },
  ],
  edges: [
    { from: "load_incident", to: "classify_incident" },
    { from: "fetch_metrics", to: "classify_incident" },
    { from: "fetch_recent_changes", to: "classify_incident" },
    { from: "classify_incident", to: "create_channel" },
    { from: "create_channel", to: "post_summary" },
    { from: "classify_incident", to: "alert_oncall" },
    { from: "classify_incident", to: "branch_rollback" },
    { from: "branch_rollback", to: "request_rollback_approval", condition: { type: "output_equals", field: "rollbackRecommended", value: true } },
    { from: "request_rollback_approval", to: "execute_rollback", condition: { type: "approved" } },
  ],
  errorHandler: { onNodeFailure: "skip", maxRetries: 1, retryDelaySeconds: 15, notifyChannel: "#incidents" },
  metadata: { estimatedDurationMs: 15000, estimatedCostCents: 6, tags: ["incidents", "oncall", "response", "rollback"], requiredIntegrations: ["pagerduty", "github", "slack", "monitoring"], requiredApprovals: ["rollback"] },
};

export const devopsWorkflows = [bugTriage, prReview, changelogGeneration, incidentResponse];
