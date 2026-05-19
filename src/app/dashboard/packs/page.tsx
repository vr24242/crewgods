"use client";

import { useState } from "react";
import {
  Check,
  ChevronRight,
  Workflow,
  Zap,
  Clock,
  DollarSign,
  ArrowRight,
  Plug,
} from "lucide-react";
import { cn, formatCents } from "@/lib/utils";

// All pack data from our Temporal workflow packs
const packs = [
  {
    id: "finance",
    name: "Finance Pack",
    description: "Automate invoice approvals, reconciliation, expense audits, and payment escalations",
    icon: "💰",
    color: "#F59E0B",
    requiredIntegrations: ["gmail", "slack", "quickbooks"],
    enabled: true,
    workflows: [
      { id: "finance-invoice-approval", name: "Invoice Approval", description: "Receives invoices via email, extracts details, routes for approval based on amount and vendor", nodes: 7, estimatedCostCents: 5, tags: ["invoice", "approval"] },
      { id: "finance-expense-audit", name: "Expense Audit", description: "Reviews submitted expenses, flags anomalies, routes for approval", nodes: 5, estimatedCostCents: 3, tags: ["expense", "audit"] },
      { id: "finance-payment-escalation", name: "Payment Escalation", description: "Monitors overdue payments, sends reminders, escalates to management", nodes: 5, estimatedCostCents: 4, tags: ["payments", "overdue"] },
      { id: "finance-reconciliation", name: "Bank Reconciliation", description: "Weekly automated bank-to-books reconciliation with anomaly detection", nodes: 5, estimatedCostCents: 8, tags: ["reconciliation", "banking"] },
    ],
  },
  {
    id: "hr",
    name: "HR Pack",
    description: "Automate onboarding, hiring workflows, leave approvals, and staffing coordination",
    icon: "👥",
    color: "#EC4899",
    requiredIntegrations: ["slack", "gmail", "google_sheets"],
    enabled: true,
    workflows: [
      { id: "hr-hiring", name: "Hiring Workflow", description: "Screens applications, scores candidates, schedules interviews, manages the pipeline", nodes: 7, estimatedCostCents: 5, tags: ["hiring", "screening"] },
      { id: "hr-onboarding", name: "Onboarding Workflow", description: "Generates onboarding checklists, creates IT tasks, sends welcome email", nodes: 5, estimatedCostCents: 6, tags: ["onboarding", "new-hire"] },
      { id: "hr-leave-approval", name: "Leave Approval", description: "Processes leave requests, checks team coverage, routes for manager approval", nodes: 7, estimatedCostCents: 2, tags: ["leave", "approval"] },
    ],
  },
  {
    id: "support",
    name: "Support Pack",
    description: "Automate complaint routing, review recovery, escalation workflows, and satisfaction tracking",
    icon: "🎧",
    color: "#6366F1",
    requiredIntegrations: ["slack", "gmail", "zendesk"],
    enabled: true,
    workflows: [
      { id: "support-complaint-routing", name: "Complaint Routing", description: "Classifies severity and topic, routes to the right team", nodes: 7, estimatedCostCents: 3, tags: ["complaint", "routing"] },
      { id: "support-review-recovery", name: "Review Recovery", description: "Detects negative reviews, coordinates personalized recovery response", nodes: 8, estimatedCostCents: 6, tags: ["reviews", "recovery"] },
      { id: "support-escalation", name: "Escalation Workflow", description: "Monitors SLA breaches, auto-escalates with context", nodes: 4, estimatedCostCents: 4, tags: ["escalation", "sla"] },
    ],
  },
  {
    id: "ops",
    name: "Ops Pack",
    description: "Automate incident management, vendor onboarding, inventory monitoring, and SLA tracking",
    icon: "⚙️",
    color: "#14B8A6",
    requiredIntegrations: ["slack", "gmail", "google_sheets"],
    enabled: true,
    workflows: [
      { id: "ops-incident-escalation", name: "Incident Escalation", description: "Classifies severity, pages on-call, coordinates response", nodes: 8, estimatedCostCents: 5, tags: ["incident", "escalation"] },
      { id: "ops-vendor-onboarding", name: "Vendor Onboarding", description: "Runs compliance checks, creates accounts, routes for approval", nodes: 8, estimatedCostCents: 6, tags: ["vendor", "compliance"] },
      { id: "ops-inventory-alerts", name: "Inventory Monitoring", description: "Monitors stock levels, predicts shortages, triggers reorder workflows", nodes: 5, estimatedCostCents: 4, tags: ["inventory", "alerts"] },
      { id: "ops-sla-monitoring", name: "SLA Monitoring", description: "Tracks SLA compliance, generates reports, flags breaches", nodes: 6, estimatedCostCents: 3, tags: ["sla", "monitoring"] },
    ],
  },
  {
    id: "sales",
    name: "Sales Pack",
    description: "Automate lead routing, pipeline management, proposal generation, and deal intelligence",
    icon: "🎯",
    color: "#8B5CF6",
    requiredIntegrations: ["slack", "gmail", "hubspot"],
    enabled: false,
    workflows: [
      { id: "sales-lead-routing", name: "Lead Routing", description: "Scores inbound leads, enriches data, routes to the right rep", nodes: 9, estimatedCostCents: 4, tags: ["leads", "routing"] },
      { id: "sales-pipeline", name: "Pipeline Health Check", description: "Daily analysis of stale deals, at-risk opportunities", nodes: 5, estimatedCostCents: 5, tags: ["pipeline", "deals"] },
      { id: "sales-proposal", name: "Proposal Generation", description: "Generates customized proposals, routes for approval", nodes: 7, estimatedCostCents: 8, tags: ["proposal", "documents"] },
      { id: "sales-deal-alerts", name: "Deal Stage Alerts", description: "Monitors deal changes, generates coaching tips, celebrates wins", nodes: 7, estimatedCostCents: 2, tags: ["deals", "alerts"] },
    ],
  },
];

export default function PacksPage() {
  const [expandedPack, setExpandedPack] = useState<string | null>(null);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Workflow Packs</h1>
        <p className="text-sm text-ink-muted mt-1">
          Pre-built operational workflows. Enable a pack to start automating.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/40 border border-ink/8 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-ink">{packs.length}</div>
          <div className="text-xs text-ink-muted">Available Packs</div>
        </div>
        <div className="bg-white/40 border border-ink/8 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-ink">{packs.reduce((s, p) => s + p.workflows.length, 0)}</div>
          <div className="text-xs text-ink-muted">Total Workflows</div>
        </div>
        <div className="bg-white/40 border border-ink/8 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-ink">{packs.filter((p) => p.enabled).length}</div>
          <div className="text-xs text-ink-muted">Enabled</div>
        </div>
      </div>

      {/* Packs */}
      <div className="space-y-4">
        {packs.map((pack) => {
          const isExpanded = expandedPack === pack.id;
          return (
            <div
              key={pack.id}
              className={cn(
                "bg-white/40 border rounded-2xl overflow-hidden transition-colors",
                pack.enabled ? "border-ink/12" : "border-ink/8"
              )}
            >
              {/* Header */}
              <button
                onClick={() => setExpandedPack(isExpanded ? null : pack.id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-ink/5 transition-colors"
              >
                <span className="text-3xl">{pack.icon}</span>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{pack.name}</span>
                    {pack.enabled && (
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                        <Check className="w-3 h-3" /> Enabled
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink-muted mt-0.5">{pack.description}</p>
                </div>
                <div className="flex items-center gap-4 text-sm text-ink-muted">
                  <span>{pack.workflows.length} workflows</span>
                  <ChevronRight className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-90")} />
                </div>
              </button>

              {/* Expanded */}
              {isExpanded && (
                <div className="border-t border-ink/8">
                  {/* Integrations */}
                  <div className="px-5 py-3 bg-ink/5 flex items-center gap-4 text-xs">
                    <span className="text-ink-muted flex items-center gap-1"><Plug className="w-3 h-3" /> Required:</span>
                    {pack.requiredIntegrations.map((i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-cream-200 text-ink-soft capitalize">{i.replace("_", " ")}</span>
                    ))}
                  </div>

                  {/* Workflows list */}
                  <div className="divide-y divide-ink/8">
                    {pack.workflows.map((wf) => (
                      <div key={wf.id} className="px-5 py-4 flex items-center gap-4">
                        <Workflow className="w-4 h-4 shrink-0" style={{ color: pack.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-ink">{wf.name}</div>
                          <div className="text-xs text-ink-muted mt-0.5">{wf.description}</div>
                          <div className="flex items-center gap-3 mt-1.5">
                            {wf.tags.map((t) => (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-cream-200 text-ink-muted">{t}</span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-ink-muted shrink-0">
                          <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{wf.nodes} nodes</span>
                          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />~{formatCents(wf.estimatedCostCents)}/run</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action */}
                  <div className="px-5 py-3 border-t border-ink/8 flex justify-end">
                    {pack.enabled ? (
                      <button className="text-xs px-4 py-2 rounded-2xl bg-cream-200 text-ink-soft hover:bg-ink/8 transition-colors">
                        Disable Pack
                      </button>
                    ) : (
                      <button
                        className="text-xs px-4 py-2 rounded-2xl font-medium text-black transition-colors flex items-center gap-1"
                        style={{ backgroundColor: pack.color }}
                      >
                        Enable Pack <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
