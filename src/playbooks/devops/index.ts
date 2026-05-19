import type { PlaybookDefinition } from "@/engine/types";

const devopsPlaybook: PlaybookDefinition = {
  id: "devops",
  name: "Dev & Engineering Ops",
  description: "AI engineering team that triages bugs, reviews PRs, writes docs, and manages incidents.",
  industry: "engineering",
  icon: "Code",
  color: "#14B8A6",
  requiredIntegrations: [
    { provider: "github", name: "GitHub", description: "Connect your repositories" },
    { provider: "slack", name: "Slack", description: "Engineering notifications" },
  ],
  onboardingQuestions: [
    { id: "repo", label: "Primary repository (owner/repo)", type: "text", placeholder: "myorg/myapp", required: true },
    { id: "code_review_standards", label: "Code review focus areas", type: "text", placeholder: "Security, performance, readability", required: false },
    { id: "incident_channel", label: "Incident Slack channel", type: "text", placeholder: "#incidents", required: false },
  ],
  agents: [
    {
      name: "Bug Triager",
      role: "Triage incoming bug reports, categorize, prioritize, and assign",
      instructions: `You are the Bug Triager.

For each new issue labeled as a bug:
1. Read the bug report and reproduce steps
2. Categorize: frontend, backend, infrastructure, data, security
3. Assess severity: critical (system down), high (major feature broken), medium (degraded), low (cosmetic)
4. Identify the likely area of code affected
5. Assign to the appropriate team or engineer
6. Add relevant labels

For security-related bugs, immediately flag to the security team and mark as confidential.`,
      tools: ["github_get_issues", "github_add_comment", "send_slack_message"],
      model: "sonnet",
      schedule: { type: "interval", value: "1h", intervalSeconds: 3600 },
    },
    {
      name: "PR Reviewer",
      role: "Review pull requests for code quality, security, and best practices",
      instructions: `You are the PR Reviewer.

For each new pull request:
1. Review the diff for code quality issues
2. Check for security vulnerabilities (SQL injection, XSS, auth bypass, secrets in code)
3. Verify test coverage (new code should have tests)
4. Check for performance issues (N+1 queries, unnecessary re-renders, missing indexes)
5. Leave constructive comments with specific suggestions

Be helpful, not nitpicky. Focus on things that matter: correctness, security, performance. Style preferences are for linters, not reviewers.`,
      tools: ["github_get_pull_requests", "github_add_comment", "send_slack_message"],
      model: "opus",
      trigger: { event: "pr_opened" },
    },
    {
      name: "Docs Writer",
      role: "Keep documentation up to date with code changes",
      instructions: `You are the Docs Writer.

Responsibilities:
1. Monitor merged PRs for changes that need documentation updates
2. Update API docs when endpoints change
3. Update README and setup guides when dependencies or config change
4. Write changelog entries for user-facing changes
5. Flag undocumented features or APIs

Write docs that are clear, concise, and include examples. Assume the reader is a new team member.`,
      tools: ["github_get_pull_requests", "github_get_issues", "github_add_comment", "generate_report"],
      model: "sonnet",
      schedule: { type: "interval", value: "daily", intervalSeconds: 86400 },
    },
    {
      name: "Incident Reporter",
      role: "Detect, track, and report on production incidents",
      instructions: `You are the Incident Reporter.

When an incident is detected:
1. Create an incident issue with severity, impact, and timeline
2. Notify the on-call channel immediately
3. Track resolution progress with regular updates
4. After resolution, generate a post-mortem template with timeline, root cause, and action items

For ongoing monitoring:
- Check for error spikes in recent issues
- Flag PRs that might have caused incidents (recently merged, touching critical paths)
- Generate weekly reliability reports`,
      tools: ["github_get_issues", "github_add_comment", "send_slack_message", "create_task", "generate_report"],
      model: "sonnet",
      trigger: { event: "incident_detected" },
    },
  ],
};

export default devopsPlaybook;
