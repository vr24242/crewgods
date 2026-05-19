// ── Core Workflow DAG Types ─────────────────────────────
// Every vertical defines workflows as DAGs of nodes.
// The engine traverses the DAG, executing each node via
// Paperclip's heartbeat system.

export interface WorkflowDAG {
  id: string;
  name: string;
  vertical: string;
  description: string;
  version: string;
  trigger: WorkflowTrigger;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  errorHandler: ErrorHandler;
  metadata: WorkflowMetadata;
}

// ── Triggers ────────────────────────────────────────────

export type WorkflowTrigger =
  | ScheduleTrigger
  | WebhookTrigger
  | EventTrigger
  | ManualTrigger;

export interface ScheduleTrigger {
  type: "schedule";
  cron: string; // "0 */4 * * *" = every 4 hours
  timezone?: string;
}

export interface WebhookTrigger {
  type: "webhook";
  provider: string; // shopify, zendesk, github, etc.
  event: string; // orders/create, ticket.created, etc.
  filter?: Record<string, unknown>; // optional event filtering
}

export interface EventTrigger {
  type: "event";
  source: string; // internal event from another workflow
  event: string;
  filter?: Record<string, unknown>;
}

export interface ManualTrigger {
  type: "manual";
  inputSchema: Record<string, unknown>; // JSON Schema for manual input
}

// ── Nodes ───────────────────────────────────────────────

export interface WorkflowNode {
  id: string;
  name: string;
  type: NodeType;
  config: NodeConfig;
  agent?: AgentAssignment; // which agent handles this node
  timeout?: number; // seconds
  retries?: number;
}

export type NodeType =
  | "fetch"      // pull data from integration
  | "transform"  // process/filter/enrich data
  | "ai_decide"  // LLM makes a decision based on data
  | "ai_generate"// LLM generates content/output
  | "action"     // execute an action (send email, update record)
  | "approval"   // human-in-the-loop gate
  | "branch"     // conditional routing
  | "parallel"   // fan-out to multiple nodes
  | "aggregate"  // collect results from parallel nodes
  | "emit"       // emit event for other workflows
  | "wait"       // pause until condition met
  | "loop";      // iterate over a collection

export interface NodeConfig {
  // What integration/tool to use
  integration?: string;
  operation?: string;
  // Input mapping: how to build this node's input from prior outputs
  inputMap: Record<string, DataRef>;
  // Output schema: what this node produces
  outputSchema?: Record<string, unknown>;
  // Node-specific config
  params?: Record<string, unknown>;
}

export interface AgentAssignment {
  role: string; // maps to agent name/role in the vertical
  model: "haiku" | "sonnet" | "opus";
  instructions?: string; // additional per-node instructions
}

// ── Edges ───────────────────────────────────────────────

export interface WorkflowEdge {
  from: string; // node id
  to: string;   // node id
  condition?: EdgeCondition;
  label?: string;
}

export type EdgeCondition =
  | { type: "always" }
  | { type: "output_equals"; field: string; value: unknown }
  | { type: "output_gt"; field: string; value: number }
  | { type: "output_lt"; field: string; value: number }
  | { type: "output_contains"; field: string; value: string }
  | { type: "output_matches"; field: string; pattern: string }
  | { type: "approved" }
  | { type: "rejected" }
  | { type: "error" }
  | { type: "expression"; expr: string }; // JS expression against node outputs

// ── Data References ─────────────────────────────────────
// How nodes reference data from triggers or prior nodes

export type DataRef =
  | { source: "trigger"; path: string }
  | { source: "node"; nodeId: string; path: string }
  | { source: "integration"; provider: string; path: string }
  | { source: "static"; value: unknown }
  | { source: "env"; key: string }
  | { source: "template"; template: string }; // "Hello {{trigger.customer.name}}"

// ── Error Handling ──────────────────────────────────────

export interface ErrorHandler {
  onNodeFailure: "skip" | "retry" | "abort" | "escalate";
  maxRetries: number;
  retryDelaySeconds: number;
  escalateTo?: string; // agent role to escalate to
  notifyChannel?: string; // slack channel
  fallbackWorkflow?: string; // workflow ID to trigger on failure
}

// ── Metadata ────────────────────────────────────────────

export interface WorkflowMetadata {
  estimatedDurationMs: number;
  estimatedCostCents: number;
  tags: string[];
  requiredIntegrations: string[];
  requiredApprovals: string[];
  sla?: {
    maxDurationMs: number;
    alertAfterMs: number;
  };
}

// ── Vertical Definition ─────────────────────────────────
// A vertical bundles multiple workflows + agent templates

export interface VerticalDefinition {
  id: string;
  name: string;
  description: string;
  industry: string;
  icon: string;
  color: string;
  agents: VerticalAgent[];
  workflows: WorkflowDAG[];
  integrations: IntegrationRequirement[];
  onboarding: OnboardingStep[];
}

export interface VerticalAgent {
  name: string;
  role: string;
  systemPrompt: string;
  defaultModel: "haiku" | "sonnet" | "opus";
  tools: string[];
  schedule?: string; // cron expression
  budgetMonthlyCents: number;
}

export interface IntegrationRequirement {
  provider: string;
  name: string;
  description: string;
  scopes: string[];
  webhooks?: string[]; // webhook events to subscribe to
}

export interface OnboardingStep {
  id: string;
  type: "oauth" | "input" | "select" | "confirm";
  label: string;
  description?: string;
  required: boolean;
  config?: Record<string, unknown>;
}
