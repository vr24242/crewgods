import type { WorkflowDAG } from "../../workflows/types";

// ═══════════════════════════════════════════════════════
// CUSTOMER SUPPORT VERTICAL — 4 Workflow DAGs
// ═══════════════════════════════════════════════════════

// ── 1. Ticket Triage ────────────────────────────────────
// Trigger: Webhook (new ticket created)
// Flow: Receive ticket → Fetch customer context → AI classify →
//       Branch (auto-resolvable?) → Auto-reply OR route to queue

export const ticketTriage: WorkflowDAG = {
  id: "support-ticket-triage",
  name: "Ticket Triage & Classification",
  vertical: "customer-support",
  description: "Classifies incoming tickets by category, priority, and sentiment. Routes to auto-response or human queue.",
  version: "1.0.0",
  trigger: {
    type: "webhook",
    provider: "zendesk",
    event: "ticket.created",
  },
  nodes: [
    {
      id: "parse_ticket",
      name: "Parse Incoming Ticket",
      type: "transform",
      config: {
        inputMap: {
          ticket: { source: "trigger", path: "ticket" },
        },
      },
    },
    {
      id: "fetch_customer_context",
      name: "Fetch Customer History",
      type: "fetch",
      config: {
        integration: "zendesk",
        operation: "users.getWithTickets",
        inputMap: {
          userId: { source: "node", nodeId: "parse_ticket", path: "ticket.requester_id" },
          recentTicketLimit: { source: "static", value: 10 },
        },
      },
      timeout: 15,
    },
    {
      id: "fetch_kb_matches",
      name: "Search Knowledge Base",
      type: "fetch",
      config: {
        integration: "zendesk",
        operation: "helpCenter.search",
        inputMap: {
          query: { source: "node", nodeId: "parse_ticket", path: "ticket.subject" },
          limit: { source: "static", value: 5 },
        },
      },
      timeout: 10,
    },
    {
      id: "classify_ticket",
      name: "AI Classify & Score",
      type: "ai_decide",
      config: {
        inputMap: {
          ticket: { source: "node", nodeId: "parse_ticket", path: "ticket" },
          customerHistory: { source: "node", nodeId: "fetch_customer_context", path: "user" },
          kbArticles: { source: "node", nodeId: "fetch_kb_matches", path: "articles" },
        },
      },
      agent: {
        role: "Ticket Triager",
        model: "haiku",
        instructions: `Classify this support ticket. Return JSON:
{
  "category": "billing" | "technical" | "shipping" | "account" | "product" | "general",
  "subcategory": string,
  "priority": "urgent" | "high" | "normal" | "low",
  "sentiment": "positive" | "neutral" | "frustrated" | "angry",
  "language": "en" | ISO code,
  "autoResolvable": boolean,
  "autoResolveType": "password_reset" | "shipping_status" | "refund_policy" | "how_to" | "billing_question" | null,
  "matchedKbArticle": article ID or null,
  "customerTier": "new" | "regular" | "vip" (based on order count/spend),
  "estimatedComplexity": 1-5,
  "suggestedTags": string[]
}

Priority rules:
- URGENT: account locked, payment failed mid-transaction, service down
- HIGH: order not received (past estimated delivery), broken feature blocking work
- NORMAL: how-to, feature request, general question
- LOW: feedback, cosmetic issue, nice-to-have

VIP customers (>10 orders or >$1000 spend) bump priority up one level.`,
      },
      timeout: 20,
    },
    {
      id: "update_ticket_tags",
      name: "Apply Tags & Priority",
      type: "action",
      config: {
        integration: "zendesk",
        operation: "tickets.update",
        inputMap: {
          ticketId: { source: "node", nodeId: "parse_ticket", path: "ticket.id" },
          priority: { source: "node", nodeId: "classify_ticket", path: "priority" },
          tags: { source: "node", nodeId: "classify_ticket", path: "suggestedTags" },
          customFields: {
            source: "static",
            value: { category: "{{classify_ticket.category}}", sentiment: "{{classify_ticket.sentiment}}" },
          },
        },
      },
    },
    {
      id: "branch_routing",
      name: "Route Decision",
      type: "branch",
      config: {
        inputMap: {
          autoResolvable: { source: "node", nodeId: "classify_ticket", path: "autoResolvable" },
          sentiment: { source: "node", nodeId: "classify_ticket", path: "sentiment" },
        },
      },
    },
    {
      id: "emit_auto_respond",
      name: "Trigger Auto-Response",
      type: "emit",
      config: {
        inputMap: {
          event: { source: "static", value: "support.auto_respond" },
          data: {
            source: "static",
            value: {
              ticketId: "{{parse_ticket.ticket.id}}",
              resolveType: "{{classify_ticket.autoResolveType}}",
              kbArticle: "{{classify_ticket.matchedKbArticle}}",
            },
          },
        },
      },
    },
    {
      id: "notify_urgent",
      name: "Alert Team — Urgent Ticket",
      type: "action",
      config: {
        integration: "slack",
        operation: "chat.postMessage",
        inputMap: {
          channel: { source: "integration", provider: "settings", path: "escalationChannel" },
          message: { source: "template", template: "🔴 Urgent ticket: {{parse_ticket.ticket.subject}} — {{classify_ticket.category}} ({{classify_ticket.sentiment}} customer)" },
        },
      },
    },
  ],
  edges: [
    { from: "parse_ticket", to: "fetch_customer_context" },
    { from: "parse_ticket", to: "fetch_kb_matches" },
    { from: "fetch_customer_context", to: "classify_ticket" },
    { from: "fetch_kb_matches", to: "classify_ticket" },
    { from: "classify_ticket", to: "update_ticket_tags" },
    { from: "update_ticket_tags", to: "branch_routing" },
    // Auto-resolvable AND not angry → auto respond
    { from: "branch_routing", to: "emit_auto_respond", condition: { type: "expression", expr: "output.autoResolvable && output.sentiment !== 'angry'" }, label: "auto-resolvable" },
    // Urgent priority → alert team
    { from: "branch_routing", to: "notify_urgent", condition: { type: "expression", expr: "!output.autoResolvable || output.sentiment === 'angry'" }, label: "needs human" },
  ],
  errorHandler: {
    onNodeFailure: "skip",
    maxRetries: 1,
    retryDelaySeconds: 10,
    notifyChannel: "#support-ops",
  },
  metadata: {
    estimatedDurationMs: 8000,
    estimatedCostCents: 1,
    tags: ["triage", "classification", "routing"],
    requiredIntegrations: ["zendesk", "slack"],
    requiredApprovals: [],
  },
};

// ── 2. Auto-Response ────────────────────────────────────
// Trigger: Event (support.auto_respond from triage)
// Flow: Load ticket + KB → Generate response → Branch (auto-send?) →
//       Send OR queue for review

export const autoResponse: WorkflowDAG = {
  id: "support-auto-response",
  name: "Auto-Response Generation",
  vertical: "customer-support",
  description: "Generates and optionally sends automated responses for common support issues using KB articles",
  version: "1.0.0",
  trigger: {
    type: "event",
    source: "support-ticket-triage",
    event: "support.auto_respond",
  },
  nodes: [
    {
      id: "load_ticket",
      name: "Load Full Ticket",
      type: "fetch",
      config: {
        integration: "zendesk",
        operation: "tickets.get",
        inputMap: {
          ticketId: { source: "trigger", path: "data.ticketId" },
        },
      },
    },
    {
      id: "load_kb_article",
      name: "Load KB Article",
      type: "fetch",
      config: {
        integration: "zendesk",
        operation: "helpCenter.getArticle",
        inputMap: {
          articleId: { source: "trigger", path: "data.kbArticle" },
        },
      },
    },
    {
      id: "generate_response",
      name: "Generate Response",
      type: "ai_generate",
      config: {
        inputMap: {
          ticket: { source: "node", nodeId: "load_ticket", path: "ticket" },
          kbContent: { source: "node", nodeId: "load_kb_article", path: "article.body" },
          resolveType: { source: "trigger", path: "data.resolveType" },
        },
      },
      agent: {
        role: "Auto-Responder",
        model: "sonnet",
        instructions: `Generate a helpful support response.

Rules:
- Address the customer by name
- Directly answer their question (don't just link to an article)
- If referencing a KB article, summarize the key steps inline then link for details
- Match the customer's language (if they wrote in Spanish, respond in Spanish)
- Keep under 200 words
- End with "Was this helpful?" or similar soft close
- Never say "I'm an AI" — speak as the support team

Response types:
- password_reset: Provide the reset link and steps
- shipping_status: Look up and share tracking info
- refund_policy: Explain the policy clearly with timeline
- how_to: Step-by-step instructions
- billing_question: Explain the charge with breakdown

Return JSON: { subject, body, confidence: 0-100 }
confidence > 85 = safe to auto-send
confidence 50-85 = draft for review
confidence < 50 = escalate to human`,
      },
    },
    {
      id: "branch_confidence",
      name: "Check Confidence Level",
      type: "branch",
      config: {
        inputMap: {
          confidence: { source: "node", nodeId: "generate_response", path: "confidence" },
          autoSendEnabled: { source: "integration", provider: "settings", path: "autoReplyEnabled" },
        },
      },
    },
    {
      id: "auto_send",
      name: "Auto-Send Response",
      type: "action",
      config: {
        integration: "zendesk",
        operation: "tickets.reply",
        inputMap: {
          ticketId: { source: "trigger", path: "data.ticketId" },
          body: { source: "node", nodeId: "generate_response", path: "body" },
          status: { source: "static", value: "solved" },
        },
      },
    },
    {
      id: "queue_for_review",
      name: "Save as Draft",
      type: "action",
      config: {
        integration: "zendesk",
        operation: "tickets.addInternalNote",
        inputMap: {
          ticketId: { source: "trigger", path: "data.ticketId" },
          body: { source: "template", template: "[AI Draft Response — Confidence: {{generate_response.confidence}}%]\n\n{{generate_response.body}}" },
        },
      },
    },
    {
      id: "log_auto_send",
      name: "Log Auto-Send",
      type: "action",
      config: {
        integration: "internal",
        operation: "activity.log",
        inputMap: {
          action: { source: "static", value: "auto_response_sent" },
          ticketId: { source: "trigger", path: "data.ticketId" },
          confidence: { source: "node", nodeId: "generate_response", path: "confidence" },
        },
      },
    },
  ],
  edges: [
    { from: "load_ticket", to: "generate_response" },
    { from: "load_kb_article", to: "generate_response" },
    { from: "generate_response", to: "branch_confidence" },
    { from: "branch_confidence", to: "auto_send", condition: { type: "expression", expr: "output.confidence > 85 && output.autoSendEnabled" }, label: "high confidence + auto-send on" },
    { from: "branch_confidence", to: "queue_for_review", condition: { type: "expression", expr: "output.confidence <= 85 || !output.autoSendEnabled" }, label: "needs review" },
    { from: "auto_send", to: "log_auto_send" },
  ],
  errorHandler: {
    onNodeFailure: "skip",
    maxRetries: 1,
    retryDelaySeconds: 15,
    escalateTo: "Escalation Manager",
  },
  metadata: {
    estimatedDurationMs: 12000,
    estimatedCostCents: 4,
    tags: ["auto-response", "kb", "resolution"],
    requiredIntegrations: ["zendesk"],
    requiredApprovals: [],
  },
};

// ── 3. Escalation Management ────────────────────────────
// Trigger: Hourly
// Flow: Find stale tickets → AI assess → Escalate or nudge → Notify

export const escalationManagement: WorkflowDAG = {
  id: "support-escalation",
  name: "Escalation Management",
  vertical: "customer-support",
  description: "Detects stale and unresolved tickets, escalates to senior agents, coordinates cross-team resolution",
  version: "1.0.0",
  trigger: {
    type: "schedule",
    cron: "0 * * * *", // every hour
  },
  nodes: [
    {
      id: "fetch_stale",
      name: "Fetch Stale Tickets",
      type: "fetch",
      config: {
        integration: "zendesk",
        operation: "tickets.search",
        inputMap: {
          query: { source: "static", value: "status:open updated<24h -tags:escalated" },
          limit: { source: "static", value: 50 },
        },
      },
    },
    {
      id: "fetch_high_priority",
      name: "Fetch Unresolved High Priority",
      type: "fetch",
      config: {
        integration: "zendesk",
        operation: "tickets.search",
        inputMap: {
          query: { source: "static", value: "status:open priority:urgent,high updated<4h" },
        },
      },
    },
    {
      id: "assess_escalations",
      name: "AI Assess Each Ticket",
      type: "ai_decide",
      config: {
        inputMap: {
          staleTickets: { source: "node", nodeId: "fetch_stale", path: "tickets" },
          urgentTickets: { source: "node", nodeId: "fetch_high_priority", path: "tickets" },
        },
      },
      agent: {
        role: "Escalation Manager",
        model: "sonnet",
        instructions: `Review each stale/urgent ticket. For each, decide:
{
  "ticketId": string,
  "action": "escalate" | "nudge_agent" | "follow_up_customer" | "close_stale" | "skip",
  "reason": string,
  "assignTo": "senior_agent" | "engineering" | "billing" | "management" | null,
  "draftMessage": string (if action is follow_up_customer)
}

Escalation criteria:
- Urgent tickets open > 4 hours → escalate
- High priority open > 12 hours → escalate
- Normal tickets with angry sentiment open > 24 hours → escalate
- Tickets with 3+ customer replies and no resolution → escalate
- Tickets where agent hasn't responded in 8+ hours → nudge agent
- Tickets where customer hasn't responded in 72+ hours → close stale`,
      },
    },
    {
      id: "loop_actions",
      name: "Execute Escalation Actions",
      type: "loop",
      config: {
        inputMap: {
          items: { source: "node", nodeId: "assess_escalations", path: "decisions" },
        },
        params: { itemNode: "execute_escalation_action" },
      },
    },
    {
      id: "execute_escalation_action",
      name: "Execute Single Action",
      type: "action",
      config: {
        integration: "zendesk",
        operation: "tickets.update",
        inputMap: {
          ticketId: { source: "node", nodeId: "loop_actions", path: "currentItem.ticketId" },
          action: { source: "node", nodeId: "loop_actions", path: "currentItem.action" },
        },
      },
    },
    {
      id: "notify_escalations",
      name: "Notify Team of Escalations",
      type: "action",
      config: {
        integration: "slack",
        operation: "chat.postMessage",
        inputMap: {
          channel: { source: "integration", provider: "settings", path: "escalationChannel" },
          message: { source: "template", template: "Escalation sweep: {{assess_escalations.decisions.length}} tickets reviewed" },
        },
      },
    },
  ],
  edges: [
    { from: "fetch_stale", to: "assess_escalations" },
    { from: "fetch_high_priority", to: "assess_escalations" },
    { from: "assess_escalations", to: "loop_actions" },
    { from: "loop_actions", to: "execute_escalation_action" },
    { from: "loop_actions", to: "notify_escalations" },
  ],
  errorHandler: {
    onNodeFailure: "skip",
    maxRetries: 1,
    retryDelaySeconds: 60,
    notifyChannel: "#support-ops",
  },
  metadata: {
    estimatedDurationMs: 25000,
    estimatedCostCents: 6,
    tags: ["escalation", "stale-tickets", "sla"],
    requiredIntegrations: ["zendesk", "slack"],
    requiredApprovals: [],
  },
};

// ── 4. CSAT & Quality Report ────────────────────────────
// Trigger: Daily at 6pm
// Flow: Fetch metrics → Analyze trends → Generate report → Send

export const csatReport: WorkflowDAG = {
  id: "support-csat-report",
  name: "CSAT & Quality Report",
  vertical: "customer-support",
  description: "Daily support quality metrics: CSAT, response time, resolution time, recurring issues, agent performance",
  version: "1.0.0",
  trigger: {
    type: "schedule",
    cron: "0 18 * * *", // 6pm daily
  },
  nodes: [
    {
      id: "fetch_csat",
      name: "Fetch CSAT Scores",
      type: "fetch",
      config: {
        integration: "zendesk",
        operation: "satisfactionRatings.list",
        inputMap: { period: { source: "static", value: "today" } },
      },
    },
    {
      id: "fetch_ticket_metrics",
      name: "Fetch Ticket Metrics",
      type: "fetch",
      config: {
        integration: "zendesk",
        operation: "tickets.metrics",
        inputMap: { period: { source: "static", value: "today" } },
      },
    },
    {
      id: "fetch_resolved",
      name: "Fetch Resolved Tickets",
      type: "fetch",
      config: {
        integration: "zendesk",
        operation: "tickets.search",
        inputMap: { query: { source: "static", value: "status:solved solved:today" } },
      },
    },
    {
      id: "analyze_quality",
      name: "Analyze Support Quality",
      type: "ai_decide",
      config: {
        inputMap: {
          csat: { source: "node", nodeId: "fetch_csat", path: "ratings" },
          metrics: { source: "node", nodeId: "fetch_ticket_metrics", path: "metrics" },
          resolvedTickets: { source: "node", nodeId: "fetch_resolved", path: "tickets" },
        },
      },
      agent: {
        role: "CSAT Tracker",
        model: "sonnet",
        instructions: `Analyze today's support performance. Return:
{
  "csatScore": number (0-100),
  "csatTrend": "up" | "down" | "flat",
  "avgResponseTimeMinutes": number,
  "avgResolutionTimeHours": number,
  "ticketsCreated": number,
  "ticketsResolved": number,
  "autoResolvedPercent": number,
  "topCategories": [{ category, count, avgResolutionTime }],
  "recurringIssues": [{ issue, frequency, suggestedFix }],
  "negativeTickets": [{ ticketId, reason, customerSentiment }],
  "highlights": string[],
  "concerns": string[],
  "recommendation": string
}`,
      },
    },
    {
      id: "generate_report",
      name: "Format Report",
      type: "ai_generate",
      config: {
        inputMap: {
          analysis: { source: "node", nodeId: "analyze_quality", path: "" },
        },
      },
      agent: {
        role: "CSAT Tracker",
        model: "haiku",
        instructions: "Format into a clean Slack report. Lead with CSAT score in large text. Use green/red/yellow indicators. Keep it scannable. End with the top recommendation.",
      },
    },
    {
      id: "send_report",
      name: "Send Report",
      type: "action",
      config: {
        integration: "slack",
        operation: "chat.postMessage",
        inputMap: {
          channel: { source: "integration", provider: "settings", path: "escalationChannel" },
          message: { source: "node", nodeId: "generate_report", path: "message" },
        },
      },
    },
  ],
  edges: [
    { from: "fetch_csat", to: "analyze_quality" },
    { from: "fetch_ticket_metrics", to: "analyze_quality" },
    { from: "fetch_resolved", to: "analyze_quality" },
    { from: "analyze_quality", to: "generate_report" },
    { from: "generate_report", to: "send_report" },
  ],
  errorHandler: {
    onNodeFailure: "retry",
    maxRetries: 2,
    retryDelaySeconds: 120,
    notifyChannel: "#support-ops",
  },
  metadata: {
    estimatedDurationMs: 20000,
    estimatedCostCents: 5,
    tags: ["csat", "quality", "reporting", "metrics"],
    requiredIntegrations: ["zendesk", "slack"],
    requiredApprovals: [],
  },
};

export const customerSupportWorkflows = [
  ticketTriage,
  autoResponse,
  escalationManagement,
  csatReport,
];
