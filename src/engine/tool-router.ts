import type { ToolDefinition, AgentContext } from "./types";

const globalTools = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition) {
  globalTools.set(tool.name, tool);
}

export function getToolsForAgent(
  toolNames: string[],
  _playbook: string
): ToolDefinition[] {
  return toolNames
    .map((name) => globalTools.get(name))
    .filter((t): t is ToolDefinition => t !== undefined);
}

// ── Built-in tools available to all agents ─────────────

registerTool({
  name: "send_slack_message",
  description: "Send a message to a Slack channel or user",
  parameters: {
    type: "object",
    properties: {
      channel: { type: "string", description: "Channel name or user ID" },
      message: { type: "string", description: "Message text" },
    },
    required: ["channel", "message"],
  },
  execute: async (params, context) => {
    // TODO: integrate with real Slack API via tenant's integration
    return { sent: true, channel: params.channel, preview: (params.message as string).slice(0, 100) };
  },
});

registerTool({
  name: "send_email",
  description: "Send an email to a recipient",
  parameters: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient email" },
      subject: { type: "string", description: "Email subject" },
      body: { type: "string", description: "Email body (plain text)" },
    },
    required: ["to", "subject", "body"],
  },
  execute: async (params, context) => {
    return { sent: true, to: params.to, subject: params.subject };
  },
});

registerTool({
  name: "create_task",
  description: "Create a new task and assign it to an agent",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Task title" },
      description: { type: "string", description: "Task description" },
      assignToAgent: { type: "string", description: "Agent name to assign to" },
      priority: { type: "number", description: "Priority (0=low, 1=medium, 2=high)" },
    },
    required: ["title"],
  },
  execute: async (params, context) => {
    return { created: true, title: params.title, assignedTo: params.assignToAgent };
  },
});

registerTool({
  name: "request_approval",
  description: "Request human approval before proceeding with an action",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", description: "What action needs approval" },
      details: { type: "string", description: "Details about the action" },
      urgency: { type: "string", enum: ["low", "medium", "high"], description: "Urgency level" },
    },
    required: ["action", "details"],
  },
  execute: async (params, context) => {
    return { requested: true, action: params.action, status: "pending" };
  },
});

registerTool({
  name: "generate_report",
  description: "Generate a structured report with metrics and insights",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Report title" },
      metrics: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            value: { type: "string" },
            trend: { type: "string", enum: ["up", "down", "flat"] },
          },
        },
        description: "Key metrics to include",
      },
      summary: { type: "string", description: "Executive summary" },
    },
    required: ["title", "summary"],
  },
  execute: async (params, context) => {
    return { generated: true, title: params.title };
  },
});

// ── Vertical-specific tools ────────────────────────────

// Shopify tools
registerTool({
  name: "shopify_get_orders",
  description: "Fetch recent orders from Shopify store",
  parameters: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["any", "open", "closed", "cancelled"] },
      limit: { type: "number", description: "Number of orders to fetch" },
      since: { type: "string", description: "ISO date to fetch orders since" },
    },
  },
  execute: async (params, context) => {
    return { orders: [], total: 0, note: "Connect Shopify integration to see real data" };
  },
});

registerTool({
  name: "shopify_get_inventory",
  description: "Get inventory levels for products",
  parameters: {
    type: "object",
    properties: {
      productIds: { type: "array", items: { type: "string" }, description: "Product IDs to check" },
      lowStockThreshold: { type: "number", description: "Flag items below this quantity" },
    },
  },
  execute: async (params, context) => {
    return { products: [], lowStockItems: [], note: "Connect Shopify integration to see real data" };
  },
});

registerTool({
  name: "shopify_get_customers",
  description: "Fetch customer data from Shopify",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query for customers" },
      limit: { type: "number" },
    },
  },
  execute: async (params, context) => {
    return { customers: [], total: 0 };
  },
});

registerTool({
  name: "shopify_get_analytics",
  description: "Get store analytics and sales metrics",
  parameters: {
    type: "object",
    properties: {
      period: { type: "string", enum: ["today", "yesterday", "last_7_days", "last_30_days"] },
      metrics: { type: "array", items: { type: "string" } },
    },
  },
  execute: async (params, context) => {
    return { period: params.period, revenue: 0, orders: 0, visitors: 0 };
  },
});

// Support tools
registerTool({
  name: "support_get_tickets",
  description: "Fetch support tickets from the helpdesk",
  parameters: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["new", "open", "pending", "solved"] },
      priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
      limit: { type: "number" },
    },
  },
  execute: async (params, context) => {
    return { tickets: [], total: 0 };
  },
});

registerTool({
  name: "support_reply_ticket",
  description: "Send a reply to a support ticket",
  parameters: {
    type: "object",
    properties: {
      ticketId: { type: "string" },
      message: { type: "string" },
      internal: { type: "boolean", description: "Internal note vs public reply" },
    },
    required: ["ticketId", "message"],
  },
  execute: async (params, context) => {
    return { replied: true, ticketId: params.ticketId };
  },
});

registerTool({
  name: "support_categorize_ticket",
  description: "Set category, priority, and tags on a ticket",
  parameters: {
    type: "object",
    properties: {
      ticketId: { type: "string" },
      category: { type: "string" },
      priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
      tags: { type: "array", items: { type: "string" } },
    },
    required: ["ticketId"],
  },
  execute: async (params, context) => {
    return { updated: true, ticketId: params.ticketId };
  },
});

// Finance tools
registerTool({
  name: "accounting_get_transactions",
  description: "Fetch recent transactions from accounting system",
  parameters: {
    type: "object",
    properties: {
      since: { type: "string", description: "ISO date" },
      type: { type: "string", enum: ["all", "income", "expense"] },
      uncategorized: { type: "boolean", description: "Only uncategorized transactions" },
    },
  },
  execute: async (params, context) => {
    return { transactions: [], total: 0 };
  },
});

registerTool({
  name: "accounting_categorize",
  description: "Categorize a transaction",
  parameters: {
    type: "object",
    properties: {
      transactionId: { type: "string" },
      category: { type: "string" },
      memo: { type: "string" },
    },
    required: ["transactionId", "category"],
  },
  execute: async (params, context) => {
    return { categorized: true, transactionId: params.transactionId };
  },
});

registerTool({
  name: "accounting_reconcile",
  description: "Match and reconcile bank transactions with invoices",
  parameters: {
    type: "object",
    properties: {
      period: { type: "string", enum: ["this_month", "last_month", "custom"] },
    },
  },
  execute: async (params, context) => {
    return { matched: 0, unmatched: 0, discrepancies: [] };
  },
});

// CRM / Sales tools
registerTool({
  name: "crm_get_leads",
  description: "Fetch leads from CRM",
  parameters: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["new", "contacted", "qualified", "unqualified"] },
      limit: { type: "number" },
    },
  },
  execute: async (params, context) => {
    return { leads: [], total: 0 };
  },
});

registerTool({
  name: "crm_update_lead",
  description: "Update lead status or add notes in CRM",
  parameters: {
    type: "object",
    properties: {
      leadId: { type: "string" },
      status: { type: "string" },
      notes: { type: "string" },
    },
    required: ["leadId"],
  },
  execute: async (params, context) => {
    return { updated: true, leadId: params.leadId };
  },
});

registerTool({
  name: "crm_send_outreach",
  description: "Send a personalized outreach email to a lead",
  parameters: {
    type: "object",
    properties: {
      leadId: { type: "string" },
      template: { type: "string", enum: ["cold_intro", "follow_up", "meeting_request"] },
      personalization: { type: "string", description: "Custom personalization notes" },
    },
    required: ["leadId", "template"],
  },
  execute: async (params, context) => {
    return { sent: true, leadId: params.leadId, template: params.template };
  },
});

// GitHub / DevOps tools
registerTool({
  name: "github_get_issues",
  description: "Fetch issues from GitHub repository",
  parameters: {
    type: "object",
    properties: {
      repo: { type: "string", description: "owner/repo" },
      state: { type: "string", enum: ["open", "closed", "all"] },
      labels: { type: "array", items: { type: "string" } },
      limit: { type: "number" },
    },
  },
  execute: async (params, context) => {
    return { issues: [], total: 0 };
  },
});

registerTool({
  name: "github_get_pull_requests",
  description: "Fetch pull requests from GitHub",
  parameters: {
    type: "object",
    properties: {
      repo: { type: "string" },
      state: { type: "string", enum: ["open", "closed", "all"] },
    },
  },
  execute: async (params, context) => {
    return { pullRequests: [], total: 0 };
  },
});

registerTool({
  name: "github_add_comment",
  description: "Add a comment to a GitHub issue or PR",
  parameters: {
    type: "object",
    properties: {
      repo: { type: "string" },
      issueNumber: { type: "number" },
      body: { type: "string" },
    },
    required: ["repo", "issueNumber", "body"],
  },
  execute: async (params, context) => {
    return { commented: true, issueNumber: params.issueNumber };
  },
});

// HR tools
registerTool({
  name: "ats_get_candidates",
  description: "Fetch candidates from applicant tracking system",
  parameters: {
    type: "object",
    properties: {
      jobId: { type: "string" },
      stage: { type: "string", enum: ["applied", "screening", "interview", "offer", "hired", "rejected"] },
      limit: { type: "number" },
    },
  },
  execute: async (params, context) => {
    return { candidates: [], total: 0 };
  },
});

registerTool({
  name: "ats_move_candidate",
  description: "Move a candidate to a different stage",
  parameters: {
    type: "object",
    properties: {
      candidateId: { type: "string" },
      stage: { type: "string" },
      reason: { type: "string" },
    },
    required: ["candidateId", "stage"],
  },
  execute: async (params, context) => {
    return { moved: true, candidateId: params.candidateId, stage: params.stage };
  },
});

// Legal tools
registerTool({
  name: "legal_get_contracts",
  description: "Fetch contracts from document management system",
  parameters: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["draft", "review", "active", "expired"] },
      expiringWithinDays: { type: "number" },
    },
  },
  execute: async (params, context) => {
    return { contracts: [], total: 0 };
  },
});

registerTool({
  name: "legal_review_contract",
  description: "Analyze a contract and flag risks or missing clauses",
  parameters: {
    type: "object",
    properties: {
      contractId: { type: "string" },
      checkFor: { type: "array", items: { type: "string" }, description: "Specific clauses to check" },
    },
    required: ["contractId"],
  },
  execute: async (params, context) => {
    return { reviewed: true, risks: [], missingClauses: [], contractId: params.contractId };
  },
});

// Content / CMS tools
registerTool({
  name: "cms_get_posts",
  description: "Fetch posts from the content management system",
  parameters: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["draft", "published", "scheduled"] },
      limit: { type: "number" },
    },
  },
  execute: async (params, context) => {
    return { posts: [], total: 0 };
  },
});

registerTool({
  name: "cms_create_post",
  description: "Create a new content post",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string" },
      body: { type: "string" },
      status: { type: "string", enum: ["draft", "scheduled"] },
      publishAt: { type: "string", description: "ISO date for scheduling" },
      tags: { type: "array", items: { type: "string" } },
    },
    required: ["title", "body"],
  },
  execute: async (params, context) => {
    return { created: true, title: params.title, status: params.status };
  },
});

registerTool({
  name: "social_post",
  description: "Post content to social media platforms",
  parameters: {
    type: "object",
    properties: {
      platforms: { type: "array", items: { type: "string" }, description: "twitter, linkedin, instagram, etc." },
      content: { type: "string" },
      scheduledAt: { type: "string", description: "ISO date to schedule" },
    },
    required: ["platforms", "content"],
  },
  execute: async (params, context) => {
    return { posted: true, platforms: params.platforms };
  },
});

registerTool({
  name: "analytics_get_metrics",
  description: "Fetch website or marketing analytics",
  parameters: {
    type: "object",
    properties: {
      source: { type: "string", enum: ["google_analytics", "social", "email", "all"] },
      period: { type: "string", enum: ["today", "yesterday", "last_7_days", "last_30_days"] },
    },
  },
  execute: async (params, context) => {
    return { pageviews: 0, sessions: 0, conversions: 0, topPages: [] };
  },
});
