# Poppy AI — Complete Product Teardown

**Compiled:** 2026-09-06
**Subject:** Poppy AI (`getpoppy.ai` / app at `app.getpoppy.ai`) — the visual AI content workspace
**Purpose:** Reference spec for feature parity work in this repo.

---

## 0. Scope, Sourcing & Caveats

### 0.1 Name disambiguation — read this first

There are **at least three unrelated products called "Poppy AI."** Only the first is the subject of this document.

| Product | What it is | Domain |
|---|---|---|
| **Poppy AI** *(this doc)* | Visual/canvas AI workspace for content creators | `getpoppy.ai` |
| Poppy | Proactive iOS personal assistant (calendar, mail, iMessage triage); launched May 2026, iOS 26+, free on App Store | separate company, "Poppy AI, Inc." |
| Poppy: AI Roleplay Chat | Android companion-chat app | unrelated third party |

Web searches for "Poppy AI" freely mix all three. The May 2026 TechCrunch coverage of a "proactive AI assistant" is **not** this product.

### 0.2 Confidence levels

Facts below are tagged where it matters:

- **[OFFICIAL]** — from `getpoppy.ai`, the Intercom help center, or the public changelog.
- **[VENDOR]** — from Poppy's AppSumo listing or founder statements (marketing-shaped).
- **[REVIEW]** — from third-party reviewers; describes observed behavior, may be stale.
- **[UNVERIFIED]** — reported but not corroborated, or sources conflict.

### 0.3 Known moving target

As of **August 3, 2026** Poppy migrated to a "v2" marketing site, and public pricing behavior changed — some sources report pricing was pulled entirely behind a booked demo with a "15% revenue guarantee," while the live homepage still surfaces a self-serve `$1`/7-day trial. **[UNVERIFIED]** Treat all dollar figures in §18 as a snapshot, not a contract.

---

## 1. Company Snapshot

| Field | Value |
|---|---|
| Founders | Naz Dumanskyy and Rafeh Qazi ("Qazi") — co-founders. Amaanath Mumtaz on the founding team (customer-facing; answers the AppSumo Q&A). **[VENDOR]** |
| Origin story | The two ran a YouTube channel to ~1M subscribers over ~5 years; quit in 2024 and moved to San Francisco to build SaaS they'd use daily. September 2024: reportedly ~2 months from bankruptcy when a TikTok went viral and produced ~$100K in 10 days. **[VENDOR]** |
| Legal entity | POPPY AI LTD (UK company no. 16219557) appears in Companies House records. **[UNVERIFIED]** — relationship to the US operating entity unclear. |
| Funding | Bootstrapped; no institutional round found. **[VENDOR]** |
| Revenue | Publicly claimed milestones: ~$400–500K MRR, then "crossed $8M in revenue" (founder video, 2026). **[VENDOR]** |
| Users | Claims range from "5,000 creators" to "10,000+ creators" to "15,000+ users." Logo-drops cite Meta, Amazon, Notion, Toyota. **[VENDOR]** — the spread suggests different metrics (paying vs. registered) or different dates. |
| Distribution | Direct self-serve, a booked-demo enterprise motion, and an AppSumo lifetime deal (live 2026). |
| Community | Skool community "Poppy AI Viral Content Academy," 3,000+ members, weekly calls. **[VENDOR]** |

---

## 2. Positioning

**One-liner (theirs):** "Drag in YouTube videos, PDFs, and voice notes to write on-brand scripts, posts, and emails with AI." **[OFFICIAL]**

**Headline claims on the current site:** **[OFFICIAL]**
- "Visual canvas — see all your ideas & research at once"
- "Work together with your team in real time"
- "Find viral outliers in your niche & model them instantly"
- "1-on-1 onboarding call — we literally set it up for you"
- Writes content trained on your own voice
- v2 positioning adds: "15% More Revenue From Your Content & Ads, Guaranteed"

**Explicit cost framing:** positioned as replacing ChatGPT Plus (~$240/yr) + Claude Pro (~$240/yr) with one subscription that also includes Gemini, Grok, and image models. **[OFFICIAL]**

**Target personas:** content creators, marketers, agencies, coaches, consultants, founders, SaaS companies, ecommerce brands, copywriters, social media managers. **[OFFICIAL]**

**Category comparison:** functionally "Miro/Whimsical × ChatGPT" — a mind-map canvas where nodes are *context* and the AI chat is a node that consumes its connected neighbors.

**The structural bet:** context is *spatial and explicit* rather than *conversational and implicit*. In ChatGPT, context is whatever is in the thread. In Poppy, context is exactly the set of blocks you drew an edge from. That is the whole product thesis.

---

## 3. Object Model

```
Account
├── Boards (unlimited on all plans)          ← the unit of work; also the unit of "memory"
│   ├── Blocks (nodes on an infinite canvas)
│   ├── Groups (containers; color-coded)
│   ├── Connections (edges = context wiring)
│   └── Chats (AI chat blocks, each with its own history)
├── Shared Boards (boards others shared with you)
├── Deleted / Archived Boards
├── Brands (brand-voice profiles; plan-limited: 3 → 10 → unlimited)
├── Vault (cross-board content library)
├── Prompt Library (saved, taggable, pinnable prompts)
├── Creator Profiles (auto-refreshed competitor/inspiration feeds)
├── Templates (shareable board blueprints)
└── Integrations (Notion, Slack, Gmail, Google Calendar, Higgsfield, …)
```

---

## 4. The Canvas

### 4.1 Canvas properties **[OFFICIAL/REVIEW]**

- Infinite, pannable, zoomable 2D canvas.
- Node-based; nodes connected by visual connector lines (mind-map style).
- Drag-and-drop from OS; paste-to-create from clipboard.
- Real-time multiplayer cursors. **[REVIEW]**
- Undo/redo history.
- **No dark mode** — white-only interface as of the reviewed builds. **[REVIEW]**
- Boards are persistent and unlimited in count on every plan.

### 4.2 Block types

Every block is both a viewer and a potential context source.

| Block | Created by | Notes |
|---|---|---|
| **Text box** | `T` | Notion-style rich text editor inline on canvas. Expandable via a Full Screen button or by dragging the corner. The primary vehicle for system prompts, saved outputs, SOPs, and brand guidelines. |
| **AI Chat** | `C` | The generation surface. See §7. |
| **Social media content** | `S` | Ingests a platform URL and renders the post plus its transcript/text. See §6. |
| **Website** | `W` | Scrapes a single URL. |
| **Upload / files + media** | `U` | PDF, CSV, DOC, TXT, MP3, MP4, MOV, images. |
| **Voice note / microphone** | `R` | Records, transcribes, and auto-cleans grammar. Optional live transcript while recording; optional auto-send. |
| **Mindmap** | `M` | Native mind-map block. Also an *output* format — AI results can be emitted as an editable mind map. |
| **Group** | `G` | Container for other blocks; color-codable; can carry an attached Brand. |
| **Image** | paste/upload | Analyzed visually (layout, on-image text, structure). Also the output target for image generation. |
| **Landing page / VSL** | chat action | Generated single-page site, previewable and editable on canvas. See §13.4. |
| **Presentation** | chat action | Slide deck artifact. Metered separately from ordinary chats. |
| **Carousel** | chat action | Multi-slide image set for IG/LinkedIn. See §13.3. |
| **Document preview** | auto | Inline PDF preview on-board (shipped 2026-03-26); documents are renameable. |

### 4.3 Connections

- Drawing an edge from a block into an AI Chat block adds that block to the chat's **knowledge base**.
- Connecting a **Group** connects its contents.
- Connected sources are listed inside the chat UI and can be reviewed/removed individually.
- Adding content to a board is **free**; only chatting spends credits (§18).

---

## 5. Keyboard Shortcuts **[OFFICIAL]**

Hovering any toolbar button reveals its shortcut.

| Action | Windows | macOS |
|---|---|---|
| Search boards | `Ctrl + K` | `Cmd + K` |
| Microphone (start/end recording) | `R` | `R` |
| Social media content | `S` | `S` |
| Text box | `T` | `T` |
| Mindmaps | `M` | `M` |
| AI chat | `C` | `C` |
| Website | `W` | `W` |
| Upload files + media | `U` | `U` |
| Group | `G` | `G` |
| Prompt Library | `/` | `/` |
| References (cite a connected source) | `@` | `@` |
| Undo | `Ctrl + Z` | `Cmd + Z` |
| Redo | `Ctrl + Y` | `Cmd + Shift + Z` |
| Zoom in | `=` | `=` |
| Zoom out | `-` | `-` |
| Fit all to view | `1` | `1` |
| Full-screen chat | `F` | `F` |
| Exit full-screen chat | `ESC` | `ESC` |
| Zoom via pointer | `Ctrl + Scroll` | `Cmd + Scroll` |
| Delete selection | `Backspace` / `Delete` | `Backspace` / `Delete` |
| Multi-select to group | `Shift` + click/drag | `Shift` + click/drag |

---

## 6. Content Ingestion Matrix

### 6.1 Supported sources **[OFFICIAL]**

**Social / video platforms:**

| Platform | Formats supported | Visual analysis? |
|---|---|---|
| YouTube | videos (transcript; thumbnail auto-pulled as an image reference) | **No** |
| Instagram | Reels, carousels, single image posts | Yes |
| TikTok | videos, carousels | Yes |
| LinkedIn | single-image, video, and text posts | Yes |
| Facebook | posts, and **Facebook Ads** (video, carousel, reel) | Yes |
| X / Twitter | videos | Yes |
| Loom | recordings | **No** |
| Zoom | recordings | **No** |

**Files:** PDF, CSV, DOC, TXT, MP3, MP4, MOV, images.
**Websites:** any URL, pasted directly onto the board.

### 6.2 Ingestion mechanics

- **Paste-to-create:** copy a web link, social link, or image and paste onto the board.
- **Drag-and-drop:** downloaded files and audio files.
- Transcription is automatic and reportedly completes "in seconds." **[OFFICIAL/REVIEW]**
- Voice notes are transcribed *and* grammar-cleaned. **[REVIEW]**

### 6.3 Hard limits and caveats **[OFFICIAL]**

- **File size cap: 100 MB**, all file types. Workaround: split or compress.
- **Websites are single-page only.** "Poppy only sees the exact page you link to. It can't browse to other pages within that website." No crawling, no site-wide ingest.
- **No visual analysis for YouTube, Zoom, or Loom** — audio transcript only. Locally imported video files *do* get visual analysis.
- **Live dependency on the source platform:** "if any of your content gets removed from the platform, Poppy will no longer be able to see them." Ingested social content is evidently re-fetched rather than fully mirrored — a significant durability caveat.
- **Login-walled content** is not supported directly. Workarounds: download via a browser extension then drag in, or screenshot the page for visual analysis.
- **No bulk import / scraping.** Links are pasted one at a time and occasionally time out. **[REVIEW]**
- **Poppy is not connected to the internet** for general browsing — see §8.

---

## 7. The AI Chat Block

### 7.1 Model roster **[OFFICIAL]**

Text/reasoning: **ChatGPT (OpenAI)**, **Claude (Anthropic)** — including Opus-class, **Gemini (Google)**, **Grok (xAI)**.
Image: **GPT Image** (referred to as "GPT 1"), **Nano Banana** (Google's image model).
Research: **Perplexity** — available as an in-chat capability for current-information lookup.

Notes:
- Models are switchable per chat "with a single click"; no separate provider accounts needed. **[REVIEW]**
- A cheap tier exists and is documented as low-credit — GPT-4o-mini is named explicitly. **[OFFICIAL]**
- Claude Sonnet (a "4.6 Sonnet" is named in one help-center excerpt) is recommended for copywriting/content. **[OFFICIAL]** — exact model IDs churn; treat the roster as families, not pinned versions.
- **Image generation ignores your text-model choice** in some paths: older docs say it silently switches to ChatGPT's image model in the background, newer docs expose an explicit GPT Image vs. Nano Banana choice. **[OFFICIAL, conflicting — versioned change]**
- **Each model has a different token limit**, and the guide's entire framing is "when to use what & token limits." Exceeding it produces an **Overload Limit error** (§19).

### 7.2 Thinking modes **[OFFICIAL]**

A per-chat control for "how deeply the AI thinks before giving you a response." Deeper modes cost more credits. This is a first-class, user-visible dial — notable, because it pushes reasoning-token spend onto the user as an explicit choice.

### 7.3 References — `@` mentions **[OFFICIAL]** *(shipped 2026-05-07)*

Type `@` inside a chat to cite a specific connected source. Provides a searchable source list with platform-specific labels and keyboard navigation. Purpose: stop users from manually re-explaining which source they mean. Effectively per-message context narrowing on top of per-chat edge wiring.

### 7.4 Chat settings **[OFFICIAL]** *(shipped 2026-06-18)*

- Font size adjustment
- Message width preference
- Voice-recording auto-send toggle
- Show transcript while recording
- **"Sound More Human" mode** — a global de-slopification toggle for AI phrasing

### 7.5 Other chat behaviors

- Full-screen chat mode (`F` / `ESC`).
- **Mind-map output:** results can be rendered as an editable mind map rather than prose. **[OFFICIAL]**
- **Word-count adherence** is documented as a known weak point with its own help article ("Getting the AI to Stay Within Word Count Limits").
- Chats are per-board and each carries its own history.
- Collaborators on a shared board can see **full chat histories**.

---

## 8. Context & Memory Architecture — the most important section

This is where Poppy's design is genuinely opinionated, and it's directly relevant to any clone.

### 8.1 What Poppy explicitly does **not** do **[OFFICIAL]**

> As of December 16, 2025: **Poppy does not use RAG or persistent memory.**

No vector store. No embeddings retrieval. No cross-session memory. No internet access.

### 8.2 What it actually does

Poppy stuffs the context window. Priority order: **[OFFICIAL]**

1. **Recent chat history first**
2. **Connected files second**

Its knowledge is bounded to exactly three things — the docs are blunt about it:

> "It only knows: What you've explicitly attached to your chat, Your conversation history in that specific chat, Nothing else."

### 8.3 The consequences, as documented by the vendor

- **Long chats degrade.** "If your chat history gets super long, Poppy focuses on the recent conversation and the older stuff gets buried." Because history outranks attached files, a long conversation *starves its own knowledge base*.
- **The prescribed mental model:** "Think of your board as your AI's permanent memory and individual chats as temporary workspaces." Slogan: **"Train the board, use the chats."**
- **The prescribed workflow:** create focused chats per topic; the moment an output is good, copy it into a **text box** on the board so it survives the chat and can be re-wired into future chats. New idea = new chat, with prior artifacts re-attached as blocks.

### 8.4 Why this is a defensible design

The board *is* the retrieval layer, and the human is the retriever. It trades recall breadth for total, legible user control over what the model sees — which is exactly what the target user (a creator who knows which three videos matter) wants, and it sidesteps every RAG failure mode. It also makes token/credit cost a direct, visible function of what you wired up.

### 8.5 Prompt caching **[OFFICIAL]**

There is a **5-minute cache window**. The first prompt in a chat pays full price for the attached context; follow-ups within ~5 minutes cost progressively fewer credits because the context is retained server-side instead of re-read. The docs explicitly coach users to **batch edits inside the 5-minute window** to save credits. This is provider-level prompt caching (Anthropic/OpenAI-style) surfaced as user-facing economic advice.

---

## 9. Brands / Brand Voice **[OFFICIAL]** *(core feature shipped 2026-07-10)*

The persistent-identity layer, and the closest thing Poppy has to real memory.

**What it builds:** a brand-voice profile capturing speaking style, writing style, audience details, offers, and key phrases.

**How it's built:**
- **From social profiles** — analyzes your public accounts. Supported: Instagram, TikTok, YouTube, websites, and (added 2026-08-18) **LinkedIn**.
- **Conversationally** — for users with no public social presence (added 2026-07-24).
- **From PDFs** — upload existing brand guidelines (added 2026-07-24).
- **Manually** — a text-box system prompt defining persona, tone, audience, core message; plus uploading your best-performing transcripts, ad copy, newsletters, and blog posts to a board.

**How it's applied:**
- Attachable to a whole board, to a **content group**, or to an **individual block** (2026-07-24).
- A **default brand** can be set.
- Brand count is the main plan-differentiating limit: **3 → 5 → 10 → unlimited**.

**Notable capability:** a brand voice can be built from *any* creator's profile, not just your own — i.e. deliberate style modeling of someone else. Marketed as "sound like you or any creator you're inspired by."

---

## 10. The Vault **[OFFICIAL]** *(shipped 2026-08-19)*

A personal, cross-board content library. Solves the "I keep re-pasting the same 5 sources into every board" problem.

- Save links, files, voice recordings, and whole **content groups**.
- Custom naming and icons.
- Drag-and-drop into any board.
- **Automatic sync across boards** — update once, propagates.
- Smart search.
- Direct integration into Poppy chats.

---

## 11. Prompt Library **[OFFICIAL]** *(shipped 2026-07-18)*

- Triggered by the `/` keystroke anywhere in a chat.
- Save and reuse prompts.
- **Pin** frequently used prompts.
- **AI refinement** — have Poppy improve a saved prompt.
- Tagging and categorization.

---

## 12. Research Suite — Discover Content

The competitive-intelligence half of the product. This is the feature reviewers single out most consistently.

### 12.1 Outliers **[OFFICIAL]** *(shipped 2026-03-22)*

Finds content that outperformed its own creator's baseline — i.e. proven-idea detection, not raw view count.

- Platforms: **Instagram, TikTok, YouTube**.
- **Outlier score** computed against a **rolling average** of that creator's performance.
- One-click add of a top performer onto the board.
- **Gap analysis** — compares your content against the creators you're modeling.
- Sort/browse by outlier vs. latest.

**Workflow:** search a niche → tool scans platforms → surfaces videos that beat their creator's average → drag the outlier onto the board → wire it into a chat with your brand voice → generate your version.

### 12.2 Creator Profiles **[OFFICIAL]** *(shipped 2026-08-27)*

- **Automated daily refresh** of tracked creators — the only truly proactive/background feature in the product.
- Platforms: **Instagram, TikTok, LinkedIn** (plus YouTube/Instagram profile research per the older help article).
- Toggle each profile between **"Latest"** and **"Outliers"**.
- Save favorite creators.
- Profiles plug directly into chats as generation context.

### 12.3 Perplexity in Poppy **[OFFICIAL]**

In-chat Perplexity access for researching current information — the designated escape hatch from §8's "not connected to the internet" limitation.

---

## 13. Output Artifacts

### 13.1 Text
Scripts (YouTube, VSL), Instagram Reels and TikTok scripts, social posts, email newsletters, blog posts, Facebook ads, ebooks, SOPs, outlines, tasks. Connected nodes can be converted into outlines, scripts, and task lists.

### 13.2 Images **[OFFICIAL]**
- Models: **GPT Image** and **Nano Banana**, user-selectable.
- Use cases: YouTube thumbnails, ad creatives, product shots.
- **Aspect ratio:** auto-matches the reference image; overridable in natural language ("redo the image but make it vertical", "make this for YouTube thumbnail dimensions").
- **Reference material** can be multiple simultaneous sources: YouTube videos (thumbnail auto-pulled), websites, competitor ads, logos, brand assets. Connected refs are listed in the chat for review/removal.
- **Credit cost scales with connected reference volume.**
- **Known weakness:** face-swapping is imperfect; personalized training floated as future work.
- **Stated advantage over ChatGPT:** ChatGPT can't reference YouTube links, websites, and multiple sources simultaneously as image context.

### 13.3 Carousels **[OFFICIAL]**
Multi-slide generation for Instagram and LinkedIn, with a dedicated carousel feature. **Sources conflict** on batching: one says "create entire carousels at once," another says "the system creates one image at a time — request each slide separately, or ask for prompts for all slides first, then generate them individually." **[OFFICIAL, conflicting — likely a versioned improvement]**

### 13.4 Landing Pages **[OFFICIAL]**

A genuine mini site-builder inside the canvas.

**Flow:** (1) prep context — text boxes with brand colors and audience, plus a voice note describing the desired emotional impact; (2) click **"Create Landing Page"** or describe it in prose; (3) preview and iterate with AI-powered edits described in natural language.

Example prompt from the docs, verbatim:
> "Create a landing page for my webinar about using AI for e-commerce. Use colors #FF006E and #8338EC, include testimonials, and add a countdown timer for December 25, 2025 at 6PM EST"

**Publishing — three paths:**
1. **Poppy Live Link** — auto URL of the form `poppy.ai/landing/your-page-name`, carrying a "Created with Poppy" badge. The badge appears **only** on Poppy-hosted links.
2. **HTML download** — full exportable file for self-hosting; no badge.
3. **Custom domain** — apex or subdomain via DNS config. **Creator plan and above only.**

**Output:** responsive HTML with inlined CSS.
**Missing:** backend form handling, payment processing, multi-page sites. VSL pages support **YouTube only**.
**Metering:** costs credits like any chat. Base plans get **5 credits' worth** of landing-page/presentation generation; Creator and above get **unlimited**. Duplicate a page by copy-pasting it back onto the board and editing the copy.

### 13.5 Presentations
Slide-deck generation, metered on the same "5 generations on base, unlimited on Creator+" rule as landing pages. Sparse public documentation.

### 13.6 Mind maps
Both an input block and an output format — AI results can be emitted as an editable mind map.

### 13.7 Templates **[OFFICIAL]**
Board blueprints, creatable and shareable with team members and customers.

---

## 14. Integrations & MCP

### 14.1 Native / MCP integrations **[OFFICIAL]** *(MCP wave, July 2026)*

**Notion, Slack, Gmail, Google Calendar, Higgsfield** (AI video/image generation), and more. MCP connections are stated as available on **all tiers** — notable, since API access is gated to the top tier. Earlier AppSumo Q&A had MCP as "coming soon"; it has since shipped.

### 14.2 Notion integration in depth **[OFFICIAL]**

**Setup:** profile settings → integrations → authorize Notion → choose which workspaces Poppy may access. Per-page access scoping is "coming soon" — currently workspace-level grants.

**Read access:** all pages and databases; page content, properties, and metadata; database entries and their relationships; comments and collaboration history.

**Capabilities:**
- Conversational search across titles, content, properties, tags, and date ranges.
- **Create** new pages and database entries from chat.
- **Update** existing content via natural language ("mark this task done", "move the deadline").
- Bulk operations, smart filters, template application, relationship management across linked databases.

**Sync:** writes propagate to Notion instantly and are visible to teammates in real time.

Note the scope: this is read **and write**, workspace-wide. Broad permission surface.

### 14.3 Automation platforms **[OFFICIAL]**
**n8n, Zapier, Make.com** — via the API, so **Power User tier only**. Documented targets include WordPress, Google Drive, Beehiiv, Slack, and Telegram.

---

## 15. API & Chatbots — Power User tier only

### 15.1 Design philosophy **[OFFICIAL]**
> Poppy is the **"brain,"** automation tools are the **"limbs."**

Poppy does analysis, generation, and knowledge-grounded decisions; n8n/Zapier/Make handle execution across apps.

### 15.2 API surface **[OFFICIAL]**

**Two endpoint modes:**
1. **Conversation-based** — carries chat history.
2. **"Knowledge Base Only"** — stateless; no prior conversation influence.

**What it can do:** analyze text content (transcripts, documents, call recordings); generate repurposed content in multiple formats; score and give feedback on sales calls; behavior defined via **System Prompts**.

**Documented limitations — both listed as development priorities:**
- **Cannot upload files via API.** No programmatic addition of PDFs, videos, or images to boards. Workaround: extract text yourself first.
- **No visual analysis via API.** Video is audio-transcript only.

No public endpoint URLs, auth scheme, or request/response schemas were found — the API is documented as FAQ-and-onboarding material, not as a developer reference. **[OFFICIAL, incomplete]**

### 15.3 Chatbots **[OFFICIAL]**

- Generate a shareable link to a Poppy knowledge base in **two clicks**.
- Recipients can chat with the knowledge but **cannot see or edit** the underlying board.
- Purpose: share expertise without sharing account or board access.
- Use cases pitched: lead magnets, objection handlers, consultative advisors trained on your brand voice and methodology.
- **White-labelled chatbots** — deploy under your own name/brand — **AppSumo Tier 6 only**.
- A hosted example exists at `chat.getpoppy.ai`.

### 15.4 Recommended custom-app stack **[OFFICIAL]**
Front end: **Lovable** or **Bolt**. Auth + data: **Supabase**. Orchestration: **n8n**.

**Security guidance given:** keep the API key server-side in a **Supabase Edge Function**, never client-side; store chat history in your own DB for multi-user privacy; use the stateless endpoint when prior context must not leak between users.

### 15.5 BYOK **[VENDOR]**
Bring Your Own Key is available on AppSumo Tiers 4–6. Passing your own provider key **bypasses credit consumption entirely** — the escape hatch from Poppy's economics for heavy users.

---

## 16. Collaboration **[OFFICIAL]**

**Sharing flow:** open board → **Share** in the toolbar → toggle **"Make this board public"** → copy link → send. Recipients paste the link and find the board under **"Shared Boards"** in the left sidebar.

**Collaborators can:** edit everything on the board; add content, groups, and chats; connect sources to chats; see all board contents **including chat histories**.

**Collaborators cannot:** duplicate the board; grant access to further users (the owner alone controls sharing); restore previous versions.

**Constraint:** sharing "only works with Poppy account holders." For people without accounts, Poppy sells **team-member seats** (contact support). Seats are plan-limited: 1 → 2 → 3 → 5, or +1/+2/+4 depending on the taxonomy used (§18.4).

Real-time multiplayer cursors are reported by reviewers; the help docs don't specify concurrency limits or a formal role hierarchy beyond owner/collaborator. **[REVIEW]**

---

## 17. Board Lifecycle & Version Control **[OFFICIAL]**

- **Version control:** deleted board content can be recovered — there's a dedicated "Recover Deleted Content" flow. Note that **collaborators cannot restore versions**; owner-only.
- **Deleted/Archived Boards:** a separate area for finding removed boards.
- **Board search:** `Ctrl/Cmd + K`.
- **Unlimited boards** on every plan.
- Boards support color-coding and decomposition into smaller groups.

---

## 18. Credit Economics

The most operationally important part of the product to understand, and the single most common complaint.

### 18.1 What credits are **[OFFICIAL]**

Credits are the monthly AI-usage allowance. **Credits ≠ tokens**: credits are what you pay; tokens are what a model can hold at once.

- Base allowance: **2,000 credits/month** on all direct plans.
- **Reset to zero on the 1st of each month.** Sources disagree on the hour — **5 AM PST** vs **9 AM PST**. **[OFFICIAL, conflicting]**
- **No rollover.** Unused credits are lost.
- Usage displayed inline as `X/2000 credits`.
- Hitting the cap **blocks new prompts** until you purchase more or the month rolls over.

### 18.2 What consumes credits **[OFFICIAL]**

**Free:** adding content to boards, uploading files, organizing, grouping, transcription-on-ingest, collaboration.
**Charged:** chatting with the AI, image generation, landing pages, presentations, carousels.

That split matters — ingest and transcription being free is why the product feels cheap to *fill* and expensive to *use*.

### 18.3 Cost drivers **[OFFICIAL]**

1. **Volume of attached content** — proportional to *text volume*, not file count or duration.
2. **Model selected** — GPT-4o-mini is marked "low"; frontier models cost far more.
3. **Thinking mode** — deeper reasoning costs more.
4. **Conversation length** — the AI carries the whole chat history, so cost grows as the chat grows.
5. **Workflow weight** overall.
6. **Reference-image count** for image generation.

**The caching discount:** first prompt pays full context cost; follow-ups within the **5-minute window** cost progressively less. Official guidance is to batch work inside that window.

There is a dedicated help article, "Troubleshooting High Credit Usage" — the existence of which is itself a signal about how often users are surprised.

### 18.4 Two conflicting plan taxonomies

Poppy's checkout and its help center describe plans differently. **[OFFICIAL, conflicting]**

**Checkout / marketing taxonomy** — named plans:

| Plan | Price/yr | Credits/mo | Users | Brands | Extras |
|---|---|---|---|---|---|
| Basic | $399 | 2,000 | 1 | 3 | 5 landing page/presentation generations |
| Creator | $2,268 | 8,000 | 3 | 10 | Unlimited landing pages + presentations, custom domains |
| Power User | $4,788 | 16,000 | 5 | Unlimited | API + chatbot access |

**Help-center taxonomy** — a base subscription plus stackable credit upgrades:

*Base (all include 2,000 credits/mo):* Annual Subscription · Annual + VIP Support (priority support with calls) · Lifetime Access (one-time payment, 2,000 credits/mo forever).

*Upgrades (non-refundable):*

| Upgrade | Adds | Total credits/mo | Adds seats | Other |
|---|---|---|---|---|
| Starter | +2,000 | 4,000 | +1 | — |
| Creator | +6,000 | 8,000 | +2 | Unlimited landing pages/presentations |
| Power User | +14,000 | 16,000 | +4 | API + chatbot access |

Upgrades are also purchasable at a lifetime price, but those prices "are not listed within the Upgrade pricing menu."

### 18.5 AppSumo lifetime deal **[VENDOR]** *(live 2026)*

| | T1 | T2 | T3 | T4 | T5 | T6 |
|---|---|---|---|---|---|---|
| Price | $279 | $539 | $989 | $1,379 | $2,259 | $4,459 |
| MSRP | $649 | $1,289 | $2,199 | $3,867 | $4,445 | $8,890 |
| Credits/mo | 500 | 1,000 | 2,000 | 3,000 | — | up to 10,000 |
| One-time bonus credits | 500 | 1,000 | 1,500 | 1,500 | — | — |
| Brands | 3 | 3 | 3 | 5 | 10 | Unlimited |
| Seats | 1 | 1 | 1 | 2 | — | up to 5 |
| BYOK | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| API | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Chatbots | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| White-label chatbots | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| MCPs | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

All tiers: unlimited boards, all content importing, all models, collaborative workspace, lifetime access, 60-day refund. No code stacking. Activate within 60 days. Upgrade between tiers while the deal is live; downgrade within 60 days.

Note that AppSumo T1–T2 give **fewer** credits (500–1,000) than the standard base plan's 2,000.

### 18.6 Trial and refunds — sources conflict **[OFFICIAL, conflicting]**

- **Homepage:** `$1` for **7 days** with full access, then `$33/mo billed annually ($399/yr)`, with a **30-day money-back guarantee**.
- **Help center:** "**No free trials offered**," annual billing only.
- **Refund fine print:** 30-day subscription refund **only if the customer attends an onboarding call** (reported as ~45 minutes). Purchased credits and plan upgrades are **non-refundable**.
- **AppSumo:** 60-day refund window.

Most likely reading: the `$1`/7-day offer is the current front-end funnel and the help center is stale — but don't rely on either.

### 18.7 Onboarding incentive **[VENDOR]**
Complimentary 1-on-1 onboarding call. AppSumo buyers who attend get **1,000 bonus credits/month for 5 months** (pitched as a "$5,000 value"). The call also gates refund eligibility — so it's simultaneously an activation mechanism and a churn-prevention mechanism.

---

## 19. Error Surface **[OFFICIAL]**

| Error | Meaning | Fix |
|---|---|---|
| "Oops, Something Went Wrong" | Generic wrapper hiding a real error | Click **Copy Error** to reveal the underlying code, then diagnose or send to support |
| "Unable to Download File" | A reference image is broken or didn't finish uploading | Look for a white image with a file icon above the text bar; remove it, re-upload, retry |
| "At Least One of the Image Dimensions Exceeds Max Allowed Size" | Image too large for the model | Disconnect all images, reconnect one at a time with test prompts to isolate, then resize/replace |
| "Output blocked by content filtering policy" | Provider safety filter tripped — often by *context*, not the final message | Switch to a different model with different filter parameters |
| Overload / Token Limit error | Too much content attached for the selected model's window | Reduce attached context or switch to a larger-window model; there's a dedicated "Troubleshooting Overload Limits" guide |

The "Copy Error" affordance implies raw provider errors are surfaced to users rather than fully abstracted.

---

## 20. Platform, Support & Ancillary

- **Platform:** web app only, at `app.getpoppy.ai`. **No mobile or desktop app** found for the canvas product. **[UNVERIFIED — absence of evidence]**
- **Support:** 24/7 via Intercom; `support@getpoppy.ai`; VIP tier adds priority support with calls.
- **Help center structure:** 4 collections — *How Poppy AI Works* (26 articles), *Best Practices* (17), *My Account* (8), *AppSumo* (2).
- **Public feedback/roadmap/changelog:** hosted on **Featurebase** at `feedback.getpoppy.ai` (`/changelog`, `/roadmap`).
- **Blog:** `blog.getpoppy.ai` — heavily SEO-driven, doubles as a workflow-tutorial library ("second brain," ebook writing, etc.).
- **"Content Test Links"** — an official help article with demo links per content provider, for verifying ingestion.
- **Onboarding doctrine** (from *Getting Started*), three principles: (1) choose models strategically, not always the biggest; (2) work non-linearly — new idea = new chat, promote good outputs to text boxes; (3) **use voice, not robotic prompts** — speak naturally so the AI mirrors your tone.

---

## 21. Complete Public Changelog (newest first) **[OFFICIAL]**

| Date | Feature | Detail |
|---|---|---|
| 2026-08-27 | **Creator Profiles** | Auto-refreshed daily creator profiles across Instagram, TikTok, LinkedIn; Latest/Outliers toggle; plugs into chats |
| 2026-08-19 | **The Vault** | Cross-board library for links, files, voice recordings, content groups; custom names/icons; drag-drop; auto-sync; smart search |
| 2026-08-18 | **LinkedIn Support** | LinkedIn added to Discover Content — creator search, post browsing, outlier sort, saved creators; LinkedIn profiles usable for brand voice |
| 2026-07-24 | **Brand Updates** | Conversational brand creation without public socials; PDF brand guidelines; brand attachable to content groups and individual blocks; default brand |
| 2026-07-18 | **Prompt Library** | `/` trigger, pinning, AI refinement, tagging/categorization |
| 2026-07-10 | **Brands** | Core identity feature — analyzes Instagram/TikTok/YouTube/websites to build speaking style, writing style, audience, offers, key phrases |
| ~2026-07 | **MCP integrations** | Higgsfield, Notion, Slack, Gmail, Google Calendar; stated as all tiers |
| 2026-06-18 | **Chat Settings** | Font size, message width, voice auto-send, live transcript, "Sound More Human" mode |
| 2026-05-07 | **References** | `@`-mention citation of connected sources; searchable, platform-labeled, keyboard-navigable |
| 2026-03-26 | **Document Preview** | Inline PDF preview on-board; document renaming |
| 2026-03-22 | **Outliers** | Performance analysis across Instagram/TikTok/YouTube; rolling-average outlier scores; one-click add; gap analysis |
| 2025-12-16 | *(doc dated)* | Confirmation that Poppy uses neither RAG nor persistent memory |

**Trajectory read:** through mid-2026 Poppy shifted from *canvas primitives* to *persistent, cross-board, auto-updating layers* — Brands, Vault, Prompt Library, Creator Profiles. It is progressively adding back the "memory" that §8 says it doesn't have, but as **explicit user-managed objects** rather than as RAG. That is a deliberate and coherent architectural stance.

---

## 22. Consolidated Limitations

**Architectural**
- No RAG, no embeddings, no persistent cross-chat memory.
- No general internet access (the Perplexity block is the only escape hatch).
- Long chats crowd out attached files, because history is prioritized over sources.
- Per-model token limits are user-visible and hit often enough to warrant two dedicated troubleshooting articles.

**Ingestion**
- 100 MB per-file cap.
- Single page per website; no crawling.
- No visual analysis for YouTube, Zoom, or Loom.
- Ingested social content breaks if deleted at the source.
- No login-walled content.
- No bulk import; occasional link-fetch timeouts. **[REVIEW]**

**API**
- No file upload.
- No visual analysis.
- No public developer reference (endpoints/auth/schemas undocumented publicly).
- Top tier only.

**Output**
- Landing pages: no forms, no payments, no multi-page; VSL is YouTube-only.
- Carousels may be one image at a time depending on build.
- Face-swap quality poor.
- Word-count adherence unreliable.

**Collaboration**
- Sharing requires the other party to hold a Poppy account (or a purchased seat).
- Collaborators can't duplicate boards or restore versions.
- No granular permission roles.

**Commercial**
- Annual billing only; no monthly.
- Credits don't roll over.
- Plan upgrades are non-refundable.
- Refund eligibility gated on attending an onboarding call.
- Price is the dominant criticism in every third-party review — $399/yr entry, and real agency use lands on the $2,268–$4,788/yr tiers.

**UX**
- No dark mode. **[REVIEW]**
- Web only.
- Two contradictory plan taxonomies between checkout and help center.

---

## 23. Competitive Position

**Nearest analogues:** the canvas is Miro/Whimsical/tldraw; the AI-node-graph is Flowith, AFFiNE AI Edgeless, or a friendlier ComfyUI; the content-research half is vidIQ/1of10-style outlier tooling.

**Actual moat:** *no single competitor does both halves.* Miro has no transcription or outlier discovery. vidIQ has no canvas or generation. ChatGPT has no spatial context control and can't ingest a TikTok. The wedge is the **combination** plus a very specific ICP.

**Their own stated differentiator** (from the "What Makes Poppy Different from Claude or Custom GPTs?" help article): explicit visual context control, multi-model access in one place, multiplayer, and native social-media ingestion — versus a custom GPT's opaque, static knowledge file.

**Real defensibility, honestly assessed:** low on technology, high on ICP focus, workflow templates, community, and the onboarding-call activation motion. Every individual feature is replicable; the assembled workflow and the creator-community distribution are what actually retain users.

---

## Appendix A — Gap Map Against This Repo

Where `poppy-clone` currently stands relative to the above. Feature names in code refer to `CLAUDE.md` §6C.

| Area | Poppy | This repo | Notes |
|---|---|---|---|
| Infinite canvas | ✓ | ✓ | `@xyflow/react` |
| Media source node | All platforms in §6.1 | YouTube, TikTok, Instagram | `MediaSourceNode` |
| Transcript node | ✓ auto | ✓ auto, editable | `TranscriptNode`; captions-first then Whisper |
| Generation node | ✓ chat history, composer, resize | ✓ streaming markdown chat | `GenerationNode`, labeled **Chat**; Enter to send, drag corners to resize |
| File / upload nodes | ✓ | ✓ text files | toolbar **File**; type-specific preview (table / markdown / JSON / HTML); wires into chat like a transcript |
| Edge = context | ✓ | ✓ | transcript → generation |
| Model roster | 4 text + 2 image + Perplexity | 1 local OpenAI-compatible model | biggest divergence; ours is $0 and private |
| Context strategy | stuff the window, no RAG | context capped at `MAX_CONTEXT_CHARS` | same philosophy, different reason (latency, not recall) |
| Transcription | cloud, "seconds" | local `faster-whisper` | ours is free but slower |
| Text box / rich editor | ✓ Notion-style | ✗ | cheap, high-value gap |
| Groups | ✓ | ✗ | |
| Voice note input | ✓ + grammar cleanup | ✗ | Whisper is already wired — low-hanging |
| Brands / brand voice | ✓ | ✗ | the highest-leverage missing feature |
| Vault | ✓ | ✗ | |
| Prompt library | ✓ | ✗ | |
| `@` references | ✓ | ✗ | |
| Thinking modes | ✓ | partial — `LOCAL_LLM_PROMPT_SUFFIX=/no_think` is the inverse lever | worth exposing as a UI toggle |
| Outliers / Discover | ✓ | ✗ | needs platform APIs; hard to do at $0 |
| Image generation | ✓ | ✗ | would need a local diffusion model |
| Landing pages | ✓ | ✗ | |
| Multiplayer | ✓ | ✗ | needs a sync backend |
| Version history | ✓ | ✗ | |
| Credits / metering | ✓ | N/A by design | local inference has no marginal cost — a real differentiator |
| Keyboard shortcuts | full set (§5) | ✗ | trivial to add; §5 is copyable as-is |
| Dark mode | ✗ | — | free win |

**Cheapest high-value adds, in order:** keyboard shortcuts (§5) → text-box nodes → voice-note input (Whisper already present) → groups → prompt library → brand voice as a system-prompt object.

---

## Sources

Official:
- [getpoppy.ai](https://getpoppy.ai/)
- [Poppy AI Changelog (Featurebase)](https://feedback.getpoppy.ai/changelog)
- [Poppy AI Feedback & Roadmap](https://feedback.getpoppy.ai/)
- [Help Center home](https://intercom.help/poppy-ai/en/)
- [How Poppy AI Works (collection, 26 articles)](https://intercom.help/poppy-ai/en/collections/11475990-how-poppy-ai-works)
- [Getting Started](https://intercom.help/poppy-ai/en/articles/12325324-getting-started)
- [POPPY AI SHORTCUTS](https://intercom.help/poppy-ai/en/articles/10528305-poppy-ai-shortcuts)
- [Content Integration](https://intercom.help/poppy-ai/en/articles/11529424-content-integration)
- [How Poppy's Memory Actually Works](https://intercom.help/poppy-ai/en/articles/11158087-how-poppy-s-memory-actually-works)
- [Understanding Credits](https://intercom.help/poppy-ai/en/articles/11465762-understanding-credits)
- [Troubleshooting High Credit Usage](https://intercom.help/poppy-ai/en/articles/11465826-troubleshooting-high-credit-usage)
- [Board Collaboration](https://intercom.help/poppy-ai/en/articles/11542923-board-collaboration)
- [Image Generation in Poppy](https://intercom.help/poppy-ai/en/articles/12111710-image-generation-in-poppy)
- [Landing Pages: How to Create and Publish](https://intercom.help/poppy-ai/en/articles/12515081-landing-pages-how-to-create-and-publish)
- [Notion Integration](https://intercom.help/poppy-ai/en/articles/12829805-notion-integration-seamlessly-connect-your-workspace-to-poppy)
- [Poppy API & Power User FAQ](https://intercom.help/poppy-ai/en/articles/12666719-poppy-api-power-user-frequently-asked-questions)
- [Power User Upgrade](https://intercom.help/poppy-ai/en/articles/11464499-power-user-upgrade)
- [Chat Errors: What They Mean & How to Fix Them](https://intercom.help/poppy-ai/en/articles/14025721-chat-errors-what-they-mean-how-to-fix-them)
- [Pricing Options](https://intercom.help/poppy-ai/en/articles/11428985-pricing-options)
- [Content Test Links](https://intercom.help/poppy-ai/en/articles/13406177-content-test-links)
- [API launch page](https://getpoppy.ai/api-launch)
- [Poppy AI Blog](https://blog.getpoppy.ai/)

Vendor / marketplace:
- [Poppy AI on AppSumo](https://appsumo.com/products/poppy-ai/)
- [Skool: Poppy AI Viral Content Academy](https://www.skool.com/getpoppyai/about)
- [Starter Story: How We Built a $4M/Year AI Content App](https://www.starterstory.com/stories/poppyai-write-emails-that-sell)
- [Startup Spells: bootstrapped to $500K MRR](https://startupspells.com/p/poppy-ai-bootstrapped-saas-500k-mrr-1000-year-subscriptions)
- [Crunchbase](https://www.crunchbase.com/organization/poppy-ai)

Third-party reviews:
- [KATTA.CO review (2026)](https://katta.co/poppy-ai-review/)
- [ChatGrid: Poppy AI Pricing 2026](https://www.chatgrid.ai/blog/poppy-ai-pricing)
- [VidProMom review](https://vidpromom.com/poppy-ai/)
- [SkillScouter review](https://skillscouter.com/poppy-ai-review/)
- [Andrew Murray: 30 days with Poppy AI](https://www.andrewmurrayhq.com/poppy-ai/)
- [EntreResource review](https://entreresource.com/poppy-ai-review/)
- [Visual Velocity: mind map output](https://visualvelocity.substack.com/p/poppy-ai-adds-mind-map-output-heres)
- [G2 reviews](https://www.g2.com/products/poppy-ai/reviews)

Disambiguation (different products):
- [TechCrunch: Poppy proactive AI assistant](https://techcrunch.com/2026/05/13/poppy-debuts-a-proactive-ai-assistant-to-help-organize-your-digital-life/)
- [9to5Mac: Poppy indie app spotlight](https://9to5mac.com/2026/05/23/indie-app-spotlight-poppy-proactive-ai-assistant-digital-management-organization/)
