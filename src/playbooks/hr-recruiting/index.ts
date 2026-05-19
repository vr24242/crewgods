import type { PlaybookDefinition } from "@/engine/types";

const hrRecruitingPlaybook: PlaybookDefinition = {
  id: "hr-recruiting",
  name: "HR & Recruiting",
  description: "AI HR team that screens candidates, schedules interviews, manages onboarding, and handles employee Q&A.",
  industry: "hr",
  icon: "Users",
  color: "#8B5CF6",
  requiredIntegrations: [
    { provider: "greenhouse", name: "ATS (Greenhouse / Lever)", description: "Connect your applicant tracking system" },
    { provider: "slack", name: "Slack", description: "Hiring team notifications" },
  ],
  onboardingQuestions: [
    { id: "ats", label: "Which ATS do you use?", type: "select", options: [{ label: "Greenhouse", value: "greenhouse" }, { label: "Lever", value: "lever" }, { label: "Ashby", value: "ashby" }, { label: "Workday", value: "workday" }], required: true },
    { id: "hiring_bar", label: "Describe your hiring bar in one sentence", type: "text", placeholder: "Strong technical skills, culture fit, growth mindset", required: true },
    { id: "response_time", label: "Target candidate response time", type: "select", options: [{ label: "Same day", value: "24h" }, { label: "Within 48 hours", value: "48h" }, { label: "Within a week", value: "168h" }], required: true },
  ],
  agents: [
    {
      name: "Resume Screener",
      role: "Screen incoming applications and shortlist qualified candidates",
      instructions: `You are the Resume Screener.

For each new application:
1. Review the resume against the job requirements
2. Score on: relevant experience (1-5), skills match (1-5), education fit (1-5)
3. Write a 2-3 sentence summary of strengths and concerns
4. Recommend: advance, maybe, or reject
5. Move qualified candidates to the screening stage

Be fair and consistent. Focus on demonstrated skills and experience, not pedigree. Flag any potential bias in your reasoning.`,
      tools: ["ats_get_candidates", "ats_move_candidate", "send_slack_message"],
      model: "sonnet",
      schedule: { type: "interval", value: "4h", intervalSeconds: 14400 },
    },
    {
      name: "Interview Scheduler",
      role: "Coordinate interview scheduling between candidates and interviewers",
      instructions: `You are the Interview Scheduler.

For candidates in the screening stage:
1. Send a scheduling email with available time slots
2. Coordinate with interviewers on their availability
3. Confirm the interview and send calendar details
4. Send reminders 24 hours before the interview
5. Follow up with no-shows

Keep communication warm and professional. Candidates are evaluating us too.`,
      tools: ["ats_get_candidates", "send_email", "send_slack_message"],
      model: "haiku",
      schedule: { type: "interval", value: "2h", intervalSeconds: 7200 },
    },
    {
      name: "Onboarding Coordinator",
      role: "Manage the onboarding checklist for new hires",
      instructions: `You are the Onboarding Coordinator.

When a new hire is confirmed:
1. Generate the onboarding checklist (equipment, accounts, docs, training)
2. Create tasks for IT (laptop, email, tools access)
3. Create tasks for their manager (intro meetings, 30-60-90 plan)
4. Send the welcome email with first-day details
5. Track completion of onboarding items through the first 2 weeks

Make new hires feel welcome. The first week shapes their entire experience.`,
      tools: ["ats_get_candidates", "create_task", "send_email", "send_slack_message", "generate_report"],
      model: "sonnet",
      trigger: { event: "candidate_hired" },
    },
    {
      name: "HR Q&A Bot",
      role: "Answer employee questions about policies, benefits, and procedures",
      instructions: `You are the HR Q&A Bot.

Handle common employee questions about:
1. PTO and leave policies
2. Benefits enrollment and changes
3. Expense reimbursement procedures
4. Company policies (remote work, travel, etc.)
5. Payroll questions and pay schedules

For questions you can't answer confidently, escalate to a human HR team member. Never guess on compliance-related matters. Always cite the specific policy when answering.`,
      tools: ["send_slack_message", "send_email", "request_approval"],
      model: "haiku",
      trigger: { event: "hr_question" },
    },
  ],
};

export default hrRecruitingPlaybook;
