import type { PlaybookDefinition } from "@/engine/types";

const salesPlaybook: PlaybookDefinition = {
  id: "sales",
  name: "Sales Development",
  description: "AI SDR team that researches leads, writes personalized outreach, follows up, and books meetings.",
  industry: "sales",
  icon: "Target",
  color: "#EF4444",
  requiredIntegrations: [
    { provider: "hubspot", name: "HubSpot / Salesforce", description: "Connect your CRM" },
    { provider: "email", name: "Email", description: "Send outreach emails" },
  ],
  onboardingQuestions: [
    { id: "crm", label: "Which CRM do you use?", type: "select", options: [{ label: "HubSpot", value: "hubspot" }, { label: "Salesforce", value: "salesforce" }, { label: "Pipedrive", value: "pipedrive" }], required: true },
    { id: "icp", label: "Describe your ideal customer", type: "text", placeholder: "B2B SaaS companies, 50-500 employees, US-based", required: true },
    { id: "value_prop", label: "Your one-line value proposition", type: "text", placeholder: "We help X do Y without Z", required: true },
  ],
  agents: [
    {
      name: "Lead Researcher",
      role: "Research new leads, enrich with data, score for fit",
      instructions: `You are the Lead Researcher.

For each new lead in the CRM:
1. Research the company: industry, size, recent news, tech stack
2. Research the contact: role, tenure, LinkedIn activity, shared connections
3. Score the lead on ICP fit (1-10)
4. Write a 2-3 sentence research brief that the outreach agent can use for personalization
5. Update the CRM with enriched data

Focus on signals that indicate buying intent: job postings, funding rounds, tech migrations, competitor mentions.`,
      tools: ["crm_get_leads", "crm_update_lead", "generate_report"],
      model: "sonnet",
      schedule: { type: "interval", value: "4h", intervalSeconds: 14400 },
    },
    {
      name: "Outreach Writer",
      role: "Write personalized cold outreach emails based on research",
      instructions: `You are the Outreach Writer.

For each qualified lead (score 7+):
1. Read the research brief from the Lead Researcher
2. Write a personalized email that references something specific about their company or role
3. Keep it under 150 words — busy executives don't read long emails
4. Include a clear, low-friction CTA (quick call, share a resource, answer a question)
5. Never be pushy or use manipulative tactics

Write like a human, not a template. Each email should feel like it was written just for them. No "I hope this email finds you well."`,
      tools: ["crm_get_leads", "crm_send_outreach", "request_approval"],
      model: "sonnet",
      trigger: { event: "lead_qualified" },
      requiresApproval: ["send_outreach"],
    },
    {
      name: "Follow-Up Agent",
      role: "Send timely follow-ups to leads who haven't responded",
      instructions: `You are the Follow-Up Agent.

Follow-up sequence:
1. Day 3: Short, different angle — don't repeat the first email
2. Day 7: Share a relevant resource or case study
3. Day 14: Final breakup email — "I'll assume the timing isn't right"

Rules:
- Never follow up more than 3 times
- If they reply (even negatively), stop the sequence
- If they ask to be removed, mark as unsubscribed immediately
- Vary send times (morning, afternoon) for better open rates`,
      tools: ["crm_get_leads", "crm_update_lead", "crm_send_outreach", "send_email"],
      model: "haiku",
      schedule: { type: "interval", value: "daily", intervalSeconds: 86400 },
    },
    {
      name: "Pipeline Reporter",
      role: "Generate daily pipeline reports and forecast",
      instructions: `You are the Pipeline Reporter.

Daily report includes:
1. New leads added and their scores
2. Outreach sent and response rates
3. Meetings booked this week
4. Pipeline value by stage
5. Leads going cold (no activity in 7+ days)

Weekly report adds:
- Win/loss analysis
- Best-performing outreach templates
- ICP refinement suggestions based on conversion data`,
      tools: ["crm_get_leads", "generate_report", "send_slack_message"],
      model: "haiku",
      schedule: { type: "interval", value: "daily", intervalSeconds: 86400 },
    },
  ],
};

export default salesPlaybook;
