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
import { cn, formatCents, formatDuration, timeAgo } from "@/lib/utils";
import { useWorkflowRuns, useWorkflowTemplates, useWorkflowActions } from "@/lib/hooks";
import type { WorkflowRun } from "@/lib/api";

const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse bg-ink/5 rounded-2xl ${className}`} />
);

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

  const { runs, error, isLoading, refresh } = useWorkflowRuns();
  const { templates } = useWorkflowTemplates();
  const { pauseWorkflow, resumeWorkflow, cancelWorkflow } = useWorkflowActions();

  // Derive unique pack names from runs for the filter dropdown
  const packNames = Array.from(new Set(runs.map((r) => r.pack))).sort();

  const filtered = runs.filter((w) => {
    if (statusFilter !== "all" && w.status !== statusFilter) return false;
    if (packFilter !== "all" && w.pack !== packFilter) return false;
    if (search && !w.templateName.toLowerCase().includes(search.toLowerCase()) && !w.id.includes(search)) return false;
    return true;
  });

  const progress = (w: WorkflowRun) =>
    w.nodeCount > 0 ? Math.round((w.nodesCompleted / w.nodeCount) * 100) : 0;

  if (error) {
    return (
      <div className="max-w-7xl mx-auto py-12 text-center">
        <p className="text-sm text-red-700">Failed to load workflows: {error.message}</p>
        <button onClick={() => refresh()} className="mt-3 text-sm text-ink-muted hover:text-ink underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Workflow Runs</h1>
          <p className="text-sm text-ink-muted mt-1">Monitor and manage all workflow executions</p>
        </div>
        <button
          onClick={() => refresh()}
          className="flex items-center gap-2 px-3 py-2 bg-cream-200 rounded-2xl text-sm text-ink-soft hover:bg-ink/8 transition-colors"
        >
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
          {packNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="bg-white/40 border border-ink/8 rounded-2xl p-5 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="w-2 h-2 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-1.5 w-20" />
              <Skeleton className="h-4 w-12 ml-auto" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {!isLoading && (
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
                      <div className="text-sm font-medium text-ink">{w.templateName}</div>
                      <div className="text-xs text-ink-muted font-mono">{w.id}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="text-xs px-2 py-1 rounded font-medium"
                        style={{ backgroundColor: `${w.packColor}15`, color: w.packColor }}
                      >
                        {w.pack}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-xs text-ink-soft">{w.trigger}</div>
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
                            style={{ width: `${progress(w)}%` }}
                          />
                        </div>
                        <span className="text-xs text-ink-muted">{w.nodesCompleted}/{w.nodeCount}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-xs text-ink-muted">
                        {w.duration ? formatDuration(w.duration) : w.startedAt ? timeAgo(new Date(w.startedAt)) : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-xs text-ink-muted">{formatCents(w.costCents)}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 rounded hover:bg-ink/8 transition-colors" title="View details">
                          <Eye className="w-3.5 h-3.5 text-ink-muted" />
                        </button>
                        {w.status === "running" && (
                          <button
                            onClick={() => pauseWorkflow(w.id)}
                            className="p-1.5 rounded hover:bg-ink/8 transition-colors"
                            title="Pause"
                          >
                            <Pause className="w-3.5 h-3.5 text-ink-muted" />
                          </button>
                        )}
                        {w.status === "paused" && (
                          <button
                            onClick={() => resumeWorkflow(w.id)}
                            className="p-1.5 rounded hover:bg-ink/8 transition-colors"
                            title="Resume"
                          >
                            <Play className="w-3.5 h-3.5 text-ink-muted" />
                          </button>
                        )}
                        {(w.status === "running" || w.status === "waiting_approval" || w.status === "paused") && (
                          <button
                            onClick={() => cancelWorkflow(w.id)}
                            className="p-1.5 rounded hover:bg-ink/8 transition-colors"
                            title="Cancel"
                          >
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
      )}
    </div>
  );
}
