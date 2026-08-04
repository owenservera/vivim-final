# Skeleton Prompt — PlatformCatalog Generation

Generate a comprehensive catalog of webapp/interface platforms for the vivim-final
provider taxonomy library. Cover all 10 categories below. Aim for ~15-20 platforms per
category (150-200 total). Include both well-known and notable niche platforms.

## Categories & Examples
1. **social_messaging** — WhatsApp, Telegram, Messenger, Signal, WeChat, Line, Viber
2. **social_feed** — Facebook, Instagram, X/Twitter, LinkedIn, Reddit, TikTok, Threads, Mastodon
3. **dating** — Tinder, Bumble, Hinge, OkCupid, Grindr
4. **ai_chatbot** — ChatGPT, Claude, Gemini, DeepSeek, Qwen, Perplexity, Grok, Poe
5. **ai_tooling** — Midjourney, Runway, Suno, ElevenLabs, Cursor, Replit, v0, Lovable
6. **ide** — VS Code, JetBrains suite, Neovim, Zed, Sublime
7. **agentic_agent** — Claude Code, Devin, OpenCode, Aider, Cline, Copilot CLI
8. **browser_automation** — Chrome CDP, Playwright, Puppeteer, Selenium, SeleniumBase
9. **productivity** — Notion, Slack, Discord, Trello, Asana, Linear, Jira, Confluence
10. **forum** — Reddit, StackOverflow, Discourse, HackerNews

## Output Format (STRICT JSON)

```json
{
  "platforms": [
    {
      "slug": "facebook",
      "displayName": "Facebook",
      "category": "social_feed",
      "url": "https://facebook.com",
      "description": "Social networking platform with feed, messaging, and groups",
      "sourceConfidence": "high"
    }
  ]
}
```

## Rules
- `slug` = lowercase, underscores for spaces (e.g., `x_twitter`, `vs_code`)
- `category` MUST be one of the 10 listed above
- `sourceConfidence` = high|medium|low (how confident you are this platform exists & is relevant)
- Do NOT include platforms already in existing seeds (check library state first)
- Return ONLY valid JSON, no markdown fences, no commentary


