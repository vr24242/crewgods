// ═══════════════════════════════════════════════════════
// BASE WORKFLOW — Generic workflow executor
// Takes a workflow definition and executes it as a
// durable Temporal workflow with signals for approvals
// ═══════════════════════════════════════════════════════

import {
  proxyActivities,
  setHandler,
  condition,
  sleep,
  ApplicationFailure,
} from "@temporalio/workflow";
import type {
  ApprovalDecision,
  WorkflowStatus,
  NodeRunStatus,
  PendingApproval,
} from "../signals/index";
import {
  approvalSignal,
  cancelSignal,
  pauseSignal,
  resumeSignal,
  statusQuery,
  approvalListQuery,
} from "../signals/index";

// ── Activity Proxies ──────────────────────────────────
// Temporal bundles workflows separately — activities are
// proxied with retry/timeout config

import type * as aiActivities from "../activities/ai";
import type * as integrationActivities from "../activities/integrations";
import type * as approvalActivities from "../activities/approvals";

const ai = proxyActivities<typeof aiActivities>({
  startToCloseTimeout: "120s",
  retry: { maximumAttempts: 3, initialInterval: "2s", backoffCoefficient: 2 },
});

const integrations = proxyActivities<typeof integrationActivities>({
  startToCloseTimeout: "60s",
  retry: { maximumAttempts: 3, initialInterval: "1s", backoffCoefficient: 2 },
});

const approvals = proxyActivities<typeof approvalActivities>({
  startToCloseTimeout: "30s",
  retry: { maximumAttempts: 2, initialInterval: "1s" },
});

// ── Workflow Node Definition ──────────────────────────

export interface WorkflowNodeDef {
  id: string;
  name: string;
  type: "fetch" | "ai_classify" | "ai_decide" | "ai_generate" | "ai_extract" | "ai_summarize" | "action" | "approval" | "condition" | "loop" | "wait" | "emit";
  config: Record<string, unknown>;
  dependsOn?: string[];        // node IDs that must complete first
}

export interface WorkflowEdgeDef {
  from: string;
  to: string;
  condition?: {
    field: string;
    operator: "eq" | "neq" | "gt" | "lt" | "contains";
    value: unknown;
  };
}

export interface WorkflowDef {
  id: string;
  name: string;
  orgId: string;
  pack: string;               // "finance", "hr", "ops", "support", "custom"
  nodes: WorkflowNodeDef[];
  edges: WorkflowEdgeDef[];
  input: Record<string, unknown>;
}

// ── The Workflow ──────────────────────────────────────

export async function executeWorkflow(def: WorkflowDef): Promise<Record<string, unknown>> {
  // ── State ────────────────────────────────────────────
  const nodeOutputs: Record<string, unknown> = {};
  const nodeStatuses: Record<string, NodeRunStatus> = {};
  const pendingApprovalsList: PendingApproval[] = [];
  const approvalDecisions: Record<string, ApprovalDecision> = {};
  let currentStep = "initializing";
  let paused = false;
  let cancelled = false;
  let totalCostCents = 0;
  const startedAt = new Date().toISOString();

  // Initialize all nodes as pending
  for (const node of def.nodes) {
    nodeStatuses[node.id] = { status: "pending", costCents: 0 };
  }

  // ── Signal Handlers ──────────────────────────────────

  setHandler(approvalSignal, (decision: ApprovalDecision) => {
    approvalDecisions[decision.nodeId] = decision;
  });

  setHandler(cancelSignal, ({ reason }) => {
    cancelled = true;
  });

  setHandler(pauseSignal, () => { paused = true; });
  setHandler(resumeSignal, () => { paused = false; });

  // ── Query Handlers ───────────────────────────────────

  setHandler(statusQuery, (): WorkflowStatus => ({
    workflowId: def.id,
    runId: "", // filled by Temporal
    status: cancelled ? "cancelled" : paused ? "paused" : pendingApprovalsList.length > 0 ? "waiting_approval" : "running",
    currentStep,
    progress: calculateProgress(nodeStatuses, def.nodes.length),
    startedAt,
    nodeStatuses,
    pendingApprovals: pendingApprovalsList,
    costCents: totalCostCents,
  }));

  setHandler(approvalListQuery, () => pendingApprovalsList);

  // ── Execute DAG ──────────────────────────────────────

  const executed = new Set<string>();

  while (executed.size < def.nodes.length) {
    if (cancelled) throw ApplicationFailure.nonRetryable("Workflow cancelled");

    // Wait while paused
    if (paused) {
      await condition(() => !paused, "24h");
    }

    // Find nodes ready to execute (all dependencies met)
    const ready = def.nodes.filter((n) => {
      if (executed.has(n.id)) return false;
      if (nodeStatuses[n.id].status === "skipped") return false;

      // Check dependencies
      const deps = n.dependsOn ?? getIncomingNodes(def.edges, n.id);
      return deps.every((depId) => {
        const depStatus = nodeStatuses[depId]?.status;
        if (depStatus === "completed" || depStatus === "skipped") {
          // Also check edge conditions
          const edge = def.edges.find((e) => e.from === depId && e.to === n.id);
          if (edge?.condition) {
            return evaluateCondition(nodeOutputs[depId], edge.condition);
          }
          return true;
        }
        return false;
      });
    });

    if (ready.length === 0) {
      // Check if we're stuck (all remaining nodes have unmet conditions)
      const remaining = def.nodes.filter((n) => !executed.has(n.id) && nodeStatuses[n.id].status !== "skipped");
      if (remaining.length > 0) {
        // Mark unreachable nodes as skipped
        for (const node of remaining) {
          nodeStatuses[node.id].status = "skipped";
          executed.add(node.id);
        }
      }
      break;
    }

    // Execute ready nodes in parallel
    await Promise.all(ready.map(async (node) => {
      currentStep = node.name;
      nodeStatuses[node.id] = { ...nodeStatuses[node.id], status: "running", startedAt: new Date().toISOString() };

      try {
        const output = await executeNode(node, nodeOutputs, def, approvalDecisions, pendingApprovalsList);
        nodeOutputs[node.id] = output;
        nodeStatuses[node.id] = { ...nodeStatuses[node.id], status: "completed", completedAt: new Date().toISOString(), output, costCents: (output as any)?.costCents ?? 0 };
        totalCostCents += (output as any)?.costCents ?? 0;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        nodeStatuses[node.id] = { ...nodeStatuses[node.id], status: "failed", error: errorMsg };
        // Don't throw — let other branches continue
      }

      executed.add(node.id);
    }));
  }

  currentStep = "completed";
  return nodeOutputs;
}

// ── Node Executor ────────────────────────────────────

async function executeNode(
  node: WorkflowNodeDef,
  outputs: Record<string, unknown>,
  def: WorkflowDef,
  approvalDecisions: Record<string, ApprovalDecision>,
  pendingApprovalsList: PendingApproval[],
): Promise<unknown> {
  const config = resolveConfig(node.config, outputs, def.input);

  switch (node.type) {
    case "fetch":
      return integrations.fetchIntegrationData({
        orgId: def.orgId,
        provider: config.provider as string,
        operation: config.operation as string,
        params: config.params as Record<string, unknown> ?? {},
      });

    case "ai_classify":
      return ai.classify({
        text: config.text as string,
        categories: config.categories as string[],
        context: config.context as Record<string, unknown>,
        model: config.model as "haiku" | "sonnet" | "opus",
      });

    case "ai_decide":
      return ai.decide({
        question: config.question as string,
        options: config.options as string[],
        context: config.context as Record<string, unknown>,
        criteria: config.criteria as string,
        model: config.model as "haiku" | "sonnet" | "opus",
      });

    case "ai_generate":
      return ai.generate({
        instructions: config.instructions as string,
        context: config.context as Record<string, unknown>,
        outputFormat: config.outputFormat as string,
        model: config.model as "haiku" | "sonnet" | "opus",
      });

    case "ai_extract":
      return ai.extract({
        text: config.text as string,
        fields: config.fields as Array<{ name: string; type: string; description: string }>,
        model: config.model as "haiku" | "sonnet" | "opus",
      });

    case "ai_summarize":
      return ai.summarize({
        text: config.text as string,
        maxLength: config.maxLength as number,
        style: config.style as "executive" | "detailed" | "bullet_points",
        model: config.model as "haiku" | "sonnet" | "opus",
      });

    case "action": {
      const actionType = config.action as string;
      if (actionType === "send_slack") return integrations.sendSlackMessage({ orgId: def.orgId, ...(config as any) });
      if (actionType === "send_email") return integrations.sendEmail({ orgId: def.orgId, ...(config as any) });
      if (actionType === "send_whatsapp") return integrations.sendWhatsApp({ orgId: def.orgId, ...(config as any) });
      if (actionType === "update_crm") return integrations.updateCRM({ orgId: def.orgId, ...(config as any) });
      if (actionType === "create_task") return integrations.createTask({ orgId: def.orgId, ...(config as any) });
      throw new Error(`Unknown action: ${actionType}`);
    }

    case "approval": {
      const result = await approvals.sendApprovalRequest({
        orgId: def.orgId,
        workflowRunId: def.id,
        nodeId: node.id,
        title: config.title as string,
        description: config.description as string ?? "",
        context: config.context as Record<string, unknown> ?? {},
        channels: config.channels as any[] ?? ["dashboard", "slack"],
        assignTo: config.assignTo as string[],
        priority: config.priority as any ?? "medium",
        expiresInMinutes: config.expiresInMinutes as number,
      });

      pendingApprovalsList.push({
        nodeId: node.id,
        title: config.title as string,
        description: config.description as string ?? "",
        requestedAt: new Date().toISOString(),
        expiresAt: config.expiresInMinutes ? new Date(Date.now() + (config.expiresInMinutes as number) * 60000).toISOString() : undefined,
        channels: config.channels as string[] ?? ["dashboard"],
        context: config.context as Record<string, unknown> ?? {},
      });

      // Wait for approval signal (up to expiry or 24h default)
      const timeoutMinutes = (config.expiresInMinutes as number) ?? 1440;
      const timeoutStr = `${timeoutMinutes}m`;
      const gotDecision = await condition(() => approvalDecisions[node.id] !== undefined, timeoutStr as any);

      // Remove from pending
      const idx = pendingApprovalsList.findIndex((a) => a.nodeId === node.id);
      if (idx >= 0) pendingApprovalsList.splice(idx, 1);

      if (!gotDecision) {
        throw ApplicationFailure.nonRetryable(`Approval timed out for node ${node.id}`);
      }

      const decision = approvalDecisions[node.id];
      if (decision.decision === "rejected") {
        throw ApplicationFailure.nonRetryable(`Approval rejected: ${decision.reason ?? "no reason given"}`);
      }

      return { approved: true, ...decision };
    }

    case "condition":
      // Conditions are handled by edge evaluation, just pass through
      return resolveConfig(node.config, outputs, def.input);

    case "loop": {
      const items = config.items as unknown[];
      if (!items || !Array.isArray(items)) return { results: [] };
      const results: unknown[] = [];
      for (const item of items) {
        // Each iteration is its own mini-execution
        outputs[`${node.id}_currentItem`] = item;
        results.push(item);
      }
      return { results, count: items.length };
    }

    case "wait": {
      const durationMs = (config.durationSeconds as number ?? 60) * 1000;
      await sleep(durationMs);
      return { waited: true, duration: config.durationSeconds };
    }

    case "emit":
      // Emit an event that can trigger other workflows
      return { emitted: config.eventType, data: config.data };

    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

// ── Helpers ───────────────────────────────────────────

function getIncomingNodes(edges: WorkflowEdgeDef[], nodeId: string): string[] {
  return edges.filter((e) => e.to === nodeId).map((e) => e.from);
}

function evaluateCondition(output: unknown, cond: { field: string; operator: string; value: unknown }): boolean {
  const val = getNestedValue(output, cond.field);
  switch (cond.operator) {
    case "eq": return val === cond.value;
    case "neq": return val !== cond.value;
    case "gt": return (val as number) > (cond.value as number);
    case "lt": return (val as number) < (cond.value as number);
    case "contains": return typeof val === "string" && val.includes(cond.value as string);
    default: return true;
  }
}

function resolveConfig(config: Record<string, unknown>, outputs: Record<string, unknown>, input: Record<string, unknown>): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string" && value.startsWith("{{") && value.endsWith("}}")) {
      const path = value.slice(2, -2).trim();
      if (path.startsWith("input.")) {
        resolved[key] = getNestedValue(input, path.slice(6));
      } else if (path.startsWith("trigger.")) {
        resolved[key] = getNestedValue(input, path.slice(8));
      } else {
        // Resolve from node outputs: "nodeId.field.path"
        const [nodeId, ...rest] = path.split(".");
        resolved[key] = getNestedValue(outputs[nodeId], rest.join("."));
      }
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || !path) return obj;
  return path.split(".").reduce((curr: any, key) => curr?.[key], obj);
}

function calculateProgress(statuses: Record<string, NodeRunStatus>, total: number): number {
  const completed = Object.values(statuses).filter((s) => s.status === "completed" || s.status === "skipped").length;
  return Math.round((completed / total) * 100);
}
