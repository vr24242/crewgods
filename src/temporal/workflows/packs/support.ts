// ═══════════════════════════════════════════════════════
// SUPPORT PACK — Complaint routing, review recovery,
// escalation workflows, CSAT follow-up
// ═══════════════════════════════════════════════════════

import type { WorkflowPack } from "./index";

export const supportPack: WorkflowPack = {
  id: "support",
  name: "Support Pack",
  description: "Automate complaint routing, review recovery, escalation workflows, and satisfaction tracking",
  icon: "🎧",
  color: "#6366F1",
  requiredIntegrations: ["slack", "gmail", "zendesk"],
  workflows: [
    // ── 1. Complaint Routing ────────────────────────────
    {
      id: "support-complaint-routing",
      name: "Complaint Routing",
      description: "Receives complaints from any channel, classifies severity and topic, routes to the right team",
      triggerEvent: "complaint.received",
      tags: ["complaint", "routing", "triage"],
      estimatedCostCents: 3,
      nodes: [
        {
          id: "classify_complaint",
          name: "Classify Complaint",
          type: "ai_classify",
          config: {
            text: "{{trigger.payload.message}}",
            categories: ["billing", "product_defect", "service_quality", "delivery", "refund_request", "account_issue", "safety", "other"],
            context: { source: "{{trigger.source}}", customerName: "{{trigger.payload.customerName}}", customerTier: "{{trigger.payload.customerTier}}" },
            model: "haiku",
          },
        },
        {
          id: "assess_severity",
          name: "Assess Severity & Sentiment",
          type: "ai_decide",
          config: {
            question: "What is the severity and recommended response time for this complaint?",
            options: ["p1_immediate", "p2_same_day", "p3_next_day", "p4_standard"],
            context: { complaint: "{{trigger.payload.message}}", category: "{{classify_complaint.category}}", customerTier: "{{trigger.payload.customerTier}}" },
            criteria: "Safety issues are always P1. VIP customers get P2 minimum. Refund requests under $50 are P4.",
            model: "haiku",
          },
          dependsOn: ["classify_complaint"],
        },
        {
          id: "route_complaint",
          name: "Route to Team",
          type: "condition",
          config: { severity: "{{assess_severity.decision}}", category: "{{classify_complaint.category}}" },
          dependsOn: ["assess_severity"],
        },
        {
          id: "create_ticket",
          name: "Create Support Ticket",
          type: "action",
          config: {
            action: "create_task",
            title: "[{{assess_severity.decision}}] {{classify_complaint.category}}: {{trigger.payload.customerName}}",
            description: "{{trigger.payload.message}}",
            priority: "{{assess_severity.decision}}",
          },
          dependsOn: ["route_complaint"],
        },
        {
          id: "notify_urgent",
          name: "Alert Team (Urgent)",
          type: "action",
          config: {
            action: "send_slack",
            channel: "#support-urgent",
            message: "🔴 P1 complaint from {{trigger.payload.customerName}}: {{classify_complaint.category}}\n{{assess_severity.reasoning}}",
          },
          dependsOn: ["route_complaint"],
        },
        {
          id: "auto_acknowledge",
          name: "Send Auto-Acknowledgement",
          type: "ai_generate",
          config: {
            instructions: "Write a brief, empathetic acknowledgement email. Mention we've received their complaint, give a timeframe based on severity, and assure them we're looking into it. Keep it under 100 words.",
            context: { category: "{{classify_complaint.category}}", severity: "{{assess_severity.decision}}", customerName: "{{trigger.payload.customerName}}" },
            model: "haiku",
          },
          dependsOn: ["classify_complaint"],
        },
        {
          id: "send_acknowledgement",
          name: "Send Acknowledgement",
          type: "action",
          config: { action: "send_email", to: "{{trigger.payload.customerEmail}}", subject: "We received your message", body: "{{auto_acknowledge.rawText}}" },
          dependsOn: ["auto_acknowledge"],
        },
      ],
      edges: [
        { from: "classify_complaint", to: "assess_severity" },
        { from: "classify_complaint", to: "auto_acknowledge" },
        { from: "assess_severity", to: "route_complaint" },
        { from: "route_complaint", to: "create_ticket" },
        { from: "route_complaint", to: "notify_urgent", condition: { field: "severity", operator: "eq", value: "p1_immediate" } },
        { from: "auto_acknowledge", to: "send_acknowledgement" },
      ],
    },

    // ── 2. Review Recovery ──────────────────────────────
    {
      id: "support-review-recovery",
      name: "Review Recovery",
      description: "Detects negative reviews, analyzes sentiment, coordinates personalized recovery response",
      triggerEvent: "review.posted",
      tags: ["reviews", "recovery", "reputation"],
      estimatedCostCents: 6,
      nodes: [
        {
          id: "analyze_review",
          name: "Analyze Review",
          type: "ai_classify",
          config: {
            text: "{{trigger.payload.reviewText}}",
            categories: ["positive", "neutral", "negative_recoverable", "negative_severe", "fake_spam"],
            context: { rating: "{{trigger.payload.rating}}", platform: "{{trigger.source}}" },
            model: "haiku",
          },
        },
        {
          id: "check_customer",
          name: "Look Up Customer",
          type: "fetch",
          config: { provider: "internal", operation: "customers.search", params: { name: "{{trigger.payload.reviewerName}}", email: "{{trigger.payload.reviewerEmail}}" } },
        },
        {
          id: "route_review",
          name: "Route by Sentiment",
          type: "condition",
          config: { category: "{{analyze_review.category}}" },
          dependsOn: ["analyze_review"],
        },
        {
          id: "generate_response",
          name: "Generate Recovery Response",
          type: "ai_generate",
          config: {
            instructions: "Write a public review response that: acknowledges the issue, apologizes sincerely, offers to make it right, provides a way to reach us directly. Be genuine, not corporate. Under 150 words.",
            context: { review: "{{trigger.payload.reviewText}}", category: "{{analyze_review.category}}", customerHistory: "{{check_customer}}" },
            model: "sonnet",
          },
          dependsOn: ["analyze_review", "check_customer"],
        },
        {
          id: "manager_approval",
          name: "Manager Approves Response",
          type: "approval",
          config: {
            title: "Review Recovery: {{trigger.payload.reviewerName}} ({{trigger.payload.rating}}⭐)",
            description: "Review: {{trigger.payload.reviewText}}\n\nDraft response: {{generate_response.rawText}}",
            channels: ["slack", "dashboard"],
            priority: "high",
            expiresInMinutes: 240,
          },
          dependsOn: ["generate_response"],
        },
        {
          id: "post_response",
          name: "Post Public Response",
          type: "action",
          config: { action: "create_task", title: "Post review response on {{trigger.source}}", description: "{{generate_response.rawText}}", priority: "high" },
          dependsOn: ["manager_approval"],
        },
        {
          id: "send_direct_outreach",
          name: "Send Direct Outreach",
          type: "ai_generate",
          config: {
            instructions: "Write a private email to the reviewer offering compensation or a call to resolve the issue. Be more personal than the public response. Mention a specific resolution (discount, replacement, refund). Under 150 words.",
            context: { review: "{{trigger.payload.reviewText}}", customerHistory: "{{check_customer}}" },
            model: "haiku",
          },
          dependsOn: ["manager_approval"],
        },
        {
          id: "send_outreach_email",
          name: "Send Outreach Email",
          type: "action",
          config: { action: "send_email", to: "{{trigger.payload.reviewerEmail}}", subject: "We want to make this right", body: "{{send_direct_outreach.rawText}}" },
          dependsOn: ["send_direct_outreach"],
        },
        {
          id: "notify_team",
          name: "Notify Team",
          type: "action",
          config: { action: "send_slack", channel: "#reviews", message: "{{analyze_review.category}} review recovery initiated for {{trigger.payload.reviewerName}} on {{trigger.source}}" },
          dependsOn: ["analyze_review"],
        },
      ],
      edges: [
        { from: "analyze_review", to: "route_review" },
        { from: "analyze_review", to: "notify_team" },
        { from: "check_customer", to: "generate_response" },
        { from: "route_review", to: "generate_response", condition: { field: "category", operator: "contains", value: "negative" } },
        { from: "generate_response", to: "manager_approval" },
        { from: "manager_approval", to: "post_response" },
        { from: "manager_approval", to: "send_direct_outreach" },
        { from: "send_direct_outreach", to: "send_outreach_email" },
      ],
    },

    // ── 3. Escalation Workflow ───────────────────────────
    {
      id: "support-escalation",
      name: "Escalation Workflow",
      description: "Monitors SLA breaches, no-response tickets, and auto-escalates with context",
      triggerEvent: "sla.breached",
      triggerSchedule: "*/30 * * * *",
      tags: ["escalation", "sla", "monitoring"],
      estimatedCostCents: 4,
      nodes: [
        {
          id: "fetch_breached",
          name: "Fetch SLA-Breached Tickets",
          type: "fetch",
          config: { provider: "zendesk", operation: "tickets.sla_breached", params: {} },
        },
        {
          id: "assess_escalations",
          name: "AI Assess Escalation Priority",
          type: "ai_decide",
          config: {
            question: "Prioritize these SLA-breached tickets for escalation",
            options: ["escalate_l2", "escalate_manager", "escalate_vp", "auto_resolve", "close_stale"],
            context: { tickets: "{{fetch_breached}}" },
            criteria: "Customer tier, ticket age, number of interactions, sentiment trend",
            model: "sonnet",
          },
          dependsOn: ["fetch_breached"],
        },
        {
          id: "generate_escalation_summary",
          name: "Generate Escalation Summary",
          type: "ai_summarize",
          config: {
            text: "{{assess_escalations}}",
            style: "executive",
            maxLength: 200,
            model: "haiku",
          },
          dependsOn: ["assess_escalations"],
        },
        {
          id: "notify_escalations",
          name: "Notify Team of Escalations",
          type: "action",
          config: { action: "send_slack", channel: "#support-escalations", message: "🔴 SLA Breach Report:\n{{generate_escalation_summary.summary}}" },
          dependsOn: ["generate_escalation_summary"],
        },
      ],
      edges: [
        { from: "fetch_breached", to: "assess_escalations" },
        { from: "assess_escalations", to: "generate_escalation_summary" },
        { from: "generate_escalation_summary", to: "notify_escalations" },
      ],
    },
  ],
};
