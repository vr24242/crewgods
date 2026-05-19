// ═══════════════════════════════════════════════════════
// PACK ROUTES — Browse, search, and inspect workflow
// packs and their templates
// ═══════════════════════════════════════════════════════

import type { FastifyInstance } from "fastify";
import {
  allPacks,
  getPack,
  getWorkflowTemplate,
  getWorkflowsByTag,
  getWorkflowsByEvent,
} from "../../temporal/workflows/packs";

export async function packRoutes(app: FastifyInstance) {

  // ── List all packs ─────────────────────────────────
  // GET /api/packs
  app.get("/", async (_request, reply) => {
    const packs = allPacks.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      icon: p.icon,
      color: p.color,
      requiredIntegrations: p.requiredIntegrations,
      workflowCount: p.workflows.length,
      workflows: p.workflows.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        tags: w.tags,
        estimatedCostCents: w.estimatedCostCents,
      })),
    }));
    return reply.send({ packs });
  });

  // ── Get single pack details ────────────────────────
  // GET /api/packs/:packId
  app.get<{
    Params: { packId: string };
  }>("/:packId", async (request, reply) => {
    const pack = getPack(request.params.packId);
    if (!pack) {
      return reply.code(404).send({ error: `Pack not found: ${request.params.packId}` });
    }
    return reply.send({ pack });
  });

  // ── Get workflow template detail ───────────────────
  // GET /api/packs/workflow/:templateId
  app.get<{
    Params: { templateId: string };
  }>("/workflow/:templateId", async (request, reply) => {
    const template = getWorkflowTemplate(request.params.templateId);
    if (!template) {
      return reply.code(404).send({ error: `Template not found: ${request.params.templateId}` });
    }
    return reply.send({ template });
  });

  // ── Search workflows by tag ────────────────────────
  // GET /api/packs/search?tag=approval&event=invoice.received
  app.get<{
    Querystring: { tag?: string; event?: string };
  }>("/search", async (request, reply) => {
    const { tag, event } = request.query;

    let results = [];
    if (tag) {
      results = getWorkflowsByTag(tag);
    } else if (event) {
      results = getWorkflowsByEvent(event);
    } else {
      return reply.code(400).send({ error: "Provide ?tag= or ?event= parameter" });
    }

    return reply.send({
      results: results.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        triggerEvent: w.triggerEvent,
        tags: w.tags,
        estimatedCostCents: w.estimatedCostCents,
      })),
    });
  });
}
