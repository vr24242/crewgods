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
import { usePacks } from "@/lib/hooks";

const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse bg-ink/5 rounded-2xl ${className}`} />
);

export default function PacksPage() {
  const [expandedPack, setExpandedPack] = useState<string | null>(null);
  const { packs, error, isLoading } = usePacks();

  if (error) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center">
        <p className="text-sm text-red-700">Failed to load packs: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Workflow Packs</h1>
        <p className="text-sm text-ink-muted mt-1">
          Pre-built operational workflows. Enable a pack to start automating.
        </p>
      </div>

      {/* Summary */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/40 border border-ink/8 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-ink">{packs.length}</div>
            <div className="text-xs text-ink-muted">Available Packs</div>
          </div>
          <div className="bg-white/40 border border-ink/8 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-ink">{packs.reduce((s, p) => s + p.workflowCount, 0)}</div>
            <div className="text-xs text-ink-muted">Total Workflows</div>
          </div>
          <div className="bg-white/40 border border-ink/8 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-ink">
              {formatCents(packs.reduce((s, p) => s + p.workflows.reduce((ws, w) => ws + w.estimatedCostCents, 0), 0))}
            </div>
            <div className="text-xs text-ink-muted">Est. Cost / Full Run</div>
          </div>
        </div>
      )}

      {/* Loading skeleton for packs */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}

      {/* Packs */}
      {!isLoading && (
        <div className="space-y-4">
          {packs.map((pack) => {
            const isExpanded = expandedPack === pack.id;
            return (
              <div
                key={pack.id}
                className="bg-white/40 border border-ink/12 rounded-2xl overflow-hidden transition-colors"
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
                    </div>
                    <p className="text-sm text-ink-muted mt-0.5">{pack.description}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-ink-muted">
                    <span>{pack.workflowCount} workflows</span>
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
                            <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />~{formatCents(wf.estimatedCostCents)}/run</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
