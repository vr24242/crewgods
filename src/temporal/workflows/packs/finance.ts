// ═══════════════════════════════════════════════════════
// FINANCE PACK — Invoice approval, reconciliation,
// expense audit, payment escalation
// ═══════════════════════════════════════════════════════

import type { WorkflowPack } from "./index";

export const financePack: WorkflowPack = {
  id: "finance",
  name: "Finance Pack",
  description: "Automate invoice approvals, reconciliation, expense audits, and payment escalations",
  icon: "💰",
  color: "#F59E0B",
  requiredIntegrations: ["gmail", "slack", "quickbooks"],
  workflows: [
    // ── 1. Invoice Approval ─────────────────────────────
    {
      id: "finance-invoice-approval",
      name: "Invoice Approval",
      description: "Receives invoices via email, extracts details, routes for approval based on amount and vendor",
      triggerEvent: "invoice.received",
      tags: ["invoice", "approval", "finance"],
      estimatedCostCents: 5,
      nodes: [
        {
          id: "extract_invoice",
          name: "Extract Invoice Details",
          type: "ai_extract",
          config: {
            text: "{{trigger.payload.body}}",
            fields: [
              { name: "vendor", type: "string", description: "Company or person sending the invoice" },
              { name: "amount", type: "number", description: "Total amount due" },
              { name: "currency", type: "string", description: "Currency code (USD, EUR, INR, etc.)" },
              { name: "dueDate", type: "string", description: "Payment due date" },
              { name: "invoiceNumber", type: "string", description: "Invoice reference number" },
              { name: "lineItems", type: "array", description: "Individual line items with description and amount" },
            ],
            model: "haiku",
          },
        },
        {
          id: "check_duplicates",
          name: "Check for Duplicate Invoices",
          type: "fetch",
          config: {
            provider: "quickbooks",
            operation: "invoices.search",
            params: { vendor: "{{extract_invoice.extracted.vendor}}", invoiceNumber: "{{extract_invoice.extracted.invoiceNumber}}" },
          },
          dependsOn: ["extract_invoice"],
        },
        {
          id: "classify_risk",
          name: "Classify Invoice Risk",
          type: "ai_classify",
          config: {
            text: "{{extract_invoice.extracted}}",
            categories: ["auto_approve", "manager_approval", "finance_review", "flag_suspicious"],
            context: { duplicateCheck: "{{check_duplicates}}", amount: "{{extract_invoice.extracted.amount}}" },
            model: "haiku",
          },
          dependsOn: ["extract_invoice", "check_duplicates"],
        },
        {
          id: "route_approval",
          name: "Route for Approval",
          type: "condition",
          config: { category: "{{classify_risk.category}}" },
          dependsOn: ["classify_risk"],
        },
        {
          id: "auto_approve_invoice",
          name: "Auto-Approve Invoice",
          type: "action",
          config: { action: "create_task", title: "Invoice auto-approved: {{extract_invoice.extracted.vendor}} - {{extract_invoice.extracted.amount}}", priority: "low" },
          dependsOn: ["route_approval"],
        },
        {
          id: "request_manager_approval",
          name: "Request Manager Approval",
          type: "approval",
          config: {
            title: "Approve Invoice: {{extract_invoice.extracted.vendor}} — {{extract_invoice.extracted.amount}} {{extract_invoice.extracted.currency}}",
            description: "Invoice #{{extract_invoice.extracted.invoiceNumber}} due {{extract_invoice.extracted.dueDate}}",
            channels: ["slack", "email", "dashboard"],
            priority: "medium",
            context: { vendor: "{{extract_invoice.extracted.vendor}}", amount: "{{extract_invoice.extracted.amount}}", lineItems: "{{extract_invoice.extracted.lineItems}}" },
            expiresInMinutes: 4320, // 3 days
          },
          dependsOn: ["route_approval"],
        },
        {
          id: "record_payment",
          name: "Record in Accounting",
          type: "action",
          config: {
            action: "update_crm",
            provider: "quickbooks",
            objectType: "invoice",
            properties: { vendor: "{{extract_invoice.extracted.vendor}}", amount: "{{extract_invoice.extracted.amount}}", status: "approved" },
          },
          dependsOn: ["auto_approve_invoice", "request_manager_approval"],
        },
        {
          id: "notify_approval",
          name: "Notify Team",
          type: "action",
          config: { action: "send_slack", channel: "#finance", message: "✅ Invoice approved: {{extract_invoice.extracted.vendor}} — {{extract_invoice.extracted.amount}} {{extract_invoice.extracted.currency}}" },
          dependsOn: ["record_payment"],
        },
      ],
      edges: [
        { from: "extract_invoice", to: "check_duplicates" },
        { from: "extract_invoice", to: "classify_risk" },
        { from: "check_duplicates", to: "classify_risk" },
        { from: "classify_risk", to: "route_approval" },
        { from: "route_approval", to: "auto_approve_invoice", condition: { field: "category", operator: "eq", value: "auto_approve" } },
        { from: "route_approval", to: "request_manager_approval", condition: { field: "category", operator: "neq", value: "auto_approve" } },
        { from: "auto_approve_invoice", to: "record_payment" },
        { from: "request_manager_approval", to: "record_payment" },
        { from: "record_payment", to: "notify_approval" },
      ],
    },

    // ── 2. Expense Audit ────────────────────────────────
    {
      id: "finance-expense-audit",
      name: "Expense Audit",
      description: "Reviews submitted expenses, flags anomalies, routes for approval",
      triggerEvent: "expense.submitted",
      tags: ["expense", "audit", "compliance"],
      estimatedCostCents: 3,
      nodes: [
        {
          id: "load_expense",
          name: "Load Expense Details",
          type: "fetch",
          config: { provider: "internal", operation: "expenses.get", params: { expenseId: "{{trigger.payload.expenseId}}" } },
        },
        {
          id: "audit_expense",
          name: "AI Audit Expense",
          type: "ai_classify",
          config: {
            text: "{{load_expense}}",
            categories: ["compliant", "needs_receipt", "over_policy", "suspicious", "duplicate"],
            context: { submittedBy: "{{trigger.payload.submittedBy}}", department: "{{trigger.payload.department}}" },
            model: "haiku",
          },
          dependsOn: ["load_expense"],
        },
        {
          id: "route_audit",
          name: "Route Audit Result",
          type: "condition",
          config: { category: "{{audit_expense.category}}" },
          dependsOn: ["audit_expense"],
        },
        {
          id: "auto_approve_expense",
          name: "Auto-Approve Compliant",
          type: "action",
          config: { action: "send_slack", channel: "#expenses", message: "✅ Expense auto-approved: {{trigger.payload.submittedBy}} — {{load_expense.amount}}" },
          dependsOn: ["route_audit"],
        },
        {
          id: "flag_for_review",
          name: "Flag for Finance Review",
          type: "approval",
          config: {
            title: "Expense Review: {{trigger.payload.submittedBy}} — {{load_expense.amount}}",
            description: "Flagged as: {{audit_expense.category}}. {{audit_expense.reasoning}}",
            channels: ["slack", "dashboard"],
            priority: "high",
          },
          dependsOn: ["route_audit"],
        },
      ],
      edges: [
        { from: "load_expense", to: "audit_expense" },
        { from: "audit_expense", to: "route_audit" },
        { from: "route_audit", to: "auto_approve_expense", condition: { field: "category", operator: "eq", value: "compliant" } },
        { from: "route_audit", to: "flag_for_review", condition: { field: "category", operator: "neq", value: "compliant" } },
      ],
    },

    // ── 3. Payment Escalation ───────────────────────────
    {
      id: "finance-payment-escalation",
      name: "Payment Escalation",
      description: "Monitors overdue payments, sends reminders, escalates to management",
      triggerEvent: "reconciliation.needed",
      triggerSchedule: "0 9 * * 1-5",
      tags: ["payments", "escalation", "overdue"],
      estimatedCostCents: 4,
      nodes: [
        {
          id: "fetch_overdue",
          name: "Fetch Overdue Invoices",
          type: "fetch",
          config: { provider: "quickbooks", operation: "invoices.overdue", params: {} },
        },
        {
          id: "assess_overdue",
          name: "AI Assess Urgency",
          type: "ai_decide",
          config: {
            question: "Prioritize these overdue invoices for escalation",
            options: ["send_reminder", "escalate_manager", "escalate_legal", "write_off"],
            context: { invoices: "{{fetch_overdue}}" },
            criteria: "Days overdue, amount, customer relationship history",
            model: "sonnet",
          },
          dependsOn: ["fetch_overdue"],
        },
        {
          id: "generate_reminders",
          name: "Generate Reminder Emails",
          type: "ai_generate",
          config: {
            instructions: "Write professional but firm payment reminder emails for each overdue invoice. Tone varies by days overdue: 1-7 days = gentle, 8-30 = firm, 30+ = final notice.",
            context: { invoices: "{{fetch_overdue}}", assessment: "{{assess_overdue}}" },
            model: "haiku",
          },
          dependsOn: ["assess_overdue"],
        },
        {
          id: "send_reminders",
          name: "Send Reminder Emails",
          type: "loop",
          config: { items: "{{generate_reminders.output.emails}}" },
          dependsOn: ["generate_reminders"],
        },
        {
          id: "notify_finance",
          name: "Report to Finance Team",
          type: "action",
          config: { action: "send_slack", channel: "#finance", message: "Overdue payment report: {{fetch_overdue.length}} invoices, {{generate_reminders.output.emails.length}} reminders sent" },
          dependsOn: ["send_reminders"],
        },
      ],
      edges: [
        { from: "fetch_overdue", to: "assess_overdue" },
        { from: "assess_overdue", to: "generate_reminders" },
        { from: "generate_reminders", to: "send_reminders" },
        { from: "send_reminders", to: "notify_finance" },
      ],
    },

    // ── 4. Reconciliation ───────────────────────────────
    {
      id: "finance-reconciliation",
      name: "Bank Reconciliation",
      description: "Weekly automated bank-to-books reconciliation with anomaly detection",
      triggerEvent: "reconciliation.needed",
      triggerSchedule: "0 7 * * 1",
      tags: ["reconciliation", "banking", "weekly"],
      estimatedCostCents: 8,
      nodes: [
        {
          id: "fetch_bank",
          name: "Fetch Bank Transactions",
          type: "fetch",
          config: { provider: "plaid", operation: "transactions.list", params: { period: "last_7_days" } },
        },
        {
          id: "fetch_books",
          name: "Fetch Book Entries",
          type: "fetch",
          config: { provider: "quickbooks", operation: "transactions.list", params: { period: "last_7_days" } },
        },
        {
          id: "match_transactions",
          name: "AI Match Transactions",
          type: "ai_decide",
          config: {
            question: "Match bank transactions to book entries",
            options: ["matched", "unmatched_bank", "unmatched_books", "discrepancy"],
            context: { bank: "{{fetch_bank}}", books: "{{fetch_books}}" },
            criteria: "Match by amount, date (±2 days), and description similarity",
            model: "sonnet",
          },
          dependsOn: ["fetch_bank", "fetch_books"],
        },
        {
          id: "generate_report",
          name: "Generate Reconciliation Report",
          type: "ai_generate",
          config: {
            instructions: "Generate a reconciliation summary: matched count, unmatched items, discrepancies, total variance. Flag anything requiring human attention.",
            context: { matchResults: "{{match_transactions}}" },
            model: "haiku",
          },
          dependsOn: ["match_transactions"],
        },
        {
          id: "send_report",
          name: "Send Report",
          type: "action",
          config: { action: "send_slack", channel: "#finance", message: "{{generate_report.output}}" },
          dependsOn: ["generate_report"],
        },
      ],
      edges: [
        { from: "fetch_bank", to: "match_transactions" },
        { from: "fetch_books", to: "match_transactions" },
        { from: "match_transactions", to: "generate_report" },
        { from: "generate_report", to: "send_report" },
      ],
    },
  ],
};
