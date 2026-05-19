#!/usr/bin/env python3
"""Neon migration via HTTP SQL API"""
import json, urllib.request, ssl, sys
from datetime import datetime, timedelta

# Bypass SSL verification (Python on macOS often lacks root certs)
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

NEON_HOST = "ep-green-breeze-apv1kd8v.c-7.us-east-1.aws.neon.tech"
API_URL = f"https://{NEON_HOST}/sql"
CONN = f"postgresql://neondb_owner:npg_GQp4YqFW0dDV@{NEON_HOST}/neondb?sslmode=require"

def run(sql, params=None):
    data = json.dumps({"query": sql, "params": params or []}).encode()
    req = urllib.request.Request(API_URL, data=data, headers={
        "Content-Type": "application/json",
        "Neon-Connection-String": CONN,
    })
    resp = urllib.request.urlopen(req, timeout=30, context=ctx)
    return json.loads(resp.read())

def run_ddl(label, sql):
    try:
        run(sql)
        print(f"  ✅ {label}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        if "already exists" in body:
            print(f"  ⏭️  {label} (already exists)")
        else:
            print(f"  ❌ {label}: {body[:120]}")

print("🚀 Running migration...")

# Enums
run_ddl("approval_status", """CREATE TYPE "public"."approval_status" AS ENUM('pending','approved','rejected','expired')""")
run_ddl("node_run_status", """CREATE TYPE "public"."node_run_status" AS ENUM('pending','running','completed','failed','skipped')""")
run_ddl("workflow_run_status", """CREATE TYPE "public"."workflow_run_status" AS ENUM('queued','running','waiting_approval','paused','completed','failed','cancelled')""")

# Tables
run_ddl("orgs", """CREATE TABLE "orgs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL, "slug" text NOT NULL UNIQUE,
  "enabled_packs" jsonb DEFAULT '[]'::jsonb,
  "budget_monthly_cents" integer DEFAULT 0, "spent_monthly_cents" integer DEFAULT 0,
  "stripe_customer_id" text, "settings" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL
)""")

run_ddl("users", """CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id"),
  "email" text NOT NULL UNIQUE, "name" text NOT NULL,
  "role" text DEFAULT 'member', "avatar_url" text,
  "last_login_at" timestamp, "created_at" timestamp DEFAULT now() NOT NULL
)""")

run_ddl("integrations", """CREATE TABLE "integrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id"),
  "provider" text NOT NULL, "credentials" jsonb DEFAULT '{}'::jsonb,
  "metadata" jsonb DEFAULT '{}'::jsonb, "active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL
)""")

run_ddl("event_subscriptions", """CREATE TABLE "event_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id"),
  "event_type" text NOT NULL, "workflow_template_id" text NOT NULL,
  "filters" jsonb DEFAULT '{}'::jsonb, "active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL
)""")

run_ddl("workflow_runs", """CREATE TABLE "workflow_runs" (
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
)""")

run_ddl("node_runs", """CREATE TABLE "node_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workflow_run_id" text NOT NULL REFERENCES "workflow_runs"("id"),
  "node_id" text NOT NULL, "node_name" text NOT NULL, "node_type" text NOT NULL,
  "status" "node_run_status" DEFAULT 'pending',
  "input" jsonb DEFAULT '{}'::jsonb, "output" jsonb,
  "cost_cents" integer DEFAULT 0, "error" text,
  "started_at" timestamp, "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
)""")

run_ddl("approvals", """CREATE TABLE "approvals" (
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
)""")

run_ddl("activity_log", """CREATE TABLE "activity_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id"),
  "workflow_run_id" text, "node_id" text,
  "action" text NOT NULL, "resource_type" text, "resource_id" text,
  "summary" text, "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
)""")

run_ddl("webhook_events", """CREATE TABLE "webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id"),
  "provider" text NOT NULL, "event_type" text,
  "raw_payload" jsonb DEFAULT '{}'::jsonb,
  "normalized_event_id" text, "processed" boolean DEFAULT false,
  "error" text, "created_at" timestamp DEFAULT now() NOT NULL
)""")

# Indexes
for name, sql in [
    ("idx_workflow_runs_org", 'CREATE INDEX "idx_workflow_runs_org" ON "workflow_runs"("org_id")'),
    ("idx_workflow_runs_status", 'CREATE INDEX "idx_workflow_runs_status" ON "workflow_runs"("status")'),
    ("idx_workflow_runs_template", 'CREATE INDEX "idx_workflow_runs_template" ON "workflow_runs"("template_id")'),
    ("idx_node_runs_workflow", 'CREATE INDEX "idx_node_runs_workflow" ON "node_runs"("workflow_run_id")'),
    ("idx_approvals_org_status", 'CREATE INDEX "idx_approvals_org_status" ON "approvals"("org_id", "status")'),
    ("idx_approvals_workflow", 'CREATE INDEX "idx_approvals_workflow" ON "approvals"("workflow_run_id")'),
    ("idx_activity_log_org", 'CREATE INDEX "idx_activity_log_org" ON "activity_log"("org_id")'),
    ("idx_event_subs_org_event", 'CREATE INDEX "idx_event_subs_org_event" ON "event_subscriptions"("org_id", "event_type")'),
]:
    run_ddl(name, sql)

print("\n🌱 Seeding demo data...")

# Demo org
result = run(
    """INSERT INTO orgs (name, slug, enabled_packs, budget_monthly_cents)
    VALUES ($1, $2, $3::jsonb, $4)
    ON CONFLICT (slug) DO UPDATE SET name = $1
    RETURNING id""",
    ["Demo Team", "demo", '["finance","hr","support","ops","sales"]', 500000]
)
org_id = result["rows"][0]["id"]
print(f"  ✅ Org: Demo Team ({org_id})")

# Demo user
run("INSERT INTO users (org_id, email, name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING",
    [org_id, "demo@crewgods.com", "Demo User", "owner"])
print("  ✅ User: demo@crewgods.com")

# Event subscriptions
subs = [
    ("invoice.received", "finance-invoice-approval"),
    ("expense.submitted", "finance-expense-audit"),
    ("payment.overdue", "finance-payment-escalation"),
    ("application.received", "hr-hiring-pipeline"),
    ("offer.accepted", "hr-onboarding"),
    ("leave.requested", "hr-leave-approval"),
    ("complaint.received", "support-complaint-router"),
    ("review.posted", "support-review-recovery"),
    ("sla.breached", "support-sla-escalation"),
    ("incident.triggered", "ops-incident-escalation"),
    ("vendor.requested", "ops-vendor-onboarding"),
    ("lead.created", "sales-lead-routing"),
    ("deal.stage_changed", "sales-proposal-generation"),
    ("deal.updated", "sales-deal-alerts"),
]
for event, tmpl in subs:
    run("INSERT INTO event_subscriptions (org_id, event_type, workflow_template_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [org_id, event, tmpl])
print(f"  ✅ {len(subs)} event subscriptions")

# Workflow runs
now = datetime.utcnow()
runs = [
    ("fin-inv-001", "finance-invoice-approval", "finance", "Invoice Approval", "completed", "invoice.received", 5, 8, 8, (now - timedelta(seconds=120)).isoformat(), (now - timedelta(seconds=115)).isoformat()),
    ("hr-hire-002", "hr-hiring-pipeline", "hr", "Hiring Pipeline", "waiting_approval", "application.received", 8, 5, 3, (now - timedelta(seconds=300)).isoformat(), None),
    ("sup-comp-003", "support-complaint-router", "support", "Complaint Router", "completed", "complaint.received", 3, 5, 5, (now - timedelta(seconds=480)).isoformat(), (now - timedelta(seconds=477)).isoformat()),
    ("sales-lead-004", "sales-lead-routing", "sales", "Lead Routing", "completed", "lead.created", 4, 9, 9, (now - timedelta(seconds=720)).isoformat(), (now - timedelta(seconds=714)).isoformat()),
    ("ops-inc-005", "ops-incident-escalation", "ops", "Incident Escalation", "running", "incident.triggered", 2, 8, 4, (now - timedelta(seconds=900)).isoformat(), None),
    ("fin-exp-006", "finance-expense-audit", "finance", "Expense Audit", "completed", "cron:daily", 3, 5, 5, (now - timedelta(seconds=1320)).isoformat(), (now - timedelta(seconds=1318)).isoformat()),
]
for r in runs:
    run("""INSERT INTO workflow_runs (id, org_id, template_id, pack_id, name, status, trigger_event, total_cost_cents, node_count, nodes_completed, started_at, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO NOTHING""",
        [r[0], org_id, r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10]])
print(f"  ✅ {len(runs)} demo workflow runs")

# Approvals
approvals = [
    ("hr-hire-002", "manager-review", "Manager Review: Sarah Chen", "Sr. Engineer candidate - Strong Match (4.2/5)", "high", '["slack","email","dashboard"]'),
    ("ops-inc-005", "vp-approval", "VP Approval: Customer Comms", "SEV1 incident - approve customer communication draft", "high", '["slack","dashboard"]'),
]
for a in approvals:
    run("""INSERT INTO approvals (org_id, workflow_run_id, node_id, title, description, priority, channels)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)""",
        [org_id, a[0], a[1], a[2], a[3], a[4], a[5]])
print(f"  ✅ {len(approvals)} pending approvals")

print("\n✅ Migration complete!")
