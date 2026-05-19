// ═══════════════════════════════════════════════════════
// EVENT SYSTEM — Everything becomes events
// Normalized across apps, countries, industries, systems
// ═══════════════════════════════════════════════════════

export interface CrewgodsEvent<T = unknown> {
  id: string;
  type: string;                    // e.g. "invoice.received", "ticket.created", "review.posted"
  source: string;                  // e.g. "gmail", "shopify", "zendesk", "whatsapp"
  orgId: string;                   // tenant/organization
  timestamp: string;               // ISO 8601
  actor?: EventActor;
  payload: T;
  metadata: EventMetadata;
}

export interface EventActor {
  type: "user" | "customer" | "system" | "agent";
  id: string;
  name?: string;
  email?: string;
}

export interface EventMetadata {
  correlationId?: string;          // links related events
  causationId?: string;            // what caused this event
  traceId?: string;                // distributed tracing
  sourceEventId?: string;          // raw event ID from integration
  raw?: unknown;                   // original payload from source
}

// ── Event Categories ──────────────────────────────────

export type EventCategory =
  | "communication"    // email, slack, whatsapp messages
  | "commerce"         // orders, payments, invoices
  | "support"          // tickets, complaints, reviews
  | "hr"               // applications, leave requests, onboarding
  | "finance"          // transactions, reconciliation, expenses
  | "sales"            // leads, deals, pipeline changes
  | "ops"              // incidents, SLA breaches, vendor changes
  | "content"          // posts, social, analytics
  | "legal"            // contracts, deadlines, compliance
  | "devops"           // issues, PRs, deploys, incidents
  | "custom";          // user-defined

// ── Common Event Types ────────────────────────────────

export const EVENT_TYPES = {
  // Communication
  "email.received": "communication",
  "email.sent": "communication",
  "slack.message": "communication",
  "whatsapp.message": "communication",

  // Commerce
  "order.created": "commerce",
  "order.updated": "commerce",
  "order.fulfilled": "commerce",
  "payment.received": "commerce",
  "payment.failed": "commerce",
  "invoice.received": "commerce",
  "invoice.approved": "commerce",
  "inventory.low": "commerce",

  // Support
  "ticket.created": "support",
  "ticket.updated": "support",
  "ticket.escalated": "support",
  "review.posted": "support",
  "complaint.received": "support",
  "csat.submitted": "support",

  // HR
  "application.received": "hr",
  "candidate.hired": "hr",
  "leave.requested": "hr",
  "onboarding.started": "hr",

  // Finance
  "transaction.created": "finance",
  "expense.submitted": "finance",
  "reconciliation.needed": "finance",
  "anomaly.detected": "finance",

  // Sales
  "lead.created": "sales",
  "lead.qualified": "sales",
  "deal.updated": "sales",
  "deal.won": "sales",
  "deal.lost": "sales",

  // Ops
  "incident.triggered": "ops",
  "sla.breached": "ops",
  "vendor.onboarded": "ops",
  "task.completed": "ops",

  // Approvals
  "approval.requested": "ops",
  "approval.granted": "ops",
  "approval.rejected": "ops",
  "approval.expired": "ops",
} as const satisfies Record<string, EventCategory>;

export type EventType = keyof typeof EVENT_TYPES;

// ── Event Subscription ────────────────────────────────

export interface EventSubscription {
  id: string;
  orgId: string;
  eventType: string | string[];    // can subscribe to multiple
  workflowId: string;              // Temporal workflow to trigger
  filter?: EventFilter;            // optional condition
  active: boolean;
}

export interface EventFilter {
  field: string;                   // dot-notation path in payload
  operator: "eq" | "neq" | "gt" | "lt" | "contains" | "matches" | "exists";
  value?: unknown;
}
