import type { VerticalDefinition } from "../workflows/types";

import { ecommerceWorkflows } from "./ecommerce/workflows";
import { customerSupportWorkflows } from "./customer-support/workflows";
import { financeWorkflows } from "./finance/workflows";
import { salesWorkflows } from "./sales/workflows";
import { contentMarketingWorkflows } from "./content-marketing/workflows";
import { hrRecruitingWorkflows } from "./hr-recruiting/workflows";
import { legalWorkflows } from "./legal/workflows";
import { devopsWorkflows } from "./devops/workflows";

export const ecommerce: VerticalDefinition = {
  id: "ecommerce",
  name: "E-Commerce Operations",
  description: "Automate inventory, orders, customer engagement, and daily reporting for online stores",
  industry: "E-Commerce & Retail",
  icon: "🛒",
  color: "#10B981",
  workflows: ecommerceWorkflows,
  agents: [
    { name: "Inventory Monitor", role: "Inventory Analyst", systemPrompt: "You monitor inventory levels, predict stockouts, and trigger reorder alerts.", defaultModel: "sonnet", tools: ["shopify_get_inventory", "shopify_get_orders", "send_slack_message"], schedule: "0 */4 * * *", budgetMonthlyCents: 500 },
    { name: "Order Exception Handler", role: "Order Analyst", systemPrompt: "You classify and resolve order exceptions: cancellations, fraud flags, fulfillment issues.", defaultModel: "sonnet", tools: ["shopify_get_orders", "send_email", "send_slack_message", "request_approval"], budgetMonthlyCents: 800 },
    { name: "Customer Follow-Up", role: "Customer Success", systemPrompt: "You generate personalized follow-up emails for post-purchase engagement and churn prevention.", defaultModel: "haiku", tools: ["shopify_get_orders", "send_email"], schedule: "0 9 * * *", budgetMonthlyCents: 300 },
    { name: "Ops Reporter", role: "Operations Analyst", systemPrompt: "You compile daily e-commerce metrics into executive reports.", defaultModel: "haiku", tools: ["shopify_get_orders", "shopify_get_inventory", "send_slack_message", "generate_report"], schedule: "0 8 * * *", budgetMonthlyCents: 200 },
  ],
  integrations: [
    { provider: "shopify", name: "Shopify", description: "E-commerce platform for orders, inventory, and customers", scopes: ["read_orders", "read_products", "read_inventory", "write_inventory"], webhooks: ["orders/updated", "products/update"] },
    { provider: "slack", name: "Slack", description: "Team messaging for alerts and reports", scopes: ["chat:write", "channels:read"] },
    { provider: "email", name: "Email (SMTP/SendGrid)", description: "Customer communication", scopes: ["send"] },
  ],
  onboarding: [
    { id: "shopify_connect", type: "oauth", label: "Connect Shopify Store", description: "Grant access to your Shopify store for order and inventory data", required: true },
    { id: "slack_connect", type: "oauth", label: "Connect Slack", required: true },
    { id: "reorder_threshold", type: "input", label: "Default Reorder Threshold", description: "Minimum stock level before triggering alerts", required: false, config: { type: "number", default: 10 } },
    { id: "alert_channel", type: "select", label: "Alert Slack Channel", required: true },
  ],
};

export const customerSupport: VerticalDefinition = {
  id: "customer-support",
  name: "Customer Support",
  description: "Automate ticket triage, auto-response, escalation management, and satisfaction reporting",
  industry: "Customer Service",
  icon: "🎧",
  color: "#6366F1",
  workflows: customerSupportWorkflows,
  agents: [
    { name: "Ticket Triage", role: "Support Classifier", systemPrompt: "You classify incoming tickets by category, priority, and sentiment. Route to the right team.", defaultModel: "haiku", tools: ["support_get_tickets", "send_slack_message"], budgetMonthlyCents: 400 },
    { name: "Auto Responder", role: "Support Agent", systemPrompt: "You draft responses to common support queries using the knowledge base.", defaultModel: "sonnet", tools: ["support_get_tickets", "support_reply_ticket"], budgetMonthlyCents: 600 },
    { name: "Escalation Manager", role: "Support Lead", systemPrompt: "You monitor stale and high-priority tickets and trigger escalations.", defaultModel: "haiku", tools: ["support_get_tickets", "send_slack_message"], schedule: "0 * * * *", budgetMonthlyCents: 200 },
    { name: "CSAT Reporter", role: "Quality Analyst", systemPrompt: "You analyze customer satisfaction trends and agent performance.", defaultModel: "haiku", tools: ["support_get_tickets", "generate_report", "send_slack_message"], schedule: "0 18 * * *", budgetMonthlyCents: 150 },
  ],
  integrations: [
    { provider: "zendesk", name: "Zendesk", description: "Support ticket management", scopes: ["tickets:read", "tickets:write", "users:read"], webhooks: ["ticket.created", "ticket.updated"] },
    { provider: "slack", name: "Slack", description: "Internal alerts and escalations", scopes: ["chat:write", "channels:read"] },
  ],
  onboarding: [
    { id: "zendesk_connect", type: "oauth", label: "Connect Zendesk", required: true },
    { id: "slack_connect", type: "oauth", label: "Connect Slack", required: true },
    { id: "auto_respond_confidence", type: "input", label: "Auto-Response Confidence Threshold", description: "Minimum confidence (0-100) to auto-send responses", required: false, config: { type: "number", default: 85 } },
    { id: "escalation_hours", type: "input", label: "Escalation After (hours)", description: "Hours before a ticket is considered stale", required: false, config: { type: "number", default: 4 } },
  ],
};

export const finance: VerticalDefinition = {
  id: "finance",
  name: "Finance & Accounting",
  description: "Automate transaction categorization, reconciliation, anomaly detection, and month-end close",
  industry: "Finance",
  icon: "💰",
  color: "#F59E0B",
  workflows: financeWorkflows,
  agents: [
    { name: "Transaction Categorizer", role: "Bookkeeper", systemPrompt: "You categorize financial transactions against the chart of accounts with high accuracy.", defaultModel: "sonnet", tools: ["accounting_get_transactions", "send_slack_message"], schedule: "0 */6 * * *", budgetMonthlyCents: 600 },
    { name: "Reconciliation Agent", role: "Reconciliation Specialist", systemPrompt: "You match bank transactions to invoices and flag discrepancies.", defaultModel: "sonnet", tools: ["accounting_get_transactions", "generate_report", "send_slack_message"], schedule: "0 7 * * 1", budgetMonthlyCents: 400 },
    { name: "Anomaly Detector", role: "Financial Analyst", systemPrompt: "You detect unusual spending patterns, duplicate payments, and fraudulent transactions.", defaultModel: "sonnet", tools: ["accounting_get_transactions", "send_slack_message", "request_approval"], schedule: "0 9 * * *", budgetMonthlyCents: 500 },
    { name: "Month-End Close", role: "Controller", systemPrompt: "You coordinate month-end close: generate checklists, check reconciliation status, create tasks.", defaultModel: "opus", tools: ["accounting_get_transactions", "create_task", "send_slack_message", "generate_report"], budgetMonthlyCents: 300 },
  ],
  integrations: [
    { provider: "quickbooks", name: "QuickBooks", description: "Accounting and bookkeeping", scopes: ["accounting", "payments"], webhooks: ["transaction.created"] },
    { provider: "plaid", name: "Plaid", description: "Bank account connection for transaction data", scopes: ["transactions:read", "accounts:read"] },
    { provider: "slack", name: "Slack", description: "Team notifications", scopes: ["chat:write"] },
  ],
  onboarding: [
    { id: "quickbooks_connect", type: "oauth", label: "Connect QuickBooks", required: true },
    { id: "plaid_connect", type: "oauth", label: "Connect Bank Account", description: "Via Plaid for bank transaction data", required: true },
    { id: "slack_connect", type: "oauth", label: "Connect Slack", required: true },
    { id: "anomaly_threshold", type: "input", label: "Anomaly Detection Threshold", description: "Standard deviations from average to flag (default: 3)", required: false, config: { type: "number", default: 3 } },
  ],
};

export const sales: VerticalDefinition = {
  id: "sales",
  name: "Sales & CRM",
  description: "Automate lead research, outreach sequences, follow-ups, and pipeline reporting",
  industry: "Sales",
  icon: "📈",
  color: "#EF4444",
  workflows: salesWorkflows,
  agents: [
    { name: "Lead Researcher", role: "Sales Development Rep", systemPrompt: "You research new leads, enrich with company data, and score against ICP criteria.", defaultModel: "sonnet", tools: ["crm_get_leads", "send_slack_message"], schedule: "0 */4 * * 1-5", budgetMonthlyCents: 800 },
    { name: "Outreach Writer", role: "Sales Rep", systemPrompt: "You craft personalized cold outreach emails based on lead research and company context.", defaultModel: "sonnet", tools: ["crm_get_leads", "send_email", "request_approval"], budgetMonthlyCents: 600 },
    { name: "Follow-Up Manager", role: "Sales Rep", systemPrompt: "You manage multi-touch follow-up sequences and determine optimal timing.", defaultModel: "haiku", tools: ["crm_get_leads", "send_email"], schedule: "0 10 * * 1-5", budgetMonthlyCents: 400 },
    { name: "Pipeline Reporter", role: "Sales Operations", systemPrompt: "You analyze pipeline health, forecast revenue, and surface at-risk deals.", defaultModel: "sonnet", tools: ["crm_get_leads", "generate_report", "send_slack_message"], schedule: "0 8 * * 1-5", budgetMonthlyCents: 300 },
  ],
  integrations: [
    { provider: "hubspot", name: "HubSpot", description: "CRM for leads, contacts, and deals", scopes: ["contacts", "deals", "engagements"], webhooks: ["contact.creation", "deal.propertyChange"] },
    { provider: "clearbit", name: "Clearbit", description: "Lead enrichment and company data", scopes: ["enrichment"] },
    { provider: "slack", name: "Slack", description: "Pipeline alerts and reports", scopes: ["chat:write"] },
    { provider: "email", name: "Email", description: "Outreach and follow-ups", scopes: ["send"] },
  ],
  onboarding: [
    { id: "hubspot_connect", type: "oauth", label: "Connect HubSpot", required: true },
    { id: "clearbit_connect", type: "oauth", label: "Connect Clearbit", description: "For lead enrichment", required: false },
    { id: "slack_connect", type: "oauth", label: "Connect Slack", required: true },
    { id: "icp_criteria", type: "input", label: "Ideal Customer Profile", description: "Describe your target customer (industry, size, tech stack)", required: true, config: { type: "textarea" } },
  ],
};

export const contentMarketing: VerticalDefinition = {
  id: "content-marketing",
  name: "Content Marketing",
  description: "Automate content planning, writing pipeline, social distribution, and performance tracking",
  industry: "Marketing",
  icon: "✍️",
  color: "#8B5CF6",
  workflows: contentMarketingWorkflows,
  agents: [
    { name: "Content Planner", role: "Content Strategist", systemPrompt: "You plan weekly content based on performance data, trends, and editorial calendar.", defaultModel: "sonnet", tools: ["cms_get_posts", "send_slack_message"], schedule: "0 9 * * 1", budgetMonthlyCents: 400 },
    { name: "Content Writer", role: "Content Creator", systemPrompt: "You write blog posts from outline to SEO-optimized draft, matching brand voice.", defaultModel: "opus", tools: ["cms_get_posts"], budgetMonthlyCents: 1500 },
    { name: "Social Distributor", role: "Social Media Manager", systemPrompt: "You repurpose content into platform-specific social posts.", defaultModel: "haiku", tools: ["social_post", "send_slack_message"], budgetMonthlyCents: 300 },
    { name: "Performance Tracker", role: "Marketing Analyst", systemPrompt: "You analyze content performance across traffic, engagement, and conversions.", defaultModel: "sonnet", tools: ["generate_report", "send_slack_message"], schedule: "0 9 * * 5", budgetMonthlyCents: 250 },
  ],
  integrations: [
    { provider: "cms", name: "CMS (WordPress/Ghost)", description: "Content management system", scopes: ["posts:read", "posts:write"] },
    { provider: "analytics", name: "Google Analytics", description: "Traffic and conversion data", scopes: ["analytics:read"] },
    { provider: "social", name: "Buffer/Hootsuite", description: "Social media scheduling", scopes: ["posts:write", "analytics:read"] },
    { provider: "slack", name: "Slack", description: "Team coordination", scopes: ["chat:write"] },
  ],
  onboarding: [
    { id: "cms_connect", type: "oauth", label: "Connect CMS", required: true },
    { id: "analytics_connect", type: "oauth", label: "Connect Google Analytics", required: true },
    { id: "social_connect", type: "oauth", label: "Connect Social Scheduler", required: false },
    { id: "brand_tone", type: "input", label: "Brand Voice & Tone", description: "Describe your brand's writing style", required: true, config: { type: "textarea" } },
    { id: "core_topics", type: "input", label: "Core Topics", description: "Comma-separated list of topics you cover", required: true },
  ],
};

export const hrRecruiting: VerticalDefinition = {
  id: "hr-recruiting",
  name: "HR & Recruiting",
  description: "Automate resume screening, interview scheduling, onboarding, and employee Q&A",
  industry: "Human Resources",
  icon: "👥",
  color: "#EC4899",
  workflows: hrRecruitingWorkflows,
  agents: [
    { name: "Resume Screener", role: "Recruiter", systemPrompt: "You screen resumes against job requirements with a focus on skills and experience, flagging potential bias.", defaultModel: "sonnet", tools: ["ats_get_candidates", "send_slack_message"], budgetMonthlyCents: 600 },
    { name: "Interview Scheduler", role: "Recruiting Coordinator", systemPrompt: "You coordinate interview scheduling between candidates and interviewers.", defaultModel: "haiku", tools: ["ats_get_candidates", "send_email"], schedule: "0 */2 * * 1-5", budgetMonthlyCents: 200 },
    { name: "Onboarding Coordinator", role: "HR Operations", systemPrompt: "You manage new hire onboarding: checklists, IT setup, welcome communications.", defaultModel: "sonnet", tools: ["ats_get_candidates", "create_task", "send_email", "send_slack_message"], budgetMonthlyCents: 300 },
    { name: "HR Q&A Bot", role: "HR Assistant", systemPrompt: "You answer employee questions about policies, benefits, and procedures. Escalate when uncertain.", defaultModel: "haiku", tools: ["send_slack_message"], budgetMonthlyCents: 200 },
  ],
  integrations: [
    { provider: "greenhouse", name: "Greenhouse", description: "Applicant tracking system", scopes: ["candidates:read", "candidates:write", "jobs:read"], webhooks: ["candidate.application_created", "candidate.hired"] },
    { provider: "slack", name: "Slack", description: "Team alerts and HR Q&A", scopes: ["chat:write", "im:read", "im:write"], webhooks: ["message.im"] },
    { provider: "email", name: "Email", description: "Candidate communication", scopes: ["send"] },
  ],
  onboarding: [
    { id: "greenhouse_connect", type: "oauth", label: "Connect Greenhouse", required: true },
    { id: "slack_connect", type: "oauth", label: "Connect Slack", required: true },
    { id: "hiring_channel", type: "select", label: "Hiring Slack Channel", required: true },
    { id: "hiring_bar", type: "input", label: "Hiring Bar Description", description: "Describe your company's hiring standards and priorities", required: false, config: { type: "textarea" } },
  ],
};

export const legal: VerticalDefinition = {
  id: "legal",
  name: "Legal Operations",
  description: "Automate contract review, deadline tracking, NDA generation, and compliance monitoring",
  industry: "Legal",
  icon: "⚖️",
  color: "#0EA5E9",
  workflows: legalWorkflows,
  agents: [
    { name: "Contract Analyst", role: "Legal Analyst", systemPrompt: "You review contracts for risk, extract clauses, and generate redline suggestions against the playbook.", defaultModel: "opus", tools: ["legal_get_contracts", "send_slack_message", "request_approval"], budgetMonthlyCents: 1200 },
    { name: "Deadline Tracker", role: "Legal Operations Manager", systemPrompt: "You monitor contract deadlines, renewal dates, and compliance obligations.", defaultModel: "sonnet", tools: ["legal_get_contracts", "send_slack_message"], schedule: "0 8 * * 1-5", budgetMonthlyCents: 300 },
    { name: "Document Drafter", role: "Legal Document Drafter", systemPrompt: "You generate NDAs and standard legal documents from templates, customized per counterparty.", defaultModel: "sonnet", tools: ["legal_get_contracts", "send_email"], budgetMonthlyCents: 500 },
    { name: "Compliance Officer", role: "Compliance Analyst", systemPrompt: "You monitor regulatory changes and assess compliance posture across obligations.", defaultModel: "opus", tools: ["send_slack_message", "send_email", "create_task"], schedule: "0 7 * * 1", budgetMonthlyCents: 800 },
  ],
  integrations: [
    { provider: "docusign", name: "DocuSign", description: "Contract signing and management", scopes: ["signatures:read", "signatures:write", "envelopes:read"], webhooks: ["envelope.sent", "envelope.completed"] },
    { provider: "crm", name: "CRM", description: "Counterparty and deal data", scopes: ["companies:read", "contacts:read"] },
    { provider: "slack", name: "Slack", description: "Legal team alerts", scopes: ["chat:write"] },
    { provider: "email", name: "Email", description: "Compliance reports and notifications", scopes: ["send"] },
  ],
  onboarding: [
    { id: "docusign_connect", type: "oauth", label: "Connect DocuSign", required: true },
    { id: "slack_connect", type: "oauth", label: "Connect Slack", required: true },
    { id: "legal_channel", type: "select", label: "Legal Slack Channel", required: true },
    { id: "compliance_email", type: "input", label: "Compliance Officer Email", required: true, config: { type: "email" } },
  ],
};

export const devops: VerticalDefinition = {
  id: "devops",
  name: "DevOps & Engineering",
  description: "Automate bug triage, PR review, changelog generation, and incident response",
  industry: "Software Engineering",
  icon: "🔧",
  color: "#64748B",
  workflows: devopsWorkflows,
  agents: [
    { name: "Bug Triage", role: "Bug Triage Engineer", systemPrompt: "You classify incoming bugs by severity, category, and assign to the right team with investigation steps.", defaultModel: "sonnet", tools: ["github_get_issues", "send_slack_message"], budgetMonthlyCents: 400 },
    { name: "Code Reviewer", role: "Code Reviewer", systemPrompt: "You review PRs for bugs, security issues, test coverage, and best practices.", defaultModel: "opus", tools: ["github_get_issues", "send_slack_message"], budgetMonthlyCents: 1500 },
    { name: "Release Manager", role: "Release Manager", systemPrompt: "You generate changelogs from merged PRs and create release notes.", defaultModel: "sonnet", tools: ["github_get_issues", "send_slack_message"], budgetMonthlyCents: 300 },
    { name: "Incident Commander", role: "Incident Commander", systemPrompt: "You classify incidents, coordinate response, and manage rollbacks.", defaultModel: "sonnet", tools: ["github_get_issues", "send_slack_message", "request_approval"], budgetMonthlyCents: 600 },
  ],
  integrations: [
    { provider: "github", name: "GitHub", description: "Source code, issues, PRs, and deployments", scopes: ["repo", "issues:write", "pull_requests:write"], webhooks: ["issues.opened", "pull_request.opened", "release.created"] },
    { provider: "pagerduty", name: "PagerDuty", description: "Incident management and alerting", scopes: ["incidents:read", "incidents:write"], webhooks: ["incident.triggered"] },
    { provider: "slack", name: "Slack", description: "Team communication and incident channels", scopes: ["chat:write", "channels:manage"] },
    { provider: "monitoring", name: "Datadog/Grafana", description: "Service metrics and monitoring", scopes: ["metrics:read"] },
  ],
  onboarding: [
    { id: "github_connect", type: "oauth", label: "Connect GitHub", required: true },
    { id: "slack_connect", type: "oauth", label: "Connect Slack", required: true },
    { id: "pagerduty_connect", type: "oauth", label: "Connect PagerDuty", description: "For incident response automation", required: false },
    { id: "oncall_channel", type: "select", label: "On-Call Slack Channel", required: true },
    { id: "dev_channel", type: "select", label: "Dev Team Slack Channel", required: true },
  ],
};

export const verticals: VerticalDefinition[] = [
  ecommerce,
  customerSupport,
  finance,
  sales,
  contentMarketing,
  hrRecruiting,
  legal,
  devops,
];

export const verticalMap = Object.fromEntries(verticals.map((v) => [v.id, v]));

export function getVertical(id: string): VerticalDefinition | undefined {
  return verticalMap[id];
}

export function getAllWorkflows() {
  return verticals.flatMap((v) => v.workflows);
}

export function getWorkflowsByVertical(verticalId: string) {
  return getVertical(verticalId)?.workflows ?? [];
}

export function getWorkflowById(workflowId: string) {
  return getAllWorkflows().find((w) => w.id === workflowId);
}
