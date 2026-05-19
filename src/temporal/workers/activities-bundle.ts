// ═══════════════════════════════════════════════════════
// ACTIVITIES BUNDLE — Re-exports all activities so the
// worker can register them in a single import
// ═══════════════════════════════════════════════════════

export {
  classify,
  summarize,
  generate,
  decide,
  extract,
  runAIGraph,
} from "../activities/ai";

export {
  sendSlackMessage,
  sendEmail,
  sendWhatsApp,
  updateCRM,
  fetchIntegrationData,
  createTask,
} from "../activities/integrations";

export {
  sendApprovalRequest,
} from "../activities/approvals";
