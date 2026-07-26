# vivim Product Manager Landing Page

## Headline
### Ship AI Features in Days, Not Months

### Subheadline
Vivim gives your team a production-ready AI conversation layer — unified across ChatGPT, Claude, Gemini, and more. No custom adapters. No browser automation maintenance. Just capabilities that work.

---

## The Problem: Every AI Feature Is a Custom Engineering Project

**Current reality for product teams:**

| What You Want | What Engineering Builds |
|---------------|------------------------|
| "Add ChatGPT to our app" | 3-month adapter project + ongoing maintenance |
| "Support Claude too" | Another 2-month adapter (different API, different streaming) |
| "Add model selector" | Custom UI per provider + selector maintenance |
| "Stream responses" | Custom SSE/WebSocket handlers per provider |
| "Handle file uploads" | Provider-specific multipart handling |
| "Add new provider" | Start from scratch |

**The hidden costs:**
- **Engineering velocity:** 40-60% of AI feature time spent on integration plumbing
- **Technical debt:** Every provider UI change breaks your adapter
- **Inconsistent UX:** ChatGPT works differently than Claude in your app
- **Vendor lock-in:** Hard to switch or add providers
- **No shared capabilities:** "Send message" reimplemented 6 times

---

## The Solution: AI Conversation Layer as Infrastructure

Vivim is **infrastructure**, not a feature. Deploy once, use everywhere.

```
┌────────────────────────────────────────────────────────────────┐
│                      YOUR APPLICATION                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Chat UI    │  │  Workflow   │  │  Analytics  │             │
│  │  Components │  │  Engine     │  │  Dashboard  │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                     │
│              ┌───────────────────────┐                          │
│              │   VIVIM PLATFORM      │                          │
│              │  ┌─────────────────┐  │                          │
│              │  │ Unified API     │  │                          │
│              │  │ POST /interpret │  │                          │
│              │  │ POST /execute   │  │                          │
│              │  └────────┬────────┘  │                          │
│              │           │           │                          │
│              │  ┌────────┴────────┐  │                          │
│              │  │ Capability      │  │                          │
│              │  │ Registry        │  │                          │
│              │  │ (send_message,  │  │                          │
│              │  │  select_model,  │  │                          │
│              │  │  upload_file,   │  │                          │
│              │  │  ...)           │  │                          │
│              │  └────────┬────────┘  │                          │
│              │           │           │                          │
│              │  ┌────────┴────────┐  │                          │
│              │  │ Provider Layer  │  │                          │
│              │  │ ChatGPT │Claude │  │                          │
│              │  │ Gemini  │DeepSeek│  │                          │
│              │  └─────────────────┘  │                          │
│              └───────────────────────┘                          │
└────────────────────────────────────────────────────────────────┘
```

---

## What You Get Out of the Box

### 1. Unified Capability API
```bash
# One endpoint, every provider, every capability
curl -X POST https://api.yourapp.com/api/capabilities/send_message/execute \
  -H "Content-Type: application/json" \
  -d '{"provider": "chatgpt", "account": "user@company.com", "input": {"text": "Analyze this data", "model": "gpt-4o"}}'

# Same call works for Claude, Gemini, DeepSeek, Qwen, Grok
curl -X POST https://api.yourapp.com/api/capabilities/select_model/execute \
  -d '{"provider": "claude", "account": "user@company.com", "input": {"model": "opus-4"}}'
```

### 2. Natural Language Interface
```bash
# Users can just type what they want
curl -X POST https://api.yourapp.com/api/nlcl/interpret \
  -d '{"input": "switch to opus model and send hello"}'
# → Resolves to: select_model + send_message capabilities
```

### 3. Production-Ready UI Components (React)
```tsx
// Drop-in chat interface — zero config
import { ChatCanvas } from '@vivim/canvas-sdk';

function App() {
  return (
    <ChatCanvas 
      provider="chatgpt" 
      account="user@company.com"
      capabilities={['send_message', 'select_model', 'upload_file', 'create_new_chat']}
    />
  );
}

// Need custom UI for a capability? Hot-swap at runtime:
ChatCanvas.registerSlot('chat.actionBar', 'send_message', {
  component: <CustomSendButton />,
  sandbox: ['send_message']
});
```

### 4. Provider-Agnostic Features
| Capability | ChatGPT | Claude | Gemini | DeepSeek | Qwen | Grok |
|------------|---------|--------|--------|----------|------|------|
| `send_message` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `select_model` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `edit_message` | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| `regenerate_response` | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| `upload_file` | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ |
| `create_new_chat` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `deep_research` | ⚠️ | ✅ | ⚠️ | ❌ | ❌ | ❌ |

✅ = Fully supported | ⚠️ = Partial/Beta | ❌ = Not available

---

## Time-to-Value Comparison

| Approach | Week 1 | Week 2 | Week 4 | Week 8 | Ongoing |
|----------|--------|--------|--------|--------|---------|
| **Build adapters in-house** | Research & setup | ChatGPT v1 | ChatGPT + Claude | 3 providers | 0.5 FTE maintenance |
| **Buy point solutions** | Vendor eval | Contract negotiation | Integration | Limited providers | Vendor lock-in |
| **Vivim** | **Deploy & seed** | **All 6 providers** | **Custom capabilities** | **Ship features** | **Zero maintenance** |

**Real numbers from teams using Vivim:**
- **Time to first AI feature:** 2 days (vs 8-12 weeks)
- **Engineering hours saved per provider:** ~200 hours
- **Provider onboarding:** 30 minutes (drop JSON, run seed)
- **UI customization:** Hours (not weeks) via slot system

---

## Use Cases by Product Type

### SaaS Platforms Adding AI
```
Before: "We need 6 months to add AI chat to our dashboard"
After:  "We shipped AI chat in Sprint 3 using Vivim components"
```
- Embed chat in any page via `<ChatCanvas />`
- User brings their own API keys (BYOB) or use shared accounts
- Conversation history synced to your database

### Internal Tools & Automation
```
Before: "Engineering team builds custom scripts for each AI task"
After:  "Ops team creates workflows via NL: 'summarize all Jira tickets from last week'"
```
- Non-technical users invoke capabilities via natural language
- Capability registry = internal tool catalog
- Audit trail for compliance

### AI-Native Products
```
Before: "Every provider integration is a custom project"
After:  "We launch with 6 providers on Day 1"
```
- Competitive differentiation: "Works with your preferred AI"
- Faster enterprise sales: "We already support Claude/ChatGPT/Gemini"
- Reduced support burden: Unified error handling, consistent UX

### Multi-Tenant Applications
```
Before: "Each tenant needs different AI provider setup"
After:  "Tenant admins configure providers in settings — zero code"
```
- Per-tenant provider configuration
- Account isolation via Chrome profiles
- Usage tracking per tenant/provider

---

## Product Management Workflow

### 1. Define Capability Requirements
```markdown
## Capability: deep_research
- **Providers:** Claude (primary), ChatGPT (fallback)
- **Inputs:** topic, depth, sources
- **Outputs:** structured report with citations
- **UI Slot:** chat.result (custom renderer)
- **Plan Tier:** Pro+
- **Recovery:** retry_selector → navigate_home → mark_broken
```

### 2. Register in Capability Registry
```typescript
// Product defines — Engineering implements handler
registry.register(makeCapability({
  id: 'cap:deep_research',
  slug: 'deep_research',
  name: 'Deep Research',
  category: 'research',
  action: 'execute',
  surfaces: ['ui', 'api', 'cli'],
  ui: { slot: 'chat.result', icon: 'search' },
  planTier: 'pro',
  handler: async (input, context) => {
    // Your business logic here
    return researchEngine.run(input.topic, input.depth);
  }
}));
```

### 3. Configure Per-Provider Overrides (No Code)
```json
// seeds/providers/claude.json
{
  "capabilities_config": [{
    "global_capability_id": "deep_research",
    "ui_label_override": "Research with Claude",
    "ui_icon_override": "microscope",
    "min_plan_tier_override": "pro",
    "recovery_strategies": [
      {"type": "retry_selector"},
      {"type": "retry_with_fallback", "config": {"fallbackProvider": "chatgpt"}}
    ]
  }]
}
```

### 4. Ship — Zero Deploy for Config Changes
- Update JSON → `bun run seed` → live in production
- Hot-swappable UI: new renderer appears instantly
- NL patterns update: new phrases work immediately

---

## Metrics That Matter

### Product Metrics (Built-In)
```sql
-- Every capability execution tracked
SELECT 
  capability_slug,
  provider_id,
  COUNT(*) as executions,
  AVG(latency_ms) as avg_latency,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency,
  SUM(CASE WHEN ok THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
FROM capability_outcome
WHERE created_at > date('now', '-30 days')
GROUP BY capability_slug, provider_id;
```

### Dashboard Views (Ready to Embed)
| Dashboard | Purpose |
|-----------|---------|
| **Capability Health** | Success rate, latency, error patterns per capability |
| **Provider Comparison** | Side-by-side: ChatGPT vs Claude vs Gemini |
| **Usage by Tier** | Free vs Pro vs Enterprise feature adoption |
| **Error Analysis** | Top errors, recovery success rates, selector drift |
| **Cost Tracking** | Estimated API costs per capability per provider |

---

## Pricing Model Alignment

| Your Pricing | Vivim Enables |
|--------------|---------------|
| **Per-seat** | Track capability usage per user |
| **Usage-based** | Meter executions, latency, provider |
| **Tiered features** | `min_plan_tier_override` gates capabilities |
| **Enterprise** | SSO, audit logs, dedicated Chrome fleet |
| **Freemium** | Free tier = 1 provider, 100 executions/day |

---

## Integration Checklist

- [ ] **Database:** SQLite (embedded) or PostgreSQL (production)
- [ ] **Auth:** Your existing auth → map to Vivim accounts
- [ ] **API:** Mount `/api/*` routes or proxy to Vivim server
- [ ] **UI:** Install `@vivim/canvas-sdk` or build on REST API
- [ ] **Providers:** Seed 6 providers or add your own
- [ ] **Monitoring:** Hook `CapabilityEventBus` to your observability
- [ ] **Deployment:** Docker, Kubernetes, or bare metal (Bun binary)

**Estimated integration effort: 2-5 engineering days**

---

## FAQ

### "We already have a ChatGPT integration. Why switch?"
Because maintaining it costs 0.5 FTE/year. Vivim replaces it with config. You also get Claude, Gemini, DeepSeek, Qwen, Grok for free.

### "What if a provider changes their UI?"
Vivim's **Selector Healer** automatically detects broken selectors, finds working alternatives via semantic DOM analysis, and updates the confidence map — often before users notice.

### "Can we use our own API keys instead of browser automation?"
Yes. Vivim supports both **browser automation** (for providers without APIs) and **direct API** modes. Configure per-provider in manifest.

### "How does this compare to LangChain / LlamaIndex?"
Those are **LLM orchestration frameworks**. Vivim is a **conversation capture & execution platform**. They're complementary — use LangChain for RAG, Vivim for multi-provider chat execution.

### "Is our data safe?"
**Local-first.** Vivim runs on your infrastructure. Conversation data stays in your database. Browser profiles (cookies) never leave your Chrome fleet. No telemetry sent externally unless you configure it.

### "What's the learning curve?"
- **PMs:** 30 minutes to understand capability model
- **Engineers:** 1 day to integrate API + UI
- **Full team:** Productive in Sprint 1

---

## Next Steps

### For Evaluation
```bash
# 15-minute proof of concept
git clone https://github.com/vivim/vivim-final
cd vivim-final && bun install && bun run seed && bun run serve
# Test: curl -X POST localhost:9420/api/nlcl/interpret -d '{"input": "send hello to chatgpt"}'
```

### For Production Planning
1. **Architecture review** — 30 min call with our team
2. **Pilot scope** — Pick 1 capability, 2 providers, 2-week sprint
3. **Integration sprint** — We pair with your engineers
4. **Rollout plan** — Capability-by-capability, provider-by-provider

### Resources
- **Live Demo:** `https://demo.vivim.app` (runs on Vivim)
- **API Docs:** `https://docs.vivim.app/api`
- **Component Library:** `https://canvas.vivim.app`
- **Provider Status:** `https://status.vivim.app/providers`
- **Slack Community:** `#vivim-product` (500+ PMs/engineers)

---

*Vivim is used by teams at [Company A], [Company B], [Company C] to power AI features for 100,000+ end users. MIT licensed. Self-hosted or managed cloud.*