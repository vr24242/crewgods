import type { WorkflowDAG } from "../../workflows/types";

// ═══════════════════════════════════════════════════════
// SALES DEVELOPMENT VERTICAL — 4 Workflow DAGs
// ═══════════════════════════════════════════════════════

export const leadResearch: WorkflowDAG = {
  id: "sales-lead-research",
  name: "Lead Research & Enrichment",
  vertical: "sales",
  description: "Researches new leads, enriches with company/contact data, scores for ICP fit",
  version: "1.0.0",
  trigger: { type: "schedule", cron: "0 */4 * * 1-5" }, // every 4h weekdays
  nodes: [
    {
      id: "fetch_new_leads",
      name: "Fetch New/Unscored Leads",
      type: "fetch",
      config: {
        integration: "hubspot",
        operation: "contacts.list",
        inputMap: { filter: { source: "static", value: { lifecycleStage: "lead", icpScore: null } }, limit: { source: "static", value: 20 } },
      },
    },
    {
      id: "enrich_leads",
      name: "Enrich with Company Data",
      type: "loop",
      config: {
        inputMap: { items: { source: "node", nodeId: "fetch_new_leads", path: "contacts" } },
        params: { itemNode: "enrich_single", maxConcurrency: 5 },
      },
    },
    {
      id: "enrich_single",
      name: "Enrich Single Lead",
      type: "fetch",
      config: {
        integration: "clearbit",
        operation: "enrich",
        inputMap: {
          email: { source: "node", nodeId: "enrich_leads", path: "currentItem.email" },
          domain: { source: "node", nodeId: "enrich_leads", path: "currentItem.company.domain" },
        },
      },
    },
    {
      id: "score_leads",
      name: "AI Score & Research",
      type: "ai_decide",
      config: {
        inputMap: {
          leads: { source: "node", nodeId: "enrich_leads", path: "results" },
          icp: { source: "integration", provider: "settings", path: "idealCustomerProfile" },
        },
      },
      agent: {
        role: "Lead Researcher",
        model: "sonnet",
        instructions: `Score each lead against the ICP. For each return:
{
  "contactId": string,
  "icpScore": 1-10,
  "companyFit": { industry, size, revenue, techStack, signals },
  "contactFit": { seniority, department, decisionMaker: boolean },
  "buyingSignals": string[] (job postings, funding, tech migrations, competitor mentions),
  "researchBrief": string (2-3 sentences for outreach personalization),
  "recommendedAction": "outreach_now" | "nurture" | "disqualify",
  "personalizedAngle": string (the hook for outreach)
}

Score weights: company size (20%), industry fit (20%), role/seniority (15%), buying signals (25%), tech stack match (20%).`,
      },
    },
    {
      id: "update_crm",
      name: "Update CRM with Scores",
      type: "loop",
      config: {
        inputMap: { items: { source: "node", nodeId: "score_leads", path: "scoredLeads" } },
        params: { itemNode: "update_single_lead" },
      },
    },
    {
      id: "update_single_lead",
      name: "Update Single Lead",
      type: "action",
      config: {
        integration: "hubspot",
        operation: "contacts.update",
        inputMap: {
          contactId: { source: "node", nodeId: "update_crm", path: "currentItem.contactId" },
          properties: { source: "node", nodeId: "update_crm", path: "currentItem" },
        },
      },
    },
    {
      id: "emit_qualified",
      name: "Emit Qualified Lead Events",
      type: "emit",
      config: {
        inputMap: {
          event: { source: "static", value: "sales.lead_qualified" },
          data: { source: "node", nodeId: "score_leads", path: "qualifiedLeads" },
        },
      },
    },
    {
      id: "notify_team",
      name: "Notify Sales Team",
      type: "action",
      config: {
        integration: "slack",
        operation: "chat.postMessage",
        inputMap: {
          channel: { source: "integration", provider: "settings", path: "salesChannel" },
          message: { source: "template", template: "Lead research complete: {{score_leads.scoredLeads.length}} scored, {{score_leads.qualifiedLeads.length}} qualified for outreach" },
        },
      },
    },
  ],
  edges: [
    { from: "fetch_new_leads", to: "enrich_leads" },
    { from: "enrich_leads", to: "enrich_single" },
    { from: "enrich_leads", to: "score_leads" },
    { from: "score_leads", to: "update_crm" },
    { from: "update_crm", to: "update_single_lead" },
    { from: "score_leads", to: "emit_qualified" },
    { from: "score_leads", to: "notify_team" },
  ],
  errorHandler: { onNodeFailure: "skip", maxRetries: 2, retryDelaySeconds: 60, notifyChannel: "#sales" },
  metadata: { estimatedDurationMs: 45000, estimatedCostCents: 10, tags: ["leads", "research", "scoring", "enrichment"], requiredIntegrations: ["hubspot", "clearbit", "slack"], requiredApprovals: [] },
};

export const outreachGeneration: WorkflowDAG = {
  id: "sales-outreach",
  name: "Personalized Outreach",
  vertical: "sales",
  description: "Generates personalized cold outreach emails based on lead research, with approval gate before sending",
  version: "1.0.0",
  trigger: { type: "event", source: "sales-lead-research", event: "sales.lead_qualified" },
  nodes: [
    {
      id: "load_leads",
      name: "Load Qualified Leads",
      type: "transform",
      config: {
        inputMap: { leads: { source: "trigger", path: "data" } },
      },
    },
    {
      id: "generate_emails",
      name: "Generate Outreach Emails",
      type: "ai_generate",
      config: {
        inputMap: {
          leads: { source: "node", nodeId: "load_leads", path: "leads" },
          valueProp: { source: "integration", provider: "settings", path: "valueProposition" },
          senderName: { source: "integration", provider: "settings", path: "senderName" },
        },
      },
      agent: {
        role: "Outreach Writer",
        model: "sonnet",
        instructions: `Write a personalized cold email for each lead.

Rules:
- Under 150 words
- Reference something specific about their company (from researchBrief)
- Connect their situation to our value prop naturally
- Low-friction CTA: "Quick question" or "Worth a 15-min chat?"
- NO "I hope this email finds you well"
- NO "I noticed you're" (overused)
- Write like a peer, not a salesperson
- Subject line: 4-7 words, curiosity-driven, no clickbait

Return: [{ contactId, subject, body, personalizedHook, confidence }]`,
      },
    },
    {
      id: "approval_gate",
      name: "Review Outreach Batch",
      type: "approval",
      config: {
        inputMap: {
          title: { source: "template", template: "Review {{generate_emails.emails.length}} outreach emails" },
          description: { source: "static", value: "Review AI-generated outreach emails before sending" },
          emails: { source: "node", nodeId: "generate_emails", path: "emails" },
        },
      },
      agent: { role: "Outreach Writer", model: "sonnet" },
    },
    {
      id: "send_emails",
      name: "Send Approved Emails",
      type: "loop",
      config: {
        inputMap: { items: { source: "node", nodeId: "generate_emails", path: "emails" } },
        params: { itemNode: "send_single", delayBetweenMs: 30000 },
      },
    },
    {
      id: "send_single",
      name: "Send Email",
      type: "action",
      config: {
        integration: "email",
        operation: "send",
        inputMap: {
          to: { source: "node", nodeId: "send_emails", path: "currentItem.email" },
          subject: { source: "node", nodeId: "send_emails", path: "currentItem.subject" },
          body: { source: "node", nodeId: "send_emails", path: "currentItem.body" },
        },
      },
    },
    {
      id: "update_crm_sent",
      name: "Log in CRM",
      type: "loop",
      config: {
        inputMap: { items: { source: "node", nodeId: "generate_emails", path: "emails" } },
        params: { itemNode: "update_single_sent" },
      },
    },
    {
      id: "update_single_sent",
      name: "Update Lead Status",
      type: "action",
      config: {
        integration: "hubspot",
        operation: "contacts.update",
        inputMap: {
          contactId: { source: "node", nodeId: "update_crm_sent", path: "currentItem.contactId" },
          properties: { source: "static", value: { lifecycleStage: "contacted", lastOutreachDate: "{{today}}" } },
        },
      },
    },
    {
      id: "log_rejected",
      name: "Log Rejected Batch",
      type: "action",
      config: {
        integration: "internal",
        operation: "activity.log",
        inputMap: { summary: { source: "static", value: "Outreach batch rejected — emails not sent" } },
      },
    },
  ],
  edges: [
    { from: "load_leads", to: "generate_emails" },
    { from: "generate_emails", to: "approval_gate" },
    { from: "approval_gate", to: "send_emails", condition: { type: "approved" } },
    { from: "approval_gate", to: "log_rejected", condition: { type: "rejected" } },
    { from: "send_emails", to: "send_single" },
    { from: "send_emails", to: "update_crm_sent" },
    { from: "update_crm_sent", to: "update_single_sent" },
  ],
  errorHandler: { onNodeFailure: "abort", maxRetries: 0, retryDelaySeconds: 0, notifyChannel: "#sales" },
  metadata: { estimatedDurationMs: 120000, estimatedCostCents: 12, tags: ["outreach", "email", "cold-email"], requiredIntegrations: ["hubspot", "email", "slack"], requiredApprovals: ["send_outreach_batch"] },
};

export const followUpSequence: WorkflowDAG = {
  id: "sales-follow-up",
  name: "Follow-Up Sequence",
  vertical: "sales",
  description: "Automated follow-up sequence: Day 3, Day 7, Day 14 breakup. Stops on reply.",
  version: "1.0.0",
  trigger: { type: "schedule", cron: "0 10 * * 1-5" }, // 10am weekdays
  nodes: [
    {
      id: "fetch_contacted",
      name: "Fetch Leads Needing Follow-Up",
      type: "fetch",
      config: {
        integration: "hubspot",
        operation: "contacts.list",
        inputMap: {
          filter: { source: "static", value: { lifecycleStage: "contacted", hasReplied: false } },
        },
      },
    },
    {
      id: "calculate_timing",
      name: "Calculate Follow-Up Stage",
      type: "ai_decide",
      config: {
        inputMap: { leads: { source: "node", nodeId: "fetch_contacted", path: "contacts" } },
      },
      agent: {
        role: "Follow-Up Agent",
        model: "haiku",
        instructions: `For each contacted lead, determine follow-up action:
- Day 3 since last email: send follow-up #1 (different angle)
- Day 7: send follow-up #2 (share resource/case study)
- Day 14: send breakup email (final touch)
- Day 21+: mark as cold, stop sequence
- If they replied at any point: skip entirely

Return: { followUps: [{ contactId, stage, daysSinceLastEmail, action }], skipped: number, cold: number }`,
      },
    },
    {
      id: "generate_followups",
      name: "Generate Follow-Up Emails",
      type: "ai_generate",
      config: {
        inputMap: {
          followUps: { source: "node", nodeId: "calculate_timing", path: "followUps" },
          valueProp: { source: "integration", provider: "settings", path: "valueProposition" },
        },
      },
      agent: {
        role: "Follow-Up Agent",
        model: "haiku",
        instructions: `Generate follow-up emails based on stage:
Stage 1 (Day 3): Short, different angle. Don't repeat first email. "Quick thought on..."
Stage 2 (Day 7): Share something useful — case study, relevant resource, industry insight.
Stage 3 (Day 14): Breakup. "I'll assume timing isn't right. No hard feelings. Here if things change."

Each under 100 words. Vary subject lines. No "just following up" or "circling back."`,
      },
    },
    {
      id: "send_followups",
      name: "Send Follow-Ups",
      type: "loop",
      config: {
        inputMap: { items: { source: "node", nodeId: "generate_followups", path: "emails" } },
        params: { itemNode: "send_single_followup", delayBetweenMs: 60000 },
      },
    },
    {
      id: "send_single_followup",
      name: "Send Single Follow-Up",
      type: "action",
      config: {
        integration: "email",
        operation: "send",
        inputMap: {
          to: { source: "node", nodeId: "send_followups", path: "currentItem.email" },
          subject: { source: "node", nodeId: "send_followups", path: "currentItem.subject" },
          body: { source: "node", nodeId: "send_followups", path: "currentItem.body" },
        },
      },
    },
    {
      id: "mark_cold",
      name: "Mark Cold Leads",
      type: "loop",
      config: {
        inputMap: { items: { source: "node", nodeId: "calculate_timing", path: "coldLeads" } },
        params: { itemNode: "update_cold_lead" },
      },
    },
    {
      id: "update_cold_lead",
      name: "Update Lead to Cold",
      type: "action",
      config: {
        integration: "hubspot",
        operation: "contacts.update",
        inputMap: {
          contactId: { source: "node", nodeId: "mark_cold", path: "currentItem.contactId" },
          properties: { source: "static", value: { lifecycleStage: "other", sequenceStatus: "cold" } },
        },
      },
    },
  ],
  edges: [
    { from: "fetch_contacted", to: "calculate_timing" },
    { from: "calculate_timing", to: "generate_followups" },
    { from: "generate_followups", to: "send_followups" },
    { from: "send_followups", to: "send_single_followup" },
    { from: "calculate_timing", to: "mark_cold" },
    { from: "mark_cold", to: "update_cold_lead" },
  ],
  errorHandler: { onNodeFailure: "skip", maxRetries: 1, retryDelaySeconds: 60, notifyChannel: "#sales" },
  metadata: { estimatedDurationMs: 90000, estimatedCostCents: 5, tags: ["follow-up", "sequence", "nurture"], requiredIntegrations: ["hubspot", "email"], requiredApprovals: [] },
};

export const pipelineReport: WorkflowDAG = {
  id: "sales-pipeline-report",
  name: "Pipeline Report",
  vertical: "sales",
  description: "Daily pipeline metrics: new leads, outreach performance, meetings booked, conversion rates",
  version: "1.0.0",
  trigger: { type: "schedule", cron: "0 8 * * 1-5" },
  nodes: [
    {
      id: "fetch_pipeline",
      name: "Fetch Pipeline Data",
      type: "fetch",
      config: {
        integration: "hubspot",
        operation: "deals.pipeline",
        inputMap: {},
      },
    },
    {
      id: "fetch_email_metrics",
      name: "Fetch Email Performance",
      type: "fetch",
      config: {
        integration: "email",
        operation: "analytics.metrics",
        inputMap: { period: { source: "static", value: "last_7_days" } },
      },
    },
    {
      id: "fetch_activity",
      name: "Fetch Activity Log",
      type: "fetch",
      config: {
        integration: "hubspot",
        operation: "activities.list",
        inputMap: { period: { source: "static", value: "yesterday" } },
      },
    },
    {
      id: "analyze_pipeline",
      name: "AI Analyze Pipeline",
      type: "ai_decide",
      config: {
        inputMap: {
          pipeline: { source: "node", nodeId: "fetch_pipeline", path: "deals" },
          emailMetrics: { source: "node", nodeId: "fetch_email_metrics", path: "metrics" },
          activity: { source: "node", nodeId: "fetch_activity", path: "activities" },
        },
      },
      agent: {
        role: "Pipeline Reporter",
        model: "sonnet",
        instructions: `Analyze the sales pipeline. Return:
{
  "newLeadsYesterday": number,
  "totalPipelineValue": number,
  "byStage": [{ stage, count, value }],
  "emailMetrics": { sent, opened, replied, openRate, replyRate },
  "meetingsBooked": number,
  "staleDeals": [{ dealId, name, daysSinceActivity }],
  "topMovers": [{ dealId, name, movedTo }],
  "weekOverWeekTrend": { leads, meetings, pipeline },
  "forecast": string (1 sentence),
  "topRecommendation": string
}`,
      },
    },
    {
      id: "format_report",
      name: "Format Report",
      type: "ai_generate",
      config: {
        inputMap: { analysis: { source: "node", nodeId: "analyze_pipeline", path: "" } },
      },
      agent: {
        role: "Pipeline Reporter",
        model: "haiku",
        instructions: "Format as a clean Slack report. Lead with the key number (pipeline value or meetings booked). Use trend indicators. Highlight stale deals that need attention. End with the forecast.",
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
          channel: { source: "integration", provider: "settings", path: "salesChannel" },
          message: { source: "node", nodeId: "format_report", path: "message" },
        },
      },
    },
  ],
  edges: [
    { from: "fetch_pipeline", to: "analyze_pipeline" },
    { from: "fetch_email_metrics", to: "analyze_pipeline" },
    { from: "fetch_activity", to: "analyze_pipeline" },
    { from: "analyze_pipeline", to: "format_report" },
    { from: "format_report", to: "send_report" },
  ],
  errorHandler: { onNodeFailure: "retry", maxRetries: 2, retryDelaySeconds: 120, notifyChannel: "#sales" },
  metadata: { estimatedDurationMs: 25000, estimatedCostCents: 6, tags: ["pipeline", "reporting", "forecast"], requiredIntegrations: ["hubspot", "email", "slack"], requiredApprovals: [] },
};

export const salesWorkflows = [leadResearch, outreachGeneration, followUpSequence, pipelineReport];
