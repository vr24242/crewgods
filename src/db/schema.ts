import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  jsonb,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";

// ═══════════════════════════════════════════════════════
// DB SCHEMA — Workflow-centric data model
// Orgs → Packs → Workflow Runs → Node Runs → Approvals
// ═══════════════════════════════════════════════════════

// ── Enums ──────────────────────────────────────────────

export const workflowRunStatusEnum = pgEnum("workflow_run_status", [
  "queued",
  "running",
  "waiting_approval",
  "paused",
  "completed",
  "failed",
  "cancelled",
]);

export const nodeRunStatusEnum = pgEnum("node_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
  "expired",
]);

// ── Organizations ──────────────────────────────────────

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  enabledPacks: jsonb("enabled_packs").$type<string[]>().default([]),
  budgetMonthlyCents: integer("budget_monthly_cents").default(0),
  spentMonthlyCents: integer("spent_monthly_cents").default(0),
  stripeCustomerId: text("stripe_customer_id"),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Users ──────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => orgs.id)
    .notNull(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").default("member"), // owner, admin, member
  avatarUrl: text("avatar_url"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Integrations (connected accounts per org) ─────────

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => orgs.id)
    .notNull(),
  provider: text("provider").notNull(), // slack, gmail, hubspot, etc.
  credentials: jsonb("credentials").$type<Record<string, unknown>>().default({}),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Event Subscriptions ────────────────────────────────
// Maps events to workflow templates (which events trigger which workflows)

export const eventSubscriptions = pgTable("event_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => orgs.id)
    .notNull(),
  eventType: text("event_type").notNull(),
  workflowTemplateId: text("workflow_template_id").notNull(),
  filters: jsonb("filters").$type<Record<string, unknown>>().default({}),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Workflow Runs ──────────────────────────────────────
// Each execution of a workflow template

export const workflowRuns = pgTable("workflow_runs", {
  id: text("id").primaryKey(), // matches Temporal workflowId
  orgId: uuid("org_id")
    .references(() => orgs.id)
    .notNull(),
  templateId: text("template_id").notNull(), // e.g. "finance-invoice-approval"
  packId: text("pack_id").notNull(),         // e.g. "finance"
  name: text("name").notNull(),
  status: workflowRunStatusEnum("status").default("queued"),
  temporalRunId: text("temporal_run_id"),
  input: jsonb("input").$type<Record<string, unknown>>().default({}),
  output: jsonb("output").$type<Record<string, unknown>>(),
  triggerEvent: text("trigger_event"),
  triggerSource: text("trigger_source"),
  progress: integer("progress").default(0),    // 0-100
  totalCostCents: integer("total_cost_cents").default(0),
  nodeCount: integer("node_count").default(0),
  nodesCompleted: integer("nodes_completed").default(0),
  error: text("error"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Node Runs ──────────────────────────────────────────
// Individual node executions within a workflow run

export const nodeRuns = pgTable("node_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowRunId: text("workflow_run_id")
    .references(() => workflowRuns.id)
    .notNull(),
  nodeId: text("node_id").notNull(),     // matches node.id in the template
  nodeName: text("node_name").notNull(),
  nodeType: text("node_type").notNull(), // ai_classify, action, approval, etc.
  status: nodeRunStatusEnum("status").default("pending"),
  input: jsonb("input").$type<Record<string, unknown>>().default({}),
  output: jsonb("output").$type<Record<string, unknown>>(),
  costCents: integer("cost_cents").default(0),
  error: text("error"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Approvals ──────────────────────────────────────────
// Human-in-the-loop approval records

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => orgs.id)
    .notNull(),
  workflowRunId: text("workflow_run_id")
    .references(() => workflowRuns.id)
    .notNull(),
  nodeId: text("node_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  context: jsonb("context").$type<Record<string, unknown>>().default({}),
  channels: jsonb("channels").$type<string[]>().default(["dashboard"]),
  priority: text("priority").default("medium"),
  status: approvalStatusEnum("status").default("pending"),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at"),
  decidedVia: text("decided_via"),  // slack, email, whatsapp, dashboard
  reason: text("reason"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Activity Log (audit trail) ─────────────────────────

export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => orgs.id)
    .notNull(),
  workflowRunId: text("workflow_run_id"),
  nodeId: text("node_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  summary: text("summary"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Webhook Events ─────────────────────────────────────
// Raw webhook payloads for debugging and replay

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => orgs.id)
    .notNull(),
  provider: text("provider").notNull(),
  eventType: text("event_type"),
  rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().default({}),
  normalizedEventId: text("normalized_event_id"),
  processed: boolean("processed").default(false),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
