"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  Play,
  Pause,
  XCircle,
  Eye,
  Clock,
  DollarSign,
} from "lucide-react";
import { cn, formatCents } from "@/lib/utils";

// ── Demo data ────────────────────────────────────────

const workflows = [
  { id: "fin-inv-a1b2c3", template: "Invoice Approval", templateId: "finance-invoice-approval", pack: "Finance", packIcon: "💰", packColor: "#F59E0B", status: "completed", progress: 100, nodes: 7, nodesCompleted: 7, cost: 5, trigger: "invoice.received", triggerSource: "gmail", startedAt: "2026-05-18T10:42:00Z", duration: "4.2s" },
  { id: "hr-hire-d4e5f6", template: "Hiring Workflow", templateId: "hr-hiring", pack: "HR", packIcon: "👥", packColor: "#EC4899", status: "waiting_approval", progress: 57, nodes: 7, nodesCompleted: 4, cost: 8, trigger: "application.received", triggerSource: "webhook", startedAt: "2026-05-18T10:39:00Z", duration: "12s" },
  { id: "sup-comp-g7h8i9", template: "Complaint Routing", templateId: "support-complaint-routing", pack: "Support", packIcon: "🎧", packColor: "#6366F1", status: "completed", progress: 100, nodes: 7, nodesCompleted: 7, cost: 3, trigger: "complaint.received", triggerSource: "zendesk", startedAt: "2026-05-18T10:35:00Z", duration: "2.8s" },
  { id: "sales-lead-j1k2l3", template: "Lead Routing", templateId: "sales-lead-routing", pack: "Sales", packIcon: "🎯", packColor: "#8B5CF6", status: "completed", progress: 100, nodes: 9, nodesCompleted: 9, cost: 4, trigger: "lead.created", triggerSource: "hubspot", startedAt: "2026-05-18T10:31:00Z", duration: "6.1s" },
  { id: "ops-inc-m4n5o6", template: "Incident Escalation", templateId: "ops-incident-escalation", pack: "Ops", packIcon: "⚙️", packColor: "#14B8A6", status: "running", progress: 37, nodes: 8, nodesCompleted: 3, cost: 2, trigger: "incident.triggered", triggerSource: "pagerduty", startedAt: "2026-05-18T10:28:00Z", duration: "—" },
  { id: "fin-exp-p7q8r9", template: "Expense Audit", templateId: "finance-expense-audit", pack: "Finance", packIcon: "💰", packColor: "#F59E0B", status: "completed", progress: 100, nodes: 5, nodesCompleted: 5, cost: 3, trigger: "expense.submitted", triggerSource: "webhook", startedAt: "2026-05-18T10:22:00Z", duration: "1.9s" },
  { id: "sup-rev-s1t2u3", template: "Review Recovery", templateId: "support-review-recovery", pack: "Support", packIcon: "🎧", packColor: "#6366F1", status: "waiting_approval", progress: 50, nodes: 8, nodesCompleted: 4, cost: 6, trigger: "review.posted", triggerSource: "webhook", startedAt: "2026-05-18T10:14:00Z", duration: "8s" },
  { id: "hr-leave-v4w5x6", template: "Leave Approval", templateId: "hr-leave-approval", pack: "HR", packIcon: "👥", packColor: "#EC4899", status: "completed", progress: 100, nodes: 7, nodesCompleted: 7, cost: 2, trigger: "leave.requested", triggerSource: "webhook", startedAt: "2026-05-18T09:58:00Z", duration: "3.5s" },
  { id: "fin-rec-y7z8a9", template: "Bank Reconciliation", templateId: "finance-reconciliation", pack: "Finance", packIcon: "💰", packColor: "#F59E0B", status: "completed", progress: 100, nodes: 5, nodesCompleted: 5, cost: 8, trigger: "reconciliation.needed", triggerSource: "cron", startedAt: "2026-05-18T07:00:00Z", duration: "18.4s" },
  { id: "ops-sla-b1c2d3", template: "SLA Monitoring", templateId: "ops-sla-monitoring", pack: "Ops", packIcon: "⚙️", packColor: "#14B8A6", status: "completed", progress: 100, nodes: 6, nodesCompleted: 6, cost: 3, trigger: "sla.check", triggerSource: "cron", startedAt: "2026-05-18T09:00:00Z", duration: "5.7s" },
  { id: "sales-pipe-e4f5g6", template: "Pipeline Health Check", templateId: "sales-pipeline", pack: "Sales", packIcon: "🎯", packColor: "#8B5CF6", status: "failed", progress: 60, nodes: 5, nodesCompleted: 3, cost: 3, trigger: "pipeline.check", triggerSource: "cron", startedAt: "2026-05-18T08:00:00Z", duration: "4.1s", error: "HubSpot API rate limit exceeded" },
];

const statusColors: Record<string, string> = {
  completed: "bg-emerald-600",
  running: "bg-blue-500 animate-pulse",
  waiting_approval: "bg-amber-500",
  failed: "bg-red-500",
  cancelled: "bg-ink-muted",
  paused: "bg-yellow-700",
};

const statusLabels: Record<string, string> = {
  completed: "Completed",
  running: "Running",
  waiting_approval: "Awaiting Approval",
  failed: "Failed",
  cancelled: "Cancelled",
  paused: "Paused",
};

type FilterStatus = "all" | "running" | "waiting_approval" | "completed" | "failed";

export default function WorkflowsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [packFilter, setPackFilter] = useState<string>("all");

  const filtered = workflows.filter((w) => {
    if (statusFilter !== "all" && w.status !== statusFilter) return false;
    if (packFilter !== "all" && w.pack !== packFilter) return false;
    if (search && !w.template.toLowerCase().includes(search.toLowerCase()) && !w.id.includes(search)) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Workflow Runs</h1>
          <p className="text-sm text-ink-muted mt-1">Monitor and manage all workflow executions</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 bg-cream-200 rounded-2xl text-sm text-ink-soft hover:bg-ink/8 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
          <input
            type="text"
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/40 border border-ink/8 rounded-2xl text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink/20"
          />
        </div>

        <div className="flex gap-1 bg-white/40 border border-ink/8 rounded-2xl p-1">
          {(["all", "running", "waiting_approval", "completed", "failed"] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium transition-colors capitalize",
                statusFilter === s ? "bg-cream-200 text-ink" : "text-ink-muted hover:text-ink"
              )}
            >
              {s === "all" ? "All" : statusLabels[s] ?? s}
            </button>
          ))}
        </div>

        <select
          value={packFilter}
          onChange={(e) => setPackFilter(e.target.value)}
          className="px-3 py-2 bg-white/40 border border-ink/8 rounded-2xl text-sm text-ink-soft focus:outline-none"
        >
          <option value="all">All Packs</option>
          <option value="Finance">Finance</option>
          <option value="HR">HR</option>
          <option value="Support">Support</option>
          <option value="Ops">Ops</option>
          <option value="Sales">Sales</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white/40 border border-ink/8 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink/8 text-xs text-ink-muted font-medium">
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Workflow</th>
                <th className="text-left px-5 py-3">Pack</th>
                <th className="text-left px-5 py-3">Trigger</th>
                <th className="text-left px-5 py-3">Progress</th>
                <th className="text-right px-5 py-3">Duration</th>
                <th className="text-right px-5 py-3">Cost</th>
                <th className="text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {filtered.map((w) => (
                <tr key={w.id} className="hover:bg-ink/5 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full shrink-0", statusColors[w.status])} />
                      <span className="text-xs text-ink-muted">{statusLabels[w.status]}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-sm font-medium text-ink">{w.template}</div>
                    <div className="text-xs text-ink-muted font-mono">{w.id}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="text-xs px-2 py-1 rounded font-medium"
                      style={{ backgroundColor: `${w.packColor}15`, color: w.packColor }}
                    >
                      {w.packIcon} {w.pack}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-xs text-ink-soft">{w.trigger}</div>
                    <div className="text-xs text-ink-muted">{w.triggerSource}</div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-cream-200 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            w.status === "failed" ? "bg-red-500" :
                            w.status === "running" ? "bg-blue-500" :
                            w.status === "waiting_approval" ? "bg-amber-500" :
                            "bg-emerald-600"
                          )}
                          style={{ width: `${w.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-ink-muted">{w.nodesCompleted}/{w.nodes}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-xs text-ink-muted">{w.duration}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-xs text-ink-muted">{formatCents(w.cost)}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 rounded hover:bg-ink/8 transition-colors" title="View details">
                        <Eye className="w-3.5 h-3.5 text-ink-muted" />
                      </button>
                      {w.status === "running" && (
                        <button className="p-1.5 rounded hover:bg-ink/8 transition-colors" title="Pause">
                          <Pause className="w-3.5 h-3.5 text-ink-muted" />
                        </button>
                      )}
                      {(w.status === "running" || w.status === "waiting_approval") && (
                        <button className="p-1.5 rounded hover:bg-ink/8 transition-colors" title="Cancel">
                          <XCircle className="w-3.5 h-3.5 text-ink-muted" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-ink-muted">
            No workflows match your filters
          </div>
        )}
      </div>
    </div>
  );
}
