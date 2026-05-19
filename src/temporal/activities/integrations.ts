// ═══════════════════════════════════════════════════════
// INTEGRATION ACTIVITIES — External tool actions
// Each function is a Temporal activity (retriable, observable)
// ═══════════════════════════════════════════════════════

import { Context } from "@temporalio/activity";

// ── Slack ─────────────────────────────────────────────

export interface SlackMessageInput {
  orgId: string;
  channel: string;
  message: string;
  blocks?: unknown[];
  threadTs?: string;
}

export async function sendSlackMessage(input: SlackMessageInput): Promise<{ ts: string; channel: string }> {
  const token = await getIntegrationToken(input.orgId, "slack");
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel: input.channel, text: input.message, blocks: input.blocks, thread_ts: input.threadTs }),
  });
  const data = await res.json() as any;
  if (!data.ok) throw new Error(`Slack error: ${data.error}`);
  return { ts: data.ts, channel: data.channel };
}

// ── Email ─────────────────────────────────────────────

export interface SendEmailInput {
  orgId: string;
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ messageId: string }> {
  // In production: SendGrid, Resend, or SMTP
  const apiKey = await getIntegrationToken(input.orgId, "email");
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to }] }],
      from: { email: "workflows@crewgods.com" },
      subject: input.subject,
      content: [{ type: "text/html", value: input.body }],
    }),
  });
  return { messageId: res.headers.get("x-message-id") ?? "sent" };
}

// ── WhatsApp ──────────────────────────────────────────

export interface WhatsAppMessageInput {
  orgId: string;
  to: string;
  message: string;
  templateId?: string;
  templateParams?: Record<string, string>;
}

export async function sendWhatsApp(input: WhatsAppMessageInput): Promise<{ messageId: string }> {
  const token = await getIntegrationToken(input.orgId, "whatsapp");
  // WhatsApp Business API via Twilio or Meta
  const res = await fetch("https://graph.facebook.com/v18.0/FROM_PHONE_ID/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: input.to, type: "text", text: { body: input.message } }),
  });
  const data = await res.json() as any;
  return { messageId: data.messages?.[0]?.id ?? "sent" };
}

// ── CRM (HubSpot) ────────────────────────────────────

export interface CRMUpdateInput {
  orgId: string;
  provider: "hubspot" | "salesforce";
  objectType: "contact" | "deal" | "company" | "ticket";
  objectId?: string;
  properties: Record<string, unknown>;
}

export async function updateCRM(input: CRMUpdateInput): Promise<{ id: string }> {
  const token = await getIntegrationToken(input.orgId, input.provider);

  if (input.provider === "hubspot") {
    const method = input.objectId ? "PATCH" : "POST";
    const url = input.objectId
      ? `https://api.hubapi.com/crm/v3/objects/${input.objectType}/${input.objectId}`
      : `https://api.hubapi.com/crm/v3/objects/${input.objectType}`;

    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties: input.properties }),
    });
    const data = await res.json() as any;
    return { id: data.id };
  }

  throw new Error(`CRM provider ${input.provider} not implemented`);
}

// ── Fetch Data (generic) ──────────────────────────────

export interface FetchIntegrationDataInput {
  orgId: string;
  provider: string;
  operation: string;
  params: Record<string, unknown>;
}

export async function fetchIntegrationData(input: FetchIntegrationDataInput): Promise<unknown> {
  Context.current().heartbeat();
  const token = await getIntegrationToken(input.orgId, input.provider);

  // Route to the right API based on provider+operation
  const endpoint = resolveEndpoint(input.provider, input.operation, input.params);

  const res = await fetch(endpoint.url, {
    method: endpoint.method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...endpoint.headers },
    body: endpoint.method !== "GET" ? JSON.stringify(endpoint.body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`Integration ${input.provider}.${input.operation} failed: ${res.status}`);
  }

  return res.json();
}

// ── Create Task (internal) ────────────────────────────

export interface CreateTaskInput {
  orgId: string;
  title: string;
  description?: string;
  assignTo?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  dueDate?: string;
  workflowRunId?: string;
  nodeId?: string;
}

export async function createTask(input: CreateTaskInput): Promise<{ taskId: string }> {
  // In production: write to database
  const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  console.log(`[Task] Created: ${input.title} (${input.priority ?? "medium"}) → ${input.assignTo ?? "unassigned"}`);
  return { taskId };
}

// ── Helpers ───────────────────────────────────────────

async function getIntegrationToken(orgId: string, provider: string): Promise<string> {
  // In production: look up encrypted token from database by orgId + provider
  const envKey = `${provider.toUpperCase()}_API_KEY`;
  const token = process.env[envKey];
  if (!token) throw new Error(`No integration token for ${provider} (org: ${orgId}). Set ${envKey}`);
  return token;
}

function resolveEndpoint(provider: string, operation: string, params: Record<string, unknown>): { url: string; method: string; headers?: Record<string, string>; body?: unknown } {
  // Endpoint registry — maps provider.operation to API calls
  const endpoints: Record<string, Record<string, (p: any) => { url: string; method: string; body?: unknown }>> = {
    shopify: {
      "orders.list": (p) => ({ url: `https://${p.shop}.myshopify.com/admin/api/2024-01/orders.json?status=any`, method: "GET" }),
      "orders.get": (p) => ({ url: `https://${p.shop}.myshopify.com/admin/api/2024-01/orders/${p.orderId}.json`, method: "GET" }),
      "inventory.list": (p) => ({ url: `https://${p.shop}.myshopify.com/admin/api/2024-01/inventory_levels.json`, method: "GET" }),
      "customers.get": (p) => ({ url: `https://${p.shop}.myshopify.com/admin/api/2024-01/customers/${p.customerId}.json`, method: "GET" }),
    },
    zendesk: {
      "tickets.list": (p) => ({ url: `https://${p.subdomain}.zendesk.com/api/v2/tickets.json`, method: "GET" }),
      "tickets.update": (p) => ({ url: `https://${p.subdomain}.zendesk.com/api/v2/tickets/${p.ticketId}.json`, method: "PUT", body: { ticket: p.updates } }),
    },
    github: {
      "issues.list": (p) => ({ url: `https://api.github.com/repos/${p.repo}/issues`, method: "GET" }),
      "issues.create_comment": (p) => ({ url: `https://api.github.com/repos/${p.repo}/issues/${p.issueNumber}/comments`, method: "POST", body: { body: p.body } }),
    },
  };

  const resolver = endpoints[provider]?.[operation];
  if (!resolver) {
    return { url: `https://api.crewgods.com/proxy/${provider}/${operation}`, method: "POST", body: params };
  }
  return resolver(params);
}
