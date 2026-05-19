// ═══════════════════════════════════════════════════════
// APPROVAL ROUTES — Dashboard approval management
// List pending, approve/reject, view history
// ═══════════════════════════════════════════════════════

import type { FastifyInstance } from "fastify";
import type { PendingApproval } from "../../temporal/signals";

export async function approvalRoutes(app: FastifyInstance) {

  // ── Get pending approvals for a workflow ────────────
  // GET /api/approvals/:workflowId
  app.get<{
    Params: { workflowId: string };
  }>("/:workflowId", async (request, reply) => {
    const { workflowId } = request.params;

    try {
      const handle = app.temporal.workflow.getHandle(workflowId);
      const pending: PendingApproval[] = await handle.query("pendingApprovals");
      return reply.send({ workflowId, pending });
    } catch (err) {
      return reply.code(404).send({ error: `Workflow not found: ${workflowId}` });
    }
  });

  // ── Submit an approval decision ────────────────────
  // POST /api/approvals/:workflowId/:nodeId
  app.post<{
    Params: { workflowId: string; nodeId: string };
    Body: { decision: "approved" | "rejected"; decidedBy: string; reason?: string };
  }>("/:workflowId/:nodeId", async (request, reply) => {
    const { workflowId, nodeId } = request.params;
    const { decision, decidedBy, reason } = request.body;

    try {
      const handle = app.temporal.workflow.getHandle(workflowId);
      await handle.signal("approval", {
        nodeId,
        decision,
        decidedBy,
        decidedAt: new Date().toISOString(),
        reason: reason ?? "",
        channel: "dashboard",
      });

      return reply.send({ ok: true, workflowId, nodeId, decision });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({ error: msg });
    }
  });

  // ── List all pending approvals across workflows ────
  // GET /api/approvals?orgId=xxx
  // This queries Temporal's visibility API to find
  // workflows in "waiting_approval" state
  app.get<{
    Querystring: { orgId?: string };
  }>("/", async (request, reply) => {
    const orgId = request.query.orgId;

    try {
      // Use Temporal's workflow list to find running workflows
      // and query each for pending approvals
      const pendingAll: Array<{ workflowId: string; approvals: PendingApproval[] }> = [];

      // Search for running workflows with approval status
      const query = orgId
        ? `ExecutionStatus = "Running" AND WorkflowType = "executeWorkflow"`
        : `ExecutionStatus = "Running" AND WorkflowType = "executeWorkflow"`;

      for await (const workflow of app.temporal.workflow.list({ query })) {
        try {
          const handle = app.temporal.workflow.getHandle(workflow.workflowId);
          const pending: PendingApproval[] = await handle.query("pendingApprovals");
          if (pending.length > 0) {
            pendingAll.push({ workflowId: workflow.workflowId, approvals: pending });
          }
        } catch {
          // Skip workflows that can't be queried
        }
      }

      return reply.send({ pending: pendingAll });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: msg });
    }
  });
}
