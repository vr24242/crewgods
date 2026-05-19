"use client";

import { useState } from "react";
import {
  Activity,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Workflow,
  AlertTriangle,
  ArrowRight,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { cn, formatCents } from "@/lib/utils";

// ── Demo data (will be replaced with API calls) ─────

const stats = {
  workflowsToday: 47,
  workflowsTrend: "+12%",
  approvalsPending: 3,
  costToday: 285,
  costBudget: 5000,
  successRate: 96.2,
};

const recentRuns = [
  { id: "fin-inv-001", template: "Invoice Approval", pack: "Finance", packColor: "#F59E0B", status: "completed", duration: "4.2s", cost: 5, trigger: "invoice.received", time: "2m ago" },
  { id: "hr-hire-002", template: "Hiring Workflow", pack: "HR", packColor: "#EC4899", status: "waiting_approval", duration: "12s", cost: 8, trigger: "application.received", time: "5m ago" },
  { id: "sup-comp-003", template: "Complaint Routing", pack: "Support", packColor: "#6366F1", status: "completed", duration: "2.8s", cost: 3, trigger: "complaint.received", time: "8m ago" },
  { id: "sales-lead-004", template: "Lead Routing", pack: "Sales", packColor: "#8B5CF6", status: "completed", duration: "6.1s", cost: 4, trigger: "lead.created", time: "12m ago" },
  { id: "ops-inc-005", template: "Incident Escalation", pack: "Ops", packColor: "#14B8A6", status: "running", duration: "—", cost: 2, trigger: "incident.triggered", time: "15m ago" },
  { id: "fin-exp-006", template: "Expense Audit", pack: "Finance", packColor: "#F59E0B", status: "completed", duration: "1.9s", cost: 3, trigger: "expense.submitted", time: "22m ago" },
  { id: "sup-rev-007", template: "Review Recovery", pack: "Support", packColor: "#6366F1", status: "waiting_approval", duration: "8s", cost: 6, trigger: "review.posted", time: "30m ago" },
  { id: "hr-leave-008", template: "Leave Approval", pack: "HR", packColor: "#EC4899", status: "completed", duration: "3.5s", cost: 2, trigger: "leave.requested", time: "45m ago" },
];

const pendingApprovals = [
  { id: "1", workflowName: "Hiring Workflow", node: "Manager Approves Response", detail: "Candidate: Sarah Chen for Sr. Engineer — Strong Match (4.2/5)", pack: "HR", priority: "high" },
  { id: "2", workflowName: "Review Recovery", node: "Manager Approves Response", detail: "1-star review on Google from J. Smith — recovery response drafted", pack: "Support", priority: "high" },
  { id: "3", workflowName: "Inventory Monitoring", node: "Approve Reorder", detail: "3 items below safety stock — reorder total $2,400", pack: "Ops", priority: "medium" },
];

const statusColors: Record<string, string> = {
  completed: "bg-emerald-600",
  running: "bg-blue-500",
  waiting_approval: "bg-amber-500",
  failed: "bg-red-500",
  cancelled: "bg-ink-muted",
};

const statusLabels: Record<string, string> = {
  completed: "Completed",
  running: "Running",
  waiting_approval: "Awaiting Approval",
  failed: "Failed",
  cancelled: "Cancelled",
};

export default function DashboardOverview() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
        <p className="text-sm text-ink-muted mt-1">Real-time view of your operational workflows</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Workflow className="w-4 h-4" />}
          label="Workflows Today"
          value={stats.workflowsToday.toString()}
          sub={<span className="text-emerald-700">{stats.workflowsTrend} vs yesterday</span>}
        />
        <StatCard
          icon={<Clock className="w-4 h-4" />}
          label="Pending Approvals"
          value={stats.approvalsPending.toString()}
          sub={<Link href="/dashboard/approvals" className="text-orange-700 hover:underline">Review now</Link>}
          highlight
        />
        <StatCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Cost Today"
          value={formatCents(stats.costToday)}
          sub={<span>{formatCents(stats.costBudget - stats.costToday)} budget remaining</span>}
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Success Rate"
          value={`${stats.successRate}%`}
          sub={<span className="text-emerald-700">All systems healthy</span>}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Workflows */}
        <div className="lg:col-span-2 bg-white/40 border border-ink/8 rounded-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink/8">
            <h2 className="font-semibold text-ink">Recent Workflows</h2>
            <Link href="/dashboard/workflows" className="text-xs text-ink-muted hover:text-ink flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-ink/8">
            {recentRuns.map((run) => (
              <div key={run.id} className="flex items-center gap-4 px-5 py-3 hover:bg-ink/5 transition-colors">
                <div className={cn("w-2 h-2 rounded-full shrink-0", statusColors[run.status])} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate text-ink">{run.template}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                      style={{ backgroundColor: `${run.packColor}20`, color: run.packColor }}
                    >
                      {run.pack}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-ink-muted mt-0.5">
                    <span>{run.trigger}</span>
                    <span>{run.duration}</span>
                    <span>{formatCents(run.cost)}</span>
                  </div>
                </div>
                <div className="text-xs text-ink-muted shrink-0">{run.time}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white/40 border border-ink/8 rounded-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink/8">
            <h2 className="font-semibold text-ink flex items-center gap-2">
              Approvals
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-ink/5 text-ink">
                {pendingApprovals.length}
              </span>
            </h2>
            <Link href="/dashboard/approvals" className="text-xs text-ink-muted hover:text-ink flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-ink/8">
            {pendingApprovals.map((item) => (
              <div key={item.id} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-ink">{item.workflowName}</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full",
                    item.priority === "high" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                  )}>
                    {item.priority}
                  </span>
                </div>
                <p className="text-xs text-ink-muted mb-3">{item.detail}</p>
                <div className="flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-2xl text-xs font-medium hover:bg-emerald-200 transition-colors">
                    <CheckCircle className="w-3 h-3" /> Approve
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-red-100 text-red-800 rounded-2xl text-xs font-medium hover:bg-red-200 transition-colors">
                    <XCircle className="w-3 h-3" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Packs */}
      <div className="bg-white/40 border border-ink/8 rounded-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink/8">
          <h2 className="font-semibold text-ink">Active Packs</h2>
          <Link href="/dashboard/packs" className="text-xs text-ink-muted hover:text-ink flex items-center gap-1">
            Browse all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-ink/8">
          {[
            { name: "Finance", icon: "💰", color: "#F59E0B", workflows: 4, runsToday: 12 },
            { name: "HR", icon: "👥", color: "#EC4899", workflows: 3, runsToday: 8 },
            { name: "Support", icon: "🎧", color: "#6366F1", workflows: 3, runsToday: 15 },
            { name: "Ops", icon: "⚙️", color: "#14B8A6", workflows: 4, runsToday: 6 },
            { name: "Sales", icon: "🎯", color: "#8B5CF6", workflows: 4, runsToday: 6 },
          ].map((pack) => (
            <div key={pack.name} className="px-5 py-4 text-center">
              <div className="text-2xl mb-2">{pack.icon}</div>
              <div className="text-sm font-medium text-ink">{pack.name}</div>
              <div className="text-xs text-ink-muted mt-1">{pack.workflows} workflows</div>
              <div className="text-xs text-ink-muted mt-0.5">{pack.runsToday} runs today</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "bg-white/40 border rounded-2xl p-4",
      highlight ? "border-orange-400/30" : "border-ink/8"
    )}>
      <div className="flex items-center gap-2 text-ink-muted text-sm mb-1">{icon}{label}</div>
      <div className={cn("text-2xl font-bold text-ink", highlight && "text-orange-700")}>{value}</div>
      <div className="text-xs text-ink-muted mt-1">{sub}</div>
    </div>
  );
}
