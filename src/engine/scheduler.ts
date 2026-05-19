import { inngest } from "@/lib/inngest";

export const scheduleHeartbeat = inngest.createFunction(
  {
    id: "agent-heartbeat",
    retries: 2,
    concurrency: [{ limit: 5, key: "event.data.tenantId" }],
  },
  { event: "agent/heartbeat" },
  async ({ event, step }) => {
    const { tenantId, agentId, trigger } = event.data;

    const result = await step.run("execute-agent", async () => {
      const { runAgent } = await import("./orchestrator");
      return runAgent(tenantId, agentId, trigger);
    });

    return result;
  }
);

export const scheduledCron = inngest.createFunction(
  {
    id: "agent-scheduled-cron",
    retries: 1,
  },
  { cron: "*/5 * * * *" }, // every 5 minutes, check for agents due
  async ({ step }) => {
    await step.run("check-due-agents", async () => {
      const { checkAndDispatchDueAgents } = await import("./orchestrator");
      return checkAndDispatchDueAgents();
    });
  }
);

export const taskTrigger = inngest.createFunction(
  {
    id: "task-assigned",
    retries: 2,
  },
  { event: "task/assigned" },
  async ({ event, step }) => {
    const { tenantId, agentId, taskId } = event.data;

    await step.run("run-task", async () => {
      const { runAgentTask } = await import("./orchestrator");
      return runAgentTask(tenantId, agentId, taskId);
    });
  }
);
