# CrewGods Workflow Reference

Detailed documentation for all 18 workflows across 5 packs.

---

## Finance Pack

**Required integrations:** Gmail, Slack, QuickBooks

### 1. Invoice Approval

| Field | Value |
|---|---|
| ID | `finance-invoice-approval` |
| Trigger | Event: `invoice.received` |
| Tags | invoice, approval, finance |
| Est. Cost | ~$0.05/run |

**Nodes:**

| # | Node | Type | Description |
|---|---|---|---|
| 1 | Extract Invoice Details | `ai_extract` | Parses invoice email body to extract vendor, amount, currency, due date, invoice number, and line items (Haiku) |
| 2 | Check for Duplicate Invoices | `fetch` | Searches QuickBooks for existing invoices from same vendor/number |
| 3 | Classify Invoice Risk | `ai_classify` | Categorizes as auto_approve, manager_approval, finance_review, or flag_suspicious based on amount and duplicate status (Haiku) |
| 4 | Route for Approval | `condition` | Branches on classification result |
| 5 | Auto-Approve Invoice | `action` | Creates a low-priority task for auto-approved invoices |
| 6 | Request Manager Approval | `approval` | Sends approval request via Slack, email, and dashboard; expires in 3 days |
| 7 | Record in Accounting | `action` | Updates QuickBooks with approved invoice record |
| 8 | Notify Team | `action` | Posts approval confirmation to #finance Slack channel |

**Flow:** Extract -> Check Duplicates + Classify Risk -> Route -> (Auto-Approve OR Manager Approval) -> Record in Accounting -> Notify Team

**Approval gate:** Node 6 (Request Manager Approval) for non-auto-approved invoices. Channels: Slack, email, dashboard. Expires: 3 days.

---

### 2. Expense Audit

| Field | Value |
|---|---|
| ID | `finance-expense-audit` |
| Trigger | Event: `expense.submitted` |
| Tags | expense, audit, compliance |
| Est. Cost | ~$0.03/run |

**Nodes:**

| # | Node | Type | Description |
|---|---|---|---|
| 1 | Load Expense Details | `fetch` | Retrieves expense record from internal system |
| 2 | AI Audit Expense | `ai_classify` | Classifies as compliant, needs_receipt, over_policy, suspicious, or duplicate (Haiku) |
| 3 | Route Audit Result | `condition` | Branches on audit classification |
| 4 | Auto-Approve Compliant | `action` | Posts auto-approval to #expenses Slack channel |
| 5 | Flag for Finance Review | `approval` | Creates approval request for non-compliant expenses via Slack and dashboard |

**Flow:** Load Expense -> AI Audit -> Route -> (Auto-Approve OR Flag for Review)

**Approval gate:** Node 5 (Flag for Finance Review) for non-compliant expenses. Channels: Slack, dashboard. Priority: high.

---

### 3. Payment Escalation

| Field | Value |
|---|---|
| ID | `finance-payment-escalation` |
| Trigger | Event: `reconciliation.needed` + Cron: weekdays at 9:00 AM (`0 9 * * 1-5`) |
| Tags | payments, escalation, overdue |
| Est. Cost | ~$0.04/run |

**Nodes:**

| # | Node | Type | Description |
|---|---|---|---|
| 1 | Fetch Overdue Invoices | `fetch` | Retrieves overdue invoices from QuickBooks |
| 2 | AI Assess Urgency | `ai_decide` | Prioritizes each invoice: send_reminder, escalate_manager, escalate_legal, or write_off (Sonnet) |
| 3 | Generate Reminder Emails | `ai_generate` | Writes tone-appropriate reminders: gentle (1-7 days), firm (8-30), final notice (30+) (Haiku) |
| 4 | Send Reminder Emails | `loop` | Iterates through generated emails and sends each one |
| 5 | Report to Finance Team | `action` | Posts summary to #finance Slack channel |

**Flow:** Fetch Overdue -> Assess Urgency -> Generate Reminders -> Send Reminders -> Report to Finance

**Approval gate:** None (automated escalation path).

---

### 4. Bank Reconciliation

| Field | Value |
|---|---|
| ID | `finance-reconciliation` |
| Trigger | Event: `reconciliation.needed` + Cron: Monday at 7:00 AM (`0 7 * * 1`) |
| Tags | reconciliation, banking, weekly |
| Est. Cost | ~$0.08/run |

**Nodes:**

| # | Node | Type | Description |
|---|---|---|---|
| 1 | Fetch Bank Transactions | `fetch` | Pulls last 7 days of transactions from Plaid |
| 2 | Fetch Book Entries | `fetch` | Pulls last 7 days of entries from QuickBooks |
| 3 | AI Match Transactions | `ai_decide` | Matches bank transactions to book entries by amount, date (+/-2 days), and description (Sonnet) |
| 4 | Generate Reconciliation Report | `ai_generate` | Summarizes matched count, unmatched items, discrepancies, and total variance (Haiku) |
| 5 | Send Report | `action` | Posts reconciliation report to #finance Slack channel |

**Flow:** Fetch Bank + Fetch Books (parallel) -> AI Match -> Generate Report -> Send Report

**Approval gate:** None (reporting workflow).

---

## HR Pack

**Required integrations:** Slack, Gmail, Google Sheets

### 5. Hiring Workflow

| Field | Value |
|---|---|
| ID | `hr-hiring` |
| Trigger | Event: `application.received` |
| Tags | hiring, screening, candidates |
| Est. Cost | ~$0.05/run |

**Nodes:**

| # | Node | Type | Description |
|---|---|---|---|
| 1 | AI Screen Resume | `ai_classify` | Classifies candidate as strong_match, potential_match, weak_match, or no_match (Sonnet) |
| 2 | Score Candidate | `ai_generate` | Scores 1-5 on experience, skills, education, culture fit; flags bias in reasoning (Sonnet) |
| 3 | Route by Score | `condition` | Branches based on screening classification |
| 4 | Advance to Interview | `action` | Creates task to schedule interview for strong/potential matches |
| 5 | Send Rejection | `ai_generate` | Writes kind, professional rejection email under 100 words (Haiku) |
| 6 | Send Rejection Email | `action` | Sends rejection email via Gmail |
| 7 | Notify Hiring Manager | `action` | Posts screening result and score to #hiring Slack channel |

**Flow:** Screen Resume -> Score Candidate + Route -> (Advance to Interview OR Send Rejection -> Send Email); Score -> Notify Hiring Manager

**Approval gate:** None (automated screening with human review via task creation).

---

### 6. Onboarding Workflow

| Field | Value |
|---|---|
| ID | `hr-onboarding` |
| Trigger | Event: `candidate.hired` |
| Tags | onboarding, new-hire, checklist |
| Est. Cost | ~$0.06/run |

**Nodes:**

| # | Node | Type | Description |
|---|---|---|---|
| 1 | Generate Onboarding Checklist | `ai_generate` | Creates checklist covering IT setup, HR paperwork, manager tasks, and team intros (Sonnet) |
| 2 | Create All Tasks | `loop` | Iterates through checklist items and creates individual tasks |
| 3 | Generate Welcome Email | `ai_generate` | Writes warm welcome email with start date, logistics, and what to bring (Haiku) |
| 4 | Send Welcome Email | `action` | Sends welcome email via Gmail |
| 5 | Notify Team | `action` | Announces new hire in #general Slack channel |

**Flow:** Generate Checklist -> Create Tasks + Notify Team; Generate Welcome Email -> Send Welcome Email (runs in parallel with checklist flow)

**Approval gate:** None (automated onboarding).

---

### 7. Leave Approval

| Field | Value |
|---|---|
| ID | `hr-leave-approval` |
| Trigger | Event: `leave.requested` |
| Tags | leave, approval, time-off |
| Est. Cost | ~$0.02/run |

**Nodes:**

| # | Node | Type | Description |
|---|---|---|---|
| 1 | Check Leave Balance | `fetch` | Retrieves remaining leave balance by type |
| 2 | Check Team Coverage | `fetch` | Checks team coverage percentage for requested dates |
| 3 | AI Assess Request | `ai_decide` | Decides auto_approve, needs_review, or flag_coverage_issue based on balance, coverage, and duration (Haiku) |
| 4 | Route Request | `condition` | Branches on assessment decision |
| 5 | Auto-Approve Leave | `action` | Posts auto-approval notification to manager's Slack |
| 6 | Request Manager Approval | `approval` | Sends approval request via Slack, WhatsApp, and dashboard; assigned to specific manager; expires in 2 days |
| 7 | Notify Employee | `action` | Sends email update to the requesting employee |

**Flow:** Check Balance + Check Coverage (parallel) -> AI Assess -> Route -> (Auto-Approve OR Manager Approval) -> Notify Employee

**Approval gate:** Node 6 (Request Manager Approval) for non-auto-approved requests. Channels: Slack, WhatsApp, dashboard. Expires: 2 days. Auto-approve criteria: sufficient balance, team coverage >50%, under 3 days.

---

## Support Pack

**Required integrations:** Slack, Gmail, Zendesk

### 8. Complaint Routing

| Field | Value |
|---|---|
| ID | `support-complaint-routing` |
| Trigger | Event: `complaint.received` |
| Tags | complaint, routing, triage |
| Est. Cost | ~$0.03/run |

**Nodes:**

| # | Node | Type | Description |
|---|---|---|---|
| 1 | Classify Complaint | `ai_classify` | Categorizes into billing, product_defect, service_quality, delivery, refund_request, account_issue, safety, or other (Haiku) |
| 2 | Assess Severity & Sentiment | `ai_decide` | Assigns priority: p1_immediate, p2_same_day, p3_next_day, or p4_standard (Haiku) |
| 3 | Route to Team | `condition` | Branches by severity and category |
| 4 | Create Support Ticket | `action` | Creates a prioritized task with complaint details |
| 5 | Alert Team (Urgent) | `action` | Posts to #support-urgent for P1 complaints only |
| 6 | Send Auto-Acknowledgement | `ai_generate` | Writes empathetic acknowledgement email with timeframe based on severity (Haiku) |
| 7 | Send Acknowledgement | `action` | Sends acknowledgement email to customer |

**Flow:** Classify -> Assess Severity + Auto-Acknowledge; Assess -> Route -> Create Ticket + (Alert Urgent if P1); Auto-Acknowledge -> Send Acknowledgement

**Approval gate:** None (automated triage and routing).

---

### 9. Review Recovery

| Field | Value |
|---|---|
| ID | `support-review-recovery` |
| Trigger | Event: `review.posted` |
| Tags | reviews, recovery, reputation |
| Est. Cost | ~$0.06/run |

**Nodes:**

| # | Node | Type | Description |
|---|---|---|---|
| 1 | Analyze Review | `ai_classify` | Classifies as positive, neutral, negative_recoverable, negative_severe, or fake_spam (Haiku) |
| 2 | Look Up Customer | `fetch` | Searches internal customer database by name/email |
| 3 | Route by Sentiment | `condition` | Branches on review classification |
| 4 | Generate Recovery Response | `ai_generate` | Writes genuine, non-corporate public response acknowledging the issue (Sonnet) |
| 5 | Manager Approves Response | `approval` | Manager reviews draft response via Slack and dashboard; expires in 4 hours |
| 6 | Post Public Response | `action` | Creates task to post approved response on review platform |
| 7 | Send Direct Outreach | `ai_generate` | Writes private email offering specific compensation (Haiku) |
| 8 | Send Outreach Email | `action` | Sends private outreach email to reviewer |
| 9 | Notify Team | `action` | Posts review recovery status to #reviews Slack channel |

**Flow:** Analyze Review -> Route (if negative) + Notify Team; Look Up Customer + Route -> Generate Response -> Manager Approval -> Post Public Response + Send Direct Outreach -> Send Outreach Email

**Approval gate:** Node 5 (Manager Approves Response) before any public response is posted. Channels: Slack, dashboard. Expires: 4 hours. Priority: high.

---

### 10. SLA Escalation

| Field | Value |
|---|---|
| ID | `support-escalation` |
| Trigger | Event: `sla.breached` + Cron: every 30 minutes (`*/30 * * * *`) |
| Tags | escalation, sla, monitoring |
| Est. Cost | ~$0.04/run |

**Nodes:**

| # | Node | Type | Description |
|---|---|---|---|
| 1 | Fetch SLA-Breached Tickets | `fetch` | Retrieves breached tickets from Zendesk |
| 2 | AI Assess Escalation Priority | `ai_decide` | Prioritizes: escalate_l2, escalate_manager, escalate_vp, auto_resolve, or close_stale (Sonnet) |
| 3 | Generate Escalation Summary | `ai_summarize` | Creates executive-style summary of escalations, max 200 words (Haiku) |
| 4 | Notify Team of Escalations | `action` | Posts SLA breach report to #support-escalations Slack channel |

**Flow:** Fetch Breached Tickets -> Assess Priority -> Generate Summary -> Notify Team

**Approval gate:** None (automated escalation reporting).

---

## Ops Pack

**Required integrations:** Slack, Gmail, Google Sheets

### 11. Incident Escalation

| Field | Value |
|---|---|
| ID | `ops-incident-escalation` |
| Trigger | Event: `incident.triggered` |
| Tags | incident, escalation, on-call |
| Est. Cost | ~$0.05/run |

**Nodes:**

| # | Node | Type | Description |
|---|---|---|---|
| 1 | Classify Incident | `ai_classify` | Categorizes as sev1_outage, sev2_degraded, sev3_minor, or sev4_cosmetic (Haiku) |
| 2 | Assess Impact | `ai_generate` | Evaluates blast radius: affected services, users impacted, revenue risk, immediate actions (Sonnet) |
| 3 | Route by Severity | `condition` | Branches on severity classification |
| 4 | Page On-Call Engineer | `action` | Posts to #incidents with impact details (SEV1/SEV2 only) |
| 5 | Create Incident Channel | `action` | Creates task to set up dedicated Slack channel (SEV1 only) |
| 6 | Log Minor Incident | `action` | Posts to #ops-log for SEV3/SEV4 |
| 7 | Notify Stakeholders | `ai_generate` | Writes plain-language incident notification for execs and customer success (Haiku) |
| 8 | Send Stakeholder Email | `action` | Sends incident notification email |

**Flow:** Classify -> Assess Impact + Route; Route -> Page On-Call (SEV1/2) + Create Channel (SEV1) OR Log Minor (SEV3/4); Assess Impact -> Page On-Call + Notify Stakeholders -> Send Email

**Approval gate:** None (automated incident response).

---

### 12. Vendor Onboarding

| Field | Value |
|---|---|
| ID | `ops-vendor-onboarding` |
| Trigger | Event: `vendor.submitted` |
| Tags | vendor, onboarding, compliance |
| Est. Cost | ~$0.06/run |

**Nodes:**

| # | Node | Type | Description |
|---|---|---|---|
| 1 | Extract Vendor Details | `ai_extract` | Parses application to extract company name, contact, services, annual value, certifications, insurance (Haiku) |
| 2 | AI Compliance Assessment | `ai_decide` | Evaluates against requirements: SOC2/ISO 27001, $1M insurance minimum, sanctions check (Sonnet) |
| 3 | Route by Compliance | `condition` | Branches on compliance decision |
| 4 | Request Procurement Approval | `approval` | Sends approval request for approved/needs_review vendors via Slack, email, dashboard; expires in 3 days |
| 5 | Request Additional Documents | `ai_generate` | Writes email requesting specific missing documents with 2-week deadline (Haiku) |
| 6 | Send Docs Request Email | `action` | Sends document request email to vendor contact |
| 7 | Create Vendor Record | `action` | Creates task to set up vendor account, assign ID, configure payment terms |
| 8 | Notify Ops Team | `action` | Posts onboarding status to #ops Slack channel |

**Flow:** Extract Details -> Compliance Assessment -> Route + Notify Ops; Route -> (Procurement Approval -> Create Vendor Record) OR (Request Docs -> Send Docs Email)

**Approval gate:** Node 4 (Request Procurement Approval) for vendors that pass or need compliance review. Channels: Slack, email, dashboard. Expires: 3 days.

---

### 13. Inventory Monitoring

| Field | Value |
|---|---|
| ID | `ops-inventory-alerts` |
| Trigger | Event: `inventory.low_stock` + Cron: daily at 8:00 AM (`0 8 * * *`) |
| Tags | inventory, alerts, reorder |
| Est. Cost | ~$0.04/run |

**Nodes:**

| # | Node | Type | Description |
|---|---|---|---|
| 1 | Fetch Inventory Levels | `fetch` | Retrieves low-stock items from internal inventory system |
| 2 | AI Analyze Stock Levels | `ai_decide` | Classifies items: urgent_reorder, reorder_soon, monitor, or overstock_alert (Sonnet) |
| 3 | Generate Reorder Recommendations | `ai_generate` | Creates reorder list with SKU, quantity, supplier, and estimated cost using safety factor (Sonnet) |
| 4 | Approve Reorder | `approval` | Sends reorder approval request via Slack and dashboard; expires in 8 hours |
| 5 | Alert Ops Team | `action` | Posts daily inventory analysis to #ops Slack channel |

**Flow:** Fetch Inventory -> Analyze Stock -> Generate Reorder + Alert Ops; Generate Reorder -> Approve Reorder

**Approval gate:** Node 4 (Approve Reorder) before any reorders are placed. Channels: Slack, dashboard. Expires: 8 hours. Priority: high.

---

### 14. SLA Monitoring

| Field | Value |
|---|---|
| ID | `ops-sla-monitoring` |
| Trigger | Event: `sla.check` + Cron: weekdays at 9:00 AM (`0 9 * * 1-5`) |
| Tags | sla, monitoring, compliance |
| Est. Cost | ~$0.03/run |

**Nodes:**

| # | Node | Type | Description |
|---|---|---|---|
| 1 | Fetch SLA Metrics | `fetch` | Retrieves last 24 hours of SLA data from internal system |
| 2 | AI Analyze SLA Compliance | `ai_classify` | Classifies as all_compliant, minor_breaches, major_breaches, or critical_breaches (Haiku) |
| 3 | Generate SLA Report | `ai_generate` | Creates Slack-formatted report with status, breaches, trends, and recommended actions (Haiku) |
| 4 | Route by Compliance | `condition` | Branches on compliance classification |
| 5 | Send Daily Report | `action` | Posts SLA report to #ops Slack channel |
| 6 | Escalate SLA Breach | `action` | Posts to #ops-urgent for critical or major breaches |

**Flow:** Fetch Metrics -> Analyze SLA -> Generate Report + Route; Generate Report -> Send Daily Report; Route -> Escalate Breach (critical/major only)

**Approval gate:** None (automated monitoring and alerting).

---

## Sales Pack

**Required integrations:** Slack, Gmail, HubSpot

### 15. Lead Routing

| Field | Value |
|---|---|
| ID | `sales-lead-routing` |
| Trigger | Event: `lead.created` |
| Tags | leads, routing, scoring |
| Est. Cost | ~$0.04/run |

**Nodes:**

| # | Node | Type | Description |
|---|---|---|---|
| 1 | Enrich Lead Data | `fetch` | Looks up existing contact data in HubSpot |
| 2 | AI Score Lead | `ai_decide` | Scores 1-100 and classifies as hot_lead, warm_lead, nurture, or disqualified (Sonnet) |
| 3 | Route by Score | `condition` | Branches on lead classification |
| 4 | Assign Hot Lead | `action` | Updates HubSpot contact to Sales Qualified Lead status (hot/warm) |
| 5 | Alert Sales Rep (Hot) | `action` | Posts hot lead alert with scoring details to #sales-hot Slack channel |
| 6 | Add to Nurture Sequence | `action` | Updates HubSpot contact to nurture lifecycle stage |
| 7 | Send Welcome Email | `ai_generate` | Writes personalized welcome email based on lead source (Haiku) |
| 8 | Send Welcome Email | `action` | Sends welcome email via Gmail |
| 9 | Log to Sales Channel | `action` | Posts new lead notification to #sales Slack channel |

**Flow:** Enrich -> Score -> Route + Send Welcome + Log; Route -> (Assign Hot -> Alert Rep) OR (Add to Nurture); Send Welcome -> Send Email

**Approval gate:** None (automated lead routing).

---

### 16. Pipeline Health Check

| Field | Value |
|---|---|
| ID | `sales-pipeline` |
| Trigger | Event: `pipeline.check` + Cron: weekdays at 8:00 AM (`0 8 * * 1-5`) |
| Tags | pipeline, deals, forecasting |
| Est. Cost | ~$0.05/run |

**Nodes:**

| # | Node | Type | Description |
|---|---|---|---|
| 1 | Fetch Active Deals | `fetch` | Retrieves all active deals from HubSpot with key properties |
| 2 | AI Pipeline Analysis | `ai_generate` | Identifies stale deals (14+ days inactive), at-risk deals, top opportunities, and coaching insights (Sonnet) |
| 3 | Generate Pipeline Report | `ai_summarize` | Creates executive summary of pipeline analysis, max 300 words (Haiku) |
| 4 | Send Pipeline Report | `action` | Posts daily pipeline report to #sales Slack channel |
| 5 | Alert on Stale Deals | `action` | Posts stale deal alerts to #sales requesting updates |

**Flow:** Fetch Deals -> Analyze Pipeline -> Generate Report + Alert Stale; Generate Report -> Send Pipeline Report

**Approval gate:** None (reporting workflow).

---

### 17. Proposal Generation

| Field | Value |
|---|---|
| ID | `sales-proposal` |
| Trigger | Event: `proposal.requested` |
| Tags | proposal, deals, documents |
| Est. Cost | ~$0.08/run |

**Nodes:**

| # | Node | Type | Description |
|---|---|---|---|
| 1 | Fetch Deal Details | `fetch` | Retrieves deal, contacts, and company associations from HubSpot |
| 2 | AI Generate Proposal | `ai_generate` | Creates full proposal with executive summary, solution, pricing, timeline, and terms; adapts tone to company size (Sonnet) |
| 3 | Manager Reviews Proposal | `approval` | Manager reviews generated proposal via Slack and dashboard; expires in 1 day |
| 4 | Send Proposal Email | `ai_generate` | Writes brief cover email with CTA to schedule a call (Haiku) |
| 5 | Email Proposal | `action` | Sends proposal email to prospect contact |
| 6 | Update Deal Stage | `action` | Updates HubSpot deal stage to proposalSent |
| 7 | Notify Sales Team | `action` | Posts proposal-sent notification to #sales Slack channel |

**Flow:** Fetch Deal -> Generate Proposal -> Manager Review -> Send Cover Email -> Email Proposal -> Update Deal Stage + Notify Team

**Approval gate:** Node 3 (Manager Reviews Proposal) before proposal is sent to prospect. Channels: Slack, dashboard. Expires: 1 day. Priority: high.

---

### 18. Deal Stage Alerts

| Field | Value |
|---|---|
| ID | `sales-deal-alerts` |
| Trigger | Event: `deal.updated` |
| Tags | deals, alerts, coaching |
| Est. Cost | ~$0.02/run |

**Nodes:**

| # | Node | Type | Description |
|---|---|---|---|
| 1 | Classify Deal Change | `ai_classify` | Categorizes stage change as deal_won, deal_lost, moved_forward, moved_backward, or stalled (Haiku) |
| 2 | Route by Change Type | `condition` | Branches on classification |
| 3 | Celebrate Win | `action` | Posts celebration message to #wins Slack channel |
| 4 | Analyze Deal Loss | `ai_generate` | Analyzes loss reasons and suggests 2-3 improvements (Haiku) |
| 5 | Notify on Loss | `action` | Posts loss analysis to #sales Slack channel |
| 6 | Generate Coaching Tip | `ai_generate` | Creates brief coaching tip referencing sales methodology (Haiku) |
| 7 | Send Coaching DM | `action` | Sends coaching tip as direct Slack message to deal owner |

**Flow:** Classify Change -> Route -> (Celebrate Win) OR (Analyze Loss -> Notify) OR (Coaching Tip -> Send DM)

**Approval gate:** None (automated alerts and coaching).

---

## Summary: Approval Gates

Workflows with human-in-the-loop approval steps:

| Workflow | Approval Node | Channels | Expiry |
|---|---|---|---|
| Invoice Approval | Request Manager Approval | Slack, email, dashboard | 3 days |
| Expense Audit | Flag for Finance Review | Slack, dashboard | -- |
| Leave Approval | Request Manager Approval | Slack, WhatsApp, dashboard | 2 days |
| Review Recovery | Manager Approves Response | Slack, dashboard | 4 hours |
| Vendor Onboarding | Request Procurement Approval | Slack, email, dashboard | 3 days |
| Inventory Monitoring | Approve Reorder | Slack, dashboard | 8 hours |
| Proposal Generation | Manager Reviews Proposal | Slack, dashboard | 1 day |

## Summary: Node Types

| Type | Description | Used in |
|---|---|---|
| `ai_extract` | Extracts structured fields from unstructured text | Invoice Approval, Vendor Onboarding |
| `ai_classify` | Categorizes text into predefined buckets | Invoice Approval, Expense Audit, Hiring, Complaint Routing, Review Recovery, SLA Escalation, Incident Escalation, SLA Monitoring, Deal Stage Alerts |
| `ai_decide` | Makes a decision from a set of options with criteria | Payment Escalation, Bank Reconciliation, Leave Approval, Complaint Routing, SLA Escalation, Vendor Onboarding, Inventory Monitoring, Lead Routing |
| `ai_generate` | Generates text content (emails, reports, proposals) | Payment Escalation, Bank Reconciliation, Hiring, Onboarding, Complaint Routing, Review Recovery, Incident Escalation, Vendor Onboarding, Inventory Monitoring, SLA Monitoring, Lead Routing, Pipeline Health Check, Proposal Generation, Deal Stage Alerts |
| `ai_summarize` | Summarizes text in a given style | SLA Escalation, Pipeline Health Check |
| `fetch` | Retrieves data from an external provider | Invoice Approval, Expense Audit, Payment Escalation, Bank Reconciliation, Leave Approval, Review Recovery, SLA Escalation, Inventory Monitoring, SLA Monitoring, Incident Escalation, Vendor Onboarding, Lead Routing, Pipeline Health Check, Proposal Generation |
| `condition` | Routes flow based on a field value | All workflows |
| `action` | Performs an external action (Slack, email, CRM update) | All workflows |
| `approval` | Human-in-the-loop approval gate | 7 workflows (see above) |
| `loop` | Iterates over a list of items | Payment Escalation, Onboarding |
