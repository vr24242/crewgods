import { NextResponse } from "next/server";
import { allPlaybooks } from "@/playbooks";

export async function GET() {
  const playbooks = allPlaybooks.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    industry: p.industry,
    icon: p.icon,
    color: p.color,
    agentCount: p.agents.length,
    agents: p.agents.map((a) => ({
      name: a.name,
      role: a.role,
      model: a.model,
      scheduled: !!a.schedule,
      triggerBased: !!a.trigger,
    })),
    requiredIntegrations: p.requiredIntegrations,
  }));

  return NextResponse.json({ playbooks });
}
