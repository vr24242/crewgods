"use client";

import { useState } from "react";
import {
  Check,
  ExternalLink,
  Plug,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// TODO: Wire to real integration status API when available.
// Currently using static data — integration CRUD is not yet in the API.

const integrations = [
  {
    id: "slack",
    name: "Slack",
    description: "Send messages, create channels, receive approval responses",
    icon: "https://cdn.simpleicons.org/slack",
    category: "Communication",
    status: "connected" as const,
    connectedAt: "2026-05-10",
    usedBy: ["Finance", "HR", "Support", "Ops", "Sales"],
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Send emails, receive invoices, process inbound messages",
    icon: "https://cdn.simpleicons.org/gmail",
    category: "Communication",
    status: "connected" as const,
    connectedAt: "2026-05-10",
    usedBy: ["Finance", "HR", "Support", "Ops", "Sales"],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "CRM integration for contacts, deals, and pipeline management",
    icon: "https://cdn.simpleicons.org/hubspot",
    category: "CRM",
    status: "connected" as const,
    connectedAt: "2026-05-12",
    usedBy: ["Sales"],
  },
  {
    id: "google_sheets",
    name: "Google Sheets",
    description: "Read/write spreadsheet data for reports and tracking",
    icon: "https://cdn.simpleicons.org/googlesheets",
    category: "Productivity",
    status: "connected" as const,
    connectedAt: "2026-05-11",
    usedBy: ["HR", "Ops"],
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    description: "Accounting integration for invoices, expenses, and reconciliation",
    icon: "https://cdn.simpleicons.org/intuit",
    category: "Finance",
    status: "not_connected" as const,
    usedBy: ["Finance"],
  },
  {
    id: "zendesk",
    name: "Zendesk",
    description: "Support ticket management and SLA monitoring",
    icon: "https://cdn.simpleicons.org/zendesk",
    category: "Support",
    status: "not_connected" as const,
    usedBy: ["Support"],
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    description: "Send approval requests and notifications via WhatsApp",
    icon: "https://cdn.simpleicons.org/whatsapp",
    category: "Communication",
    status: "not_connected" as const,
    usedBy: ["HR", "Support"],
  },
  {
    id: "shopify",
    name: "Shopify",
    description: "E-commerce orders, inventory, and customer data",
    icon: "https://cdn.simpleicons.org/shopify",
    category: "Commerce",
    status: "not_connected" as const,
    usedBy: [],
  },
  {
    id: "github",
    name: "GitHub",
    description: "Repository events, PRs, issues, and deployment tracking",
    icon: "https://cdn.simpleicons.org/github",
    category: "Engineering",
    status: "not_connected" as const,
    usedBy: [],
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Payment processing, subscription management, and billing",
    icon: "https://cdn.simpleicons.org/stripe",
    category: "Finance",
    status: "not_connected" as const,
    usedBy: [],
  },
];

export default function IntegrationsPage() {
  const connected = integrations.filter((i) => i.status === "connected");
  const available = integrations.filter((i) => i.status !== "connected");

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Integrations</h1>
        <p className="text-sm text-ink-muted mt-1">
          Connect your tools to power workflow automations.
          <span className="ml-1 text-xs text-ink-faint">(Integration status will be live once the API is available)</span>
        </p>
      </div>

      {/* Connected */}
      <div>
        <h2 className="text-sm font-medium text-ink-muted uppercase tracking-wider mb-3">
          Connected ({connected.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connected.map((integration) => (
            <div
              key={integration.id}
              className="flex items-start gap-4 p-4 bg-white/40 border border-ink/12 rounded-2xl"
            >
              <div className="w-10 h-10 rounded-2xl bg-cream-200 flex items-center justify-center shrink-0 overflow-hidden">
                <img src={integration.icon} alt="" className="w-6 h-6" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-ink">{integration.name}</span>
                  <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    <Check className="w-3 h-3" /> Connected
                  </span>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">{integration.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-ink-muted">Used by:</span>
                  {integration.usedBy.map((p) => (
                    <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-cream-200 text-ink-muted">{p}</span>
                  ))}
                </div>
              </div>
              <button className="text-xs text-ink-muted hover:text-ink transition-colors flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Available */}
      <div>
        <h2 className="text-sm font-medium text-ink-muted uppercase tracking-wider mb-3">
          Available ({available.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {available.map((integration) => (
            <div
              key={integration.id}
              className="flex items-start gap-4 p-4 bg-white/40 border border-ink/8 rounded-2xl"
            >
              <div className="w-10 h-10 rounded-2xl bg-cream-200 flex items-center justify-center shrink-0 overflow-hidden opacity-50">
                <img src={integration.icon} alt="" className="w-6 h-6" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-ink">{integration.name}</span>
                  <span className="text-[10px] text-ink-muted">{integration.category}</span>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">{integration.description}</p>
                {integration.usedBy.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-orange-700">
                    <AlertCircle className="w-3 h-3" />
                    Required by: {integration.usedBy.join(", ")}
                  </div>
                )}
              </div>
              <button className="text-xs px-3 py-1.5 rounded-2xl bg-cream-200 text-ink-soft hover:bg-ink/8 transition-colors shrink-0 flex items-center gap-1">
                <Plug className="w-3 h-3" /> Connect
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
