import type { WorkflowDAG } from "../../workflows/types";

export const contentPlanning: WorkflowDAG = {
  id: "content-planning",
  name: "Content Planning & Calendar",
  vertical: "content-marketing",
  description: "Weekly content planning: trend research, topic generation, editorial calendar management",
  version: "1.0.0",
  trigger: { type: "schedule", cron: "0 9 * * 1" }, // Monday 9am
  nodes: [
    {
      id: "fetch_performance",
      name: "Fetch Content Performance",
      type: "fetch",
      config: { integration: "analytics", operation: "content.performance", inputMap: { period: { source: "static", value: "last_30_days" } } },
    },
    {
      id: "fetch_calendar",
      name: "Fetch Current Calendar",
      type: "fetch",
      config: { integration: "cms", operation: "posts.list", inputMap: { status: { source: "static", value: "scheduled" } } },
    },
    {
      id: "research_topics",
      name: "AI Research & Plan",
      type: "ai_decide",
      config: {
        inputMap: {
          performance: { source: "node", nodeId: "fetch_performance", path: "topContent" },
          existingCalendar: { source: "node", nodeId: "fetch_calendar", path: "posts" },
          topics: { source: "integration", provider: "settings", path: "coreTopics" },
          tone: { source: "integration", provider: "settings", path: "brandTone" },
        },
      },
      agent: {
        role: "Content Planner",
        model: "sonnet",
        instructions: `Plan next week's content. Return:
{
  "contentIdeas": [{ title, angle, targetKeyword, contentType, estimatedImpact, priority }],
  "contentMix": { educational: number, thoughtLeadership: number, product: number },
  "gapsIdentified": string[],
  "topPerformingThemes": string[],
  "calendarSuggestion": [{ day, title, type, assignedTo }]
}
Generate 8-10 ideas. Prioritize by: search volume, relevance, differentiation from competitors. Mix: 60% educational, 20% thought leadership, 20% product.`,
      },
    },
    {
      id: "create_calendar_entries",
      name: "Create Calendar Entries",
      type: "loop",
      config: {
        inputMap: { items: { source: "node", nodeId: "research_topics", path: "calendarSuggestion" } },
        params: { itemNode: "create_single_entry" },
      },
    },
    {
      id: "create_single_entry",
      name: "Create Draft Post",
      type: "action",
      config: { integration: "cms", operation: "posts.create", inputMap: { title: { source: "node", nodeId: "create_calendar_entries", path: "currentItem.title" }, status: { source: "static", value: "draft" } } },
    },
    {
      id: "notify_team",
      name: "Share Plan",
      type: "action",
      config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "integration", provider: "settings", path: "contentChannel" }, message: { source: "template", template: "Content plan for this week: {{research_topics.contentIdeas.length}} ideas, {{research_topics.calendarSuggestion.length}} scheduled" } } },
    },
  ],
  edges: [
    { from: "fetch_performance", to: "research_topics" },
    { from: "fetch_calendar", to: "research_topics" },
    { from: "research_topics", to: "create_calendar_entries" },
    { from: "create_calendar_entries", to: "create_single_entry" },
    { from: "research_topics", to: "notify_team" },
  ],
  errorHandler: { onNodeFailure: "skip", maxRetries: 1, retryDelaySeconds: 60, notifyChannel: "#content" },
  metadata: { estimatedDurationMs: 30000, estimatedCostCents: 8, tags: ["planning", "calendar", "topics"], requiredIntegrations: ["analytics", "cms", "slack"], requiredApprovals: [] },
};

export const contentCreation: WorkflowDAG = {
  id: "content-creation",
  name: "Content Creation Pipeline",
  vertical: "content-marketing",
  description: "Writes blog posts from draft to review-ready: outline, draft, edit, SEO optimize",
  version: "1.0.0",
  trigger: { type: "event", source: "content-planning", event: "content.assigned" },
  nodes: [
    {
      id: "load_brief",
      name: "Load Content Brief",
      type: "transform",
      config: { inputMap: { brief: { source: "trigger", path: "data" } } },
    },
    {
      id: "generate_outline",
      name: "Generate Outline",
      type: "ai_generate",
      config: {
        inputMap: { brief: { source: "node", nodeId: "load_brief", path: "brief" } },
      },
      agent: {
        role: "Content Writer",
        model: "sonnet",
        instructions: "Create a detailed outline with H2/H3 structure, key points per section, target word count per section, and suggested data points or examples to include.",
      },
    },
    {
      id: "write_draft",
      name: "Write Full Draft",
      type: "ai_generate",
      config: {
        inputMap: {
          outline: { source: "node", nodeId: "generate_outline", path: "outline" },
          tone: { source: "integration", provider: "settings", path: "brandTone" },
        },
      },
      agent: {
        role: "Content Writer",
        model: "opus",
        instructions: `Write the full blog post following the outline. 800-1500 words.
- Match brand tone exactly
- Short paragraphs (2-3 sentences)
- Include data points and examples
- Natural keyword usage (no stuffing)
- Compelling intro that hooks in 2 sentences
- Clear CTA at the end
- Write meta title (60 chars) and meta description (155 chars)`,
      },
    },
    {
      id: "seo_optimize",
      name: "SEO Optimization Pass",
      type: "ai_generate",
      config: {
        inputMap: {
          draft: { source: "node", nodeId: "write_draft", path: "content" },
          targetKeyword: { source: "node", nodeId: "load_brief", path: "brief.targetKeyword" },
        },
      },
      agent: {
        role: "Content Writer",
        model: "haiku",
        instructions: "Review for SEO. Check: keyword in title/H2/first paragraph, internal link opportunities, image alt text suggestions, readability score. Return optimized version + SEO checklist.",
      },
    },
    {
      id: "save_draft",
      name: "Save to CMS",
      type: "action",
      config: { integration: "cms", operation: "posts.update", inputMap: { postId: { source: "node", nodeId: "load_brief", path: "brief.postId" }, content: { source: "node", nodeId: "seo_optimize", path: "optimizedContent" }, status: { source: "static", value: "draft" } } },
    },
    {
      id: "request_review",
      name: "Request Human Review",
      type: "approval",
      config: {
        inputMap: {
          title: { source: "template", template: "Review: {{load_brief.brief.title}}" },
          description: { source: "static", value: "AI-written content ready for editorial review" },
          postUrl: { source: "node", nodeId: "save_draft", path: "editUrl" },
        },
      },
      agent: { role: "Content Writer", model: "sonnet" },
    },
    {
      id: "schedule_publish",
      name: "Schedule Publication",
      type: "action",
      config: { integration: "cms", operation: "posts.update", inputMap: { postId: { source: "node", nodeId: "load_brief", path: "brief.postId" }, status: { source: "static", value: "scheduled" }, publishAt: { source: "node", nodeId: "load_brief", path: "brief.scheduledDate" } } },
    },
    {
      id: "emit_published",
      name: "Emit Published Event",
      type: "emit",
      config: { inputMap: { event: { source: "static", value: "content.published" }, data: { source: "node", nodeId: "load_brief", path: "brief" } } },
    },
  ],
  edges: [
    { from: "load_brief", to: "generate_outline" },
    { from: "generate_outline", to: "write_draft" },
    { from: "write_draft", to: "seo_optimize" },
    { from: "seo_optimize", to: "save_draft" },
    { from: "save_draft", to: "request_review" },
    { from: "request_review", to: "schedule_publish", condition: { type: "approved" } },
    { from: "schedule_publish", to: "emit_published" },
  ],
  errorHandler: { onNodeFailure: "abort", maxRetries: 1, retryDelaySeconds: 120, notifyChannel: "#content" },
  metadata: { estimatedDurationMs: 180000, estimatedCostCents: 25, tags: ["writing", "blog", "seo"], requiredIntegrations: ["cms"], requiredApprovals: ["publish_content"] },
};

export const socialDistribution: WorkflowDAG = {
  id: "content-social-distribute",
  name: "Social Media Distribution",
  vertical: "content-marketing",
  description: "Repurposes published content into platform-specific social posts, schedules across the week",
  version: "1.0.0",
  trigger: { type: "event", source: "content-creation", event: "content.published" },
  nodes: [
    {
      id: "load_content",
      name: "Load Published Content",
      type: "fetch",
      config: { integration: "cms", operation: "posts.get", inputMap: { postId: { source: "trigger", path: "data.postId" } } },
    },
    {
      id: "generate_social",
      name: "Generate Social Variations",
      type: "ai_generate",
      config: { inputMap: { content: { source: "node", nodeId: "load_content", path: "post" } } },
      agent: {
        role: "Social Distributor",
        model: "haiku",
        instructions: `Create 5 social variations:
1. LinkedIn: Professional, 150-200 words, insight-led, no hashtags in body
2. Twitter/X #1: Punchy hook, 280 chars max, 2-3 hashtags
3. Twitter/X #2: Pull quote or key stat, link
4. Twitter/X #3: Contrarian take or question from the article
5. Instagram caption: Engaging, 100 words, 5 relevant hashtags at end

Return: [{ platform, content, hashtags, scheduledDay, scheduledTime }]
Spread across Mon-Fri. Vary times (9am, 12pm, 3pm).`,
      },
    },
    {
      id: "schedule_posts",
      name: "Schedule All Posts",
      type: "loop",
      config: { inputMap: { items: { source: "node", nodeId: "generate_social", path: "posts" } }, params: { itemNode: "schedule_single" } },
    },
    {
      id: "schedule_single",
      name: "Schedule Post",
      type: "action",
      config: { integration: "social", operation: "posts.schedule", inputMap: { platform: { source: "node", nodeId: "schedule_posts", path: "currentItem.platform" }, content: { source: "node", nodeId: "schedule_posts", path: "currentItem.content" }, scheduledAt: { source: "node", nodeId: "schedule_posts", path: "currentItem.scheduledAt" } } },
    },
    {
      id: "notify",
      name: "Notify Team",
      type: "action",
      config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "integration", provider: "settings", path: "contentChannel" }, message: { source: "template", template: "Social posts scheduled for \"{{load_content.post.title}}\": {{generate_social.posts.length}} posts across the week" } } },
    },
  ],
  edges: [
    { from: "load_content", to: "generate_social" },
    { from: "generate_social", to: "schedule_posts" },
    { from: "schedule_posts", to: "schedule_single" },
    { from: "schedule_posts", to: "notify" },
  ],
  errorHandler: { onNodeFailure: "skip", maxRetries: 1, retryDelaySeconds: 30, notifyChannel: "#content" },
  metadata: { estimatedDurationMs: 15000, estimatedCostCents: 3, tags: ["social", "distribution", "repurpose"], requiredIntegrations: ["cms", "social", "slack"], requiredApprovals: [] },
};

export const performanceTracking: WorkflowDAG = {
  id: "content-performance",
  name: "Content Performance Report",
  vertical: "content-marketing",
  description: "Weekly content performance: traffic, engagement, conversions, SEO rankings, social metrics",
  version: "1.0.0",
  trigger: { type: "schedule", cron: "0 9 * * 5" }, // Friday 9am
  nodes: [
    { id: "fetch_traffic", name: "Fetch Traffic Data", type: "fetch", config: { integration: "analytics", operation: "content.traffic", inputMap: { period: { source: "static", value: "last_7_days" } } } },
    { id: "fetch_social", name: "Fetch Social Metrics", type: "fetch", config: { integration: "social", operation: "analytics.engagement", inputMap: { period: { source: "static", value: "last_7_days" } } } },
    { id: "fetch_conversions", name: "Fetch Conversion Data", type: "fetch", config: { integration: "analytics", operation: "conversions.byContent", inputMap: { period: { source: "static", value: "last_7_days" } } } },
    {
      id: "analyze",
      name: "AI Analyze Performance",
      type: "ai_decide",
      config: {
        inputMap: {
          traffic: { source: "node", nodeId: "fetch_traffic", path: "data" },
          social: { source: "node", nodeId: "fetch_social", path: "data" },
          conversions: { source: "node", nodeId: "fetch_conversions", path: "data" },
        },
      },
      agent: {
        role: "Performance Tracker",
        model: "sonnet",
        instructions: `Analyze weekly content performance. Return:
{
  "topContent": [{ title, views, engagement, conversions }],
  "underperforming": [{ title, issue, suggestion }],
  "trafficTrend": { thisWeek, lastWeek, change },
  "socialEngagement": { totalReach, totalEngagement, bestPost },
  "seoMovers": [{ keyword, oldRank, newRank }],
  "recommendation": string,
  "contentToPromote": string[] (deserves more distribution)
}`,
      },
    },
    {
      id: "format_report",
      name: "Format Report",
      type: "ai_generate",
      config: { inputMap: { analysis: { source: "node", nodeId: "analyze", path: "" } } },
      agent: { role: "Performance Tracker", model: "haiku", instructions: "Clean Slack report. Lead with the top-performing content. Use trend indicators. End with next week's recommendation." },
    },
    { id: "send_report", name: "Send Report", type: "action", config: { integration: "slack", operation: "chat.postMessage", inputMap: { channel: { source: "integration", provider: "settings", path: "contentChannel" }, message: { source: "node", nodeId: "format_report", path: "message" } } } },
  ],
  edges: [
    { from: "fetch_traffic", to: "analyze" },
    { from: "fetch_social", to: "analyze" },
    { from: "fetch_conversions", to: "analyze" },
    { from: "analyze", to: "format_report" },
    { from: "format_report", to: "send_report" },
  ],
  errorHandler: { onNodeFailure: "retry", maxRetries: 2, retryDelaySeconds: 60, notifyChannel: "#content" },
  metadata: { estimatedDurationMs: 20000, estimatedCostCents: 5, tags: ["performance", "analytics", "reporting"], requiredIntegrations: ["analytics", "social", "slack"], requiredApprovals: [] },
};

export const contentMarketingWorkflows = [contentPlanning, contentCreation, socialDistribution, performanceTracking];
