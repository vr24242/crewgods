"use client";

import { useState } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  AlertTriangle,
  Filter,
  ChevronDown,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";

const approvals = [
  {
    id: "appr-001",
    workflowRunId: "hr-hire-d4e5f6",
    workflowName: "Hiring Workflow",
    nodeName: "Manager Reviews Candidate",
    pack: "HR",
    packIcon: "👥",
    packColor: "#EC4899",
    title: "Advance candidate to interview round",
    description: "Candidate: Sarah Chen for Sr. Engineer position\nAI Screen: Strong Match (4.2/5)\nStrengths: 8 years experience, strong system design skills\nConcerns: No direct e-commerce experience",
    priority: "high",
    status: "pending",
    channels: ["slack", "email", "dashboard"],
    requestedAt: new Date(Date.now() - 5 * 60 * 1000),
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  },
  {
    id: "appr-002",
    workflowRunId: "sup-rev-s1t2u3",
    workflowName: "Review Recovery",
    nodeName: "Manager Approves Response",
    pack: "Support",
    packIcon: "🎧",
    packColor: "#6366F1",
    title: "Approve public review response",
    description: "1-star review on Google from James Smith\nCategory: negative_recoverable\n\nDraft response: \"James, we're truly sorry about your experience. We take every piece of feedback seriously and want to make this right. Please reach out to us directly at support@... so we can resolve this for you.\"",
    priority: "high",
    status: "pending",
    channels: ["slack", "dashboard"],
    requestedAt: new Date(Date.now() - 30 * 60 * 1000),
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
  },
  {
    id: "appr-003",
    workflowRunId: "ops-inv-m4n5o6",
    workflowName: "Inventory Monitoring",
    nodeName: "Approve Reorder",
    pack: "Ops",
    packIcon: "⚙️",
    packColor: "#14B8A6",
    title: "Approve inventory reorder — $2,400 total",
    description: "3 items below safety stock:\n- Widget Pro (stock: 12, reorder: 200, supplier: Acme Co)\n- Gadget X (stock: 5, reorder: 150, supplier: TechParts Inc)\n- Cable Z (stock: 3, reorder: 500, supplier: CableCo)\n\nEstimated total: $2,400",
    priority: "medium",
    status: "pending",
    channels: ["slack", "dashboard"],
    requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
  },
  {
    id: "appr-004",
    workflowRunId: "fin-inv-old01",
    workflowName: "Invoice Approval",
    nodeName: "Request Manager Approval",
    pack: "Finance",
    packIcon: "💰",
    packColor: "#F59E0B",
    title: "Approve invoice: Acme Corp — $12,500",
    description: "Invoice #INV-2026-0847 from Acme Corp\nAmount: $12,500 USD\nDue: 2026-06-01\nClassified as: manager_approval (amount > $5,000)",
    priority: "medium",
    status: "approved",
    decidedBy: "varun@crewgods.com",
    decidedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    decidedVia: "dashboard",
    channels: ["slack", "email", "dashboard"],
    requestedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
  },
  {
    id: "appr-005",
    workflowRunId: "sales-prop-old02",
    workflowName: "Proposal Generation",
    nodeName: "Manager Reviews Proposal",
    pack: "Sales",
    packIcon: "🎯",
    packColor: "#8B5CF6",
    title: "Review proposal for TechStartup Inc — $36,000/yr",
    description: "Proposal for Jake Martinez at TechStartup Inc\nDeal value: $36,000/yr\nTier: Growth\n\nAI-generated proposal includes: executive summary, solution overview, pricing breakdown",
    priority: "high",
    status: "rejected",
    decidedBy: "varun@crewgods.com",
    decidedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    decidedVia: "slack",
    reason: "Pricing needs adjustment — we can offer 15% discount for annual commitment",
    channels: ["slack", "dashboard"],
    requestedAt: new Date(Date.now() - 14 * 60 * 60 * 1000),
  },
];

type StatusFilter = "all" | "pending" | "approved" | "rejected";

export default function ApprovalsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = approvals.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  });

  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink flex items-center gap-3">
          Approvals
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 text-sm rounded-full bg-ink/5 text-ink font-medium">
              {pendingCount} pending
            </span>
          )}
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Review and act on workflow approval requests
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-1 bg-white/40 border border-ink/8 rounded-2xl p-1 w-fit">
        {(["all", "pending", "approved", "rejected"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize",
              statusFilter === s ? "bg-cream-200 text-ink" : "text-ink-muted hover:text-ink"
            )}
          >
            {s}
            {s === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 text-orange-700">({pendingCount})</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-4">
        {filtered.map((approval) => (
          <div
            key={approval.id}
            className={cn(
              "bg-white/40 border rounded-2xl overflow-hidden",
              approval.status === "pending" ? "border-ink/12" : "border-ink/8"
            )}
          >
            {/* Header */}
            <div className="px-5 py-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs px-2 py-0.5 rounded font-medium"
                      style={{ backgroundColor: `${approval.packColor}15`, color: approval.packColor }}
                    >
                      {approval.packIcon} {approval.pack}
                    </span>
                    <span className="text-xs text-ink-muted">{approval.workflowName}</span>
                    <span className="text-xs text-ink-faint">•</span>
                    <span className="text-xs text-ink-muted">{approval.nodeName}</span>
                  </div>
                  <h3 className="font-medium text-ink">{approval.title}</h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    approval.priority === "high" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                  )}>
                    {approval.priority}
                  </span>
                  {approval.status === "pending" && (
                    <span className="flex items-center gap-1 text-xs text-ink-muted">
                      <Clock className="w-3 h-3" />
                      {timeAgo(approval.requestedAt)}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <pre className="text-sm text-ink-muted whitespace-pre-wrap font-sans bg-ink/5 rounded-2xl p-3 mb-4">
                {approval.description}
              </pre>

              {/* Channels */}
              <div className="flex items-center gap-2 text-xs text-ink-muted mb-4">
                <span>Sent via:</span>
                {approval.channels.map((c) => (
                  <span key={c} className="px-1.5 py-0.5 rounded bg-cream-200 text-ink-muted capitalize">{c}</span>
                ))}
              </div>

              {/* Actions / Status */}
              {approval.status === "pending" ? (
                <div className="flex items-center gap-3">
                  <button className="flex items-center gap-2 px-5 py-2.5 bg-emerald-100 text-emerald-800 rounded-2xl text-sm font-medium hover:bg-emerald-200 transition-colors">
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button className="flex items-center gap-2 px-5 py-2.5 bg-red-100 text-red-800 rounded-2xl text-sm font-medium hover:bg-red-200 transition-colors">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <div className="flex-1" />
                  {approval.expiresAt && (
                    <span className="text-xs text-ink-muted flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Expires {timeAgo(approval.expiresAt).replace(" ago", "")}
                    </span>
                  )}
                </div>
              ) : (
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-2xl text-sm",
                  approval.status === "approved" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                )}>
                  {approval.status === "approved" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span className="font-medium capitalize">{approval.status}</span>
                  <span className="text-ink-muted">by {(approval as any).decidedBy} via {(approval as any).decidedVia}</span>
                  <span className="text-ink-faint">•</span>
                  <span className="text-ink-muted">{timeAgo((approval as any).decidedAt)}</span>
                  {(approval as any).reason && (
                    <>
                      <span className="text-ink-faint">•</span>
                      <span className="text-ink-muted italic">{(approval as any).reason}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-ink-muted bg-white/40 border border-ink/8 rounded-2xl">
          No approvals match your filter
        </div>
      )}
    </div>
  );
}
