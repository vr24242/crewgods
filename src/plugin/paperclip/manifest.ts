import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "crewgods.workflow-engine",
  apiVersion: 1,
  version: "1.0.0",
  displayName: "CrewGods Workflow Engine",
  description:
    "Vertical-specific AI workflow automation across 8 industries. Runs DAG-based workflows with branching, approvals, loops, and multi-model AI nodes.",
  author: "CrewGods",
  categories: ["automation"],
  capabilities: [
    "events.subscribe",
    "events.emit",
    "jobs.schedule",
    "plugin.state.read",
    "plugin.state.write",
    "http.outbound",
    "secrets.read-ref",
    "activity.log.write",
    "agent.tools.register",
    "agents.read",
    "agents.managed",
    "agents.invoke",
    "issues.read",
    "issues.create",
    "issues.update",
    "companies.read",
    "projects.read",
    "goals.read",
    "goals.create",
    "routines.managed",
    "skills.managed",
    "metrics.write",
    "telemetry.track",
    "ui.dashboardWidget.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  jobs: [
    {
      jobKey: "workflow-scheduler",
      displayName: "Workflow Scheduler",
      description: "Checks cron-triggered workflows and dispatches ready ones",
      schedule: "*/5 * * * *",
    },
    {
      jobKey: "workflow-cleanup",
      displayName: "Workflow Cleanup",
      description: "Cleans up stale workflow runs and expired approvals",
      schedule: "0 * * * *",
    },
  ],
  webhooks: [
    {
      endpointKey: "inbound",
      displayName: "Inbound Webhook Router",
      description: "Routes inbound webhooks from integrations (Shopify, GitHub, Zendesk, etc.) to matching workflow triggers",
    },
  ],
  managedAgents: [
    { agentKey: "crewgods-orchestrator", displayName: "CrewGods Orchestrator", role: "orchestrator", title: "Workflow orchestration agent that coordinates DAG execution across verticals" },
  ],
  managedRoutines: [
    { routineKey: "cron-dispatcher", displayName: "Cron Dispatcher", description: "Dispatches cron-triggered workflows on schedule" },
  ],
  tools: [
    { name: "crewgods_list_workflows", displayName: "List Workflows", description: "List available workflows for a vertical" },
    { name: "crewgods_run_workflow", displayName: "Run Workflow", description: "Manually trigger a workflow by ID" },
    { name: "crewgods_get_run_status", displayName: "Get Run Status", description: "Check the status of a workflow run" },
    { name: "crewgods_list_verticals", displayName: "List Verticals", description: "List all available vertical modules" },
    { name: "crewgods_approve_node", displayName: "Approve Node", description: "Approve or reject a pending approval node in a workflow run" },
  ],
  instanceConfigSchema: {
    type: "object",
    properties: {
      enabledVerticals: {
        type: "array",
        items: { type: "string" },
        description: "Which verticals to activate (e.g. ['ecommerce', 'customer-support'])",
      },
      defaultModel: {
        type: "string",
        enum: ["haiku", "sonnet", "opus"],
        description: "Default Claude model for AI nodes when not specified by workflow",
      },
      monthlyBudgetCents: {
        type: "number",
        description: "Monthly AI spend budget in cents",
      },
      integrationSecrets: {
        type: "object",
        description: "Secret references for integration API keys (e.g. { shopify: 'SHOPIFY_API_KEY' })",
      },
    },
    required: ["enabledVerticals"],
  },
  companySettings: {
    configSchema: {
      type: "object",
      properties: {
        enabledVerticals: { type: "array", items: { type: "string" } },
        slackChannel: { type: "string" },
        hiringChannel: { type: "string" },
        legalChannel: { type: "string" },
        devChannel: { type: "string" },
        oncallChannel: { type: "string" },
        contentChannel: { type: "string" },
        hrChannel: { type: "string" },
        securityChannel: { type: "string" },
        brandTone: { type: "string" },
        coreTopics: { type: "array", items: { type: "string" } },
        hiringBar: { type: "string" },
        complianceOfficerEmail: { type: "string" },
      },
    },
  },
  ui: {
    slots: [
      { type: "dashboardWidget", id: "workflow-dashboard", displayName: "CrewGods Workflows", exportName: "WorkflowDashboard" },
      { type: "dashboardWidget", id: "vertical-health", displayName: "Vertical Health", exportName: "VerticalHealth" },
    ],
  },
};

export default manifest;
