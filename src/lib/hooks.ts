"use client";

// ═══════════════════════════════════════════════════════
// DASHBOARD HOOKS — SWR-based data fetching with
// optimistic updates, polling, and error handling
// ═══════════════════════════════════════════════════════

import useSWR, { mutate as globalMutate } from "swr";
import {
  workflows,
  approvals,
  packs,
  stats,
  type WorkflowRun,
  type WorkflowTemplate,
  type PendingApprovalGroup,
  type Pack,
  type DashboardStats,
} from "./api";

// ── Generic fetcher (SWR calls with key → fn mapping) ───

// ── Dashboard overview stats ────────────────────────────
export function useDashboardStats() {
  const { data, error, isLoading, mutate } = useSWR<DashboardStats>(
    "/stats/dashboard",
    () => stats.dashboard(),
    { refreshInterval: 15000, revalidateOnFocus: true }
  );
  return { stats: data, error, isLoading, refresh: mutate };
}

// ── Workflow runs (list) ────────────────────────────────
export function useWorkflowRuns() {
  const { data, error, isLoading, mutate } = useSWR<{ workflows: WorkflowRun[] }>(
    "/workflows",
    () => workflows.list(),
    { refreshInterval: 10000 }
  );
  return {
    runs: data?.workflows ?? [],
    error,
    isLoading,
    refresh: mutate,
  };
}

// ── Workflow templates ──────────────────────────────────
export function useWorkflowTemplates() {
  const { data, error, isLoading } = useSWR<{ templates: WorkflowTemplate[] }>(
    "/workflows/templates",
    () => workflows.templates(),
    { revalidateOnFocus: false }
  );
  return {
    templates: data?.templates ?? [],
    error,
    isLoading,
  };
}

// ── Single workflow status (polling) ────────────────────
export function useWorkflowStatus(workflowId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    workflowId ? `/workflows/${workflowId}/status` : null,
    () => (workflowId ? workflows.status(workflowId) : null),
    { refreshInterval: 3000 }
  );
  return { status: data, error, isLoading, refresh: mutate };
}

// ── Pending approvals ───────────────────────────────────
export function useApprovals(orgId?: string) {
  const { data, error, isLoading, mutate } = useSWR<{ pending: PendingApprovalGroup[] }>(
    `/approvals?org=${orgId ?? "all"}`,
    () => approvals.listAll(orgId),
    { refreshInterval: 10000 }
  );

  const decide = async (
    workflowId: string,
    nodeId: string,
    decision: "approved" | "rejected",
    decidedBy: string,
    reason?: string
  ) => {
    await approvals.decide(workflowId, nodeId, decision, decidedBy, reason);
    // Revalidate approvals + dashboard stats
    mutate();
    globalMutate("/stats/dashboard");
  };

  return {
    groups: data?.pending ?? [],
    error,
    isLoading,
    decide,
    refresh: mutate,
  };
}

// ── Packs ───────────────────────────────────────────────
export function usePacks() {
  const { data, error, isLoading } = useSWR<{ packs: Pack[] }>(
    "/packs",
    () => packs.list(),
    { revalidateOnFocus: false }
  );
  return {
    packs: data?.packs ?? [],
    error,
    isLoading,
  };
}

// ── Workflow actions ────────────────────────────────────
export function useWorkflowActions() {
  const startWorkflow = async (templateId: string, orgId: string, input?: Record<string, unknown>) => {
    const result = await workflows.start(templateId, orgId, input ?? {});
    // Revalidate workflow list + stats
    globalMutate("/workflows");
    globalMutate("/stats/dashboard");
    return result;
  };

  const pauseWorkflow = async (workflowId: string) => {
    await workflows.pause(workflowId);
    globalMutate(`/workflows/${workflowId}/status`);
    globalMutate("/workflows");
  };

  const resumeWorkflow = async (workflowId: string) => {
    await workflows.resume(workflowId);
    globalMutate(`/workflows/${workflowId}/status`);
    globalMutate("/workflows");
  };

  const cancelWorkflow = async (workflowId: string, reason?: string) => {
    await workflows.cancel(workflowId, reason);
    globalMutate(`/workflows/${workflowId}/status`);
    globalMutate("/workflows");
    globalMutate("/stats/dashboard");
  };

  return { startWorkflow, pauseWorkflow, resumeWorkflow, cancelWorkflow };
}
