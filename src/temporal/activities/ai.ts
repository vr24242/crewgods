// ═══════════════════════════════════════════════════════
// AI ACTIVITIES — Claude-powered reasoning nodes
// These are called by Temporal workflows as activities
// ═══════════════════════════════════════════════════════

import { ChatAnthropic } from "@langchain/anthropic";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// ── Model Registry ────────────────────────────────────

const models = {
  haiku: new ChatAnthropic({ model: "claude-haiku-4-5-20251001", maxTokens: 4096 }),
  sonnet: new ChatAnthropic({ model: "claude-sonnet-4-6", maxTokens: 4096 }),
  opus: new ChatAnthropic({ model: "claude-opus-4-7", maxTokens: 4096 }),
};

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  haiku: { input: 80, output: 400 },
  sonnet: { input: 300, output: 1500 },
  opus: { input: 1500, output: 7500 },
};

// ── Activity: Classify ────────────────────────────────
// Used for: ticket triage, exception type, severity, sentiment

export interface ClassifyInput {
  text: string;
  categories: string[];
  context?: Record<string, unknown>;
  model?: "haiku" | "sonnet" | "opus";
}

export interface ClassifyResult {
  category: string;
  confidence: number;
  reasoning: string;
  metadata: Record<string, unknown>;
  costCents: number;
}

export async function classify(input: ClassifyInput): Promise<ClassifyResult> {
  const model = models[input.model ?? "haiku"];
  const response = await model.invoke([
    new SystemMessage(`You are a classifier. Classify the input into exactly one of these categories: ${input.categories.join(", ")}. Respond ONLY with JSON: { "category": string, "confidence": 0-1, "reasoning": string, "metadata": {} }`),
    new HumanMessage(`${input.context ? `Context: ${JSON.stringify(input.context)}\n\n` : ""}Classify this:\n${input.text}`),
  ]);

  const parsed = JSON.parse(response.content as string);
  return { ...parsed, costCents: estimateCost(input.model ?? "haiku", input.text.length, 200) };
}

// ── Activity: Summarize ───────────────────────────────

export interface SummarizeInput {
  text: string;
  maxLength?: number;
  style?: "executive" | "detailed" | "bullet_points";
  model?: "haiku" | "sonnet" | "opus";
}

export interface SummarizeResult {
  summary: string;
  keyPoints: string[];
  costCents: number;
}

export async function summarize(input: SummarizeInput): Promise<SummarizeResult> {
  const model = models[input.model ?? "haiku"];
  const response = await model.invoke([
    new SystemMessage(`Summarize the input. Style: ${input.style ?? "executive"}. Max ${input.maxLength ?? 200} words. Return JSON: { "summary": string, "keyPoints": string[] }`),
    new HumanMessage(input.text),
  ]);

  const parsed = JSON.parse(response.content as string);
  return { ...parsed, costCents: estimateCost(input.model ?? "haiku", input.text.length, 300) };
}

// ── Activity: Generate ────────────────────────────────
// Used for: email drafts, reports, responses, documents

export interface GenerateInput {
  instructions: string;
  context: Record<string, unknown>;
  outputFormat?: string;
  model?: "haiku" | "sonnet" | "opus";
}

export interface GenerateResult {
  output: unknown;
  rawText: string;
  costCents: number;
}

export async function generate(input: GenerateInput): Promise<GenerateResult> {
  const model = models[input.model ?? "sonnet"];
  const response = await model.invoke([
    new SystemMessage(`${input.instructions}\n\n${input.outputFormat ? `Return as: ${input.outputFormat}` : "Return valid JSON."}`),
    new HumanMessage(`Input data:\n${JSON.stringify(input.context, null, 2)}`),
  ]);

  const rawText = response.content as string;
  let output: unknown;
  try {
    output = JSON.parse(rawText);
  } catch {
    output = { text: rawText };
  }

  return { output, rawText, costCents: estimateCost(input.model ?? "sonnet", JSON.stringify(input.context).length, rawText.length) };
}

// ── Activity: Decide ──────────────────────────────────
// Used for: routing decisions, risk assessment, prioritization

export interface DecideInput {
  question: string;
  options: string[];
  context: Record<string, unknown>;
  criteria?: string;
  model?: "haiku" | "sonnet" | "opus";
}

export interface DecideResult {
  decision: string;
  confidence: number;
  reasoning: string;
  scores: Record<string, number>;
  costCents: number;
}

export async function decide(input: DecideInput): Promise<DecideResult> {
  const model = models[input.model ?? "sonnet"];
  const response = await model.invoke([
    new SystemMessage(`You are a decision engine. Given the context and criteria, choose the best option. Options: ${input.options.join(", ")}${input.criteria ? `\nCriteria: ${input.criteria}` : ""}. Return JSON: { "decision": string, "confidence": 0-1, "reasoning": string, "scores": { option: score } }`),
    new HumanMessage(`${input.question}\n\nContext:\n${JSON.stringify(input.context, null, 2)}`),
  ]);

  const parsed = JSON.parse(response.content as string);
  return { ...parsed, costCents: estimateCost(input.model ?? "sonnet", JSON.stringify(input.context).length, 300) };
}

// ── Activity: Extract ─────────────────────────────────
// Used for: parsing invoices, extracting fields from emails, contracts

export interface ExtractInput {
  text: string;
  fields: Array<{ name: string; type: string; description: string }>;
  model?: "haiku" | "sonnet" | "opus";
}

export interface ExtractResult {
  extracted: Record<string, unknown>;
  confidence: Record<string, number>;
  costCents: number;
}

export async function extract(input: ExtractInput): Promise<ExtractResult> {
  const model = models[input.model ?? "haiku"];
  const fieldSpec = input.fields.map((f) => `${f.name} (${f.type}): ${f.description}`).join("\n");

  const response = await model.invoke([
    new SystemMessage(`Extract the following fields from the text. Return JSON: { "extracted": { field: value }, "confidence": { field: 0-1 } }\n\nFields:\n${fieldSpec}`),
    new HumanMessage(input.text),
  ]);

  const parsed = JSON.parse(response.content as string);
  return { ...parsed, costCents: estimateCost(input.model ?? "haiku", input.text.length, 200) };
}

// ── Activity: AI Graph Execution ──────────────────────
// Runs a LangGraph for complex multi-step AI reasoning

const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: (prev, next) => [...prev, ...next] }),
  input: Annotation<Record<string, unknown>>,
  classification: Annotation<string>,
  decision: Annotation<string>,
  output: Annotation<unknown>,
});

export interface RunGraphInput {
  nodes: Array<{
    id: string;
    type: "classify" | "decide" | "generate" | "extract";
    config: Record<string, unknown>;
  }>;
  edges: Array<{
    from: string;
    to: string;
    condition?: { field: string; value: unknown };
  }>;
  input: Record<string, unknown>;
  model?: "haiku" | "sonnet" | "opus";
}

export async function runAIGraph(input: RunGraphInput): Promise<{ output: unknown; costCents: number }> {
  // For complex AI flows, we build and execute a LangGraph
  const model = models[input.model ?? "sonnet"];
  let totalCost = 0;

  // Build graph dynamically from node/edge definitions
  const graph = new StateGraph(GraphState);

  for (const node of input.nodes) {
    graph.addNode(node.id, async (state) => {
      const response = await model.invoke([
        new SystemMessage(`Execute ${node.type} operation. Config: ${JSON.stringify(node.config)}`),
        new HumanMessage(JSON.stringify({ ...state.input, classification: state.classification })),
      ]);
      totalCost += estimateCost(input.model ?? "sonnet", 500, 300);
      const parsed = JSON.parse(response.content as string);
      return { output: parsed, classification: parsed.category ?? state.classification, decision: parsed.decision ?? state.decision };
    });
  }

  // Wire edges
  if (input.nodes.length > 0) {
    graph.addEdge(START, input.nodes[0].id as any);
    for (let i = 0; i < input.nodes.length - 1; i++) {
      graph.addEdge(input.nodes[i].id as any, input.nodes[i + 1].id as any);
    }
    graph.addEdge(input.nodes[input.nodes.length - 1].id as any, END);
  }

  const compiled = graph.compile();
  const result = await compiled.invoke({ messages: [], input: input.input, classification: "", decision: "", output: null });

  return { output: result.output, costCents: totalCost };
}

// ── Cost Estimation ───────────────────────────────────

function estimateCost(model: string, inputChars: number, outputChars: number): number {
  const costs = MODEL_COSTS[model] ?? MODEL_COSTS.sonnet;
  const inputTokens = Math.ceil(inputChars / 4);
  const outputTokens = Math.ceil(outputChars / 4);
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
}
