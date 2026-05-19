// ═══════════════════════════════════════════════════════
// TEMPORAL WORKER — Boots the Temporal worker process
// Registers workflows + activities, connects to server
// ═══════════════════════════════════════════════════════

import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities-bundle";

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE ?? "default";
const TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE ?? "crewgods-main";

async function run() {
  console.log(`🚀 Starting Crewgods Temporal worker...`);
  console.log(`   Address:    ${TEMPORAL_ADDRESS}`);
  console.log(`   Namespace:  ${TEMPORAL_NAMESPACE}`);
  console.log(`   Task Queue: ${TASK_QUEUE}`);

  // ── Connect to Temporal server ──────────────────────
  const connection = await NativeConnection.connect({
    address: TEMPORAL_ADDRESS,
  });

  // ── Create worker ───────────────────────────────────
  // Workflows are bundled separately by Temporal (they
  // run in a sandboxed V8 isolate). Activities run in
  // the main Node.js process.
  const worker = await Worker.create({
    connection,
    namespace: TEMPORAL_NAMESPACE,
    taskQueue: TASK_QUEUE,
    workflowsPath: require.resolve("../workflows/base"),
    activities,
    maxConcurrentActivityTaskExecutions: 50,
    maxConcurrentWorkflowTaskExecutions: 20,
  });

  console.log(`✅ Worker connected and listening on queue: ${TASK_QUEUE}`);

  // ── Graceful shutdown ───────────────────────────────
  const shutdown = async () => {
    console.log("⏳ Shutting down worker...");
    worker.shutdown();
    // Worker.run() will resolve after all in-flight tasks complete
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // ── Run (blocks until shutdown) ─────────────────────
  await worker.run();
  await connection.close();
  console.log("👋 Worker shut down cleanly");
}

run().catch((err) => {
  console.error("💥 Worker failed to start:", err);
  process.exit(1);
});
