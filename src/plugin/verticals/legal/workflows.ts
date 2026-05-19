import type { WorkflowDAG } from "../../workflows/types";

export const contractReview: WorkflowDAG = {
  id: "legal-contract-review",
  name: "Contract Review & Risk Analysis",
  vertical: "legal",
  description: "Analyzes incoming contracts for risk, flags non-standard clauses, generates redline suggestions",
  version: "1.0.0",
  trigger: { type: "webhook", provider: "docusign", event: "envelope.sent" },
  nodes: [
    {
      id: "load_contract",
      name: "Load Contract Document",
      type: "fetch",
      config: { integration: "docusign", operation: "envelopes.getDocument", inputMap: { envelopeId: { source: "trigger", path: "envelope.envelopeId" } } },
    },
    {
      id: "load_playbook",
      name: "Load Contract Playbook",
      type: "fetch",
      config: { integration: "internal", operation: "playbooks.get", inputMap: { type: { source: "trigger", path: "envelope.metadata.contractType" } } },
    },
    {
      id: "extract_clauses",
      name: "Extract & Classify Clauses",
      type: "ai_generate",
      config: {
        inputMap: {
          document: { source: "node", nodeId: "load_contract", path: "document" },
        },
      },
      agent: {
        role: "Contract Analyst",
        model: "sonnet",
        instructions: `Extract all clauses from this contract. For each clause return:
{
  "clauses": [{
    "id": string,
    "section": string,
    "type": "indemnification" | "liability" | "termination" | "ip" | "confidentiality" | "payment" | "warranty" | "force_majeure" | "governing_law" | "data_protection" | "non_compete" | "other",
    "text": string (verbatim),
    "summary": string (1 sentence)
  }],
  "contractType": "SaaS" | "NDA" | "MSA" | "SOW" | "employment" | "vendor" | "partnership" | "other",
  "parties": [{ name, role }],
  "effectiveDate": string | null,
  "termLength": string | null
}`,
      },
    },
    {
      id: "risk_analysis",
      name: "AI Risk Analysis",
      type: "ai_decide",
      config: {
        inputMap: {
          clauses: { source: "node", nodeId: "extract_clauses", path: "clauses" },
          contractType: { source: "node", nodeId: "extract_clauses", path: "contractType" },
          playbook: { source: "node", nodeId: "load_playbook", path: "playbook" },
        },
      },
      agent: {
        role: "Contract Analyst",
        model: "opus",
        instructions: `Analyze each clause against the playbook standards. Return:
{
  "overallRisk": "low" | "medium" | "high" | "critical",
  "riskScore": 1-100,
  "findings": [{
    "clauseId": string,
    "risk": "low" | "medium" | "high" | "critical",
    "issue": string,
    "playBookStandard": string,
    "suggestedRedline": string | null,
    "acceptableAsIs": boolean
  }],
  "missingClauses": [{ type, importance, suggestedLanguage }],
  "recommendation": "approve" | "redline" | "reject" | "escalate",
  "summary": string (3-5 sentences for legal team)
}
Compare against playbook for: liability caps, indemnification scope, termination notice periods, IP ownership, data protection compliance. Flag any unlimited liability, auto-renewal without opt-out, unilateral amendment rights, or broad IP assignment.`,
      },
    },
    {
      id: "branch_risk",
      name: "Route by Risk Level",
      type: "branch",
      config: { inputMap: { recommendation: { source: "node", nodeId: "risk_analysis", path: "recommendation" } } },
    },
    {
      id: "auto_approve",
      name: "Auto-Approve Low Risk",
      type: "action",
      config: { integration: "internal", operation: "contracts.updateStatus", inputMap: { contractId: { source: "trigger", path: "envelope.envelopeId" }, status: { source: "static", value: "approved" }, notes: { source: "node", nodeId: "risk_analysis", path: "summary" } } },
    },
    {
      id: "generate_redlines",
      name: "Generate Redline Document",
      type: "ai_generate",
      config: {
        inputMap: {
          findings: { source: "node", nodeId: "risk_analysis", path: "findings" },
          missingClauses: { source: "node", nodeId: "risk_analysis", path: "missingClauses" },
        },
      },
      agent: {
        role: "Contract Analyst",
        model: "sonnet",
        instructions: "Generate a redline summary document with: each flagged clause, the issue, and suggested replacement language. Format as a clean markdown document suitable for sending to counterparty counsel.",
      },
    },
    {
      id: "request_legal_review",
      name: "Request Attorney Review",
      type: "approval",
      config: {
        inputMap: {
          title: { source: "template", template: "Contract Review: {{extract_clauses.parties.0.name}} — {{extract_clauses.contractType}}" },
          description: { source: "node", nodeId: "risk_analysis", path: "summary" },
          riskScore: { source: "node", nodeId: "risk_analysis", path: "riskScore" },
        },
      },
      agent: { role: "Contract Analyst", model: "sonnet" },
    },
    {
      id: "notify_legal",
      name: "Notify Legal Team",
      type: "action",
      config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "integration", provider: "settings", path: "legalChannel" }, message: { source: "template", template: "Contract reviewed: {{extract_clauses.parties.0.name}} ({{extract_clauses.contractType}}) — Risk: {{risk_analysis.overallRisk}} ({{risk_analysis.riskScore}}/100)\n{{risk_analysis.recommendation}}: {{risk_analysis.findings.length}} findings" } } },
    },
  ],
  edges: [
    { from: "load_contract", to: "extract_clauses" },
    { from: "load_playbook", to: "risk_analysis" },
    { from: "extract_clauses", to: "risk_analysis" },
    { from: "risk_analysis", to: "branch_risk" },
    { from: "branch_risk", to: "auto_approve", condition: { type: "output_equals", field: "recommendation", value: "approve" } },
    { from: "branch_risk", to: "generate_redlines", condition: { type: "output_equals", field: "recommendation", value: "redline" } },
    { from: "branch_risk", to: "request_legal_review", condition: { type: "output_equals", field: "recommendation", value: "escalate" } },
    { from: "branch_risk", to: "request_legal_review", condition: { type: "output_equals", field: "recommendation", value: "reject" } },
    { from: "generate_redlines", to: "request_legal_review" },
    { from: "auto_approve", to: "notify_legal" },
    { from: "request_legal_review", to: "notify_legal" },
  ],
  errorHandler: { onNodeFailure: "abort", maxRetries: 1, retryDelaySeconds: 60, notifyChannel: "#legal" },
  metadata: { estimatedDurationMs: 45000, estimatedCostCents: 30, tags: ["contracts", "risk", "review", "redline"], requiredIntegrations: ["docusign", "slack"], requiredApprovals: ["legal_review"] },
};

export const deadlineTracking: WorkflowDAG = {
  id: "legal-deadline-tracking",
  name: "Legal Deadline & Obligation Tracking",
  vertical: "legal",
  description: "Monitors contract deadlines, renewal dates, compliance obligations, and sends escalating reminders",
  version: "1.0.0",
  trigger: { type: "schedule", cron: "0 8 * * 1-5" },
  nodes: [
    {
      id: "fetch_upcoming",
      name: "Fetch Upcoming Deadlines",
      type: "fetch",
      config: { integration: "internal", operation: "deadlines.list", inputMap: { windowDays: { source: "static", value: 30 }, status: { source: "static", value: "active" } } },
    },
    {
      id: "fetch_contracts",
      name: "Fetch Related Contracts",
      type: "fetch",
      config: { integration: "internal", operation: "contracts.list", inputMap: { hasUpcomingDeadline: { source: "static", value: true } } },
    },
    {
      id: "assess_deadlines",
      name: "AI Assess Urgency",
      type: "ai_decide",
      config: {
        inputMap: {
          deadlines: { source: "node", nodeId: "fetch_upcoming", path: "deadlines" },
          contracts: { source: "node", nodeId: "fetch_contracts", path: "contracts" },
        },
      },
      agent: {
        role: "Legal Operations Manager",
        model: "sonnet",
        instructions: `Assess each deadline. Return:
{
  "critical": [{ deadlineId, contractName, type, dueDate, daysRemaining, action, assignedTo }],
  "upcoming": [{ deadlineId, contractName, type, dueDate, daysRemaining, reminderLevel }],
  "renewalDecisions": [{ contractId, contractName, renewalDate, recommendation: "renew" | "renegotiate" | "terminate", reason }],
  "overdueActions": [{ deadlineId, description, daysPast, escalationLevel }]
}
Priority: regulatory deadlines > renewal opt-outs > payment obligations > reporting deadlines. Flag any deadline within 7 days as critical. Auto-renewal opt-out windows are especially important.`,
      },
    },
    {
      id: "send_critical_alerts",
      name: "Send Critical Alerts",
      type: "loop",
      config: { inputMap: { items: { source: "node", nodeId: "assess_deadlines", path: "critical" } }, params: { itemNode: "send_critical_single" } },
    },
    {
      id: "send_critical_single",
      name: "Send Critical Alert",
      type: "action",
      config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "integration", provider: "settings", path: "legalChannel" }, message: { source: "template", template: "🚨 CRITICAL DEADLINE: {{send_critical_alerts.currentItem.contractName}} — {{send_critical_alerts.currentItem.type}} due in {{send_critical_alerts.currentItem.daysRemaining}} days\nAction needed: {{send_critical_alerts.currentItem.action}}" } } },
    },
    {
      id: "send_renewal_recommendations",
      name: "Send Renewal Recommendations",
      type: "loop",
      config: { inputMap: { items: { source: "node", nodeId: "assess_deadlines", path: "renewalDecisions" } }, params: { itemNode: "send_renewal_single" } },
    },
    {
      id: "send_renewal_single",
      name: "Send Renewal Alert",
      type: "action",
      config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "integration", provider: "settings", path: "legalChannel" }, message: { source: "template", template: "📋 Renewal Decision: {{send_renewal_recommendations.currentItem.contractName}} — Recommendation: {{send_renewal_recommendations.currentItem.recommendation}}\n{{send_renewal_recommendations.currentItem.reason}}" } } },
    },
    {
      id: "daily_summary",
      name: "Daily Legal Summary",
      type: "action",
      config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "integration", provider: "settings", path: "legalChannel" }, message: { source: "template", template: "Legal Deadlines Daily: {{assess_deadlines.critical.length}} critical, {{assess_deadlines.upcoming.length}} upcoming, {{assess_deadlines.renewalDecisions.length}} renewal decisions pending, {{assess_deadlines.overdueActions.length}} overdue" } } },
    },
  ],
  edges: [
    { from: "fetch_upcoming", to: "assess_deadlines" },
    { from: "fetch_contracts", to: "assess_deadlines" },
    { from: "assess_deadlines", to: "send_critical_alerts" },
    { from: "assess_deadlines", to: "send_renewal_recommendations" },
    { from: "send_critical_alerts", to: "send_critical_single" },
    { from: "send_renewal_recommendations", to: "send_renewal_single" },
    { from: "assess_deadlines", to: "daily_summary" },
  ],
  errorHandler: { onNodeFailure: "retry", maxRetries: 2, retryDelaySeconds: 60, notifyChannel: "#legal" },
  metadata: { estimatedDurationMs: 15000, estimatedCostCents: 5, tags: ["deadlines", "renewals", "obligations", "compliance"], requiredIntegrations: ["slack"], requiredApprovals: [] },
};

export const ndaGeneration: WorkflowDAG = {
  id: "legal-nda-generation",
  name: "NDA & Template Generation",
  vertical: "legal",
  description: "Generates NDAs and standard legal documents from templates, customized per counterparty and deal context",
  version: "1.0.0",
  trigger: { type: "webhook", provider: "internal", event: "document.requested" },
  nodes: [
    {
      id: "load_request",
      name: "Load Document Request",
      type: "transform",
      config: { inputMap: { request: { source: "trigger", path: "data" } } },
    },
    {
      id: "load_template",
      name: "Load Base Template",
      type: "fetch",
      config: { integration: "internal", operation: "templates.get", inputMap: { templateType: { source: "trigger", path: "data.documentType" }, jurisdiction: { source: "trigger", path: "data.jurisdiction" } } },
    },
    {
      id: "load_counterparty",
      name: "Load Counterparty Info",
      type: "fetch",
      config: { integration: "crm", operation: "companies.get", inputMap: { companyId: { source: "trigger", path: "data.counterpartyId" } } },
    },
    {
      id: "customize_document",
      name: "AI Customize Document",
      type: "ai_generate",
      config: {
        inputMap: {
          template: { source: "node", nodeId: "load_template", path: "template" },
          counterparty: { source: "node", nodeId: "load_counterparty", path: "company" },
          request: { source: "node", nodeId: "load_request", path: "request" },
        },
      },
      agent: {
        role: "Legal Document Drafter",
        model: "sonnet",
        instructions: `Customize this legal template for the specific counterparty and deal context.
- Fill in all party details, dates, and jurisdiction-specific language
- Adjust scope and definitions based on the deal context
- For NDAs: set appropriate term length based on industry (tech: 2yr, biotech: 5yr, default: 3yr)
- For NDAs: determine mutual vs one-way based on the relationship
- Ensure governing law matches specified jurisdiction
- Add any industry-specific carve-outs (e.g., residuals clause for tech)
Return: { document: string (full legal text), metadata: { type, parties, term, jurisdiction, mutual }, variablesFilled: string[], warnings: string[] }`,
      },
    },
    {
      id: "compliance_check",
      name: "Compliance Validation",
      type: "ai_decide",
      config: {
        inputMap: {
          document: { source: "node", nodeId: "customize_document", path: "document" },
          jurisdiction: { source: "trigger", path: "data.jurisdiction" },
        },
      },
      agent: {
        role: "Legal Document Drafter",
        model: "haiku",
        instructions: `Quick compliance check:
- All required sections present for this document type?
- Jurisdiction-specific requirements met?
- No conflicting clauses?
- Signature blocks properly formatted?
Return: { compliant: boolean, issues: string[], suggestions: string[] }`,
      },
    },
    {
      id: "branch_compliance",
      name: "Check Compliance",
      type: "branch",
      config: { inputMap: { compliant: { source: "node", nodeId: "compliance_check", path: "compliant" } } },
    },
    {
      id: "save_document",
      name: "Save to Document Store",
      type: "action",
      config: { integration: "internal", operation: "documents.create", inputMap: { content: { source: "node", nodeId: "customize_document", path: "document" }, type: { source: "trigger", path: "data.documentType" }, counterpartyId: { source: "trigger", path: "data.counterpartyId" }, status: { source: "static", value: "draft" } } },
    },
    {
      id: "send_for_signature",
      name: "Send via DocuSign",
      type: "action",
      config: { integration: "docusign", operation: "envelopes.create", inputMap: { document: { source: "node", nodeId: "customize_document", path: "document" }, signers: { source: "node", nodeId: "load_counterparty", path: "company.contacts" }, subject: { source: "template", template: "{{customize_document.metadata.type}} — {{load_counterparty.company.name}}" } } },
    },
    {
      id: "notify_requester",
      name: "Notify Requester",
      type: "action",
      config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "trigger", path: "data.requestedBy" }, message: { source: "template", template: "Your {{customize_document.metadata.type}} for {{load_counterparty.company.name}} has been generated and sent for signature via DocuSign." } } },
    },
    {
      id: "flag_issues",
      name: "Flag Compliance Issues",
      type: "action",
      config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "integration", provider: "settings", path: "legalChannel" }, message: { source: "template", template: "⚠️ Document generation compliance issues for {{load_counterparty.company.name}}: {{compliance_check.issues}}" } } },
    },
  ],
  edges: [
    { from: "load_request", to: "customize_document" },
    { from: "load_template", to: "customize_document" },
    { from: "load_counterparty", to: "customize_document" },
    { from: "customize_document", to: "compliance_check" },
    { from: "compliance_check", to: "branch_compliance" },
    { from: "branch_compliance", to: "save_document", condition: { type: "output_equals", field: "compliant", value: true } },
    { from: "branch_compliance", to: "flag_issues", condition: { type: "output_equals", field: "compliant", value: false } },
    { from: "save_document", to: "send_for_signature" },
    { from: "send_for_signature", to: "notify_requester" },
  ],
  errorHandler: { onNodeFailure: "abort", maxRetries: 1, retryDelaySeconds: 60, notifyChannel: "#legal" },
  metadata: { estimatedDurationMs: 30000, estimatedCostCents: 10, tags: ["nda", "templates", "document-generation"], requiredIntegrations: ["docusign", "crm", "slack"], requiredApprovals: [] },
};

export const complianceMonitoring: WorkflowDAG = {
  id: "legal-compliance-monitoring",
  name: "Compliance Monitoring & Alerts",
  vertical: "legal",
  description: "Monitors regulatory changes, checks internal compliance status, generates compliance reports",
  version: "1.0.0",
  trigger: { type: "schedule", cron: "0 7 * * 1" },
  nodes: [
    {
      id: "fetch_obligations",
      name: "Fetch Active Obligations",
      type: "fetch",
      config: { integration: "internal", operation: "obligations.list", inputMap: { status: { source: "static", value: "active" } } },
    },
    {
      id: "fetch_recent_changes",
      name: "Fetch Regulatory Updates",
      type: "fetch",
      config: { integration: "internal", operation: "regulations.recent", inputMap: { period: { source: "static", value: "last_7_days" } } },
    },
    {
      id: "fetch_audit_status",
      name: "Fetch Audit Items",
      type: "fetch",
      config: { integration: "internal", operation: "audits.pending", inputMap: {} },
    },
    {
      id: "analyze_compliance",
      name: "AI Compliance Analysis",
      type: "ai_decide",
      config: {
        inputMap: {
          obligations: { source: "node", nodeId: "fetch_obligations", path: "obligations" },
          regulatoryChanges: { source: "node", nodeId: "fetch_recent_changes", path: "changes" },
          auditItems: { source: "node", nodeId: "fetch_audit_status", path: "items" },
        },
      },
      agent: {
        role: "Compliance Officer",
        model: "opus",
        instructions: `Analyze compliance posture. Return:
{
  "overallStatus": "compliant" | "at_risk" | "non_compliant",
  "regulatoryImpact": [{
    "change": string,
    "source": string,
    "affectedAreas": string[],
    "actionRequired": string,
    "deadline": string | null,
    "priority": "critical" | "high" | "medium" | "low"
  }],
  "obligationStatus": [{
    "obligationId": string,
    "status": "met" | "at_risk" | "overdue",
    "nextDue": string,
    "notes": string
  }],
  "auditFindings": [{
    "item": string,
    "severity": "critical" | "high" | "medium" | "low",
    "recommendation": string
  }],
  "actionItems": [{ task, assignedTo, priority, dueDate }],
  "weeklyDigest": string (executive summary, 3-5 sentences)
}
Focus on: GDPR, SOC2, HIPAA (if applicable), industry-specific regulations. Flag any new regulations that could require policy changes.`,
      },
    },
    {
      id: "branch_status",
      name: "Check Status",
      type: "branch",
      config: { inputMap: { overallStatus: { source: "node", nodeId: "analyze_compliance", path: "overallStatus" } } },
    },
    {
      id: "create_action_items",
      name: "Create Action Items",
      type: "loop",
      config: { inputMap: { items: { source: "node", nodeId: "analyze_compliance", path: "actionItems" } }, params: { itemNode: "create_single_action" } },
    },
    {
      id: "create_single_action",
      name: "Create Task",
      type: "action",
      config: { integration: "internal", operation: "tasks.create", inputMap: { title: { source: "node", nodeId: "create_action_items", path: "currentItem.task" }, assignTo: { source: "node", nodeId: "create_action_items", path: "currentItem.assignedTo" }, priority: { source: "node", nodeId: "create_action_items", path: "currentItem.priority" }, dueDate: { source: "node", nodeId: "create_action_items", path: "currentItem.dueDate" } } },
    },
    {
      id: "alert_non_compliant",
      name: "Alert Non-Compliance",
      type: "action",
      config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "integration", provider: "settings", path: "legalChannel" }, message: { source: "template", template: "🚨 COMPLIANCE ALERT: Status is {{analyze_compliance.overallStatus}}. {{analyze_compliance.regulatoryImpact.length}} regulatory changes require attention. See action items." } } },
    },
    {
      id: "send_digest",
      name: "Send Weekly Digest",
      type: "action",
      config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "integration", provider: "settings", path: "legalChannel" }, message: { source: "node", nodeId: "analyze_compliance", path: "weeklyDigest" } } },
    },
    {
      id: "send_executive_email",
      name: "Email Executive Summary",
      type: "action",
      config: { integration: "email", operation: "send", inputMap: { to: { source: "integration", provider: "settings", path: "complianceOfficerEmail" }, subject: { source: "template", template: "Weekly Compliance Report — {{analyze_compliance.overallStatus}}" }, body: { source: "node", nodeId: "analyze_compliance", path: "weeklyDigest" } } },
    },
  ],
  edges: [
    { from: "fetch_obligations", to: "analyze_compliance" },
    { from: "fetch_recent_changes", to: "analyze_compliance" },
    { from: "fetch_audit_status", to: "analyze_compliance" },
    { from: "analyze_compliance", to: "branch_status" },
    { from: "analyze_compliance", to: "create_action_items" },
    { from: "create_action_items", to: "create_single_action" },
    { from: "branch_status", to: "alert_non_compliant", condition: { type: "output_equals", field: "overallStatus", value: "non_compliant" } },
    { from: "branch_status", to: "alert_non_compliant", condition: { type: "output_equals", field: "overallStatus", value: "at_risk" } },
    { from: "branch_status", to: "send_digest", condition: { type: "output_equals", field: "overallStatus", value: "compliant" } },
    { from: "analyze_compliance", to: "send_executive_email" },
  ],
  errorHandler: { onNodeFailure: "retry", maxRetries: 2, retryDelaySeconds: 120, notifyChannel: "#legal" },
  metadata: { estimatedDurationMs: 30000, estimatedCostCents: 20, tags: ["compliance", "regulatory", "monitoring", "audit"], requiredIntegrations: ["slack", "email"], requiredApprovals: [] },
};

export const legalWorkflows = [contractReview, deadlineTracking, ndaGeneration, complianceMonitoring];
