// ═══════════════════════════════════════════════════════
// TEMPORAL SIGNALS & QUERIES
// Shared between workflows and the API/client layer
// ═══════════════════════════════════════════════════════

import { defineSignal, defineQuery } from "@temporalio/workflow";

// ── Approval Signals ──────────────────────────────────

export interface ApprovalDecision {
  nodeId: string;
  decision: "approved" | "rejected";
  decidedBy: string;           // user ID or email
  decidedAt: string;           // ISO 8601
  reason?: string;
  channel: "dashboard" | "slack" | "whatsapp" | "email";
}

export const approvalSignal = defineSignal<[ApprovalDecision]>("approval");

// ── Workflow Control Signals ──────────────────────────

export const cancelSignal = defineSignal<[{ reason: string; cancelledBy: string }]>("cancel");
export const pauseSignal = defineSignal("pause");
export const resumeSignal = defineSignal("resume");

// ── Data Input Signals (for workflows waiting on data) ─

export interface DataInput {
  nodeId: string;
  data: unknown;
  providedBy: string;
}

export const dataInputSignal = defineSignal<[DataInput]>("dataInput");

// ── Queries ───────────────────────────────────────────

export interface WorkflowStatus {
  workflowId: string;
  runId: string;
  status: "running" | "waiting_approval" | "paused" | "completed" | "failed" | "cancelled";
  currentStep: string;
  progress: number;            // 0-100
  startedAt: string;
  completedAt?: string;
  nodeStatuses: Record<string, NodeRunStatus>;
  pendingApprovals: PendingApproval[];
  costCents: number;
  error?: string;
}

export interface NodeRunStatus {
  status: "pending" | "running" | "completed" | "failed" | "skipped" | "waiting_approval";
  startedAt?: string;
  completedAt?: string;
  output?: unknown;
  error?: string;
  costCents: number;
}

export interface PendingApproval {
  nodeId: string;
  title: string;
  description: string;
  requestedAt: string;
  expiresAt?: string;
  channels: string[];          // where the approval request was sent
  context: Record<string, unknown>;
}

export const statusQuery = defineQuery<WorkflowStatus>("status");
export const approvalListQuery = defineQuery<PendingApproval[]>("pendingApprovals");
