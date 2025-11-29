## 🚀 Predictive Cash Flow Agent + Security Hardening - Implementation Complete

### What Was Implemented

#### NEW (Agentic Automations)
- **Spending Guardrail Agent** (`spendingGuardrailAgent` in `lib/inngest/functions.js`): runs every 4 hours, inspects the last 5 weeks of discretionary expenses per user, and creates `spending-guardrail` nudges when the current 7-day burn rate is ≥30% above baseline or ₹1.5k+. Auto-approved users get their primary budget temporarily locked for dining/entertainment categories, and every nudge carries guardrail metadata (baseline, overshoot, clamp plan) for dashboards + digest.
- **Goal Backstop Agent** (`goalBackstopAgent` in `lib/inngest/functions.js`): daily 7:45 AM check of active goals. If progress trails the ideal pace by >12%, it issues a `goal-backstop` nudge with the required catch-up transfer, weeks-left math, and automation plan so Jarvis/Explainability can justify the move.
- **Nudge Type Registry** (`lib/nudge-engine.js`): added `SPENDING_GUARDRAIL` and `GOAL_BACKSTOP` enums plus impact models so analytics + accept flows recognize the new agent outputs.
- **Judge Agent Console** (`app/api/agents/run/route.js`, `app/(main)/dashboard/_components/agent-console.jsx`): secure API + dashboard widget that lets authenticated judges fire any whitelisted Inngest automation (guardrail, backstop, digest, forecast) with a single click. The console talks to the local Inngest dev server, reports status inline, and documents all slugs in `lib/agents/agent-trigger-registry.js` for easy expansion.

#### 1. **Predictive Cash Flow Agent** (`lib/agents/predictive-agent.js`)
- Analyzes 30 days of spending patterns using transaction history
- Uses Gemini AI to forecast end-of-month balance
- Identifies critical dates when balance drops below safety threshold
- Generates 2-3 recommended preventive actions
- Includes 6-hour caching to reduce API costs
- Returns risk level: low/medium/high/critical

**Key Functions:**
- `generateCashFlowForecast(userId, financialData, transactions)` - Main forecast generator
- `isForecastCritical(forecast)` - Check if emergency alert needed
- `getCachedForecast(userId)` - Get cached result if available
- `setCachedForecast(userId, data)` - Cache forecast for 6 hours

#### 2. **Predictive API Endpoint** (`app/api/RythmIQ-ai/predict/route.js`)
- **Route:** `GET /api/RythmIQ-ai/predict`
- **Auth:** Required (via checkUser)
- **Rate Limit:** 5 requests/minute (forecasts are expensive)
- **Response:** 30-day forecast with risk assessment and recommendations
- **Caching:** 6-hour TTL per user

**Example Response:**
```json
{
  "success": true,
  "forecast": {
    "risk_level": "medium",
    "predicted_balance_day_30": 5240,
    "critical_dates": [
      { "day": 15, "reason": "Expected salary withdrawal", "predicted_balance": 2100 }
    ],
    "recommended_actions": ["Reduce dining expenses", "Delay non-essential purchases"],
    "confidence": 85,
    "summary": "Your balance will trend down mid-month, but stabilize by end of month."
  },
  "patterns": {
    "weeklyAverage": 1200,
    "monthlyAverage": 4800,
    "topCategories": [{"category": "Food", "amount": 2500}]
  }
}
```

#### 3. **Predictive Alerts Component** (`components/rag/PredictiveAlerts.jsx`)
- Visual 30-day balance projection chart
- Risk level display with color coding
- Critical dates warning timeline
- Spending pattern analysis
- Recommended action list
- Refresh button to regenerate forecast

**Integration:**
```jsx
import PredictiveAlerts from "@/components/rag/PredictiveAlerts";

export default function Dashboard() {
  return (
    <div>
      <PredictiveAlerts />
    </div>
  );
}
```

#### 4. **Response Sanitization** (`lib/security/sanitize-ai.js`)
- **Prevents XSS attacks** from LLM outputs
- Removes dangerous HTML tags: `<script>`, `<iframe>`, event handlers
- Escapes HTML entities while preserving safe formatting (bold, italic, paragraphs)
- Handles JSON responses recursively
- Functions:
  - `sanitizeAIResponse(text)` - Sanitize single response
  - `sanitizeInsights(insights)` - Sanitize insight cards
  - `sanitizeJSONResponse(jsonString)` - Sanitize structured JSON
  - `createSanitizedChatResponse(message)` - Create safe chat response

**Applied to:**
- Chat endpoint responses
- Insight cards
- Forecast summaries
- Daily briefing content

#### 5. **Rate Limiting Middleware** (`lib/security/rate-limiter.js`)
- **Per-user rate limits** on AI endpoints
- **Configurable limits** by endpoint:
  - Chat: 30 req/min
  - Search: 20 req/min
  - Insights: 10 req/min
  - Predict: 5 req/min (expensive)
  - Jarvis: 10 req/min
- In-memory storage (auto-cleanup)
- Returns 429 Too Many Requests when exceeded
- Includes rate limit headers in responses

**Functions:**
- `checkRateLimit(userId, endpoint)` - Main rate limit check
- `getRemainingRequests(userId, endpoint)` - Get remaining quota
- `getRateLimitStats()` - Monitoring/debugging

**Usage in endpoints:**
```javascript
const rateLimitCheck = checkRateLimit(user.id, "/api/RythmIQ-ai/chat");
if (rateLimitCheck.exceeded) {
  return NextResponse.json(rateLimitCheck.response, { status: 429 });
}
// ... continue with handler
```

#### 6. **Enhanced RAG Endpoints** with Security & Rate Limiting
Updated these endpoints:
- `POST /api/RythmIQ-ai/chat` - Added sanitization + rate limiting
- `GET /api/RythmIQ-ai/insights` - Added sanitization + rate limiting
- `POST /api/RythmIQ-ai/search` - Added rate limiting

**Error Handling Improvements:**
- User-friendly error messages (not stack traces)
- Detailed console logging for debugging
- Graceful fallbacks when AI fails
- Proper HTTP status codes (500, 429, 401, 400)

#### 7. **Daily Predictive Agent** (`lib/inngest/functions.js`)
- **Runs daily at 9 AM** (same time as daily briefing)
- Generates forecast for all users with transactions
- **Auto-creates EMERGENCY nudge** if critical crisis predicted
- Sends email alert to user with:
  - Risk level
  - Predicted balance
  - Critical dates
  - Recommended actions
- Clears forecast cache to ensure fresh results

**Actions Taken:**
- Creates nudge: Type="EMERGENCY", status="pending"
- Sends sanitized email with crisis forecast
- Clears cache for next check

#### 8. **Enhanced Daily Briefing** (`lib/inngest/daily-briefing.js`)
- Daily briefing now **includes 30-day forecast**
- Shows up to 2 critical dates
- Lists top 2 recommended actions
- Forecast data sanitized for safety
- If forecast fails, briefing still sent (non-blocking)

---

### How to Use

#### For Users:
1. Navigate to dashboard or metrics page
2. View **PredictiveAlerts** card
3. See 30-day balance projection
4. Check for critical dates
5. Follow recommended actions
6. Refresh to get latest forecast

#### For Developers:

**Get forecast for a user:**
```bash
curl -X GET http://localhost:3000/api/RythmIQ-ai/predict \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Check rate limit status:**
```javascript
import { checkRateLimit } from "@/lib/security/rate-limiter";

const check = checkRateLimit(userId, "/api/RythmIQ-ai/chat");
console.log(check.headers); // X-RateLimit-Remaining, etc.
```

**Sanitize AI response:**
```javascript
import { sanitizeAIResponse } from "@/lib/security/sanitize-ai";

const unsafe = "<script>alert('xss')</script> Hello";
const safe = sanitizeAIResponse(unsafe);
// Result: "Hello"
```

---

### Architecture Overview

```
User Request
    ↓
Rate Limiter (security/rate-limiter.js)
    ↓
Auth Check (checkUser)
    ↓
Predictive Agent (lib/agents/predictive-agent.js)
    ├─ Fetch transactions
    ├─ Analyze patterns
    └─ Call Gemini AI
    ↓
Sanitize Response (lib/security/sanitize-ai.js)
    ↓
Cache Result (6 hours)
    ↓
Return to Client + Rate Limit Headers
```

**Background Jobs (Inngest):**
```
Daily 9 AM
    ├─ Predictive Cash Flow Agent
    │  ├─ Generate forecasts for all users
    │  └─ Create EMERGENCY nudges if critical
    └─ Daily Morning Briefing (with forecast included)
```

---

### Features Delivered

✅ **Predictive Analytics** - 30-day cash flow forecasting  
✅ **Proactive Alerts** - Email notifications for predicted crises  
✅ **Emergency Nudges** - Automatic action creation for high-risk scenarios  
✅ **Security Hardening** - XSS prevention, input sanitization  
✅ **Rate Limiting** - Prevent abuse, manage costs  
✅ **Error Handling** - Graceful degradation, user-friendly messages  
✅ **Performance Optimization** - 6-hour forecast caching  
✅ **Monitoring Ready** - Rate limit stats for admin dashboard  

---

### Next Steps (Future Enhancements)

1. **Database Persistence** - Store forecasts for historical analysis
2. **ML Model Integration** - Replace rule-based forecasting with ML
3. **Recurring Transaction Detection** - Auto-identify monthly subscriptions
4. **Custom Alert Thresholds** - Let users set own safety limits
5. **Multi-Currency Support** - Handle international users
6. **Webhook Integration** - Connect to external financial APIs
7. **Admin Dashboard** - Monitor rate limits, forecast accuracy
8. **A/B Testing** - Test different alert strategies

---

### RhythmIQ Feature Alignment (What’s Done vs Needed)

#### 1. Shortfall Forecast & Risk Meter
- **Already live:** `lib/agents/predictive-agent.js` and `lib/predictions.js` generate 7/30-day projections, expose `risk_level`, and the UI card `components/rag/PredictiveAlerts.jsx` renders the color-coded meter plus critical dates. `checkEmiAtRisk` inside `lib/predictions.js` already flags rent/EMI shortfalls and feeds the Guardian nudges.
- **Still needed:** tighten the rent/EMI flag UX (surface it directly in the forecast widget), add mock payout events to the simulator, and persist the 7-day forecast snapshot so downstream agents can reference it without recomputation.
- **Automation hook:** daily Inngest job (`lib/inngest/functions.js`) already runs forecasts; extend it to emit a `shortfall.forecasted` event that other agents (savings, guardian) subscribe to.

#### 2. Proactive Micro-Savings Agent
- **Already live:** `lib/nudge-engine.js` emits `MICRO_SAVE` and `AUTO_SAVE` nudges when `mapRiskToMeter` returns Caution/Danger. Accepting the nudge executes a mock transfer (`executeMicroSave` / `executeAutoSave` in `actions/nudge-actions.js`) and logs impact tracking.
- **Still needed:** show the updated safety-buffer immediately in the dashboard, surface the “Save ₹120 today” copy inside Jarvis/chat, and let users pre-authorize auto-execution limits so the agent can trigger micro-saves without extra taps when engagement is high.
- **Automation hook:** reuse the behavior engine’s `autoNudgeEnabled` flag to decide when the agent can “self-approve” micro-saves, but add guardrails (daily/weekly caps + confirmation digest email).

#### 3. Bill & EMI Guardian
- **Already live:** recurring transactions with `nextRecurringDate` feed `BILL_PAY` nudges, and `checkEmiAtRisk` backs the high-priority `GUARDIAN_ALERT` that spells out shortfall + suggested fixes (`lib/nudge-engine.js`).
- **Still needed:** add a dedicated Guardian timeline component (rent/EMI countdown, shortfall amount, CTA list) and ensure the scheduler ingests all fixed obligations (consider syncing with `prisma.bill` records). We should also connect notifications/email so the alert fires even if the user skips the dashboard.
- **Automation hook:** create an Inngest workflow that watches `bill.upcoming` events, cross-references forecast buffers, and auto-creates Guardian nudges + email/push payloads 5 days ahead.

#### 4. Explainable Advice with Counterfactuals
#### 4. Explainable Advice with Counterfactuals
- **Now live:** `/api/explainability/why` + `lib/services/explainability-service.js` not only generate “why” answers but also compute counterfactuals (“Skip this micro-save → bills stay ₹1.2k short”) from live risk/allowance context.
- **UI upgrades:** Every high-signal card (nudges, risk meter, allowances) now ships with a "Why this?" affordance that opens the explainability modal showing factors, recommendations, and the cached counterfactual string.
- **Automation hook:** `precompute-nudge-explanations` keeps metadata.explanation + metadata.counterfactual warm so Jarvis, digest emails, and the new Mini Coach can cite them without recomputation.

#### 5. Behavior-Aware Nudges & Feedback Loop
- **Already live:** `lib/behavior-engine.js` tracks acceptance/rejection/ignores, sets aggressiveness, and `generateNudges` respects `maxNudgesPerDay`, `preferSummaries`, and timing preferences. Accept/reject flows automatically call `adjustProfileFromBehavior` to keep profiles adaptive.
## BONUS FEATURE: Financial Mini-Coach + Voice Agent
- Voice interactions make it feel alive (“Jarvis, how much can I spend today?”). Users can ask questions and get natural responses voiced out to them—it’s approachable and delightful.
- The **Mini Coach** dashboard widget hits `/api/coach`, understands account + risk context, and answers in English, हिंदी, or Hinglish (plus optional audio playback) so multilingual judges can see the localization story end-to-end.
- **Automation hook:** emit `nudge.feedback` events (accepted/rejected/expired) so a learning job can update bandit weights or RL policies without blocking the main request cycle.

---

### Agentic Automation Blueprint (Hands-off Experience)

| Loop | Trigger | Autonomous Action | Safeguards |
| --- | --- | --- | --- |
| **Shortfall Guardian** | `shortfall.forecasted` event emitted by predictive Inngest job | Creates/updates Guardian nudges, triggers push/email, posts context into Jarvis | Dedup per cycle, attach confidence + counterfactual, auto-closes when balance recovers |
| **Micro-Save Autopilot** | Risk = Caution/Danger _or_ buffer below ₹2k | Executes micro-save up to user-defined daily/weekly caps, logs transaction + updated buffer snapshot | Requires opt-in + limits (`autoNudgeLimitDaily`, `autoNudgeLimitWeekly`), nightly digest email with summary |
| **Bill & EMI Sentinel** | `bill.upcoming` events from recurring scheduler / `prisma.bill` records | Auto-creates payment tasks, optionally auto-pay when balance ≥ obligation + buffer, notifies user afterward | Double-checks buffer > ₹1k + user autopay preference, fallback to nudge if insufficient |
| **Explainability Cache** | `nudge.created` event | Calls `/api/explainability/why`, stores counterfactual + “what if you skip” string in `nudge.metadata` | Timeouts fall back to rule-based text, sanitized responses only |
| **Behavior Feedback Loop** | `nudge.feedback` (accept/reject/expire) | Updates engagement stats, retrains preference profile, toggles between real-time notifications vs nightly summary | Cooling-off period if user rejects >50% critical alerts, ensures no more than X high-priority nudges per day |
| **Digest + Voice Briefings** | Daily cron per behavior profile | Sends consolidated SMS/email/voice summary so user can stay hands-off | Honors `preferSummaries` flag, includes opt-out links |

Implementation order: (1) event schema + Inngest listeners, (2) guardrail-aware micro-save executor, (3) explanation cache, (4) multi-channel notifier.

---

### Troubleshooting

**Forecast not generating?**
- Check GEMINI_API_KEY is set in .env
- Verify user has at least 10 transactions
- Check Gemini API quota/limits

**Rate limit exceeded?**
- Limits reset every minute
- Check X-RateLimit-Reset header for reset time
- Implement exponential backoff on client

**Sanitization too aggressive?**
- Update DANGEROUS_PATTERNS in sanitize-ai.js
- Add to safe formatting section if needed

---

**Status:** ✅ **COMPLETE & READY FOR TESTING**

All components integrated, no build errors, ready to deploy!
