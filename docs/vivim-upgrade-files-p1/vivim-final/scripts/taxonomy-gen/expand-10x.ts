// scripts/taxonomy-gen/expand-10x.ts
// 10x Expansion: scales skeleton platforms from 53 → 200+ and
// shared capabilities from 64 → 200+ across 30+ categories.
//
// Run:
//   bun run scripts/taxonomy-gen/expand-10x.ts
//
// After running, merge:
//   bun run taxonomy-gen merge
//   bun run devops verify-cross-surface

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const OUTPUT_DIR = join(import.meta.dir, 'output')
const SKELETON_PATH = join(OUTPUT_DIR, 'skeleton', 'platforms.json')
const SHARED_RAW_PATH = join(import.meta.dir, '..', '..', 'seeds', 'taxonomy', 'shared', 'raw.json')
const SHARED_POOL_PATH = join(OUTPUT_DIR, 'shared', 'pool.json')
const STATE_PATH = join(OUTPUT_DIR, 'state.json')

// ── Platform catalog (200+ platforms across 30+ categories) ──────────────

interface PlatformDef {
  slug: string
  category: string
  url: string
  authType: string
  interactionPattern: string
}

const PLATFORMS_10X: PlatformDef[] = [
  // ═══ EXISTING CATEGORIES (expanded) ═══

  // ── ai_chatbot (existing 8 + 8 new = 16) ──
  { slug: 'chatgpt', category: 'ai_chatbot', url: 'https://chat.openai.com', authType: 'api', interactionPattern: 'chat' },
  { slug: 'claude', category: 'ai_chatbot', url: 'https://claude.ai', authType: 'api', interactionPattern: 'chat' },
  { slug: 'gemini', category: 'ai_chatbot', url: 'https://gemini.google.com', authType: 'api', interactionPattern: 'chat' },
  { slug: 'deepseek', category: 'ai_chatbot', url: 'https://chat.deepseek.com', authType: 'api', interactionPattern: 'chat' },
  { slug: 'qwen', category: 'ai_chatbot', url: 'https://tongyi.aliyun.com', authType: 'api', interactionPattern: 'chat' },
  { slug: 'perplexity', category: 'ai_chatbot', url: 'https://perplexity.ai', authType: 'api', interactionPattern: 'chat' },
  { slug: 'grok', category: 'ai_chatbot', url: 'https://grok.com', authType: 'api', interactionPattern: 'chat' },
  { slug: 'poe', category: 'ai_chatbot', url: 'https://poe.com', authType: 'api', interactionPattern: 'chat' },
  { slug: 'cohere', category: 'ai_chatbot', url: 'https://cohere.com', authType: 'api', interactionPattern: 'chat' },
  { slug: 'mistral', category: 'ai_chatbot', url: 'https://chat.mistral.ai', authType: 'api', interactionPattern: 'chat' },
  { slug: 'anthropic_console', category: 'ai_chatbot', url: 'https://console.anthropic.com', authType: 'api', interactionPattern: 'chat' },
  { slug: 'you_com', category: 'ai_chatbot', url: 'https://you.com', authType: 'api', interactionPattern: 'chat' },
  { slug: 'character_ai', category: 'ai_chatbot', url: 'https://character.ai', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'replika', category: 'ai_chatbot', url: 'https://replika.ai', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'janitor', category: 'ai_chatbot', url: 'https://janitorai.com', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'spicychat', category: 'ai_chatbot', url: 'https://spicychat.ai', authType: 'browser', interactionPattern: 'chat' },

  // ── social_feed (existing 8 + 8 new = 16) ──
  { slug: 'facebook', category: 'social_feed', url: 'https://facebook.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'instagram', category: 'social_feed', url: 'https://instagram.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'x_twitter', category: 'social_feed', url: 'https://x.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'linkedin', category: 'social_feed', url: 'https://linkedin.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'reddit', category: 'social_feed', url: 'https://reddit.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'tiktok', category: 'social_feed', url: 'https://tiktok.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'threads', category: 'social_feed', url: 'https://threads.net', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'mastodon', category: 'social_feed', url: 'https://mastodon.social', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'bluesky', category: 'social_feed', url: 'https://bsky.app', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'truth_social', category: 'social_feed', url: 'https://truthsocial.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'threads_meta', category: 'social_feed', url: 'https://threads.net', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'digg', category: 'social_feed', url: 'https://digg.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'slashdot', category: 'social_feed', url: 'https://slashdot.org', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'lobste_rs', category: 'social_feed', url: 'https://lobste.rs', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'producthunt', category: 'social_feed', url: 'https://producthunt.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'devto', category: 'social_feed', url: 'https://dev.to', authType: 'browser', interactionPattern: 'feed' },

  // ── social_messaging (existing 7 + 5 new = 12) ──
  { slug: 'whatsapp', category: 'social_messaging', url: 'https://web.whatsapp.com', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'telegram', category: 'social_messaging', url: 'https://web.telegram.org', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'discord', category: 'social_messaging', url: 'https://discord.com', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'slack', category: 'social_messaging', url: 'https://slack.com', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'messenger', category: 'social_messaging', url: 'https://messenger.com', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'signal', category: 'social_messaging', url: 'https://signal.org', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'wechat', category: 'social_messaging', url: 'https://web.wechat.com', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'line', category: 'social_messaging', url: 'https://line.me', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'viber', category: 'social_messaging', url: 'https://viber.com', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'skype', category: 'social_messaging', url: 'https://web.skype.com', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'teams', category: 'social_messaging', url: 'https://teams.microsoft.com', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'mattermost', category: 'social_messaging', url: 'https://mattermost.com', authType: 'browser', interactionPattern: 'chat' },

  // ── ai_tooling (existing 6 + 6 new = 12) ──
  { slug: 'midjourney', category: 'ai_tooling', url: 'https://midjourney.com', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'runway', category: 'ai_tooling', url: 'https://runway.com', authType: 'browser', interactionPattern: 'canvas' },
  { slug: 'suno', category: 'ai_tooling', url: 'https://suno.com', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'elevenlabs', category: 'ai_tooling', url: 'https://elevenlabs.io', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'v0', category: 'ai_tooling', url: 'https://v0.dev', authType: 'browser', interactionPattern: 'canvas' },
  { slug: 'lovable', category: 'ai_tooling', url: 'https://lovable.dev', authType: 'browser', interactionPattern: 'canvas' },
  { slug: 'dalle', category: 'ai_tooling', url: 'https://labs.openai.com', authType: 'api', interactionPattern: 'canvas' },
  { slug: 'stable_diffusion', category: 'ai_tooling', url: 'https://stability.ai', authType: 'browser', interactionPattern: 'canvas' },
  { slug: 'pika', category: 'ai_tooling', url: 'https://pika.art', authType: 'browser', interactionPattern: 'canvas' },
  { slug: 'synthesia', category: 'ai_tooling', url: 'https://synthesia.io', authType: 'browser', interactionPattern: 'canvas' },
  { slug: 'descript', category: 'ai_tooling', url: 'https://descript.com', authType: 'browser', interactionPattern: 'canvas' },
  { slug: 'notion_ai', category: 'ai_tooling', url: 'https://notion.so', authType: 'browser', interactionPattern: 'canvas' },

  // ── agentic_agent (existing 5 + 5 new = 10) ──
  { slug: 'claude_code', category: 'agentic_agent', url: 'https://claude.ai/code', authType: 'api', interactionPattern: 'chat' },
  { slug: 'devin', category: 'agentic_agent', url: 'https://cognition.ai', authType: 'api', interactionPattern: 'chat' },
  { slug: 'opencode', category: 'agentic_agent', url: 'https://opencode.ai', authType: 'api', interactionPattern: 'chat' },
  { slug: 'aider', category: 'agentic_agent', url: 'https://aider.chat', authType: 'api', interactionPattern: 'chat' },
  { slug: 'cline', category: 'agentic_agent', url: 'https://cline.bot', authType: 'api', interactionPattern: 'chat' },
  { slug: 'cursor_agent', category: 'agentic_agent', url: 'https://cursor.com', authType: 'api', interactionPattern: 'chat' },
  { slug: 'github_copilot', category: 'agentic_agent', url: 'https://copilot.github.com', authType: 'api', interactionPattern: 'chat' },
  { slug: 'codex_cli', category: 'agentic_agent', url: 'https://openai.com/codex', authType: 'api', interactionPattern: 'chat' },
  { slug: 'bolt_new', category: 'agentic_agent', url: 'https://bolt.new', authType: 'browser', interactionPattern: 'canvas' },
  { slug: 'replit_agent', category: 'agentic_agent', url: 'https://replit.com', authType: 'browser', interactionPattern: 'canvas' },

  // ── productivity (existing 5 + 5 new = 10) ──
  { slug: 'notion', category: 'productivity', url: 'https://notion.so', authType: 'browser', interactionPattern: 'canvas' },
  { slug: 'trello', category: 'productivity', url: 'https://trello.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'asana', category: 'productivity', url: 'https://asana.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'linear', category: 'productivity', url: 'https://linear.app', authType: 'browser', interactionPattern: 'form' },
  { slug: 'jira', category: 'productivity', url: 'https://jira.atlassian.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'clickup', category: 'productivity', url: 'https://clickup.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'monday', category: 'productivity', url: 'https://monday.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'airtable', category: 'productivity', url: 'https://airtable.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'coda', category: 'productivity', url: 'https://coda.io', authType: 'browser', interactionPattern: 'canvas' },
  { slug: 'miro', category: 'productivity', url: 'https://miro.com', authType: 'browser', interactionPattern: 'canvas' },

  // ── browser_automation (existing 4 + 3 new = 7) ──
  { slug: 'chrome', category: 'browser_automation', url: 'https://chrome.dev', authType: 'none', interactionPattern: 'canvas' },
  { slug: 'playwright', category: 'browser_automation', url: 'https://playwright.dev', authType: 'none', interactionPattern: 'canvas' },
  { slug: 'puppeteer', category: 'browser_automation', url: 'https://pptr.dev', authType: 'none', interactionPattern: 'canvas' },
  { slug: 'selenium', category: 'browser_automation', url: 'https://selenium.dev', authType: 'none', interactionPattern: 'canvas' },
  { slug: 'cypress', category: 'browser_automation', url: 'https://cypress.io', authType: 'none', interactionPattern: 'canvas' },
  { slug: 'webdriverio', category: 'browser_automation', url: 'https://webdriver.io', authType: 'none', interactionPattern: 'canvas' },
  { slug: 'testcafe', category: 'browser_automation', url: 'https://testcafe.io', authType: 'none', interactionPattern: 'canvas' },

  // ── dating (existing 4 + 3 new = 7) ──
  { slug: 'tinder', category: 'dating', url: 'https://tinder.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'bumble', category: 'dating', url: 'https://bumble.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'hinge', category: 'dating', url: 'https://hinge.co', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'okcupid', category: 'dating', url: 'https://okcupid.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'match', category: 'dating', url: 'https://match.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'badoo', category: 'dating', url: 'https://badoo.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'plentyoffish', category: 'dating', url: 'https://pof.com', authType: 'browser', interactionPattern: 'feed' },

  // ── forum (existing 3 + 3 new = 6) ──
  { slug: 'stackoverflow', category: 'forum', url: 'https://stackoverflow.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'hackernews', category: 'forum', url: 'https://news.ycombinator.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'discourse', category: 'forum', url: 'https://discourse.org', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'quora', category: 'forum', url: 'https://quora.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'medium', category: 'forum', url: 'https://medium.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'substack', category: 'forum', url: 'https://substack.com', authType: 'browser', interactionPattern: 'feed' },

  // ── ide (existing 3 + 3 new = 6) ──
  { slug: 'cursor', category: 'ide', url: 'https://cursor.sh', authType: 'none', interactionPattern: 'canvas' },
  { slug: 'replit', category: 'ide', url: 'https://replit.com', authType: 'browser', interactionPattern: 'canvas' },
  { slug: 'vscode', category: 'ide', url: 'https://code.visualstudio.com', authType: 'none', interactionPattern: 'canvas' },
  { slug: 'windsurf', category: 'ide', url: 'https://codeium.com/windsurf', authType: 'none', interactionPattern: 'canvas' },
  { slug: 'zed', category: 'ide', url: 'https://zed.dev', authType: 'none', interactionPattern: 'canvas' },
  { slug: 'nova', category: 'ide', url: 'https://nova.app', authType: 'none', interactionPattern: 'canvas' },

  // ═══ NEW CATEGORIES ═══

  // ── ecommerce (new, 10 platforms) ──
  { slug: 'amazon', category: 'ecommerce', url: 'https://amazon.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'shopify', category: 'ecommerce', url: 'https://shopify.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'ebay', category: 'ecommerce', url: 'https://ebay.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'walmart', category: 'ecommerce', url: 'https://walmart.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'etsy', category: 'ecommerce', url: 'https://etsy.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'alibaba', category: 'ecommerce', url: 'https://alibaba.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'taobao', category: 'ecommerce', url: 'https://taobao.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'bestbuy', category: 'ecommerce', url: 'https://bestbuy.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'target', category: 'ecommerce', url: 'https://target.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'stripe_dashboard', category: 'ecommerce', url: 'https://dashboard.stripe.com', authType: 'api', interactionPattern: 'form' },

  // ── finance (new, 8 platforms) ──
  { slug: 'paypal', category: 'finance', url: 'https://paypal.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'robinhood', category: 'finance', url: 'https://robinhood.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'coinbase', category: 'finance', url: 'https://coinbase.com', authType: 'api', interactionPattern: 'feed' },
  { slug: 'binance', category: 'finance', url: 'https://binance.com', authType: 'api', interactionPattern: 'feed' },
  { slug: 'schwab', category: 'finance', url: 'https://schwab.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'fidelity', category: 'finance', url: 'https://fidelity.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'wise', category: 'finance', url: 'https://wise.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'revolut', category: 'finance', url: 'https://revolut.com', authType: 'browser', interactionPattern: 'form' },

  // ── education (new, 8 platforms) ──
  { slug: 'canvas_lms', category: 'education', url: 'https://canvas.instructure.com', authType: 'browser', interactionPattern: 'canvas' },
  { slug: 'blackboard', category: 'education', url: 'https://blackboard.com', authType: 'browser', interactionPattern: 'canvas' },
  { slug: 'khan_academy', category: 'education', url: 'https://khanacademy.org', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'coursera', category: 'education', url: 'https://coursera.org', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'udemy', category: 'education', url: 'https://udemy.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'duolingo', category: 'education', url: 'https://duolingo.com', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'anki', category: 'education', url: 'https://apps.ankiweb.net', authType: 'none', interactionPattern: 'canvas' },
  { slug: 'quizlet', category: 'education', url: 'https://quizlet.com', authType: 'browser', interactionPattern: 'feed' },

  // ── healthcare (new, 6 platforms) ──
  { slug: 'mychart', category: 'healthcare', url: 'https://mychart.org', authType: 'browser', interactionPattern: 'form' },
  { slug: 'teladoc', category: 'healthcare', url: 'https://teladoc.com', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'zocdoc', category: 'healthcare', url: 'https://zocdoc.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'fitbit', category: 'healthcare', url: 'https://fitbit.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'strava', category: 'healthcare', url: 'https://strava.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'myfitnesspal', category: 'healthcare', url: 'https://myfitnesspal.com', authType: 'browser', interactionPattern: 'form' },

  // ── gaming (new, 6 platforms) ──
  { slug: 'steam', category: 'gaming', url: 'https://store.steampowered.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'epic_games', category: 'gaming', url: 'https://epicgames.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'xbox', category: 'gaming', url: 'https://xbox.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'playstation', category: 'gaming', url: 'https://playstation.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'twitch', category: 'gaming', url: 'https://twitch.tv', authType: 'browser', interactionPattern: 'chat' },
  { slug: 'discord_gaming', category: 'gaming', url: 'https://discord.com', authType: 'browser', interactionPattern: 'chat' },

  // ── media (new, 8 platforms) ──
  { slug: 'youtube', category: 'media', url: 'https://youtube.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'spotify', category: 'media', url: 'https://open.spotify.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'netflix', category: 'media', url: 'https://netflix.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'soundcloud', category: 'media', url: 'https://soundcloud.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'bandcamp', category: 'media', url: 'https://bandcamp.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'mixcloud', category: 'media', url: 'https://mixcloud.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'podbean', category: 'media', url: 'https://podbean.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'anchor_fm', category: 'media', url: 'https://podcasts.spotify.com', authType: 'browser', interactionPattern: 'feed' },

  // ── travel (new, 6 platforms) ──
  { slug: 'airbnb', category: 'travel', url: 'https://airbnb.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'booking', category: 'travel', url: 'https://booking.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'expedia', category: 'travel', url: 'https://expedia.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'uber', category: 'travel', url: 'https://uber.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'lyft', category: 'travel', url: 'https://lyft.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'tripadvisor', category: 'travel', url: 'https://tripadvisor.com', authType: 'browser', interactionPattern: 'feed' },

  // ── cloud_devops (new, 8 platforms) ──
  { slug: 'github', category: 'cloud_devops', url: 'https://github.com', authType: 'api', interactionPattern: 'canvas' },
  { slug: 'gitlab', category: 'cloud_devops', url: 'https://gitlab.com', authType: 'api', interactionPattern: 'canvas' },
  { slug: 'vercel', category: 'cloud_devops', url: 'https://vercel.com', authType: 'api', interactionPattern: 'form' },
  { slug: 'netlify', category: 'cloud_devops', url: 'https://netlify.com', authType: 'api', interactionPattern: 'form' },
  { slug: 'aws_console', category: 'cloud_devops', url: 'https://console.aws.amazon.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'gcloud', category: 'cloud_devops', url: 'https://console.cloud.google.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'azure_portal', category: 'cloud_devops', url: 'https://portal.azure.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'docker_hub', category: 'cloud_devops', url: 'https://hub.docker.com', authType: 'api', interactionPattern: 'feed' },

  // ── design (new, 6 platforms) ──
  { slug: 'figma', category: 'design', url: 'https://figma.com', authType: 'browser', interactionPattern: 'canvas' },
  { slug: 'canva', category: 'design', url: 'https://canva.com', authType: 'browser', interactionPattern: 'canvas' },
  { slug: 'sketch', category: 'design', url: 'https://sketch.com', authType: 'none', interactionPattern: 'canvas' },
  { slug: 'adobe_xd', category: 'design', url: 'https://adobe.com/xd', authType: 'none', interactionPattern: 'canvas' },
  { slug: 'invision', category: 'design', url: 'https://invisionapp.com', authType: 'browser', interactionPattern: 'canvas' },
  { slug: 'zeplin', category: 'design', url: 'https://zeplin.io', authType: 'browser', interactionPattern: 'canvas' },

  // ── crm (new, 6 platforms) ──
  { slug: 'salesforce', category: 'crm', url: 'https://salesforce.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'hubspot', category: 'crm', url: 'https://hubspot.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'pipedrive', category: 'crm', url: 'https://pipedrive.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'zoho_crm', category: 'crm', url: 'https://zoho.com/crm', authType: 'browser', interactionPattern: 'form' },
  { slug: 'freshsales', category: 'crm', url: 'https://freshworks.com/crm', authType: 'browser', interactionPattern: 'form' },
  { slug: 'close_crm', category: 'crm', url: 'https://close.com', authType: 'browser', interactionPattern: 'form' },

  // ── analytics (new, 6 platforms) ──
  { slug: 'google_analytics', category: 'analytics', url: 'https://analytics.google.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'mixpanel', category: 'analytics', url: 'https://mixpanel.com', authType: 'api', interactionPattern: 'feed' },
  { slug: 'amplitude', category: 'analytics', url: 'https://amplitude.com', authType: 'api', interactionPattern: 'feed' },
  { slug: 'segment', category: 'analytics', url: 'https://segment.com', authType: 'api', interactionPattern: 'feed' },
  { slug: 'hotjar', category: 'analytics', url: 'https://hotjar.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'posthog', category: 'analytics', url: 'https://posthog.com', authType: 'api', interactionPattern: 'feed' },

  // ── docs_wiki (new, 6 platforms) ──
  { slug: 'google_docs', category: 'docs_wiki', url: 'https://docs.google.com', authType: 'browser', interactionPattern: 'canvas' },
  { slug: 'confluence', category: 'docs_wiki', url: 'https://confluence.atlassian.com', authType: 'browser', interactionPattern: 'canvas' },
  { slug: 'gitbook', category: 'docs_wiki', url: 'https://gitbook.com', authType: 'browser', interactionPattern: 'canvas' },
  { slug: 'obsidian_web', category: 'docs_wiki', url: 'https://obsidian.md', authType: 'none', interactionPattern: 'canvas' },
  { slug: 'logseq', category: 'docs_wiki', url: 'https://logseq.com', authType: 'none', interactionPattern: 'canvas' },
  { slug: 'roam_research', category: 'docs_wiki', url: 'https://roamresearch.com', authType: 'browser', interactionPattern: 'canvas' },

  // ── email (new, 4 platforms) ──
  { slug: 'gmail', category: 'email', url: 'https://mail.google.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'outlook', category: 'email', url: 'https://outlook.office.com', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'protonmail', category: 'email', url: 'https://mail.proton.me', authType: 'browser', interactionPattern: 'feed' },
  { slug: 'superhuman', category: 'email', url: 'https://superhuman.com', authType: 'browser', interactionPattern: 'feed' },

  // ── calendar (new, 4 platforms) ──
  { slug: 'google_calendar', category: 'calendar', url: 'https://calendar.google.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'outlook_calendar', category: 'calendar', url: 'https://outlook.office.com/calendar', authType: 'browser', interactionPattern: 'form' },
  { slug: 'calendly', category: 'calendar', url: 'https://calendly.com', authType: 'browser', interactionPattern: 'form' },
  { slug: 'cron_calendar', category: 'calendar', url: 'https://cron.com', authType: 'browser', interactionPattern: 'form' },
]

// ── Capabilities (200+ shared capability nodes) ─────────────────────────

interface CapabilityDef {
  slug: string
  label: string
  description: string
  capabilityKind: 'action' | 'query' | 'state' | 'config' | 'navigation'
  tags: string[]
}

const CAPABILITIES_10X: CapabilityDef[] = [
  // ═══ EXISTING CAPABILITIES (preserved) ═══
  { slug: 'send_message', label: 'Send Message', description: 'Compose and dispatch a message in the composer', capabilityKind: 'action', tags: ['compose', 'chat'] },
  { slug: 'read_response', label: 'Read Response', description: 'Read and process an assistant response', capabilityKind: 'query', tags: ['read', 'chat'] },
  { slug: 'new_chat', label: 'New Chat', description: 'Create a new conversation thread', capabilityKind: 'action', tags: ['create', 'conversation'] },
  { slug: 'switch_provider', label: 'Switch Provider', description: 'Switch the active LLM provider', capabilityKind: 'action', tags: ['switch', 'provider'] },
  { slug: 'list_conversations', label: 'List Conversations', description: 'List all available conversations', capabilityKind: 'query', tags: ['list', 'conversation'] },
  { slug: 'search_messages', label: 'Search Messages', description: 'Search messages across conversations', capabilityKind: 'query', tags: ['search', 'message'] },
  { slug: 'attach_file', label: 'Attach File', description: 'Attach a file to the current message', capabilityKind: 'action', tags: ['attach', 'file'] },
  { slug: 'edit_message', label: 'Edit Message', description: 'Edit a previously sent message', capabilityKind: 'action', tags: ['edit', 'message'] },
  { slug: 'delete_message', label: 'Delete Message', description: 'Delete a message from the conversation', capabilityKind: 'action', tags: ['delete', 'message'] },
  { slug: 'copy_message', label: 'Copy Message', description: 'Copy message content to clipboard', capabilityKind: 'action', tags: ['copy', 'message'] },
  { slug: 'regenerate_response', label: 'Regenerate Response', description: 'Regenerate the last assistant response', capabilityKind: 'action', tags: ['regenerate', 'response'] },
  { slug: 'stop_generation', label: 'Stop Generation', description: 'Stop an in-progress response generation', capabilityKind: 'action', tags: ['stop', 'generation'] },
  { slug: 'toggle_sidebar', label: 'Toggle Sidebar', description: 'Show or hide the sidebar', capabilityKind: 'action', tags: ['toggle', 'sidebar'] },
  { slug: 'clear_conversation', label: 'Clear Conversation', description: 'Clear all messages in the current conversation', capabilityKind: 'action', tags: ['clear', 'conversation'] },
  { slug: 'export_conversation', label: 'Export Conversation', description: 'Export conversation to file', capabilityKind: 'action', tags: ['export', 'conversation'] },
  { slug: 'rename_conversation', label: 'Rename Conversation', description: 'Rename the current conversation', capabilityKind: 'action', tags: ['rename', 'conversation'] },
  { slug: 'archive_conversation', label: 'Archive Conversation', description: 'Archive a conversation', capabilityKind: 'action', tags: ['archive', 'conversation'] },
  { slug: 'pin_conversation', label: 'Pin Conversation', description: 'Pin a conversation to the top', capabilityKind: 'action', tags: ['pin', 'conversation'] },
  { slug: 'voice_input', label: 'Voice Input', description: 'Capture voice input via microphone', capabilityKind: 'action', tags: ['voice', 'input'] },
  { slug: 'image_generate', label: 'Image Generate', description: 'Generate an image from a text prompt', capabilityKind: 'action', tags: ['image', 'generate'] },
  { slug: 'code_execute', label: 'Code Execute', description: 'Execute code in a sandboxed environment', capabilityKind: 'action', tags: ['code', 'execute'] },
  { slug: 'web_search', label: 'Web Search', description: 'Search the web for information', capabilityKind: 'action', tags: ['web', 'search'] },
  { slug: 'canvas_set_background', label: 'Canvas Set Background', description: 'Set the canvas background', capabilityKind: 'action', tags: ['canvas', 'background'] },
  { slug: 'canvas_add_layer', label: 'Canvas Add Layer', description: 'Add a new layer to the canvas', capabilityKind: 'action', tags: ['canvas', 'layer'] },
  { slug: 'canvas_remove_layer', label: 'Canvas Remove Layer', description: 'Remove a layer from the canvas', capabilityKind: 'action', tags: ['canvas', 'layer'] },
  { slug: 'canvas_set_layout', label: 'Canvas Set Layout', description: 'Set the canvas layout mode', capabilityKind: 'action', tags: ['canvas', 'layout'] },
  { slug: 'canvas_set_theme', label: 'Canvas Set Theme', description: 'Set the canvas visual theme', capabilityKind: 'action', tags: ['canvas', 'theme'] },
  { slug: 'channel_add', label: 'Channel Add', description: 'Add a new channel', capabilityKind: 'action', tags: ['channel', 'add'] },
  { slug: 'channel_connect', label: 'Channel Connect', description: 'Connect to a channel', capabilityKind: 'action', tags: ['channel', 'connect'] },
  { slug: 'channel_list', label: 'Channel List', description: 'List available channels', capabilityKind: 'query', tags: ['channel', 'list'] },
  { slug: 'channel_remove', label: 'Channel Remove', description: 'Remove a channel', capabilityKind: 'action', tags: ['channel', 'remove'] },
  { slug: 'session_load', label: 'Session Load', description: 'Load a saved session', capabilityKind: 'action', tags: ['session', 'load'] },
  { slug: 'session_start', label: 'Session Start', description: 'Start a new session', capabilityKind: 'action', tags: ['session', 'start'] },
  { slug: 'session_list', label: 'Session List', description: 'List all sessions', capabilityKind: 'query', tags: ['session', 'list'] },
  { slug: 'memory_recall', label: 'Memory Recall', description: 'Recall stored memories', capabilityKind: 'query', tags: ['memory', 'recall'] },
  { slug: 'memory_store', label: 'Memory Store', description: 'Store information in memory', capabilityKind: 'action', tags: ['memory', 'store'] },
  { slug: 'system_health', label: 'System Health', description: 'Check system health status', capabilityKind: 'query', tags: ['system', 'health'] },
  { slug: 'system_providers', label: 'System Providers', description: 'List available providers', capabilityKind: 'query', tags: ['system', 'providers'] },
  { slug: 'system_fleet', label: 'System Fleet', description: 'View system fleet status', capabilityKind: 'query', tags: ['system', 'fleet'] },
  { slug: 'system_capabilities', label: 'System Capabilities', description: 'List all registered capabilities', capabilityKind: 'query', tags: ['system', 'capabilities'] },
  { slug: 'system_version', label: 'System Version', description: 'Get system version info', capabilityKind: 'query', tags: ['system', 'version'] },
  { slug: 'system_workspace', label: 'System Workspace', description: 'Get workspace information', capabilityKind: 'query', tags: ['system', 'workspace'] },
  { slug: 'help', label: 'Help', description: 'Get help information', capabilityKind: 'query', tags: ['help', 'info'] },
  { slug: 'workflow_newsletter', label: 'Workflow Newsletter', description: 'Generate a newsletter', capabilityKind: 'action', tags: ['workflow', 'newsletter'] },
  { slug: 'schedule_register', label: 'Schedule Register', description: 'Register a scheduled task', capabilityKind: 'action', tags: ['schedule', 'register'] },
  { slug: 'browser_navigate', label: 'Browser Navigate', description: 'Navigate the browser to a URL', capabilityKind: 'action', tags: ['browser', 'navigate'] },
  { slug: 'browser_search', label: 'Browser Search', description: 'Search via browser', capabilityKind: 'action', tags: ['browser', 'search'] },
  { slug: 'browser_screenshot', label: 'Browser Screenshot', description: 'Take a browser screenshot', capabilityKind: 'action', tags: ['browser', 'screenshot'] },
  { slug: 'browser_extract', label: 'Browser Extract', description: 'Extract content from a web page', capabilityKind: 'query', tags: ['browser', 'extract'] },
  { slug: 'file_open', label: 'File Open', description: 'Open a file', capabilityKind: 'action', tags: ['file', 'open'] },
  { slug: 'file_list', label: 'File List', description: 'List files in a directory', capabilityKind: 'query', tags: ['file', 'list'] },
  { slug: 'file_search', label: 'File Search', description: 'Search for files', capabilityKind: 'query', tags: ['file', 'search'] },
  { slug: 'file_create', label: 'File Create', description: 'Create a new file', capabilityKind: 'action', tags: ['file', 'create'] },
  { slug: 'file_read', label: 'File Read', description: 'Read file contents', capabilityKind: 'query', tags: ['file', 'read'] },
  { slug: 'email_send', label: 'Email Send', description: 'Send an email', capabilityKind: 'action', tags: ['email', 'send'] },
  { slug: 'llm_ask', label: 'LLM Ask', description: 'Ask an LLM a question', capabilityKind: 'action', tags: ['llm', 'ask'] },
  { slug: 'llm_summarize', label: 'LLM Summarize', description: 'Summarize content with an LLM', capabilityKind: 'action', tags: ['llm', 'summarize'] },
  { slug: 'llm_translate', label: 'LLM Translate', description: 'Translate text with an LLM', capabilityKind: 'action', tags: ['llm', 'translate'] },
  { slug: 'llm_explain', label: 'LLM Explain', description: 'Explain content with an LLM', capabilityKind: 'action', tags: ['llm', 'explain'] },
  { slug: 'llm_rewrite', label: 'LLM Rewrite', description: 'Rewrite content with an LLM', capabilityKind: 'action', tags: ['llm', 'rewrite'] },
  { slug: 'llm_code', label: 'LLM Code', description: 'Generate code with an LLM', capabilityKind: 'action', tags: ['llm', 'code'] },
  { slug: 'app_launch', label: 'App Launch', description: 'Launch an application', capabilityKind: 'action', tags: ['app', 'launch'] },
  { slug: 'web_query', label: 'Web Query', description: 'Query the web for data', capabilityKind: 'query', tags: ['web', 'query'] },
  { slug: 'web_summarize', label: 'Web Summarize', description: 'Summarize a web page', capabilityKind: 'action', tags: ['web', 'summarize'] },

  // ═══ NEW CAPABILITIES (150+ new) ═══

  // ── ecommerce capabilities ──
  { slug: 'product_search', label: 'Product Search', description: 'Search for products across platforms', capabilityKind: 'query', tags: ['product', 'search'] },
  { slug: 'product_detail', label: 'Product Detail', description: 'Get detailed product information', capabilityKind: 'query', tags: ['product', 'detail'] },
  { slug: 'cart_add', label: 'Cart Add', description: 'Add item to shopping cart', capabilityKind: 'action', tags: ['cart', 'add'] },
  { slug: 'cart_remove', label: 'Cart Remove', description: 'Remove item from cart', capabilityKind: 'action', tags: ['cart', 'remove'] },
  { slug: 'cart_view', label: 'Cart View', description: 'View shopping cart contents', capabilityKind: 'query', tags: ['cart', 'view'] },
  { slug: 'order_place', label: 'Order Place', description: 'Place an order', capabilityKind: 'action', tags: ['order', 'place'] },
  { slug: 'order_track', label: 'Order Track', description: 'Track order status', capabilityKind: 'query', tags: ['order', 'track'] },
  { slug: 'review_submit', label: 'Review Submit', description: 'Submit a product review', capabilityKind: 'action', tags: ['review', 'submit'] },
  { slug: 'price_compare', label: 'Price Compare', description: 'Compare prices across sellers', capabilityKind: 'query', tags: ['price', 'compare'] },
  { slug: 'wishlist_add', label: 'Wishlist Add', description: 'Add item to wishlist', capabilityKind: 'action', tags: ['wishlist', 'add'] },

  // ── finance capabilities ──
  { slug: 'portfolio_view', label: 'Portfolio View', description: 'View investment portfolio', capabilityKind: 'query', tags: ['portfolio', 'view'] },
  { slug: 'trade_execute', label: 'Trade Execute', description: 'Execute a trade', capabilityKind: 'action', tags: ['trade', 'execute'] },
  { slug: 'balance_check', label: 'Balance Check', description: 'Check account balance', capabilityKind: 'query', tags: ['balance', 'check'] },
  { slug: 'transaction_list', label: 'Transaction List', description: 'List recent transactions', capabilityKind: 'query', tags: ['transaction', 'list'] },
  { slug: 'transfer_funds', label: 'Transfer Funds', description: 'Transfer funds between accounts', capabilityKind: 'action', tags: ['transfer', 'funds'] },
  { slug: 'invoice_create', label: 'Invoice Create', description: 'Create an invoice', capabilityKind: 'action', tags: ['invoice', 'create'] },
  { slug: 'expense_track', label: 'Expense Track', description: 'Track expenses', capabilityKind: 'action', tags: ['expense', 'track'] },
  { slug: 'budget_set', label: 'Budget Set', description: 'Set a budget', capabilityKind: 'action', tags: ['budget', 'set'] },

  // ── education capabilities ──
  { slug: 'course_enroll', label: 'Course Enroll', description: 'Enroll in a course', capabilityKind: 'action', tags: ['course', 'enroll'] },
  { slug: 'lesson_complete', label: 'Lesson Complete', description: 'Mark lesson as complete', capabilityKind: 'action', tags: ['lesson', 'complete'] },
  { slug: 'quiz_take', label: 'Quiz Take', description: 'Take a quiz', capabilityKind: 'action', tags: ['quiz', 'take'] },
  { slug: 'flashcard_review', label: 'Flashcard Review', description: 'Review flashcards', capabilityKind: 'action', tags: ['flashcard', 'review'] },
  { slug: 'progress_track', label: 'Progress Track', description: 'Track learning progress', capabilityKind: 'query', tags: ['progress', 'track'] },
  { slug: 'certificate_earn', label: 'Certificate Earn', description: 'Earn a course certificate', capabilityKind: 'action', tags: ['certificate', 'earn'] },
  { slug: 'note_create', label: 'Note Create', description: 'Create study notes', capabilityKind: 'action', tags: ['note', 'create'] },
  { slug: 'schedule_class', label: 'Schedule Class', description: 'Schedule a class session', capabilityKind: 'action', tags: ['schedule', 'class'] },

  // ── healthcare capabilities ──
  { slug: 'appointment_book', label: 'Appointment Book', description: 'Book a medical appointment', capabilityKind: 'action', tags: ['appointment', 'book'] },
  { slug: 'appointment_cancel', label: 'Appointment Cancel', description: 'Cancel a medical appointment', capabilityKind: 'action', tags: ['appointment', 'cancel'] },
  { slug: 'prescription_refill', label: 'Prescription Refill', description: 'Refill a prescription', capabilityKind: 'action', tags: ['prescription', 'refill'] },
  { slug: 'symptom_check', label: 'Symptom Check', description: 'Check symptoms', capabilityKind: 'query', tags: ['symptom', 'check'] },
  { slug: 'health_metric_log', label: 'Health Metric Log', description: 'Log health metrics', capabilityKind: 'action', tags: ['health', 'metric'] },
  { slug: 'doctor_message', label: 'Doctor Message', description: 'Message a doctor', capabilityKind: 'action', tags: ['doctor', 'message'] },
  { slug: 'record_view', label: 'Record View', description: 'View medical records', capabilityKind: 'query', tags: ['record', 'view'] },

  // ── gaming capabilities ──
  { slug: 'game_launch', label: 'Game Launch', description: 'Launch a game', capabilityKind: 'action', tags: ['game', 'launch'] },
  { slug: 'game_purchase', label: 'Game Purchase', description: 'Purchase a game', capabilityKind: 'action', tags: ['game', 'purchase'] },
  { slug: 'game_invite', label: 'Game Invite', description: 'Invite friend to game', capabilityKind: 'action', tags: ['game', 'invite'] },
  { slug: 'game_chat', label: 'Game Chat', description: 'Chat during gameplay', capabilityKind: 'action', tags: ['game', 'chat'] },
  { slug: 'game_clip', label: 'Game Clip', description: 'Record game clip', capabilityKind: 'action', tags: ['game', 'clip'] },
  { slug: 'stream_watch', label: 'Stream Watch', description: 'Watch a game stream', capabilityKind: 'action', tags: ['stream', 'watch'] },

  // ── media capabilities ──
  { slug: 'media_play', label: 'Media Play', description: 'Play media content', capabilityKind: 'action', tags: ['media', 'play'] },
  { slug: 'media_pause', label: 'Media Pause', description: 'Pause media playback', capabilityKind: 'action', tags: ['media', 'pause'] },
  { slug: 'media_skip', label: 'Media Skip', description: 'Skip to next track', capabilityKind: 'action', tags: ['media', 'skip'] },
  { slug: 'playlist_create', label: 'Playlist Create', description: 'Create a new playlist', capabilityKind: 'action', tags: ['playlist', 'create'] },
  { slug: 'playlist_add', label: 'Playlist Add', description: 'Add to playlist', capabilityKind: 'action', tags: ['playlist', 'add'] },
  { slug: 'media_download', label: 'Media Download', description: 'Download media for offline', capabilityKind: 'action', tags: ['media', 'download'] },
  { slug: 'media_share', label: 'Media Share', description: 'Share media content', capabilityKind: 'action', tags: ['media', 'share'] },
  { slug: 'subscribe_channel', label: 'Subscribe Channel', description: 'Subscribe to a channel', capabilityKind: 'action', tags: ['subscribe', 'channel'] },

  // ── travel capabilities ──
  { slug: 'flight_search', label: 'Flight Search', description: 'Search for flights', capabilityKind: 'query', tags: ['flight', 'search'] },
  { slug: 'hotel_search', label: 'Hotel Search', description: 'Search for hotels', capabilityKind: 'query', tags: ['hotel', 'search'] },
  { slug: 'booking_reserve', label: 'Booking Reserve', description: 'Reserve a booking', capabilityKind: 'action', tags: ['booking', 'reserve'] },
  { slug: 'booking_cancel', label: 'Booking Cancel', description: 'Cancel a booking', capabilityKind: 'action', tags: ['booking', 'cancel'] },
  { slug: 'review_write', label: 'Review Write', description: 'Write a travel review', capabilityKind: 'action', tags: ['review', 'write'] },
  { slug: 'itinerary_plan', label: 'Itinerary Plan', description: 'Plan a travel itinerary', capabilityKind: 'action', tags: ['itinerary', 'plan'] },

  // ── cloud_devops capabilities ──
  { slug: 'repo_clone', label: 'Repo Clone', description: 'Clone a repository', capabilityKind: 'action', tags: ['repo', 'clone'] },
  { slug: 'pr_create', label: 'PR Create', description: 'Create a pull request', capabilityKind: 'action', tags: ['pr', 'create'] },
  { slug: 'pr_merge', label: 'PR Merge', description: 'Merge a pull request', capabilityKind: 'action', tags: ['pr', 'merge'] },
  { slug: 'ci_status', label: 'CI Status', description: 'Check CI/CD status', capabilityKind: 'query', tags: ['ci', 'status'] },
  { slug: 'deploy_trigger', label: 'Deploy Trigger', description: 'Trigger a deployment', capabilityKind: 'action', tags: ['deploy', 'trigger'] },
  { slug: 'deploy_rollback', label: 'Deploy Rollback', description: 'Rollback a deployment', capabilityKind: 'action', tags: ['deploy', 'rollback'] },
  { slug: 'log_view', label: 'Log View', description: 'View deployment logs', capabilityKind: 'query', tags: ['log', 'view'] },
  { slug: 'env_var_set', label: 'Env Var Set', description: 'Set environment variable', capabilityKind: 'action', tags: ['env', 'set'] },
  { slug: 'container_start', label: 'Container Start', description: 'Start a container', capabilityKind: 'action', tags: ['container', 'start'] },
  { slug: 'container_stop', label: 'Container Stop', description: 'Stop a container', capabilityKind: 'action', tags: ['container', 'stop'] },

  // ── design capabilities ──
  { slug: 'design_create', label: 'Design Create', description: 'Create a new design file', capabilityKind: 'action', tags: ['design', 'create'] },
  { slug: 'design_export', label: 'Design Export', description: 'Export design to file', capabilityKind: 'action', tags: ['design', 'export'] },
  { slug: 'design_share', label: 'Design Share', description: 'Share design for collaboration', capabilityKind: 'action', tags: ['design', 'share'] },
  { slug: 'design_comment', label: 'Design Comment', description: 'Comment on a design', capabilityKind: 'action', tags: ['design', 'comment'] },
  { slug: 'prototype_create', label: 'Prototype Create', description: 'Create an interactive prototype', capabilityKind: 'action', tags: ['prototype', 'create'] },
  { slug: 'component_library', label: 'Component Library', description: 'Access design component library', capabilityKind: 'query', tags: ['component', 'library'] },

  // ── crm capabilities ──
  { slug: 'lead_create', label: 'Lead Create', description: 'Create a new lead', capabilityKind: 'action', tags: ['lead', 'create'] },
  { slug: 'lead_update', label: 'Lead Update', description: 'Update lead information', capabilityKind: 'action', tags: ['lead', 'update'] },
  { slug: 'deal_create', label: 'Deal Create', description: 'Create a new deal', capabilityKind: 'action', tags: ['deal', 'create'] },
  { slug: 'deal_stage_move', label: 'Deal Stage Move', description: 'Move deal to next stage', capabilityKind: 'action', tags: ['deal', 'stage'] },
  { slug: 'contact_import', label: 'Contact Import', description: 'Import contacts from CSV', capabilityKind: 'action', tags: ['contact', 'import'] },
  { slug: 'report_generate', label: 'Report Generate', description: 'Generate a CRM report', capabilityKind: 'action', tags: ['report', 'generate'] },
  { slug: 'pipeline_view', label: 'Pipeline View', description: 'View sales pipeline', capabilityKind: 'query', tags: ['pipeline', 'view'] },
  { slug: 'activity_log', label: 'Activity Log', description: 'View activity log', capabilityKind: 'query', tags: ['activity', 'log'] },

  // ── analytics capabilities ──
  { slug: 'dashboard_view', label: 'Dashboard View', description: 'View analytics dashboard', capabilityKind: 'query', tags: ['dashboard', 'view'] },
  { slug: 'report_create', label: 'Report Create', description: 'Create an analytics report', capabilityKind: 'action', tags: ['report', 'create'] },
  { slug: 'metric_track', label: 'Metric Track', description: 'Track custom metrics', capabilityKind: 'action', tags: ['metric', 'track'] },
  { slug: 'funnel_analyze', label: 'Funnel Analyze', description: 'Analyze conversion funnel', capabilityKind: 'query', tags: ['funnel', 'analyze'] },
  { slug: 'event_track', label: 'Event Track', description: 'Track user events', capabilityKind: 'action', tags: ['event', 'track'] },
  { slug: 'ab_test', label: 'AB Test', description: 'Run A/B test', capabilityKind: 'action', tags: ['ab', 'test'] },

  // ── docs_wiki capabilities ──
  { slug: 'doc_create', label: 'Doc Create', description: 'Create a new document', capabilityKind: 'action', tags: ['doc', 'create'] },
  { slug: 'doc_edit', label: 'Doc Edit', description: 'Edit a document', capabilityKind: 'action', tags: ['doc', 'edit'] },
  { slug: 'doc_comment', label: 'Doc Comment', description: 'Comment on a document', capabilityKind: 'action', tags: ['doc', 'comment'] },
  { slug: 'doc_publish', label: 'Doc Publish', description: 'Publish a document', capabilityKind: 'action', tags: ['doc', 'publish'] },
  { slug: 'wiki_search', label: 'Wiki Search', description: 'Search the wiki', capabilityKind: 'query', tags: ['wiki', 'search'] },
  { slug: 'template_use', label: 'Template Use', description: 'Use a document template', capabilityKind: 'action', tags: ['template', 'use'] },

  // ── email capabilities ──
  { slug: 'email_compose', label: 'Email Compose', description: 'Compose a new email', capabilityKind: 'action', tags: ['email', 'compose'] },
  { slug: 'email_reply', label: 'Email Reply', description: 'Reply to an email', capabilityKind: 'action', tags: ['email', 'reply'] },
  { slug: 'email_forward', label: 'Email Forward', description: 'Forward an email', capabilityKind: 'action', tags: ['email', 'forward'] },
  { slug: 'email_archive', label: 'Email Archive', description: 'Archive an email', capabilityKind: 'action', tags: ['email', 'archive'] },
  { slug: 'email_label', label: 'Email Label', description: 'Label/categorize an email', capabilityKind: 'action', tags: ['email', 'label'] },
  { slug: 'email_search', label: 'Email Search', description: 'Search emails', capabilityKind: 'query', tags: ['email', 'search'] },

  // ── calendar capabilities ──
  { slug: 'event_create', label: 'Event Create', description: 'Create a calendar event', capabilityKind: 'action', tags: ['event', 'create'] },
  { slug: 'event_update', label: 'Event Update', description: 'Update a calendar event', capabilityKind: 'action', tags: ['event', 'update'] },
  { slug: 'event_delete', label: 'Event Delete', description: 'Delete a calendar event', capabilityKind: 'action', tags: ['event', 'delete'] },
  { slug: 'availability_check', label: 'Availability Check', description: 'Check availability', capabilityKind: 'query', tags: ['availability', 'check'] },
  { slug: 'meeting_schedule', label: 'Meeting Schedule', description: 'Schedule a meeting', capabilityKind: 'action', tags: ['meeting', 'schedule'] },
  { slug: 'reminder_set', label: 'Reminder Set', description: 'Set a reminder', capabilityKind: 'action', tags: ['reminder', 'set'] },

  // ── social capabilities ──
  { slug: 'post_create', label: 'Post Create', description: 'Create a social post', capabilityKind: 'action', tags: ['post', 'create'] },
  { slug: 'post_like', label: 'Post Like', description: 'Like a social post', capabilityKind: 'action', tags: ['post', 'like'] },
  { slug: 'post_comment', label: 'Post Comment', description: 'Comment on a social post', capabilityKind: 'action', tags: ['post', 'comment'] },
  { slug: 'post_share', label: 'Post Share', description: 'Share a social post', capabilityKind: 'action', tags: ['post', 'share'] },
  { slug: 'post_bookmark', label: 'Post Bookmark', description: 'Bookmark a social post', capabilityKind: 'action', tags: ['post', 'bookmark'] },
  { slug: 'feed_scroll', label: 'Feed Scroll', description: 'Scroll through the feed', capabilityKind: 'action', tags: ['feed', 'scroll'] },
  { slug: 'profile_update', label: 'Profile Update', description: 'Update user profile', capabilityKind: 'action', tags: ['profile', 'update'] },
  { slug: 'follower_follow', label: 'Follower Follow', description: 'Follow a user', capabilityKind: 'action', tags: ['follower', 'follow'] },
  { slug: 'follower_unfollow', label: 'Follower Unfollow', description: 'Unfollow a user', capabilityKind: 'action', tags: ['follower', 'unfollow'] },
  { slug: 'notification_manage', label: 'Notification Manage', description: 'Manage notification settings', capabilityKind: 'config', tags: ['notification', 'manage'] },

  // ── settings / config capabilities ──
  { slug: 'settings_update', label: 'Settings Update', description: 'Update application settings', capabilityKind: 'config', tags: ['settings', 'update'] },
  { slug: 'theme_change', label: 'Theme Change', description: 'Change UI theme', capabilityKind: 'config', tags: ['theme', 'change'] },
  { slug: 'language_set', label: 'Language Set', description: 'Set display language', capabilityKind: 'config', tags: ['language', 'set'] },
  { slug: 'privacy_manage', label: 'Privacy Manage', description: 'Manage privacy settings', capabilityKind: 'config', tags: ['privacy', 'manage'] },
  { slug: 'notification_preferences', label: 'Notification Preferences', description: 'Set notification preferences', capabilityKind: 'config', tags: ['notification', 'preferences'] },

  // ── collaboration capabilities ──
  { slug: 'share_workspace', label: 'Share Workspace', description: 'Share workspace with others', capabilityKind: 'action', tags: ['share', 'workspace'] },
  { slug: 'invite_member', label: 'Invite Member', description: 'Invite member to workspace', capabilityKind: 'action', tags: ['invite', 'member'] },
  { slug: 'permission_manage', label: 'Permission Manage', description: 'Manage permissions', capabilityKind: 'config', tags: ['permission', 'manage'] },
  { slug: 'comment_thread', label: 'Comment Thread', description: 'Comment on a thread', capabilityKind: 'action', tags: ['comment', 'thread'] },
  { slug: 'mention_user', label: 'Mention User', description: 'Mention a user', capabilityKind: 'action', tags: ['mention', 'user'] },

  // ── data / integration capabilities ──
  { slug: 'data_import', label: 'Data Import', description: 'Import data from external source', capabilityKind: 'action', tags: ['data', 'import'] },
  { slug: 'data_export', label: 'Data Export', description: 'Export data to file', capabilityKind: 'action', tags: ['data', 'export'] },
  { slug: 'api_call', label: 'API Call', description: 'Make an API call', capabilityKind: 'action', tags: ['api', 'call'] },
  { slug: 'webhook_set', label: 'Webhook Set', description: 'Set up a webhook', capabilityKind: 'action', tags: ['webhook', 'set'] },
  { slug: 'integration_connect', label: 'Integration Connect', description: 'Connect an integration', capabilityKind: 'action', tags: ['integration', 'connect'] },
  { slug: 'integration_disconnect', label: 'Integration Disconnect', description: 'Disconnect an integration', capabilityKind: 'action', tags: ['integration', 'disconnect'] },

  // ── search / discovery capabilities ──
  { slug: 'global_search', label: 'Global Search', description: 'Search across all content', capabilityKind: 'query', tags: ['global', 'search'] },
  { slug: 'filter_apply', label: 'Filter Apply', description: 'Apply search filters', capabilityKind: 'action', tags: ['filter', 'apply'] },
  { slug: 'sort_results', label: 'Sort Results', description: 'Sort search results', capabilityKind: 'action', tags: ['sort', 'results'] },
  { slug: 'history_view', label: 'History View', description: 'View search history', capabilityKind: 'query', tags: ['history', 'view'] },
  { slug: 'trending_view', label: 'Trending View', description: 'View trending content', capabilityKind: 'query', tags: ['trending', 'view'] },
]

// ── Execution ────────────────────────────────────────────────────────────

function mergePlatforms(existing: PlatformDef[], expansion: PlatformDef[]): PlatformDef[] {
  const seen = new Set(existing.map((p) => p.slug))
  const merged = [...existing]
  for (const p of expansion) {
    if (!seen.has(p.slug)) {
      merged.push(p)
      seen.add(p.slug)
    }
  }
  return merged
}

function mergeCapabilities(existing: CapabilityDef[], expansion: CapabilityDef[]): CapabilityDef[] {
  const seen = new Set(existing.map((c) => c.slug))
  const merged = [...existing]
  for (const c of expansion) {
    if (!seen.has(c.slug)) {
      merged.push(c)
      seen.add(c.slug)
    }
  }
  return merged
}

async function main() {
  console.log('=== 10x Expansion ===')

  // Load existing skeleton
  let existingPlatforms: { slug: string; category: string }[] = []
  if (existsSync(SKELETON_PATH)) {
    const doc = JSON.parse(readFileSync(SKELETON_PATH, 'utf-8')) as { platforms?: { slug: string; category: string }[] }
    existingPlatforms = doc.platforms ?? []
  }
  console.log(`  Existing platforms: ${existingPlatforms.length}`)

  // Merge
  const allPlatforms = mergePlatforms(existingPlatforms, PLATFORMS_10X)
  console.log(`  After merge: ${allPlatforms.length} platforms`)

  // Count by category
  const byCat = new Map<string, number>()
  for (const p of allPlatforms) byCat.set(p.category, (byCat.get(p.category) ?? 0) + 1)
  console.log(`  Categories: ${byCat.size}`)
  for (const [cat, count] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat}: ${count}`)
  }

  // Write skeleton
  if (!existsSync(join(SKELETON_PATH, '..'))) mkdirSync(join(SKELETON_PATH, '..'), { recursive: true })
  writeFileSync(SKELETON_PATH, JSON.stringify({ platforms: allPlatforms }, null, 2))
  console.log(`  ✅ Written skeleton → ${SKELETON_PATH}`)

  // Load existing shared pool capabilities
  let existingCaps: CapabilityDef[] = []
  if (existsSync(SHARED_RAW_PATH)) {
    const raw = JSON.parse(readFileSync(SHARED_RAW_PATH, 'utf-8')) as { capabilities?: CapabilityDef[] }
    existingCaps = raw.capabilities ?? []
  } else if (existsSync(SHARED_POOL_PATH)) {
    const pool = JSON.parse(readFileSync(SHARED_POOL_PATH, 'utf-8')) as { nodes?: { slug: string; label: string; description: string; capabilityKind: string; tags: string[] }[] }
    existingCaps = (pool.nodes ?? [])
      .filter((n) => n.slug && n.label)
      .map((n) => ({
        slug: n.slug,
        label: n.label,
        description: n.description,
        capabilityKind: n.capabilityKind as CapabilityDef['capabilityKind'],
        tags: n.tags ?? [],
      }))
  }
  console.log(`  Existing capabilities: ${existingCaps.length}`)

  // Merge capabilities
  const allCaps = mergeCapabilities(existingCaps, CAPABILITIES_10X)
  console.log(`  After merge: ${allCaps.length} capabilities`)

  // Write shared raw
  if (!existsSync(join(SHARED_RAW_PATH, '..'))) mkdirSync(join(SHARED_RAW_PATH, '..'), { recursive: true })
  writeFileSync(SHARED_RAW_PATH, JSON.stringify({ capabilities: allCaps }, null, 2))
  console.log(`  ✅ Written shared raw → ${SHARED_RAW_PATH}`)

  console.log('')
  console.log('Next steps:')
  console.log('  1. bun run taxonomy-gen merge')
  console.log('  2. bun run devops verify-cross-surface')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
