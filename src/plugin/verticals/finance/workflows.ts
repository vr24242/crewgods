import type { WorkflowDAG } from "../../workflows/types";

// ═══════════════════════════════════════════════════════
// FINANCE & ACCOUNTING VERTICAL — 4 Workflow DAGs
// ═══════════════════════════════════════════════════════

export const transactionCategorization: WorkflowDAG = {
  id: "finance-categorize-txns",
  name: "Transaction Categorization",
  vertical: "finance",
  description: "Auto-categorizes uncategorized transactions using merchant patterns, amount analysis, and historical data",
  version: "1.0.0",
  trigger: { type: "schedule", cron: "0 */6 * * *" },
  nodes: [
    {
      id: "fetch_uncategorized",
      name: "Fetch Uncategorized Transactions",
      type: "fetch",
      config: {
        integration: "quickbooks",
        operation: "transactions.list",
        inputMap: { filter: { source: "static", value: { categorized: false } } },
      },
    },
    {
      id: "fetch_chart_of_accounts",
      name: "Fetch Chart of Accounts",
      type: "fetch",
      config: {
        integration: "quickbooks",
        operation: "accounts.list",
        inputMap: {},
      },
    },
    {
      id: "fetch_recent_categorized",
      name: "Fetch Recently Categorized (for patterns)",
      type: "fetch",
      config: {
        integration: "quickbooks",
        operation: "transactions.list",
        inputMap: { filter: { source: "static", value: { categorized: true, limit: 200 } } },
      },
    },
    {
      id: "ai_categorize",
      name: "AI Categorize Transactions",
      type: "ai_decide",
      config: {
        inputMap: {
          transactions: { source: "node", nodeId: "fetch_uncategorized", path: "transactions" },
          accounts: { source: "node", nodeId: "fetch_chart_of_accounts", path: "accounts" },
          recentPatterns: { source: "node", nodeId: "fetch_recent_categorized", path: "transactions" },
        },
      },
      agent: {
        role: "Transaction Categorizer",
        model: "haiku",
        instructions: `Categorize each transaction. For each return:
{
  "transactionId": string,
  "suggestedAccount": string (from chart of accounts),
  "confidence": 0-100,
  "reasoning": string,
  "needsReview": boolean (true if confidence < 80 or amount > threshold),
  "matchedPattern": string | null (similar past transaction that informed decision)
}

Merchant name patterns:
- "AWS", "GOOGLE CLOUD", "AZURE" → Cloud/SaaS subscriptions
- "UBER", "LYFT" → Travel/Transportation
- "DOORDASH", "GRUBHUB" → Meals & Entertainment
- "GUSTO", "ADP" → Payroll
- "WIX", "SQUARESPACE" → Website/Hosting

Flag for review: first-time vendors, amounts > anomaly threshold, unclear descriptions.`,
      },
    },
    {
      id: "branch_confidence",
      name: "Split by Confidence",
      type: "branch",
      config: {
        inputMap: {
          results: { source: "node", nodeId: "ai_categorize", path: "categorizations" },
        },
      },
    },
    {
      id: "auto_apply",
      name: "Apply High-Confidence Categories",
      type: "loop",
      config: {
        inputMap: {
          items: { source: "node", nodeId: "ai_categorize", path: "highConfidence" },
        },
        params: { itemNode: "apply_single_category" },
      },
    },
    {
      id: "apply_single_category",
      name: "Apply Category",
      type: "action",
      config: {
        integration: "quickbooks",
        operation: "transactions.categorize",
        inputMap: {
          transactionId: { source: "node", nodeId: "auto_apply", path: "currentItem.transactionId" },
          accountId: { source: "node", nodeId: "auto_apply", path: "currentItem.suggestedAccount" },
        },
      },
    },
    {
      id: "queue_review",
      name: "Queue Low-Confidence for Review",
      type: "action",
      config: {
        integration: "slack",
        operation: "chat.postMessage",
        inputMap: {
          channel: { source: "integration", provider: "settings", path: "financeChannel" },
          message: { source: "template", template: "{{ai_categorize.needsReview.length}} transactions need manual review" },
        },
      },
    },
  ],
  edges: [
    { from: "fetch_uncategorized", to: "ai_categorize" },
    { from: "fetch_chart_of_accounts", to: "ai_categorize" },
    { from: "fetch_recent_categorized", to: "ai_categorize" },
    { from: "ai_categorize", to: "branch_confidence" },
    { from: "branch_confidence", to: "auto_apply", condition: { type: "expression", expr: "output.results.some(r => r.confidence >= 80)" }, label: "high confidence" },
    { from: "branch_confidence", to: "queue_review", condition: { type: "expression", expr: "output.results.some(r => r.confidence < 80)" }, label: "needs review" },
    { from: "auto_apply", to: "apply_single_category" },
  ],
  errorHandler: { onNodeFailure: "skip", maxRetries: 2, retryDelaySeconds: 60, notifyChannel: "#finance" },
  metadata: { estimatedDurationMs: 20000, estimatedCostCents: 3, tags: ["categorization", "bookkeeping"], requiredIntegrations: ["quickbooks", "slack"], requiredApprovals: [] },
};

export const reconciliation: WorkflowDAG = {
  id: "finance-reconciliation",
  name: "Bank Reconciliation",
  vertical: "finance",
  description: "Matches bank transactions with recorded invoices/bills, flags discrepancies and duplicates",
  version: "1.0.0",
  trigger: { type: "schedule", cron: "0 7 * * 1" }, // weekly Monday 7am
  nodes: [
    {
      id: "fetch_bank_txns",
      name: "Fetch Bank Transactions",
      type: "fetch",
      config: {
        integration: "quickbooks",
        operation: "bankTransactions.list",
        inputMap: { period: { source: "static", value: "last_7_days" } },
      },
    },
    {
      id: "fetch_invoices",
      name: "Fetch Invoices & Bills",
      type: "fetch",
      config: {
        integration: "quickbooks",
        operation: "invoicesAndBills.list",
        inputMap: { period: { source: "static", value: "last_30_days" }, status: { source: "static", value: "all" } },
      },
    },
    {
      id: "ai_match",
      name: "AI Match Transactions",
      type: "ai_decide",
      config: {
        inputMap: {
          bankTransactions: { source: "node", nodeId: "fetch_bank_txns", path: "transactions" },
          invoices: { source: "node", nodeId: "fetch_invoices", path: "records" },
        },
      },
      agent: {
        role: "Reconciliation Agent",
        model: "sonnet",
        instructions: `Match bank transactions to invoices/bills. Return:
{
  "matched": [{ bankTxnId, invoiceId, confidence, amountDiff }],
  "unmatchedBank": [{ txnId, amount, description, possibleMatch }],
  "unmatchedInvoices": [{ invoiceId, amount, vendor, daysPastDue }],
  "duplicates": [{ txnIds[], amount, vendor }],
  "discrepancies": [{ bankTxnId, invoiceId, bankAmount, invoiceAmount, diff }],
  "summary": { matched, unmatched, duplicates, totalDiscrepancyAmount }
}

Matching rules:
- Exact amount match + same vendor + within 3 days = high confidence
- Amount within 1% + same vendor = medium confidence
- Partial payments: one bank txn may match multiple invoices
- Foreign currency: check if amounts match after conversion`,
      },
    },
    {
      id: "apply_matches",
      name: "Apply Confirmed Matches",
      type: "loop",
      config: {
        inputMap: { items: { source: "node", nodeId: "ai_match", path: "matched" } },
        params: { itemNode: "reconcile_single" },
      },
    },
    {
      id: "reconcile_single",
      name: "Reconcile Transaction",
      type: "action",
      config: {
        integration: "quickbooks",
        operation: "transactions.reconcile",
        inputMap: {
          bankTxnId: { source: "node", nodeId: "apply_matches", path: "currentItem.bankTxnId" },
          invoiceId: { source: "node", nodeId: "apply_matches", path: "currentItem.invoiceId" },
        },
      },
    },
    {
      id: "generate_report",
      name: "Generate Reconciliation Report",
      type: "ai_generate",
      config: {
        inputMap: { results: { source: "node", nodeId: "ai_match", path: "" } },
      },
      agent: {
        role: "Reconciliation Agent",
        model: "haiku",
        instructions: "Format a clean reconciliation summary for Slack. Show: matched count, unmatched count, duplicates found, total discrepancy amount. List top 5 unmatched items for action.",
      },
    },
    {
      id: "send_report",
      name: "Send Report",
      type: "action",
      config: {
        integration: "slack",
        operation: "chat.postMessage",
        inputMap: {
          channel: { source: "integration", provider: "settings", path: "financeChannel" },
          message: { source: "node", nodeId: "generate_report", path: "message" },
        },
      },
    },
  ],
  edges: [
    { from: "fetch_bank_txns", to: "ai_match" },
    { from: "fetch_invoices", to: "ai_match" },
    { from: "ai_match", to: "apply_matches" },
    { from: "apply_matches", to: "reconcile_single" },
    { from: "ai_match", to: "generate_report" },
    { from: "generate_report", to: "send_report" },
  ],
  errorHandler: { onNodeFailure: "retry", maxRetries: 2, retryDelaySeconds: 120, escalateTo: "Close Manager", notifyChannel: "#finance" },
  metadata: { estimatedDurationMs: 45000, estimatedCostCents: 8, tags: ["reconciliation", "bank", "matching"], requiredIntegrations: ["quickbooks", "slack"], requiredApprovals: [] },
};

export const anomalyDetection: WorkflowDAG = {
  id: "finance-anomaly-detection",
  name: "Transaction Anomaly Detection",
  vertical: "finance",
  description: "Flags unusual transactions: threshold breaches, duplicate charges, spending spikes, unknown vendors",
  version: "1.0.0",
  trigger: { type: "schedule", cron: "0 9 * * *" }, // daily 9am
  nodes: [
    {
      id: "fetch_today_txns",
      name: "Fetch Recent Transactions",
      type: "fetch",
      config: {
        integration: "quickbooks",
        operation: "transactions.list",
        inputMap: { period: { source: "static", value: "last_24_hours" } },
      },
    },
    {
      id: "fetch_historical",
      name: "Fetch Historical Averages",
      type: "fetch",
      config: {
        integration: "quickbooks",
        operation: "analytics.spendingByCategory",
        inputMap: { period: { source: "static", value: "last_90_days" } },
      },
    },
    {
      id: "detect_anomalies",
      name: "AI Detect Anomalies",
      type: "ai_decide",
      config: {
        inputMap: {
          recentTxns: { source: "node", nodeId: "fetch_today_txns", path: "transactions" },
          historicalAvg: { source: "node", nodeId: "fetch_historical", path: "averages" },
          threshold: { source: "integration", provider: "settings", path: "anomalyThreshold" },
        },
      },
      agent: {
        role: "Anomaly Detector",
        model: "sonnet",
        instructions: `Scan for anomalies. Check:
1. Single transactions above threshold
2. Duplicate charges (same amount + vendor within 48h)
3. Category spending > 2x historical monthly average
4. First-time vendors with large amounts
5. Transactions outside business hours (weekends, late night)
6. Round-number transactions > $1000 (potential fraud signal)

Return: { anomalies: [{ txnId, type, severity, amount, reason, suggestedAction }], summary }`,
      },
    },
    {
      id: "branch_severity",
      name: "Route by Severity",
      type: "branch",
      config: {
        inputMap: { hasHighSeverity: { source: "node", nodeId: "detect_anomalies", path: "anomalies" } },
      },
    },
    {
      id: "approval_high",
      name: "Request Review for High Severity",
      type: "approval",
      config: {
        inputMap: {
          title: { source: "static", value: "High-severity transaction anomalies detected" },
          description: { source: "node", nodeId: "detect_anomalies", path: "summary" },
          anomalies: { source: "node", nodeId: "detect_anomalies", path: "anomalies" },
        },
      },
      agent: { role: "Anomaly Detector", model: "sonnet" },
    },
    {
      id: "notify_low",
      name: "Notify Low Severity",
      type: "action",
      config: {
        integration: "slack",
        operation: "chat.postMessage",
        inputMap: {
          channel: { source: "integration", provider: "settings", path: "financeChannel" },
          message: { source: "node", nodeId: "detect_anomalies", path: "summary" },
        },
      },
    },
    {
      id: "log_clean",
      name: "Log All Clear",
      type: "action",
      config: {
        integration: "internal",
        operation: "activity.log",
        inputMap: { summary: { source: "static", value: "Daily anomaly scan: no issues detected" } },
      },
    },
  ],
  edges: [
    { from: "fetch_today_txns", to: "detect_anomalies" },
    { from: "fetch_historical", to: "detect_anomalies" },
    { from: "detect_anomalies", to: "branch_severity" },
    { from: "branch_severity", to: "approval_high", condition: { type: "expression", expr: "output.hasHighSeverity.some(a => a.severity === 'high' || a.severity === 'critical')" }, label: "high severity" },
    { from: "branch_severity", to: "notify_low", condition: { type: "expression", expr: "output.hasHighSeverity.length > 0 && !output.hasHighSeverity.some(a => a.severity === 'high')" }, label: "low severity" },
    { from: "branch_severity", to: "log_clean", condition: { type: "expression", expr: "output.hasHighSeverity.length === 0" }, label: "all clear" },
  ],
  errorHandler: { onNodeFailure: "retry", maxRetries: 2, retryDelaySeconds: 60, notifyChannel: "#finance" },
  metadata: { estimatedDurationMs: 20000, estimatedCostCents: 5, tags: ["anomaly", "fraud", "monitoring"], requiredIntegrations: ["quickbooks", "slack"], requiredApprovals: ["high_severity_anomaly"] },
};

export const monthEndClose: WorkflowDAG = {
  id: "finance-month-end-close",
  name: "Month-End Close",
  vertical: "finance",
  description: "Orchestrates month-end close: checklist generation, progress tracking, final report",
  version: "1.0.0",
  trigger: { type: "schedule", cron: "0 8 28-31 * *" }, // last few days of month
  nodes: [
    {
      id: "check_if_close_period",
      name: "Verify Close Period Active",
      type: "ai_decide",
      config: {
        inputMap: { today: { source: "static", value: "{{today}}" } },
      },
      agent: {
        role: "Close Manager",
        model: "haiku",
        instructions: "Check if today is within the close period (last 2 business days of month through 5th of next month). Return { isClosePeriod: boolean, dayOfClose: number }",
      },
    },
    {
      id: "generate_checklist",
      name: "Generate Close Checklist",
      type: "ai_generate",
      config: {
        inputMap: { dayOfClose: { source: "node", nodeId: "check_if_close_period", path: "dayOfClose" } },
      },
      agent: {
        role: "Close Manager",
        model: "opus",
        instructions: `Generate the month-end close checklist. Items:
1. All bank accounts reconciled
2. Outstanding invoices reviewed and followed up
3. Accounts payable verified and accrued
4. Revenue recognized per policy
5. Prepaid expenses and deferrals adjusted
6. Depreciation entries posted
7. Intercompany transactions reconciled
8. Payroll reconciled
9. Tax provisions estimated
10. Trial balance reviewed

For each: { item, status: "pending" | "in_progress" | "complete", assignedTo, dueDate, blockers }`,
      },
    },
    {
      id: "fetch_reconciliation_status",
      name: "Check Reconciliation Status",
      type: "fetch",
      config: {
        integration: "quickbooks",
        operation: "reconciliation.status",
        inputMap: { period: { source: "static", value: "current_month" } },
      },
    },
    {
      id: "create_tasks",
      name: "Create Outstanding Tasks",
      type: "loop",
      config: {
        inputMap: { items: { source: "node", nodeId: "generate_checklist", path: "pendingItems" } },
        params: { itemNode: "create_single_task" },
      },
    },
    {
      id: "create_single_task",
      name: "Create Task",
      type: "action",
      config: {
        integration: "internal",
        operation: "tasks.create",
        inputMap: {
          title: { source: "node", nodeId: "create_tasks", path: "currentItem.item" },
          assignTo: { source: "node", nodeId: "create_tasks", path: "currentItem.assignedTo" },
        },
      },
    },
    {
      id: "send_status",
      name: "Send Close Status Update",
      type: "action",
      config: {
        integration: "slack",
        operation: "chat.postMessage",
        inputMap: {
          channel: { source: "integration", provider: "settings", path: "financeChannel" },
          message: { source: "template", template: "Month-end close Day {{check_if_close_period.dayOfClose}}: {{generate_checklist.completedCount}}/{{generate_checklist.totalCount}} items complete" },
        },
      },
    },
  ],
  edges: [
    { from: "check_if_close_period", to: "generate_checklist", condition: { type: "output_equals", field: "isClosePeriod", value: true } },
    { from: "generate_checklist", to: "fetch_reconciliation_status" },
    { from: "fetch_reconciliation_status", to: "create_tasks" },
    { from: "create_tasks", to: "create_single_task" },
    { from: "create_tasks", to: "send_status" },
  ],
  errorHandler: { onNodeFailure: "escalate", maxRetries: 1, retryDelaySeconds: 300, escalateTo: "Close Manager", notifyChannel: "#finance" },
  metadata: { estimatedDurationMs: 60000, estimatedCostCents: 15, tags: ["month-end", "close", "checklist"], requiredIntegrations: ["quickbooks", "slack"], requiredApprovals: ["close_sign_off"] },
};

export const financeWorkflows = [
  transactionCategorization,
  reconciliation,
  anomalyDetection,
  monthEndClose,
];
