// ═══════════════════════════════════════════════════════
// WORKFLOW PACKS — Predefined operational workflows
// Deterministic, reliable, opinionated
// Gives immediate value
// ═══════════════════════════════════════════════════════

import type { WorkflowDef, WorkflowNodeDef, WorkflowEdgeDef } from "../base";

export interface WorkflowPack {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  workflows: WorkflowTemplate[];
  requiredIntegrations: string[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  triggerEvent: string;              // event type that triggers this
  triggerSchedule?: string;          // cron for scheduled workflows
  nodes: WorkflowNodeDef[];
  edges: WorkflowEdgeDef[];
  estimatedCostCents: number;
  tags: string[];
}

// ── Pack Registry ─────────────────────────────────────

import { financePack } from "./finance";
import { hrPack } from "./hr";
import { supportPack } from "./support";
import { opsPack } from "./ops";
import { salesPack } from "./sales";

export const allPacks: WorkflowPack[] = [
  financePack,
  hrPack,
  supportPack,
  opsPack,
  salesPack,
];

export const packMap = new Map(allPacks.map((p) => [p.id, p]));

export function getPack(id: string): WorkflowPack | undefined {
  return packMap.get(id);
}

export function getAllWorkflowTemplates(): WorkflowTemplate[] {
  return allPacks.flatMap((p) => p.workflows);
}

export function getWorkflowTemplate(id: string): WorkflowTemplate | undefined {
  return getAllWorkflowTemplates().find((w) => w.id === id);
}

export function getWorkflowsByTag(tag: string): WorkflowTemplate[] {
  return getAllWorkflowTemplates().filter((w) => w.tags.includes(tag));
}

export function getWorkflowsByEvent(event: string): WorkflowTemplate[] {
  return getAllWorkflowTemplates().filter((w) => w.triggerEvent === event);
}

// ── Instantiate a template for a specific org ─────────

export function instantiateWorkflow(template: WorkflowTemplate, orgId: string, input: Record<string, unknown>): WorkflowDef {
  return {
    id: `${template.id}-${orgId}-${Date.now()}`,
    name: template.name,
    orgId,
    pack: template.id.split("-")[0],
    nodes: template.nodes,
    edges: template.edges,
    input,
  };
}

// ── Re-exports ────────────────────────────────────────

export { financePack } from "./finance";
export { hrPack } from "./hr";
export { supportPack } from "./support";
export { opsPack } from "./ops";
export { salesPack } from "./sales";
