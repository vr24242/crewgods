import type {
  WorkflowDAG,
  WorkflowNode,
  WorkflowEdge,
  EdgeCondition,
  DataRef,
  NodeConfig,
} from "./types";

// ── Workflow Execution State ────────────────────────────

export interface ExecutionState {
  workflowId: string;
  runId: string;
  tenantId?: string;
  status: "running" | "completed" | "failed" | "paused" | "waiting_approval";
  triggerData: Record<string, unknown>;
  nodeOutputs: Record<string, unknown>;
  nodeStatuses: Record<string, NodeStatus>;
  currentNodes: string[];
  startedAt: string;
  completedAt?: string;
  error?: string;
  totalCostCents: number;
  pendingApprovals: Array<{ nodeId: string; issueId?: string; requestedAt: string }>;
}

export type NodeStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "waiting_approval"
  | "approved"
  | "rejected";

// ── DAG Topology Helpers ────────────────────────────────

export function getStartNodes(dag: WorkflowDAG): string[] {
  const targets = new Set(dag.edges.map((e) => e.to));
  return dag.nodes.filter((n) => !targets.has(n.id)).map((n) => n.id);
}

export function getOutgoingEdges(dag: WorkflowDAG, nodeId: string): WorkflowEdge[] {
  return dag.edges.filter((e) => e.from === nodeId);
}

export function getNode(dag: WorkflowDAG, nodeId: string): WorkflowNode | undefined {
  return dag.nodes.find((n) => n.id === nodeId);
}

export function getIncomingEdges(dag: WorkflowDAG, nodeId: string): WorkflowEdge[] {
  return dag.edges.filter((e) => e.to === nodeId);
}

// ── Condition Evaluation ────────────────────────────────

export function evaluateCondition(
  condition: EdgeCondition | undefined,
  nodeOutput: unknown,
  state?: ExecutionState
): boolean {
  if (!condition) return true;

  switch (condition.type) {
    case "always":
      return true;

    case "output_equals":
      return getNestedValue(nodeOutput, condition.field) === condition.value;

    case "output_gt":
      return (getNestedValue(nodeOutput, condition.field) as number) > condition.value;

    case "output_lt":
      return (getNestedValue(nodeOutput, condition.field) as number) < condition.value;

    case "output_contains": {
      const val = getNestedValue(nodeOutput, condition.field);
      if (typeof val === "string") return val.includes(condition.value);
      if (Array.isArray(val)) return val.includes(condition.value);
      return false;
    }

    case "output_matches": {
      const val = getNestedValue(nodeOutput, condition.field);
      if (typeof val !== "string") return false;
      return new RegExp(condition.pattern).test(val);
    }

    case "approved": {
      const decision = getNestedValue(nodeOutput, "decision");
      return decision === "approved";
    }

    case "rejected": {
      const decision = getNestedValue(nodeOutput, "decision");
      return decision === "rejected";
    }

    case "error":
      return false;

    case "expression":
      try {
        const fn = new Function("output", "state", `return (${condition.expr})`);
        return !!fn(nodeOutput, state);
      } catch {
        return false;
      }

    default:
      return true;
  }
}

// ── Data Resolution ─────────────────────────────────────

export function resolveInputMap(
  inputMap: Record<string, DataRef>,
  state: ExecutionState,
  integrationData?: Record<string, unknown>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, ref] of Object.entries(inputMap)) {
    resolved[key] = resolveDataRef(ref, state, integrationData);
  }

  return resolved;
}

export function resolveDataRef(
  ref: DataRef,
  state: ExecutionState,
  integrationData?: Record<string, unknown>
): unknown {
  switch (ref.source) {
    case "trigger":
      return getNestedValue(state.triggerData, ref.path);

    case "node":
      return getNestedValue(state.nodeOutputs[ref.nodeId], ref.path);

    case "integration":
      return getNestedValue(integrationData?.[ref.provider], ref.path);

    case "static":
      return ref.value;

    case "env":
      return process.env[ref.key];

    case "template":
      return interpolateTemplate(ref.template, state);

    default:
      return undefined;
  }
}

// ── Execution Plan ──────────────────────────────────────

export function buildExecutionPlan(dag: WorkflowDAG): string[][] {
  const levels: string[][] = [];
  const visited = new Set<string>();
  const inDegree = new Map<string, number>();

  for (const node of dag.nodes) {
    inDegree.set(node.id, 0);
  }
  for (const edge of dag.edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  let queue = dag.nodes
    .filter((n) => (inDegree.get(n.id) ?? 0) === 0)
    .map((n) => n.id);

  while (queue.length > 0) {
    levels.push([...queue]);
    const nextQueue: string[] = [];

    for (const nodeId of queue) {
      visited.add(nodeId);
      for (const edge of getOutgoingEdges(dag, nodeId)) {
        const newDegree = (inDegree.get(edge.to) ?? 1) - 1;
        inDegree.set(edge.to, newDegree);
        if (newDegree === 0 && !visited.has(edge.to)) {
          nextQueue.push(edge.to);
        }
      }
    }

    queue = nextQueue;
  }

  return levels;
}

// ── Validation ──────────────────────────────────────────

export interface ValidationError {
  nodeId?: string;
  edgeIndex?: number;
  message: string;
  severity: "error" | "warning";
}

export function validateDAG(dag: WorkflowDAG): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeIds = new Set(dag.nodes.map((n) => n.id));

  // Check for duplicate node IDs
  const seen = new Set<string>();
  for (const node of dag.nodes) {
    if (seen.has(node.id)) {
      errors.push({ nodeId: node.id, message: `Duplicate node ID: ${node.id}`, severity: "error" });
    }
    seen.add(node.id);
  }

  // Check edges reference valid nodes
  for (let i = 0; i < dag.edges.length; i++) {
    const edge = dag.edges[i];
    if (!nodeIds.has(edge.from)) {
      errors.push({ edgeIndex: i, message: `Edge references unknown source node: ${edge.from}`, severity: "error" });
    }
    if (!nodeIds.has(edge.to)) {
      errors.push({ edgeIndex: i, message: `Edge references unknown target node: ${edge.to}`, severity: "error" });
    }
  }

  // Check for cycles (simple DFS)
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const edge of getOutgoingEdges(dag, nodeId)) {
      if (hasCycle(edge.to)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }

  for (const node of dag.nodes) {
    if (hasCycle(node.id)) {
      errors.push({ nodeId: node.id, message: "Cycle detected in workflow DAG", severity: "error" });
      break;
    }
  }

  // Check start nodes exist
  const startNodes = getStartNodes(dag);
  if (startNodes.length === 0) {
    errors.push({ message: "No start nodes found (all nodes have incoming edges)", severity: "error" });
  }

  // Check approval nodes have both approved/rejected edges
  for (const node of dag.nodes) {
    if (node.type === "approval") {
      const outEdges = getOutgoingEdges(dag, node.id);
      const hasApproved = outEdges.some((e) => e.condition?.type === "approved");
      const hasRejected = outEdges.some((e) => e.condition?.type === "rejected");
      if (!hasApproved) {
        errors.push({ nodeId: node.id, message: "Approval node missing 'approved' edge", severity: "warning" });
      }
      if (!hasRejected) {
        errors.push({ nodeId: node.id, message: "Approval node missing 'rejected' edge", severity: "warning" });
      }
    }
  }

  return errors;
}

// ── Helpers ─────────────────────────────────────────────

function getNestedValue(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return undefined;
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function interpolateTemplate(template: string, state: ExecutionState): string {
  return template.replace(/\{\{(\w+)\.([^}]+)\}\}/g, (_, source, path) => {
    let data: unknown;
    if (source === "trigger") {
      data = getNestedValue(state.triggerData, path);
    } else {
      data = getNestedValue(state.nodeOutputs[source], path);
    }
    return data !== undefined ? String(data) : "";
  });
}
