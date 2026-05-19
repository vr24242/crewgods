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
import { useApprovals } from "@/lib/hooks";

const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse bg-ink/5 rounded-2xl ${className}`} />
);

export default function ApprovalsPage() {
  const [statusFilter, setStatusFilter] = useState<"all" | "pending">("all");
  const [decidingNode, setDecidingNode] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const { groups, error, isLoading, decide, refresh } = useApprovals();

  // Flatten all approvals from groups for display
  const allApprovals = groups.flatMap((g) =>
    g.approvals.map((a) => ({ ...a, workflowId: g.workflowId }))
  );

  const filtered = statusFilter === "all" ? allApprovals : allApprovals;
  // All items from the API are pending (decided ones are removed server-side)

  const pendingCount = allApprovals.length;

  const handleDecide = async (workflowId: string, nodeId: string, decision: "approved" | "rejected") => {
    setDecidingNode(nodeId);
    try {
      await decide(workflowId, nodeId, decision, "dashboard-user");
      setToast({ message: `Request ${decision} successfully`, type: "success" });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast({ message: `Failed to submit decision: ${(err as Error).message}`, type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setDecidingNode(null);
    }
  };

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <p className="text-sm text-red-700">Failed to load approvals: {error.message}</p>
        <button onClick={() => refresh()} className="mt-3 text-sm text-ink-muted hover:text-ink underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed top-6 right-6 z-50 px-4 py-3 rounded-2xl text-sm font-medium shadow-lg transition-all",
            toast.type === "success" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
          )}
        >
          {toast.message}
        </div>
      )}

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

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      )}

      {/* List */}
      {!isLoading && (
        <div className="space-y-4">
          {allApprovals.map((approval) => (
            <div
              key={`${approval.workflowId}-${approval.nodeId}`}
              className="bg-white/40 border border-ink/12 rounded-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="px-5 py-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-ink-muted font-mono">{approval.workflowId}</span>
                      <span className="text-xs text-ink-faint">--</span>
                      <span className="text-xs text-ink-muted">{approval.nodeName}</span>
                    </div>
                    <h3 className="font-medium text-ink">{approval.nodeName}</h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="flex items-center gap-1 text-xs text-ink-muted">
                      <Clock className="w-3 h-3" />
                      {timeAgo(new Date(approval.requestedAt))}
                    </span>
                  </div>
                </div>

                {/* Context */}
                {approval.context && Object.keys(approval.context).length > 0 && (
                  <pre className="text-sm text-ink-muted whitespace-pre-wrap font-sans bg-ink/5 rounded-2xl p-3 mb-4">
                    {Object.entries(approval.context)
                      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
                      .join("\n")}
                  </pre>
                )}

                {/* Channels */}
                <div className="flex items-center gap-2 text-xs text-ink-muted mb-4">
                  <span>Sent via:</span>
                  {approval.channels.map((c) => (
                    <span key={c} className="px-1.5 py-0.5 rounded bg-cream-200 text-ink-muted capitalize">{c}</span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleDecide(approval.workflowId, approval.nodeId, "approved")}
                    disabled={decidingNode === approval.nodeId}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 bg-emerald-100 text-emerald-800 rounded-2xl text-sm font-medium hover:bg-emerald-200 transition-colors",
                      decidingNode === approval.nodeId && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button
                    onClick={() => handleDecide(approval.workflowId, approval.nodeId, "rejected")}
                    disabled={decidingNode === approval.nodeId}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 bg-red-100 text-red-800 rounded-2xl text-sm font-medium hover:bg-red-200 transition-colors",
                      decidingNode === approval.nodeId && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <div className="flex-1" />
                  {approval.expiresAt && (
                    <span className="text-xs text-ink-muted flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Expires {timeAgo(new Date(approval.expiresAt)).replace(" ago", "")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && allApprovals.length === 0 && (
        <div className="py-12 text-center text-sm text-ink-muted bg-white/40 border border-ink/8 rounded-2xl">
          No pending approvals
        </div>
      )}
    </div>
  );
}
