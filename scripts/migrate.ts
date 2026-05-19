// Run: npx tsx scripts/migrate.ts
// Uses Neon's HTTP SQL API directly (bypasses neon driver's fetch issues in Node 20)

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

// Parse connection string to get the endpoint host
const url = new URL(DATABASE_URL);
const API_URL = `https://${url.hostname}/sql`;
const CONN_STRING = DATABASE_URL;

async function query(sql: string, params: any[] = []) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Neon-Connection-String": CONN_STRING,
    },
    body: JSON.stringify({ query: sql, params }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SQL error: ${text}`);
  }
  return res.json() as Promise<{ rows: any[]; rowCount: number }>;
}

async function main() {
  console.log("🚀 Running migration...");

  const ddl = [
    [`CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'expired')`, "approval_status"],
    [`CREATE TYPE "public"."node_run_status" AS ENUM('pending', 'running', 'completed', 'failed', 'skipped')`, "node_run_status"],
    [`CREATE TYPE "public"."workflow_run_status" AS ENUM('queued', 'running', 'waiting_approval', 'paused', 'completed', 'failed', 'cancelled')`, "workflow_run_status"],
    [`CREATE TABLE "orgs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL, "slug" text NOT NULL UNIQUE,
      "enabled_packs" jsonb DEFAULT '[]'::jsonb,
      "budget_monthly_cents" integer DEFAULT 0, "spent_monthly_cents" integer DEFAULT 0,
      "stripe_customer_id" text, "settings" jsonb DEFAULT '{}'::jsonb,
      "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL
    )`, "orgs"],
    [`CREATE TABLE "users" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "orgs"("id"),
      "email" text NOT NULL UNIQUE, "name" text NOT NULL,
      "role" text DEFAULT 'member', "avatar_url" text,
      "last_login_at" timestamp, "created_at" timestamp DEFAULT now() NOT NULL
    )`, "users"],
    [`CREATE TABLE "integrations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "orgs"("id"),
      "provider" text NOT NULL, "credentials" jsonb DEFAULT '{}'::jsonb,
      "metadata" jsonb DEFAULT '{}'::jsonb, "active" boolean DEFAULT true,
      "created_at" timestamp DEFAULT now() NOT NULL
    )`, "integrations"],
    [`CREATE TABLE "event_subscriptions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "orgs"("id"),
      "event_type" text NOT NULL, "workflow_template_id" text NOT NULL,
      "filters" jsonb DEFAULT '{}'::jsonb, "active" boolean DEFAULT true,
      "created_at" timestamp DEFAULT now() NOT NULL
    )`, "event_subscriptions"],
    [`CREATE TABLE "workflow_runs" (
      "id" text PRIMARY KEY NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "orgs"("id"),
      "template_id" text NOT NULL, "pack_id" text NOT NULL, "name" text NOT NULL,
      "status" "workflow_run_status" DEFAULT 'queued', "temporal_run_id" text,
      "input" jsonb DEFAULT '{}'::jsonb, "output" jsonb,
      "trigger_event" text, "trigger_source" text,
      "progress" integer DEFAULT 0, "total_cost_cents" integer DEFAULT 0,
      "node_count" integer DEFAULT 0, "nodes_completed" integer DEFAULT 0,
      "error" text, "started_at" timestamp, "completed_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL
    )`, "workflow_runs"],
    [`CREATE TABLE "node_runs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "workflow_run_id" text NOT NULL REFERENCES "workflow_runs"("id"),
      "node_id" text NOT NULL, "node_name" text NOT NULL, "node_type" text NOT NULL,
      "status" "node_run_status" DEFAULT 'pending',
      "input" jsonb DEFAULT '{}'::jsonb, "output" jsonb,
      "cost_cents" integer DEFAULT 0, "error" text,
      "started_at" timestamp, "completed_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL
    )`, "node_runs"],
    [`CREATE TABLE "approvals" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "orgs"("id"),
      "workflow_run_id" text NOT NULL REFERENCES "workflow_runs"("id"),
      "node_id" text NOT NULL, "title" text NOT NULL, "description" text,
      "context" jsonb DEFAULT '{}'::jsonb,
      "channels" jsonb DEFAULT '["dashboard"]'::jsonb,
      "priority" text DEFAULT 'medium',
      "status" "approval_status" DEFAULT 'pending',
      "decided_by" text, "decided_at" timestamp, "decided_via" text,
      "reason" text, "expires_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL
    )`, "approvals"],
    [`CREATE TABLE "activity_log" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "orgs"("id"),
      "workflow_run_id" text, "node_id" text,
      "action" text NOT NULL, "resource_type" text, "resource_id" text,
      "summary" text, "metadata" jsonb DEFAULT '{}'::jsonb,
      "created_at" timestamp DEFAULT now() NOT NULL
    )`, "activity_log"],
    [`CREATE TABLE "webhook_events" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "orgs"("id"),
      "provider" text NOT NULL, "event_type" text,
      "raw_payload" jsonb DEFAULT '{}'::jsonb,
      "normalized_event_id" text, "processed" boolean DEFAULT false,
      "error" text, "created_at" timestamp DEFAULT now() NOT NULL
    )`, "webhook_events"],
    [`CREATE INDEX "idx_workflow_runs_org" ON "workflow_runs"("org_id")`, "idx_workflow_runs_org"],
    [`CREATE INDEX "idx_workflow_runs_status" ON "workflow_runs"("status")`, "idx_workflow_runs_status"],
    [`CREATE INDEX "idx_workflow_runs_template" ON "workflow_runs"("template_id")`, "idx_workflow_runs_template"],
    [`CREATE INDEX "idx_node_runs_workflow" ON "node_runs"("workflow_run_id")`, "idx_node_runs_workflow"],
    [`CREATE INDEX "idx_approvals_org_status" ON "approvals"("org_id", "status")`, "idx_approvals_org_status"],
    [`CREATE INDEX "idx_approvals_workflow" ON "approvals"("workflow_run_id")`, "idx_approvals_workflow"],
    [`CREATE INDEX "idx_activity_log_org" ON "activity_log"("org_id")`, "idx_activity_log_org"],
    [`CREATE INDEX "idx_event_subs_org_event" ON "event_subscriptions"("org_id", "event_type")`, "idx_event_subs_org_event"],
  ];

  for (const [stmt, name] of ddl) {
    try {
      await query(stmt);
      console.log(`  ✅ ${name}`);
    } catch (err: any) {
      if (err.message?.includes("already exists")) {
        console.log(`  ⏭️  ${name} (already exists)`);
      } else {
        console.error(`  ❌ ${name}: ${err.message?.slice(0, 120)}`);
      }
    }
  }

  console.log("\n🌱 Seeding demo data...");
  await seed();
  console.log("\n✅ Migration complete!");
}

async function seed() {
  // Create demo org
  const orgResult = await query(
    `INSERT INTO orgs (name, slug, enabled_packs, budget_monthly_cents)
     VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (slug) DO UPDATE SET name = $1
     RETURNING id`,
    ["Demo Team", "demo", '["finance","hr","support","ops","sales"]', 500000]
  );
  const orgId = orgResult.rows[0].id;
  console.log(`  ✅ Org: Demo Team (${orgId})`);

  // Create demo user
  await query(
    `INSERT INTO users (org_id, email, name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`,
    [orgId, "demo@crewgods.com", "Demo User", "owner"]
  );
  console.log("  ✅ User: demo@crewgods.com");

  // Event subscriptions
  const subs: [string, string][] = [
    ["invoice.received", "finance-invoice-approval"],
    ["expense.submitted", "finance-expense-audit"],
    ["payment.overdue", "finance-payment-escalation"],
    ["application.received", "hr-hiring-pipeline"],
    ["offer.accepted", "hr-onboarding"],
    ["leave.requested", "hr-leave-approval"],
    ["complaint.received", "support-complaint-router"],
    ["review.posted", "support-review-recovery"],
    ["sla.breached", "support-sla-escalation"],
    ["incident.triggered", "ops-incident-escalation"],
    ["vendor.requested", "ops-vendor-onboarding"],
    ["lead.created", "sales-lead-routing"],
    ["deal.stage_changed", "sales-proposal-generation"],
    ["deal.updated", "sales-deal-alerts"],
  ];
  for (const [event, templateId] of subs) {
    await query(
      `INSERT INTO event_subscriptions (org_id, event_type, workflow_template_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [orgId, event, templateId]
    );
  }
  console.log(`  ✅ ${subs.length} event subscriptions`);

  // Workflow runs
  const now = Date.now();
  const runs = [
    ["fin-inv-001", "finance-invoice-approval", "finance", "Invoice Approval", "completed", "invoice.received", 5, 8, 8, new Date(now - 120000).toISOString(), new Date(now - 115800).toISOString()],
    ["hr-hire-002", "hr-hiring-pipeline", "hr", "Hiring Pipeline", "waiting_approval", "application.received", 8, 5, 3, new Date(now - 300000).toISOString(), null],
    ["sup-comp-003", "support-complaint-router", "support", "Complaint Router", "completed", "complaint.received", 3, 5, 5, new Date(now - 480000).toISOString(), new Date(now - 477200).toISOString()],
    ["sales-lead-004", "sales-lead-routing", "sales", "Lead Routing", "completed", "lead.created", 4, 9, 9, new Date(now - 720000).toISOString(), new Date(now - 713900).toISOString()],
    ["ops-inc-005", "ops-incident-escalation", "ops", "Incident Escalation", "running", "incident.triggered", 2, 8, 4, new Date(now - 900000).toISOString(), null],
    ["fin-exp-006", "finance-expense-audit", "finance", "Expense Audit", "completed", "cron:daily", 3, 5, 5, new Date(now - 1320000).toISOString(), new Date(now - 1318100).toISOString()],
  ];
  for (const r of runs) {
    await query(
      `INSERT INTO workflow_runs (id, org_id, template_id, pack_id, name, status, trigger_event, total_cost_cents, node_count, nodes_completed, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO NOTHING`,
      [r[0], orgId, r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10]]
    );
  }
  console.log(`  ✅ ${runs.length} demo workflow runs`);

  // Approvals
  const approvals = [
    ["hr-hire-002", "manager-review", "Manager Review: Sarah Chen", "Sr. Engineer candidate — Strong Match (4.2/5)", "high", '["slack","email","dashboard"]'],
    ["ops-inc-005", "vp-approval", "VP Approval: Customer Comms", "SEV1 incident — approve customer communication draft", "high", '["slack","dashboard"]'],
  ];
  for (const a of approvals) {
    await query(
      `INSERT INTO approvals (org_id, workflow_run_id, node_id, title, description, priority, channels)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [orgId, a[0], a[1], a[2], a[3], a[4], a[5]]
    );
  }
  console.log(`  ✅ ${approvals.length} pending approvals`);
}

main().catch((err) => {
  console.error("💥 Migration failed:", err);
  process.exit(1);
});
