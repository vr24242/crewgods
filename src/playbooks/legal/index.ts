import type { PlaybookDefinition } from "@/engine/types";

const legalPlaybook: PlaybookDefinition = {
  id: "legal",
  name: "Legal Operations",
  description: "AI legal team that reviews contracts, tracks deadlines, generates NDAs, and monitors compliance.",
  industry: "legal",
  icon: "Scale",
  color: "#0EA5E9",
  requiredIntegrations: [
    { provider: "google_drive", name: "Google Drive / Dropbox", description: "Where your contracts are stored" },
    { provider: "slack", name: "Slack", description: "Legal team notifications" },
  ],
  onboardingQuestions: [
    { id: "storage", label: "Where do you store contracts?", type: "select", options: [{ label: "Google Drive", value: "google_drive" }, { label: "Dropbox", value: "dropbox" }, { label: "SharePoint", value: "sharepoint" }], required: true },
    { id: "renewal_notice", label: "Days before renewal to alert", type: "text", placeholder: "30", required: false },
    { id: "jurisdiction", label: "Primary jurisdiction", type: "text", placeholder: "Delaware, USA", required: true },
  ],
  agents: [
    {
      name: "Contract Reviewer",
      role: "Review contracts and flag risks, missing clauses, and unfavorable terms",
      instructions: `You are the Contract Reviewer.

For each contract submitted for review:
1. Identify the contract type (NDA, SaaS agreement, employment, vendor, etc.)
2. Check for standard protective clauses (limitation of liability, indemnification, IP assignment, termination)
3. Flag missing clauses that should be present for this contract type
4. Highlight unfavorable terms (auto-renewal without notice, broad non-compete, unlimited liability)
5. Provide a risk score (low/medium/high) with specific concerns

Always recommend human legal review for high-risk contracts. You assist, not replace, legal counsel.`,
      tools: ["legal_get_contracts", "legal_review_contract", "request_approval", "send_slack_message"],
      model: "opus",
      trigger: { event: "contract_submitted" },
      requiresApproval: ["approve_contract"],
    },
    {
      name: "Deadline Tracker",
      role: "Monitor contract renewal dates, notice periods, and compliance deadlines",
      instructions: `You are the Deadline Tracker.

Daily checks:
1. Scan all active contracts for upcoming deadlines (renewals, notice periods, milestones)
2. Alert the team for deadlines within the configured notice window
3. Escalate contracts expiring within 7 days with no action taken
4. Track compliance deadlines (annual filings, certifications, audits)
5. Generate a weekly deadline summary

For auto-renewing contracts, send the alert early enough to decide whether to renew or terminate.`,
      tools: ["legal_get_contracts", "send_slack_message", "send_email", "generate_report"],
      model: "haiku",
      schedule: { type: "interval", value: "daily", intervalSeconds: 86400 },
    },
    {
      name: "NDA Generator",
      role: "Generate standard NDAs based on templates",
      instructions: `You are the NDA Generator.

When a team member requests an NDA:
1. Ask for: counterparty name, mutual vs one-way, purpose, duration, jurisdiction
2. Generate the NDA using the company's standard template
3. Flag any non-standard terms requested
4. Submit for legal review before sending

Default terms: 2-year duration, mutual, covering confidential business information, with standard carve-outs for public information and independent development.`,
      tools: ["legal_get_contracts", "request_approval", "send_email"],
      model: "sonnet",
      trigger: { event: "nda_requested" },
      requiresApproval: ["send_nda"],
    },
    {
      name: "Compliance Monitor",
      role: "Track regulatory compliance requirements and flag gaps",
      instructions: `You are the Compliance Monitor.

Ongoing responsibilities:
1. Track regulatory requirements relevant to the company's industry and jurisdiction
2. Monitor policy documents for updates needed
3. Flag upcoming compliance deadlines (tax filings, certifications, audits)
4. Review vendor contracts for compliance clauses (data processing, GDPR, SOC 2)
5. Generate monthly compliance status reports

Prioritize by risk: regulatory fines > contractual obligations > best practices.`,
      tools: ["legal_get_contracts", "generate_report", "send_slack_message", "create_task"],
      model: "sonnet",
      schedule: { type: "interval", value: "weekly", intervalSeconds: 604800 },
    },
  ],
};

export default legalPlaybook;
