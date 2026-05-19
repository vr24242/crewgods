import type { PluginContext } from "@paperclipai/plugin-sdk";

const MODEL_MAP: Record<string, { id: string; inputCostPer1M: number; outputCostPer1M: number }> = {
  haiku: { id: "claude-haiku-4-5-20251001", inputCostPer1M: 80, outputCostPer1M: 400 },
  sonnet: { id: "claude-sonnet-4-6", inputCostPer1M: 300, outputCostPer1M: 1500 },
  opus: { id: "claude-opus-4-7", inputCostPer1M: 1500, outputCostPer1M: 7500 },
};

interface AINodeInput {
  model: string;
  role: string;
  instructions: string;
  inputs: Record<string, unknown>;
  companyId: string;
}

interface AINodeOutput {
  output: unknown;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export async function callClaude(ctx: PluginContext, input: AINodeInput): Promise<AINodeOutput> {
  const modelConfig = MODEL_MAP[input.model] ?? MODEL_MAP.sonnet;

  const apiKey = await ctx.secrets.resolve("ANTHROPIC_API_KEY");

  const systemPrompt = `You are a ${input.role}. Respond ONLY with valid JSON. No markdown, no explanation.`;
  const userMessage = `${input.instructions}\n\nInput data:\n${JSON.stringify(input.inputs, null, 2)}`;

  const response = await ctx.http.fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelConfig.id,
      max_tokens: 4096,
      system: [
        { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
    usage: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
  };

  const textContent = data.content.find((c) => c.type === "text");
  const rawText = textContent?.text ?? "{}";

  let output: unknown;
  try {
    output = JSON.parse(rawText);
  } catch {
    output = { raw: rawText };
  }

  const inputTokens = data.usage.input_tokens;
  const outputTokens = data.usage.output_tokens;
  const cachedTokens = (data.usage.cache_read_input_tokens ?? 0);
  const effectiveInputTokens = inputTokens - cachedTokens + cachedTokens * 0.1;
  const costCents = (effectiveInputTokens * modelConfig.inputCostPer1M + outputTokens * modelConfig.outputCostPer1M) / 1_000_000;

  ctx.logger.info("AI node completed", {
    model: input.model,
    role: input.role,
    inputTokens,
    outputTokens,
    cachedTokens,
    costCents: Math.round(costCents * 100) / 100,
  });

  return { output, costCents, inputTokens, outputTokens, model: input.model };
}
