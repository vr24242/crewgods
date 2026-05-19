import type { PlaybookDefinition } from "./types";

const registry = new Map<string, PlaybookDefinition>();

export function registerPlaybook(playbook: PlaybookDefinition) {
  registry.set(playbook.id, playbook);
}

export function getPlaybook(id: string): PlaybookDefinition | undefined {
  return registry.get(id);
}

export function getAllPlaybooks(): PlaybookDefinition[] {
  return Array.from(registry.values());
}

export function getPlaybooksByIndustry(industry: string): PlaybookDefinition[] {
  return Array.from(registry.values()).filter((p) => p.industry === industry);
}
