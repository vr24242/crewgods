"use client";

import {
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Workflow,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { cn, formatCents, formatDuration, timeAgo } from "@/lib/utils";
import { useDashboardStats } from "@/lib/hooks";

const statusColors: Record<string, string> = {
  completed: "bg-emerald-600",
  running: "bg-blue-500",
  waiting_approval: "bg-amber-500",
  failed: "bg-red-500",
  cancelled: "bg-ink-muted",
  paused: "bg-ink-faint",
};

const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse bg-ink/5 rounded-2xl ${className}`} />
);

export default function DashboardOverview() {
  const { stats: data, isLoading, error } = useDashboardStats();

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="card-soft p-8 text-center">
          <p className="text-ink-muted">Failed to load dashboard data</p>
          <p className="text-xs text-ink-faint mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
        <p className="text-sm text-ink-muted mt-1">Real-time view of your operational workflows</p>
      </div>

      {/* Stats */}
      {isLoading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[100px]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Workflow className="w-4 h-4" />}
            label="Workflows Today"
            value={data.workflowsToday.toString()}
            sub={<span className="text-emerald-700">{data.workflowsTrend} vs yesterday</span>}
          />
          <StatCard
            icon={<Clock className="w-4 h-4" />}
            label="Pending Approvals"
            value={data.approvalsPending.toString()}
            sub={<Link href="/dashboard/approvals" className="text-orange-700 hover:underline">Review now</Link>}
            highlight
          />
          <StatCard
            icon={<DollarSign className="w-4 h-4" />}
            label="Cost Today"
            value={formatCents(data.costToday)}
            sub={<span>{formatCents(data.costBudget - data.costToday)} budget remaining</span>}
          />
          <StatCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Success Rate"
            value={`${data.successRate}%`}
            sub={<span className="text-emerald-700">All systems healthy</span>}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Workflows */}
        <div className="lg:col-span-2 bg-white/40 border border-ink/8 rounded-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink/8">
            <h2 className="font-semibold text-ink">Recent Workflows</h2>
            <Link href="/dashboard/workflows" className="text-xs text-ink-muted hover:text-ink flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {isLoading || !data ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-[48px]" />)}
            </div>
          ) : (
            <div className="divide-y divide-ink/8">
              {data.recentRuns.map((run) => (
                <div key={run.id} className="flex items-center gap-4 px-5 py-3 hover:bg-ink/5 transition-colors">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", statusColors[run.status] ?? "bg-ink-muted")} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate text-ink">{run.templateName}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                        style={{ backgroundColor: `${run.packColor}20`, color: run.packColor }}
                      >
                        {run.pack}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-ink-muted mt-0.5">
                      <span>{run.trigger}</span>
                      <span>{run.duration ? formatDuration(run.duration) : "—"}</span>
                      <span>{formatCents(run.costCents)}</span>
                    </div>
                  </div>
                  <div className="text-xs text-ink-muted shrink-0">
                    {timeAgo(new Date(run.startedAt))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Approvals */}
        <div className="bg-white/40 border border-ink/8 rounded-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink/8">
            <h2 className="font-semibold text-ink flex items-center gap-2">
              Approvals
              {data && (
                <span className="px-1.5 py-0.5 text-xs rounded-full bg-ink/5 text-ink">
                  {data.pendingApprovals.length}
                </span>
              )}
            </h2>
            <Link href="/dashboard/approvals" className="text-xs text-ink-muted hover:text-ink flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {isLoading || !data ? (
            <div className="p-4 space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-[100px]" />)}
            </div>
          ) : (
            <div className="divide-y divide-ink/8">
              {data.pendingApprovals.map((item) => (
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
          )}
        </div>
      </div>

      {/* Active Packs */}
      {data && (
        <div className="bg-white/40 border border-ink/8 rounded-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink/8">
            <h2 className="font-semibold text-ink">Active Packs</h2>
            <Link href="/dashboard/packs" className="text-xs text-ink-muted hover:text-ink flex items-center gap-1">
              Browse all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-ink/8">
            {data.packStats.map((pack) => (
              <div key={pack.name} className="px-5 py-4 text-center">
                <div className="text-2xl mb-2">{pack.icon}</div>
                <div className="text-sm font-medium text-ink">{pack.name}</div>
                <div className="text-xs text-ink-muted mt-1">{pack.workflows} workflows</div>
                <div className="text-xs text-ink-muted mt-0.5">{pack.runsToday} runs today</div>
              </div>
            ))}
          </div>
        </div>
      )}
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
