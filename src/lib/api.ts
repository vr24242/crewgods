// ═══════════════════════════════════════════════════════
// API CLIENT — Typed fetch wrapper for dashboard ↔ API
// Routes through Next.js API proxy at /api/proxy/*
// ═══════════════════════════════════════════════════════

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/proxy";

type FetchOpts = RequestInit & { params?: Record<string, string> };

async function api<T = unknown>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { params, ...init } = opts;
  let url = `${BASE}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += `?${qs}`;
  }

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? "Request failed");
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Workflows ───────────────────────────────────────────
export const workflows = {
  list: () =>
    api<{ workflows: WorkflowRun[] }>("/workflows"),

  templates: () =>
    api<{ templates: WorkflowTemplate[] }>("/workflows/templates"),

  start: (templateId: string, orgId: string, input: Record<string, unknown> = {}) =>
    api<{ workflowId: string; runId: string; name: string }>("/workflows/start", {
      method: "POST",
      body: JSON.stringify({ templateId, orgId, input }),
    }),

  status: (workflowId: string) =>
    api<WorkflowStatus>(`/workflows/${workflowId}/status`),

  pause: (workflowId: string) =>
    api<{ ok: boolean }>(`/workflows/${workflowId}/pause`, { method: "POST" }),

  resume: (workflowId: string) =>
    api<{ ok: boolean }>(`/workflows/${workflowId}/resume`, { method: "POST" }),

  cancel: (workflowId: string, reason?: string) =>
    api<{ ok: boolean }>(`/workflows/${workflowId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};

// ── Approvals ───────────────────────────────────────────
export const approvals = {
  listAll: (orgId?: string) =>
    api<{ pending: PendingApprovalGroup[] }>("/approvals", {
      params: orgId ? { orgId } : undefined,
    }),

  forWorkflow: (workflowId: string) =>
    api<{ workflowId: string; pending: PendingApproval[] }>(`/approvals/${workflowId}`),

  decide: (workflowId: string, nodeId: string, decision: "approved" | "rejected", decidedBy: string, reason?: string) =>
    api<{ ok: boolean }>(`/approvals/${workflowId}/${nodeId}`, {
      method: "POST",
      body: JSON.stringify({ decision, decidedBy, reason }),
    }),
};

// ── Packs ───────────────────────────────────────────────
export const packs = {
  list: () =>
    api<{ packs: Pack[] }>("/packs"),

  get: (packId: string) =>
    api<{ pack: PackDetail }>(`/packs/${packId}`),

  searchByTag: (tag: string) =>
    api<{ results: WorkflowTemplate[] }>("/packs/search", { params: { tag } }),

  searchByEvent: (event: string) =>
    api<{ results: WorkflowTemplate[] }>("/packs/search", { params: { event } }),
};

// ── Stats (aggregated from other endpoints) ─────────────
export const stats = {
  dashboard: () =>
    api<DashboardStats>("/stats/dashboard"),
};

// ── Types ───────────────────────────────────────────────
export type WorkflowRun = {
  id: string;
  templateId: string;
  templateName: string;
  pack: string;
  packColor: string;
  status: "completed" | "running" | "waiting_approval" | "failed" | "cancelled" | "paused";
  trigger: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  costCents: number;
  nodeCount: number;
  nodesCompleted: number;
};

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  triggerEvent?: string;
  triggerSchedule?: string;
  estimatedCostCents: number;
  tags: string[];
  nodeCount: number;
};

export type WorkflowStatus = {
  phase: string;
  progress: number;
  nodeResults: Record<string, unknown>;
  error?: string;
};

export type PendingApproval = {
  nodeId: string;
  nodeName: string;
  requestedAt: string;
  expiresAt?: string;
  channels: string[];
  context: Record<string, unknown>;
};

export type PendingApprovalGroup = {
  workflowId: string;
  approvals: PendingApproval[];
};

export type Pack = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  requiredIntegrations: string[];
  workflowCount: number;
  workflows: { id: string; name: string; description: string; tags: string[]; estimatedCostCents: number }[];
};

export type PackDetail = Pack & {
  workflows: WorkflowTemplate[];
};

export type DashboardStats = {
  workflowsToday: number;
  workflowsTrend: string;
  approvalsPending: number;
  costToday: number;
  costBudget: number;
  successRate: number;
  recentRuns: WorkflowRun[];
  pendingApprovals: Array<{
    id: string;
    workflowId: string;
    workflowName: string;
    node: string;
    detail: string;
    pack: string;
    priority: string;
  }>;
  packStats: Array<{
    name: string;
    icon: string;
    color: string;
    workflows: number;
    runsToday: number;
  }>;
};
