import type { PluginContext } from "@paperclipai/plugin-sdk";
import type { WorkflowDAG, WorkflowNode, WorkflowEdge } from "../workflows/types";
import { getStartNodes, getOutgoingEdges, evaluateCondition, resolveInputMap, validateDAG } from "../workflows/engine";
import type { ExecutionState } from "../workflows/engine";
import { callClaude } from "./ai-bridge";

export class WorkflowRunner {
  private ctx: PluginContext;
  private companyId: string;

  constructor(ctx: PluginContext, companyId: string) {
    this.ctx = ctx;
    this.companyId = companyId;
  }

  async startRun(workflow: WorkflowDAG, triggerData: Record<string, unknown>): Promise<string> {
    const errors = validateDAG(workflow);
    if (errors.length > 0) {
      throw new Error(`Workflow validation failed: ${errors.join(", ")}`);
    }

    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const state: ExecutionState = {
      runId,
      workflowId: workflow.id,
      status: "running",
      triggerData,
      nodeOutputs: {},
      nodeStatuses: {},
      currentNodes: [],
      startedAt: new Date().toISOString(),
      totalCostCents: 0,
      pendingApprovals: [],
    };

    for (const node of workflow.nodes) {
      state.nodeStatuses[node.id] = "pending";
    }

    await this.saveState(runId, state);

    await this.ctx.activity.log({
      companyId: this.companyId,
      message: `Workflow started: ${workflow.name} (${workflow.id})`,
      entityType: "workflow_run",
      entityId: runId,
      metadata: { workflowId: workflow.id, vertical: workflow.vertical },
    });

    await this.ctx.telemetry.track("workflow_started", { workflowId: workflow.id, vertical: workflow.vertical });

    try {
      await this.executeDAG(workflow, state);
    } catch (err) {
      state.status = "failed";
      state.error = err instanceof Error ? err.message : String(err);
      await this.saveState(runId, state);
      await this.handleError(workflow, state, err);
    }

    return runId;
  }

  private async executeDAG(workflow: WorkflowDAG, state: ExecutionState): Promise<void> {
    const startNodes = getStartNodes(workflow);
    await this.executeNodes(workflow, state, startNodes);
  }

  private async executeNodes(workflow: WorkflowDAG, state: ExecutionState, nodeIds: string[]): Promise<void> {
    if (nodeIds.length === 0) {
      if (this.isComplete(state, workflow)) {
        state.status = "completed";
        state.completedAt = new Date().toISOString();
        await this.saveState(state.runId, state);
        await this.ctx.telemetry.track("workflow_completed", {
          workflowId: workflow.id,
          durationMs: Date.now() - new Date(state.startedAt).getTime(),
          costCents: state.totalCostCents,
        });
      }
      return;
    }

    const parallelGroups = this.groupParallelNodes(workflow, nodeIds);

    for (const group of parallelGroups) {
      const results = await Promise.allSettled(
        group.map((nodeId) => this.executeNode(workflow, state, nodeId)),
      );

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const nodeId = group[i];
        if (result.status === "rejected") {
          state.nodeStatuses[nodeId] = "failed";
          const node = workflow.nodes.find((n) => n.id === nodeId);
          await this.handleNodeFailure(workflow, state, nodeId, result.reason);
          if (workflow.errorHandler.onNodeFailure === "abort") {
            state.status = "failed";
            state.error = `Node ${nodeId} failed: ${result.reason}`;
            await this.saveState(state.runId, state);
            return;
          }
        }
      }
    }

    if (state.status === "waiting_approval") {
      await this.saveState(state.runId, state);
      return;
    }

    const nextNodes = this.getNextExecutableNodes(workflow, state);
    if (nextNodes.length > 0) {
      await this.executeNodes(workflow, state, nextNodes);
    } else {
      state.status = "completed";
      state.completedAt = new Date().toISOString();
      await this.saveState(state.runId, state);
    }
  }

  private async executeNode(workflow: WorkflowDAG, state: ExecutionState, nodeId: string): Promise<void> {
    const node = workflow.nodes.find((n) => n.id === nodeId);
    if (!node) throw new Error(`Node not found: ${nodeId}`);

    state.nodeStatuses[nodeId] = "running";
    state.currentNodes.push(nodeId);
    await this.saveState(state.runId, state);

    this.ctx.logger.info("Executing node", { runId: state.runId, nodeId, type: node.type });

    let retries = 0;
    const maxRetries = node.retries ?? workflow.errorHandler.maxRetries;

    while (true) {
      try {
        const inputs = node.config?.inputMap ? resolveInputMap(node.config.inputMap, state) : {};
        const output = await this.runNodeByType(node, inputs, state, workflow);

        state.nodeOutputs[nodeId] = output;
        state.nodeStatuses[nodeId] = "completed";
        state.currentNodes = state.currentNodes.filter((id) => id !== nodeId);
        await this.saveState(state.runId, state);
        return;
      } catch (err) {
        retries++;
        if (retries > maxRetries) throw err;
        this.ctx.logger.warn("Node failed, retrying", { nodeId, retry: retries, maxRetries });
        await sleep(workflow.errorHandler.retryDelaySeconds * 1000);
      }
    }
  }

  private async runNodeByType(node: WorkflowNode, inputs: Record<string, unknown>, state: ExecutionState, workflow: WorkflowDAG): Promise<unknown> {
    switch (node.type) {
      case "fetch":
        return this.executeFetchNode(node, inputs);
      case "transform":
        return inputs;
      case "ai_decide":
      case "ai_generate":
        return this.executeAINode(node, inputs, state);
      case "action":
        return this.executeActionNode(node, inputs);
      case "approval":
        return this.executeApprovalNode(node, inputs, state);
      case "branch":
        return inputs;
      case "loop":
        return this.executeLoopNode(node, inputs, state, workflow);
      case "parallel":
        return inputs;
      case "aggregate":
        return inputs;
      case "emit":
        return this.executeEmitNode(node, inputs);
      case "wait":
        return this.executeWaitNode(node);
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  private async executeFetchNode(node: WorkflowNode, inputs: Record<string, unknown>): Promise<unknown> {
    const integration = node.config?.integration as string;
    const operation = node.config?.operation as string;

    const response = await this.ctx.http.fetch(`https://api.crewgods.com/integrations/${integration}/${operation}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: this.companyId, params: inputs }),
    });

    if (!response.ok) {
      throw new Error(`Integration call failed: ${integration}.${operation} (${response.status})`);
    }

    return response.json();
  }

  private async executeAINode(node: WorkflowNode, inputs: Record<string, unknown>, state: ExecutionState): Promise<unknown> {
    if (!node.agent) throw new Error(`AI node ${node.id} has no agent config`);

    const result = await callClaude(this.ctx, {
      model: node.agent.model,
      role: node.agent.role,
      instructions: node.agent.instructions,
      inputs,
      companyId: this.companyId,
    });

    state.totalCostCents += result.costCents;
    await this.ctx.metrics.write("ai_node_cost_cents", result.costCents, { workflowId: state.workflowId, nodeId: node.id, model: node.agent.model });

    return result.output;
  }

  private async executeActionNode(node: WorkflowNode, inputs: Record<string, unknown>): Promise<unknown> {
    const integration = node.config?.integration as string;
    const operation = node.config?.operation as string;

    const response = await this.ctx.http.fetch(`https://api.crewgods.com/integrations/${integration}/${operation}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: this.companyId, params: inputs }),
    });

    return response.json();
  }

  private async executeApprovalNode(node: WorkflowNode, inputs: Record<string, unknown>, state: ExecutionState): Promise<unknown> {
    const title = (inputs.title as string) ?? `Approval required: ${node.name}`;
    const description = (inputs.description as string) ?? "";

    const issue = await this.ctx.issues.create({
      companyId: this.companyId,
      title,
      description: `**Workflow:** ${state.workflowId}\n**Run:** ${state.runId}\n**Node:** ${node.id}\n\n${description}`,
      priority: "high",
    });

    await this.ctx.state.set({ scopeKind: "issue", scopeId: issue.id, stateKey: "crewgods:approval" }, { runId: state.runId, nodeId: node.id });

    state.nodeStatuses[node.id] = "waiting_approval";
    state.status = "waiting_approval";
    state.pendingApprovals.push({ nodeId: node.id, issueId: issue.id, requestedAt: new Date().toISOString() });

    await this.ctx.activity.log({
      companyId: this.companyId,
      message: `Approval requested: ${title}`,
      entityType: "workflow_approval",
      entityId: state.runId,
      metadata: { nodeId: node.id, issueId: issue.id },
    });

    return { status: "pending", issueId: issue.id };
  }

  private async executeLoopNode(node: WorkflowNode, inputs: Record<string, unknown>, state: ExecutionState, workflow: WorkflowDAG): Promise<unknown> {
    const items = inputs.items as unknown[];
    if (!items || !Array.isArray(items)) return { results: [] };

    const itemNodeId = node.config?.params?.itemNode as string;
    const itemNode = workflow.nodes.find((n) => n.id === itemNodeId);
    if (!itemNode) throw new Error(`Loop item node not found: ${itemNodeId}`);

    const results: unknown[] = [];
    for (let i = 0; i < items.length; i++) {
      state.nodeOutputs[node.id] = { ...state.nodeOutputs[node.id] as Record<string, unknown>, currentItem: items[i], currentIndex: i };
      await this.saveState(state.runId, state);

      const itemInputs = itemNode.config?.inputMap ? resolveInputMap(itemNode.config.inputMap, state) : {};
      const result = await this.runNodeByType(itemNode, itemInputs, state, workflow);
      results.push(result);
      state.nodeStatuses[itemNodeId] = "completed";
      state.nodeOutputs[itemNodeId] = result;
    }

    return { results, count: items.length };
  }

  private async executeEmitNode(node: WorkflowNode, inputs: Record<string, unknown>): Promise<unknown> {
    const eventName = inputs.event as string;
    const data = inputs.data;

    await this.ctx.events.emit(eventName, this.companyId, data);
    return { emitted: eventName };
  }

  private async executeWaitNode(node: WorkflowNode): Promise<unknown> {
    const durationMs = (node.timeout ?? 60) * 1000;
    await sleep(Math.min(durationMs, 30000));
    return { waited: true };
  }

  async resolveApproval(runId: string, nodeId: string, decision: "approved" | "rejected", reason?: string): Promise<void> {
    const state = await this.loadState(runId);
    if (!state) throw new Error(`Run not found: ${runId}`);

    const approval = state.pendingApprovals.find((a) => a.nodeId === nodeId);
    if (!approval) throw new Error(`No pending approval for node: ${nodeId}`);

    state.nodeOutputs[nodeId] = { decision, reason, resolvedAt: new Date().toISOString() };
    state.nodeStatuses[nodeId] = "completed";
    state.pendingApprovals = state.pendingApprovals.filter((a) => a.nodeId !== nodeId);

    if (state.pendingApprovals.length === 0) {
      state.status = "running";
    }

    await this.saveState(runId, state);

    await this.ctx.activity.log({
      companyId: this.companyId,
      message: `Approval ${decision}: ${nodeId}`,
      entityType: "workflow_approval",
      entityId: runId,
      metadata: { nodeId, decision, reason },
    });

    // Resume DAG execution from this node's successors
    const workflow = getWorkflowById(state.workflowId);
    if (workflow && state.status === "running") {
      const nextNodes = this.getNextExecutableNodes(workflow, state);
      if (nextNodes.length > 0) {
        await this.executeNodes(workflow, state, nextNodes);
      }
    }
  }

  private getNextExecutableNodes(workflow: WorkflowDAG, state: ExecutionState): string[] {
    const ready: string[] = [];

    for (const node of workflow.nodes) {
      if (state.nodeStatuses[node.id] !== "pending") continue;

      const incomingEdges = workflow.edges.filter((e) => e.to === node.id);
      if (incomingEdges.length === 0) continue;

      const allDependenciesMet = incomingEdges.some((edge) => {
        const fromStatus = state.nodeStatuses[edge.from];
        if (fromStatus !== "completed") return false;
        if (edge.condition) {
          const fromOutput = state.nodeOutputs[edge.from] as Record<string, unknown> | undefined;
          return evaluateCondition(edge.condition, fromOutput ?? {});
        }
        return true;
      });

      if (allDependenciesMet) {
        ready.push(node.id);
      }
    }

    return ready;
  }

  private groupParallelNodes(workflow: WorkflowDAG, nodeIds: string[]): string[][] {
    // Simple grouping: nodes that share no edges between them can run in parallel
    return [nodeIds]; // For now, run all provided nodes together
  }

  private isComplete(state: ExecutionState, workflow: WorkflowDAG): boolean {
    return workflow.nodes.every(
      (n) => state.nodeStatuses[n.id] === "completed" || state.nodeStatuses[n.id] === "skipped" || state.nodeStatuses[n.id] === "failed",
    );
  }

  private async handleNodeFailure(workflow: WorkflowDAG, state: ExecutionState, nodeId: string, error: unknown): Promise<void> {
    const errorMsg = error instanceof Error ? error.message : String(error);
    this.ctx.logger.error("Node failed", { runId: state.runId, nodeId, error: errorMsg });

    if (workflow.errorHandler.notifyChannel) {
      await this.ctx.activity.log({
        companyId: this.companyId,
        message: `Node failed: ${nodeId} in ${workflow.name} — ${errorMsg}`,
        entityType: "workflow_error",
        entityId: state.runId,
      });
    }

    if (workflow.errorHandler.onNodeFailure === "skip") {
      state.nodeStatuses[nodeId] = "skipped";
    }
  }

  private async handleError(workflow: WorkflowDAG, state: ExecutionState, error: unknown): Promise<void> {
    const errorMsg = error instanceof Error ? error.message : String(error);
    this.ctx.logger.error("Workflow failed", { runId: state.runId, workflowId: workflow.id, error: errorMsg });

    await this.ctx.activity.log({
      companyId: this.companyId,
      message: `Workflow failed: ${workflow.name} — ${errorMsg}`,
      entityType: "workflow_run",
      entityId: state.runId,
      metadata: { workflowId: workflow.id, error: errorMsg },
    });

    await this.ctx.telemetry.track("workflow_failed", { workflowId: workflow.id, error: errorMsg });
  }

  private async saveState(runId: string, state: ExecutionState): Promise<void> {
    await this.ctx.state.set({ scopeKind: "company", scopeId: this.companyId, stateKey: `run:${runId}` }, state);

    // Also update the recent runs list
    const recentRuns = ((await this.ctx.state.get({ scopeKind: "company", scopeId: this.companyId, stateKey: "crewgods:recentRuns" })) as unknown[] ?? []);
    const runSummary = { runId: state.runId, workflowId: state.workflowId, status: state.status, startedAt: state.startedAt, completedAt: state.completedAt, costCents: state.totalCostCents };
    const idx = recentRuns.findIndex((r: any) => r.runId === runId);
    if (idx >= 0) {
      recentRuns[idx] = runSummary;
    } else {
      recentRuns.unshift(runSummary);
    }
    // Keep only last 100 runs
    await this.ctx.state.set({ scopeKind: "company", scopeId: this.companyId, stateKey: "crewgods:recentRuns" }, recentRuns.slice(0, 100));
  }

  private async loadState(runId: string): Promise<ExecutionState | null> {
    return (await this.ctx.state.get({ scopeKind: "company", scopeId: this.companyId, stateKey: `run:${runId}` })) as ExecutionState | null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
