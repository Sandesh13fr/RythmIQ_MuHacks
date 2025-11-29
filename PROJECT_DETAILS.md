# RythmIQ — Project Details and System Overview

## Project Overview

RythmIQ is a proactive, agentic financial assistant designed to predict users' financial risks, suggest preventive actions (nudges), and optionally execute safe operations like auto-saving or bill payments. The product targets gig-economy workers with irregular incomes and prioritizes measurable financial impact and privacy.

## High-level Features (detailed)

- **Intelligent Nudge System:**
  - Detects opportunities (surplus funds) and risks (upcoming low balances) using ML and heuristics.
  - Generates `NudgeAction` items (auto-save, bill-pay, spending-alert, income-opportunity, emergency-buffer).
  - Tracks status lifecycle: `pending → accepted|rejected|expired → executed` with timestamps and feedback.

- **Transaction & Account Management:**
  - Connect or create `Account` entities. Transactions are stored as `Transaction` with types `INCOME`/`EXPENSE`.
  - Recurring transactions support (`isRecurring`, `recurringInterval`, `nextRecurringDate`).

- **Budgets & Financial Guardian:**
  - `Budget` models with optional locking to prevent overspending.
  - Alerts and automatic interventions when thresholds hit.

- **Bills Detection & Auto-pay:**
  - `Bill` model stores recurring obligations with `dueDay`, `nextDueDate`, and `autoPayEnabled`.
  - The system detects bills from transactions and suggests autoschedules.

- **Goals & Savings:**
  - `Goal` entities for target-based saving; suggestions route surplus into goals.

- **Personalization / Feedback Loop:**
  - `FinancialProfile` stores user personality and learned preferences (risk tolerance, preferred nudge types, optimal notification hour) and tracks accepted/rejected decisions to tune future nudges.

- **AI & Explainability:**
  - Natural language capabilities via Google Gemini + LangChain for chat/briefings and explainability prompts.
  - Explainability artifacts (why a nudge was created, expected impact) are surfaced in `Insight` entries.

- **Metrics & Dashboard:**
  - Tracks adoption (`acceptanceRate`), financial impact (`impact` on `NudgeAction`), and trends with charts.

- **Voice-first UX:**
  - Users can interact using voice queries (questions like "How much can I spend today?") backed by Gemini.

## Fintech Track Showcase Features (Top 10)

1. **Real-Time Risk Prediction Engine**
  - Predicts low-balance, bill-default, overspending, and cash-crunch risks across the next 7 days.
  - Surfaces a simple badge: `Risk score → High | Medium | Low` plus drivers (e.g., "rent due", "income delayed").

2. **Auto-Save & Auto-Bill Guard**
  - Detects surplus and sweeps micro-amounts into savings or goal wallets.
  - When bills approach, the system ring-fences the amount so it cannot be overspent, guaranteeing on-time payment.

3. **Income Rhythm Learning (RhythmIQ)**
  - Learns inflow cadence (weekly gigs, monthly retainers) and typical high-spend days.
  - Nudges and buffer-building align with each user’s rhythm, making this the signature differentiator.

4. **Behavioral Finance Engine**
  - Watches behavioral patterns (impulse purchases, late-night spikes, weekend splurges) and tags high-risk contexts.
  - Issues friendly guardrails such as "Weekends tend to overshoot by ₹800; set a ₹500 cap?".

5. **Emergency Buffer Builder**
  - Auto-allocates ₹200–₹500 weekly into a protected buffer so gig workers survive lean weeks.
  - Buffer draws are tracked and replenishment nudges trigger after usage.

6. **Bill Detection + Auto-Schedule**
  - Uses transaction intelligence to detect recurring bills and proposes protected envelopes per merchant.
  - Asks "Should I auto-protect this bill every month?" and links to Auto-Bill Guard when approved.

7. **Explainability Panel**
  - Every intervention arrives with a short fact set: e.g., "Cash shortage predicted in 4 days", "Travel spend +20%", "Rent due in 6 days".
    - Panel is exposed in dashboards and API responses so judges/stakeholders see why the agent acts.
    - "Why this?" buttons now live on nudges, risk meters, and allowances to open the modal with counterfactuals ("Skip this save → rent still short ₹1.2k").

8. **Security & Zero-Trust Safety Layer**
  - Actions above ₹500 demand OTP confirmation.
  - AI cannot transfer funds without explicit consent per session.
  - Sensitive data encrypted using AES-256 and rotated keys.
  - Full audit trail (who/what/when) for every automated action to satisfy compliance.

9. **Agent Hack Protection**
  - Watchdogs monitor anomaly signals; abnormal agent output triggers an autopilot lock.
  - User receives "Suspicious activity detected. Autopilot disabled for safety." and must re-authorize.

10. **Financial Literacy Mini-Coach**
  - Embedded voice/chat micro-coach answers "How much can I spend today?", "Why am I running low?", "What should I save this week?" in English, हिंदी, and Hinglish.
  - Reinforces healthy behavior with quick, contextual education snippets and can read the answer aloud for hands-free help.

## Bonus Capabilities (roadmap-ready)

- **Alternate Credit Score for Gig Workers:** scores based on on-time bills, saving streaks, and spending stability to unlock formal credit.
- **Offline Mode:** caches insights and nudges locally with sync queues for low-connectivity regions.
- **Multi-Language + Hinglish:** localized copy such as "Bhai, iss week ₹300 bach jayenge. Save karu?" to boost trust with regional users.

## Key Code Areas (where features live)

- `app/` — Next.js App Router routes and server components.
- `app/api/` — Server endpoints and background API routes (agents, transactions, nudges, notifications).
- `components/` — Reusable UI: dashboards, nudges, cards, agent interface, etc.
- `actions/` — High-level actions (accounts, budget, dashboard, goals, transaction flows, seed data, email helpers).
- `lib/` — Core logic: `behavior-engine`, `nudge-engine`, `predictions`, `rag`, `spending-allowance`, `prisma` helper, and AI utilities.
- `hooks/` — Client hooks such as `use-fetch.js`.
- `prisma/` — DB schema (`schema.prisma`) and migrations; models reflect domain objects.
- `data/` & `emails/` — Static data and templates used for notifications and demos.

## System Architecture & Data Flow

1. Ingestion
   - Transactions are imported (manual, linked account, or CSV/seed). The `Transaction` model records details including category, amount, date, and account.

2. Preprocessing & Storage
   - On ingest, transactions are normalized, and embeddings may be generated for semantic search / RAG use (Gemini embeddings + vector DB like `chromadb`).

3. Prediction & Scoring
   - The `predictions` module runs models/heuristics (moving averages, seasonality detection, custom ML) to forecast future balances, cashflow, and risk.

4. Nudge Generation
   - `nudge-engine` listens to predictions and business rules to create `NudgeAction` entries with `reason`, `amount`, `priority`, and expected `impact`.

5. User Interaction
   - Nudges are surfaced in the UI (cards, Daily Briefing, metrics). Users can `accept` or `reject`. Accepted nudges may trigger on-platform actions (e.g., transfer to savings) or instruct integrations (UPI, payment gateway).

6. Execution & Feedback
   - Executions are processed (via secure operations / external APIs). Outcomes are recorded (`executedAt`, `status`, `impact`). User feedback updates `FinancialProfile` to personalize future nudges.

7. Background Jobs & Scheduling
   - Inngest is used for scheduled tasks and event-driven workflows: recurring transaction processing, periodic predictions, reminder emails, and analytics.

## Data Model Notes (from `prisma/schema.prisma`)

- `User` is central and relates to `Account`, `Transaction`, `Budget`, `Insight`, `NudgeAction`, `Goal`, `Bill`, `FinancialProfile`.
- `NudgeAction` contains rich metadata and feedback fields to enable analytics and personalization.
- `FinancialProfile` stores both onboarding quiz answers and learned preference arrays (preferred/disliked nudge types, `optimalNudgeHour`).

## Security & Privacy

- Authentication: Clerk (`@clerk/nextjs`) handles user sign-in, sessions, and tokens.
- Database: Postgres (Neon recommended) via Prisma with DB credentials in `DATABASE_URL` / `DIRECT_URL` in environment.
- AI keys & secrets: keep `GEMINI_API_KEY`, Clerk keys, Inngest keys, and any payment/UPI credentials in environment variables — never in source control.
- Privacy: design assumes data minimization; consider encrypting sensitive fields and auditing read/write access.

## Dev Setup & Commands

- Install:

```powershell
git clone <repo-url>
cd <repo-dir>
npm install
```

- Common scripts (from `package.json`):

```powershell
npm run dev        # Start Next dev (Turbopack)
npm run build      # Build
npm run start      # Production start
npm run lint       # Lint
```

- After install, Prisma client is generated automatically (`postinstall` runs `prisma generate`). For database migrations:

```powershell
npx prisma migrate dev --name init
```

- Environment variables (create `.env` from `.env.example`):

```text
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
GEMINI_API_KEY="..."
INNGEST_EVENT_KEY="..."
INNGEST_SIGNING_KEY="..."
```

## Deployment

- Primary deployment target: Vercel (Next.js App Router). Use environment variables in Vercel dashboard.
- Serverless Postgres (Neon) is recommended for scalable storage.
- CI: GitHub Actions for tests and deployment hooks.

## Testing & Observability

- Add unit tests around `nudge-engine`, `predictions`, and `behavior-engine` for deterministic outputs.
- Monitor production metrics: nudge acceptance rate, impact amount, prediction accuracy, execution failures.
- Log AI calls (redact PII) to calculate cost and latency.

## Recommended Next Improvements

1. Add integration tests for end-to-end nudge lifecycle (generate → accept → execute → measure impact).
2. Add a vector store + embedding pipeline for better RAG and explainability (chromadb dependency exists).
3. Harden security: add field-level encryption for highly sensitive user data, rotate keys periodically.
4. Add more telemetry and alerting for Inngest job failures and payment execution errors.
5. Build an admin dashboard to review high-impact nudges and tune heuristics.

## Troubleshooting / Common Issues

- Prisma errors: ensure `DATABASE_URL` & `DIRECT_URL` are set and `npx prisma migrate dev` ran.
- Auth issues: validate Clerk keys and redirect URIs in Clerk dashboard.
- AI quota: watch Google Gemini usage and fall back to a cheaper model or cached responses for non-critical endpoints.

## Files to inspect for feature specifics

- `actions/` — implementations of user-level flows
- `lib/nudge-engine.js` — core nudge logic
- `lib/predictions.js` — forecasting and trend detection
- `prisma/schema.prisma` — canonical data model
- `app/api/*` — server API endpoints used by the frontend

## Where I added this file

The documentation file for project details is at: `/PROJECT_DETAILS.md` (project root).

## Fintech Judge-Friendly Summary

**RhythmIQ is an AI-driven financial co-pilot for gig workers.** It predicts risks, protects upcoming bills, builds emergency buffers, learns spending patterns, and automates safe savings. The stack now highlights:

- Real-time risk engine with 7-day outlook
- Auto-save plus bill guard envelopes
- Income rhythm learning + behavioral tracking
- Explainable AI with transparent panels
- Security lock, zero-trust execution, and hack protection
- Financial mini-coach across voice + chat

This positioning keeps the story simple, innovative, and tightly aligned with any fintech evaluation rubric.

---

If you'd like, I can:

- run tests or start the dev server locally,
- extend this doc with diagrams (architecture PNG/SVG), or
- create a trimmed `CONTRIBUTING.md` or `ARCHITECTURE.md` with diagrams and CI/CD specifics.

Tell me which follow-up you prefer and I'll proceed.
