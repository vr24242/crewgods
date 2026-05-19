// ═══════════════════════════════════════════════════════
// APPROVAL ACTIVITIES — Multi-channel human approval
// Sends approval requests via Slack, WhatsApp, email, dashboard
// ═══════════════════════════════════════════════════════

export interface ApprovalRequest {
  orgId: string;
  workflowRunId: string;
  nodeId: string;
  title: string;
  description: string;
  context: Record<string, unknown>;
  channels: ApprovalChannel[];
  assignTo?: string[];         // user IDs or emails
  expiresInMinutes?: number;
  priority: "low" | "medium" | "high" | "urgent";
}

export type ApprovalChannel = "dashboard" | "slack" | "whatsapp" | "email";

export interface ApprovalRequestResult {
  approvalId: string;
  sentTo: Array<{ channel: ApprovalChannel; success: boolean; reference?: string }>;
}

// ── Send Approval Request to All Channels ─────────────

export async function sendApprovalRequest(input: ApprovalRequest): Promise<ApprovalRequestResult> {
  const approvalId = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const results: ApprovalRequestResult["sentTo"] = [];

  const approvalUrl = `https://app.crewgods.com/approvals/${approvalId}`;

  for (const channel of input.channels) {
    try {
      switch (channel) {
        case "slack":
          await sendSlackApproval(input, approvalId, approvalUrl);
          results.push({ channel, success: true, reference: "slack_msg" });
          break;

        case "email":
          await sendEmailApproval(input, approvalId, approvalUrl);
          results.push({ channel, success: true, reference: "email_sent" });
          break;

        case "whatsapp":
          await sendWhatsAppApproval(input, approvalId, approvalUrl);
          results.push({ channel, success: true, reference: "wa_sent" });
          break;

        case "dashboard":
          // Dashboard always works — just stored in DB
          results.push({ channel, success: true, reference: approvalId });
          break;
      }
    } catch (err) {
      results.push({ channel, success: false });
    }
  }

  return { approvalId, sentTo: results };
}

// ── Slack Approval (with interactive buttons) ─────────

async function sendSlackApproval(input: ApprovalRequest, approvalId: string, approvalUrl: string): Promise<void> {
  const token = process.env.SLACK_API_KEY;
  if (!token) return;

  const priorityEmoji = { low: "🟢", medium: "🟡", high: "🟠", urgent: "🔴" }[input.priority];

  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      channel: input.context.slackChannel as string ?? "#approvals",
      blocks: [
        { type: "header", text: { type: "plain_text", text: `${priorityEmoji} Approval Required` } },
        { type: "section", text: { type: "mrkdwn", text: `*${input.title}*\n${input.description}` } },
        {
          type: "section",
          fields: Object.entries(input.context)
            .filter(([k]) => !k.startsWith("_"))
            .slice(0, 10)
            .map(([k, v]) => ({ type: "mrkdwn", text: `*${k}:* ${v}` })),
        },
        {
          type: "actions",
          elements: [
            { type: "button", text: { type: "plain_text", text: "✅ Approve" }, style: "primary", action_id: "approve", value: approvalId },
            { type: "button", text: { type: "plain_text", text: "❌ Reject" }, style: "danger", action_id: "reject", value: approvalId },
            { type: "button", text: { type: "plain_text", text: "📋 View Details" }, url: approvalUrl, action_id: "view" },
          ],
        },
      ],
    }),
  });
}

// ── Email Approval ────────────────────────────────────

async function sendEmailApproval(input: ApprovalRequest, approvalId: string, approvalUrl: string): Promise<void> {
  const apiKey = process.env.EMAIL_API_KEY;
  if (!apiKey) return;

  const recipients = input.assignTo ?? [];

  for (const to of recipients) {
    await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: "approvals@crewgods.com", name: "CrewGods Approvals" },
        subject: `[${input.priority.toUpperCase()}] Approval: ${input.title}`,
        content: [{
          type: "text/html",
          value: `
            <h2>${input.title}</h2>
            <p>${input.description}</p>
            <p><a href="${approvalUrl}?action=approve" style="background:#22c55e;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">✅ Approve</a>
            &nbsp;&nbsp;
            <a href="${approvalUrl}?action=reject" style="background:#ef4444;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">❌ Reject</a></p>
          `,
        }],
      }),
    });
  }
}

// ── WhatsApp Approval ─────────────────────────────────

async function sendWhatsAppApproval(input: ApprovalRequest, approvalId: string, approvalUrl: string): Promise<void> {
  const token = process.env.WHATSAPP_API_KEY;
  if (!token) return;

  const recipients = input.assignTo ?? [];
  for (const to of recipients) {
    await fetch("https://graph.facebook.com/v18.0/FROM_PHONE_ID/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          header: { type: "text", text: `${input.priority === "urgent" ? "🔴 " : ""}Approval Required` },
          body: { text: `${input.title}\n\n${input.description}` },
          action: {
            buttons: [
              { type: "reply", reply: { id: `approve_${approvalId}`, title: "✅ Approve" } },
              { type: "reply", reply: { id: `reject_${approvalId}`, title: "❌ Reject" } },
            ],
          },
        },
      }),
    });
  }
}
