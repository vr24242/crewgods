import type { PlaybookDefinition } from "@/engine/types";

const financePlaybook: PlaybookDefinition = {
  id: "finance",
  name: "Finance & Accounting",
  description: "AI finance team that handles bookkeeping, reconciliation, anomaly detection, and month-end close preparation.",
  industry: "finance",
  icon: "DollarSign",
  color: "#F59E0B",
  requiredIntegrations: [
    { provider: "quickbooks", name: "QuickBooks / Xero", description: "Connect your accounting software" },
    { provider: "slack", name: "Slack", description: "Finance alerts" },
  ],
  onboardingQuestions: [
    { id: "accounting_software", label: "Which accounting software?", type: "select", options: [{ label: "QuickBooks", value: "quickbooks" }, { label: "Xero", value: "xero" }, { label: "FreshBooks", value: "freshbooks" }], required: true },
    { id: "fiscal_year_end", label: "Fiscal year end month", type: "select", options: [{ label: "December", value: "12" }, { label: "March", value: "3" }, { label: "June", value: "6" }, { label: "September", value: "9" }], required: true },
    { id: "anomaly_threshold", label: "Flag transactions above ($)", type: "text", placeholder: "5000", required: false },
  ],
  agents: [
    {
      name: "Transaction Categorizer",
      role: "Automatically categorize uncategorized transactions",
      instructions: `You are the Transaction Categorizer.

1. Fetch all uncategorized transactions
2. Analyze the merchant name, amount, and description
3. Assign the appropriate GL category based on patterns
4. For ambiguous transactions, flag for human review
5. Learn from corrections to improve accuracy over time

Common categories: SaaS subscriptions, office supplies, travel, meals, professional services, payroll, utilities, marketing, insurance.`,
      tools: ["accounting_get_transactions", "accounting_categorize", "request_approval"],
      model: "haiku",
      schedule: { type: "interval", value: "6h", intervalSeconds: 21600 },
    },
    {
      name: "Reconciliation Agent",
      role: "Match bank transactions with invoices and flag discrepancies",
      instructions: `You are the Reconciliation Agent.

Weekly responsibilities:
1. Pull bank transactions and compare with recorded invoices/bills
2. Auto-match transactions that clearly correspond to invoices
3. Flag unmatched transactions for review
4. Identify duplicate payments or missed payments
5. Generate a reconciliation summary with matched, unmatched, and discrepancy counts

Pay special attention to: partial payments, transactions split across dates, and foreign currency conversions.`,
      tools: ["accounting_get_transactions", "accounting_reconcile", "generate_report", "send_slack_message"],
      model: "sonnet",
      schedule: { type: "interval", value: "weekly", intervalSeconds: 604800 },
    },
    {
      name: "Anomaly Detector",
      role: "Flag unusual transactions and spending patterns",
      instructions: `You are the Anomaly Detector.

Monitor for:
1. Transactions above the configured threshold
2. Unusual vendors or first-time payees
3. Duplicate charges (same amount, same vendor, short time window)
4. Spending spikes in any category vs. historical average
5. Transactions outside business hours

For each anomaly, create an alert with: what was flagged, why it's unusual, and suggested action. Prioritize by risk level.`,
      tools: ["accounting_get_transactions", "send_slack_message", "request_approval", "generate_report"],
      model: "sonnet",
      schedule: { type: "interval", value: "daily", intervalSeconds: 86400 },
    },
    {
      name: "Close Manager",
      role: "Prepare month-end close checklist and track completion",
      instructions: `You are the Close Manager.

At the end of each month:
1. Generate the month-end close checklist (reconciliation, accruals, deferrals, depreciation)
2. Check which items are completed vs. outstanding
3. Create tasks for outstanding items and assign to appropriate agents
4. Track progress and send daily updates during close period
5. Generate the final close report with key financial metrics

The close period typically runs from the last business day of the month through the 5th of the next month.`,
      tools: ["accounting_get_transactions", "accounting_reconcile", "create_task", "generate_report", "send_slack_message"],
      model: "opus",
      schedule: { type: "interval", value: "daily", intervalSeconds: 86400 },
    },
  ],
};

export default financePlaybook;
