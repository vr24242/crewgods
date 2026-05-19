import type { WorkflowDAG } from "../../workflows/types";

// ═══════════════════════════════════════════════════════
// E-COMMERCE VERTICAL — 4 Workflow DAGs
// ═══════════════════════════════════════════════════════

// ── 1. Inventory Monitoring ─────────────────────────────
// Trigger: Every 4 hours
// Flow: Fetch inventory → Analyze levels → Branch (low stock?) →
//       Generate alerts → Notify team → Emit reorder event

export const inventoryMonitoring: WorkflowDAG = {
  id: "ecom-inventory-monitoring",
  name: "Inventory Monitoring",
  vertical: "ecommerce",
  description: "Monitors stock levels, flags low inventory, calculates reorder quantities based on sales velocity",
  version: "1.0.0",
  trigger: {
    type: "schedule",
    cron: "0 */4 * * *", // every 4 hours
  },
  nodes: [
    {
      id: "fetch_inventory",
      name: "Fetch Current Inventory",
      type: "fetch",
      config: {
        integration: "shopify",
        operation: "inventory.list",
        inputMap: {
          includeVariants: { source: "static", value: true },
        },
        outputSchema: {
          type: "object",
          properties: {
            products: { type: "array" },
            totalProducts: { type: "number" },
          },
        },
      },
      timeout: 30,
      retries: 2,
    },
    {
      id: "fetch_sales_velocity",
      name: "Fetch 30-Day Sales Data",
      type: "fetch",
      config: {
        integration: "shopify",
        operation: "analytics.salesByProduct",
        inputMap: {
          period: { source: "static", value: "last_30_days" },
        },
      },
      timeout: 30,
      retries: 2,
    },
    {
      id: "analyze_levels",
      name: "Analyze Stock Levels",
      type: "ai_decide",
      config: {
        inputMap: {
          inventory: { source: "node", nodeId: "fetch_inventory", path: "products" },
          salesData: { source: "node", nodeId: "fetch_sales_velocity", path: "salesByProduct" },
          threshold: { source: "integration", provider: "settings", path: "lowStockThreshold" },
        },
      },
      agent: {
        role: "Inventory Manager",
        model: "haiku",
        instructions: `Analyze inventory levels against sales velocity.
For each product calculate:
- Current stock quantity
- Average daily sales (last 30 days)
- Days of stock remaining (stock / daily_sales)
- Suggested reorder quantity (30 days of stock)

Categorize each product as:
- CRITICAL: < 3 days of stock remaining
- LOW: < 7 days of stock remaining
- ADEQUATE: 7-30 days
- OVERSTOCKED: > 60 days

Return structured JSON with: criticalItems[], lowItems[], reorderSuggestions[], summary.`,
      },
      timeout: 60,
    },
    {
      id: "branch_alerts",
      name: "Check If Alerts Needed",
      type: "branch",
      config: {
        inputMap: {
          criticalCount: { source: "node", nodeId: "analyze_levels", path: "criticalItems.length" },
          lowCount: { source: "node", nodeId: "analyze_levels", path: "lowItems.length" },
        },
      },
    },
    {
      id: "generate_alert",
      name: "Generate Alert Message",
      type: "ai_generate",
      config: {
        inputMap: {
          criticalItems: { source: "node", nodeId: "analyze_levels", path: "criticalItems" },
          lowItems: { source: "node", nodeId: "analyze_levels", path: "lowItems" },
          reorderSuggestions: { source: "node", nodeId: "analyze_levels", path: "reorderSuggestions" },
        },
      },
      agent: {
        role: "Inventory Manager",
        model: "haiku",
        instructions: "Format a concise Slack alert. Lead with critical items. Include product name, current stock, days remaining, and suggested reorder qty. Use emoji for severity.",
      },
    },
    {
      id: "notify_slack",
      name: "Send Slack Alert",
      type: "action",
      config: {
        integration: "slack",
        operation: "chat.postMessage",
        inputMap: {
          channel: { source: "integration", provider: "settings", path: "notificationChannel" },
          message: { source: "node", nodeId: "generate_alert", path: "message" },
        },
      },
    },
    {
      id: "emit_reorder",
      name: "Emit Reorder Events",
      type: "emit",
      config: {
        inputMap: {
          event: { source: "static", value: "inventory.reorder_needed" },
          data: { source: "node", nodeId: "analyze_levels", path: "reorderSuggestions" },
        },
      },
    },
    {
      id: "log_healthy",
      name: "Log Healthy Status",
      type: "action",
      config: {
        integration: "internal",
        operation: "activity.log",
        inputMap: {
          summary: { source: "node", nodeId: "analyze_levels", path: "summary" },
          status: { source: "static", value: "healthy" },
        },
      },
    },
  ],
  edges: [
    { from: "fetch_inventory", to: "analyze_levels" },
    { from: "fetch_sales_velocity", to: "analyze_levels" },
    { from: "analyze_levels", to: "branch_alerts" },
    { from: "branch_alerts", to: "generate_alert", condition: { type: "output_gt", field: "criticalCount", value: 0 }, label: "has critical items" },
    { from: "branch_alerts", to: "log_healthy", condition: { type: "output_equals", field: "criticalCount", value: 0 }, label: "all healthy" },
    { from: "generate_alert", to: "notify_slack" },
    { from: "notify_slack", to: "emit_reorder" },
  ],
  errorHandler: {
    onNodeFailure: "retry",
    maxRetries: 2,
    retryDelaySeconds: 60,
    notifyChannel: "#ops-alerts",
  },
  metadata: {
    estimatedDurationMs: 15000,
    estimatedCostCents: 2,
    tags: ["inventory", "monitoring", "alerts"],
    requiredIntegrations: ["shopify", "slack"],
    requiredApprovals: [],
  },
};

// ── 2. Order Exception Handling ─────────────────────────
// Trigger: Webhook (order created/updated with issues)
// Flow: Receive order → Classify exception → Branch by type →
//       Auto-resolve OR request approval → Notify → Update order

export const orderExceptionHandling: WorkflowDAG = {
  id: "ecom-order-exception",
  name: "Order Exception Handling",
  vertical: "ecommerce",
  description: "Detects and resolves problematic orders — failed payments, fraud flags, address issues, fulfillment errors",
  version: "1.0.0",
  trigger: {
    type: "webhook",
    provider: "shopify",
    event: "orders/updated",
    filter: { financial_status: ["pending", "voided", "refunded"], fulfillment_status: ["null", "partial"] },
  },
  nodes: [
    {
      id: "receive_order",
      name: "Parse Order Event",
      type: "transform",
      config: {
        inputMap: {
          order: { source: "trigger", path: "order" },
        },
      },
    },
    {
      id: "fetch_customer",
      name: "Fetch Customer History",
      type: "fetch",
      config: {
        integration: "shopify",
        operation: "customers.get",
        inputMap: {
          customerId: { source: "node", nodeId: "receive_order", path: "order.customer.id" },
        },
      },
    },
    {
      id: "classify_exception",
      name: "Classify Exception Type",
      type: "ai_decide",
      config: {
        inputMap: {
          order: { source: "node", nodeId: "receive_order", path: "order" },
          customerHistory: { source: "node", nodeId: "fetch_customer", path: "customer" },
        },
      },
      agent: {
        role: "Order Exception Handler",
        model: "sonnet",
        instructions: `Classify this order exception. Return JSON with:
- exceptionType: "payment_failed" | "suspected_fraud" | "address_invalid" | "item_unavailable" | "fulfillment_error" | "duplicate_order" | "price_mismatch"
- severity: "low" | "medium" | "high" | "critical"
- riskScore: 0-100 (fraud likelihood)
- suggestedAction: what to do
- autoResolvable: boolean (true if safe to fix without human)
- reasoning: why you classified it this way

Fraud signals: mismatched billing/shipping, high-value first order, known proxy IP, velocity (multiple orders in short time).`,
      },
      timeout: 30,
    },
    {
      id: "branch_severity",
      name: "Route by Severity",
      type: "branch",
      config: {
        inputMap: {
          autoResolvable: { source: "node", nodeId: "classify_exception", path: "autoResolvable" },
          severity: { source: "node", nodeId: "classify_exception", path: "severity" },
        },
      },
    },
    {
      id: "auto_resolve",
      name: "Auto-Resolve Exception",
      type: "action",
      config: {
        integration: "shopify",
        operation: "orders.update",
        inputMap: {
          orderId: { source: "node", nodeId: "receive_order", path: "order.id" },
          action: { source: "node", nodeId: "classify_exception", path: "suggestedAction" },
        },
      },
    },
    {
      id: "request_approval",
      name: "Request Human Approval",
      type: "approval",
      config: {
        inputMap: {
          title: { source: "template", template: "Order #{{receive_order.order.name}} — {{classify_exception.exceptionType}}" },
          description: { source: "node", nodeId: "classify_exception", path: "reasoning" },
          suggestedAction: { source: "node", nodeId: "classify_exception", path: "suggestedAction" },
          severity: { source: "node", nodeId: "classify_exception", path: "severity" },
          orderTotal: { source: "node", nodeId: "receive_order", path: "order.total_price" },
        },
      },
      agent: { role: "Order Exception Handler", model: "sonnet" },
    },
    {
      id: "execute_approved",
      name: "Execute Approved Action",
      type: "action",
      config: {
        integration: "shopify",
        operation: "orders.update",
        inputMap: {
          orderId: { source: "node", nodeId: "receive_order", path: "order.id" },
          action: { source: "node", nodeId: "classify_exception", path: "suggestedAction" },
        },
      },
    },
    {
      id: "notify_rejection",
      name: "Log Rejection",
      type: "action",
      config: {
        integration: "internal",
        operation: "activity.log",
        inputMap: {
          summary: { source: "template", template: "Order #{{receive_order.order.name}} exception rejected by human reviewer" },
        },
      },
    },
    {
      id: "notify_resolution",
      name: "Notify Team of Resolution",
      type: "action",
      config: {
        integration: "slack",
        operation: "chat.postMessage",
        inputMap: {
          channel: { source: "integration", provider: "settings", path: "notificationChannel" },
          message: { source: "template", template: "Resolved: Order #{{receive_order.order.name}} — {{classify_exception.exceptionType}} ({{classify_exception.severity}})" },
        },
      },
    },
    {
      id: "email_customer",
      name: "Email Customer Update",
      type: "ai_generate",
      config: {
        inputMap: {
          order: { source: "node", nodeId: "receive_order", path: "order" },
          exceptionType: { source: "node", nodeId: "classify_exception", path: "exceptionType" },
          resolution: { source: "node", nodeId: "classify_exception", path: "suggestedAction" },
        },
      },
      agent: {
        role: "Order Exception Handler",
        model: "haiku",
        instructions: "Write a brief, friendly email to the customer explaining what happened and what was done. Don't mention internal processes or fraud checks. Be reassuring.",
      },
    },
  ],
  edges: [
    { from: "receive_order", to: "fetch_customer" },
    { from: "receive_order", to: "classify_exception" },
    { from: "fetch_customer", to: "classify_exception" },
    { from: "classify_exception", to: "branch_severity" },
    { from: "branch_severity", to: "auto_resolve", condition: { type: "output_equals", field: "autoResolvable", value: true }, label: "auto-resolvable" },
    { from: "branch_severity", to: "request_approval", condition: { type: "output_equals", field: "autoResolvable", value: false }, label: "needs approval" },
    { from: "auto_resolve", to: "notify_resolution" },
    { from: "request_approval", to: "execute_approved", condition: { type: "approved" } },
    { from: "request_approval", to: "notify_rejection", condition: { type: "rejected" } },
    { from: "execute_approved", to: "notify_resolution" },
    { from: "notify_resolution", to: "email_customer" },
  ],
  errorHandler: {
    onNodeFailure: "escalate",
    maxRetries: 1,
    retryDelaySeconds: 30,
    escalateTo: "Order Exception Handler",
    notifyChannel: "#ops-alerts",
  },
  metadata: {
    estimatedDurationMs: 30000,
    estimatedCostCents: 8,
    tags: ["orders", "exceptions", "fraud", "payments"],
    requiredIntegrations: ["shopify", "slack"],
    requiredApprovals: ["refund_over_100", "cancel_order", "fraud_flag"],
  },
};

// ── 3. Customer Follow-Up ───────────────────────────────
// Trigger: Daily at 9am
// Flow: Fetch delivered orders → Filter eligible → Generate emails →
//       Approval gate → Send emails → Log activity

export const customerFollowUp: WorkflowDAG = {
  id: "ecom-customer-followup",
  name: "Customer Follow-Up",
  vertical: "ecommerce",
  description: "Post-purchase follow-up: satisfaction check-ins, review requests, and win-back campaigns",
  version: "1.0.0",
  trigger: {
    type: "schedule",
    cron: "0 9 * * *", // daily at 9am
  },
  nodes: [
    {
      id: "fetch_delivered",
      name: "Fetch Recently Delivered Orders",
      type: "fetch",
      config: {
        integration: "shopify",
        operation: "orders.list",
        inputMap: {
          fulfillmentStatus: { source: "static", value: "fulfilled" },
          deliveredDaysAgo: { source: "static", value: { min: 3, max: 5 } },
        },
      },
      timeout: 30,
    },
    {
      id: "fetch_churning",
      name: "Fetch Churning Customers",
      type: "fetch",
      config: {
        integration: "shopify",
        operation: "customers.list",
        inputMap: {
          lastOrderDaysAgo: { source: "static", value: { min: 60 } },
          totalOrders: { source: "static", value: { min: 2 } },
        },
      },
      timeout: 30,
    },
    {
      id: "filter_eligible",
      name: "Filter Eligible Customers",
      type: "transform",
      config: {
        inputMap: {
          deliveredOrders: { source: "node", nodeId: "fetch_delivered", path: "orders" },
          churningCustomers: { source: "node", nodeId: "fetch_churning", path: "customers" },
        },
        params: {
          rules: [
            "exclude customers emailed in last 7 days",
            "exclude customers who opted out",
            "max 20 follow-ups per day",
            "max 10 win-back per day",
          ],
        },
      },
    },
    {
      id: "generate_followups",
      name: "Generate Follow-Up Emails",
      type: "ai_generate",
      config: {
        inputMap: {
          eligibleOrders: { source: "node", nodeId: "filter_eligible", path: "followUpEligible" },
          churningCustomers: { source: "node", nodeId: "filter_eligible", path: "winBackEligible" },
        },
      },
      agent: {
        role: "Customer Follow-Up",
        model: "haiku",
        instructions: `Generate personalized emails for each customer.

Follow-up emails (post-delivery):
- Thank them for their purchase (mention specific product)
- Ask about their experience
- Include a review request link
- Keep under 100 words

Win-back emails (churning):
- Acknowledge it's been a while
- Mention what's new since their last purchase
- Optional: include a small discount code (request approval first)
- Keep warm and non-pushy

Return JSON array of { customerId, email, subject, body, type: "followup" | "winback" }`,
      },
      timeout: 120,
    },
    {
      id: "loop_send",
      name: "Send Each Email",
      type: "loop",
      config: {
        inputMap: {
          items: { source: "node", nodeId: "generate_followups", path: "emails" },
        },
        params: {
          itemNode: "send_single_email",
          maxConcurrency: 5,
          delayBetweenMs: 2000,
        },
      },
    },
    {
      id: "send_single_email",
      name: "Send Email",
      type: "action",
      config: {
        integration: "email",
        operation: "send",
        inputMap: {
          to: { source: "node", nodeId: "loop_send", path: "currentItem.email" },
          subject: { source: "node", nodeId: "loop_send", path: "currentItem.subject" },
          body: { source: "node", nodeId: "loop_send", path: "currentItem.body" },
        },
      },
    },
    {
      id: "log_summary",
      name: "Log Follow-Up Summary",
      type: "action",
      config: {
        integration: "slack",
        operation: "chat.postMessage",
        inputMap: {
          channel: { source: "integration", provider: "settings", path: "notificationChannel" },
          message: { source: "template", template: "Customer follow-up complete: {{generate_followups.emails.length}} emails sent" },
        },
      },
    },
  ],
  edges: [
    { from: "fetch_delivered", to: "filter_eligible" },
    { from: "fetch_churning", to: "filter_eligible" },
    { from: "filter_eligible", to: "generate_followups" },
    { from: "generate_followups", to: "loop_send" },
    { from: "loop_send", to: "send_single_email" },
    { from: "loop_send", to: "log_summary" },
  ],
  errorHandler: {
    onNodeFailure: "skip",
    maxRetries: 1,
    retryDelaySeconds: 30,
    notifyChannel: "#ops-alerts",
  },
  metadata: {
    estimatedDurationMs: 60000,
    estimatedCostCents: 5,
    tags: ["customers", "email", "retention", "reviews"],
    requiredIntegrations: ["shopify", "email", "slack"],
    requiredApprovals: [],
  },
};

// ── 4. Daily Operations Report ──────────────────────────
// Trigger: Daily at 8am
// Flow: Fetch all metrics (parallel) → AI analyze → Generate report →
//       Send to Slack

export const dailyOpsReport: WorkflowDAG = {
  id: "ecom-daily-report",
  name: "Daily Operations Report",
  vertical: "ecommerce",
  description: "Comprehensive daily report: revenue, orders, inventory health, customer metrics, and anomaly detection",
  version: "1.0.0",
  trigger: {
    type: "schedule",
    cron: "0 8 * * *", // daily at 8am
  },
  nodes: [
    {
      id: "fetch_yesterday_sales",
      name: "Fetch Yesterday Sales",
      type: "fetch",
      config: {
        integration: "shopify",
        operation: "analytics.summary",
        inputMap: { period: { source: "static", value: "yesterday" } },
      },
    },
    {
      id: "fetch_last_week",
      name: "Fetch Last Week Same Day",
      type: "fetch",
      config: {
        integration: "shopify",
        operation: "analytics.summary",
        inputMap: { period: { source: "static", value: "same_day_last_week" } },
      },
    },
    {
      id: "fetch_inventory_health",
      name: "Fetch Inventory Snapshot",
      type: "fetch",
      config: {
        integration: "shopify",
        operation: "inventory.summary",
        inputMap: {},
      },
    },
    {
      id: "fetch_returns",
      name: "Fetch Returns & Refunds",
      type: "fetch",
      config: {
        integration: "shopify",
        operation: "refunds.list",
        inputMap: { period: { source: "static", value: "yesterday" } },
      },
    },
    {
      id: "analyze_metrics",
      name: "Analyze & Compare Metrics",
      type: "ai_decide",
      config: {
        inputMap: {
          yesterday: { source: "node", nodeId: "fetch_yesterday_sales", path: "summary" },
          lastWeek: { source: "node", nodeId: "fetch_last_week", path: "summary" },
          inventory: { source: "node", nodeId: "fetch_inventory_health", path: "summary" },
          returns: { source: "node", nodeId: "fetch_returns", path: "refunds" },
        },
      },
      agent: {
        role: "Daily Ops Reporter",
        model: "sonnet",
        instructions: `Analyze yesterday's performance vs last week same day. Identify:
1. Revenue trend (up/down/flat, % change)
2. Order volume trend
3. Average order value change
4. Top 5 selling products
5. Worst 5 performing products
6. Inventory alerts (items at risk)
7. Return rate and reasons
8. Any anomalies (unusual spikes, drops, patterns)

Return structured JSON with all metrics and a brief executive summary (2-3 sentences).`,
      },
    },
    {
      id: "generate_report",
      name: "Format Slack Report",
      type: "ai_generate",
      config: {
        inputMap: {
          analysis: { source: "node", nodeId: "analyze_metrics", path: "" },
        },
      },
      agent: {
        role: "Daily Ops Reporter",
        model: "haiku",
        instructions: "Format the analysis into a clean Slack message. Use bold for headings, bullet points for metrics, and emoji indicators (green/red/yellow circles) for trends. Keep it scannable — a busy store owner should get the gist in 10 seconds.",
      },
    },
    {
      id: "send_report",
      name: "Post to Slack",
      type: "action",
      config: {
        integration: "slack",
        operation: "chat.postMessage",
        inputMap: {
          channel: { source: "integration", provider: "settings", path: "notificationChannel" },
          message: { source: "node", nodeId: "generate_report", path: "message" },
        },
      },
    },
  ],
  edges: [
    // Parallel fetch
    { from: "fetch_yesterday_sales", to: "analyze_metrics" },
    { from: "fetch_last_week", to: "analyze_metrics" },
    { from: "fetch_inventory_health", to: "analyze_metrics" },
    { from: "fetch_returns", to: "analyze_metrics" },
    // Sequential analysis → report → send
    { from: "analyze_metrics", to: "generate_report" },
    { from: "generate_report", to: "send_report" },
  ],
  errorHandler: {
    onNodeFailure: "retry",
    maxRetries: 2,
    retryDelaySeconds: 120,
    notifyChannel: "#ops-alerts",
  },
  metadata: {
    estimatedDurationMs: 30000,
    estimatedCostCents: 6,
    tags: ["reporting", "analytics", "daily"],
    requiredIntegrations: ["shopify", "slack"],
    requiredApprovals: [],
  },
};

export const ecommerceWorkflows = [
  inventoryMonitoring,
  orderExceptionHandling,
  customerFollowUp,
  dailyOpsReport,
];
