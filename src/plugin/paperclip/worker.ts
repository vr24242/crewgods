import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { PluginContext, PluginEvent, PluginJobContext } from "@paperclipai/plugin-sdk";
import { verticals, getVertical, getAllWorkflows, getWorkflowById } from "../verticals/index";
import { validateDAG, buildExecutionPlan } from "../workflows/engine";
import type { WorkflowDAG } from "../workflows/types";
import { WorkflowRunner } from "./runner";

const plugin = definePlugin({
  async setup(ctx: PluginContext) {
    ctx.logger.info("CrewGods workflow engine starting", { verticals: verticals.length, workflows: getAllWorkflows().length });

    registerTools(ctx);
    registerJobs(ctx);
    registerEventHandlers(ctx);
    registerDataHandlers(ctx);
    registerActionHandlers(ctx);

    ctx.logger.info("CrewGods setup complete");
  },

  async onHealth() {
    const workflows = getAllWorkflows();
    const invalid = workflows.filter((w) => validateDAG(w).length > 0);
    if (invalid.length > 0) {
      return { status: "degraded", message: `${invalid.length} workflows have validation errors`, details: { invalidWorkflows: invalid.map((w) => w.id) } };
    }
    return { status: "ok", message: `${workflows.length} workflows across ${verticals.length} verticals`, details: { verticals: verticals.map((v) => v.id), workflowCount: workflows.length } };
  },

  async onConfigChanged(newConfig) {
    const enabled = (newConfig.enabledVerticals as string[]) ?? [];
    // Re-validate only enabled verticals
    for (const id of enabled) {
      const v = getVertical(id);
      if (!v) continue;
      for (const w of v.workflows) {
        const errors = validateDAG(w);
        if (errors.length > 0) {
          // Log but don't block — validation errors are surfaced via health
        }
      }
    }
  },

  async onValidateConfig(config) {
    const enabled = (config.enabledVerticals as string[]) ?? [];
    const errors: string[] = [];
    const warnings: string[] = [];

    if (enabled.length === 0) {
      errors.push("At least one vertical must be enabled");
    }

    for (const id of enabled) {
      if (!getVertical(id)) {
        errors.push(`Unknown vertical: ${id}. Available: ${verticals.map((v) => v.id).join(", ")}`);
      }
    }

    if (config.monthlyBudgetCents != null && (config.monthlyBudgetCents as number) < 100) {
      warnings.push("Monthly budget below $1.00 — most workflows cost $0.01-$0.30 per run");
    }

    return { ok: errors.length === 0, errors: errors.length > 0 ? errors : undefined, warnings: warnings.length > 0 ? warnings : undefined };
  },

  async onWebhook(input) {
    // Webhook routing handled in registerEventHandlers via ctx.events
    // This is the fallback for direct webhook hits
  },
});

function registerTools(ctx: PluginContext) {
  ctx.tools.register(
    "crewgods_list_verticals",
    { displayName: "List Verticals", description: "List all available CrewGods vertical modules", parametersSchema: { type: "object", properties: {} } },
    async () => ({
      content: JSON.stringify(
        verticals.map((v) => ({ id: v.id, name: v.name, description: v.description, workflowCount: v.workflows.length, agentCount: v.agents.length, integrations: v.integrations.map((i) => i.provider) })),
      ),
    }),
  );

  ctx.tools.register(
    "crewgods_list_workflows",
    {
      displayName: "List Workflows",
      description: "List available workflows, optionally filtered by vertical",
      parametersSchema: { type: "object", properties: { verticalId: { type: "string", description: "Filter by vertical ID" } } },
    },
    async (params) => {
      const { verticalId } = params as { verticalId?: string };
      let workflows = getAllWorkflows();
      if (verticalId) {
        workflows = workflows.filter((w) => w.vertical === verticalId);
      }
      return {
        content: JSON.stringify(
          workflows.map((w) => ({
            id: w.id,
            name: w.name,
            vertical: w.vertical,
            description: w.description,
            trigger: w.trigger.type,
            nodeCount: w.nodes.length,
            estimatedCostCents: w.metadata.estimatedCostCents,
            requiredIntegrations: w.metadata.requiredIntegrations,
          })),
        ),
      };
    },
  );

  ctx.tools.register(
    "crewgods_run_workflow",
    {
      displayName: "Run Workflow",
      description: "Manually trigger a workflow by ID",
      parametersSchema: {
        type: "object",
        properties: {
          workflowId: { type: "string", description: "Workflow ID to run" },
          triggerData: { type: "object", description: "Data to pass as trigger context" },
        },
        required: ["workflowId"],
      },
    },
    async (params, runCtx) => {
      const { workflowId, triggerData } = params as { workflowId: string; triggerData?: Record<string, unknown> };
      const workflow = getWorkflowById(workflowId);
      if (!workflow) {
        return { error: `Workflow not found: ${workflowId}` };
      }

      const runner = new WorkflowRunner(ctx, runCtx.companyId);
      const runId = await runner.startRun(workflow, triggerData ?? {});

      return { content: JSON.stringify({ runId, workflowId, status: "started" }) };
    },
  );

  ctx.tools.register(
    "crewgods_get_run_status",
    {
      displayName: "Get Run Status",
      description: "Check the status of a workflow run",
      parametersSchema: { type: "object", properties: { runId: { type: "string" } }, required: ["runId"] },
    },
    async (params, runCtx) => {
      const { runId } = params as { runId: string };
      const state = await ctx.state.get({ scopeKind: "company", scopeId: runCtx.companyId, stateKey: `run:${runId}` });
      if (!state) {
        return { error: `Run not found: ${runId}` };
      }
      return { content: JSON.stringify(state) };
    },
  );

  ctx.tools.register(
    "crewgods_approve_node",
    {
      displayName: "Approve Node",
      description: "Approve or reject a pending approval node",
      parametersSchema: {
        type: "object",
        properties: {
          runId: { type: "string" },
          nodeId: { type: "string" },
          decision: { type: "string", enum: ["approved", "rejected"] },
          reason: { type: "string" },
        },
        required: ["runId", "nodeId", "decision"],
      },
    },
    async (params, runCtx) => {
      const { runId, nodeId, decision, reason } = params as { runId: string; nodeId: string; decision: "approved" | "rejected"; reason?: string };
      const runner = new WorkflowRunner(ctx, runCtx.companyId);
      await runner.resolveApproval(runId, nodeId, decision, reason);
      return { content: JSON.stringify({ runId, nodeId, decision, status: "resolved" }) };
    },
  );
}

function registerJobs(ctx: PluginContext) {
  ctx.jobs.register("workflow-scheduler", async (job: PluginJobContext) => {
    ctx.logger.info("Running workflow scheduler", { runId: job.runId });

    const companies = await ctx.companies.list();
    for (const company of companies) {
      const config = await ctx.state.get({ scopeKind: "company", scopeId: company.id, stateKey: "crewgods:config" }) as Record<string, unknown> | null;
      if (!config) continue;

      const enabled = (config.enabledVerticals as string[]) ?? [];
      const workflows = getAllWorkflows().filter((w) => enabled.includes(w.vertical) && w.trigger.type === "schedule");

      for (const workflow of workflows) {
        if (workflow.trigger.type !== "schedule") continue;
        const lastRun = await ctx.state.get({ scopeKind: "company", scopeId: company.id, stateKey: `lastRun:${workflow.id}` }) as string | null;
        if (shouldRunCron(workflow.trigger.cron, lastRun)) {
          ctx.logger.info("Dispatching scheduled workflow", { workflowId: workflow.id, companyId: company.id });
          const runner = new WorkflowRunner(ctx, company.id);
          await runner.startRun(workflow, { scheduledAt: new Date().toISOString() });
          await ctx.state.set({ scopeKind: "company", scopeId: company.id, stateKey: `lastRun:${workflow.id}` }, new Date().toISOString());
        }
      }
    }

    await ctx.telemetry.track("scheduler_tick", { companiesChecked: companies.length });
  });

  ctx.jobs.register("workflow-cleanup", async (job: PluginJobContext) => {
    ctx.logger.info("Running workflow cleanup", { runId: job.runId });
    // Clean up runs older than 30 days, expired approvals, etc.
  });
}

function registerEventHandlers(ctx: PluginContext) {
  ctx.events.on("issue.updated", async (event: PluginEvent) => {
    // When an issue (used as approval) is resolved, check if it's a pending workflow approval
    if (event.payload && typeof event.payload === "object") {
      const payload = event.payload as Record<string, unknown>;
      if (payload.status === "done" || payload.status === "cancelled") {
        const approvalMeta = await ctx.state.get({ scopeKind: "issue", scopeId: event.entityId ?? "", stateKey: "crewgods:approval" }) as { runId: string; nodeId: string } | null;
        if (approvalMeta) {
          const decision = payload.status === "done" ? "approved" : "rejected";
          const runner = new WorkflowRunner(ctx, event.companyId);
          await runner.resolveApproval(approvalMeta.runId, approvalMeta.nodeId, decision as "approved" | "rejected");
        }
      }
    }
  });
}

function registerDataHandlers(ctx: PluginContext) {
  ctx.data.register("verticals", async () => {
    return verticals.map((v) => ({
      id: v.id,
      name: v.name,
      description: v.description,
      icon: v.icon,
      color: v.color,
      workflowCount: v.workflows.length,
      agentCount: v.agents.length,
    }));
  });

  ctx.data.register("workflows", async (params) => {
    const verticalId = params.verticalId as string | undefined;
    let workflows = getAllWorkflows();
    if (verticalId) workflows = workflows.filter((w) => w.vertical === verticalId);
    return workflows.map((w) => ({
      id: w.id,
      name: w.name,
      vertical: w.vertical,
      description: w.description,
      triggerType: w.trigger.type,
      nodeCount: w.nodes.length,
      estimatedCostCents: w.metadata.estimatedCostCents,
      tags: w.metadata.tags,
    }));
  });

  ctx.data.register("run-history", async (params) => {
    const companyId = params.companyId as string;
    const runs = await ctx.state.get({ scopeKind: "company", scopeId: companyId, stateKey: "crewgods:recentRuns" });
    return runs ?? [];
  });

  ctx.data.register("health", async () => {
    const workflows = getAllWorkflows();
    return {
      status: "ok",
      verticals: verticals.length,
      workflows: workflows.length,
      checkedAt: new Date().toISOString(),
    };
  });
}

function registerActionHandlers(ctx: PluginContext) {
  ctx.actions.register("run-workflow", async (params) => {
    const { workflowId, companyId, triggerData } = params as { workflowId: string; companyId: string; triggerData?: Record<string, unknown> };
    const workflow = getWorkflowById(workflowId);
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

    const runner = new WorkflowRunner(ctx, companyId);
    const runId = await runner.startRun(workflow, triggerData ?? {});
    return { runId, status: "started" };
  });

  ctx.actions.register("enable-vertical", async (params) => {
    const { companyId, verticalId } = params as { companyId: string; verticalId: string };
    const vertical = getVertical(verticalId);
    if (!vertical) throw new Error(`Unknown vertical: ${verticalId}`);

    const config = (await ctx.state.get({ scopeKind: "company", scopeId: companyId, stateKey: "crewgods:config" }) as Record<string, unknown>) ?? {};
    const enabled = new Set((config.enabledVerticals as string[]) ?? []);
    enabled.add(verticalId);
    config.enabledVerticals = [...enabled];
    await ctx.state.set({ scopeKind: "company", scopeId: companyId, stateKey: "crewgods:config" }, config);

    return { verticalId, enabled: true, totalEnabled: enabled.size };
  });
}

function shouldRunCron(cron: string, lastRun: string | null): boolean {
  if (!lastRun) return true;
  const lastRunTime = new Date(lastRun).getTime();
  const now = Date.now();
  const parts = cron.split(" ");
  if (parts.length !== 5) return false;

  let intervalMs = 5 * 60 * 1000; // default 5 min

  if (parts[0].startsWith("*/")) {
    intervalMs = parseInt(parts[0].slice(2), 10) * 60 * 1000;
  } else if (parts[1].startsWith("*/")) {
    intervalMs = parseInt(parts[1].slice(2), 10) * 60 * 60 * 1000;
  } else if (parts[0] === "0" && /^\d+$/.test(parts[1])) {
    intervalMs = 24 * 60 * 60 * 1000; // daily
  }

  return now - lastRunTime >= intervalMs * 0.9;
}

export default plugin;
runWorker(plugin, import.meta.url);
