// ═══════════════════════════════════════════════════════
// WORKFLOW ROUTES — Start, query, pause, cancel workflows
// ═══════════════════════════════════════════════════════

import type { FastifyInstance } from "fastify";
import { executeWorkflow, type WorkflowDef } from "../../temporal/workflows/base";
import { instantiateWorkflow, getWorkflowTemplate, getAllWorkflowTemplates } from "../../temporal/workflows/packs";
import type { WorkflowStatus } from "../../temporal/signals";

const TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE ?? "crewgods-main";

export async function workflowRoutes(app: FastifyInstance) {

  // ── Start a workflow from a template ───────────────
  // POST /api/workflows/start
  app.post<{
    Body: { templateId: string; orgId: string; input: Record<string, unknown> };
  }>("/start", async (request, reply) => {
    const { templateId, orgId, input } = request.body;

    const template = getWorkflowTemplate(templateId);
    if (!template) {
      return reply.code(404).send({ error: `Template not found: ${templateId}` });
    }

    const def = instantiateWorkflow(template, orgId, input);

    const handle = await app.temporal.workflow.start(executeWorkflow, {
      taskQueue: TASK_QUEUE,
      workflowId: def.id,
      args: [def],
    });

    return reply.code(201).send({
      workflowId: def.id,
      runId: handle.firstExecutionRunId,
      templateId,
      name: template.name,
    });
  });

  // ── Start a custom workflow (not from template) ────
  // POST /api/workflows/start-custom
  app.post<{
    Body: { workflow: WorkflowDef };
  }>("/start-custom", async (request, reply) => {
    const { workflow } = request.body;

    const handle = await app.temporal.workflow.start(executeWorkflow, {
      taskQueue: TASK_QUEUE,
      workflowId: workflow.id,
      args: [workflow],
    });

    return reply.code(201).send({
      workflowId: workflow.id,
      runId: handle.firstExecutionRunId,
      name: workflow.name,
    });
  });

  // ── Get workflow status ────────────────────────────
  // GET /api/workflows/:workflowId/status
  app.get<{
    Params: { workflowId: string };
  }>("/:workflowId/status", async (request, reply) => {
    const { workflowId } = request.params;

    try {
      const handle = app.temporal.workflow.getHandle(workflowId);
      const status: WorkflowStatus = await handle.query("status");
      return reply.send(status);
    } catch (err) {
      return reply.code(404).send({ error: `Workflow not found: ${workflowId}` });
    }
  });

  // ── Pause a workflow ───────────────────────────────
  // POST /api/workflows/:workflowId/pause
  app.post<{
    Params: { workflowId: string };
  }>("/:workflowId/pause", async (request, reply) => {
    const { workflowId } = request.params;
    const handle = app.temporal.workflow.getHandle(workflowId);
    await handle.signal("pause");
    return reply.send({ ok: true, workflowId, action: "paused" });
  });

  // ── Resume a workflow ──────────────────────────────
  // POST /api/workflows/:workflowId/resume
  app.post<{
    Params: { workflowId: string };
  }>("/:workflowId/resume", async (request, reply) => {
    const { workflowId } = request.params;
    const handle = app.temporal.workflow.getHandle(workflowId);
    await handle.signal("resume");
    return reply.send({ ok: true, workflowId, action: "resumed" });
  });

  // ── Cancel a workflow ──────────────────────────────
  // POST /api/workflows/:workflowId/cancel
  app.post<{
    Params: { workflowId: string };
    Body: { reason?: string };
  }>("/:workflowId/cancel", async (request, reply) => {
    const { workflowId } = request.params;
    const reason = request.body?.reason ?? "Cancelled by user";
    const handle = app.temporal.workflow.getHandle(workflowId);
    await handle.signal("cancel", { reason });
    return reply.send({ ok: true, workflowId, action: "cancelled" });
  });

  // ── Get workflow result (completed workflows) ──────
  // GET /api/workflows/:workflowId/result
  app.get<{
    Params: { workflowId: string };
  }>("/:workflowId/result", async (request, reply) => {
    const { workflowId } = request.params;

    try {
      const handle = app.temporal.workflow.getHandle(workflowId);
      const result = await handle.result();
      return reply.send({ workflowId, result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({ error: msg });
    }
  });

  // ── List available workflow templates ───────────────
  // GET /api/workflows/templates
  app.get("/templates", async (_request, reply) => {
    const templates = getAllWorkflowTemplates().map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      triggerEvent: t.triggerEvent,
      triggerSchedule: t.triggerSchedule,
      estimatedCostCents: t.estimatedCostCents,
      tags: t.tags,
      nodeCount: t.nodes.length,
    }));
    return reply.send({ templates });
  });
}
