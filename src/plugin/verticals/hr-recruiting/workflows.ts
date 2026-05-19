import type { WorkflowDAG } from "../../workflows/types";

export const resumeScreening: WorkflowDAG = {
  id: "hr-resume-screening",
  name: "Resume Screening & Scoring",
  vertical: "hr-recruiting",
  description: "Screens incoming applications against job requirements, scores candidates, routes to next stage",
  version: "1.0.0",
  trigger: { type: "webhook", provider: "greenhouse", event: "candidate.application_created" },
  nodes: [
    { id: "load_application", name: "Load Application", type: "fetch", config: { integration: "greenhouse", operation: "applications.get", inputMap: { applicationId: { source: "trigger", path: "application.id" } } } },
    { id: "load_job", name: "Load Job Requirements", type: "fetch", config: { integration: "greenhouse", operation: "jobs.get", inputMap: { jobId: { source: "trigger", path: "application.job_id" } } } },
    {
      id: "screen_candidate",
      name: "AI Screen Candidate",
      type: "ai_decide",
      config: {
        inputMap: {
          resume: { source: "node", nodeId: "load_application", path: "application.resume" },
          jobRequirements: { source: "node", nodeId: "load_job", path: "job.requirements" },
          hiringBar: { source: "integration", provider: "settings", path: "hiringBar" },
        },
      },
      agent: {
        role: "Resume Screener",
        model: "sonnet",
        instructions: `Screen this candidate. Return:
{
  "experienceScore": 1-5,
  "skillsScore": 1-5,
  "educationScore": 1-5,
  "overallScore": 1-5 (weighted average),
  "strengths": string[],
  "concerns": string[],
  "summary": string (2-3 sentences),
  "recommendation": "advance" | "maybe" | "reject",
  "suggestedStage": "phone_screen" | "technical" | "onsite" | null,
  "biasCheck": string (flag any reasoning that could indicate bias)
}
Focus on demonstrated skills and experience. Don't penalize for non-traditional backgrounds. Flag if your reasoning might be influenced by school name, company prestige, or demographics.`,
      },
    },
    {
      id: "branch_recommendation",
      name: "Route by Recommendation",
      type: "branch",
      config: { inputMap: { recommendation: { source: "node", nodeId: "screen_candidate", path: "recommendation" } } },
    },
    {
      id: "advance_candidate",
      name: "Move to Next Stage",
      type: "action",
      config: { integration: "greenhouse", operation: "candidates.move", inputMap: { applicationId: { source: "trigger", path: "application.id" }, stage: { source: "node", nodeId: "screen_candidate", path: "suggestedStage" } } },
    },
    {
      id: "maybe_review",
      name: "Flag for Human Review",
      type: "action",
      config: { integration: "greenhouse", operation: "candidates.addNote", inputMap: { applicationId: { source: "trigger", path: "application.id" }, note: { source: "template", template: "[AI Screening — Score: {{screen_candidate.overallScore}}/5]\n{{screen_candidate.summary}}\nStrengths: {{screen_candidate.strengths}}\nConcerns: {{screen_candidate.concerns}}" } } },
    },
    {
      id: "reject_candidate",
      name: "Send Rejection",
      type: "action",
      config: { integration: "greenhouse", operation: "candidates.reject", inputMap: { applicationId: { source: "trigger", path: "application.id" }, reason: { source: "node", nodeId: "screen_candidate", path: "summary" } } },
    },
    {
      id: "notify_hiring_manager",
      name: "Notify Hiring Manager",
      type: "action",
      config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "integration", provider: "settings", path: "hiringChannel" }, message: { source: "template", template: "New application screened: {{load_application.application.candidate.name}} for {{load_job.job.title}} — {{screen_candidate.recommendation}} ({{screen_candidate.overallScore}}/5)" } } },
    },
  ],
  edges: [
    { from: "load_application", to: "screen_candidate" },
    { from: "load_job", to: "screen_candidate" },
    { from: "screen_candidate", to: "branch_recommendation" },
    { from: "branch_recommendation", to: "advance_candidate", condition: { type: "output_equals", field: "recommendation", value: "advance" } },
    { from: "branch_recommendation", to: "maybe_review", condition: { type: "output_equals", field: "recommendation", value: "maybe" } },
    { from: "branch_recommendation", to: "reject_candidate", condition: { type: "output_equals", field: "recommendation", value: "reject" } },
    { from: "advance_candidate", to: "notify_hiring_manager" },
    { from: "maybe_review", to: "notify_hiring_manager" },
  ],
  errorHandler: { onNodeFailure: "skip", maxRetries: 1, retryDelaySeconds: 30, notifyChannel: "#hiring" },
  metadata: { estimatedDurationMs: 15000, estimatedCostCents: 4, tags: ["screening", "resume", "candidates"], requiredIntegrations: ["greenhouse", "slack"], requiredApprovals: [] },
};

export const interviewScheduling: WorkflowDAG = {
  id: "hr-interview-scheduling",
  name: "Interview Scheduling",
  vertical: "hr-recruiting",
  description: "Coordinates interview scheduling between candidates and interviewers, sends reminders",
  version: "1.0.0",
  trigger: { type: "schedule", cron: "0 */2 * * 1-5" }, // every 2h weekdays
  nodes: [
    { id: "fetch_pending", name: "Fetch Candidates Awaiting Interview", type: "fetch", config: { integration: "greenhouse", operation: "candidates.list", inputMap: { stage: { source: "static", value: "phone_screen" }, scheduledInterview: { source: "static", value: false } } } },
    {
      id: "generate_emails",
      name: "Generate Scheduling Emails",
      type: "ai_generate",
      config: { inputMap: { candidates: { source: "node", nodeId: "fetch_pending", path: "candidates" } } },
      agent: {
        role: "Interview Scheduler",
        model: "haiku",
        instructions: "For each candidate, generate a warm scheduling email with 3-4 available time slots this week. Mention the interviewer's name and role. Keep professional but friendly.",
      },
    },
    { id: "send_emails", name: "Send Scheduling Emails", type: "loop", config: { inputMap: { items: { source: "node", nodeId: "generate_emails", path: "emails" } }, params: { itemNode: "send_single" } } },
    { id: "send_single", name: "Send Email", type: "action", config: { integration: "email", operation: "send", inputMap: { to: { source: "node", nodeId: "send_emails", path: "currentItem.to" }, subject: { source: "node", nodeId: "send_emails", path: "currentItem.subject" }, body: { source: "node", nodeId: "send_emails", path: "currentItem.body" } } } },
  ],
  edges: [
    { from: "fetch_pending", to: "generate_emails" },
    { from: "generate_emails", to: "send_emails" },
    { from: "send_emails", to: "send_single" },
  ],
  errorHandler: { onNodeFailure: "skip", maxRetries: 1, retryDelaySeconds: 60, notifyChannel: "#hiring" },
  metadata: { estimatedDurationMs: 15000, estimatedCostCents: 2, tags: ["scheduling", "interviews"], requiredIntegrations: ["greenhouse", "email"], requiredApprovals: [] },
};

export const onboardingCoordination: WorkflowDAG = {
  id: "hr-onboarding",
  name: "New Hire Onboarding",
  vertical: "hr-recruiting",
  description: "Manages new hire onboarding: checklist, IT setup tasks, welcome email, first-week schedule",
  version: "1.0.0",
  trigger: { type: "webhook", provider: "greenhouse", event: "candidate.hired" },
  nodes: [
    { id: "load_hire", name: "Load Hire Details", type: "fetch", config: { integration: "greenhouse", operation: "candidates.get", inputMap: { candidateId: { source: "trigger", path: "candidate.id" } } } },
    {
      id: "generate_checklist",
      name: "Generate Onboarding Checklist",
      type: "ai_generate",
      config: { inputMap: { hire: { source: "node", nodeId: "load_hire", path: "candidate" } } },
      agent: {
        role: "Onboarding Coordinator",
        model: "sonnet",
        instructions: `Create onboarding checklist:
IT: laptop, email account, tool access (Slack, GitHub, etc.)
HR: employment docs, benefits enrollment, payroll setup
Manager: intro meeting, 30-60-90 plan, buddy assignment
Team: welcome lunch, team intro meeting
Return: [{ item, category, assignedTo, dueDate, priority }]`,
      },
    },
    { id: "create_tasks", name: "Create Onboarding Tasks", type: "loop", config: { inputMap: { items: { source: "node", nodeId: "generate_checklist", path: "checklist" } }, params: { itemNode: "create_single_task" } } },
    { id: "create_single_task", name: "Create Task", type: "action", config: { integration: "internal", operation: "tasks.create", inputMap: { title: { source: "node", nodeId: "create_tasks", path: "currentItem.item" }, assignTo: { source: "node", nodeId: "create_tasks", path: "currentItem.assignedTo" } } } },
    {
      id: "send_welcome",
      name: "Send Welcome Email",
      type: "ai_generate",
      config: { inputMap: { hire: { source: "node", nodeId: "load_hire", path: "candidate" } } },
      agent: {
        role: "Onboarding Coordinator",
        model: "haiku",
        instructions: "Write a warm welcome email. Include: start date, first-day logistics (time, where to go, what to bring), who they'll meet, and excitement about having them join. Keep it human and enthusiastic.",
      },
    },
    { id: "send_email", name: "Send Welcome", type: "action", config: { integration: "email", operation: "send", inputMap: { to: { source: "node", nodeId: "load_hire", path: "candidate.email" }, subject: { source: "node", nodeId: "send_welcome", path: "subject" }, body: { source: "node", nodeId: "send_welcome", path: "body" } } } },
    { id: "notify_team", name: "Notify Team", type: "action", config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "integration", provider: "settings", path: "hiringChannel" }, message: { source: "template", template: "New hire onboarding started: {{load_hire.candidate.name}} — {{load_hire.candidate.role}}. Checklist created with {{generate_checklist.checklist.length}} items." } } } },
  ],
  edges: [
    { from: "load_hire", to: "generate_checklist" },
    { from: "load_hire", to: "send_welcome" },
    { from: "generate_checklist", to: "create_tasks" },
    { from: "create_tasks", to: "create_single_task" },
    { from: "send_welcome", to: "send_email" },
    { from: "create_tasks", to: "notify_team" },
  ],
  errorHandler: { onNodeFailure: "retry", maxRetries: 2, retryDelaySeconds: 60, notifyChannel: "#hiring" },
  metadata: { estimatedDurationMs: 20000, estimatedCostCents: 5, tags: ["onboarding", "new-hire", "checklist"], requiredIntegrations: ["greenhouse", "email", "slack"], requiredApprovals: [] },
};

export const hrQA: WorkflowDAG = {
  id: "hr-qa-bot",
  name: "HR Q&A Bot",
  vertical: "hr-recruiting",
  description: "Answers employee questions about policies, benefits, and procedures via Slack",
  version: "1.0.0",
  trigger: { type: "webhook", provider: "slack", event: "message.im", filter: { channelType: "im" } },
  nodes: [
    { id: "parse_question", name: "Parse Question", type: "transform", config: { inputMap: { message: { source: "trigger", path: "event.text" }, userId: { source: "trigger", path: "event.user" } } } },
    {
      id: "answer_question",
      name: "AI Answer",
      type: "ai_generate",
      config: { inputMap: { question: { source: "node", nodeId: "parse_question", path: "message" } } },
      agent: {
        role: "HR Q&A Bot",
        model: "haiku",
        instructions: `Answer the employee's HR question. Topics: PTO, benefits, expenses, policies, payroll, remote work.
If you can answer confidently, do so and cite the specific policy.
If unsure, say "I'm not certain about this — let me connect you with the HR team" and set needsEscalation: true.
Never guess on compliance, legal, or tax matters.
Return: { answer: string, needsEscalation: boolean, category: string }`,
      },
    },
    { id: "branch_escalation", name: "Check Escalation", type: "branch", config: { inputMap: { needsEscalation: { source: "node", nodeId: "answer_question", path: "needsEscalation" } } } },
    { id: "reply_direct", name: "Reply to Employee", type: "action", config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "node", nodeId: "parse_question", path: "userId" }, message: { source: "node", nodeId: "answer_question", path: "answer" } } } },
    { id: "escalate", name: "Escalate to HR", type: "action", config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "integration", provider: "settings", path: "hrChannel" }, message: { source: "template", template: "Employee question needs human help: {{parse_question.message}}" } } } },
  ],
  edges: [
    { from: "parse_question", to: "answer_question" },
    { from: "answer_question", to: "branch_escalation" },
    { from: "branch_escalation", to: "reply_direct", condition: { type: "output_equals", field: "needsEscalation", value: false } },
    { from: "branch_escalation", to: "reply_direct", condition: { type: "output_equals", field: "needsEscalation", value: true } },
    { from: "branch_escalation", to: "escalate", condition: { type: "output_equals", field: "needsEscalation", value: true } },
  ],
  errorHandler: { onNodeFailure: "skip", maxRetries: 0, retryDelaySeconds: 0, notifyChannel: "#hr" },
  metadata: { estimatedDurationMs: 5000, estimatedCostCents: 1, tags: ["qa", "policies", "employee-support"], requiredIntegrations: ["slack"], requiredApprovals: [] },
};

export const hrRecruitingWorkflows = [resumeScreening, interviewScheduling, onboardingCoordination, hrQA];
