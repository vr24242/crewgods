// ═══════════════════════════════════════════════════════
// PROXY ROUTE — Forwards dashboard requests to Fastify
// Falls back to direct DB queries, then to mock data
// ═══════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/auth";
import { eq, sql, and, gte, desc, count, sum, inArray } from "drizzle-orm";

const API_BASE = process.env.API_URL ?? "http://localhost:3001";

// ── Pack metadata (not stored in DB, used for display) ──
const PACK_META: Record<string, { name: string; icon: string; color: string }> = {
  finance: { name: "Finance", icon: "💰", color: "#F59E0B" },
  hr: { name: "HR", icon: "👥", color: "#EC4899" },
  support: { name: "Support", icon: "🎧", color: "#6366F1" },
  ops: { name: "Ops", icon: "⚙️", color: "#14B8A6" },
  sales: { name: "Sales", icon: "🎯", color: "#8B5CF6" },
};

function getPackMeta(packId: string) {
  return PACK_META[packId] ?? { name: packId, icon: "📦", color: "#6B7280" };
}

// ── Lazy DB import to avoid build-time crashes ──────────
async function tryGetDb() {
  try {
    const { getDb } = await import("@/db");
    return getDb();
  } catch {
    return null;
  }
}

async function tryGetSchema() {
  try {
    return await import("@/db/schema");
  } catch {
    return null;
  }
}

async function proxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = `${API_BASE}/${path.join("/")}`;

  // Forward query params
  const url = new URL(target);
  request.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  // Get session for auth forwarding
  const session = await getSession(request);

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (session) {
    headers["X-User-Id"] = session.userId;
    headers["X-Org-Id"] = session.orgId;
  }

  try {
    const body = request.method !== "GET" && request.method !== "HEAD"
      ? await request.text()
      : undefined;

    const res = await fetch(url.toString(), {
      method: request.method,
      headers,
      body,
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    // Fastify not running — try direct DB, then fall back to mock data
    return handleOfflineRequest(path, request);
  }
}

// ── Offline handler: DB first, then mock ────────────────
async function handleOfflineRequest(path: string[], request: NextRequest): Promise<NextResponse> {
  const route = path.join("/");

  // Try real DB queries first
  try {
    const dbResult = await handleDbRequest(route, request);
    if (dbResult) return dbResult;
  } catch (err) {
    console.error("[proxy] DB query failed, falling back to mock:", err);
  }

  // Fall back to mock data
  return handleMockRequest(route, request);
}

// ── Direct DB queries ───────────────────────────────────

async function handleDbRequest(route: string, request: NextRequest): Promise<NextResponse | null> {
  const db = await tryGetDb();
  const schema = await tryGetSchema();
  if (!db || !schema) return null;

  // Dashboard stats
  if (route === "stats/dashboard") {
    return NextResponse.json(await queryDashboardStats(db, schema));
  }

  // Workflow list
  if (route === "workflows" || route === "api/workflows") {
    const statusFilter = request.nextUrl.searchParams.get("status");
    const packFilter = request.nextUrl.searchParams.get("pack");
    return NextResponse.json(await queryWorkflows(db, schema, statusFilter, packFilter));
  }

  // Packs
  if (route === "packs" || route === "api/packs") {
    return NextResponse.json(await queryPacks(db, schema));
  }

  // Approvals
  if (route === "approvals" || route === "api/approvals") {
    return NextResponse.json(await queryApprovals(db, schema));
  }

  // Approval action (POST) — let it pass through (needs Temporal)
  if (route.includes("approvals/") && request.method === "POST") {
    return null;
  }

  // Workflow actions (POST) — let it pass through (needs Temporal)
  if (request.method === "POST" && route.includes("workflows/")) {
    return null;
  }

  // Templates
  if (route.endsWith("templates")) {
    return NextResponse.json({ templates: mockTemplates() });
  }

  return null;
}

// ── Query: Dashboard Stats ──────────────────────────────

async function queryDashboardStats(db: any, schema: any) {
  const { workflowRuns, approvals: approvalsTable } = schema;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Run all queries in parallel
  const [
    todayRunsResult,
    pendingApprovalsCount,
    costResult,
    successRateResult,
    recentRunsResult,
    pendingApprovalsDetail,
    packStatsResult,
  ] = await Promise.all([
    // Count workflow runs today
    db.select({ count: count() })
      .from(workflowRuns)
      .where(gte(workflowRuns.createdAt, todayStart)),

    // Count pending approvals
    db.select({ count: count() })
      .from(approvalsTable)
      .where(eq(approvalsTable.status, "pending")),

    // Sum costs today
    db.select({ total: sum(workflowRuns.totalCostCents) })
      .from(workflowRuns)
      .where(gte(workflowRuns.createdAt, todayStart)),

    // Success rate: completed / (completed + failed) over all runs
    db.select({
      completed: sql<number>`count(*) filter (where ${workflowRuns.status} = 'completed')`,
      total: sql<number>`count(*) filter (where ${workflowRuns.status} in ('completed', 'failed'))`,
    }).from(workflowRuns),

    // Recent runs (last 8)
    db.select()
      .from(workflowRuns)
      .orderBy(desc(workflowRuns.createdAt))
      .limit(8),

    // Pending approvals with workflow info
    db.select({
      id: approvalsTable.id,
      workflowRunId: approvalsTable.workflowRunId,
      nodeId: approvalsTable.nodeId,
      title: approvalsTable.title,
      description: approvalsTable.description,
      context: approvalsTable.context,
      priority: approvalsTable.priority,
      packId: workflowRuns.packId,
      workflowName: workflowRuns.name,
    })
      .from(approvalsTable)
      .innerJoin(workflowRuns, eq(approvalsTable.workflowRunId, workflowRuns.id))
      .where(eq(approvalsTable.status, "pending"))
      .orderBy(desc(approvalsTable.createdAt))
      .limit(10),

    // Pack stats: runs per pack today
    db.select({
      packId: workflowRuns.packId,
      runsToday: count(),
    })
      .from(workflowRuns)
      .where(gte(workflowRuns.createdAt, todayStart))
      .groupBy(workflowRuns.packId),
  ]);

  const workflowsToday = todayRunsResult[0]?.count ?? 0;
  const approvalsPending = pendingApprovalsCount[0]?.count ?? 0;
  const costTodayCents = Number(costResult[0]?.total ?? 0);
  const completedCount = Number(successRateResult[0]?.completed ?? 0);
  const totalFinished = Number(successRateResult[0]?.total ?? 0);
  const successRate = totalFinished > 0
    ? Math.round((completedCount / totalFinished) * 1000) / 10
    : 100;

  // Map recent runs to frontend shape
  const recentRuns = recentRunsResult.map((r: any) => {
    const meta = getPackMeta(r.packId);
    const duration = r.startedAt && r.completedAt
      ? new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()
      : r.startedAt
        ? Date.now() - new Date(r.startedAt).getTime()
        : undefined;
    return {
      id: r.id,
      templateId: r.templateId,
      templateName: r.name,
      pack: meta.name,
      packColor: meta.color,
      status: r.status ?? "queued",
      trigger: r.triggerEvent ?? "manual",
      startedAt: r.startedAt ? new Date(r.startedAt).toISOString() : new Date(r.createdAt).toISOString(),
      completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : undefined,
      duration,
      costCents: r.totalCostCents ?? 0,
      nodeCount: r.nodeCount ?? 0,
      nodesCompleted: r.nodesCompleted ?? 0,
    };
  });

  // Map pending approvals to frontend shape
  const pendingApprovals = pendingApprovalsDetail.map((a: any) => {
    const meta = getPackMeta(a.packId);
    const contextStr = a.description ?? JSON.stringify(a.context ?? {});
    return {
      id: a.id,
      workflowId: a.workflowRunId,
      workflowName: a.workflowName,
      node: a.title,
      detail: contextStr,
      pack: meta.name,
      priority: a.priority ?? "medium",
    };
  });

  // Build pack stats from run counts + known pack metadata
  const runsByPack: Record<string, number> = {};
  for (const row of packStatsResult) {
    runsByPack[row.packId] = Number(row.runsToday);
  }

  // Get distinct template counts per pack (all time)
  let templateCountsByPack: Record<string, number> = {};
  try {
    const templateCounts = await db.select({
      packId: workflowRuns.packId,
      templates: sql<number>`count(distinct ${workflowRuns.templateId})`,
    })
      .from(workflowRuns)
      .groupBy(workflowRuns.packId);
    for (const row of templateCounts) {
      templateCountsByPack[row.packId] = Number(row.templates);
    }
  } catch {
    // Non-critical, use defaults
  }

  const allPackIds = new Set([
    ...Object.keys(PACK_META),
    ...Object.keys(runsByPack),
  ]);
  const packStats = Array.from(allPackIds).map((packId) => {
    const meta = getPackMeta(packId);
    return {
      name: meta.name,
      icon: meta.icon,
      color: meta.color,
      workflows: templateCountsByPack[packId] ?? 0,
      runsToday: runsByPack[packId] ?? 0,
    };
  });

  return {
    workflowsToday,
    workflowsTrend: "+0%",
    approvalsPending,
    costToday: costTodayCents,
    costBudget: 5000,
    successRate,
    recentRuns,
    pendingApprovals,
    packStats,
  };
}

// ── Query: Workflows ────────────────────────────────────

async function queryWorkflows(db: any, schema: any, statusFilter: string | null, packFilter: string | null) {
  const { workflowRuns } = schema;

  const conditions = [];
  if (statusFilter) {
    conditions.push(eq(workflowRuns.status, statusFilter));
  }
  if (packFilter) {
    conditions.push(eq(workflowRuns.packId, packFilter));
  }

  const whereClause = conditions.length > 0
    ? conditions.length === 1
      ? conditions[0]
      : and(...conditions)
    : undefined;

  const rows = whereClause
    ? await db.select().from(workflowRuns).where(whereClause).orderBy(desc(workflowRuns.createdAt)).limit(50)
    : await db.select().from(workflowRuns).orderBy(desc(workflowRuns.createdAt)).limit(50);

  const workflows = rows.map((r: any) => {
    const meta = getPackMeta(r.packId);
    const duration = r.startedAt && r.completedAt
      ? new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()
      : r.startedAt
        ? Date.now() - new Date(r.startedAt).getTime()
        : undefined;
    return {
      id: r.id,
      templateId: r.templateId,
      templateName: r.name,
      pack: meta.name,
      packColor: meta.color,
      status: r.status ?? "queued",
      trigger: r.triggerEvent ?? "manual",
      startedAt: r.startedAt ? new Date(r.startedAt).toISOString() : new Date(r.createdAt).toISOString(),
      completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : undefined,
      duration,
      costCents: r.totalCostCents ?? 0,
      nodeCount: r.nodeCount ?? 0,
      nodesCompleted: r.nodesCompleted ?? 0,
    };
  });

  return { workflows };
}

// ── Query: Approvals ────────────────────────────────────

async function queryApprovals(db: any, schema: any) {
  const { approvals: approvalsTable, workflowRuns } = schema;

  const rows = await db.select({
    id: approvalsTable.id,
    workflowRunId: approvalsTable.workflowRunId,
    nodeId: approvalsTable.nodeId,
    title: approvalsTable.title,
    description: approvalsTable.description,
    context: approvalsTable.context,
    channels: approvalsTable.channels,
    priority: approvalsTable.priority,
    createdAt: approvalsTable.createdAt,
    expiresAt: approvalsTable.expiresAt,
  })
    .from(approvalsTable)
    .where(eq(approvalsTable.status, "pending"))
    .orderBy(desc(approvalsTable.createdAt));

  // Group by workflowRunId to match PendingApprovalGroup shape
  const groups: Record<string, { workflowId: string; approvals: any[] }> = {};
  for (const row of rows) {
    if (!groups[row.workflowRunId]) {
      groups[row.workflowRunId] = { workflowId: row.workflowRunId, approvals: [] };
    }
    groups[row.workflowRunId].approvals.push({
      nodeId: row.nodeId,
      nodeName: row.title,
      requestedAt: new Date(row.createdAt).toISOString(),
      expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : undefined,
      channels: row.channels ?? ["dashboard"],
      context: row.context ?? {},
    });
  }

  return { pending: Object.values(groups) };
}

// ── Query: Packs ────────────────────────────────────────

async function queryPacks(db: any, schema: any) {
  const { workflowRuns } = schema;

  // Get distinct templates per pack with run counts
  const packData = await db.select({
    packId: workflowRuns.packId,
    templateId: workflowRuns.templateId,
    templateName: workflowRuns.name,
    runCount: count(),
  })
    .from(workflowRuns)
    .groupBy(workflowRuns.packId, workflowRuns.templateId, workflowRuns.name)
    .orderBy(workflowRuns.packId);

  // Group templates by pack
  const packMap: Record<string, { templates: { id: string; name: string; runCount: number }[] }> = {};
  for (const row of packData) {
    if (!packMap[row.packId]) {
      packMap[row.packId] = { templates: [] };
    }
    // Avoid duplicate template entries
    const existing = packMap[row.packId].templates.find((t) => t.id === row.templateId);
    if (!existing) {
      packMap[row.packId].templates.push({
        id: row.templateId,
        name: row.templateName,
        runCount: Number(row.runCount),
      });
    }
  }

  // Build pack list including known packs even if no runs exist
  const allPackIds = new Set([...Object.keys(PACK_META), ...Object.keys(packMap)]);
  const packs = Array.from(allPackIds).map((packId) => {
    const meta = getPackMeta(packId);
    const templates = packMap[packId]?.templates ?? [];
    return {
      id: packId,
      name: meta.name,
      description: `${meta.name} automation workflows`,
      icon: meta.icon,
      color: meta.color,
      requiredIntegrations: [] as string[],
      workflowCount: templates.length,
      workflows: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: "",
        tags: [] as string[],
        estimatedCostCents: 0,
      })),
    };
  });

  return { packs };
}

// ── Mock fallback handler ───────────────────────────────

function handleMockRequest(route: string, request: NextRequest): NextResponse {
  // Dashboard stats
  if (route === "stats/dashboard") {
    return NextResponse.json(mockDashboardStats());
  }

  // Workflow list
  if (route === "workflows" || route === "api/workflows") {
    return NextResponse.json({ workflows: mockWorkflowRuns() });
  }

  // Templates
  if (route.endsWith("templates")) {
    return NextResponse.json({ templates: mockTemplates() });
  }

  // Packs
  if (route === "packs" || route === "api/packs") {
    return NextResponse.json({ packs: mockPacks() });
  }

  // Approvals
  if (route === "approvals" || route === "api/approvals") {
    return NextResponse.json({ pending: mockPendingApprovals() });
  }

  // Approval action (simulate success)
  if (route.includes("approvals/") && request.method === "POST") {
    return NextResponse.json({ ok: true });
  }

  // Workflow actions
  if (request.method === "POST" && route.includes("workflows/")) {
    return NextResponse.json({ ok: true, workflowId: route.split("/")[1] });
  }

  return NextResponse.json({ error: "API offline — showing demo data" }, { status: 200 });
}

// ── Mock data generators ────────────────────────────────

function mockDashboardStats() {
  return {
    workflowsToday: 47,
    workflowsTrend: "+12%",
    approvalsPending: 3,
    costToday: 285,
    costBudget: 5000,
    successRate: 96.2,
    recentRuns: mockWorkflowRuns().slice(0, 8),
    pendingApprovals: [
      { id: "1", workflowId: "hr-hire-002", workflowName: "Hiring Pipeline", node: "Manager Review", detail: "Candidate: Sarah Chen for Sr. Engineer — Strong Match (4.2/5)", pack: "HR", priority: "high" },
      { id: "2", workflowId: "sup-rev-007", workflowName: "Review Recovery", node: "Approve Response", detail: "1-star review on Google from J. Smith — recovery response drafted", pack: "Support", priority: "high" },
      { id: "3", workflowId: "ops-inv-009", workflowName: "Inventory Monitoring", node: "Approve Reorder", detail: "3 items below safety stock — reorder total $2,400", pack: "Ops", priority: "medium" },
    ],
    packStats: [
      { name: "Finance", icon: "💰", color: "#F59E0B", workflows: 4, runsToday: 12 },
      { name: "HR", icon: "👥", color: "#EC4899", workflows: 3, runsToday: 8 },
      { name: "Support", icon: "🎧", color: "#6366F1", workflows: 3, runsToday: 15 },
      { name: "Ops", icon: "⚙️", color: "#14B8A6", workflows: 4, runsToday: 6 },
      { name: "Sales", icon: "🎯", color: "#8B5CF6", workflows: 4, runsToday: 6 },
    ],
  };
}

function mockWorkflowRuns() {
  const now = Date.now();
  return [
    { id: "fin-inv-001", templateId: "finance-invoice-approval", templateName: "Invoice Approval", pack: "Finance", packColor: "#F59E0B", status: "completed", trigger: "invoice.received", startedAt: new Date(now - 120000).toISOString(), completedAt: new Date(now - 115800).toISOString(), duration: 4200, costCents: 5, nodeCount: 8, nodesCompleted: 8 },
    { id: "hr-hire-002", templateId: "hr-hiring-pipeline", templateName: "Hiring Pipeline", pack: "HR", packColor: "#EC4899", status: "waiting_approval", trigger: "application.received", startedAt: new Date(now - 300000).toISOString(), duration: 12000, costCents: 8, nodeCount: 5, nodesCompleted: 3 },
    { id: "sup-comp-003", templateId: "support-complaint-router", templateName: "Complaint Router", pack: "Support", packColor: "#6366F1", status: "completed", trigger: "complaint.received", startedAt: new Date(now - 480000).toISOString(), completedAt: new Date(now - 477200).toISOString(), duration: 2800, costCents: 3, nodeCount: 5, nodesCompleted: 5 },
    { id: "sales-lead-004", templateId: "sales-lead-routing", templateName: "Lead Routing", pack: "Sales", packColor: "#8B5CF6", status: "completed", trigger: "lead.created", startedAt: new Date(now - 720000).toISOString(), completedAt: new Date(now - 713900).toISOString(), duration: 6100, costCents: 4, nodeCount: 9, nodesCompleted: 9 },
    { id: "ops-inc-005", templateId: "ops-incident-escalation", templateName: "Incident Escalation", pack: "Ops", packColor: "#14B8A6", status: "running", trigger: "incident.triggered", startedAt: new Date(now - 900000).toISOString(), duration: undefined, costCents: 2, nodeCount: 8, nodesCompleted: 4 },
    { id: "fin-exp-006", templateId: "finance-expense-audit", templateName: "Expense Audit", pack: "Finance", packColor: "#F59E0B", status: "completed", trigger: "cron:daily", startedAt: new Date(now - 1320000).toISOString(), completedAt: new Date(now - 1318100).toISOString(), duration: 1900, costCents: 3, nodeCount: 5, nodesCompleted: 5 },
    { id: "sup-rev-007", templateId: "support-review-recovery", templateName: "Review Recovery", pack: "Support", packColor: "#6366F1", status: "waiting_approval", trigger: "review.posted", startedAt: new Date(now - 1800000).toISOString(), duration: 8000, costCents: 6, nodeCount: 5, nodesCompleted: 3 },
    { id: "hr-leave-008", templateId: "hr-leave-approval", templateName: "Leave Approval", pack: "HR", packColor: "#EC4899", status: "completed", trigger: "leave.requested", startedAt: new Date(now - 2700000).toISOString(), completedAt: new Date(now - 2696500).toISOString(), duration: 3500, costCents: 2, nodeCount: 5, nodesCompleted: 5 },
    { id: "sales-pipe-009", templateId: "sales-pipeline-health", templateName: "Pipeline Health", pack: "Sales", packColor: "#8B5CF6", status: "completed", trigger: "cron:daily", startedAt: new Date(now - 3600000).toISOString(), completedAt: new Date(now - 3596200).toISOString(), duration: 3800, costCents: 4, nodeCount: 5, nodesCompleted: 5 },
    { id: "ops-vendor-010", templateId: "ops-vendor-onboarding", templateName: "Vendor Onboarding", pack: "Ops", packColor: "#14B8A6", status: "completed", trigger: "vendor.requested", startedAt: new Date(now - 5400000).toISOString(), completedAt: new Date(now - 5392800).toISOString(), duration: 7200, costCents: 5, nodeCount: 8, nodesCompleted: 8 },
    { id: "fin-pay-011", templateId: "finance-payment-escalation", templateName: "Payment Escalation", pack: "Finance", packColor: "#F59E0B", status: "failed", trigger: "payment.overdue", startedAt: new Date(now - 7200000).toISOString(), duration: 1200, costCents: 1, nodeCount: 4, nodesCompleted: 2 },
    { id: "sales-prop-012", templateId: "sales-proposal-generation", templateName: "Proposal Generation", pack: "Sales", packColor: "#8B5CF6", status: "completed", trigger: "deal.stage_changed", startedAt: new Date(now - 9000000).toISOString(), completedAt: new Date(now - 8991000).toISOString(), duration: 9000, costCents: 12, nodeCount: 7, nodesCompleted: 7 },
  ] as const;
}

function mockTemplates() {
  return [
    { id: "finance-invoice-approval", name: "Invoice Approval", description: "Auto-extract, classify, and route invoices for approval", triggerEvent: "invoice.received", estimatedCostCents: 5, tags: ["invoice", "approval", "finance"], nodeCount: 8 },
    { id: "finance-expense-audit", name: "Expense Audit", description: "Daily expense policy compliance checks", triggerSchedule: "0 9 * * *", estimatedCostCents: 3, tags: ["expense", "audit", "finance"], nodeCount: 5 },
    { id: "finance-payment-escalation", name: "Payment Escalation", description: "Chase overdue payments with escalation", triggerEvent: "payment.overdue", estimatedCostCents: 2, tags: ["payment", "escalation"], nodeCount: 4 },
    { id: "finance-bank-reconciliation", name: "Bank Reconciliation", description: "Match bank transactions to records", triggerSchedule: "0 6 * * *", estimatedCostCents: 3, tags: ["bank", "reconciliation"], nodeCount: 4 },
    { id: "hr-hiring-pipeline", name: "Hiring Pipeline", description: "Screen resumes, score, and route candidates", triggerEvent: "application.received", estimatedCostCents: 8, tags: ["hiring", "resume", "ai"], nodeCount: 5 },
    { id: "hr-onboarding", name: "Onboarding Checklist", description: "Automated new-hire onboarding", triggerEvent: "offer.accepted", estimatedCostCents: 2, tags: ["onboarding", "checklist"], nodeCount: 5 },
    { id: "hr-leave-approval", name: "Leave Approval", description: "Route and approve leave requests", triggerEvent: "leave.requested", estimatedCostCents: 2, tags: ["leave", "approval"], nodeCount: 5 },
    { id: "support-complaint-router", name: "Complaint Router", description: "AI classify and route complaints", triggerEvent: "complaint.received", estimatedCostCents: 3, tags: ["complaint", "routing", "ai"], nodeCount: 5 },
    { id: "support-review-recovery", name: "Review Recovery", description: "Respond to negative reviews", triggerEvent: "review.posted", estimatedCostCents: 6, tags: ["review", "recovery", "ai"], nodeCount: 5 },
    { id: "support-sla-escalation", name: "SLA Escalation", description: "Escalate SLA breaches", triggerEvent: "sla.breached", estimatedCostCents: 2, tags: ["sla", "escalation"], nodeCount: 5 },
    { id: "ops-incident-escalation", name: "Incident Escalation", description: "Classify and escalate incidents", triggerEvent: "incident.triggered", estimatedCostCents: 4, tags: ["incident", "escalation", "ai"], nodeCount: 8 },
    { id: "ops-vendor-onboarding", name: "Vendor Onboarding", description: "Onboard new vendors with compliance", triggerEvent: "vendor.requested", estimatedCostCents: 5, tags: ["vendor", "compliance"], nodeCount: 8 },
    { id: "ops-inventory-monitoring", name: "Inventory Monitoring", description: "Monitor stock and auto-reorder", triggerSchedule: "0 8 * * *", estimatedCostCents: 3, tags: ["inventory", "monitoring"], nodeCount: 5 },
    { id: "ops-sla-monitoring", name: "SLA Monitoring", description: "Daily SLA compliance checks", triggerSchedule: "0 7 * * *", estimatedCostCents: 2, tags: ["sla", "monitoring"], nodeCount: 6 },
    { id: "sales-lead-routing", name: "Lead Routing", description: "Score and route leads to reps", triggerEvent: "lead.created", estimatedCostCents: 4, tags: ["lead", "routing", "ai"], nodeCount: 9 },
    { id: "sales-pipeline-health", name: "Pipeline Health", description: "Daily pipeline health checks", triggerSchedule: "0 8 * * *", estimatedCostCents: 4, tags: ["pipeline", "health"], nodeCount: 5 },
    { id: "sales-proposal-generation", name: "Proposal Generation", description: "AI-generate proposals for deals", triggerEvent: "deal.stage_changed", estimatedCostCents: 12, tags: ["proposal", "ai"], nodeCount: 7 },
    { id: "sales-deal-alerts", name: "Deal Stage Alerts", description: "Alert on deal stage changes", triggerEvent: "deal.updated", estimatedCostCents: 2, tags: ["deal", "alerts"], nodeCount: 7 },
  ];
}

function mockPacks() {
  return [
    { id: "finance", name: "Finance", description: "Invoice approvals, expense audits, payment escalation, bank reconciliation", icon: "💰", color: "#F59E0B", requiredIntegrations: ["Gmail", "Slack", "QuickBooks"], workflowCount: 4, workflows: mockTemplates().filter(t => t.id.startsWith("finance-")) },
    { id: "hr", name: "HR & Recruiting", description: "Hiring pipeline, onboarding checklists, leave approvals", icon: "👥", color: "#EC4899", requiredIntegrations: ["Slack", "Gmail", "Google Sheets"], workflowCount: 3, workflows: mockTemplates().filter(t => t.id.startsWith("hr-")) },
    { id: "support", name: "Customer Support", description: "Complaint routing, review recovery, SLA escalation", icon: "🎧", color: "#6366F1", requiredIntegrations: ["Slack", "Gmail", "Zendesk"], workflowCount: 3, workflows: mockTemplates().filter(t => t.id.startsWith("support-")) },
    { id: "ops", name: "Operations", description: "Incident management, vendor onboarding, inventory alerts, SLA monitoring", icon: "⚙️", color: "#14B8A6", requiredIntegrations: ["Slack", "Gmail", "Google Sheets"], workflowCount: 4, workflows: mockTemplates().filter(t => t.id.startsWith("ops-")) },
    { id: "sales", name: "Sales", description: "Lead routing, pipeline health, proposal generation, deal coaching", icon: "🎯", color: "#8B5CF6", requiredIntegrations: ["Slack", "Gmail", "HubSpot"], workflowCount: 4, workflows: mockTemplates().filter(t => t.id.startsWith("sales-")) },
  ];
}

function mockPendingApprovals() {
  return [
    { workflowId: "hr-hire-002", approvals: [{ nodeId: "manager-review", nodeName: "Manager Review", requestedAt: new Date(Date.now() - 300000).toISOString(), expiresAt: new Date(Date.now() + 259200000).toISOString(), channels: ["slack", "email", "dashboard"], context: { candidate: "Sarah Chen", role: "Sr. Engineer", score: 4.2 } }] },
    { workflowId: "sup-rev-007", approvals: [{ nodeId: "approve-response", nodeName: "Approve Response", requestedAt: new Date(Date.now() - 1800000).toISOString(), channels: ["slack", "dashboard"], context: { reviewer: "J. Smith", rating: 1, platform: "Google" } }] },
    { workflowId: "ops-inv-009", approvals: [{ nodeId: "approve-reorder", nodeName: "Approve Reorder", requestedAt: new Date(Date.now() - 3600000).toISOString(), expiresAt: new Date(Date.now() + 172800000).toISOString(), channels: ["slack", "email", "dashboard"], context: { items: 3, total: "$2,400" } }] },
  ];
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE, proxy as PATCH };
