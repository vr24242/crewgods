# CrewGods

## Overview

CrewGods is an AI-native operational autopilot for small teams. It replaces manual coordination, approvals, and monitoring with durable, AI-powered workflows that run autonomously while keeping humans in the loop for critical decisions.

- **Framework**: Next.js 16 (App Router) + React 18
- **Workflow Engine**: Temporal OSS for durable execution
- **Database**: Drizzle ORM + Neon PostgreSQL
- **API Layer**: Fastify server for webhooks, workflow management, and approvals
- **Design Aesthetic**: Warm cream palette with Instrument Serif (display) and Geist (body) typography

---

## Architecture

### Frontend

| Layer | Details |
|---|---|
| Framework | Next.js App Router, React 18, Tailwind CSS v4 |
| Landing Page | 12 sections with scroll-reveal animations (IntersectionObserver), SVG gradient art, auto-advancing carousels |
| Dashboard | 6 pages: Overview, Workflows, Packs, Approvals, Integrations, Settings |
| Auth | Google OAuth with JWT sessions via `jose` |

### Backend

| Layer | Details |
|---|---|
| Workflow Engine | Temporal OSS handles durable workflow execution with retry, timeout, and compensation logic |
| API Server | Fastify serves webhooks, workflow management, approval endpoints, and pack browsing |
| Activities | 10 activity functions (AI classify, AI generate, AI decide, AI extract, AI summarize, fetch, action, condition, loop, approval) |

### Database

Drizzle ORM + Neon PostgreSQL with the following tables:

| Table | Purpose |
|---|---|
| `orgs` | Organization/team accounts |
| `users` | User profiles and auth records |
| `integrations` | Connected third-party services (Slack, Gmail, QuickBooks, etc.) |
| `eventSubscriptions` | Event-to-workflow trigger mappings |
| `workflowRuns` | Execution records for each workflow run |
| `nodeRuns` | Per-node execution state within a workflow run |
| `approvals` | Human-in-the-loop approval requests and responses |
| `activityLog` | Audit trail of all workflow actions |
| `webhookEvents` | Inbound webhook payloads |

---

## Workflow Packs

5 packs containing 18 workflows total:

| Pack | Icon | Workflows | Required Integrations |
|---|---|---|---|
| **Finance** | `$` | Invoice Approval, Expense Audit, Payment Escalation, Bank Reconciliation | Gmail, Slack, QuickBooks |
| **HR** | `team` | Hiring Workflow, Onboarding Workflow, Leave Approval | Slack, Gmail, Google Sheets |
| **Support** | `headset` | Complaint Routing, Review Recovery, SLA Escalation | Slack, Gmail, Zendesk |
| **Ops** | `gear` | Incident Escalation, Vendor Onboarding, Inventory Monitoring, SLA Monitoring | Slack, Gmail, Google Sheets |
| **Sales** | `target` | Lead Routing, Pipeline Health Check, Proposal Generation, Deal Stage Alerts | Slack, Gmail, HubSpot |

---

## Key Directories

```
src/
├── app/                          # Next.js pages & API routes
├── components/landing/           # Landing page components (12 sections)
├── temporal/
│   ├── workflows/packs/          # 5 workflow pack definitions
│   │   ├── index.ts              # WorkflowPack type + registry
│   │   ├── finance.ts            # 4 finance workflows
│   │   ├── hr.ts                 # 3 HR workflows
│   │   ├── support.ts            # 3 support workflows
│   │   ├── ops.ts                # 4 ops workflows
│   │   └── sales.ts              # 4 sales workflows
│   ├── workers/                  # Temporal worker entry (main.ts)
│   └── activities/               # 10 activity functions
├── api/                          # Fastify server & routes
├── auth/                         # JWT + Google OAuth
└── db/                           # Drizzle schema & connection
```

---

## Running

| Command | Purpose |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npx ts-node src/temporal/workers/main.ts` | Start Temporal worker |
| `npx ts-node src/api/server.ts` | Start Fastify API server |

---

## Design System

### Colors

| Token | Value | Usage |
|---|---|---|
| `cream` | `#F4EDE0` | Page background |
| `ink` | `#1F1813` | Primary text |
| `ink-soft` | — | Secondary text |
| `ink-muted` | — | Tertiary text, borders |
| `ink-faint` | — | Disabled states, dividers |

### Typography

| Role | Font |
|---|---|
| Display / headings | Instrument Serif |
| Body / UI | Geist |

### Components

- **card-soft** — Rounded cards with subtle shadow on cream background
- **glass-tile** — Frosted-glass panels for dashboard widgets
- **btn-primary** — Ink background, cream text, rounded
- **btn-secondary** — Outlined variant with ink border
- **eyebrow pills** — Small uppercase labels above headings

### Animations

- **scroll-reveal** — Fade-up on enter via IntersectionObserver
- **marquee** — Continuous horizontal scroll for logo strips
- **drift** — Slow parallax movement on SVG gradient art
- **auto-advancing carousel** — Timed slide transitions with manual override
