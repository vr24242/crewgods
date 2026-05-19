import { db } from "@/db";
import { agents, tasks, runs, activityLog, tenants, integrations } from "@/db/schema";
import { eq, and, lte, isNull, sql } from "drizzle-orm";
import { executeAgent } from "./runner";
import { getPlaybook } from "./playbook-registry";
import { getToolsForAgent } from "./tool-router";
import { inngest } from "@/lib/inngest";
import type { AgentContext, RunResult } from "./types";

export async function runAgent(
  tenantId: string,
  agentId: string,
  trigger: string
): Promise<{ runId: string; status: string }> {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.tenantId, tenantId)));

  if (!agent || !agent.active) {
    return { runId: "", status: "skipped" };
  }

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) return { runId: "", status: "tenant_not_found" };

  if (
    agent.budgetMonthlyCents &&
    agent.budgetMonthlyCents > 0 &&
    (agent.spentMonthlyCents ?? 0) >= agent.budgetMonthlyCents
  ) {
    return { runId: "", status: "budget_exceeded" };
  }

  const [run] = await db
    .insert(runs)
    .values({
      tenantId,
      agentId,
      trigger,
      status: "running",
      model: agent.model ?? "sonnet",
      startedAt: new Date(),
    })
    .returning();

  try {
    const tenantIntegrations = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.active, true)));

    const intMap: Record<string, Record<string, unknown>> = {};
    for (const i of tenantIntegrations) {
      intMap[i.provider] = i.credentials as Record<string, unknown>;
    }

    const context: AgentContext = {
      tenantId,
      agentId: agent.id,
      agentName: agent.name,
      role: agent.role,
      integrations: intMap,
    };

    const tools = getToolsForAgent(agent.tools as string[], agent.playbook);

    const result = await executeAgent(
      agent.instructions,
      (agent.model ?? "sonnet") as "haiku" | "sonnet" | "opus",
      tools,
      context
    );

    await finalizeRun(run.id, tenantId, agentId, result);

    await db.insert(activityLog).values({
      tenantId,
      agentId,
      runId: run.id,
      action: "agent_run_completed",
      summary: result.response.slice(0, 500),
      metadata: {
        trigger,
        costCents: result.costCents,
        durationMs: result.durationMs,
        toolCallCount: result.toolCalls.length,
      },
    });

    return { runId: run.id, status: "succeeded" };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";

    await db
      .update(runs)
      .set({
        status: "failed",
        error: errorMsg,
        finishedAt: new Date(),
        durationMs: Date.now() - (run.startedAt?.getTime() ?? Date.now()),
      })
      .where(eq(runs.id, run.id));

    return { runId: run.id, status: "failed" };
  }
}

export async function runAgentTask(
  tenantId: string,
  agentId: string,
  taskId: string
): Promise<{ runId: string; status: string }> {
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));

  if (!task) return { runId: "", status: "task_not_found" };

  if (task.requiresApproval && !task.approvedAt) {
    await db
      .update(tasks)
      .set({ status: "awaiting_approval" })
      .where(eq(tasks.id, taskId));
    return { runId: "", status: "awaiting_approval" };
  }

  await db
    .update(tasks)
    .set({ status: "in_progress", startedAt: new Date() })
    .where(eq(tasks.id, taskId));

  const result = await runAgent(tenantId, agentId, "task_assigned");

  if (result.status === "succeeded") {
    await db
      .update(tasks)
      .set({ status: "done", completedAt: new Date() })
      .where(eq(tasks.id, taskId));
  } else {
    await db
      .update(tasks)
      .set({ status: "failed" })
      .where(eq(tasks.id, taskId));
  }

  return result;
}

export async function checkAndDispatchDueAgents() {
  const now = new Date();
  const dueAgents = await db
    .select()
    .from(agents)
    .where(and(eq(agents.active, true)));

  let dispatched = 0;

  for (const agent of dueAgents) {
    if (!agent.scheduleSeconds) continue;

    const lastRun = agent.lastRunAt?.getTime() ?? 0;
    const nextDue = lastRun + agent.scheduleSeconds * 1000;

    if (now.getTime() >= nextDue) {
      await inngest.send({
        name: "agent/heartbeat",
        data: {
          tenantId: agent.tenantId,
          agentId: agent.id,
          trigger: "scheduled",
        },
      });
      dispatched++;
    }
  }

  return { dispatched, checked: dueAgents.length };
}

async function finalizeRun(
  runId: string,
  tenantId: string,
  agentId: string,
  result: RunResult
) {
  await db
    .update(runs)
    .set({
      status: result.status,
      response: result.response,
      toolCalls: result.toolCalls,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cachedTokens: result.cachedTokens,
      costCents: result.costCents,
      durationMs: result.durationMs,
      finishedAt: new Date(),
    })
    .where(eq(runs.id, runId));

  await db
    .update(agents)
    .set({
      lastRunAt: new Date(),
      spentMonthlyCents: sql`${agents.spentMonthlyCents} + ${result.costCents}`,
    })
    .where(eq(agents.id, agentId));

  await db
    .update(tenants)
    .set({
      spentMonthlyCents: sql`${tenants.spentMonthlyCents} + ${result.costCents}`,
    })
    .where(eq(tenants.id, tenantId));
}
