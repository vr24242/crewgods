// ═══════════════════════════════════════════════════════
// WEBHOOK ROUTES — Receives events from external
// services, normalizes them, feeds the event bus
// ═══════════════════════════════════════════════════════

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export async function webhookRoutes(app: FastifyInstance) {
  // ── Generic webhook receiver ───────────────────────
  // POST /webhooks/:provider/:orgId
  // Receives raw webhook from any integrated service
  app.post<{
    Params: { provider: string; orgId: string };
  }>("/:provider/:orgId", async (request, reply) => {
    const { provider, orgId } = request.params;
    const rawPayload = request.body as Record<string, unknown>;

    try {
      // Determine the raw event type from the payload
      const rawEventType = (rawPayload as any).type ?? (rawPayload as any).event ?? (rawPayload as any).topic ?? provider;

      // Normalize the external webhook into a CrewgodsEvent
      const event = app.eventBus.normalizeWebhook(provider, rawEventType, rawPayload, orgId);

      // Route to matching workflow subscriptions
      await app.eventBus.emit(event.type, event.source, event.orgId, event.payload, event.metadata);

      return reply.code(200).send({
        ok: true,
        eventId: event.id,
        eventType: event.type,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      request.log.error({ provider, orgId, err: msg }, "Webhook processing failed");
      return reply.code(400).send({ ok: false, error: msg });
    }
  });

  // ── Slack interactive payloads ─────────────────────
  // Slack sends interactive button clicks here
  app.post("/slack/interactions", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    // Slack sends form-encoded payload
    const payloadStr = typeof body.payload === "string" ? body.payload : JSON.stringify(body);
    const payload = JSON.parse(payloadStr);

    if (payload.type === "block_actions") {
      for (const action of payload.actions ?? []) {
        // Approval buttons have action_id like "approve_<workflowRunId>_<nodeId>"
        const [actionType, workflowRunId, nodeId] = (action.action_id as string).split("_");

        if ((actionType === "approve" || actionType === "reject") && workflowRunId && nodeId) {
          // Send approval signal to the running Temporal workflow
          const handle = app.temporal.workflow.getHandle(workflowRunId);
          await handle.signal("approval", {
            nodeId,
            decision: actionType === "approve" ? "approved" : "rejected",
            decidedBy: payload.user?.name ?? "unknown",
            decidedAt: new Date().toISOString(),
            reason: action.value ?? "",
            channel: "slack",
          });
        }
      }
    }

    // Slack expects 200 OK with empty body for acknowledgement
    return reply.code(200).send();
  });

  // ── Email approval link handler ────────────────────
  // GET /webhooks/email/approve/:workflowRunId/:nodeId/:decision
  app.get<{
    Params: { workflowRunId: string; nodeId: string; decision: string };
    Querystring: { token?: string };
  }>("/email/approve/:workflowRunId/:nodeId/:decision", async (request, reply) => {
    const { workflowRunId, nodeId, decision } = request.params;

    // TODO: Validate token for security
    try {
      const handle = app.temporal.workflow.getHandle(workflowRunId);
      await handle.signal("approval", {
        nodeId,
        decision: decision === "approve" ? "approved" : "rejected",
        decidedBy: "email",
        decidedAt: new Date().toISOString(),
        reason: "",
        channel: "email",
      });

      // Redirect to dashboard with success message
      return reply.redirect(`${process.env.DASHBOARD_URL ?? "http://localhost:3000"}/approvals?status=success&workflow=${workflowRunId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.redirect(`${process.env.DASHBOARD_URL ?? "http://localhost:3000"}/approvals?status=error&message=${encodeURIComponent(msg)}`);
    }
  });

  // ── WhatsApp webhook verification ──────────────────
  // Meta requires GET verification for webhook setup
  app.get<{
    Querystring: { "hub.mode"?: string; "hub.verify_token"?: string; "hub.challenge"?: string };
  }>("/whatsapp/:orgId", async (request, reply) => {
    const mode = request.query["hub.mode"];
    const token = request.query["hub.verify_token"];
    const challenge = request.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return reply.code(200).send(challenge);
    }
    return reply.code(403).send("Forbidden");
  });

  // WhatsApp incoming messages (approval responses)
  app.post<{ Params: { orgId: string } }>("/whatsapp/:orgId", async (request, reply) => {
    const payload = request.body as any;
    const entry = payload?.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (message?.interactive?.type === "button_reply") {
      const buttonId = message.interactive.button_reply.id;
      // Button IDs: "approve_<workflowRunId>_<nodeId>" or "reject_<workflowRunId>_<nodeId>"
      const [actionType, workflowRunId, nodeId] = buttonId.split("_");

      if ((actionType === "approve" || actionType === "reject") && workflowRunId && nodeId) {
        const handle = app.temporal.workflow.getHandle(workflowRunId);
        await handle.signal("approval", {
          nodeId,
          decision: actionType === "approve" ? "approved" : "rejected",
          decidedBy: message.from ?? "whatsapp_user",
          decidedAt: new Date().toISOString(),
          reason: "",
          channel: "whatsapp",
        });
      }
    }

    return reply.code(200).send();
  });
}
