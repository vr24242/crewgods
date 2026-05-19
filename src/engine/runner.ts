import Anthropic from "@anthropic-ai/sdk";
import { AgentContext, RunResult, ToolDefinition } from "./types";
import { getModelId, calculateCostCents } from "./models";

const client = new Anthropic();

export async function executeAgent(
  instructions: string,
  model: "haiku" | "sonnet" | "opus",
  tools: ToolDefinition[],
  context: AgentContext
): Promise<RunResult> {
  const startTime = Date.now();
  const modelId = getModelId(model);
  const allToolCalls: unknown[] = [];

  const systemPrompt = buildSystemPrompt(instructions, context);

  const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool.InputSchema,
  }));

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: context.taskDescription
        ? `Task: ${context.taskTitle}\n\n${context.taskDescription}`
        : `Execute your scheduled duties. Review current state and take appropriate actions.`,
    },
  ];

  let totalInput = 0;
  let totalOutput = 0;
  let totalCached = 0;
  let finalResponse = "";
  let iterations = 0;
  const maxIterations = 10;

  while (iterations < maxIterations) {
    iterations++;

    const response = await client.messages.create({
      model: modelId,
      max_tokens: 4096,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      tools: anthropicTools.length > 0 ? anthropicTools : undefined,
      messages,
    });

    totalInput += response.usage.input_tokens;
    totalOutput += response.usage.output_tokens;
    totalCached += (response.usage as Record<string, number>).cache_read_input_tokens ?? 0;

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ContentBlockParam & { type: "tool_use" } => b.type === "tool_use"
    );
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );

    if (textBlocks.length > 0) {
      finalResponse = textBlocks.map((b) => b.text).join("\n");
    }

    if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const tool = tools.find((t) => t.name === toolUse.name);
      let result: unknown;

      try {
        if (!tool) throw new Error(`Unknown tool: ${toolUse.name}`);
        result = await tool.execute(
          toolUse.input as Record<string, unknown>,
          context
        );
        allToolCalls.push({
          name: toolUse.name,
          input: toolUse.input,
          output: result,
          status: "success",
        });
      } catch (err) {
        result = { error: err instanceof Error ? err.message : "Unknown error" };
        allToolCalls.push({
          name: toolUse.name,
          input: toolUse.input,
          output: result,
          status: "error",
        });
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
  }

  const durationMs = Date.now() - startTime;
  const costCents = calculateCostCents(model, totalInput, totalOutput, totalCached);

  return {
    status: "succeeded",
    response: finalResponse,
    toolCalls: allToolCalls,
    inputTokens: totalInput,
    outputTokens: totalOutput,
    cachedTokens: totalCached,
    costCents,
    durationMs,
  };
}

function buildSystemPrompt(instructions: string, context: AgentContext): string {
  const parts = [
    `You are ${context.agentName}, an AI agent working for a company.`,
    `Your role: ${context.role}`,
    "",
    "## Instructions",
    instructions,
    "",
    "## Guidelines",
    "- Be concise and action-oriented.",
    "- Use the tools available to you to complete tasks.",
    "- If a task requires approval, describe the action and wait.",
    "- Report what you did in a brief summary at the end.",
  ];

  if (context.previousRuns && context.previousRuns.length > 0) {
    parts.push("", "## Recent Activity");
    for (const run of context.previousRuns.slice(-3)) {
      parts.push(`- [${run.status}] ${run.response?.slice(0, 200) ?? "No response"}`);
    }
  }

  return parts.join("\n");
}
