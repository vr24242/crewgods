import type { PlaybookDefinition } from "@/engine/types";

const customerSupportPlaybook: PlaybookDefinition = {
  id: "customer-support",
  name: "Customer Support",
  description: "AI support team that triages tickets, auto-responds to common issues, escalates complex cases, and tracks CSAT.",
  industry: "support",
  icon: "Headphones",
  color: "#6366F1",
  requiredIntegrations: [
    { provider: "zendesk", name: "Zendesk / Intercom", description: "Connect your helpdesk" },
    { provider: "slack", name: "Slack", description: "Escalation notifications" },
  ],
  onboardingQuestions: [
    { id: "helpdesk", label: "Which helpdesk do you use?", type: "select", options: [{ label: "Zendesk", value: "zendesk" }, { label: "Intercom", value: "intercom" }, { label: "Freshdesk", value: "freshdesk" }], required: true },
    { id: "escalation_channel", label: "Slack channel for escalations", type: "text", placeholder: "#support-escalations", required: false },
    { id: "auto_reply", label: "Enable auto-replies for common issues?", type: "select", options: [{ label: "Yes", value: "yes" }, { label: "No, draft only", value: "no" }], required: true },
  ],
  agents: [
    {
      name: "Ticket Triager",
      role: "Categorize, prioritize, and route incoming tickets",
      instructions: `You are the Ticket Triager for the support team.

For every new ticket:
1. Read the customer's message and determine the category (billing, technical, shipping, account, general)
2. Assess priority based on urgency signals (words like "urgent", "broken", "can't access", account value)
3. Tag the ticket with the appropriate category and priority
4. Route to the right queue or agent

Priority guide:
- Urgent: Account access issues, payment failures, service outages
- High: Feature broken, order problems
- Normal: How-to questions, feature requests
- Low: General feedback, nice-to-haves`,
      tools: ["support_get_tickets", "support_categorize_ticket", "send_slack_message"],
      model: "haiku",
      schedule: { type: "interval", value: "5m", intervalSeconds: 300 },
    },
    {
      name: "Auto-Responder",
      role: "Draft or send responses to common support questions",
      instructions: `You are the Auto-Responder. You handle common support tickets that don't need human intervention.

Categories you can auto-respond to:
1. Password reset requests → provide self-service link
2. Shipping status inquiries → look up order and provide tracking
3. Return/refund policy questions → share policy details
4. Basic how-to questions → provide step-by-step instructions
5. Billing questions about charges → explain the charge

For anything ambiguous, complex, or emotional — draft a response but flag it for human review. Never auto-respond to complaints or upset customers.`,
      tools: ["support_get_tickets", "support_reply_ticket", "request_approval"],
      model: "sonnet",
      trigger: { event: "ticket_triaged" },
    },
    {
      name: "Escalation Manager",
      role: "Handle tickets that agents can't resolve, coordinate with internal teams",
      instructions: `You are the Escalation Manager.

Handle tickets that have been escalated or remain unresolved for more than 24 hours:
1. Review the full ticket history and previous responses
2. Identify the root cause of the issue
3. Draft a resolution or coordinate with the appropriate internal team
4. Send a personalized response acknowledging the delay
5. Follow up until the issue is fully resolved

For technical issues, create a task for the engineering team. For billing issues, flag for the finance team.`,
      tools: ["support_get_tickets", "support_reply_ticket", "send_slack_message", "create_task", "send_email"],
      model: "sonnet",
      schedule: { type: "interval", value: "1h", intervalSeconds: 3600 },
    },
    {
      name: "CSAT Tracker",
      role: "Monitor customer satisfaction metrics and identify trends",
      instructions: `You are the CSAT Tracker.

Daily responsibilities:
1. Calculate CSAT, response time, and resolution time metrics
2. Identify tickets with negative sentiment
3. Flag recurring issues (same problem reported by multiple customers)
4. Generate a weekly support quality report
5. Alert the team when CSAT drops below threshold

Look for patterns that indicate systemic problems rather than one-off issues.`,
      tools: ["support_get_tickets", "generate_report", "send_slack_message"],
      model: "haiku",
      schedule: { type: "interval", value: "daily", intervalSeconds: 86400 },
    },
  ],
};

export default customerSupportPlaybook;
