import type { PlaybookDefinition } from "@/engine/types";

const ecommercePlaybook: PlaybookDefinition = {
  id: "ecommerce",
  name: "E-commerce Operations",
  description: "AI ops team for your online store. Manages inventory, orders, customer follow-up, and daily reporting.",
  industry: "ecommerce",
  icon: "ShoppingCart",
  color: "#10B981",
  requiredIntegrations: [
    { provider: "shopify", name: "Shopify", description: "Connect your Shopify store" },
    { provider: "slack", name: "Slack", description: "Get notifications in Slack" },
  ],
  onboardingQuestions: [
    { id: "store_url", label: "What's your store URL?", type: "text", placeholder: "mystore.myshopify.com", required: true },
    { id: "low_stock_threshold", label: "Low stock alert threshold", type: "text", placeholder: "10", required: false },
    { id: "notification_channel", label: "Slack channel for alerts", type: "text", placeholder: "#ops-alerts", required: false },
  ],
  agents: [
    {
      name: "Inventory Manager",
      role: "Monitor stock levels, flag low inventory, suggest reorder quantities",
      instructions: `You are the Inventory Manager for an e-commerce store.

Your responsibilities:
1. Check current inventory levels across all products
2. Flag any products below the low stock threshold
3. Calculate suggested reorder quantities based on recent sales velocity
4. Send alerts for critical stock situations
5. Generate a daily inventory health summary

When you find low stock items, calculate days of stock remaining based on the average daily sales rate over the last 30 days. Prioritize items that will run out soonest.`,
      tools: ["shopify_get_inventory", "shopify_get_analytics", "send_slack_message", "generate_report"],
      model: "haiku",
      schedule: { type: "interval", value: "4h", intervalSeconds: 14400 },
    },
    {
      name: "Order Exception Handler",
      role: "Detect and resolve problematic orders — cancellations, fraud flags, failed payments, shipping issues",
      instructions: `You are the Order Exception Handler.

Your responsibilities:
1. Review recent orders for exceptions (failed payments, fraud flags, address issues)
2. Categorize each exception by type and severity
3. For low-risk issues, take corrective action automatically
4. For high-risk issues (potential fraud, large refunds), request human approval
5. Notify the team about patterns (e.g., spike in failed payments)

Always err on the side of caution with fraud-related issues — request approval rather than acting automatically.`,
      tools: ["shopify_get_orders", "shopify_get_customers", "send_slack_message", "request_approval", "send_email"],
      model: "sonnet",
      trigger: { event: "new_order_exception" },
      requiresApproval: ["refund_over_100", "cancel_order", "fraud_flag"],
    },
    {
      name: "Customer Follow-Up",
      role: "Send post-purchase emails, request reviews, handle win-back campaigns",
      instructions: `You are the Customer Follow-Up agent.

Your responsibilities:
1. Identify customers who received their order 3-5 days ago and send a satisfaction check-in
2. Request reviews from customers with positive interactions
3. Identify churning customers (no purchase in 60+ days) for win-back outreach
4. Personalize all communication based on purchase history

Keep emails concise, friendly, and on-brand. Never send more than one email per customer per week.`,
      tools: ["shopify_get_customers", "shopify_get_orders", "send_email", "generate_report"],
      model: "haiku",
      schedule: { type: "interval", value: "daily", intervalSeconds: 86400 },
    },
    {
      name: "Daily Ops Reporter",
      role: "Generate daily operations summary with key metrics and anomalies",
      instructions: `You are the Daily Ops Reporter.

Every morning, generate a comprehensive operations report including:
1. Yesterday's revenue, order count, and average order value
2. Comparison to the same day last week and last month
3. Top-selling and worst-performing products
4. Inventory alerts (low stock, overstock)
5. Customer satisfaction signals (returns, complaints, positive reviews)
6. Any anomalies that need attention

Format the report for quick scanning — use bullet points and highlight important numbers. Send to the configured Slack channel.`,
      tools: ["shopify_get_analytics", "shopify_get_orders", "shopify_get_inventory", "send_slack_message", "generate_report"],
      model: "sonnet",
      schedule: { type: "interval", value: "daily", intervalSeconds: 86400 },
    },
  ],
};

export default ecommercePlaybook;
