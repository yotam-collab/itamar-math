# Daily Coach System — Design Spec

## Overview

A smart daily coaching system for ZNK (English bagrut exam prep app) that combines an automated planning bot, AI-powered "team members," and real human staff escalation — all delivered through a floating chat widget.

**Target audience:** ~20-year-old post-military students, many with ADHD/learning disabilities, preparing for the English bagrut exam.

**Core value:** Students feel supported by a professional team that understands them, while 95% of interactions are handled automatically.

---

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌────────────┐
│  React App   │────>│  WordPress REST  │────>│  Claude AI │
│  (Widget)    │<────│  API (Plugin)    │<────│  API       │
└──────────────┘     └────────┬─────────┘     └────────────┘
                              │
                    ┌─────────┼──────────┐
                    v         v          v
              ┌─────────┐ ┌────────┐ ┌────────────┐
              │ DB      │ │ Email  │ │ WP Admin   │
              │ Chats   │ │ Staff  │ │ Staff      │
              │ Plans   │ │ Alerts │ │ Dashboard  │
              └─────────┘ └────────┘ └────────────┘
```

### Why WordPress Plugin

- Student already has WordPress + LearnDash credentials — single auth
- LearnDash enrollment = access control (removed from course = no widget)
- Staff already uses WP Admin — dashboard lives there naturally
- Email via wp_mail — no new service needed
- No new infrastructure — runs on existing server

### Auth & Access

- Student lands on the React app via a link from the WordPress/LearnDash site
- WordPress passes a short-lived auth token as a URL parameter
- React app exchanges the token for a JWT via `POST /wp-json/znk-coach/v1/auth/exchange`
- JWT stored in localStorage (alongside existing Zustand stores)
- JWT expires after 7 days; refresh flow via `POST /wp-json/znk-coach/v1/auth/refresh`
- If JWT is expired and refresh fails → widget shows "התחבר מחדש" button linking to WordPress login
- Every API request checks LearnDash enrollment status
- Course removal = immediate widget access revocation

### Client-Server Data Sync

The existing SM-2, Elo, and vocabulary progress live client-side (Zustand + localStorage). The server needs this data for plan generation:

- After each practice session, React app sends a sync payload: `POST /wp-json/znk-coach/v1/sync`
- Payload includes: words practiced (with accuracy), Elo rating, units completed, streak
- Server stores latest snapshot per student
- `PlanGenerator.php` uses server-side snapshot (may be up to 24h stale — acceptable)
- If sync fails → queued in localStorage, retried on next app open

---

## The 3 Entities in Chat

| Entity | Name | Icon | When responds | Delay | Powered by |
|--------|------|------|---------------|-------|------------|
| **Plan Bot** | "המערכת" | 🤖 | 24/7, immediate | 0-2s | Local algorithm |
| **Coach** | "רוני" | 👩‍💻 | Sun-Thu 8-22, Fri until 13 | 2-8 min | Claude API |
| **Exam Expert** | "דנה" | 👨‍🎓 | Same hours as Roni | 3-10 min | Claude API |

### Who Answers What

**Plan Bot** handles:
- Schedule changes ("I only have 20 minutes today")
- Plan updates and mission status
- Automatic encouragement ("Great job! 3/4 done!")
- Technical plan questions

**Roni (Coach)** handles:
- Vocabulary learning questions
- Motivation and emotional support
- ADHD-related struggles
- General learning strategy

**Dana (Exam Expert)** handles:
- Exam question types (restatement, sentence completion)
- Reading comprehension strategies
- Exam-specific tips and techniques

### Persona Selection

`PersonaRouter` uses a single Claude API call with a routing system prompt to both classify AND respond:

1. Student message arrives at the server
2. Server builds a prompt with: student message, conversation history (last 20 messages), student profile (Elo, weak areas, streak), staff overrides
3. System prompt instructs Claude to: (a) select persona (bot/roni/dana) based on content, (b) respond in that persona's voice
4. Claude returns: `{ "persona": "roni", "response": "..." }`
5. One API call, not two — no extra latency for routing

**Classification rules in the system prompt:**
- Schedule/plan/time changes → bot (handled locally, no Claude needed)
- Vocabulary, motivation, emotional, ADHD, general → roni
- Exam questions, restatement, reading comprehension, test strategy → dana
- Ambiguous → roni (default, warmer persona)

**Fallback:** If Claude API fails → bot responds with "הצוות שלנו יחזור אליך בהקדם" + escalation email sent.

### Off-Hours Behavior

- **Bot:** Responds immediately, always
- **"Team members":** Message queued, student sees "רוני תענה לך מחר בבוקר 💤"
- Next morning: response appears as if Roni read and replied

### Off-hours definition
- Sunday–Thursday: after 22:00 until 08:00
- Friday: after 13:00
- Saturday: all day until 20:00
- Saturday after 20:00 = active (like a weekday evening)

---

## Communication Style

All AI personas follow ZNK's communication principles:

- **Professional but warm** — not robotic, not condescending
- **Encourages elaboration** — "Tell me more, what exactly did you feel when you got stuck?"
- **Gender-aware** — uses existing `g()` utility for Hebrew gendered text
- **Natural Hebrew** — no excessive formality
- **Measured emoji use** — present but not overdone
- **Sensitive to struggles** — especially ADHD-related challenges

---

## Daily Plan Algorithm

### Generation

- WordPress cron runs at 02:00 nightly
- Local algorithm (no Claude API) — fast, free, consistent
- Creates personalized plan for each active student

### Inputs

| Parameter | Source |
|-----------|--------|
| Days until exam | Student profile |
| Available time today | Default 30 min, adjustable via chat |
| Words due for review | SM-2 algorithm (existing in codebase) |
| Elo rating | Calculated from adaptive practice |
| Weak words | accuracy < 70% in last 3 exposures |
| Units learned/unlearned | Existing store |
| Staff overrides | DB — instructions from real staff |

### Time Allocation (30 min example)

Following the 85% accuracy rule (maintaining ~85% success rate):

```
├── 8 min  New words (10 words from next unit)
├── 7 min  Word practice (SM-2 — words due for review)
├── 8 min  Reading (passage + questions, difficulty-matched)
├── 7 min  Exam questions (SC + restatement, Elo-based)
```

### Automatic Adjustments

- **Time constraint:** "Only 15 min" → reduces to 2 tasks, prioritizes review + one exam type
- **Struggling with topic:** Repeated failures in restatement → more restatement in coming days, lower difficulty
- **All complete:** Offers bonus mission (weak words / bonus questions)
- **Friday:** Lighter plan (review only, no new material)

### Morning Message

- Generated via Claude API once daily (during plan creation)
- Claude receives: performance summary, streak, weak words, staff instructions
- Returns: warm personalized message (2-3 sentences)
- Stored in DB, displayed when student opens widget

---

## Message System (Extensible)

### Message Schema

```
message {
  id
  student_id
  sender: 'bot' | 'roni' | 'dana' | 'staff:{name}' | 'student'
  type: 'text' | 'morning_message' | 'mission_card' | 'system_update' | 'plan_update'
  content
  metadata: {}              — mission details, plan diff, etc.
  channel: 'widget'
  priority: 'normal' | 'high'
  delivery_targets: []
  created_at
  delivered_at
  read_at
}
```

### Current Channel

- `widget` — the chat widget inside the React app

### Future Channels (no core logic changes needed)

| Channel | When | Example |
|---------|------|---------|
| **Push** | Native app | "Roni: Hey, I checked and you have 3 words worth reviewing" |
| **WhatsApp** | Reminders + encouragement | "Good morning! Your plan is waiting (25 min)" |
| **Email** | Weekly summary | "Your week: +45 words, 4-day streak" |

### Delivery Architecture

- `MessageService` creates all messages
- `DeliveryService` routes through adapters: `WidgetAdapter`, `PushAdapter`, `WhatsAppAdapter`, `EmailAdapter`
- Adding a channel = adding an adapter, no changes to message creation logic
- Per-student channel preferences and quiet hours

### Delivery Rules

| Message type | Widget | Push | WhatsApp |
|-------------|--------|------|----------|
| Daily plan | Always | Morning only | Morning only |
| "Team" response | Always | Always (within hours) | No |
| "Haven't practiced" reminder | — | Afternoon | Afternoon |
| Weekly summary | — | — | Email only |

### Unread Tracking

- Every widget message tracked: `delivered_at` + `read_at`
- If student doesn't open widget → after X hours, send via push/whatsapp
- Prevents spam while ensuring delivery

---

## Escalation to Real Staff

### Automatic Triggers

- Repeated frustration: 3+ negative messages in a session
- Student explicitly asks to talk to someone
- AI confidence is low (Claude returns low-confidence signal)
- Student inactive 3+ days (automatic email)

### Escalation Flow

1. AI responds normally (student doesn't notice escalation)
2. Email sent to relevant staff member with link to conversation in WP Admin
3. Staff can: read conversation, override AI response, write directly, add instructions for bot
4. Staff response appears in widget with their real name

---

## Database Schema

```sql
-- Students (extends WP users)
znk_coach_students (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  wp_user_id BIGINT UNIQUE NOT NULL,
  elo_rating INT DEFAULT 800,
  streak_days INT DEFAULT 0,
  exam_date DATE,
  daily_minutes INT DEFAULT 30,
  last_sync_at DATETIME,
  sync_data JSON,                    -- latest client-side snapshot
  created_at DATETIME,
  updated_at DATETIME
)

-- Messages
znk_coach_messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  student_id BIGINT NOT NULL,
  sender VARCHAR(50) NOT NULL,       -- 'bot', 'roni', 'dana', 'staff:yotam', 'student'
  type VARCHAR(30) DEFAULT 'text',   -- 'text', 'morning_message', 'mission_card', 'system_update', 'plan_update'
  content TEXT NOT NULL,
  metadata JSON,
  channel VARCHAR(20) DEFAULT 'widget',
  priority VARCHAR(10) DEFAULT 'normal',
  created_at DATETIME,
  delivered_at DATETIME,
  read_at DATETIME,
  INDEX idx_student_created (student_id, created_at)
)

-- Daily Plans
znk_coach_plans (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  student_id BIGINT NOT NULL,
  plan_date DATE NOT NULL,
  total_minutes INT,
  missions JSON,                     -- array of mission objects
  morning_message TEXT,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'modified', 'completed'
  created_at DATETIME,
  UNIQUE KEY idx_student_date (student_id, plan_date)
)

-- Missions (denormalized from plan for tracking)
znk_coach_missions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  plan_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  type VARCHAR(30) NOT NULL,         -- 'vocab_learn', 'vocab_practice', 'reading', 'exam_sc', 'exam_restatement'
  params JSON,                       -- { unit: 2, word_count: 10, elo_target: 1100, ... }
  estimated_minutes INT,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'skipped'
  completed_at DATETIME,
  result JSON,                       -- { accuracy: 0.85, words_practiced: 10, ... }
  INDEX idx_student_status (student_id, status)
)

-- Staff Overrides (instructions to the bot about a student)
znk_coach_overrides (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  student_id BIGINT NOT NULL,
  staff_wp_user_id BIGINT NOT NULL,
  instruction TEXT NOT NULL,         -- "lower restatement difficulty", "be gentler"
  active BOOLEAN DEFAULT TRUE,
  created_at DATETIME
)

-- Escalations
znk_coach_escalations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  student_id BIGINT NOT NULL,
  trigger_type VARCHAR(30),          -- 'frustration', 'explicit_request', 'low_confidence', 'inactivity'
  message_id BIGINT,                 -- the triggering message
  status VARCHAR(20) DEFAULT 'open', -- 'open', 'handled', 'dismissed'
  handled_by BIGINT,                 -- staff wp_user_id
  created_at DATETIME,
  handled_at DATETIME
)
```

---

## Mission Completion Flow

1. Student taps a mission in the widget → widget closes → app navigates to the relevant practice screen
2. Navigation uses mission params: e.g., `navigate('/vocab/adaptive', { missionId: 'xxx', unit: 2, wordCount: 10 })`
3. Practice screen detects `missionId` in route params → runs in "mission mode"
4. On completion (session finished, not just opened): practice screen calls `POST /wp-json/znk-coach/v1/missions/{id}/complete` with results
5. Widget re-opens or badge updates to reflect completion
6. "Complete" = session finished with any result (no minimum threshold — the point is engagement, not perfection)

---

## Claude API Prompt Structure

### Morning Message (daily, via cron)
```
System: You are the daily motivation writer for ZNK, an English bagrut
exam prep app. Write a short, warm morning message (2-3 sentences in Hebrew)
for the student. Be encouraging but not fake. Reference their specific
progress. Use the student's name and correct gender.

Context:
- Name: {name}, Gender: {gender}
- Streak: {streak} days
- Yesterday's performance: {summary}
- Weak areas: {weak_areas}
- Days until exam: {days}
- Staff notes: {overrides}
```

### Persona Response (per student message)
```
System: You are responding as a member of the ZNK support team.
Based on the student's message, respond as the most appropriate persona:

PERSONAS:
- "roni": Roni, vocabulary & motivation coach. Warm, encouraging,
  asks follow-up questions. Handles: learning struggles, ADHD,
  motivation, general questions.
- "dana": Dana, exam specialist. Knowledgeable, practical, gives
  concrete tips. Handles: exam questions, restatement, reading
  comprehension, test strategy.

STYLE:
- Professional but warm Hebrew
- Encourage student to elaborate on struggles
- Gender-aware (student gender: {gender})
- Natural emoji use (not excessive)
- 2-5 sentences max

STUDENT CONTEXT:
- Name: {name}, Elo: {elo}, Streak: {streak}
- Current weak areas: {weak_areas}
- Staff instructions: {overrides}
- Conversation history: {last_20_messages}

Respond in JSON: { "persona": "roni" | "dana", "response": "...",
"escalate": true/false, "plan_action": null | { action, params } }
```

### Conversation History Management
- Last 20 messages included in context
- Older messages summarized if conversation is long
- Staff overrides always included regardless of history length

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Claude API down/rate-limited | Bot responds: "הצוות שלנו יחזור אליך בהקדם". Escalation email sent. Message queued for retry. |
| Claude API timeout (>15s) | Same as above |
| WordPress cron fails (no plan generated) | Student sees yesterday's plan with note "התוכנית מתעדכנת...". Alert email to admin. |
| Student message fails to send | Client retries 3x with backoff. Shows "שליחה נכשלה, נסה שוב" with retry button. |
| LearnDash enrollment check fails | Fail-open: allow access, log error. Better than blocking a paying student. |
| Plan references deleted content | Mission skipped, replacement generated from available content. |
| Sync payload fails | Queued in localStorage, retried next session. Plan uses last known snapshot. |
| JWT expired + refresh fails | Widget shows "התחבר מחדש" button. Chat history preserved server-side. |

---

## WordPress Plugin Structure

```
znk-coach/
├── znk-coach.php              — Plugin registration, hooks
├── api/
│   ├── auth.php               — JWT login, enrollment check
│   ├── messages.php           — Send/receive messages
│   ├── daily-plan.php         — Daily plan API
│   └── staff-override.php     — Staff overrides
├── services/
│   ├── PlanGenerator.php      — Daily plan algorithm
│   ├── ClaudeService.php      — Claude API calls
│   ├── MessageService.php     — Message creation
│   ├── DeliveryService.php    — Channel delivery
│   ├── EscalationService.php  — Escalation detection + email
│   └── PersonaRouter.php      — Who answers: bot/roni/dana
├── cron/
│   └── daily-plan-cron.php    — Runs at 02:00, creates plans
├── admin/
│   ├── dashboard.php          — Main staff dashboard
│   ├── student-chat.php       — View conversation + respond
│   └── student-settings.php   — Bot instructions per student
└── db/
    └── schema.sql             — Custom tables
```

---

## Staff Dashboard (WP Admin)

### Features

- **Student list** with status indicators (active, at-risk, inactive)
- **Conversation view** — full chat history per student
- **Override AI** — edit/delete AI response, write replacement
- **Direct reply** — write message as real staff (shows real name)
- **Bot instructions** — per-student directives ("be gentler", "more reading practice")
- **Performance overview** — words learned, accuracy, weak areas, streak
- **Alert badges** — warning icon on students needing attention

---

## React Widget Component

### Placement

- `CoachWidget` component rendered in `Shell.tsx`
- Visible on all non-practice pages
- Hidden during practice/exam sessions (no distraction)
- Reappears when returning to navigation pages

### Display Modes

| Mode | Mobile | Desktop |
|------|--------|---------|
| **Closed** | FAB button (bottom-left, above nav) + badge | Same, bottom-left |
| **Open** | Bottom sheet ~80% screen, drag-to-dismiss | Floating window 380px |
| **In practice** | Hidden completely | Hidden completely |

### Auto-Open Behavior

- Opens automatically on first daily visit
- If student closes → stays closed, badge pulses
- New "team" message → badge jumps + subtle sound

### State Management

```typescript
interface CoachStore {
  // Widget state
  isOpen: boolean
  unreadCount: number

  // Daily plan
  dailyPlan: DailyPlan | null
  missions: Mission[]
  completedMissions: string[]

  // Conversation
  messages: Message[]
  isTyping: boolean

  // Actions
  fetchDailyPlan(): Promise<void>
  sendMessage(text: string): Promise<void>
  completeMission(id: string): Promise<void>
  markAsRead(): void
}
```

### API Endpoints

```
POST /wp-json/znk-coach/v1/auth/exchange    — exchange WP token for JWT
POST /wp-json/znk-coach/v1/auth/refresh     — refresh expired JWT
GET  /wp-json/znk-coach/v1/plan/today       — get today's plan + missions
GET  /wp-json/znk-coach/v1/messages         — get messages (supports If-Modified-Since)
POST /wp-json/znk-coach/v1/messages         — send student message
POST /wp-json/znk-coach/v1/missions/{id}/complete — mark mission done with results
POST /wp-json/znk-coach/v1/sync             — upload client-side learning state
```

### Data Fetching

- **Adaptive polling:**
  - Widget open → poll every 15 seconds
  - Widget closed → poll every 60 seconds (for badge updates)
  - App in background / practice mode → no polling
  - After sending a message → poll every 5 seconds for 2 minutes (waiting for response)
- No WebSocket needed — intentional delays make polling sufficient
- Plan fetched once on widget open, cached for session
- Uses `If-Modified-Since` header to minimize payload when no new messages

---

## Widget UI Summary

### Header
- Stacked team avatars (3 overlapping circles)
- "צוות זינוק" with online indicator
- Exam countdown + day in program

### Chat Body
- Bot messages: white bubble, 🤖 avatar, "בוט התוכנית" label
- Team messages: white bubble, persona avatar, "רוני · מצוות זינוק" label
- Student messages: purple bubble, right-aligned
- System messages: subtle bar ("התוכנית עודכנה · 33 דק' → 20 דק'")
- Mission buttons: colored cards with completion animation
- Progress bar: gradient fill with count

### Input Area
- Text input with placeholder "כתוב הודעה לצוות..."
- Send button (purple gradient)
- Enter to send, Shift+Enter for newline
- Footer: "צוות זינוק · בוט + 3 אנשי צוות · זמן מענה ממוצע: 6 דקות"

---

## Mockups

- Desktop widget: `.superpowers/brainstorm/85755-1773970062/coach-widget-v1.html`
- Mobile bottom sheet: `.superpowers/brainstorm/85755-1773970062/coach-widget-mobile-v1.html`
- Mobile with chat + team: `.superpowers/brainstorm/85755-1773970062/coach-widget-mobile-v2.html`

---

## Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Backend | WordPress Plugin | Existing server, LearnDash auth, staff already in WP Admin |
| AI for team personas | Claude API with delay | Feels human, instant would break illusion |
| Daily plan algorithm | Local (no AI) | Fast, free, consistent, works offline |
| Morning message | Claude API (once daily) | Worth the cost for personalization |
| Real-time updates | Polling (30s) | Intentional delays make WebSocket unnecessary |
| Off-hours | Queue + deliver next morning | Critical for human illusion |
| Channel architecture | Adapter pattern | Future-proof for push/WhatsApp/email |
| Escalation | Auto-detect + email staff | Students don't notice, staff intervenes when free |

---

## Files to Create/Modify

### New (WordPress Plugin)
- `znk-coach/` — entire plugin directory (see structure above)

### New (React)
- `src/features/coach/CoachWidget.tsx` — main widget component
- `src/features/coach/CoachFab.tsx` — floating action button
- `src/features/coach/ChatBody.tsx` — message list
- `src/features/coach/ChatInput.tsx` — text input
- `src/features/coach/MissionCard.tsx` — mission buttons
- `src/features/coach/SystemMessage.tsx` — system update messages
- `src/stores/coachStore.ts` — Zustand store
- `src/services/coachApi.ts` — API client

### Modified
- `src/components/layout/Shell.tsx` — add CoachWidget
- `src/stores/studentProfileStore.ts` — add WordPress auth fields

---

## Verification

1. `npm run build` — no errors
2. Widget appears on home page, hidden during practice
3. FAB shows badge with mission count
4. Mobile: bottom sheet opens/closes with drag
5. Desktop: floating window opens/closes
6. Daily plan displays with missions
7. Clicking mission navigates to practice, marks complete on return
8. Student can type message and receive bot response
9. "Team" responses arrive with appropriate delay
10. Off-hours messages queued and delivered next morning
11. Staff dashboard shows conversations in WP Admin
12. Staff can override AI response
13. Escalation email sent on repeated frustration
14. LearnDash enrollment check blocks unenrolled students
