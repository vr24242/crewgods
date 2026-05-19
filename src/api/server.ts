// ═══════════════════════════════════════════════════════
// API SERVER — HTTP layer for Crewgods
// Handles webhooks, workflow management, approvals,
// and dashboard queries
// ═══════════════════════════════════════════════════════

import Fastify from "fastify";
import cors from "@fastify/cors";
import { Connection, Client } from "@temporalio/client";
import { EventBus } from "../events/bus";
import { webhookRoutes } from "./routes/webhooks";
import { workflowRoutes } from "./routes/workflows";
import { approvalRoutes } from "./routes/approvals";
import { packRoutes } from "./routes/packs";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE ?? "default";

async function start() {
  // ── Temporal client ────────────────────────────────
  const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
  const temporalClient = new Client({ connection, namespace: TEMPORAL_NAMESPACE });

  // ── Event Bus ──────────────────────────────────────
  const eventBus = new EventBus(temporalClient);

  // ── Fastify ────────────────────────────────────────
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  // Decorate request context with shared deps
  app.decorate("temporal", temporalClient);
  app.decorate("eventBus", eventBus);

  // ── Routes ─────────────────────────────────────────
  await app.register(webhookRoutes, { prefix: "/webhooks" });
  await app.register(workflowRoutes, { prefix: "/api/workflows" });
  await app.register(approvalRoutes, { prefix: "/api/approvals" });
  await app.register(packRoutes, { prefix: "/api/packs" });

  // Health check
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // ── Start ──────────────────────────────────────────
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`🚀 Crewgods API running on port ${PORT}`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("⏳ Shutting down API...");
    await app.close();
    connection.close();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  console.error("💥 API failed to start:", err);
  process.exit(1);
});

// ── Type augmentation for Fastify ─────────────────────

declare module "fastify" {
  interface FastifyInstance {
    temporal: Client;
    eventBus: EventBus;
  }
}
