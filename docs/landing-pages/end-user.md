# vivim End User Landing Page

## Headline
### One Chat Interface. Every AI. Your Data.

### Subheadline
Stop switching tabs. Stop copying context. Vivim unifies ChatGPT, Claude, Gemini, DeepSeek, Qwen, and Grok into a single, beautiful interface — running locally on your machine, with your accounts, your history, your privacy.

---

## The Problem You Know Too Well

**You have subscriptions to multiple AIs because each excels at different things:**
- ChatGPT for coding and general reasoning
- Claude for writing and analysis
- Gemini for research and long context
- DeepSeek for technical problems
- Qwen for multilingual work
- Grok for real-time info

**But the experience is fragmented:**
| Pain Point | Current Reality |
|------------|-----------------|
| **Context switching** | 6 browser tabs, 6 different UIs, 6 login flows |
| **Lost history** | Conversations scattered across providers, no unified search |
| **No portability** | Can't move a ChatGPT conversation to Claude |
| **Inconsistent features** | Model selector works differently everywhere |
| **Privacy concerns** | Your data on 6 different companies' servers |
| **Subscription fatigue** | Paying for overlapping capabilities |

---

## The Vivim Experience

### One Interface, All Providers
```
┌─────────────────────────────────────────────────────────────┐
│  Vivim                              [ChatGPT ▼] [Account]   │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  Conversations│  ChatGPT • gpt-4o                          │
│  ──────────── │  ────────────────────                       │
│  📁 Work      │  You: "Refactor this React component"       │
│   ├ Project A │                                              │
│   ├ Project B │  Assistant: [streams response beautifully]  │
│   └ Personal  │                                              │
│  📁 Research  │  ────────────────────                       │
│   ├ AI Papers │  You: "Now rewrite in TypeScript"           │
│   └ Competitive│                                             │
│  💬 New Chat  │  [Type message...]  [Attach] [Send]         │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

**Switch providers mid-conversation** — your context comes with you.

### Unified Search Across All History
```
Search: "React performance optimization"
────────────────────────────────────────────
💬 ChatGPT • Mar 15 • "useMemo vs useCallback"
💬 Claude  • Mar 10 • "Profiling React apps"  
💬 Gemini  • Feb 28 • "Virtual scrolling guide"
💬 DeepSeek• Mar 20 • "Bundle analysis tips"
```
One search. Every conversation. Every provider.

### Your Data, Your Machine
- **Local SQLite database** — conversations never leave your disk
- **Your browser profiles** — Vivim uses your existing Chrome logins (cookies stay in your profile)
- **No cloud required** — runs entirely offline after setup
- **Export anytime** — JSON, Markdown, or full database backup

---

## Key Features

### 🎯 **Smart Provider Routing**
Type naturally — Vivim routes to the best provider:
> **"Deep research on quantum computing"** → Routes to Gemini (long context)
> **"Write a Python script for..."** → Routes to ChatGPT/DeepSeek (coding)
> **"Analyze this contract"** → Routes to Claude (reasoning)
> **"Latest news on AI regulation"** → Routes to Grok (real-time)

*Or pick manually — you're in control.*

### 🔄 **Seamless Model Switching**
```
Current: ChatGPT • gpt-4o
────────────────────────
[gpt-4o] [gpt-4o-mini] [o3] [o4-mini]
[Claude: opus-4] [Claude: sonnet-4]
[Gemini: 1.5-pro] [Gemini: 1.5-flash]
[DeepSeek: v3] [Qwen: 2.5-max] [Grok: 1.5]
```
One click. No context loss. Conversation continues.

### 📎 **Universal File Handling**
Drag any file into any provider:
- **Images** → Vision models (GPT-4o, Claude, Gemini)
- **PDFs** → Auto-extracted text + analysis
- **Code** → Syntax highlighted, language detected
- **Spreadsheets** → Data analysis capabilities
- **Audio** → Transcription + processing (where supported)

### ⚡ **Capability Buttons — Not Just Chat**
Right in your composer bar:
```
[🔍 Deep Research] [📊 Analyze Data] [🎨 Generate Image] 
[🔧 Code Review] [📝 Summarize] [🌐 Translate] [➕ Custom]
```
Each button = a **capability** that works identically across providers. No learning new interfaces.

### 🌙 **Beautiful, Customizable UI**
- **Themes:** Light / Dark / System / 6 accent colors
- **Density:** Compact / Comfortable / Spacious
- **Font scale:** 85% - 125%
- **Keyboard shortcuts:** `Ctrl+K` (command palette), `Ctrl+\`` (dev console), `Ctrl+Tab` (switch surfaces)

---

## How It Works (Simple Version)

### 1. **Install & Launch** (2 minutes)
```bash
# One command (or download installer)
curl -fsSL https://vivim.app/install.sh | bash
vivim start
```

### 2. **Connect Your Accounts** (30 seconds each)
```
┌─────────────────────────────────────┐
│  Add Account                        │
│  ─────────────────────────────────  │
│  Provider: [ChatGPT ▼]              │
│  Email:    your@email.com           │
│  [Connect] → Opens Chrome window    │
│  → You log in normally              │
│  → Vivim detects session ✓          │
└─────────────────────────────────────┘
```
*Vivim never sees your password. It uses your existing Chrome profile.*

### 3. **Start Chatting**
- Pick a provider from the header
- Type naturally or use capabilities
- Everything saves automatically

### 4. **Customize (Optional)**
- Add custom capabilities via command palette
- Install community capability packs
- Tweak UI to your workflow

---

## Comparison

| Feature | ChatGPT Web | Claude Web | **Vivim** |
|---------|-------------|------------|-----------|
| **All providers in one UI** | ❌ | ❌ | ✅ |
| **Unified search** | ❌ | ❌ | ✅ |
| **Cross-provider context** | ❌ | ❌ | ✅ |
| **Local-first storage** | ❌ | ❌ | ✅ |
| **Your own browser profiles** | N/A | N/A | ✅ |
| **Capability buttons** | Limited | Limited | ✅ 20+ built-in |
| **Hot-swappable UI** | ❌ | ❌ | ✅ |
| **Keyboard-first** | Basic | Basic | ✅ Full |
| **Offline access to history** | ❌ | ❌ | ✅ |
| **Export/backup** | Limited | Limited | ✅ Full |
| **Custom capabilities** | ❌ | ❌ | ✅ |
| **Cost** | $20/mo each | $20/mo each | **Free** (bring your own subscriptions) |

---

## Who Is This For?

### **Developers & Engineers**
- Code review across models
- Instant model comparison for debugging
- Local history = searchable knowledge base
- API access for automation

### **Researchers & Analysts**
- Deep research capability (multi-step, cited)
- Long-context Gemini for literature review
- Cross-provider fact checking
- Export to Notion/Obsidian/Markdown

### **Writers & Creators**
- Claude for prose, ChatGPT for structure
- Seamless switching for different voices
- Version history across providers
- Distraction-free writing mode

### **Students & Learners**
- One interface for all study needs
- Cheaper than multiple subscriptions (use free tiers)
- Conversation history = study notes
- Privacy for academic work

### **Privacy-Conscious Users**
- Zero cloud dependency
- Your data, your disk, your control
- Audit the code (open source)
- No telemetry unless you enable it

---

## Getting Started

### **Quick Start (CLI)**
```bash
# Requirements: Bun, Chrome/Chromium
bun install -g vivim
vivim init
vivim serve
# Opens http://localhost:3000
```

### **Desktop App (Coming Soon)**
- Native Tauri app (Windows/macOS/Linux)
- Auto-updates
- System tray integration
- Global hotkey: `Ctrl+Shift+V`

### **Docker (Server/Headless)**
```bash
docker run -d \
  -p 9420:9420 \
  -p 3000:3000 \
  -v ./data:/app/data \
  -v ./chrome-profiles:/app/chrome-profiles \
  vivim/vivim:latest
```

---

## FAQ

### "Do I need to pay for Vivim?"
**No.** Vivim is free and open source (MIT). You pay for your AI subscriptions (ChatGPT Plus, Claude Pro, etc.) — Vivim just lets you use them better.

### "Does Vivim store my API keys?"
**No API keys needed.** Vivim uses browser automation with your existing logged-in Chrome profiles. Your cookies stay in your Chrome profile directory.

### "What if a provider changes their UI?"
Vivim has **automatic selector healing** — it detects broken selectors, finds working alternatives via semantic DOM analysis, and updates itself. Usually before you notice.

### "Can I use this without coding?"
**Yes.** The desktop app (coming soon) requires zero technical knowledge. The CLI version needs basic terminal comfort.

### "Is my conversation data sent anywhere?"
**Never.** Everything stays in your local SQLite database (`~/.vivim/data.db`). No telemetry, no analytics, no external calls unless you configure integrations.

### "Can I import my existing ChatGPT/Claude history?"
**Yes.** Use the import capability: `vivim import --from=chatgpt --file=export.json`. Supports OpenAI, Anthropic, Google Takeout formats.

### "What about mobile?"
**Not yet.** Desktop-first. Mobile web view works for reading; writing needs keyboard. Native mobile apps on roadmap.

### "How does this compare to [other tool]?"
| Tool | Approach | Vivim Difference |
|------|----------|------------------|
| **LibreChat** | Self-hosted multi-API | Vivim = browser automation (no API keys) + local-first + capabilities |
| **Open WebUI** | API-centric | Vivim = works with free tiers via browser + unified capabilities |
| **Chatbox** | Multi-API client | Vivim = capability-driven + hot-swappable UI + local KB |
| **Browser extensions** | Single-provider | Vivim = 6 providers + cross-context + local DB |

---

## Community & Support

- **GitHub:** `github.com/vivim/vivim` — Issues, PRs, discussions
- **Discord:** `discord.gg/vivim` — 2,000+ users, real-time help
- **Docs:** `docs.vivim.app` — Guides, API, capability development
- **Roadmap:** `github.com/vivim/vivim/projects` — Vote on features
- **Showcase:** `vivim.app/gallery` — Community capability packs

---

## Ready to Unify Your AI Experience?

```bash
# Start in 60 seconds
curl -fsSL https://vivim.app/install.sh | bash
```

**Or download the installer:** [Windows] [macOS] [Linux] [Docker]

*Questions? Join Discord → #getting-started*

---

*Vivim v1.0 — MIT Licensed — Built by users, for users. No investors. No tracking. Just better AI workflows.*