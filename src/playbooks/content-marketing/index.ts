import type { PlaybookDefinition } from "@/engine/types";

const contentMarketingPlaybook: PlaybookDefinition = {
  id: "content-marketing",
  name: "Content & Marketing",
  description: "AI marketing team that plans content, writes posts, distributes across channels, and tracks performance.",
  industry: "marketing",
  icon: "PenTool",
  color: "#EC4899",
  requiredIntegrations: [
    { provider: "wordpress", name: "WordPress / CMS", description: "Connect your blog or CMS" },
    { provider: "social", name: "Social Media", description: "Connect social accounts" },
    { provider: "analytics", name: "Google Analytics", description: "Track content performance" },
  ],
  onboardingQuestions: [
    { id: "cms", label: "Which CMS do you use?", type: "select", options: [{ label: "WordPress", value: "wordpress" }, { label: "Webflow", value: "webflow" }, { label: "Ghost", value: "ghost" }, { label: "Custom", value: "custom" }], required: true },
    { id: "tone", label: "Brand tone of voice", type: "text", placeholder: "Professional but friendly, avoid jargon", required: true },
    { id: "topics", label: "Core content topics (comma separated)", type: "text", placeholder: "AI automation, productivity, business ops", required: true },
  ],
  agents: [
    {
      name: "Content Planner",
      role: "Research trending topics and plan the editorial calendar",
      instructions: `You are the Content Planner.

Weekly responsibilities:
1. Research trending topics in the company's industry
2. Identify content gaps based on competitor analysis
3. Suggest 5-10 content ideas with working titles and angles
4. Prioritize by expected impact (search volume, relevance, differentiation)
5. Maintain a 4-week editorial calendar

Consider the content mix: 60% educational, 20% thought leadership, 20% product-related.`,
      tools: ["analytics_get_metrics", "cms_get_posts", "generate_report", "send_slack_message"],
      model: "sonnet",
      schedule: { type: "interval", value: "weekly", intervalSeconds: 604800 },
    },
    {
      name: "Content Writer",
      role: "Write blog posts, articles, and long-form content",
      instructions: `You are the Content Writer.

For each assigned topic:
1. Research the topic thoroughly
2. Create an outline with H2/H3 structure
3. Write the full post (800-1500 words)
4. Include a compelling title and meta description
5. Save as draft for human review before publishing

Writing guidelines:
- Match the configured brand tone
- Use short paragraphs (2-3 sentences)
- Include data points and examples
- End with a clear CTA
- Optimize for the target keyword naturally`,
      tools: ["cms_create_post", "request_approval"],
      model: "opus",
      trigger: { event: "content_assigned" },
      requiresApproval: ["publish_content"],
    },
    {
      name: "Social Distributor",
      role: "Repurpose content into social posts and distribute across channels",
      instructions: `You are the Social Distributor.

When new content is published:
1. Create 3-5 social media variations for each post
2. Adapt format per platform (LinkedIn: professional/long, Twitter: punchy/short, Instagram: visual/caption)
3. Schedule posts across the week (don't blast everything at once)
4. Include relevant hashtags (max 5)
5. Tag relevant people or companies when appropriate

Repurposing ideas: pull quotes, key stats, contrarian takes, thread breakdowns, carousel summaries.`,
      tools: ["cms_get_posts", "social_post", "send_slack_message"],
      model: "haiku",
      trigger: { event: "content_published" },
    },
    {
      name: "Performance Tracker",
      role: "Track content performance metrics and generate insights",
      instructions: `You are the Performance Tracker.

Weekly report:
1. Traffic by source (organic, social, email, direct)
2. Top-performing content this week
3. Content that's underperforming expectations
4. Social engagement metrics (likes, shares, comments)
5. Conversion data (if available)
6. SEO ranking changes for target keywords

Flag content that's performing 2x above average — it deserves more promotion. Flag content below 0.5x average — analyze why and suggest improvements.`,
      tools: ["analytics_get_metrics", "cms_get_posts", "generate_report", "send_slack_message"],
      model: "haiku",
      schedule: { type: "interval", value: "weekly", intervalSeconds: 604800 },
    },
  ],
};

export default contentMarketingPlaybook;
