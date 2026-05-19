"use client";

import { useState, useCallback } from "react";
import {
  Check,
  Plug,
  MessageSquare,
  Mail,
  CalendarDays,
  CreditCard,
  Send,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* Integration catalogue */

type Integration = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  defaultConnected: boolean;
};

const catalogue: Integration[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Send messages, create channels, receive approval responses",
    icon: <MessageSquare className="w-5 h-5" />,
    category: "Communication",
    defaultConnected: true,
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Send emails, receive invoices, process inbound messages",
    icon: <Mail className="w-5 h-5" />,
    category: "Communication",
    defaultConnected: true,
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    description: "Schedule meetings, check availability, sync events",
    icon: <CalendarDays className="w-5 h-5" />,
    category: "Productivity",
    defaultConnected: false,
  },
  {
    id: "github",
    name: "GitHub",
    description: "Repository events, PRs, issues, and deployment tracking",
    icon: <span className="text-lg leading-none">🐙</span>,
    category: "Engineering",
    defaultConnected: false,
  },
  {
    id: "jira",
    name: "Jira",
    description: "Issue tracking, sprint planning, and project management",
    icon: <span className="text-lg leading-none">📋</span>,
    category: "Project Management",
    defaultConnected: false,
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "CRM integration for contacts, deals, and pipeline management",
    icon: <span className="text-lg leading-none">☁️</span>,
    category: "CRM",
    defaultConnected: false,
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Payment processing, subscription management, and billing",
    icon: <CreditCard className="w-5 h-5" />,
    category: "Finance",
    defaultConnected: false,
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    description: "Transactional email delivery and marketing campaigns",
    icon: <Send className="w-5 h-5" />,
    category: "Communication",
    defaultConnected: false,
  },
];

/* Toast component */

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 bg-ink text-cream rounded-2xl shadow-lg animate-[slideUp_0.3s_ease-out]">
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="text-cream/60 hover:text-cream transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/* Main page */

export default function IntegrationsPage() {
  const [connected, setConnected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(catalogue.map((i) => [i.id, i.defaultConnected]))
  );
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, []);

  const handleToggle = useCallback(
    (id: string) => {
      if (connected[id]) {
        // Disconnect (local-only)
        setConnected((prev) => ({ ...prev, [id]: false }));
        showToast("Disconnected. Changes are local only.");
      } else {
        // Connect attempt -> coming soon toast
        showToast("Coming soon — OAuth connection in next release");
      }
    },
    [connected, showToast]
  );

  const connectedList = catalogue.filter((i) => connected[i.id]);
  const disconnectedList = catalogue.filter((i) => !connected[i.id]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink">Integrations</h1>
        <p className="text-sm text-ink-muted mt-1">
          Connect your tools to power workflow automations.
        </p>
      </div>

      {/* Connected */}
      {connectedList.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-ink-muted uppercase tracking-wider mb-3">
            Connected ({connectedList.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connectedList.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                isConnected
                onToggle={() => handleToggle(integration.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available */}
      {disconnectedList.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-ink-muted uppercase tracking-wider mb-3">
            Available ({disconnectedList.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {disconnectedList.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                isConnected={false}
                onToggle={() => handleToggle(integration.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Slide-up keyframe (injected once) */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* Card */

function IntegrationCard({
  integration,
  isConnected,
  onToggle,
}: {
  integration: Integration;
  isConnected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-4 p-4 bg-white/40 border rounded-2xl transition-colors",
        isConnected ? "border-emerald-400/30" : "border-ink/8"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0",
          isConnected ? "bg-emerald-100 text-emerald-700" : "bg-cream-200 text-ink-muted"
        )}
      >
        {integration.icon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-ink">{integration.name}</span>
          {isConnected && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              <Check className="w-3 h-3" /> Connected
            </span>
          )}
          {!isConnected && (
            <span className="text-[10px] text-ink-muted">{integration.category}</span>
          )}
        </div>
        <p className="text-xs text-ink-muted mt-0.5">{integration.description}</p>
      </div>

      {/* Toggle / Connect */}
      {isConnected ? (
        <button
          onClick={onToggle}
          className="text-xs px-3 py-1.5 rounded-2xl bg-emerald-100 text-emerald-800 hover:bg-red-100 hover:text-red-800 transition-colors shrink-0"
        >
          Disconnect
        </button>
      ) : (
        <button
          onClick={onToggle}
          className="text-xs px-3 py-1.5 rounded-2xl bg-ink text-cream hover:bg-ink-soft transition-colors shrink-0 flex items-center gap-1"
        >
          <Plug className="w-3 h-3" /> Connect
        </button>
      )}
    </div>
  );
}
