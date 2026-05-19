"use client";

import React, { useState, useRef, useEffect } from "react";
import { Reveal, RevealOne, useReveal } from "./motion";
import { Icon } from "./icons";
import { BlobThumb } from "./gradients";

// ── Shared layout ───────────────────────────────────────────
const Container = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`w-full max-w-[1280px] mx-auto px-6 md:px-10 ${className}`}>
    {children}
  </div>
);

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="eyebrow">{children}</span>
);

// ── 3D Tilt Card ────────────────────────────────────────────
function TiltCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) scale3d(1.02, 1.02, 1.02)`;
  };

  const handleMouseLeave = () => {
    const el = cardRef.current;
    if (el) el.style.transform = "perspective(800px) rotateY(0) rotateX(0) scale3d(1,1,1)";
  };

  return (
    <div
      ref={cardRef}
      className={`tilt-card ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transformStyle: "preserve-3d", transition: "transform 0.15s ease-out" }}
    >
      {children}
    </div>
  );
}

// ── Animated node graph (mini DAG visualization) ────────────
function DagViz() {
  return (
    <div className="dag-viz relative w-full h-[200px] md:h-[240px]">
      <svg viewBox="0 0 600 200" className="w-full h-full" fill="none">
        {/* Edges */}
        <path d="M100 100 L200 60" stroke="var(--ink-faint)" strokeWidth="2" strokeDasharray="6 4" className="dag-edge dag-edge-1" />
        <path d="M100 100 L200 140" stroke="var(--ink-faint)" strokeWidth="2" strokeDasharray="6 4" className="dag-edge dag-edge-2" />
        <path d="M200 60 L340 80" stroke="var(--ink-faint)" strokeWidth="2" strokeDasharray="6 4" className="dag-edge dag-edge-3" />
        <path d="M200 140 L340 80" stroke="var(--ink-faint)" strokeWidth="2" strokeDasharray="6 4" className="dag-edge dag-edge-4" />
        <path d="M200 140 L340 160" stroke="var(--ink-faint)" strokeWidth="2" strokeDasharray="6 4" className="dag-edge dag-edge-5" />
        <path d="M340 80 L480 100" stroke="var(--ink-faint)" strokeWidth="2" strokeDasharray="6 4" className="dag-edge dag-edge-6" />
        <path d="M340 160 L480 100" stroke="var(--ink-faint)" strokeWidth="2" strokeDasharray="6 4" className="dag-edge dag-edge-7" />

        {/* Nodes */}
        <g className="dag-node dag-node-1">
          <circle cx="100" cy="100" r="22" fill="var(--cream)" stroke="var(--ink)" strokeWidth="2" />
          <text x="100" y="105" textAnchor="middle" fill="var(--ink)" fontSize="11" fontWeight="600">Trigger</text>
        </g>
        <g className="dag-node dag-node-2">
          <circle cx="200" cy="60" r="22" fill="#FF7A35" fillOpacity="0.15" stroke="#FF7A35" strokeWidth="2" />
          <text x="200" y="65" textAnchor="middle" fill="var(--ink)" fontSize="10" fontWeight="500">AI</text>
        </g>
        <g className="dag-node dag-node-3">
          <circle cx="200" cy="140" r="22" fill="#6E5BB8" fillOpacity="0.15" stroke="#6E5BB8" strokeWidth="2" />
          <text x="200" y="145" textAnchor="middle" fill="var(--ink)" fontSize="10" fontWeight="500">Fetch</text>
        </g>
        <g className="dag-node dag-node-4">
          <rect x="312" y="60" width="56" height="40" rx="12" fill="#F26B7A" fillOpacity="0.15" stroke="#F26B7A" strokeWidth="2" />
          <text x="340" y="85" textAnchor="middle" fill="var(--ink)" fontSize="10" fontWeight="600">Approve</text>
        </g>
        <g className="dag-node dag-node-5">
          <circle cx="340" cy="160" r="22" fill="#5FA39B" fillOpacity="0.15" stroke="#5FA39B" strokeWidth="2" />
          <text x="340" y="165" textAnchor="middle" fill="var(--ink)" fontSize="10" fontWeight="500">Action</text>
        </g>
        <g className="dag-node dag-node-6">
          <circle cx="480" cy="100" r="22" fill="var(--ink)" fillOpacity="0.1" stroke="var(--ink)" strokeWidth="2" />
          <text x="480" y="105" textAnchor="middle" fill="var(--ink)" fontSize="10" fontWeight="600">Done</text>
        </g>
      </svg>
    </div>
  );
}

// ── Floating 3D architecture diagram ────────────────────────
function ArchDiagram() {
  return (
    <div className="arch-scene" style={{ perspective: "1200px" }}>
      <div className="arch-stack">
        {[
          { label: "Next.js Frontend", color: "#1F1813", sub: "App Router · React 18 · Tailwind" },
          { label: "Fastify API Layer", color: "#FF7A35", sub: "Webhooks · Approvals · Packs" },
          { label: "Temporal Engine", color: "#6E5BB8", sub: "Durable Workflows · Signals · Queries" },
          { label: "Neon PostgreSQL", color: "#5FA39B", sub: "Drizzle ORM · Event Sourced" },
        ].map((layer, i) => (
          <div
            key={layer.label}
            className="arch-layer"
            style={{
              "--layer-i": i,
              "--layer-color": layer.color,
            } as React.CSSProperties}
          >
            <div className="arch-layer-inner">
              <div className="text-[15px] font-semibold" style={{ color: layer.color }}>
                {layer.label}
              </div>
              <div className="text-[12px] text-ink-muted mt-0.5">{layer.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Workflow pack data ──────────────────────────────────────
const PACKS = [
  {
    name: "Finance",
    tone: "orange",
    icon: Icon.Zap,
    workflows: [
      {
        name: "Invoice Approval",
        trigger: "Email / webhook",
        nodes: ["Extract invoice data (AI)", "Match to purchase order", "Flag anomalies", "Route for approval", "Process payment"],
        approvalGate: "CFO approval for invoices > threshold",
      },
      {
        name: "Expense Audit",
        trigger: "Daily cron",
        nodes: ["Pull recent expenses", "AI policy check", "Flag violations", "Notify manager", "Update ledger"],
        approvalGate: "Manager review for flagged items",
      },
      {
        name: "Payment Escalation",
        trigger: "Overdue event",
        nodes: ["Detect overdue", "Generate reminder", "Send follow-up", "Escalate to collections"],
        approvalGate: "Approve escalation to collections",
      },
      {
        name: "Bank Reconciliation",
        trigger: "Daily cron",
        nodes: ["Fetch bank feed", "Match transactions", "Flag discrepancies", "Generate report"],
        approvalGate: "Review unmatched transactions",
      },
    ],
  },
  {
    name: "HR & Recruiting",
    tone: "rose",
    icon: Icon.Users,
    workflows: [
      {
        name: "Hiring Pipeline",
        trigger: "Application received",
        nodes: ["Parse resume (AI)", "Score candidate", "Schedule screen", "Send assessment", "Route to hiring manager"],
        approvalGate: "Hiring manager decision at each stage",
      },
      {
        name: "Onboarding Checklist",
        trigger: "Offer accepted",
        nodes: ["Create accounts", "Send welcome pack", "Assign buddy", "Schedule day-1 meetings", "Track completion"],
        approvalGate: "IT approval for access provisioning",
      },
      {
        name: "Leave Approval",
        trigger: "Leave request",
        nodes: ["Check balance", "Verify coverage", "Route to manager", "Update calendar", "Notify team"],
        approvalGate: "Manager approval",
      },
    ],
  },
  {
    name: "Support",
    tone: "purple",
    icon: Icon.Mail,
    workflows: [
      {
        name: "Complaint Router",
        trigger: "Ticket created",
        nodes: ["Classify severity (AI)", "Extract entities", "Route to specialist", "Draft response (AI)", "Send reply"],
        approvalGate: "Agent approval for AI-drafted replies",
      },
      {
        name: "Review Recovery",
        trigger: "Negative review",
        nodes: ["Sentiment analysis (AI)", "Match to order", "Generate response", "Offer resolution", "Follow up"],
        approvalGate: "Approve compensation offers",
      },
      {
        name: "SLA Escalation",
        trigger: "SLA breach",
        nodes: ["Detect breach", "Identify owner", "Escalate to lead", "Notify customer", "Log incident"],
        approvalGate: "Lead review on escalation path",
      },
    ],
  },
  {
    name: "Operations",
    tone: "teal",
    icon: Icon.Layers,
    workflows: [
      {
        name: "Incident Escalation",
        trigger: "Alert fired",
        nodes: ["Classify severity (AI)", "Page on-call", "Create war room", "Track resolution", "Post-mortem", "Update runbook"],
        approvalGate: "SEV1-2: VP approval for customer comms",
      },
      {
        name: "Vendor Onboarding",
        trigger: "New vendor request",
        nodes: ["Compliance check", "Request documents", "Legal review", "Set up in system", "Send welcome"],
        approvalGate: "Legal + finance sign-off",
      },
      {
        name: "Inventory Monitoring",
        trigger: "Daily cron",
        nodes: ["Check stock levels", "Predict demand (AI)", "Generate reorder list", "Submit PO", "Confirm delivery"],
        approvalGate: "Approve reorder above budget threshold",
      },
      {
        name: "SLA Monitoring",
        trigger: "Daily cron",
        nodes: ["Scan active SLAs", "Calculate compliance", "Detect breaches", "Escalate violations", "Generate report"],
        approvalGate: "Manager review on breach escalation",
      },
    ],
  },
  {
    name: "Sales",
    tone: "blue",
    icon: Icon.ArrowRight,
    workflows: [
      {
        name: "Lead Routing",
        trigger: "New lead",
        nodes: ["Enrich from CRM", "AI scoring", "Segment (hot/warm/nurture)", "Assign to rep", "Draft intro", "Send"],
        approvalGate: "Rep approval on AI-drafted outreach",
      },
      {
        name: "Pipeline Health",
        trigger: "Daily cron",
        nodes: ["Scan pipeline", "Detect stale deals", "AI coaching tips", "Nudge reps", "Report to manager"],
        approvalGate: "None — fully automated",
      },
      {
        name: "Proposal Generation",
        trigger: "Deal stage change",
        nodes: ["Pull deal context", "Generate proposal (AI)", "Manager review", "Send to prospect", "Track opens"],
        approvalGate: "Manager approval before send",
      },
      {
        name: "Deal Stage Alerts",
        trigger: "CRM event",
        nodes: ["Detect stage change", "Win: celebration", "Loss: analysis (AI)", "Coaching DM", "Update forecast"],
        approvalGate: "None — notification only",
      },
    ],
  },
];

// ── Workflow card with expand ───────────────────────────────
function WorkflowCard({
  workflow,
  index,
}: {
  workflow: (typeof PACKS)[0]["workflows"][0];
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`card-soft transition-all duration-300 cursor-pointer ${
        expanded ? "bg-cream-50/80" : ""
      }`}
      onClick={() => setExpanded(!expanded)}
      style={{ "--rev-d": `${index * 60}ms` } as React.CSSProperties}
    >
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="serif text-[18px] md:text-[20px]">{workflow.name}</div>
          <div className="text-[12px] text-ink-muted mt-0.5">
            Trigger: {workflow.trigger}
          </div>
        </div>
        <span
          className={`w-7 h-7 grid place-items-center rounded-full bg-ink/5 flex-none transition-transform duration-300 ${
            expanded ? "rotate-180" : ""
          }`}
        >
          <Icon.ChevDown size={12} />
        </span>
      </div>
      <div
        className="grid transition-[grid-template-rows] duration-500 ease-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className={`px-5 pb-5 transition-opacity duration-300 ${expanded ? "opacity-100" : "opacity-0"}`}>
            {/* Node flow */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {workflow.nodes.map((node, i) => (
                <React.Fragment key={i}>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium ${
                    node.includes("AI")
                      ? "bg-orange-100 text-orange-800"
                      : node.includes("Approv") || node.includes("review") || node.includes("Review")
                      ? "bg-rose-100 text-rose-800"
                      : "bg-ink/5 text-ink-soft"
                  }`}>
                    {node}
                  </span>
                  {i < workflow.nodes.length - 1 && (
                    <Icon.ArrowRight size={10} className="text-ink-faint" />
                  )}
                </React.Fragment>
              ))}
            </div>
            {/* Approval gate */}
            <div className="flex items-start gap-2 mt-2 p-3 rounded-2xl bg-ink/[0.03]">
              <Icon.Shield size={14} className="text-ink-muted mt-0.5 flex-none" />
              <div className="text-[13px] text-ink-soft leading-snug">
                <span className="font-medium text-ink">Approval gate:</span>{" "}
                {workflow.approvalGate}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pack section with workflow list ─────────────────────────
function PackDetail({
  pack,
  isOpen,
  onToggle,
}: {
  pack: (typeof PACKS)[0];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const PackIcon = pack.icon;
  return (
    <div className="border-b hairline last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full text-left py-6 md:py-8 flex items-center gap-5 group"
      >
        <div className="transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110">
          <BlobThumb tone={pack.tone} size={56} />
        </div>
        <div className="flex-1">
          <div className="serif text-[clamp(28px,3vw,38px)]">{pack.name}</div>
          <div className="text-[13px] text-ink-muted mt-1">
            {pack.workflows.length} workflows
          </div>
        </div>
        <span
          className={`w-9 h-9 grid place-items-center rounded-full bg-ink text-cream-50 flex-none transition-transform duration-300 ${
            isOpen ? "rotate-45" : ""
          }`}
        >
          <Icon.Plus size={14} />
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-500 ease-out"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className={`pb-8 space-y-2 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}>
            {pack.workflows.map((wf, i) => (
              <WorkflowCard key={wf.name} workflow={wf} index={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN: Tech Section ──────────────────────────────────────
export const TechSection = () => {
  const archRef = useReveal();

  return (
    <section id="tech" className="py-24 md:py-32 border-t hairline">
      <Container>
        <Reveal stagger={120} className="text-center max-w-[1000px] mx-auto mb-20">
          <Eyebrow>Under the hood</Eyebrow>
          <h2 className="display text-[clamp(40px,6vw,84px)] mt-6">
            <span className="line">Built different.</span>
            <span className="line"><em>Runs forever.</em></span>
          </h2>
          <p className="text-[17px] text-ink-soft mt-6 max-w-[600px] mx-auto leading-[1.6]">
            Not another chatbot wrapper. Crewgods runs on durable infrastructure
            that survives crashes, retries gracefully, and never loses a workflow mid-run.
          </p>
        </Reveal>

        {/* Architecture cards — 3D tilt */}
        <Reveal stagger={100} className="grid md:grid-cols-3 gap-4 mb-20">
          <TiltCard className="card-soft p-7 md:p-9">
            <div className="w-12 h-12 rounded-2xl bg-[#FF7A35]/10 grid place-items-center mb-5">
              <Icon.Workflow size={22} className="text-[#FF7A35]" />
            </div>
            <div className="serif text-[24px] mb-3">DAG Execution</div>
            <p className="text-[14.5px] text-ink-soft leading-[1.6]">
              Every workflow is a directed acyclic graph. Nodes run in parallel when
              dependencies allow, with edge conditions controlling the flow.
            </p>
          </TiltCard>

          <TiltCard className="card-soft p-7 md:p-9">
            <div className="w-12 h-12 rounded-2xl bg-[#6E5BB8]/10 grid place-items-center mb-5">
              <Icon.Shield size={22} className="text-[#6E5BB8]" />
            </div>
            <div className="serif text-[24px] mb-3">Durable Approvals</div>
            <p className="text-[14.5px] text-ink-soft leading-[1.6]">
              Workflows pause durably at approval gates. Respond from Slack,
              WhatsApp, email, or the dashboard — the engine remembers where it stopped.
            </p>
          </TiltCard>

          <TiltCard className="card-soft p-7 md:p-9">
            <div className="w-12 h-12 rounded-2xl bg-[#5FA39B]/10 grid place-items-center mb-5">
              <Icon.Cpu size={22} className="text-[#5FA39B]" />
            </div>
            <div className="serif text-[24px] mb-3">AI at Decision Points</div>
            <p className="text-[14.5px] text-ink-soft leading-[1.6]">
              Claude classifies, scores, drafts, and decides at specific nodes.
              The workflow engine controls execution — AI reasons, workflows execute.
            </p>
          </TiltCard>
        </Reveal>

        {/* Architecture visualization */}
        <div ref={archRef} data-reveal="" className="mb-20">
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div style={{ "--rev-d": "0ms" } as React.CSSProperties}>
              <div className="serif text-[clamp(28px,3vw,40px)] mb-4">
                Four layers. Zero babysitting.
              </div>
              <p className="text-[16px] text-ink-soft leading-[1.6] mb-6">
                The stack is designed so each layer can fail independently
                and recover without losing state. Temporal handles retries,
                Neon stores the audit trail, and the API layer keeps everything
                observable.
              </p>
              <div className="space-y-3">
                {[
                  { icon: Icon.Layers, text: "Event-sourced audit log for every action" },
                  { icon: Icon.Clock, text: "Configurable timeouts with auto-escalation" },
                  { icon: Icon.GitBranch, text: "Branching logic with edge conditions" },
                  { icon: Icon.Shield, text: "Multi-channel approval gates (Slack, email, WhatsApp)" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-ink/5 grid place-items-center flex-none">
                      <item.icon size={14} className="text-ink-muted" />
                    </div>
                    <span className="text-[14.5px] text-ink-soft">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ "--rev-d": "200ms" } as React.CSSProperties}>
              <ArchDiagram />
            </div>
          </div>
        </div>

        {/* DAG visualization */}
        <RevealOne className="mb-20">
          <div className="card-soft p-8 md:p-12">
            <div className="text-center mb-8">
              <div className="serif text-[clamp(24px,2.5vw,32px)]">
                Every workflow is a graph
              </div>
              <p className="text-[14.5px] text-ink-muted mt-2">
                Nodes execute in parallel where possible. AI nodes reason. Approval nodes pause. Action nodes execute.
              </p>
            </div>
            <DagViz />
          </div>
        </RevealOne>
      </Container>
    </section>
  );
};

// ── MAIN: Workflows Deep Dive Section ───────────────────────
export const WorkflowsSection = () => {
  const [openPack, setOpenPack] = useState(0);

  return (
    <section id="workflows" className="py-24 md:py-32 border-t hairline">
      <Container>
        <Reveal stagger={120} className="grid md:grid-cols-[1fr_1.2fr] gap-10 md:gap-16 mb-16 items-end">
          <div>
            <Eyebrow>All workflows</Eyebrow>
            <h2 className="display text-[clamp(40px,5.5vw,76px)] mt-6">
              <span className="line">18 workflows.</span>
              <span className="line"><em>5 packs.</em></span>
            </h2>
          </div>
          <p className="text-[17px] text-ink-soft leading-[1.6] max-w-[560px]">
            Each workflow is a production-ready DAG with AI reasoning nodes,
            approval gates, and integrations. Expand any pack to see every
            workflow, its trigger, node pipeline, and where humans stay in the loop.
          </p>
        </Reveal>

        <RevealOne>
          <div className="card-soft px-6 md:px-10">
            {PACKS.map((pack, i) => (
              <PackDetail
                key={pack.name}
                pack={pack}
                isOpen={openPack === i}
                onToggle={() => setOpenPack(openPack === i ? -1 : i)}
              />
            ))}
          </div>
        </RevealOne>
      </Container>
    </section>
  );
};
