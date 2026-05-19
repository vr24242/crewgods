export interface PlaybookDefinition {
  id: string;
  name: string;
  description: string;
  industry: string;
  icon: string;
  color: string;
  requiredIntegrations: IntegrationDef[];
  agents: AgentTemplate[];
  onboardingQuestions: OnboardingQuestion[];
}

export interface IntegrationDef {
  provider: string;
  name: string;
  description: string;
  requiredScopes?: string[];
}

export interface AgentTemplate {
  name: string;
  role: string;
  instructions: string;
  tools: string[];
  model: "haiku" | "sonnet" | "opus";
  schedule?: ScheduleDef;
  trigger?: TriggerDef;
  requiresApproval?: string[];
}

export interface ScheduleDef {
  type: "interval" | "cron";
  value: string; // "4h", "daily-9am", cron expression
  intervalSeconds: number;
}

export interface TriggerDef {
  event: string; // "new_order", "new_ticket", etc.
  filter?: Record<string, unknown>;
}

export interface OnboardingQuestion {
  id: string;
  label: string;
  type: "text" | "select" | "oauth";
  placeholder?: string;
  options?: { label: string; value: string }[];
  required: boolean;
}

export interface AgentContext {
  tenantId: string;
  agentId: string;
  agentName: string;
  role: string;
  taskId?: string;
  taskTitle?: string;
  taskDescription?: string;
  integrations: Record<string, Record<string, unknown>>;
  previousRuns?: RunSummary[];
}

export interface RunSummary {
  id: string;
  status: string;
  response?: string;
  createdAt: Date;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>, context: AgentContext) => Promise<unknown>;
}

export interface RunResult {
  status: "succeeded" | "failed";
  response: string;
  toolCalls: unknown[];
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costCents: number;
  durationMs: number;
}
