// ═══════════════════════════════════════════════════════
// HR PACK — Onboarding, hiring, leave approvals,
// staffing coordination
// ═══════════════════════════════════════════════════════

import type { WorkflowPack } from "./index";

export const hrPack: WorkflowPack = {
  id: "hr",
  name: "HR Pack",
  description: "Automate onboarding, hiring workflows, leave approvals, and staffing coordination",
  icon: "👥",
  color: "#EC4899",
  requiredIntegrations: ["slack", "gmail", "google_sheets"],
  workflows: [
    // ── 1. Hiring Workflow ───────────────────────────────
    {
      id: "hr-hiring",
      name: "Hiring Workflow",
      description: "Screens applications, scores candidates, schedules interviews, manages the pipeline",
      triggerEvent: "application.received",
      tags: ["hiring", "screening", "candidates"],
      estimatedCostCents: 5,
      nodes: [
        {
          id: "screen_resume",
          name: "AI Screen Resume",
          type: "ai_classify",
          config: {
            text: "{{trigger.payload.resume}}",
            categories: ["strong_match", "potential_match", "weak_match", "no_match"],
            context: { jobTitle: "{{trigger.payload.jobTitle}}", requirements: "{{trigger.payload.requirements}}" },
            model: "sonnet",
          },
        },
        {
          id: "score_candidate",
          name: "Score Candidate",
          type: "ai_generate",
          config: {
            instructions: "Score this candidate 1-5 on: experience, skills, education, culture fit. Flag any bias in your reasoning. Return JSON with scores, strengths, concerns, and overall recommendation.",
            context: { resume: "{{trigger.payload.resume}}", category: "{{screen_resume.category}}", jobRequirements: "{{trigger.payload.requirements}}" },
            model: "sonnet",
          },
          dependsOn: ["screen_resume"],
        },
        {
          id: "route_candidate",
          name: "Route by Score",
          type: "condition",
          config: { category: "{{screen_resume.category}}" },
          dependsOn: ["screen_resume"],
        },
        {
          id: "advance_candidate",
          name: "Advance to Interview",
          type: "action",
          config: { action: "create_task", title: "Schedule interview: {{trigger.payload.candidateName}} for {{trigger.payload.jobTitle}}", priority: "medium" },
          dependsOn: ["route_candidate"],
        },
        {
          id: "send_rejection",
          name: "Send Rejection",
          type: "ai_generate",
          config: {
            instructions: "Write a kind, professional rejection email. Thank them for applying, encourage them to apply again in the future. Don't mention AI screening. Under 100 words.",
            context: { candidateName: "{{trigger.payload.candidateName}}", jobTitle: "{{trigger.payload.jobTitle}}" },
            model: "haiku",
          },
          dependsOn: ["route_candidate"],
        },
        {
          id: "send_rejection_email",
          name: "Send Rejection Email",
          type: "action",
          config: { action: "send_email", to: "{{trigger.payload.candidateEmail}}", subject: "Update on your application for {{trigger.payload.jobTitle}}", body: "{{send_rejection.rawText}}" },
          dependsOn: ["send_rejection"],
        },
        {
          id: "notify_hiring",
          name: "Notify Hiring Manager",
          type: "action",
          config: { action: "send_slack", channel: "#hiring", message: "New candidate screened: {{trigger.payload.candidateName}} — {{screen_resume.category}} ({{score_candidate.output.overallScore}}/5)" },
          dependsOn: ["score_candidate"],
        },
      ],
      edges: [
        { from: "screen_resume", to: "score_candidate" },
        { from: "screen_resume", to: "route_candidate" },
        { from: "score_candidate", to: "notify_hiring" },
        { from: "route_candidate", to: "advance_candidate", condition: { field: "category", operator: "eq", value: "strong_match" } },
        { from: "route_candidate", to: "advance_candidate", condition: { field: "category", operator: "eq", value: "potential_match" } },
        { from: "route_candidate", to: "send_rejection", condition: { field: "category", operator: "eq", value: "no_match" } },
        { from: "send_rejection", to: "send_rejection_email" },
      ],
    },

    // ── 2. Onboarding Workflow ───────────────────────────
    {
      id: "hr-onboarding",
      name: "Onboarding Workflow",
      description: "Generates onboarding checklists, creates IT tasks, sends welcome email, coordinates first week",
      triggerEvent: "candidate.hired",
      tags: ["onboarding", "new-hire", "checklist"],
      estimatedCostCents: 6,
      nodes: [
        {
          id: "generate_checklist",
          name: "Generate Onboarding Checklist",
          type: "ai_generate",
          config: {
            instructions: "Create a complete onboarding checklist. Categories: IT setup (laptop, accounts, tools), HR paperwork (docs, benefits, payroll), Manager tasks (1:1, 30-60-90 plan, buddy), Team (welcome lunch, intros). Return as JSON array.",
            context: { name: "{{trigger.payload.name}}", role: "{{trigger.payload.role}}", department: "{{trigger.payload.department}}", startDate: "{{trigger.payload.startDate}}" },
            model: "sonnet",
          },
        },
        {
          id: "create_tasks",
          name: "Create All Tasks",
          type: "loop",
          config: { items: "{{generate_checklist.output.checklist}}" },
          dependsOn: ["generate_checklist"],
        },
        {
          id: "send_welcome",
          name: "Generate Welcome Email",
          type: "ai_generate",
          config: {
            instructions: "Write a warm welcome email. Include: start date, first-day logistics, who they'll meet, what to bring. Be enthusiastic but not cringey. Under 200 words.",
            context: { name: "{{trigger.payload.name}}", role: "{{trigger.payload.role}}", startDate: "{{trigger.payload.startDate}}", managerName: "{{trigger.payload.managerName}}" },
            model: "haiku",
          },
        },
        {
          id: "send_welcome_email",
          name: "Send Welcome Email",
          type: "action",
          config: { action: "send_email", to: "{{trigger.payload.email}}", subject: "Welcome to the team, {{trigger.payload.name}}!", body: "{{send_welcome.rawText}}" },
          dependsOn: ["send_welcome"],
        },
        {
          id: "notify_team",
          name: "Notify Team",
          type: "action",
          config: { action: "send_slack", channel: "#general", message: "🎉 New hire joining: {{trigger.payload.name}} as {{trigger.payload.role}} starting {{trigger.payload.startDate}}!" },
          dependsOn: ["generate_checklist"],
        },
      ],
      edges: [
        { from: "generate_checklist", to: "create_tasks" },
        { from: "generate_checklist", to: "notify_team" },
        { from: "send_welcome", to: "send_welcome_email" },
      ],
    },

    // ── 3. Leave Approval ───────────────────────────────
    {
      id: "hr-leave-approval",
      name: "Leave Approval",
      description: "Processes leave requests, checks team coverage, routes for manager approval",
      triggerEvent: "leave.requested",
      tags: ["leave", "approval", "time-off"],
      estimatedCostCents: 2,
      nodes: [
        {
          id: "check_balance",
          name: "Check Leave Balance",
          type: "fetch",
          config: { provider: "internal", operation: "leave.balance", params: { employeeId: "{{trigger.payload.employeeId}}", leaveType: "{{trigger.payload.leaveType}}" } },
        },
        {
          id: "check_coverage",
          name: "Check Team Coverage",
          type: "fetch",
          config: { provider: "internal", operation: "team.coverage", params: { departmentId: "{{trigger.payload.departmentId}}", dates: "{{trigger.payload.dates}}" } },
        },
        {
          id: "assess_request",
          name: "AI Assess Request",
          type: "ai_decide",
          config: {
            question: "Should this leave request be auto-approved or need manager review?",
            options: ["auto_approve", "needs_review", "flag_coverage_issue"],
            context: { balance: "{{check_balance}}", coverage: "{{check_coverage}}", days: "{{trigger.payload.days}}", leaveType: "{{trigger.payload.leaveType}}" },
            criteria: "Auto-approve if: sufficient balance, team coverage >50%, under 3 days. Flag if: no coverage or balance insufficient.",
            model: "haiku",
          },
          dependsOn: ["check_balance", "check_coverage"],
        },
        {
          id: "route_request",
          name: "Route Request",
          type: "condition",
          config: { decision: "{{assess_request.decision}}" },
          dependsOn: ["assess_request"],
        },
        {
          id: "auto_approve",
          name: "Auto-Approve Leave",
          type: "action",
          config: { action: "send_slack", channel: "{{trigger.payload.managerSlack}}", message: "✅ Leave auto-approved: {{trigger.payload.employeeName}} — {{trigger.payload.days}} days {{trigger.payload.leaveType}} ({{trigger.payload.dates}})" },
          dependsOn: ["route_request"],
        },
        {
          id: "manager_review",
          name: "Request Manager Approval",
          type: "approval",
          config: {
            title: "Leave Request: {{trigger.payload.employeeName}} — {{trigger.payload.days}} days",
            description: "Type: {{trigger.payload.leaveType}}\nDates: {{trigger.payload.dates}}\nBalance: {{check_balance.remaining}} days\nTeam coverage: {{check_coverage.coveragePercent}}%\n\nAI assessment: {{assess_request.reasoning}}",
            channels: ["slack", "whatsapp", "dashboard"],
            assignTo: ["{{trigger.payload.managerId}}"],
            priority: "medium",
            expiresInMinutes: 2880,
          },
          dependsOn: ["route_request"],
        },
        {
          id: "notify_employee",
          name: "Notify Employee",
          type: "action",
          config: { action: "send_email", to: "{{trigger.payload.employeeEmail}}", subject: "Leave request update", body: "Your leave request has been processed." },
          dependsOn: ["auto_approve", "manager_review"],
        },
      ],
      edges: [
        { from: "check_balance", to: "assess_request" },
        { from: "check_coverage", to: "assess_request" },
        { from: "assess_request", to: "route_request" },
        { from: "route_request", to: "auto_approve", condition: { field: "decision", operator: "eq", value: "auto_approve" } },
        { from: "route_request", to: "manager_review", condition: { field: "decision", operator: "neq", value: "auto_approve" } },
        { from: "auto_approve", to: "notify_employee" },
        { from: "manager_review", to: "notify_employee" },
      ],
    },
  ],
};
